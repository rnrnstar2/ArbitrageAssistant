# Task 05: 両建てポジション管理システムの実装

## 概要
同一通貨ペアでの買い・売り両ポジション管理機能を実装する。リスク回避とボーナス活用の中核機能。

## 実装範囲

### 1. 両建て管理機能
- **自動両建て判定**
  - 両建てタイミングの判定ロジック
  - 適切な両建て比率の計算
  - 分散エントリー対応（0.5lot × 2など）

- **クロスアカウント両建て**
  - 複数口座間での両建て実行
  - 口座間バランス管理
  - リスク分散設定

### 2. ポジション関連付け
- **関連ポジション管理**
  - 両建てポジションの紐付け
  - 関連ポジション検索・表示
  - 整合性チェック

- **整理時の両建て維持**
  - 日次整理における両建て継続
  - 同時決済・再エントリー
  - 取引履歴の一貫性保持

### 3. 両建て監視・制御
- **リアルタイム監視**
  - 両建て状況の可視化
  - 不整合検出・アラート
  - 総損益計算

- **制御機能**
  - 両建て解除
  - 片方のみ決済
  - 追加両建て実行

## 参考ファイル
- `apps/admin/features/trading/` 
- `apps/hedge-system/src/features/monitoring/ActivePositions.tsx`
- `docs/requirements/hedge-system-requirements.md` (両建て管理部分)

## 実装手順

### Phase 1: 両建て検出・関連付け
1. `src/features/trading/hedge/` ディレクトリ作成
2. `HedgePositionDetector.ts` - 両建て検出ロジック
3. `PositionRelationManager.ts` - 関連付け管理
4. `HedgePositionValidator.ts` - 整合性チェック

### Phase 2: 両建て実行機能
5. `HedgeExecutor.ts` - 両建て実行エンジン
6. `CrossAccountHedge.ts` - クロスアカウント両建て
7. `HedgeBalanceCalculator.ts` - バランス計算

### Phase 3: 監視・制御UI
8. `HedgePositionGrid.tsx` - 両建て状況表示
9. `HedgeControlPanel.tsx` - 制御パネル
10. `HedgeAnalytics.tsx` - 分析・統計表示

### Phase 4: 整理・維持機能
11. `HedgeMaintenanceManager.ts` - 整理時の両建て維持
12. `HedgeRebalancer.ts` - バランス調整機能
13. 両建て履歴管理

## データ構造

### HedgePosition
```typescript
interface HedgePosition {
  id: string
  positionIds: string[]
  symbol: string
  hedgeType: 'perfect' | 'partial' | 'cross_account'
  accounts: string[]
  totalLots: {
    buy: number
    sell: number
  }
  totalProfit: number
  isBalanced: boolean
  createdAt: Date
  lastRebalanced?: Date
  settings: {
    autoRebalance: boolean
    maxImbalance: number
    maintainOnClose: boolean
  }
}
```

### 両建て判定ロジック
```typescript
interface HedgeDetectionCriteria {
  symbol: string
  timeWindow: number // 分
  maxSpread: number // pips
  minLotSize: number
  accountGroups?: string[][]
}
```

## 完了条件
- [ ] 両建てポジションの自動検出
- [ ] 関連ポジションの適切な関連付け
- [ ] クロスアカウント両建て実行
- [ ] リアルタイム両建て状況表示
- [ ] 整理時の両建て維持機能
- [ ] 両建て解除・制御機能
- [ ] エラー時の整合性保持

## 注意事項
- 両建て比率の適切な管理
- 口座間での実行タイミング調整
- ネットワーク遅延時の整合性保持
- 部分決済時の両建て状態維持
- 複数通貨ペア同時両建て時の処理