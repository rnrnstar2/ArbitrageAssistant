/**
 * Loss Minimization Engine
 * 損失最小化エンジン - 緊急時の最適化された損失削減ロジック
 */

import { RiskMonitoringState } from '../types/risk-types'

export interface Position {
  id: string
  symbol: string
  type: 'buy' | 'sell'
  lots: number
  openPrice: number
  currentPrice: number
  profit: number
  swapProfit: number
  commission: number
  marginRequired: number
}

export interface MinimizationResult {
  positionsToClose: string[]
  positionsToReduce: Array<{ id: string; reductionPercentage: number }>
  hedgePositions: Array<{ symbol: string; type: 'buy' | 'sell'; lots: number }>
  expectedLossReduction: number
  expectedMarginImprovement: number
  confidence: number
}

export interface LossMinimizationConfig {
  maxLossPercentage: number
  preferPartialClose: boolean
  enableHedging: boolean
  hedgeRatio: number
  prioritizeMarginEfficiency: boolean
  considerSwapCosts: boolean
}

export class LossMinimizer {
  private config: LossMinimizationConfig

  constructor(config: LossMinimizationConfig) {
    this.config = config
  }

  /**
   * 損失最小化の最適解を計算
   */
  calculateOptimalMinimization(
    positions: Position[],
    riskState: RiskMonitoringState,
    targetMarginLevel: number = 150
  ): MinimizationResult {
    console.log('[LossMinimizer] Calculating optimal loss minimization strategy')

    // ポジション分析
    const analysis = this.analyzePositions(positions)
    
    // 最適化アルゴリズム実行
    const result = this.executeOptimization(positions, analysis, riskState, targetMarginLevel)
    
    console.log(`[LossMinimizer] Optimization completed: ${result.expectedLossReduction} loss reduction expected`)
    
    return result
  }

  /**
   * ポジション分析
   */
  private analyzePositions(positions: Position[]) {
    const profitable = positions.filter(p => p.profit > 0)
    const losing = positions.filter(p => p.profit < 0)
    
    const totalProfit = profitable.reduce((sum, p) => sum + p.profit, 0)
    const totalLoss = losing.reduce((sum, p) => sum + p.profit, 0)
    const totalMargin = positions.reduce((sum, p) => sum + p.marginRequired, 0)

    // 効率性指標計算
    const marginEfficiency = positions.map(p => ({
      id: p.id,
      profitPerMargin: p.profit / p.marginRequired,
      lossImpact: p.profit < 0 ? Math.abs(p.profit) / totalMargin : 0,
      hedgeValue: this.calculateHedgeValue(p)
    }))

    return {
      profitable,
      losing,
      totalProfit,
      totalLoss,
      totalMargin,
      marginEfficiency,
      netProfitLoss: totalProfit + totalLoss,
      profitLossRatio: totalProfit / Math.abs(totalLoss)
    }
  }

  /**
   * 最適化実行
   */
  private executeOptimization(
    positions: Position[],
    analysis: any,
    riskState: RiskMonitoringState,
    targetMarginLevel: number
  ): MinimizationResult {
    const requiredMarginReduction = this.calculateRequiredMarginReduction(riskState, targetMarginLevel)
    
    let positionsToClose: string[] = []
    let positionsToReduce: Array<{ id: string; reductionPercentage: number }> = []
    let hedgePositions: Array<{ symbol: string; type: 'buy' | 'sell'; lots: number }> = []
    
    // 戦略1: 最大損失ポジションの即座決済
    if (requiredMarginReduction > riskState.usedMargin * 0.3) {
      const worstPositions = this.selectWorstPositions(positions, analysis, 0.4)
      positionsToClose = worstPositions.map(p => p.id)
    }
    
    // 戦略2: 段階的縮小 + ヘッジ
    else if (this.config.preferPartialClose) {
      const reductionPlan = this.calculatePartialReduction(positions, analysis, requiredMarginReduction)
      positionsToReduce = reductionPlan.reductions
      
      if (this.config.enableHedging) {
        hedgePositions = this.calculateOptimalHedges(positions, analysis)
      }
    }
    
    // 戦略3: 利益確定 + 損失ポジション整理
    else {
      const profitableToClose = this.selectProfitableForClose(analysis.profitable)
      const losingToClose = this.selectLosingForClose(analysis.losing, requiredMarginReduction)
      
      positionsToClose = [...profitableToClose, ...losingToClose].map(p => p.id)
    }

    // 結果計算
    const expectedLossReduction = this.calculateExpectedLossReduction(
      positions, positionsToClose, positionsToReduce, hedgePositions
    )
    
    const expectedMarginImprovement = this.calculateMarginImprovement(
      positions, positionsToClose, positionsToReduce
    )

    const confidence = this.calculateConfidence(positions, analysis, requiredMarginReduction)

    return {
      positionsToClose,
      positionsToReduce,
      hedgePositions,
      expectedLossReduction,
      expectedMarginImprovement,
      confidence
    }
  }

