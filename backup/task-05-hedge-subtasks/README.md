# Task 05: 両建てポジション管理システム - サブタスク一覧

## 概要
task-05-hedge-position-management.md を並列処理可能な細分化タスクに分割したもの。

## サブタスク構成

### Phase 1: 基盤機能 (並列実行可能)
- **task-05-01-hedge-detector.md** - 両建て検出ロジック
- **task-05-02-position-relation-manager.md** - ポジション関連付け管理
- **task-05-03-hedge-validator.md** - 整合性チェッカー

### Phase 2: 実行機能 (Phase 1完了後)
- **task-05-04-hedge-executor.md** - 両建て実行エンジン
- **task-05-05-cross-account-hedge.md** - クロスアカウント両建て
- **task-05-06-balance-calculator.md** - バランス計算機

### Phase 3: UI機能 (Phase 1-2と並列実行可能)
- **task-05-07-hedge-position-grid.md** - 状況表示グリッド
- **task-05-08-hedge-control-panel.md** - 制御パネル
- **task-05-09-hedge-analytics.md** - 分析・統計表示

### Phase 4: 運用機能 (他フェーズと並列実行可能)
- **task-05-10-hedge-maintenance.md** - 維持管理システム
- **task-05-11-hedge-rebalancer.md** - リバランス機能
- **task-05-12-hedge-history.md** - 履歴管理

## 実行順序推奨

### 優先度 High (基盤)
1. task-05-01, 05-02, 05-03 (並列実行)

### 優先度 Medium (実行)
2. task-05-04, 05-06 (並列実行)
3. task-05-05 (04完了後)

### 優先度 Medium (UI)
4. task-05-07, 05-08, 05-09 (並列実行)

### 優先度 Low (運用)
5. task-05-10, 05-11, 05-12 (並列実行)

## 依存関係
- 05-02 → 05-01 (検出結果を関連付け)
- 05-03 → 05-01, 05-02 (検出・関連付け結果を検証)
- 05-04 → 05-01, 05-02, 05-03 (基盤機能を利用)
- 05-05 → 05-04 (実行エンジンを拡張)
- 05-06 → 05-01, 05-02 (検出・関連付け結果を計算)
- 05-07, 05-08, 05-09 → 05-01, 05-02 (表示用データ)
- 05-10, 05-11 → 05-04, 05-06 (実行・計算機能を利用)
- 05-12 → 全タスク (全機能の履歴記録)

## 実行指示例
```
"task-05-01-hedge-detector.md, task-05-02-position-relation-manager.md, task-05-03-hedge-validator.md を並列で実行して。実行済みの時、各タスクファイルを削除すること。"
```