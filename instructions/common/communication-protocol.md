# 通信プロトコル
# ArbitrageAssistant 組織間通信・連携システム

## 🎯 通信システム概要

### 基本構成
- **President Terminal**: 1ペイン（戦略立案・全体指示）
- **Team Terminal**: 20ペイン（5部門 × 4エージェント）
- **通信方式**: tmux + `agent-send.sh`
- **プロトコル**: `C-c → message → C-m`

### 通信対象
- **President**: 1人（全体統括）
- **Director**: 5人（部門統括）
- **Worker**: 15人（実装作業者）
- **合計**: 21エージェント

## 📡 agent-send.sh 基本使用方法

### 基本コマンド形式
```bash
./agent-send.sh [recipient] "[message]"
```

### 受信者指定パターン

#### 1. 個別エージェント指定
```bash
# Director への指示
./agent-send.sh backend-director "GraphQL基盤構築開始"
./agent-send.sh frontend-director "Position-Trail-Action UI実装開始"
./agent-send.sh integration-director "MT5/WebSocket連携実装開始"
./agent-send.sh pta-director "MVP核心機能Position-Trail-Action実装開始"
./agent-send.sh quality-director "全システム品質チェック実行"

# Worker への直接指示
./agent-send.sh backend-worker1 "resource.ts修正実行"
./agent-send.sh frontend-worker2 "Position UI実装開始"
./agent-send.sh core-worker3 "Action同期ロジック実装"
```

#### 2. 部門全体指示
```bash
# 部門単位での指示
./agent-send.sh department backend "バックエンド基盤強化"
./agent-send.sh department frontend "UI/UX品質向上"
./agent-send.sh department integration "MT5連携最適化"
./agent-send.sh department core "MVP核心機能実装"
./agent-send.sh department quality "品質保証強化"
```

#### 3. 全体指示
```bash
# 全エージェント対象
./agent-send.sh all "システム全体品質チェック実行"
./agent-send.sh all "緊急メンテナンス開始準備"
```

## 🏛️ President 通信パターン

### 戦略指示パターン

#### 1. MVP開発フェーズ指示
```bash
# Phase 1: Backend基盤構築
./agent-send.sh backend-director "AWS Amplify Gen2基盤構築開始。User/Account/Position/Action GraphQLスキーマ優先実装"

# Phase 2: Frontend UI実装
./agent-send.sh frontend-director "Position-Trail-Action UI実装開始。Tauri・管理画面統合優先"

# Phase 3: Integration連携
./agent-send.sh integration-director "MT5/WebSocket連携実装開始。リアルタイム通信優先"

# Phase 4: 核心機能実装
./agent-send.sh pta-director "MVP核心機能Position-Trail-Action実装開始。最高優先度"

# Phase 5: 品質保証
./agent-send.sh quality-director "全システム品質チェック・最適化実行"
```

#### 2. 緊急指示パターン
```bash
# 緊急課題対応
./agent-send.sh all "緊急課題発生。[課題内容]への対応開始。影響範囲報告依頼"

# 品質問題対応
./agent-send.sh quality-director "品質問題緊急対応。[問題詳細]の即座解決依頼"

# システム障害対応
./agent-send.sh integration-director "システム障害対応。[障害内容]の復旧作業開始"
```

### 進捗確認パターン

#### 1. 定期進捗確認
```bash
# 日次進捗確認
./agent-send.sh backend-director "Backend部門日次進捗報告依頼"
./agent-send.sh frontend-director "Frontend部門日次進捗報告依頼"
./agent-send.sh integration-director "Integration部門日次進捗報告依頼"
./agent-send.sh pta-director "PTA部門（MVP核心）日次進捗報告依頼"
./agent-send.sh quality-director "Quality部門日次品質報告依頼"
```

