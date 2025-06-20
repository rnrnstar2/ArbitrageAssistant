/**
 * リカバリー計算エンジン
 * 証拠金維持率回復のための最適解を計算
 */

import { MarginLevelHistory, RecoveryScenario } from '../types/prediction-types'

export interface AccountState {
  accountId: string
  broker: string
  equity: number
  freeMargin: number
  usedMargin: number
  marginLevel: number
  bonusAmount: number
  positions: PositionInfo[]
}

export interface PositionInfo {
  id: string
  symbol: string
  type: 'buy' | 'sell'
  lots: number
  openPrice: number
  currentPrice: number
  profit: number
  margin: number
}

export interface CrossAccountInfo {
  accounts: AccountState[]
  totalEquity: number
  totalFreeMargin: number
  riskDistribution: { [accountId: string]: number }
}

export interface OptimizationResult {
  scenarios: RecoveryScenario[]
  optimalScenario: RecoveryScenario
  timeToExecute: number
  successProbability: number
  riskReduction: number
}

export class RecoveryCalculator {
  /**
   * 基本リカバリー額を計算
   */
  static calculateBasicRecovery(
    currentMarginLevel: number,
    usedMargin: number,
    targetMarginLevel: number = 200
  ): number {
    if (currentMarginLevel >= targetMarginLevel) return 0

    // 目標証拠金維持率に必要な equity
    const requiredEquity = (usedMargin * targetMarginLevel) / 100
    const currentEquity = (usedMargin * currentMarginLevel) / 100
    
    return Math.max(0, requiredEquity - currentEquity)
  }

  /**
   * ポジション削減による回復計算
   */
  static calculatePositionReduction(
    account: AccountState,
    targetMarginLevel: number = 200
  ): RecoveryScenario[] {
    const scenarios: RecoveryScenario[] = []
    
    if (account.marginLevel >= targetMarginLevel) {
      return scenarios
    }

    // 損失ポジションを損失の大きい順にソート
    const lossPositions = account.positions
      .filter(p => p.profit < 0)
      .sort((a, b) => a.profit - b.profit)

    // 利益ポジションを利益の大きい順にソート  
    const profitPositions = account.positions
      .filter(p => p.profit > 0)
      .sort((a, b) => b.profit - a.profit)

    // 損失ポジション決済シナリオ
    if (lossPositions.length > 0) {
      const worstPosition = lossPositions[0]
      const marginReduction = worstPosition.margin
      const profitImpact = Math.abs(worstPosition.profit)
      
      const newUsedMargin = account.usedMargin - marginReduction
      const newEquity = account.equity - profitImpact
      const newMarginLevel = newUsedMargin > 0 ? (newEquity / newUsedMargin) * 100 : 999

      scenarios.push({
        type: 'position_reduction',
        description: `最大損失ポジション ${worstPosition.symbol} (${worstPosition.lots}lot) の決済`,
        requiredAmount: 0,
        impact: this.calculateImpactPercentage(account.marginLevel, newMarginLevel, targetMarginLevel),
        urgency: newMarginLevel >= targetMarginLevel ? 'medium' : 'high',
        feasibility: 0.95,
        instructions: [
          `${worstPosition.symbol} ${worstPosition.type.toUpperCase()} ${worstPosition.lots}lot を決済`,
          `予想損失: ${profitImpact.toFixed(2)}USD`,
          `予想証拠金維持率: ${newMarginLevel.toFixed(1)}%`,
          '決済後の状況を確認'
        ]
      })
    }

    // 利益ポジション決済シナリオ
    if (profitPositions.length > 0) {
      const bestPosition = profitPositions[0]
      const marginReduction = bestPosition.margin
      const profitGain = bestPosition.profit
      
      const newUsedMargin = account.usedMargin - marginReduction
      const newEquity = account.equity + profitGain
      const newMarginLevel = newUsedMargin > 0 ? (newEquity / newUsedMargin) * 100 : 999

      scenarios.push({
        type: 'profit_taking',
        description: `最大利益ポジション ${bestPosition.symbol} (${bestPosition.lots}lot) の利確`,
        requiredAmount: 0,
        impact: this.calculateImpactPercentage(account.marginLevel, newMarginLevel, targetMarginLevel),
        urgency: 'low',
        feasibility: 0.9,
        instructions: [
          `${bestPosition.symbol} ${bestPosition.type.toUpperCase()} ${bestPosition.lots}lot を利確`,
          `利益確定: ${profitGain.toFixed(2)}USD`,
          `予想証拠金維持率: ${newMarginLevel.toFixed(1)}%`,
          '利確後の新規エントリー検討'
        ]
      })
    }

    // 部分決済シナリオ
    if (lossPositions.length > 0) {
      const position = lossPositions[0]
      const partialLots = Math.max(0.01, position.lots * 0.5)
      const partialMarginReduction = position.margin * 0.5
      const partialProfitImpact = Math.abs(position.profit) * 0.5
      
      const newUsedMargin = account.usedMargin - partialMarginReduction
      const newEquity = account.equity - partialProfitImpact
      const newMarginLevel = newUsedMargin > 0 ? (newEquity / newUsedMargin) * 100 : 999

      scenarios.push({
        type: 'position_reduction',
        description: `${position.symbol} ポジションの50%部分決済`,
        requiredAmount: 0,
        impact: this.calculateImpactPercentage(account.marginLevel, newMarginLevel, targetMarginLevel),
        urgency: 'medium',
        feasibility: 0.9,
        instructions: [
          `${position.symbol} ${position.type.toUpperCase()} ${partialLots.toFixed(2)}lot を部分決済`,
          `予想損失: ${partialProfitImpact.toFixed(2)}USD`,
          `残ポジション: ${(position.lots - partialLots).toFixed(2)}lot`,
          `予想証拠金維持率: ${newMarginLevel.toFixed(1)}%`
        ]
      })
    }

    return scenarios
  }

