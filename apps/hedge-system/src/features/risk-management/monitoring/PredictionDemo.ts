/**
 * ロスカット予測システムのデモ・テスト用ファイル
 */

import { LossCutPredictor } from './LossCutPredictor'
import { RecoveryCalculator, AccountState, CrossAccountInfo } from './RecoveryCalculator'
import { PredictionAlgorithms } from './PredictionAlgorithms'
import { MarginLevelHistory } from '../types/prediction-types'

export class PredictionDemo {
  private predictor: LossCutPredictor

  constructor() {
    this.predictor = new LossCutPredictor({
      minDataPoints: 3,
      updateIntervalMs: 10000, // デモ用に短縮
      confidenceThreshold: 0.6
    })
  }

  /**
   * サンプルデータを生成してテスト実行
   */
  async runDemo(): Promise<void> {
    console.log('🔍 ロスカット予測システム デモ開始')

    // サンプルアカウントデータ
    const accountId = 'demo-account-001'
    
    // 悪化傾向のデータを模擬
    const mockHistory = this.generateMockHistory()
    
    console.log('📊 模擬データを追加中...')
    for (const data of mockHistory) {
      this.predictor.addMarginData(accountId, data)
      await new Promise(resolve => setTimeout(resolve, 1000)) // 1秒間隔
    }

    // 予測結果を取得
    const result = this.predictor.getPrediction(accountId)
    if (result) {
      console.log('\n📈 予測結果:')
      console.log(`現在の証拠金維持率: ${result.prediction.currentMarginLevel.toFixed(1)}%`)
      console.log(`リスクレベル: ${result.prediction.riskLevel}`)
      console.log(`トレンド方向: ${result.prediction.trendDirection}`)
      
      if (result.prediction.timeToLossCut) {
        console.log(`ロスカットまで: ${result.prediction.timeToLossCut.toFixed(0)}分`)
      }
      
      if (result.prediction.requiredRecovery > 0) {
        console.log(`必要リカバリー額: $${result.prediction.requiredRecovery.toFixed(0)}`)
      }

      console.log('\n🔮 将来予測:')
      console.log(`15分後: ${result.prediction.predictions.in15min.toFixed(1)}%`)
      console.log(`30分後: ${result.prediction.predictions.in30min.toFixed(1)}%`)
      console.log(`1時間後: ${result.prediction.predictions.in1hour.toFixed(1)}%`)

      if (result.warnings.length > 0) {
        console.log('\n⚠️ 警告:')
        result.warnings.forEach(warning => {
          console.log(`- ${warning.level.toUpperCase()}: ${warning.message}`)
        })
      }

      if (result.recoveryScenarios.length > 0) {
        console.log('\n🛠️ 推奨対応策:')
        result.recoveryScenarios.slice(0, 3).forEach((scenario, index) => {
          console.log(`${index + 1}. ${scenario.description}`)
          console.log(`   効果: ${scenario.impact}%, 実行可能性: ${(scenario.feasibility * 100).toFixed(0)}%`)
        })
      }
    }

    // アルゴリズム比較テスト
    console.log('\n🧮 予測アルゴリズム比較:')
    this.testPredictionAlgorithms(mockHistory)

    // リカバリー計算テスト
    console.log('\n💡 リカバリー計算テスト:')
    this.testRecoveryCalculation()

    this.predictor.stop()
    console.log('\n✅ デモ完了')
  }

  /**
   * 模擬履歴データを生成
   */
  private generateMockHistory(): Omit<MarginLevelHistory, 'timestamp'>[] {
    const history: Omit<MarginLevelHistory, 'timestamp'>[] = []
    
    // 証拠金維持率が徐々に低下するシナリオ
    let marginLevel = 250
    let equity = 10000
    let usedMargin = 4000
    
    for (let i = 0; i < 15; i++) {
      // ランダムな変動を追加
      const volatility = (Math.random() - 0.5) * 20
      marginLevel = Math.max(30, marginLevel - 8 + volatility)
      
      equity = (usedMargin * marginLevel) / 100
      const freeMargin = Math.max(0, equity - usedMargin)
      const unrealizedPL = equity - 10000 + (i * -100) // 徐々に損失拡大
      
      history.push({
        marginLevel,
        equity,
        freeMargin,
        usedMargin,
        unrealizedPL,
        bonusAmount: 2000
      })
    }
    
    return history
  }

