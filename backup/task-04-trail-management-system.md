# Task 04: トレール管理システムの実装

## 概要
利益方向への価格変動時に損切り位置を自動調整するトレール機能を実装する。エントリー時と決済時の両方で利用可能。

## 実装範囲

### 1. トレール設定機能
- **トレール幅設定**
  - 固定幅トレール（pips指定）
  - パーセンテージトレール
  - ATR（Average True Range）ベーストレール

- **開始条件設定**
  - 最低利益での開始条件
  - 即座開始オプション
  - 価格レベル指定開始

### 2. リアルタイムトレール実行
- **価格監視**
  - リアルタイム価格取得
  - トレール条件判定
  - 損切りライン自動更新

- **EA連携**
  - トレール実行命令送信
  - 実行結果の確認
  - エラー時の再試行

### 3. トレール管理UI
- **設定画面**
  - ポジション別トレール設定
  - 一括トレール設定
  - プリセット管理

- **監視画面**
  - トレール状況の可視化
  - 現在の損切りライン表示
  - 履歴・ログ表示

## 参考ファイル
- `apps/admin/features/trading/automation/` 
- `apps/hedge-system/src/features/ea-management/`
- `docs/requirements/hedge-system-requirements.md` (トレール機能部分)

## 実装手順

### Phase 1: トレール設定UI
1. `src/features/trading/trail/` ディレクトリ作成
2. `TrailSettingsForm.tsx` - トレール設定フォーム
3. `TrailPresetManager.tsx` - プリセット管理
4. `TrailStatusDisplay.tsx` - 状況表示

### Phase 2: トレールロジック実装
5. `TrailCalculator.ts` - トレール計算ロジック
6. `TrailExecutor.ts` - トレール実行エンジン
7. WebSocket経由のトレール命令送信

### Phase 3: リアルタイム監視
8. 価格変動監視システム
9. トレール条件判定ロジック
10. 自動実行・通知機能

### Phase 4: 管理・履歴機能
11. `TrailHistory.tsx` - 履歴表示
12. `TrailLogManager.ts` - ログ管理
13. パフォーマンス分析機能

## データ構造

### TrailSettings
```typescript
interface TrailSettings {
  id: string
  positionId: string
  type: 'fixed' | 'percentage' | 'atr'
  trailAmount: number
  startCondition: {
    type: 'immediate' | 'profit_threshold' | 'price_level'
    value?: number
  }
  isActive: boolean
  currentStopLoss: number
  maxProfit: number
  lastUpdated: Date
}
```

## 完了条件
- [ ] トレール設定の保存・読み込み
- [ ] リアルタイム価格監視・トレール実行
- [ ] EA経由でのStop Loss更新
- [ ] トレール状況の可視化
- [ ] 履歴管理・分析機能
- [ ] エラーハンドリング・復旧機能

## 注意事項
- 価格取得遅延時の適切な処理
- 複数ポジション同時トレール時のパフォーマンス
- EA接続断時のトレール状態保持
- 重複実行防止機能の実装