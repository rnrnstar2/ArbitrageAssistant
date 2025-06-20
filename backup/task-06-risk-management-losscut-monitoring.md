# Task 06: リスク管理・ロスカット監視システムの実装

## 概要
証拠金維持率監視とロスカット時の自動アクション実行機能を実装する。ボーナスアービトラージの生命線となる重要機能。

## 実装範囲

### 1. ロスカット監視機能
- **リアルタイム監視**
  - 証拠金維持率の連続監視
  - ロスカットレベル接近警告
  - EA経由でのロスカット検知

- **予測・警告システム**
  - ロスカット発生予測
  - 段階的警告（50%, 30%, 20%等）
  - 緊急通知機能

### 2. アクションチェーン機能
- **ロスカット時の自動対応**
  - 関連ポジションの自動決済
  - 他口座でのポジション再構築
  - 損失最小化のための緊急対応

- **利益確定連動**
  - 利益ポジションの自動決済
  - アカウント間でのバランス調整
  - 資金移動提案

### 3. リスク管理ダッシュボード
- **リスク状況可視化**
  - 口座別リスクレベル表示
  - 証拠金維持率グラフ
  - 危険ポジション一覧

- **アクション設定**
  - ポジション別ネクストアクション設定
  - 自動実行条件設定
  - 緊急停止機能

## 参考ファイル
- `apps/admin/features/monitoring/losscut/`
- `apps/hedge-system/src/features/monitoring/`
- `apps/admin/features/monitoring/alerts/`

## 実装手順

### Phase 1: ロスカット監視基盤
1. `src/features/risk-management/` ディレクトリ作成
2. `LossCutMonitor.ts` - ロスカット監視エンジン
3. `MarginLevelCalculator.ts` - 証拠金維持率計算
4. `RiskAlertManager.ts` - アラート管理

### Phase 2: アクションチェーン実装
5. `ActionChainExecutor.ts` - アクションチェーン実行
6. `EmergencyActionManager.ts` - 緊急対応管理
7. `CrossAccountRebalancer.ts` - 口座間バランス調整

### Phase 3: 監視UI実装
8. `RiskDashboard.tsx` - リスク管理ダッシュボード
9. `MarginLevelGauge.tsx` - 証拠金維持率ゲージ
10. `ActionChainSettings.tsx` - アクション設定画面

### Phase 4: 通知・履歴管理
11. `RiskNotificationSystem.tsx` - 通知システム
12. `LossCutHistory.tsx` - ロスカット履歴
13. パフォーマンス分析・レポート

## データ構造

### RiskMonitoringState
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
  losseCutLevel: number
  predictions: {
    timeToCritical?: number // 分
    requiredRecovery: number // USD
  }
}
```

### NextAction
```typescript
interface NextAction {
  positionId: string
  trigger: {
    type: 'margin_level' | 'loss_amount' | 'profit_target'
    threshold: number
  }
  actions: ActionStep[]
  isActive: boolean
  priority: number
}

interface ActionStep {
  type: 'close_position' | 'open_hedge' | 'rebalance' | 'notify'
  targetAccountId?: string
  parameters: Record<string, any>
  rollbackAction?: ActionStep
}
```

## 完了条件
- [ ] リアルタイム証拠金維持率監視
- [ ] ロスカット予測・警告機能
- [ ] アクションチェーンの自動実行
- [ ] 口座間バランス調整機能
- [ ] リスク状況の可視化
- [ ] 緊急停止・手動介入機能
- [ ] 履歴・分析レポート機能

## 注意事項
- ロスカット検知の精度・速度が重要
- 複数口座同時監視時のパフォーマンス
- ネットワーク遅延時の対応
- 誤発報防止機能
- 手動介入時の自動処理停止
- ボーナス額を考慮した正確な計算

## 緊急時対応フロー
1. 証拠金維持率低下検知
2. 即座の通知・アラート
3. 設定されたアクションチェーン実行
4. 他口座での補完処理
5. 結果確認・報告
6. 必要に応じて追加対応