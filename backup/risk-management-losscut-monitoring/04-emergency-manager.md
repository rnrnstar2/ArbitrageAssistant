# Task 04: 緊急対応管理システムの実装

## 概要
ロスカット発生時の緊急対応と損失最小化のための高速処理システムを実装する。最優先で実行される緊急時専用エンジン。

## 実装対象ファイル
- `apps/hedge-system/src/features/risk-management/EmergencyActionManager.ts`
- `apps/hedge-system/src/features/risk-management/LossMinimizer.ts`  
- `apps/hedge-system/src/features/risk-management/EmergencyProtocol.ts`

## 具体的な実装内容

### EmergencyActionManager.ts
```typescript
export class EmergencyActionManager {
  // 緊急事態検知・開始
  activateEmergencyMode(trigger: EmergencyTrigger): Promise<void>
  
  // 緊急プロトコル実行
  executeEmergencyProtocol(protocol: EmergencyProtocol): Promise<EmergencyResult>
  
  // 手動介入許可チェック
  allowManualIntervention(): boolean
  
  // 緊急モード終了
  deactivateEmergencyMode(): Promise<void>
  
  // 緊急状態モニタ
  getEmergencyStatus(): EmergencyStatus
}
```

### LossMinimizer.ts
```typescript
export class LossMinimizer {
  // 最小損失経路計算
  calculateMinimumLossPath(positions: Position[]): LossMinimizationPlan
  
  // 緊急ヘッジ計算
  calculateEmergencyHedge(lossPosition: Position): HedgeInstruction[]
  
  // 損失確定 vs 継続保有 判定
  assessContinuationRisk(position: Position): 'close' | 'hold' | 'hedge'
  
  // リバランス提案
  generateRebalanceProposal(accounts: AccountData[]): RebalanceAction[]
}
```

### EmergencyProtocol.ts
```typescript
interface EmergencyProtocol {
  id: string
  name: string
  severity: 'high' | 'critical' | 'catastrophic'
  triggers: EmergencyTrigger[]
  immediateActions: EmergencyAction[]
  followUpActions: EmergencyAction[]
  maxExecutionTime: number
  manualApprovalRequired: boolean
}

interface EmergencyTrigger {
  type: 'losscut_detected' | 'margin_liquidation' | 'connection_lost' | 'system_error'
  accountId?: string
  threshold?: number
  consecutive?: number
}

interface EmergencyAction {
  type: 'force_close_all' | 'emergency_hedge' | 'pause_all_trading' | 'activate_backup' | 'alert_admin'
  priority: number
  timeout: number
  skipOnFailure: boolean
}
```

## 緊急プロトコル定義例
```typescript
const LOSSCUT_EMERGENCY_PROTOCOL: EmergencyProtocol = {
  id: 'losscut_response',
  name: 'ロスカット緊急対応',
  severity: 'critical',
  triggers: [
    { type: 'losscut_detected', consecutive: 1 },
    { type: 'margin_liquidation' }
  ],
  immediateActions: [
    { type: 'alert_admin', priority: 1, timeout: 1000, skipOnFailure: false },
    { type: 'pause_all_trading', priority: 2, timeout: 2000, skipOnFailure: false },
    { type: 'emergency_hedge', priority: 3, timeout: 5000, skipOnFailure: true }
  ],
  followUpActions: [
    { type: 'activate_backup', priority: 1, timeout: 10000, skipOnFailure: true }
  ],
  maxExecutionTime: 30000,
  manualApprovalRequired: false
}
```

## データ構造
```typescript
interface EmergencyStatus {
  isActive: boolean
  activatedAt?: Date
  protocol?: EmergencyProtocol
  executedActions: EmergencyActionResult[]
  currentPhase: 'detection' | 'immediate' | 'followup' | 'recovery'
  manualInterventionAllowed: boolean
}

interface LossMinimizationPlan {
  totalEstimatedLoss: number
  actions: Array<{
    action: 'close' | 'hedge' | 'rebalance'
    positions: string[]
    expectedLossReduction: number
    executionOrder: number
  }>
  confidence: number
  estimatedExecutionTime: number
}
```

## 完了条件
- [ ] EmergencyActionManager クラス実装
- [ ] LossMinimizer ロジック実装
- [ ] EmergencyProtocol 定義システム
- [ ] 緊急モード状態管理
- [ ] 手動介入制御機能
- [ ] 損失最小化アルゴリズム
- [ ] 緊急時ログ記録機能
- [ ] 単体テスト実装

## 緊急対応フロー
1. **検知** (< 1秒)
   - ロスカット/証拠金不足検知
   - 緊急プロトコル特定・開始

2. **即座対応** (< 5秒)
   - 管理者通知
   - 全トレード停止
   - 損失拡大防止

3. **緊急ヘッジ** (< 10秒)
   - 他口座でのポジション構築
   - リスク中和処理

4. **事後対応** (< 30秒)
   - バックアップシステム起動
   - 詳細分析・レポート

## 注意事項
- 実行速度最優先（< 10秒以内）
- ファイルセーフ処理（部分的失敗許容）
- 手動介入時の緊急停止
- ログ記録（後の分析用）
- 連鎖的緊急事態の防止

## 参考ファイル
- 既存の緊急停止機能
- ポジション管理システム