#### 2. 特定課題確認
```bash
# 技術課題確認
./agent-send.sh [director] "[具体的課題]の進捗・解決状況確認依頼"

# 部門間連携確認
./agent-send.sh [director] "[連携先部門]との連携状況確認・調整依頼"
```

## 🗄️ Director 通信パターン

### Worker管理パターン

#### 1. タスク配分指示
```bash
# Backend Director → Backend Worker
./agent-send.sh backend-worker1 "packages/shared-backend/amplify/data/resource.ts GraphQLスキーマ実装開始"
./agent-send.sh backend-worker2 "DynamoDB GSI最適化・Cognito認証統合実装"
./agent-send.sh backend-worker3 "GraphQL Subscription設定・Backend統合テスト実行"

# Frontend Director → Frontend Worker
./agent-send.sh frontend-worker1 "apps/hedge-system Position-Trail-Action UIコンポーネント実装"
./agent-send.sh frontend-worker2 "apps/admin 管理画面Account/Position/Action UI実装"
./agent-send.sh frontend-worker3 "GraphQL Subscriptionリアルタイム表示実装"
```

#### 2. 品質・進捗管理
```bash
# 品質チェック指示
./agent-send.sh [worker] "実装完了時の品質チェック実行。ESLint・TypeScript・テスト確認"

# 進捗確認
./agent-send.sh [worker] "[担当タスク]の進捗状況・完了予定報告依頼"

# 課題サポート
./agent-send.sh [worker] "[技術課題]のサポート提供。解決方法検討・実装支援"
```

### 部門間連携パターン

#### 1. 準備完了通知
```bash
# Backend → Frontend連携
./agent-send.sh frontend-director "Backend GraphQL Schema準備完了。Frontend実装開始可能"

# Frontend → Integration連携
./agent-send.sh integration-director "Frontend WebSocket UI準備完了。MT5データ表示連携開始可能"

# Integration → PTA連携
./agent-send.sh pta-director "MT5連携準備完了。Position実行・Trail監視連携開始可能"
```

#### 2. 課題・サポート要請
```bash
# 技術サポート要請
./agent-send.sh [target-director] "[部門名]から技術サポート要請。[課題内容]への協力依頼"

# 品質支援要請
./agent-send.sh quality-director "[部門名]品質支援要請。[品質課題]への支援依頼"
```

### President報告パターン

#### 1. 進捗報告
```bash
# 定期進捗報告テンプレート
./agent-send.sh president "[部門名]進捗報告:
- Worker1: [進捗状況・担当タスク]
- Worker2: [進捗状況・担当タスク]  
- Worker3: [進捗状況・担当タスク]
- 部門全体状況: [課題・成果・次のステップ]
- 他部門連携: [連携状況・調整事項]"
```

#### 2. 課題・緊急報告
```bash
# 技術課題報告
./agent-send.sh president "[部門名]技術課題報告:
- 課題内容: [具体的技術課題]
- 影響範囲: [他部門・システムへの影響]
- 対策案: [解決案・所要時間・リソース]
- 支援要請: [必要な支援・調整]"
```

## 👷 Worker 通信パターン

### Director報告パターン

#### 1. 作業完了報告
```bash
# タスク完了報告テンプレート
./agent-send.sh [director] "[担当タスク名]実装完了。
- 実装内容: [具体的実装内容]
- 品質確認: [ESLint・TypeScript・テスト結果]
- 次のタスク: [受付可能・待機状況]"
```

#### 2. 課題・質問報告
```bash
# 技術課題報告
./agent-send.sh [director] "[担当タスク]で技術課題発生:
- 課題詳細: [具体的課題内容]
- 試行内容: [既に試した解決方法]
- 支援要請: [必要な支援内容]"

# 他部門連携質問
./agent-send.sh [director] "[連携先部門]との連携で質問:
- 連携内容: [具体的連携事項]
- 現状: [現在の進捗・状況]
- 確認事項: [確認したい内容]"
```

### Worker間連携パターン

