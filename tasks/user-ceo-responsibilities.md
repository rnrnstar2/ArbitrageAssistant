# User CEO Responsibilities - Haconiwa環境サポート

## 🎯 CEOユーザーの役割

Haconiwa環境において、あなた（CEO）は以下の統括責任を持ちます：

### 1. 🏛️ Strategic Direction（戦略指示）
- **各Directors指示**: 5つのDirectorに対する具体的な作業指示
- **優先度設定**: タスクの優先順位決定・調整
- **技術方針承認**: 重要な技術選択の最終承認

### 2. 🔄 Directors Coordination（Directors間調整）
- **backend-director**: AWS Amplify Gen2 + GraphQL実装指示
- **trading-flow-director**: Position-Trail-Action実装指示  
- **integration-director**: MT4/MT5 + WebSocket実装指示
- **frontend-director**: Next.js + React実装指示
- **devops-director**: Turborepo + CI/CD実装指示

### 3. 📊 Progress Monitoring（進捗監視）
- **作業状況確認**: `npm run haconiwa:status`で各ペイン状況確認
- **品質チェック**: 各Director実装後の品質確認
- **リリース判断**: MVP完成時のリリース判断

## 🛠️ 必要なサポート内容

### A. 技術的サポート
1. **環境変数確認**：各ペインでの役割認識確認
2. **タスク進捗確認**：各Directorの作業進捗確認  
3. **品質チェック**：lint/type-check実行サポート
4. **統合テスト**：各部門実装後の統合確認

### B. 組織管理サポート
1. **役割明確化**：各エージェントの専門領域確認
2. **作業分担**：並列作業可能なタスクの識別
3. **Dependencies管理**：他部門依存関係の整理
4. **コミュニケーション**：部門間の技術課題調整

### C. 意思決定サポート
1. **技術選択**: 複数選択肢がある場合の最終判断
2. **リソース配分**: 各部門の作業量バランス調整
3. **リリース計画**: MVP機能完成度に基づくリリース判断
4. **課題解決**: 部門間の技術課題解決方針決定

## 🎮 実際の指示例

### Directors指示テンプレート
```bash
# Backend Directorへの指示例
"backend-director: packages/shared-backend/amplify/data/resource.tsを実装して。
User/Account/Position/ActionのGraphQLスキーマと認証設定を完了。
完了後、progress-monitorに報告すること。"

# Trading Flow Directorへの指示例  
"trading-flow-director: apps/hedge-system/lib/hedge-system-core.tsを実装して。
Position状態遷移とTrail判定アルゴリズムを完了。
backend-directorのGraphQL実装完了後に連携テストを実行。"
```

### 進捗確認コマンド
```bash
# 各ペインの作業状況確認
npm run haconiwa:status

# 品質チェック（必要時のみ）
npm run lint
npm run type-check

# 統合テスト（各部門実装完了後）
npm run test
```

## 🚨 重要な注意点

1. **並列作業指示**: 依存関係のないタスクは並列実行可能
2. **技術的判断**: 複雑な技術選択は各Directorの専門知識を信頼
3. **品質基準**: ESLint --max-warnings 0とTypeScript strict modeを維持
4. **リリース基準**: MVP機能完成度80%以上でリリース判断

## 📋 次のアクション

1. `npm run haconiwa:start`で環境起動
2. 各ペインで環境変数確認（HACONIWA_ROLE等）
3. 各Directorに具体的なタスク指示
4. 進捗確認と品質チェック
5. 必要に応じて追加指示・調整