  /**
   * クロスアカウントリバランス計算
   */
  static calculateCrossAccountRebalance(
    riskAccount: AccountState,
    crossAccountInfo: CrossAccountInfo,
    targetMarginLevel: number = 200
  ): RecoveryScenario[] {
    const scenarios: RecoveryScenario[] = []
    
    const requiredAmount = this.calculateBasicRecovery(
      riskAccount.marginLevel,
      riskAccount.usedMargin,
      targetMarginLevel
    )

    if (requiredAmount <= 0) return scenarios

    // 他口座の余裕資金を確認
    const donorAccounts = crossAccountInfo.accounts
      .filter(acc => acc.accountId !== riskAccount.accountId)
      .filter(acc => acc.freeMargin > requiredAmount * 1.2) // 20%のバッファ
      .sort((a, b) => b.freeMargin - a.freeMargin)

    if (donorAccounts.length > 0) {
      const bestDonor = donorAccounts[0]
      
      scenarios.push({
        type: 'cross_account',
        description: `${bestDonor.broker} から ${riskAccount.broker} への資金移動`,
        requiredAmount,
        impact: 100,
        urgency: this.getUrgencyFromMarginLevel(riskAccount.marginLevel),
        feasibility: 0.7, // 資金移動には時間がかかる
        instructions: [
          `送金元: ${bestDonor.broker} (余裕資金: ${bestDonor.freeMargin.toFixed(0)}USD)`,
          `送金額: ${requiredAmount.toFixed(0)}USD`,
          `資金移動手続きを実行`,
          '移動完了まで他の対策も並行実施',
          '移動完了後の証拠金維持率確認'
        ]
      })
    }

    // 複数口座からの分散送金
    const availableAccounts = crossAccountInfo.accounts
      .filter(acc => acc.accountId !== riskAccount.accountId)
      .filter(acc => acc.freeMargin > 1000)
      .sort((a, b) => b.freeMargin - a.freeMargin)

    if (availableAccounts.length >= 2) {
      const totalAvailable = availableAccounts.reduce((sum, acc) => sum + acc.freeMargin * 0.8, 0)
      
      if (totalAvailable >= requiredAmount) {
        scenarios.push({
          type: 'cross_account',
          description: `複数口座からの分散資金移動`,
          requiredAmount,
          impact: 95,
          urgency: this.getUrgencyFromMarginLevel(riskAccount.marginLevel),
          feasibility: 0.6,
          instructions: [
            ...availableAccounts.slice(0, 3).map(acc => 
              `${acc.broker}: ${Math.min(acc.freeMargin * 0.8, requiredAmount / 2).toFixed(0)}USD`
            ),
            '複数の資金移動を並行実行',
            '移動状況をリアルタイム監視'
          ]
        })
      }
    }

    return scenarios
  }

