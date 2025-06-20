/**
 * Emergency Response Strategies
 * 緊急対応戦略の定義と管理
 */

import { EmergencyStrategy, EmergencyAction } from './EmergencyActionManager'

export interface StrategyTemplate {
  id: string
  name: string
  description: string
  applicableScenarios: string[]
  strategy: EmergencyStrategy
}

export interface DynamicActionParameters {
  accountBalance: number
  marginLevel: number
  positionCount: number
  totalProfitLoss: number
  usedMargin: number
  freeMargin: number
}

export class EmergencyStrategies {
  
  /**
   * 単一口座危険レベル戦略
   */
  static getSingleAccountCriticalStrategy(): EmergencyStrategy {
    return {
      scenarioType: 'single_account',
      maxExecutionTime: 30000, // 30秒
      successCriteria: {
        marginLevelTarget: 100,
        maxAcceptableLoss: 1000,
        timeoutMinutes: 0.5
      },
      actions: [
        {
          type: 'immediate_close',
          priority: 10,
          targetPositions: [], // 動的に設定
          parameters: {
            percentage: 100,
            maxLoss: 500
          }
        },
        {
          type: 'partial_close',
          priority: 8,
          targetPositions: [],
          parameters: {
            percentage: 75,
            maxLoss: 300
          }
        },
        {
          type: 'hedge_open',
          priority: 6,
          targetPositions: [],
          parameters: {
            hedgeRatio: 1.0,
            maxLoss: 200
          }
        }
      ]
    }
  }

  /**
   * 複数口座相関戦略
   */
  static getMultiAccountStrategy(): EmergencyStrategy {
    return {
      scenarioType: 'multi_account',
      maxExecutionTime: 60000, // 60秒
      successCriteria: {
        marginLevelTarget: 150,
        maxAcceptableLoss: 2000,
        timeoutMinutes: 1
      },
      actions: [
        {
          type: 'balance_transfer',
          priority: 10,
          targetPositions: [],
          parameters: {
            amount: 1000,
            maxLoss: 0
          }
        },
        {
          type: 'hedge_open',
          priority: 9,
          targetPositions: [],
          parameters: {
            hedgeRatio: 0.8,
            maxLoss: 500
          }
        },
        {
          type: 'partial_close',
          priority: 7,
          targetPositions: [],
          parameters: {
            percentage: 50,
            maxLoss: 800
          }
        }
      ]
    }
  }

  /**
   * 相関ポジション戦略
   */
  static getCorrelatedPositionsStrategy(): EmergencyStrategy {
    return {
      scenarioType: 'correlated_positions',
      maxExecutionTime: 45000, // 45秒
      successCriteria: {
        marginLevelTarget: 120,
        maxAcceptableLoss: 1500,
        timeoutMinutes: 0.75
      },
      actions: [
        {
          type: 'hedge_open',
          priority: 10,
          targetPositions: [],
          parameters: {
            hedgeRatio: 0.6,
            maxLoss: 400
          }
        },
        {
          type: 'partial_close',
          priority: 8,
          targetPositions: [],
          parameters: {
            percentage: 40,
            maxLoss: 600
          }
        },
        {
          type: 'immediate_close',
          priority: 6,
          targetPositions: [],
          parameters: {
            percentage: 100,
            maxLoss: 800
          }
        }
      ]
    }
  }

  /**
   * 予防的戦略
   */
  static getPreventiveStrategy(): EmergencyStrategy {
    return {
      scenarioType: 'single_account',
      maxExecutionTime: 90000, // 90秒
      successCriteria: {
        marginLevelTarget: 200,
        maxAcceptableLoss: 500,
        timeoutMinutes: 1.5
      },
      actions: [
        {
          type: 'hedge_open',
          priority: 9,
          targetPositions: [],
          parameters: {
            hedgeRatio: 0.3,
            maxLoss: 150
          }
        },
        {
          type: 'partial_close',
          priority: 7,
          targetPositions: [],
          parameters: {
            percentage: 20,
            maxLoss: 200
          }
        },
        {
          type: 'balance_transfer',
          priority: 5,
          targetPositions: [],
          parameters: {
            amount: 500,
            maxLoss: 0
          }
        }
      ]
    }
  }

  /**
   * 高頻度取引戦略
   */
  static getHighFrequencyStrategy(): EmergencyStrategy {
    return {
      scenarioType: 'single_account',
      maxExecutionTime: 15000, // 15秒
      successCriteria: {
        marginLevelTarget: 80,
        maxAcceptableLoss: 300,
        timeoutMinutes: 0.25
      },
      actions: [
        {
          type: 'immediate_close',
          priority: 10,
          targetPositions: [],
          parameters: {
            percentage: 100,
            maxLoss: 200
          }
        },
        {
          type: 'hedge_open',
          priority: 8,
          targetPositions: [],
          parameters: {
            hedgeRatio: 0.5,
            maxLoss: 100
          }
        }
      ]
    }
  }

