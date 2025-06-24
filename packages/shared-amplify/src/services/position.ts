/**
 * Position Service - MVP システム設計書準拠のポジション管理
 * 
 * 設計原則（v7.0）：
 * - userIdベースの高速クエリ（GSI使用）
 * - 独立トレール実行機能
 * - 両建て管理対応
 * - 複数システム間連携
 */

import { amplifyClient, getCurrentUserId, handleGraphQLError, retryGraphQLOperation } from '../client';
import { handleServiceError, executeWithRetry } from '../utils/error-handler';
import { generateMockPositions, generateMockAccounts, generateMockUsers } from '../utils/mock-data';
import type {
  Position,
  PositionStatus,
  CreatePositionInput,
  UpdatePositionInput,
  PositionFilters,
  HedgeAnalysis,
  TrailExecutionResult,
  PaginatedResult
} from '../types';

export class PositionService {
  private mockDataCache: Position[] | null = null;
  private mockAccountIds: string[] = [];
  private mockUserIds: string[] = [];

  /**
   * データソース判定
   */
  private shouldUseMockData(): boolean {
    const isDevelopment = process.env.NODE_ENV === 'development';
    const mockEnabled = process.env.NEXT_PUBLIC_MOCK_DATA_ENABLED === 'true';
    const useRealData = process.env.NEXT_PUBLIC_USE_REAL_DATA === 'true';
    const dataSource = process.env.NEXT_PUBLIC_DATA_SOURCE;

    if (dataSource === 'mock') return true;
    if (dataSource === 'real') return false;
    if (dataSource === 'hybrid') {
      return isDevelopment && mockEnabled && !useRealData;
    }

    // デフォルト: 開発環境でモック有効の場合はモックデータを使用
    return isDevelopment && mockEnabled && !useRealData;
  }

  /**
   * モックデータ初期化
   */
  private initializeMockData(): void {
    if (this.mockDataCache) return;

    const users = generateMockUsers(2);
    const accounts = generateMockAccounts(users.map(u => u.id), 4);
    this.mockUserIds = users.map(u => u.id);
    this.mockAccountIds = accounts.map(a => a.id);
    
    this.mockDataCache = generateMockPositions(
      this.mockUserIds,
      this.mockAccountIds,
      25
    );

    console.log('📊 Mock data initialized:', {
      positions: this.mockDataCache.length,
      accounts: this.mockAccountIds.length,
      users: this.mockUserIds.length
    });
  }

  /**
   * モックデータからフィルタ適用データを取得
   */
  private getMockDataWithFilters(filters: PositionFilters = {}): Position[] {
    this.initializeMockData();
    
    if (!this.mockDataCache) return [];

    let filteredData = [...this.mockDataCache];

    // フィルター適用
    if (filters.status) {
      filteredData = filteredData.filter(p => p.status === filters.status);
    }
    if (filters.accountId) {
      filteredData = filteredData.filter(p => p.accountId === filters.accountId);
    }
    if (filters.symbol) {
      filteredData = filteredData.filter(p => p.symbol === filters.symbol);
    }
    if (filters.hasTrail) {
      filteredData = filteredData.filter(p => p.trailWidth && p.trailWidth > 0);
    }

    // ページング対応
    const limit = filters.limit || 100;
    return filteredData.slice(0, limit);
  }

  /**
   * ポジション作成（エラーハンドリング統一 + パフォーマンス最適化）
   * MVP設計書のエントリー実行パターン対応
   */
  async createPosition(input: Omit<CreatePositionInput, 'userId'>): Promise<Position> {
    try {
      const userId = await getCurrentUserId();
      
      const result = await executeWithRetry(async () => {
        return await amplifyClient.models.Position.create({
          ...input,
          userId,
          status: 'PENDING' // 初期状態は常にPENDING
        });
      }, 'Create position');
      
      if (!result.data) {
        throw new Error('Position creation failed');
      }
      
      console.log('✅ Position created:', result.data.id);
      return result.data as unknown as Position;
    } catch (error) {
      return handleServiceError(error, 'Create position');
    }
  }

  /**
   * ポジション更新（エラーハンドリング統一）
   */
  async updatePosition(id: string, updates: Partial<UpdatePositionInput>): Promise<Position> {
    try {
      const result = await executeWithRetry(async () => {
        return await amplifyClient.models.Position.update({
          id,
          ...updates
        });
      }, 'Update position');
      
      if (!result.data) {
        throw new Error('Position update failed');
      }
      
      console.log('✅ Position updated:', id);
      return result.data as unknown as Position;
    } catch (error) {
      return handleServiceError(error, 'Update position');
    }
  }

