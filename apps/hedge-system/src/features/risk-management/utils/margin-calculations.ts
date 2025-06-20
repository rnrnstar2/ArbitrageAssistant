/**
 * Margin Calculation Utilities
 * 証拠金計算ユーティリティ
 */

import type { AccountMarginInfo, RiskMonitoringState } from '../types/risk-types'

/**
 * リスクレベルを計算
 */
export function calculateRiskLevel(marginLevel: number): RiskMonitoringState['riskLevel'] {
  if (marginLevel >= 200) return 'safe'
  if (marginLevel >= 150) return 'warning' 
  if (marginLevel >= 100) return 'danger'
  return 'critical'
}

/**
 * 証拠金維持率を計算
 */
export function calculateMarginLevel(equity: number, usedMargin: number): number {
  if (usedMargin === 0) return Infinity
  return (equity / usedMargin) * 100
}

/**
 * 自由証拠金を計算
 */
export function calculateFreeMargin(equity: number, usedMargin: number): number {
  return Math.max(0, equity - usedMargin)
}

/**
 * ロスカットまでの時間を予測（分）
 */
export function predictTimeToCritical(
  currentMarginLevel: number,
  marginLevelTrend: number[], // 直近の証拠金維持率の履歴
  criticalLevel: number = 50
): number | undefined {
  if (currentMarginLevel <= criticalLevel) return 0
  if (marginLevelTrend.length < 2) return undefined

  // 線形回帰で傾きを計算
  const slope = calculateTrend(marginLevelTrend)
  
  // 傾きが正（改善している）または0の場合、予測不可
  if (slope >= 0) return undefined

  // 現在の証拠金維持率からクリティカルレベルまでの時間を予測
  const remainingMargin = currentMarginLevel - criticalLevel
  const minutesToCritical = remainingMargin / Math.abs(slope)

  return Math.max(0, minutesToCritical)
}

/**
 * 回復に必要な資金を計算
 */
export function calculateRequiredRecovery(
  currentEquity: number,
  usedMargin: number,
  targetMarginLevel: number = 150
): number {
  const requiredEquity = (usedMargin * targetMarginLevel) / 100
  return Math.max(0, requiredEquity - currentEquity)
}

/**
 * 口座のマージン情報を正規化
 */
export function normalizeMarginInfo(rawData: any): AccountMarginInfo {
  return {
    accountId: rawData.accountId || rawData.id,
    balance: parseFloat(rawData.balance) || 0,
    equity: parseFloat(rawData.equity) || 0,
    freeMargin: parseFloat(rawData.freeMargin) || 0,
    usedMargin: parseFloat(rawData.usedMargin) || 0,
    marginLevel: parseFloat(rawData.marginLevel) || 0,
    bonusAmount: parseFloat(rawData.bonusAmount) || 0,
    lastUpdate: new Date(rawData.lastUpdate || Date.now())
  }
}

/**
 * リスク監視状態を作成
 */
export function createRiskMonitoringState(
  marginInfo: AccountMarginInfo,
  lossCutLevel: number = 30
): RiskMonitoringState {
  const riskLevel = calculateRiskLevel(marginInfo.marginLevel)
  const requiredRecovery = calculateRequiredRecovery(
    marginInfo.equity,
    marginInfo.usedMargin
  )

  return {
    accountId: marginInfo.accountId,
    marginLevel: marginInfo.marginLevel,
    freeMargin: marginInfo.freeMargin,
    usedMargin: marginInfo.usedMargin,
    balance: marginInfo.balance,
    equity: marginInfo.equity,
    bonusAmount: marginInfo.bonusAmount,
    riskLevel,
    lastUpdate: marginInfo.lastUpdate,
    lossCutLevel,
    predictions: {
      requiredRecovery
    }
  }
}

/**
 * データが有効かチェック
 */
export function validateMarginData(data: Partial<AccountMarginInfo>): boolean {
  return !!(
    data.accountId &&
    typeof data.balance === 'number' &&
    typeof data.equity === 'number' &&
    typeof data.marginLevel === 'number' &&
    data.equity >= 0 &&
    data.marginLevel >= 0
  )
}

/**
 * 傾向を計算（線形回帰の傾き）
 */
function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0

  const n = values.length
  const sumX = (n * (n - 1)) / 2 // 0 + 1 + 2 + ... + (n-1)
  const sumY = values.reduce((sum, val) => sum + val, 0)
  const sumXY = values.reduce((sum, val, index) => sum + index * val, 0)
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6 // 0² + 1² + 2² + ... + (n-1)²

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return 0

  return (n * sumXY - sumX * sumY) / denominator
}

/**
 * ボーナスを考慮した実効証拠金を計算
 */
export function calculateEffectiveEquity(
  equity: number,
  bonusAmount: number
): number {
  // ボーナスは通常、証拠金計算には含まれるが、出金はできない
  return equity + bonusAmount
}

/**
 * マージンコールのしきい値を計算
 */
export function getMarginCallThreshold(
  broker: string
): { marginCall: number; losscut: number } {
  // ブローカーごとのデフォルト値（実際の値は設定から取得）
  const defaults = {
    marginCall: 100, // 100%でマージンコール
    losscut: 50 // 50%でロスカット
  }

  // ブローカー固有の設定があれば適用
  const brokerSettings: Record<string, typeof defaults> = {
    'XM': { marginCall: 50, losscut: 20 },
    'AXIORY': { marginCall: 100, losscut: 20 },
    'TitanFX': { marginCall: 90, losscut: 20 }
  }

  return brokerSettings[broker] || defaults
}