  /**
   * 動的戦略生成
   */
  static generateDynamicStrategy(
    params: DynamicActionParameters,
    scenarioType: EmergencyStrategy['scenarioType'] = 'single_account'
  ): EmergencyStrategy {
    const riskScore = this.calculateRiskScore(params)
    
    let actions: EmergencyAction[] = []
    let maxExecutionTime = 30000
    let marginTarget = 100

    if (riskScore >= 9) {
      // 極めて危険 - 即座対応
      actions = [
        {
          type: 'immediate_close',
          priority: 10,
          targetPositions: [],
          parameters: {
            percentage: 100,
            maxLoss: params.accountBalance * 0.1
          }
        }
      ]
      maxExecutionTime = 15000
      marginTarget = 80
    } else if (riskScore >= 7) {
      // 高リスク - 段階的対応
      actions = [
        {
          type: 'partial_close',
          priority: 9,
          targetPositions: [],
          parameters: {
            percentage: 80,
            maxLoss: params.accountBalance * 0.08
          }
        },
        {
          type: 'hedge_open',
          priority: 7,
          targetPositions: [],
          parameters: {
            hedgeRatio: 0.7,
            maxLoss: params.accountBalance * 0.05
          }
        }
      ]
      maxExecutionTime = 25000
      marginTarget = 100
    } else if (riskScore >= 5) {
      // 中リスク - 保守的対応
      actions = [
        {
          type: 'hedge_open',
          priority: 8,
          targetPositions: [],
          parameters: {
            hedgeRatio: 0.5,
            maxLoss: params.accountBalance * 0.03
          }
        },
        {
          type: 'partial_close',
          priority: 6,
          targetPositions: [],
          parameters: {
            percentage: 40,
            maxLoss: params.accountBalance * 0.04
          }
        }
      ]
      maxExecutionTime = 45000
      marginTarget = 150
    } else {
      // 低リスク - 予防的対応
      actions = [
        {
          type: 'hedge_open',
          priority: 7,
          targetPositions: [],
          parameters: {
            hedgeRatio: 0.3,
            maxLoss: params.accountBalance * 0.02
          }
        }
      ]
      maxExecutionTime = 60000
      marginTarget = 200
    }

    // 資金移動が可能な場合は追加
    if (scenarioType === 'multi_account' && params.freeMargin < params.usedMargin * 0.2) {
      actions.push({
        type: 'balance_transfer',
        priority: 5,
        targetPositions: [],
        parameters: {
          amount: params.usedMargin * 0.3,
          maxLoss: 0
        }
      })
    }

    return {
      scenarioType,
      maxExecutionTime,
      successCriteria: {
        marginLevelTarget: marginTarget,
        maxAcceptableLoss: params.accountBalance * 0.1,
        timeoutMinutes: maxExecutionTime / 60000
      },
      actions: actions.sort((a, b) => b.priority - a.priority)
    }
  }

  /**
   * リスクスコア計算
   */
  private static calculateRiskScore(params: DynamicActionParameters): number {
    let score = 0

    // 証拠金維持率によるスコア
    if (params.marginLevel < 50) score += 4
    else if (params.marginLevel < 100) score += 3
    else if (params.marginLevel < 150) score += 2
    else if (params.marginLevel < 200) score += 1

    // 損益によるスコア
    const lossRatio = Math.abs(params.totalProfitLoss) / params.accountBalance
    if (lossRatio > 0.1) score += 3
    else if (lossRatio > 0.05) score += 2
    else if (lossRatio > 0.02) score += 1

    // ポジション数によるスコア
    if (params.positionCount > 20) score += 2
    else if (params.positionCount > 10) score += 1

    // 余剰証拠金によるスコア
    const freeMarginRatio = params.freeMargin / params.usedMargin
    if (freeMarginRatio < 0.1) score += 2
    else if (freeMarginRatio < 0.2) score += 1

    return Math.min(score, 10) // 最大10点
  }

  /**
   * 全戦略テンプレート取得
   */
  static getAllStrategyTemplates(): StrategyTemplate[] {
    return [
      {
        id: 'single_critical',
        name: '単一口座危険レベル',
        description: '単一口座でロスカット直前の緊急対応',
        applicableScenarios: ['single_account', 'critical'],
        strategy: this.getSingleAccountCriticalStrategy()
      },
      {
        id: 'multi_account',
        name: '複数口座相関',
        description: '複数口座間での相関リスク対応',
        applicableScenarios: ['multi_account'],
        strategy: this.getMultiAccountStrategy()
      },
      {
        id: 'correlated_positions',
        name: '相関ポジション',
        description: '相関性の高いポジション群の緊急対応',
        applicableScenarios: ['correlated_positions'],
        strategy: this.getCorrelatedPositionsStrategy()
      },
      {
        id: 'preventive',
        name: '予防的対応',
        description: '証拠金維持率低下時の予防的措置',
        applicableScenarios: ['single_account', 'warning'],
        strategy: this.getPreventiveStrategy()
      },
      {
        id: 'high_frequency',
        name: '高頻度取引',
        description: '高頻度取引での超高速対応',
        applicableScenarios: ['single_account', 'speed_critical'],
        strategy: this.getHighFrequencyStrategy()
      }
    ]
  }

  /**
   * シナリオに基づく戦略選択
   */
  static selectStrategy(
    scenarioType: EmergencyStrategy['scenarioType'],
    riskLevel: 'safe' | 'warning' | 'danger' | 'critical',
    params?: DynamicActionParameters
  ): EmergencyStrategy {
    // 動的戦略生成を優先
    if (params) {
      return this.generateDynamicStrategy(params, scenarioType)
    }

    // 静的戦略選択
    switch (scenarioType) {
      case 'multi_account':
        return this.getMultiAccountStrategy()
      case 'correlated_positions':
        return this.getCorrelatedPositionsStrategy()
      case 'single_account':
      default:
        if (riskLevel === 'critical') {
          return this.getSingleAccountCriticalStrategy()
        } else if (riskLevel === 'warning' || riskLevel === 'danger') {
          return this.getPreventiveStrategy()
        } else {
          return this.getPreventiveStrategy()
        }
    }
  }
}