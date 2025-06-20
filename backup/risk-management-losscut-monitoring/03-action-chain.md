# Task 03: アクションチェーン実行エンジンの実装

## 概要
ロスカット検知時の自動対応やアクションチェーンの実行機能を実装する。複数のアクションを順次実行する自動化エンジン。

## 実装対象ファイル
- `apps/hedge-system/src/features/risk-management/ActionChainExecutor.ts`
- `apps/hedge-system/src/features/risk-management/ActionDefinitions.ts`
- `apps/hedge-system/src/features/risk-management/ActionValidator.ts`

## 具体的な実装内容

### ActionChainExecutor.ts
```typescript
export class ActionChainExecutor {
  // アクションチェーン実行
  executeChain(actionChain: ActionChain): Promise<ExecutionResult>
  
  // 単一アクション実行
  executeAction(action: ActionStep): Promise<ActionResult>
  
  // ロールバック実行
  rollbackActions(executedActions: ActionStep[]): Promise<void>
  
  // 実行状態監視
  getExecutionStatus(chainId: string): ExecutionStatus
}
```

### ActionDefinitions.ts
```typescript
interface ActionChain {
  id: string
  name: string
  trigger: TriggerCondition
  actions: ActionStep[]
  rollbackStrategy: 'all' | 'partial' | 'manual'
  maxExecutionTime: number
  priority: number
}

interface ActionStep {
  id: string
  type: ActionType
  parameters: ActionParameters
  timeout: number
  retryCount: number
  rollbackAction?: ActionStep
  dependsOn?: string[]
}

type ActionType = 
  | 'close_position'
  | 'open_hedge_position' 
  | 'adjust_position_size'
  | 'transfer_funds'
  | 'send_notification'
  | 'pause_trading'
  | 'emergency_stop'

interface TriggerCondition {
  type: 'margin_level' | 'loss_amount' | 'profit_target' | 'manual'
  operator: 'lt' | 'gt' | 'eq' | 'lte' | 'gte'
  value: number
  accountId?: string
}
```

### ActionValidator.ts
```typescript
export class ActionValidator {
  // アクション実行前バリデーション
  validateAction(action: ActionStep): ValidationResult
  
  // アクションチェーン整合性チェック
  validateChain(chain: ActionChain): ValidationResult
  
  // 依存関係チェック
  checkDependencies(actions: ActionStep[]): boolean
  
  // リスクレベル評価
  assessActionRisk(action: ActionStep): RiskLevel
}
```

## アクション実行例
```typescript
// ロスカット時の自動対応チェーン
const emergencyChain: ActionChain = {
  id: 'losscut_emergency_response',
  name: 'ロスカット緊急対応',
  trigger: {
    type: 'margin_level',
    operator: 'lt',
    value: 20
  },
  actions: [
    {
      id: 'notify_emergency',
      type: 'send_notification',
      parameters: { level: 'emergency', message: 'ロスカット検知' },
      timeout: 5000,
      retryCount: 0
    },
    {
      id: 'close_dangerous_positions',
      type: 'close_position',
      parameters: { criteria: 'high_risk' },
      timeout: 10000,
      retryCount: 2
    },
    {
      id: 'open_hedge_other_account',
      type: 'open_hedge_position',
      parameters: { targetAccount: 'backup_account' },
      timeout: 15000,
      retryCount: 1,
      dependsOn: ['close_dangerous_positions']
    }
  ]
}
```

## 完了条件
- [ ] ActionChainExecutor クラス実装
- [ ] ActionDefinitions 型定義作成
- [ ] ActionValidator バリデーション機能
- [ ] アクション実行ログ機能
- [ ] ロールバック機能実装
- [ ] 依存関係管理機能
- [ ] タイムアウト・リトライ機能
- [ ] 単体テスト実装

## 実行フロー
1. トリガー条件監視
2. アクションチェーン特定
3. バリデーション実行
4. アクション順次実行
5. 結果監視・ログ記録
6. 必要に応じてロールバック

## 参考ファイル
- `apps/admin/features/monitoring/losscut/`
- 既存のポジション管理機能

## 注意事項
- アクション実行の冪等性保証
- ネットワーク遅延・エラー時の対応
- 同時実行制御（排他制御）
- 実行履歴とログの記録
- 手動介入時の自動停止機能