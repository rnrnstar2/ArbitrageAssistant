# ArbitrageAssistant Haconiwa ワークスペース

## 🚀 1コマンド完全自動起動

### 🎯 推奨：完全統合起動

```bash
# 🚀 1コマンドで完全なワークスペース起動（推奨）
npm run start:haconiwa
```

### 📋 個別ステップ実行（トラブル時）

```bash
# Step 1: Haconiwa環境構築（tmux + 組織構造）
npm run setup:haconiwa

# Step 2: Claude Code全起動 + CEO指示送信
npm run start:claude
```

### トラブル時の対処

```bash
# tmuxセッション再作成
tmux kill-session -t arbitrage-assistant
npm run setup:haconiwa
npm run start:claude
```

## 🎯 自動構築内容

### 1. Haconiwa組織構造
- **CEO Executive Office**: 戦略的意思決定・全体指揮
- **Backend Architecture**: AWS Amplify Gen2 + GraphQL + userId最適化
- **Trading Systems**: アービトラージエンジン + ポジション管理
- **Integration Systems**: MT5統合 + WebSocket通信
- **Frontend Experience**: Admin Dashboard + Tauri Desktop UI
- **DevOps & QA**: Turborepo最適化 + 品質保証

### 2. tmuxマルチウィンドウ環境
```
Window 0: 🏛️ CEO Executive Office
Window 1: 🗄️ Backend Architecture Room
Window 2: ⚡ Trading Systems Room
Window 3: 🔌 Integration Systems Room
Window 4: 🎨 Frontend Experience Room
Window 5: 🚀 DevOps & QA Room
Window 6: 📊 Quality Assurance
```

### 3. 自動実行プロセス
1. **Haconiwa環境構築**: YAML設定からtmux環境自動生成
2. **Claude Code起動**: 全7ウィンドウで並列Claude Code実行
3. **CEO戦略指示**: 各Directorに具体的開発指示自動送信
4. **MVP方針浸透**: 不要機能禁止・最速動作優先の徹底
5. **品質基準設定**: ESLint 0 warnings・型チェック・パフォーマンス要件

## 🎖️ MVP最優先方針

### 🚨 絶対遵守事項
- ❌ **MVPに不要な機能実装は絶対禁止**
- ✅ **最速で動作する状態を最優先**
- ✅ MVPシステム設計書v7.0記載機能のみ実装
- ✅ 「あったら良い」機能は後回し・実装禁止
- ✅ 完璧より動作することを重視

### 📋 各部門の役割

#### Backend Director
- `packages/shared-backend/amplify/data/resource.ts` 基本CRUD実装
- userIdベースGSI設定（検索50ms以内）
- 認証システム基本構築

#### Trading Director
- `apps/hedge-system/lib/hedge-system-core.ts` 基本取引機能
- PENDING→OPENING→OPEN状態遷移実装
- 金融計算精度小数点5桁確保

#### Integration Director
- `ea/HedgeSystemConnector.mq5` MT5統合基本実装
- WebSocket基本接続
- 基本取引実行機能

#### Frontend Director
- `apps/admin/app/dashboard/page.tsx` 管理画面基本実装
- アカウント・ポジション一覧表示
- リアルタイム更新基本機能

#### DevOps Director
- 基本ビルド・テスト環境構築
- ESLint 0 warnings確保
- 品質チェック最小限

## 📱 tmux操作

### 基本操作
```bash
# ウィンドウ移動
Ctrl+B → 0    # CEO Executive Office
Ctrl+B → 1    # Backend Architecture Room
Ctrl+B → 2    # Trading Systems Room
Ctrl+B → 3    # Integration Systems Room
Ctrl+B → 4    # Frontend Experience Room
Ctrl+B → 5    # DevOps & QA Room

# ウィンドウ一覧表示
Ctrl+B → w    # ウィンドウ一覧選択モード
Ctrl+B → q    # ウィンドウ番号一時表示
```

### ウィンドウ一覧選択モード（Ctrl+B → w）
```bash
# 選択モード内操作
↑↓矢印キー      # ウィンドウ選択移動
Enter          # 選択したウィンドウに移動
Esc または q    # 選択モード終了（元の画面に戻る）
Ctrl+C         # 選択モード強制終了
```

### セッション管理
```bash
# セッション確認
tmux list-sessions
tmux list-windows -t arbitrage-assistant

# セッション操作
Ctrl+B → d     # セッションをデタッチ（バックグラウンド実行）
tmux attach-session -t arbitrage-assistant  # セッション再アタッチ

# セッション終了
tmux kill-session -t arbitrage-assistant
```

## 🔧 トラブルシューティング

### Haconiwaが見つからない場合
```bash
# Haconiwaインストール確認
python3 -m pip install haconiwa --upgrade

# パス確認
which haconiwa
/Users/rnrnstar/Library/Python/3.9/bin/haconiwa --version
```

### tmuxセッションが作成されない場合
```bash
# tmuxインストール確認
brew install tmux

# 既存セッション削除
tmux kill-session -t arbitrage-assistant

# 再実行
npm run setup:haconiwa
npm run start:claude
```

### Claude Codeが起動しない場合
```bash
# Claude Code確認
claude --version

# 手動で各ウィンドウ起動
for i in {0..5}; do
  tmux send-keys -t arbitrage-assistant:$i 'claude --dangerously-skip-permissions' Enter
done
```

## 🎉 開発効果

### 並列開発体制
- **CEO**: 戦略的意思決定・品質管理
- **5 Directors**: 部門別技術リーダーシップ
- **11 Engineers**: 専門分野実装

### MVP完成目標
- **Phase 1**: 基盤実装完了
- **Phase 2**: 統合テスト完了
- **MVP完成**: 全機能動作確認

### 品質保証
- ESLint: 0 warnings必須
- TypeScript: 0 errors必須
- パフォーマンス: userIdベース検索50ms以内
- 金融計算: 小数点以下5桁精度

## 💡 ultrathink実行

全指示は `ultrathink` で終了し、深い思考による品質最大化を実現します。

---

**🎖️ 1コマンドで最速MVP開発環境完成！**