  /**
   * 必要証拠金削減量計算
   */
  private calculateRequiredMarginReduction(
    riskState: RiskMonitoringState,
    targetMarginLevel: number
  ): number {
    const currentMarginLevel = riskState.marginLevel
    const equity = riskState.equity
    const usedMargin = riskState.usedMargin

    if (currentMarginLevel >= targetMarginLevel) {
      return 0
    }

    // target = equity / required_margin * 100
    // required_margin = equity / target * 100
    const requiredMargin = equity / (targetMarginLevel / 100)
    const marginReduction = usedMargin - requiredMargin

    return Math.max(0, marginReduction)
  }

  /**
   * 最悪ポジション選択
   */
  private selectWorstPositions(
    positions: Position[],
    analysis: any,
    percentage: number
  ): Position[] {
    const sortedByWorst = positions
      .filter(p => p.profit < 0)
      .sort((a, b) => a.profit - b.profit) // 最も損失の大きいものから

    const countToSelect = Math.max(1, Math.floor(sortedByWorst.length * percentage))
    return sortedByWorst.slice(0, countToSelect)
  }

  /**
   * 部分縮小計算
   */
  private calculatePartialReduction(
    positions: Position[],
    analysis: any,
    requiredReduction: number
  ): { reductions: Array<{ id: string; reductionPercentage: number }> } {
    const reductions: Array<{ id: string; reductionPercentage: number }> = []
    
    // マージン効率の悪いポジションから縮小
    const inefficientPositions = analysis.marginEfficiency
      .filter((e: any) => e.profitPerMargin < 0)
      .sort((a: any, b: any) => a.profitPerMargin - b.profitPerMargin)

    let remainingReduction = requiredReduction
    
    for (const efficiency of inefficientPositions) {
      if (remainingReduction <= 0) break
      
      const position = positions.find(p => p.id === efficiency.id)
      if (!position) continue

      // 縮小率決定（最大75%）
      const maxReduction = position.marginRequired * 0.75
      const reductionAmount = Math.min(remainingReduction, maxReduction)
      const reductionPercentage = (reductionAmount / position.marginRequired) * 100

      if (reductionPercentage >= 10) { // 10%未満の縮小は効果が薄い
        reductions.push({
          id: position.id,
          reductionPercentage: Math.round(reductionPercentage)
        })
        
        remainingReduction -= reductionAmount
      }
    }

    return { reductions }
  }

  /**
   * 最適ヘッジ計算
   */
  private calculateOptimalHedges(
    positions: Position[],
    analysis: any
  ): Array<{ symbol: string; type: 'buy' | 'sell'; lots: number }> {
    const hedges: Array<{ symbol: string; type: 'buy' | 'sell'; lots: number }> = []
    
    // シンボル別ネットポジション計算
    const netPositions = this.calculateNetPositionsBySymbol(positions)
    
    for (const [symbol, netPosition] of netPositions) {
      if (Math.abs(netPosition.lots) < 0.01) continue // 微小ポジションは無視
      
      const hedgeRatio = this.config.hedgeRatio
      const hedgeLots = Math.abs(netPosition.lots) * hedgeRatio
      
      if (hedgeLots >= 0.01) {
        hedges.push({
          symbol,
          type: netPosition.type === 'buy' ? 'sell' : 'buy',
          lots: parseFloat(hedgeLots.toFixed(2))
        })
      }
    }

    return hedges
  }

  /**
   * シンボル別ネットポジション計算
   */
  private calculateNetPositionsBySymbol(
    positions: Position[]
  ): Map<string, { type: 'buy' | 'sell'; lots: number }> {
    const netPositions = new Map<string, { type: 'buy' | 'sell'; lots: number }>()
    
    for (const position of positions) {
      const existing = netPositions.get(position.symbol) || { type: 'buy', lots: 0 }
      
      if (position.type === 'buy') {
        existing.lots += position.lots
      } else {
        existing.lots -= position.lots
      }
      
      existing.type = existing.lots >= 0 ? 'buy' : 'sell'
      existing.lots = Math.abs(existing.lots)
      
      netPositions.set(position.symbol, existing)
    }

    return netPositions
  }