#### 1. 情報共有・協力
```bash
# 技術情報共有
./agent-send.sh [worker] "[技術分野]の実装完了。知識・経験共有可能。協力依頼あれば対応"

# 作業分担・協力
./agent-send.sh [worker] "[担当タスク]実装中。[関連分野]での協力・サポート依頼"
```

#### 2. 部門間Worker連携
```bash
# Backend ↔ Frontend Worker連携
./agent-send.sh frontend-worker[N] "Backend GraphQL実装完了。Frontend統合テスト協力可能"

# Frontend ↔ Integration Worker連携
./agent-send.sh integration-worker[N] "Frontend UI実装完了。WebSocket連携テスト協力可能"
```

## 🔄 連携フローパターン

### MVP開発連携フロー

#### 1. Backend → Frontend連携
```bash
# Step 1: Backend準備完了
Backend Director → Frontend Director:
"Backend GraphQL Schema・DynamoDB準備完了。Frontend実装開始可能"

# Step 2: Frontend開始確認
Frontend Director → Backend Director:
"Frontend GraphQL Client準備開始。Schema情報・エンドポイント共有依頼"

# Step 3: 統合テスト
Frontend Worker ↔ Backend Worker:
"GraphQL Subscription接続テスト実行。動作確認協力依頼"
```

#### 2. Integration → PTA連携
```bash
# Step 1: Integration準備完了
Integration Director → PTA Director:
"MT5・WebSocket連携準備完了。Position実行・Trail監視連携開始可能"

# Step 2: PTA核心機能開始
PTA Director → Integration Director:
"MVP核心機能実装開始。MT5実行システム連携テスト依頼"

# Step 3: 実動テスト
Core Worker ↔ Integration Worker:
"Position実行ロジック実装完了。MT5連携動作テスト協力依頼"
```

### 品質保証連携フロー

#### 1. Quality → 各部門支援
```bash
# 品質支援提供
Quality Director → [Target Director]:
"Quality部門から品質支援提供。[支援内容]実行準備完了"

# 品質課題発見・改善提案
Quality Worker → [Target Worker]:
"品質テストで改善点発見。[改善提案]実装支援可能"
```

## 💡 効果的通信ガイドライン

### 🚨 重要な通信原則

#### 1. 明確・具体的なメッセージ
```bash
# ✅ 良い例: 具体的・明確
./agent-send.sh backend-worker1 "packages/shared-backend/amplify/data/resource.ts のUser/Account/Position/Action GraphQLスキーマ実装開始。MVPシステム設計.md「2. データベース設計」参照"

# ❌ 悪い例: 曖昧・不明確
./agent-send.sh backend-worker1 "何かやって"
```

#### 2. 適切な受信者選択
```bash
# ✅ 良い例: 適切なレベル
./agent-send.sh backend-director "Backend部門戦略変更。GraphQL最適化優先"
./agent-send.sh backend-worker1 "resource.tsファイル修正実行"

# ❌ 悪い例: 不適切なレベル
./agent-send.sh backend-worker1 "Backend部門戦略変更"  # Director案件
./agent-send.sh backend-director "resource.tsファイル修正"  # Worker案件
```

#### 3. タイムリーな報告・連携
```bash
# ✅ 即座の報告
作業完了 → 即座にDirector報告
課題発生 → 即座にDirector・関連部門に報告
```

### 通信頻度・タイミング

#### 1. 定期通信
- **日次進捗報告**: 各Director → President
- **作業完了報告**: 各Worker → Director（随時）
- **品質チェック報告**: Quality → 各部門（毎日）

#### 2. 緊急通信
- **技術課題発生**: 即座報告
- **システム障害**: 即座報告・対応依頼
- **MVP核心機能課題**: 最優先報告

---

**通信プロトコル は ArbitrageAssistant 組織運営の基盤であり、効果的な連携・迅速な課題解決・MVP完成への協力体制構築の指針として全エージェントが活用する。**