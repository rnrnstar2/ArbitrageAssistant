# 🚀 ArbitrageAssistant 並列開発環境

## 概要

**シンプルで実用的な** Claude Code マルチウィンドウ並列開発環境です。

## 🎯 設計思想

- ✅ **実際に動作する** tmux + Claude Code 組み合わせ
- ✅ **作業ディレクトリ別分割** で関心事の明確化
- ✅ **CLAUDE.md指示準拠** でタスクベース開発
- ❌ 未実装ツールへの依存を排除

## 🏗️ ウィンドウ構成

```
Window 0: 🏛️CEO-Strategy      (戦略・全体調整)
Window 1: 🗄️Backend-AWS       (AWS Amplify + GraphQL)
Window 2: ⚡Trading-Engine    (アービトラージエンジン)
Window 3: 🔌Integration-MT5   (MT5 + WebSocket)
Window 4: 🎨Frontend-UI       (React + Tauri)
Window 5: 🚀DevOps-CI         (CI/CD + 品質保証)
Window 6: 📚Docs-Analysis     (文書・分析)
Window 7: 🔧Support-Monitor   (サポート・監視)
```

## 🚀 使用方法

### 1. 起動
```bash
npm run claude:start
```

### 2. 操作
```bash
# ウィンドウ切り替え
Ctrl+b + 0-7

# デタッチ（バックグラウンド実行）
Ctrl+b + d

# 再アタッチ
tmux attach -t arbitrage-assistant

# 終了
npm run claude:clean
```

## 📋 各ウィンドウの役割

### Window 0: 🏛️CEO-Strategy
- **作業ディレクトリ**: `/Users/rnrnstar/github/ArbitrageAssistant`
- **責任範囲**: 戦略・全体調整・プロジェクト管理
- **主な作業**: MVPシステム設計.md参照、全体統合

### Window 1: 🗄️Backend-AWS
- **作業ディレクトリ**: `packages/shared-backend`
- **責任範囲**: AWS Amplify Gen2 + GraphQL
- **主な作業**: data/resource.ts実装、Cognito認証

### Window 2: ⚡Trading-Engine
- **作業ディレクトリ**: `apps/hedge-system`
- **責任範囲**: アービトラージエンジン
- **主な作業**: hedge-system-core.ts実装、ポジション管理

### Window 3: 🔌Integration-MT5
- **作業ディレクトリ**: `ea`
- **責任範囲**: MT5統合・WebSocket通信
- **主な作業**: HedgeSystemConnector.mq5実装

### Window 4: 🎨Frontend-UI
- **作業ディレクトリ**: `apps/admin`
- **責任範囲**: 管理画面・UI/UX
- **主な作業**: ダッシュボード実装、リアルタイム表示

### Window 5: 🚀DevOps-CI
- **作業ディレクトリ**: `/Users/rnrnstar/github/ArbitrageAssistant`
- **責任範囲**: CI/CD・品質保証・ビルド最適化
- **主な作業**: GitHub Actions設定、Turborepo最適化

### Window 6: 📚Docs-Analysis
- **作業ディレクトリ**: `mds`
- **責任範囲**: 文書・分析・設計
- **主な作業**: 技術仕様書作成、アーキテクチャ分析

### Window 7: 🔧Support-Monitor
- **作業ディレクトリ**: `/Users/rnrnstar/github/ArbitrageAssistant`
- **責任範囲**: サポート・監視・デバッグ
- **主な作業**: ログ分析、パフォーマンス監視

## 🎯 並列開発のベストプラクティス

### 1. タスクベース開発
```bash
# tasks/ディレクトリでタスク管理
tasks/
├── task-1.md        # 直列タスク
├── task-2-1.md      # 並列タスク2-1
├── task-2-2.md      # 並列タスク2-2
└── README.md        # 実行手順
```

### 2. 品質チェック
```bash
# 作業完了時のみ実行
npm run lint
npm run type-check
npm run build
```

### 3. 通知システム
```bash
# 作業完了通知
osascript -e 'display notification "作業完了" with title "ArbitrageAssistant" sound name "Glass"'
```

## 🔧 トラブルシューティング

### セッションが残っている場合
```bash
npm run claude:clean
npm run claude:start
```

### Claude Codeが起動しない場合
```bash
# 各ウィンドウで手動実行
claude
```

## 📖 関連ドキュメント

- **CLAUDE.md**: 開発コマンド・品質基準
- **arbitrage-assistant.yaml**: アーキテクチャ参考（実装済み）
- **mds/MVPシステム設計.md**: 実装仕様書