  /**
   * 入金シナリオを計算
   */
  static calculateDepositScenarios(
    account: AccountState,
    targetMarginLevel: number = 200
  ): RecoveryScenario[] {
    const requiredAmount = this.calculateBasicRecovery(
      account.marginLevel,
      account.usedMargin,
      targetMarginLevel
    )

    if (requiredAmount <= 0) return []

    const scenarios: RecoveryScenario[] = []

    // 最小入金シナリオ
    scenarios.push({
      type: 'deposit',
      description: '最小必要額の追加入金',
      requiredAmount,
      impact: 100,
      urgency: this.getUrgencyFromMarginLevel(account.marginLevel),
      feasibility: 0.8,
      instructions: [
        `必要入金額: ${requiredAmount.toFixed(0)}USD`,
        '入金手続きを即座に実行',
        '入金反映まで他の対策も実施',
        '入金確認後の証拠金維持率確認'
      ]
    })

    // 余裕を持った入金シナリオ
    const bufferAmount = requiredAmount * 1.5
    scenarios.push({
      type: 'deposit',
      description: 'バッファを含む追加入金',
      requiredAmount: bufferAmount,
      impact: 120,
      urgency: 'medium',
      feasibility: 0.7,
      instructions: [
        `推奨入金額: ${bufferAmount.toFixed(0)}USD (バッファ含む)`,
        '将来的なリスクも考慮した安全な金額',
        '入金後の追加取引可能',
        '証拠金維持率300%以上を目標'
      ]
    })

    return scenarios
  }

  /**
   * 最適化されたリカバリープランを計算
   */
  static calculateOptimizedRecovery(
    account: AccountState,
    crossAccountInfo: CrossAccountInfo,
    targetMarginLevel: number = 200
  ): OptimizationResult {
    const allScenarios: RecoveryScenario[] = []

    // 各種シナリオを収集
    allScenarios.push(...this.calculatePositionReduction(account, targetMarginLevel))
    allScenarios.push(...this.calculateCrossAccountRebalance(account, crossAccountInfo, targetMarginLevel))
    allScenarios.push(...this.calculateDepositScenarios(account, targetMarginLevel))

    // スコアリングによる最適シナリオ選択
    const scoredScenarios = allScenarios.map(scenario => ({
      ...scenario,
      score: this.calculateScenarioScore(scenario, account.marginLevel)
    }))

    scoredScenarios.sort((a, b) => b.score - a.score)

    const optimalScenario = scoredScenarios[0] || {
      type: 'deposit' as const,
      description: 'デフォルト入金プラン',
      requiredAmount: this.calculateBasicRecovery(account.marginLevel, account.usedMargin, targetMarginLevel),
      impact: 100,
      urgency: 'high' as const,
      feasibility: 0.8,
      instructions: ['追加入金を実行してください'],
      score: 0
    }

    return {
      scenarios: allScenarios,
      optimalScenario,
      timeToExecute: this.estimateExecutionTime(optimalScenario),
      successProbability: optimalScenario.feasibility,
      riskReduction: optimalScenario.impact
    }
  }

  // ユーティリティ関数

  private static calculateImpactPercentage(
    currentLevel: number,
    newLevel: number,
    targetLevel: number
  ): number {
    if (currentLevel >= targetLevel) return 0
    
    const improvement = newLevel - currentLevel
    const required = targetLevel - currentLevel
    
    return Math.min(100, (improvement / required) * 100)
  }

  private static getUrgencyFromMarginLevel(marginLevel: number): RecoveryScenario['urgency'] {
    if (marginLevel < 50) return 'critical'
    if (marginLevel < 100) return 'high'
    if (marginLevel < 150) return 'medium'
    return 'low'
  }

  private static calculateScenarioScore(scenario: RecoveryScenario, currentMarginLevel: number): number {
    // 実行可能性 * 効果 * 緊急度適合性
    const urgencyScore = this.getUrgencyScore(scenario.urgency, currentMarginLevel)
    const timeScore = scenario.type === 'position_reduction' ? 1.0 : 
                     scenario.type === 'profit_taking' ? 0.9 : 0.7

    return scenario.feasibility * (scenario.impact / 100) * urgencyScore * timeScore
  }

  private static getUrgencyScore(urgency: RecoveryScenario['urgency'], marginLevel: number): number {
    const baseScore = {
      'critical': 1.0,
      'high': 0.8,
      'medium': 0.6,
      'low': 0.4
    }[urgency]

    // 証拠金維持率に応じて調整
    if (marginLevel < 50 && urgency === 'critical') return 1.0
    if (marginLevel < 100 && urgency === 'high') return 0.9
    
    return baseScore
  }

  private static estimateExecutionTime(scenario: RecoveryScenario): number {
    // 分単位での実行時間見積もり
    switch (scenario.type) {
      case 'position_reduction':
      case 'profit_taking':
        return 2 // 2分
      case 'cross_account':
        return 30 // 30分
      case 'deposit':
        return 60 // 60分
      default:
        return 15
    }
  }
}