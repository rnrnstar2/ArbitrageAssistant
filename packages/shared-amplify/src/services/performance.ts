/**
 * Performance Service - MVP システム設計書準拠のパフォーマンス記録サービス
 * 
 * 主要機能：
 * - 実行パフォーマンス記録（エントリー/決済）
 * - 成功率・平均実行時間統計
 * - エラー記録・リトライ追跡
 * - パフォーマンスメトリクス集計
 */

import { generateClient } from 'aws-amplify/data';
import { Schema } from '@repo/shared-backend/amplify/data/resource';
import { 
  Performance, 
  CreatePerformanceInput, 
  PerformanceFilter,
  PerformanceMetrics,
  ExecutionType
} from '@repo/shared-types';
import { getCurrentUserId } from '../client';

const client = generateClient<Schema>();

/**
 * パフォーマンス記録作成
 */
export async function createPerformance(
  input: CreatePerformanceInput
): Promise<Performance> {
  try {
    const result = await client.models.Performance.create({
      userId: input.userId,
      positionId: input.positionId,
      executionType: input.executionType,
      executionTime: input.executionTime,
      success: input.success,
      finalPrice: input.finalPrice,
      profit: input.profit,
      errorMessage: input.errorMessage,
      retryCount: input.retryCount || 0,
      timestamp: input.timestamp
    });

    if (!result.data) {
      throw new Error('Failed to create performance record');
    }

    return {
      id: result.data.id,
      userId: result.data.userId,
      positionId: result.data.positionId,
      executionType: result.data.executionType as ExecutionType,
      executionTime: result.data.executionTime,
      success: result.data.success,
      finalPrice: result.data.finalPrice,
      profit: result.data.profit,
      errorMessage: result.data.errorMessage,
      retryCount: result.data.retryCount,
      timestamp: result.data.timestamp,
      createdAt: result.data.createdAt || undefined,
      updatedAt: result.data.updatedAt || undefined
    };
  } catch (error) {
    console.error('Failed to create performance record:', error);
    throw error;
  }
}

/**
 * パフォーマンス記録一覧取得
 */
export async function listPerformanceRecords(
  filter: PerformanceFilter
): Promise<Performance[]> {
  try {
    let queryFilter: any = {};
    
    if (filter.userId) {
      queryFilter.userId = { eq: filter.userId };
    }
    
    if (filter.positionId) {
      queryFilter.positionId = { eq: filter.positionId };
    }
    
    if (filter.executionType) {
      queryFilter.executionType = { eq: filter.executionType };
    }
    
    if (filter.success !== undefined) {
      queryFilter.success = { eq: filter.success };
    }
    
    if (filter.timestampGte || filter.timestampLte) {
      queryFilter.timestamp = {};
      if (filter.timestampGte) {
        queryFilter.timestamp.gte = filter.timestampGte;
      }
      if (filter.timestampLte) {
        queryFilter.timestamp.lte = filter.timestampLte;
      }
    }

    const result = await client.models.Performance.list({
      filter: queryFilter,
      limit: 1000
    });

    return result.data.map(item => ({
      id: item.id,
      userId: item.userId,
      positionId: item.positionId,
      executionType: item.executionType as ExecutionType,
      executionTime: item.executionTime,
      success: item.success,
      finalPrice: item.finalPrice || undefined,
      profit: item.profit || undefined,
      errorMessage: item.errorMessage || undefined,
      retryCount: item.retryCount || undefined,
      timestamp: item.timestamp,
      createdAt: item.createdAt || undefined,
      updatedAt: item.updatedAt || undefined
    }));
  } catch (error) {
    console.error('Failed to list performance records:', error);
    throw error;
  }
}

/**
 * パフォーマンスメトリクス集計
 */
export async function getPerformanceMetrics(
  userId: string,
  timeRange: 'hour' | 'day' | 'week' = 'day'
): Promise<PerformanceMetrics> {
  try {
    // 時間範囲計算
    const now = new Date();
    const startTime = new Date();
    
    switch (timeRange) {
      case 'hour':
        startTime.setHours(now.getHours() - 1);
        break;
      case 'day':
        startTime.setDate(now.getDate() - 1);
        break;
      case 'week':
        startTime.setDate(now.getDate() - 7);
        break;
    }

    // パフォーマンス記録取得
    const performanceRecords = await listPerformanceRecords({
      userId,
      timestampGte: startTime.toISOString()
    });

    // ポジション統計（Position modelから取得）
    const positionsResult = await client.models.Position.list({
      filter: { userId: { eq: userId } }
    });
    
    const positions = positionsResult.data;
    const openPositions = positions.filter(p => p.status === 'OPEN').length;
    const closedPositions = positions.filter(p => p.status === 'CLOSED').length;

    // パフォーマンス統計計算
    const successfulExecutions = performanceRecords.filter(p => p.success);
    const totalExecutions = performanceRecords.length;
    const successRate = totalExecutions > 0 ? successfulExecutions.length / totalExecutions : 0;
    
    const avgExecutionTime = totalExecutions > 0
      ? performanceRecords.reduce((sum, p) => sum + p.executionTime, 0) / totalExecutions
      : 0;

    // 利益計算
    const profitRecords = performanceRecords.filter(p => p.profit !== null && p.profit !== undefined);
    const totalProfit = profitRecords.reduce((sum, p) => sum + (p.profit || 0), 0);
    const avgProfit = profitRecords.length > 0 ? totalProfit / profitRecords.length : 0;

    return {
      totalPositions: positions.length,
      openPositions,
      closedPositions,
      avgExecutionTime: Math.round(avgExecutionTime),
      successRate: Math.round(successRate * 100) / 100,
      avgProfit: Math.round(avgProfit * 100) / 100,
      totalProfit: Math.round(totalProfit * 100) / 100
    };
  } catch (error) {
    console.error('Failed to get performance metrics:', error);
    throw error;
  }
}

/**
 * 実行結果記録（ヘルパー関数）
 */
export async function recordExecutionResult(params: {
  positionId: string;
  executionType: ExecutionType;
  executionTime: number;
  success: boolean;
  finalPrice?: number;
  profit?: number;
  errorMessage?: string;
  retryCount?: number;
}): Promise<Performance> {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error('User not authenticated');
  }

  return createPerformance({
    userId,
    positionId: params.positionId,
    executionType: params.executionType,
    executionTime: params.executionTime,
    success: params.success,
    finalPrice: params.finalPrice,
    profit: params.profit,
    errorMessage: params.errorMessage,
    retryCount: params.retryCount,
    timestamp: new Date().toISOString()
  });
}

/**
 * Performance Service クラス
 */
export class PerformanceService {
  /**
   * パフォーマンス記録作成
   */
  static async create(input: CreatePerformanceInput): Promise<Performance> {
    return createPerformance(input);
  }

  /**
   * パフォーマンス記録一覧取得
   */
  static async list(filter: PerformanceFilter): Promise<Performance[]> {
    return listPerformanceRecords(filter);
  }

  /**
   * パフォーマンスメトリクス取得
   */
  static async getMetrics(
    userId: string,
    timeRange: 'hour' | 'day' | 'week' = 'day'
  ): Promise<PerformanceMetrics> {
    return getPerformanceMetrics(userId, timeRange);
  }

  /**
   * 実行結果記録
   */
  static async recordResult(params: {
    positionId: string;
    executionType: ExecutionType;
    executionTime: number;
    success: boolean;
    finalPrice?: number;
    profit?: number;
    errorMessage?: string;
    retryCount?: number;
  }): Promise<Performance> {
    return recordExecutionResult(params);
  }
}

// Service Instance
export const performanceService = new PerformanceService();