  /**
   * 予測アルゴリズムの比較テスト
   */
  private testPredictionAlgorithms(history: Omit<MarginLevelHistory, 'timestamp'>[]): void {
    const fullHistory: MarginLevelHistory[] = history.map((h, i) => ({
      ...h,
      timestamp: new Date(Date.now() - (history.length - i) * 5 * 60 * 1000)
    }))

    const methods = [
      { name: '移動平均', fn: () => PredictionAlgorithms.movingAveragePrediction(fullHistory, 5, 30) },
      { name: '指数移動平均', fn: () => PredictionAlgorithms.exponentialMovingAveragePrediction(fullHistory, 0.3, 30) },
      { name: '線形回帰', fn: () => PredictionAlgorithms.linearRegressionPrediction(fullHistory, 30) },
      { name: '多項式回帰', fn: () => PredictionAlgorithms.polynomialRegressionPrediction(fullHistory, 30) },
      { name: 'ARIMA風', fn: () => PredictionAlgorithms.arimaLikePrediction(fullHistory, 30) },
      { name: 'アンサンブル', fn: () => PredictionAlgorithms.ensemblePrediction(fullHistory, 30) },
      { name: 'ボラティリティ調整', fn: () => PredictionAlgorithms.volatilityAdjustedPrediction(fullHistory, 30) }
    ]

    methods.forEach(method => {
      const result = method.fn()
      console.log(`${method.name}: ${result.prediction.toFixed(1)}% (信頼度: ${(result.confidence * 100).toFixed(0)}%)`)
    })
  }

  /**
   * リカバリー計算のテスト
   */
  private testRecoveryCalculation(): void {
    const mockAccount: AccountState = {
      accountId: 'test-account',
      broker: 'TestBroker',
      equity: 5000,
      freeMargin: 500,
      usedMargin: 4500,
      marginLevel: 111, // 危険レベル
      bonusAmount: 1000,
      positions: [
        {
          id: 'pos1',
          symbol: 'EURUSD',
          type: 'buy',
          lots: 0.5,
          openPrice: 1.2000,
          currentPrice: 1.1900,
          profit: -500,
          margin: 1500
        },
        {
          id: 'pos2',
          symbol: 'GBPUSD',
          type: 'sell',
          lots: 0.3,
          openPrice: 1.3000,
          currentPrice: 1.3100,
          profit: -300,
          margin: 1000
        },
        {
          id: 'pos3',
          symbol: 'USDJPY',
          type: 'buy',
          lots: 0.2,
          openPrice: 150.00,
          currentPrice: 151.00,
          profit: 200,
          margin: 800
        }
      ]
    }

    const crossAccountInfo: CrossAccountInfo = {
      accounts: [
        mockAccount,
        {
          accountId: 'helper-account',
          broker: 'HelperBroker',
          equity: 15000,
          freeMargin: 8000,
          usedMargin: 7000,
          marginLevel: 214,
          bonusAmount: 0,
          positions: []
        }
      ],
      totalEquity: 20000,
      totalFreeMargin: 8500,
      riskDistribution: { 'test-account': 0.8, 'helper-account': 0.2 }
    }

    // 基本リカバリー計算
    const basicRecovery = RecoveryCalculator.calculateBasicRecovery(
      mockAccount.marginLevel, 
      mockAccount.usedMargin
    )
    console.log(`基本リカバリー必要額: $${basicRecovery.toFixed(0)}`)

    // 最適化されたリカバリープラン
    const optimized = RecoveryCalculator.calculateOptimizedRecovery(
      mockAccount,
      crossAccountInfo
    )

    console.log(`最適シナリオ: ${optimized.optimalScenario.description}`)
    console.log(`実行時間: ${optimized.timeToExecute}分`)
    console.log(`成功確率: ${(optimized.successProbability * 100).toFixed(0)}%`)
    console.log(`リスク削減: ${optimized.riskReduction}%`)
  }
}

// デモ実行関数
export async function runPredictionDemo(): Promise<void> {
  const demo = new PredictionDemo()
  await demo.runDemo()
}

// 利用例
export function createPredictionSystem() {
  const predictor = new LossCutPredictor({
    minDataPoints: 5,
    predictionWindowMinutes: [15, 30, 60, 120],
    confidenceThreshold: 0.7,
    updateIntervalMs: 30000
  })

  // 使用例: 新しいデータを追加
  // predictor.addMarginData('account-001', {
  //   marginLevel: 156.7,
  //   equity: 7835,
  //   freeMargin: 1235,
  //   usedMargin: 5000,
  //   unrealizedPL: -165,
  //   bonusAmount: 1000
  // })

  // 使用例: 予測結果を取得
  // const prediction = predictor.getPrediction('account-001')
  // if (prediction?.prediction.riskLevel === 'danger') {
  //   console.log('危険: 緊急対応が必要です')
  //   prediction.recoveryScenarios.forEach(scenario => {
  //     console.log(`推奨: ${scenario.description}`)
  //   })
  // }

  return predictor
}