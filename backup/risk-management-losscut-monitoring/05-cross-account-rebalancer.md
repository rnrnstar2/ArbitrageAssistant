# Task 05: 口座間バランス調整システムの実装

## 概要
複数口座間でのリスク分散とポジション再構築を自動化する。ロスカット後の復旧やリスク最適化のための口座間調整機能。

## 実装対象ファイル
- `apps/hedge-system/src/features/risk-management/CrossAccountRebalancer.ts`
- `apps/hedge-system/src/features/risk-management/RebalanceCalculator.ts`
- `apps/hedge-system/src/features/risk-management/FundTransferManager.ts`

## 具体的な実装内容

### CrossAccountRebalancer.ts
```typescript
export class CrossAccountRebalancer {
  // 口座間バランス分析
  analyzeAccountBalance(accounts: AccountData[]): BalanceAnalysis
  
  // リバランス提案生成
  generateRebalanceProposal(analysis: BalanceAnalysis): RebalanceProposal
  
  // リバランス実行
  executeRebalance(proposal: RebalanceProposal): Promise<RebalanceResult>
  
  // 緊急時ポジション再構築
  emergencyReposition(lostPositions: Position[], targetAccounts: string[]): Promise<RepositionResult>
  
  // リスク分散度計算
  calculateRiskDistribution(accounts: AccountData[]): RiskDistribution
}
```

### RebalanceCalculator.ts
```typescript
export class RebalanceCalculator {
  // 最適資金配分計算
  calculateOptimalAllocation(
    accounts: AccountData[], 
    targetRiskLevel: number
  ): AllocationPlan
  
  // ポジション移動計算
  calculatePositionTransfer(
    sourceAccount: string,
    targetAccount: string, 
    positions: Position[]
  ): TransferPlan
  
  // リスク最小化配分
  calculateRiskMinimizedDistribution(
    totalCapital: number, 
    accountConstraints: AccountConstraint[]
  ): DistributionPlan
  
  // 相関リスク分析
  analyzeCorrelationRisk(positions: Position[]): CorrelationAnalysis
}
```

### FundTransferManager.ts
```typescript
export class FundTransferManager {
  // 資金移動実行
  transferFunds(transfer: FundTransfer): Promise<TransferResult>
  
  // 移動可能金額計算
  calculateTransferableAmount(fromAccount: string, toAccount: string): number
  
  // 移動履歴管理
  getTransferHistory(accountId?: string): TransferHistory[]
  
  // 移動制限チェック
  checkTransferLimits(transfer: FundTransfer): LimitCheckResult
}
```

## データ構造
```typescript
interface BalanceAnalysis {
  totalCapital: number
  accounts: Array<{
    accountId: string
    balance: number
    usedMargin: number
    freeMargin: number
    riskExposure: number
    leverageRatio: number
    riskScore: number
  }>
  riskDistribution: RiskDistribution
  imbalanceLevel: 'optimal' | 'acceptable' | 'risky' | 'critical'
  recommendations: string[]
}

interface RebalanceProposal {
  id: string
  type: 'risk_reduction' | 'post_losscut' | 'optimization' | 'emergency'
  fundTransfers: FundTransfer[]
  positionAdjustments: PositionAdjustment[]
  estimatedImpact: {
    riskReduction: number
    costEstimate: number
    timeToComplete: number
  }
  approval: {
    required: boolean
    level: 'auto' | 'user' | 'admin'
  }
}

interface FundTransfer {
  id: string
  fromAccount: string
  toAccount: string
  amount: number
  currency: string
  purpose: string
  priority: 'low' | 'medium' | 'high' | 'emergency'
  executionTime?: Date
}

interface PositionAdjustment {
  type: 'close' | 'open' | 'resize' | 'transfer'
  accountId: string
  positionId?: string
  instrument: string
  size: number
  direction: 'buy' | 'sell'
  reason: string
}
```

## リバランス戦略
```typescript
const REBALANCE_STRATEGIES = {
  // 等リスク配分
  equalRisk: {
    name: '等リスク配分',
    description: '各口座のリスクレベルを均等に調整',
    targetRiskPerAccount: 0.25 // 25%ずつ
  },
  
  // 資金比例配分
  capitalProportional: {
    name: '資金比例配分',
    description: '資金量に比例したリスク配分',
    minAllocation: 0.1, // 最低10%
    maxAllocation: 0.5  // 最大50%
  },
  
  // 保守的配分
  conservative: {
    name: '保守的配分',
    description: 'メイン口座中心の低リスク配分',
    mainAccountRatio: 0.6,
    backupAccountRatio: 0.4
  }
}
```

## 完了条件
- [ ] CrossAccountRebalancer クラス実装
- [ ] RebalanceCalculator ロジック実装
- [ ] FundTransferManager 実装
- [ ] リバランス提案生成機能
- [ ] 自動承認・手動承認制御
- [ ] リスク分散度計算
- [ ] 緊急時ポジション再構築
- [ ] 履歴・監査ログ機能
- [ ] 単体テスト実装

## リバランス実行フロー
1. **分析フェーズ**
   - 全口座状況分析
   - リスク分散度計算
   - 不均衡レベル判定

2. **提案生成**
   - 最適配分計算
   - 資金移動プラン作成
   - ポジション調整案作成

3. **承認プロセス**
   - 自動承認条件チェック
   - 必要時ユーザー承認待ち
   - 緊急時強制実行

4. **実行フェーズ**
   - 資金移動実行
   - ポジション調整実行
   - 結果検証・報告

## 注意事項
- 口座間移動の手数料・時間考慮
- レバレッジ規制への対応
- 移動中のリスクエクスポージャー
- 部分的失敗時のロールバック
- 規制・制限事項の遵守

## 参考ファイル
- 既存の資金管理機能
- ポジション管理システム
- 口座連携機能