  /**
   * 利益確定対象選択
   */
  private selectProfitableForClose(profitablePositions: Position[]): Position[] {
    // 利益率の高いものから選択（部分的な利益確定）
    return profitablePositions
      .filter(p => p.profit > p.marginRequired * 0.05) // 証拠金の5%以上の利益
      .sort((a, b) => (b.profit / b.marginRequired) - (a.profit / a.marginRequired))
      .slice(0, Math.max(1, Math.floor(profitablePositions.length * 0.3)))
  }

  /**
   * 損失決済対象選択
   */
  private selectLosingForClose(losingPositions: Position[], requiredReduction: number): Position[] {
    // 回復見込みの低いポジションを選択
    const candidates = losingPositions
      .filter(p => Math.abs(p.profit) > p.marginRequired * 0.1) // 大きな損失
      .sort((a, b) => a.profit - b.profit) // 損失の大きい順

    const selected: Position[] = []
    let marginReduction = 0

    for (const position of candidates) {
      if (marginReduction >= requiredReduction) break
      selected.push(position)
      marginReduction += position.marginRequired
    }

    return selected
  }

  /**
   * ヘッジ価値計算
   */
  private calculateHedgeValue(position: Position): number {
    // ボラティリティやトレンドを考慮したヘッジ価値
    // 簡易実装：損失ポジションほど高いヘッジ価値
    if (position.profit < 0) {
      return Math.abs(position.profit) / position.marginRequired
    }
    return 0
  }

  /**
   * 予想損失削減額計算
   */
  private calculateExpectedLossReduction(
    positions: Position[],
    toClose: string[],
    toReduce: Array<{ id: string; reductionPercentage: number }>,
    hedges: Array<{ symbol: string; type: 'buy' | 'sell'; lots: number }>
  ): number {
    let lossReduction = 0

    // 決済による損失削減
    for (const positionId of toClose) {
      const position = positions.find(p => p.id === positionId)
      if (position && position.profit < 0) {
        lossReduction += Math.abs(position.profit) * 0.9 // 90%の損失を回避
      }
    }

    // 縮小による損失削減
    for (const reduction of toReduce) {
      const position = positions.find(p => p.id === reduction.id)
      if (position && position.profit < 0) {
        lossReduction += Math.abs(position.profit) * (reduction.reductionPercentage / 100) * 0.8
      }
    }

    // ヘッジによる損失削減（期待値）
    lossReduction += hedges.length * 100 // ヘッジ1つあたり100の損失削減期待値

    return lossReduction
  }

  /**
   * 証拠金改善計算
   */
  private calculateMarginImprovement(
    positions: Position[],
    toClose: string[],
    toReduce: Array<{ id: string; reductionPercentage: number }>
  ): number {
    let marginImprovement = 0

    // 決済による証拠金解放
    for (const positionId of toClose) {
      const position = positions.find(p => p.id === positionId)
      if (position) {
        marginImprovement += position.marginRequired
      }
    }

    // 縮小による証拠金解放
    for (const reduction of toReduce) {
      const position = positions.find(p => p.id === reduction.id)
      if (position) {
        marginImprovement += position.marginRequired * (reduction.reductionPercentage / 100)
      }
    }

    return marginImprovement
  }

  /**
   * 信頼度計算
   */
  private calculateConfidence(
    positions: Position[],
    analysis: any,
    requiredReduction: number
  ): number {
    let confidence = 0.7 // ベース信頼度

    // ポジション数による調整
    if (positions.length < 5) confidence += 0.1
    else if (positions.length > 20) confidence -= 0.1

    // 損益バランスによる調整
    if (analysis.profitLossRatio > 1.5) confidence += 0.1
    else if (analysis.profitLossRatio < 0.5) confidence -= 0.1

    // 必要削減量による調整
    const reductionRatio = requiredReduction / analysis.totalMargin
    if (reductionRatio < 0.2) confidence += 0.1
    else if (reductionRatio > 0.6) confidence -= 0.2

    return Math.max(0.1, Math.min(0.95, confidence))
  }

  /**
   * 設定更新
   */
  updateConfig(newConfig: Partial<LossMinimizationConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 現在の設定取得
   */
  getConfig(): LossMinimizationConfig {
    return { ...this.config }
  }
}