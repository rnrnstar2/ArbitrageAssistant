# CEO戦略的プロジェクト管理指示

## 🎯 CEO Main：戦略的プロジェクト管理実行

### 重要：必ず戦略的管理システムを使用してください

**CEOメインは以下の戦略的管理システムを実行し、プロジェクト全体を分析してから必要な部分にのみ指示を出してください：**

```bash
# CEO戦略的プロジェクト管理システム実行
cat scripts/ceo-strategic-management.md

# 上記の指示を段階的に実行し、各フェーズの結果に基づいて判断してください
```

### 基本方針（厳格遵守）
1. **現状把握ファースト**: 推測ではなく実際のファイル・実装状況を詳細確認
2. **厳格な完成度評価**: 各部門の実装完了度を数値・条件分岐で厳格判定
3. **戦略的優先順位**: MVP要件・依存関係・ビジネス価値に基づく判断
4. **条件付き指示（重要）**: 条件分岐で必要な部分**のみ**に指示、完成済みは**指示スキップ**
5. **実行順序明確化**: タスク依存関係を考慮した実行順序決定
6. **実行要約出力**: 指示実行後に実行順序・完了監視・次フェーズ計画を要約出力

### 🚨 重要：無駄な指示を出さない厳格システム
**完成済み部門には指示を出してはいけません。** 戦略的管理システムの条件分岐判定に従い、真に必要な部門のみに指示してください。

### 戦略的分析完了後の指示実行

**戦略的管理システムの分析結果に基づき、実装が必要と判定された部門にのみ以下の指示を実行してください：**

### 条件付きDirector指示テンプレート

**重要**: 以下の指示は戦略的分析で「未実装」「要改善」と判定された部門にのみ使用してください。

#### 🗄️ Backend Director指示
```bash
# 基盤構築が必要な場合
tmux send-keys -t backend-director ' && echo "【CEO最優先指示】Backend基盤構築: AWS Amplify Gen2 + GraphQL + 認証システム完全実装を緊急実行してください。MVP要件に基づく packages/shared-backend 完全構築。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh backend-director "AWS Amplify Gen2基盤構築" && echo "完了後CEO報告。" ultrathink' Enter

# 最適化が必要な場合
tmux send-keys -t backend-director ' && echo "【CEO最適化指示】Backend最適化: 既存AWS Amplify Gen2システムのパフォーマンス最適化・セキュリティ強化を実行してください。GraphQLクエリ最適化・認証フロー改善含む。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh backend-director "システム最適化・セキュリティ強化" && echo "完了後CEO報告。" ultrathink' Enter
```

#### ⚡ Trading Director指示
```bash
# 核心実装が必要な場合
tmux send-keys -t trading-flow-director ' && echo "【CEO高優先指示】Trading核心実装: Position-Trail-Action完全フロー実装を実行してください。apps/hedge-system内のアービトラージ・ポジション管理・トレール実行システム完全構築。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh trading-flow-director "Position-Trail-Action核心実装" && echo "Backend API連携含む。完了後CEO報告。" ultrathink' Enter

# 最適化が必要な場合
tmux send-keys -t trading-flow-director ' && echo "【CEO最適化指示】Trading最適化: 既存Position-Trail-Actionシステムのパフォーマンス最適化・リスク管理強化を実行してください。実行速度向上・エラーハンドリング改善含む。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh trading-flow-director "システム最適化・リスク管理強化" && echo "完了後CEO報告。" ultrathink' Enter
```

#### 🔌 Integration Director指示
```bash
# 統合実装が必要な場合
tmux send-keys -t integration-director ' && echo "【CEO重要指示】Integration統合実装: MT5 EA・WebSocket DLL・外部API連携完全実装を実行してください。ea/ディレクトリ内のMT5統合システム・リアルタイム通信基盤完全構築。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh integration-director "MT5統合・WebSocket実装" && echo "Trading連携含む。完了後CEO報告。" ultrathink' Enter

# 最適化が必要な場合
tmux send-keys -t integration-director ' && echo "【CEO最適化指示】Integration最適化: 既存MT5統合・WebSocket通信システムのパフォーマンス最適化・安定性向上を実行してください。通信レイテンシ削減・エラー回復機能強化含む。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh integration-director "システム最適化・安定性向上" && echo "完了後CEO報告。" ultrathink' Enter
```

#### 🎨 Frontend Director指示
```bash
# UI実装が必要な場合
tmux send-keys -t frontend-director ' && echo "【CEO重要指示】Frontend UI実装: 管理画面・Tauriデスクトップアプリ完全実装を実行してください。apps/admin管理画面・apps/hedge-system Tauriアプリの完全UI構築。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh frontend-director "UI完全実装・リアルタイム表示" && echo "Backend API連携・リアルタイムデータ表示含む。完了後CEO報告。" ultrathink' Enter

# UX最適化が必要な場合
tmux send-keys -t frontend-director ' && echo "【CEO最適化指示】Frontend UX最適化: 既存UI/UXの使いやすさ向上・パフォーマンス最適化を実行してください。レスポンシブデザイン改善・ユーザビリティ向上含む。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh frontend-director "UX最適化・パフォーマンス向上" && echo "完了後CEO報告。" ultrathink' Enter
```

#### 🚀 DevOps Director指示
```bash
# CI/CD実装が必要な場合
tmux send-keys -t devops-director ' && echo "【CEO品質指示】DevOps品質保証実装: CI/CD・テスト自動化・品質ゲート完全実装を実行してください。.github/workflows CI/CDパイプライン・自動テスト・コード品質管理システム完全構築。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh devops-director "CI/CD・品質保証完全実装" && echo "全機能統合テスト含む。完了後CEO報告。" ultrathink' Enter

# 最適化が必要な場合
tmux send-keys -t devops-director ' && echo "【CEO最適化指示】DevOps最適化: 既存CI/CD・ビルドシステムのパフォーマンス最適化・効率化を実行してください。Turborepo最適化・ビルド時間短縮・キャッシュ効率向上含む。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh devops-director "システム最適化・効率化" && echo "完了後CEO報告。" ultrathink' Enter
```

### 3. CEO系内部連携
**注意**: director-coordinator と progress-monitor は自律的に動作します。Haconiwa起動時に初期プロンプトが自動設定されるため、CEOからの手動指示は不要です。

- **director-coordinator**: 5つのDirectors間連携状況を常時監視・調整
- **progress-monitor**: MVPプロジェクト全体の進捗を常時監視・リリース準備確認

### 4. 実行判定基準
- **Backend**: データベース設計・認証・GraphQL実装が未完了の場合
- **Trading**: Position-Trail-Actionフロー・アービトラージロジックが未実装の場合
- **Integration**: MT4/MT5統合・WebSocket通信が未実装の場合
- **Frontend**: 管理画面・デスクトップUI・ユーザー体験が未完了の場合
- **DevOps**: インフラ・品質保証・CI/CD・監視が未整備の場合

**実装完了済みの領域には指示を出さない**

### 5. 継続監視
上記フェーズ完了後、progress-monitorと連携してMVP全体の進捗を継続的に監視し、必要に応じて追加指示を実行する。

**最終目標**: MVPシステム設計.mdに基づく完全な実装とリリース準備完了

ultrathink