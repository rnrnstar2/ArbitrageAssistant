# 🚀 Haconiwa (箱庭) 開発環境 完全ガイド

## 📋 概要

Haconiwa (箱庭) は ArbitrageAssistant 専用のマルチウィンドウClaude Code開発環境です。8つのウィンドウで並列開発を実現し、効率的なチーム協力を可能にします。

## 🛠️ コマンド

### 基本操作

```bash
# 🆕 推奨: Haconiwa環境
npm run haconiwa:start  # 8ウィンドウ環境起動
npm run haconiwa:stop   # 安全な環境終了
```

## 📋 ウィンドウ構成

| Window | 名前 | 役割 | ディレクトリ |
|--------|------|------|-------------|
| 0 | 🏛️CEO-Strategy | 戦略・全体調整 | `/ArbitrageAssistant` |
| 1 | 🗄️Backend-AWS | AWS Amplify + GraphQL | `/packages/shared-backend` |
| 2 | ⚡Trading-Engine | アービトラージエンジン | `/apps/hedge-system` |
| 3 | 🔌Integration-MT5 | MT5 + WebSocket | `/ea` |
| 4 | 🎨Frontend-UI | React + Tauri | `/apps/admin` |
| 5 | 🚀DevOps-CI | CI/CD + 品質保証 | `/ArbitrageAssistant` |
| 6 | 📚Docs-Analysis | 文書・分析 | `/mds` |
| 7 | 🔧Support-Monitor | サポート・監視 | `/ArbitrageAssistant` |

## 🎯 推奨ワークフロー

### 1. 環境起動
```bash
npm run haconiwa:start
```

### 2. 開発作業
```bash
# tmuxセッションに接続済みの状態で作業
# Ctrl+b + 0-7 でウィンドウ切り替え
```

### 3. 安全な終了
```bash
# 各ウィンドウでClaude Code正常終了後
npm run haconiwa:stop
```

## ⚡ クイックアクセス

```bash
# セッションアタッチ
tmux attach -t arbitrage-assistant

# デタッチ
Ctrl+b + d

# ウィンドウ切り替え
Ctrl+b + 0-7

# セッション確認
tmux list-sessions
```

## 🏗️ アーキテクチャ連携

### Haconiwa CRD設計との関係

本環境は `/arbitrage-assistant.yaml` のCRD設計と連携しています：

- **Organization CRD**: 6部署の役割定義
- **Space CRD**: 6x3 Grid構成 (18ペーン)
- **Task CRD**: MVPタスクの具体的実装

### 開発者の役割分担

| ウィンドウ | CRD対応 | 主要責任 |
|----------|---------|----------|
| CEO | Executive Department | 戦略決定・指示出し |
| Backend | Backend Department | GraphQL・AWS実装 |
| Trading | Trading Department | アービトラージロジック |
| Integration | Integration Department | MT5・WebSocket連携 |
| Frontend | Frontend Department | UI・UX実装 |
| DevOps | DevOps Department | CI/CD・品質管理 |

## 🔧 トラブルシューティング

### 環境が正常に起動しない場合

1. **既存セッション確認**
   ```bash
   tmux list-sessions
   ```

2. **手動終了**
   ```bash
   tmux kill-session -t arbitrage-assistant
   ```

3. **再起動**
   ```bash
   npm run haconiwa:start
   ```

### Claude Code初期化された場合

1. **Trust Dialog再承認**
   - 各ウィンドウで改めてツール使用許可
   
2. **プロジェクト設定復元**
   - `.claude/settings.local.json` 確認

## 💡 ベストプラクティス

1. **必ず安全なコマンドを使用**
   - `haconiwa:start` / `haconiwa:stop`

2. **各ウィンドウの役割を理解**
   - CEO: 全体戦略と指示出し
   - 各部署: 専門領域での実装

3. **正常終了の習慣化**
   - 各ウィンドウで Ctrl+C で正常終了
   - 必ず `haconiwa:stop` でクリーンアップ

4. **CRD設計との整合性維持**
   - `arbitrage-assistant.yaml` との連携確認
   - Task CRDに基づいた作業分担

## 🚀 高度な使用方法

### Haconiwa Apply連携
```bash
# CRD設定適用後の環境起動
haconiwa apply -f arbitrage-assistant.yaml
npm run haconiwa:start
```

### 並列タスク実行
- 各ウィンドウで独立したブランチ作業
- Git worktreeによる並列開発
- リアルタイム進捗共有

## 📝 関連ファイル

- `arbitrage-assistant.yaml` - Haconiwa CRD設計
- `.haconiwa/README.md` - Haconiwaベストプラクティス
- `scripts/haconiwa-start.sh` - 起動スクリプト
- `scripts/haconiwa-stop.sh` - 終了スクリプト