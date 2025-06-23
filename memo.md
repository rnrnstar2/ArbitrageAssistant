## MVP設計書対応タスク作成完了

MVPシステム設計書と現在実装の比較分析を実施し、修正タスクを作成しました。

### 作成されたタスク
- `tasks/task-1.md` - Accountモデル追加とデータモデル修正
- `tasks/task-2-1.md` - Admin画面の戦略管理機能実装 
- `tasks/task-2-2.md` - Hedge System アクション実行エンジン実装
- `tasks/task-3.md` - WebSocket通信仕様の設計書準拠
- `tasks/README.md` - 実行手順

### 主要な修正ポイント
1. **Accountモデル完全欠落** - 設計書の最重要モデルが未実装
2. **PositionStatus不備** - OPENING状態が欠落
3. **戦略実行機能不完全** - PENDING→OPENING→OPENの状態遷移なし
4. **WebSocket通信差分** - メッセージフォーマットが設計書と不一致
5. **アクション同期機能欠落** - AppSync Subscriptionによる分散実行なし

全タスクをMVP範囲内で段階的に実行することで、設計書準拠のシステムが完成します。