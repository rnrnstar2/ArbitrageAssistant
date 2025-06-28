# Haconiwa実装方式変更メモ

## 🔄 実装方式の変更（2025-06-26）

### 変更前: 手動tmux方式
```bash
npm run haconiwa:start     # ./scripts/haconiwa-start.sh
npm run haconiwa:stop      # ./scripts/haconiwa-stop.sh  
npm run haconiwa:status    # ./scripts/haconiwa-status.sh
```

### 変更後: 公式haconiwa方式
```bash
npm run haconiwa:start     # haconiwa apply + space run --claude-code
npm run haconiwa:stop      # haconiwa space stop
npm run haconiwa:status    # haconiwa space list
npm run haconiwa:attach    # haconiwa space attach
```

## 📁 バックアップファイル

手動tmux方式は以下として保存済み：
- `scripts/haconiwa-manual-tmux-start.sh` (元: haconiwa-start.sh)
- `scripts/haconiwa-manual-tmux-stop.sh` (元: haconiwa-stop.sh)
- `scripts/haconiwa-manual-tmux-status.sh` (元: haconiwa-status.sh)

```bash
# 手動tmux方式を使用する場合
npm run haconiwa:manual:start
npm run haconiwa:manual:stop
npm run haconiwa:manual:status
```

## 🔧 環境変数設定の実験

### arbitrage-assistant.yamlに追加された項目

1. **agentDefaults環境変数** (実験的):
```yaml
agentDefaults:
  environment:
    variables:
      HACONIWA_ENVIRONMENT: "arbitrage-assistant"
      HACONIWA_MVP_MODE: "true"
```

2. **Organization CRD role環境変数** (実験的):
```yaml
roles:
  - roleType: "management"
    agentId: "ceo-supreme"
    environment:
      HACONIWA_ROLE: "CEO系エージェント"
      HACONIWA_AGENT_ID: "ceo-supreme"
      HACONIWA_ROOM: "room-ceo"
```

## ❌ 公式haconiwa方式の問題点

### 確認済み問題
- ❌ **Window数制限**: 期待した6x3 Grid構成が実現できない（2 windowのみ）
- ❌ **エージェント配置**: 18エージェントの細かい配置ができない
- ❌ **環境変数**: 個別エージェントの役割認識設定が困難

### 結論
- ❌ 公式haconiwa方式は現在のMVP要件に適さない
- ✅ **手動tmux方式を採用継続**

## 🚀 使用方法

### 手動tmux方式（採用）
```bash
# 1. 6x3 Grid環境起動（18エージェント）
npm run haconiwa:start

# 2. 状況確認
npm run haconiwa:status

# 3. 役割認識テスト
./scripts/haconiwa-role-test.sh

# 4. 停止
npm run haconiwa:stop
```

### 各エージェントでの役割確認
```bash
# 各ペインで実行
echo "ROLE: $HACONIWA_ROLE"
echo "AGENT_ID: $HACONIWA_AGENT_ID"  
echo "ROOM: $HACONIWA_ROOM"
```

## 🎯 期待される改善点

1. **宣言的設定**: YAMLファイルで全設定管理
2. **公式サポート**: haconiwaの標準機能使用
3. **CRD-Based**: より構造化されたアプローチ
4. **スケーラビリティ**: 新しいエージェント追加が容易

## ⚠️ 注意点

1. **環境変数**: 公式サポートの確認が必要
2. **設定検証**: 実際の動作確認が必要  
3. **フォールバック**: 手動tmux方式を保持
4. **Migration**: 段階的に移行推奨

## 📋 TODO

- [x] ~~公式haconiwa方式検証~~ → **手動tmux方式採用決定**
- [ ] 手動tmux方式の環境変数設定動作確認
- [ ] Claude Code役割認識の検証・改善
- [ ] 各Directorタスクファイル作成（Backend, Trading, Integration, Frontend, DevOps）
- [ ] MVPシステム設計.mdとの連携強化
- [ ] 必要に応じて追加エージェント役割の実装