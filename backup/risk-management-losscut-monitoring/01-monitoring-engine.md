# Task 01: 監視エンジン基盤の実装

## 概要
証拠金維持率の計算とロスカット監視の基盤エンジンを実装する。リアルタイム監視の核となる機能。

## 実装対象ファイル
- `apps/hedge-system/src/features/risk-management/MarginLevelCalculator.ts`
- `apps/hedge-system/src/features/risk-management/LossCutMonitor.ts`
- `apps/hedge-system/src/features/risk-management/types.ts`

## 具体的な実装内容

### MarginLevelCalculator.ts
```typescript
export class MarginLevelCalculator {
  // 証拠金維持率計算（ボーナス考慮）
  calculateMarginLevel(account: AccountData): number
  
  // ロスカットレベル計算
  calculateLossCutLevel(account: AccountData): number
  
  // 危険度判定
  assessRiskLevel(marginLevel: number): RiskLevel
  
  // ロスカット予測時間計算
  predictTimeToLossCut(account: AccountData, priceMovement: number): number
}
```

### LossCutMonitor.ts
```typescript
export class LossCutMonitor {
  // リアルタイム監視開始
  startMonitoring(accountIds: string[]): void
  
  // 証拠金維持率チェック
  private checkMarginLevels(): Promise<void>
  
  // イベント発火
  private emitRiskEvent(event: RiskEvent): void
  
  // 監視停止
  stopMonitoring(): void
}
```

## データ構造
```typescript
interface RiskMonitoringState {
  accountId: string
  marginLevel: number
  freeMargin: number
  usedMargin: number
  balance: number
  equity: number
  bonusAmount: number
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical'
  lastUpdate: Date
  lossCutLevel: number
  predictions: {
    timeToCritical?: number
    requiredRecovery: number
  }
}

interface RiskEvent {
  type: 'margin_warning' | 'margin_critical' | 'losscut_detected'
  accountId: string
  marginLevel: number
  timestamp: Date
  data: RiskMonitoringState
}
```

## 完了条件
- [ ] MarginLevelCalculator クラス実装
- [ ] LossCutMonitor クラス実装  
- [ ] TypeScript型定義作成
- [ ] 単体テスト実装
- [ ] ボーナス額を考慮した正確な計算ロジック

## 参考ファイル
- `apps/admin/features/monitoring/losscut/`
- `apps/hedge-system/src/features/monitoring/`

## 注意事項
- ボーナス額を含めた正確な証拠金維持率計算
- リアルタイム監視のパフォーマンス最適化
- 監視間隔の設定可能化（デフォルト1秒）