# 🎯 Haconiwaペイン内完結ワークフロー

## ✅ あなたの理想ワークフロー実現

### 🚀 基本フロー（超シンプル）

```bash
# 1. Haconiwa起動
npm run haconiwa:start

# 2. 任意のペインで初期設定（1回のみ）
./scripts/pane-quick-setup.sh

# 3. CEO戦略実行（メイン作業）
ceo

# 4. 進捗確認（必要時）
progress
```

### 🔄 コンテキスト重い時のリフレッシュ

```bash
# 外部で実行
npm run haconiwa:refresh

# ↓ 各ペインで自動復旧される
# （何もする必要なし - 自動でpane-quick-setup.sh実行済み）

# 戦略再開
ceo
```

## 🎯 ペイン内で使える便利コマンド

### 🏛️ CEO系（最重要）
```bash
ceo          # CEO戦略実行（これだけ覚えればOK！）
strategic    # 同上
```

### 🎯 Director個別指示
```bash
backend "AWS Amplify基盤構築"       # Backend Director指示
trading "Position-Trail実装"       # Trading Director指示  
integration "MT5統合"              # Integration Director指示
frontend "管理画面実装"             # Frontend Director指示
devops "CI/CD最適化"               # DevOps Director指示
```

### 📊 監視・確認
```bash
progress     # 進捗確認
status       # 同上
task_list    # アクティブタスク一覧
mvp_check    # MVP準拠チェック
quick_lint   # 高速Lint
```

### 🔧 ユーティリティ
```bash
role         # 役割確認・復旧
restore      # 同上  
phelp        # ヘルプ
broadcast "メッセージ"  # 全体通知
```

## 💡 実際の使い方例

### シナリオ1: 朝の開発開始
```bash
# ペイン内で
ceo          # 戦略実行
progress     # 進捗確認
```

### シナリオ2: 個別タスク指示
```bash
# ペイン内で
backend "GraphQL最適化してください"
trading "リスク管理を強化してください"  
```

### シナリオ3: 問題発生時
```bash
# ペイン内で
progress                    # 現状確認
backend "エラー調査してください"  # 問題解決指示
broadcast "緊急対応中"        # チーム通知
```

## ⭐ 超効率Tips

### 最も重要な3コマンド
1. **`ceo`** - CEO戦略実行（毎日使用）
2. **`progress`** - 進捗確認（随時使用）
3. **`role`** - 困った時の復旧（問題発生時）

### 外部コマンド（必要時のみ）
- `npm run haconiwa:start` - 初回起動
- `npm run haconiwa:refresh` - コンテキストリフレッシュ

## 🎉 利点

✅ **ペイン内で全て完結** - 外部コマンドほぼ不要
✅ **refresh後も自動復旧** - 設定し直し不要
✅ **シンプルなコマンド** - `ceo`だけ覚えればOK
✅ **直感的な操作** - backend "タスク" で即指示
✅ **永続的タスク管理** - Tasks Directory自動統合

この設計により、あなたの理想的なワークフローが完全に実現されました！