  /**
   * ポジション状態更新（設計書の実行フロー対応）
   */
  async updatePositionStatus(
    id: string, 
    status: typeof PositionStatus[keyof typeof PositionStatus],
    additionalData?: {
      mtTicket?: string;
      entryPrice?: number;
      entryTime?: string;
      exitPrice?: number;
      exitTime?: string;
      exitReason?: string;
    }
  ): Promise<Position> {
    return this.updatePosition(id, { status, ...additionalData });
  }

  /**
   * ユーザーのポジション一覧取得（userIdベース高速検索＋パフォーマンス最適化）
   * ハイブリッドデータ対応: 実データ -> モックデータのフォールバック
   */
  async listUserPositions(filters: PositionFilters = {}): Promise<Position[]> {
    // モックデータ使用判定
    if (this.shouldUseMockData()) {
      console.log('📊 Using mock data for positions');
      return this.getMockDataWithFilters(filters);
    }

    try {
      const userId = await getCurrentUserId();
      
      // userIdベース最適化クエリ
      const result = await executeWithRetry(async () => {
        const queryFilter: any = { 
          userId: { eq: userId },
          ...(filters.status && { status: { eq: filters.status } }),
          ...(filters.accountId && { accountId: { eq: filters.accountId } }),
          ...(filters.symbol && { symbol: { eq: filters.symbol } }),
          ...(filters.hasTrail && { trailWidth: { gt: 0 } })
        };
        
        return await amplifyClient.models.Position.list({
          filter: queryFilter,
          limit: filters.limit || 100,
          // 必要なフィールドのみ選択（パフォーマンス最適化）
          selectionSet: [
            'id', 'userId', 'accountId', 'status', 'symbol', 
            'volume', 'entryPrice', 'exitPrice', 'trailWidth', 
            'triggerActionIds', 'mtTicket', 'createdAt', 'updatedAt'
          ]
        });
      }, 'List user positions');
      
      const realData = (result.data as unknown as Position[]) || [];
      
      // 実データが空の場合、ハイブリッドモードならモックデータを返す
      if (realData.length === 0 && process.env.NEXT_PUBLIC_DATA_SOURCE === 'hybrid') {
        console.log('⚠️ No real data found, falling back to mock data');
        return this.getMockDataWithFilters(filters);
      }
      
      console.log('🟢 Using real data for positions:', realData.length);
      return realData;
    } catch (error) {
      console.error('❌ Real data fetch failed:', error);
      
      // エラー発生時、ハイブリッドモードならモックデータにフォールバック
      if (process.env.NEXT_PUBLIC_DATA_SOURCE === 'hybrid') {
        console.log('🔄 Falling back to mock data due to error');
        return this.getMockDataWithFilters(filters);
      }
      
      return handleServiceError(error, 'List user positions');
    }
  }

  /**
   * オープンポジション取得（両建て管理用）
   */
  async listOpenPositions(accountId?: string): Promise<Position[]> {
    return this.listUserPositions({ 
      status: 'OPEN',
      accountId 
    });
  }

  /**
   * トレール設定ありポジション取得（効率的監視用）
   */
  async listTrailPositions(): Promise<Position[]> {
    return this.listUserPositions({ hasTrail: true });
  }

  /**
   * ポジション実行開始（PENDING → OPENING）
   */
  async executePosition(id: string): Promise<Position> {
    console.log('🚀 Executing position:', id);
    return this.updatePositionStatus(id, 'OPENING');
  }

  /**
   * ポジション約定処理（OPENING → OPEN）
   */
  async confirmPositionEntry(id: string, mtTicket: string, entryPrice: number): Promise<Position> {
    console.log('✅ Position entry confirmed:', id);
    return this.updatePositionStatus(id, 'OPEN', {
      mtTicket,
      entryPrice,
      entryTime: new Date().toISOString()
    });
  }

  /**
   * ポジション決済開始（OPEN → CLOSING）
   */
  async closePosition(id: string, exitReason?: string): Promise<Position> {
    console.log('🔄 Closing position:', id);
    return this.updatePositionStatus(id, 'CLOSING', { exitReason });
  }

