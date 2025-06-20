# Task 06 - リスク管理・ロスカット監視システム 細分化タスク

## 概要
`task-06-risk-management-losscut-monitoring.md` を並列処理可能な細分化タスクに分割

## タスク一覧

### Phase 1: ロスカット監視基盤 🔍
- `task-06-01-monitoring-engine.md` - ロスカット監視エンジン実装
- `task-06-02-margin-calculator.md` - 証拠金維持率計算機能
- `task-06-03-risk-alert-manager.md` - リスクアラート管理システム
- `task-06-04-prediction-system.md` - ロスカット予測・警告システム

### Phase 2: アクションチェーン実装 ⚡
- `task-06-05-action-chain-executor.md` - アクションチェーン実行エンジン
- `task-06-06-emergency-action-manager.md` - 緊急対応管理システム  
- `task-06-07-cross-account-rebalancer.md` - 口座間バランス調整機能

### Phase 3: 監視UI実装 📊
- `task-06-08-risk-dashboard.md` - リスク管理ダッシュボード
- `task-06-09-margin-level-gauge.md` - 証拠金維持率ゲージ
- `task-06-10-action-settings-ui.md` - アクション設定画面

### Phase 4: 通知・履歴管理 📱
- `task-06-11-notification-system.md` - リスク通知システム
- `task-06-12-losscut-history.md` - ロスカット履歴管理
- `task-06-13-performance-analytics.md` - パフォーマンス分析・レポート

## 並列実行推奨グループ

### グループA（監視基盤）
- task-06-01, task-06-02, task-06-03, task-06-04

### グループB（アクション実行）  
- task-06-05, task-06-06, task-06-07

### グループC（UI・表示）
- task-06-08, task-06-09, task-06-10

### グループD（通知・履歴）
- task-06-11, task-06-12, task-06-13

## 依存関係
- Phase 1 → Phase 2 → Phase 3 → Phase 4 の順序で実行推奨
- 同一Phase内のタスクは並列実行可能
- グループAはすべての基盤となるため最優先
- グループB・Cは並列実行可能

## 実行指示例
```bash
# Phase 1の並列実行指示
"tasks/task-06-subdivisions/README.md は参考程度に、
タスクは task-06-01-monitoring-engine.md, task-06-02-margin-calculator.md, task-06-03-risk-alert-manager.md, task-06-04-prediction-system.md を並列実行して。
実行済みの時、各タスクファイルを削除すること。"

# Phase 2の並列実行指示
"tasks/task-06-subdivisions/README.md は参考程度に、
タスクは task-06-05-action-chain-executor.md, task-06-06-emergency-action-manager.md, task-06-07-cross-account-rebalancer.md を並列実行して。
実行済みの時、各タスクファイルを削除すること。"
```

## 注意事項
- 各サブタスクは独立して実行可能
- ロスカット検知の精度・速度が重要
- 複数口座同時監視時のパフォーマンス考慮
- ネットワーク遅延時の対応必須
- 誤発報防止機能の実装
- ボーナス額を考慮した正確な計算が必要

## 既存実装との関係
- `tasks/risk-management-losscut-monitoring/` ディレクトリとの整合性維持
- `apps/admin/features/monitoring/losscut/` の既存コードを活用
- `apps/hedge-system/src/features/monitoring/` との連携考慮