  /**
   * ポジション決済確定（CLOSING → CLOSED）
   */
  async confirmPositionExit(id: string, exitPrice: number): Promise<Position> {
    console.log('✅ Position exit confirmed:', id);
    return this.updatePositionStatus(id, 'CLOSED', {
      exitPrice,
      exitTime: new Date().toISOString()
    });
  }

  /**
   * 両建てポジション分析（ネットポジション算出 + パフォーマンス最適化）
   */
  async calculateNetPositions(accountId?: string): Promise<HedgeAnalysis> {
    try {
      // 並列実行でパフォーマンス向上
      const [openPositions, trailPositions] = await Promise.all([
        this.listOpenPositions(accountId),
        accountId ? this.listUserPositions({ hasTrail: true, accountId }) : this.listTrailPositions()
      ]);
      
      const netPositions: Record<string, number> = {};
      let totalVolume = 0;
      
      openPositions.forEach(position => {
        const symbol = position.symbol;
        if (!netPositions[symbol]) netPositions[symbol] = 0;
        
        // 買いポジションは正、売りポジションは負
        const volume = position.executionType === 'ENTRY' ? position.volume : -position.volume;
        netPositions[symbol] += volume;
        totalVolume += Math.abs(volume);
      });
      
      // リスクスコア計算（簡易版）
      const riskScore = Object.values(netPositions).reduce((acc, net) => acc + Math.abs(net), 0) / totalVolume || 0;
      
      return {
        accountId: accountId || 'all',
        netPositions,
        totalPositions: openPositions,
        openPositions,
        trailPositions,
        creditUtilization: 0, // Account Serviceで計算
        riskScore
      };
    } catch (error) {
      return handleServiceError(error, 'Calculate net positions');
    }
  }

  /**
   * トレール実行（設計書のトレール発動パターン対応）
   */
  async executeTrail(positionId: string): Promise<TrailExecutionResult> {
    try {
      console.log('⚡ Executing trail for position:', positionId);
      
      // 1. ポジション情報取得
      const position = await this.getPosition(positionId);
      if (!position) {
        throw new Error('Position not found');
      }
      
      // 2. トリガーアクションID取得
      const triggerActionIds = position.triggerActionIds 
        ? JSON.parse(position.triggerActionIds) 
        : [];
      
      if (triggerActionIds.length === 0) {
        console.warn('⚠️ No trigger actions configured for position:', positionId);
        return {
          positionId,
          triggeredActionIds: [],
          executionTime: new Date().toISOString(),
          success: true
        };
      }
      
      // 3. アクションサービスでトリガー実行
      const { ActionService } = await import('./action');
      const actionService = new ActionService();
      
      const triggeredActions = await actionService.triggerMultipleActions(triggerActionIds);
      
      console.log('✅ Trail executed successfully:', positionId);
      return {
        positionId,
        triggeredActionIds: triggeredActions.map(action => action.id),
        executionTime: new Date().toISOString(),
        success: true
      };
    } catch (error) {
      console.error('❌ Trail execution error:', error);
      return {
        positionId,
        triggeredActionIds: [],
        executionTime: new Date().toISOString(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * ポジション取得
   */
  async getPosition(id: string): Promise<Position | null> {
    try {
      const result = await amplifyClient.models.Position.get({ id });
      return (result.data as unknown as Position) || null;
    } catch (error) {
      console.error('❌ Get position error:', error);
      return null;
    }
  }

  /**
   * ポジション削除
   */
  async deletePosition(id: string): Promise<boolean> {
    try {
      await amplifyClient.models.Position.delete({ id });
      console.log('✅ Position deleted:', id);
      return true;
    } catch (error) {
      console.error('❌ Delete position error:', error);
      return false;
    }
  }
}

// シングルトンインスタンス
export const positionService = new PositionService();

// 便利関数エクスポート
export const createPosition = (input: Omit<CreatePositionInput, 'userId'>) => 
  positionService.createPosition(input);

export const updatePosition = (id: string, updates: Partial<UpdatePositionInput>) => 
  positionService.updatePosition(id, updates);

export const listUserPositions = (filters?: PositionFilters) => 
  positionService.listUserPositions(filters);

export const listOpenPositions = (accountId?: string) => 
  positionService.listOpenPositions(accountId);

export const listTrailPositions = () => 
  positionService.listTrailPositions();

export const executePosition = (id: string) => 
  positionService.executePosition(id);

export const closePosition = (id: string, exitReason?: string) => 
  positionService.closePosition(id, exitReason);

export const calculateNetPositions = (accountId?: string) => 
  positionService.calculateNetPositions(accountId);