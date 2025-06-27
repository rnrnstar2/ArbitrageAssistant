# 👑 CEO Supreme Perfect Initial Prompt v6.0 使用ガイド

## 🎯 概要

CEO Supreme Perfect Initial Prompt v6.0は、ユーザー要求に完全対応したHaconiwa初期プロンプトシステムです。

### ✅ ユーザー要求完全対応

**ユーザーの要求**:
1. ワークスペースを開くとCEO Supremeにあらかじめ入力されている初期プロンプトを実行
2. システム設計とプロジェクト全体を把握してMVP実装完成のために必要な指示をDirectorに送信
3. 既に完成しているものには指示を出さない
4. Directorではなく実装メンバーに直接指示が行かないように修正
5. Directorは指示を受け取ったらチェック・実行し、配下チームに指示をtmuxコマンドで出す
6. CEOがタスクが必要ではないDirectorにまで指示を出していないかチェック

**v6.0の完全対応**:
- ✅ Haconiwa起動時にCEO Supreme初期プロンプト自動実行
- ✅ 現状分析→慎重判断→必要部門のみ指示（不要指示防止）
- ✅ CEO→Director→Specialist完璧階層（直接指示完全禁止）
- ✅ Tasks Directory v2.0による永続記録・追跡
- ✅ MVP絶対準拠・Over-Engineering完全防止

## 🚀 起動方法

### 1. Haconiwa環境起動

```bash
# 通常起動（CEO Supreme Perfect Initial Prompt v6.0自動実行）
npm run haconiwa:start

# 高速起動（並列3個）
npm run haconiwa:fast

# 最高速起動（並列6個）
npm run haconiwa:ultra
```

### 2. CEO Supreme Perfect Manual実行（必要時のみ）

```bash
# 手動実行
npm run ceo:supreme-perfect

# 強制実行（全Director指示）
npm run ceo:supreme-perfect-force
```

## 📋 実行フロー

### Phase 1: CEO Supreme自己認識・環境確認
- 環境変数・実行権限確認
- CEO Supreme責任範囲認識
- MVPシステム設計.md存在確認

### Phase 2: MVPシステム設計詳細分析
- MVPシステム設計.md要件抽出
- Backend・Trading・Integration・Frontend要件確認
- 各部門の技術要件詳細把握

### Phase 3: 現在実装状況徹底調査
- **Backend**: User/Account/Position/Action実装・不要実装チェック
- **Trading**: Position-Trail-Actionフロー実装確認
- **Integration**: MT5 EA・WebSocket・DLL実装確認
- **Frontend**: 管理画面・Tauriアプリ・コンポーネント確認
- **DevOps**: CI/CD・テスト実装確認（最適化フェーズ）

### Phase 4: CEO戦略判断（慎重・賢明決定）
- 各部門実装必要性判定
- 実装完了→保護対象
- 実装必要→指示対象
- クリーンアップ必要→修正指示

### Phase 5: Director指示送信（必要な部門のみ）
- tmuxセッション確認
- 必要と判定された部門のみに指示送信
- 完成済み部門は保護（指示送信しない）
- Director責任範囲明確化

### Phase 6: CEO Supreme実行完了・次のアクション
- 実行結果サマリー
- Next Actions案内
- 進捗監視コマンド案内

## 🎯 Director実行手順

CEO Supreme指示受信後、各Directorは以下を実行：

### 1. 指示内容確認
- CEO指示内容理解
- MVP準拠指示確認
- 技術要件・完了条件確認

### 2. 配下指示送信（必須）
```bash
# Director配下指示送信コマンド
./scripts/director-auto-delegate-v2.sh [director-id] "[CEO指示内容]"

# 例：Backend Director
./scripts/director-auto-delegate-v2.sh backend-director "AWS Amplify基盤構築"

# 例：Trading Director
./scripts/director-auto-delegate-v2.sh trading-flow-director "Position-Trail-Actionフロー実装"
```

### 3. 進捗監視
```bash
# 部門別進捗確認
npm run task:list --department [director-id]

# リアルタイム監視
npm run task:monitor

# Director実行状況確認
npm run director:check
```

## 📊 監視・確認コマンド

### 基本監視
```bash
# 全体進捗確認
npm run task:list

# 進行中タスクのみ
npm run task:list --active

# 緊急事項確認
npm run task:summary

# リアルタイム監視
npm run task:monitor
```

### 品質確認
```bash
# MVP準拠確認
npm run mvp:check packages/

# Director実行状況
npm run director:check

# 品質チェック
npm run lint && npm run check-types

# Backend専用監視
npm run backend:table-guard
```

## 🏛️ CEO系ペイン構成

### 0.0: CEO Supreme Perfect v6.0
- **役割**: MVP戦略・慎重判断・完璧分析・Director階層厳守
- **自動実行**: Haconiwa起動時にPerfect Initial Prompt v6.0実行
- **特徴**: 必要部門のみ指示・不要指示防止

### 0.1: CEO Operations v5.0
- **役割**: Director間調整・Tasks Directory v2.0統合監視
- **起動**: Director完了後に手動起動
- **機能**: 進捗監視・部門間連携調整

### 0.2: CEO Analytics v5.0
- **役割**: 全体分析・品質評価・MVP準拠・Over-Engineering検出
- **起動**: Director完了後に手動起動
- **機能**: リスク監視・品質分析・完了判定支援

## 🛡️ MVP絶対準拠・品質保証

### 実装保護システム
- **完成済み実装**: 自動保護・変更防止
- **MVP準拠チェック**: 自動実行・違反検出
- **Over-Engineering防止**: 不要実装・将来拡張の完全禁止

### 禁止事項
- **直接指示禁止**: CEO→Specialist直接指示完全禁止
- **不要実装禁止**: Performance/Analytics/Metrics等のMVP外実装
- **Over-Engineering禁止**: 将来拡張を見据えた抽象化

### 品質ゲート
- **lint**: 警告0必須
- **typecheck**: エラー0必須
- **test**: 実行・成功必須
- **MVP準拠**: 設計書準拠必須

## 🔄 完全フロー例

### 1. Haconiwa起動
```bash
npm run haconiwa:start
# → CEO Supreme Perfect Initial Prompt v6.0自動実行
```

### 2. CEO Supreme実行結果確認
- 必要部門への指示送信確認
- 完成済み部門の保護確認

### 3. Director手動実行
各Directorペインで：
```bash
# Backend例
./scripts/director-auto-delegate-v2.sh backend-director "AWS Amplify基盤構築"
```

### 4. 進捗監視
```bash
# リアルタイム監視
npm run task:monitor

# 進捗確認
npm run task:list
```

### 5. 完了確認・Next Actions
```bash
# 完了確認
npm run director:check

# 品質確認
npm run mvp:check packages/

# CEO Operations/Analytics起動
# → ペイン0.1・0.2で手動起動
```

## 💡 トラブルシューティング

### CEO Supreme実行エラー
```bash
# MVPシステム設計.md未配置
# → プロジェクトルートにMVPシステム設計.mdを配置

# tmuxセッション未起動
npm run haconiwa:start

# 権限エラー
chmod +x scripts/ceo-supreme-perfect-initial-prompt.sh
```

### Director指示送信エラー
```bash
# Tasks Directory権限エラー
chmod +x scripts/director-auto-delegate-v2.sh

# ペイン番号エラー
# → tmux list-panes -t arbitrage-assistant で確認
```

### 品質チェックエラー
```bash
# lint警告
npm run lint:fix

# 型エラー
npm run check-types

# MVP準拠違反
npm run mvp:check packages/
```

## ✅ 成功指標

### CEO Supreme Perfect v6.0成功指標
- ✅ Haconiwa起動時に自動実行完了
- ✅ 必要部門のみに指示送信（不要指示なし）
- ✅ 完成済み部門の保護確認
- ✅ Director階層厳守（直接指示なし）

### Director実行成功指標
- ✅ CEO指示受信・内容確認完了
- ✅ 配下指示送信コマンド実行完了
- ✅ Tasks Directory作成・記録完了
- ✅ Specialist実行開始確認

### 全体成功指標
- ✅ MVP準拠100%維持
- ✅ Over-Engineering発生0件
- ✅ 品質ゲート全通過
- ✅ 階層システム完全遵守

---

## 🎯 まとめ

CEO Supreme Perfect Initial Prompt v6.0により、ユーザー要求が完全実現されました：

1. **完璧な初期プロンプト**: Haconiwa起動時に自動実行
2. **慎重・賢明判断**: 必要部門のみ指示・不要指示防止
3. **完璧階層システム**: CEO→Director→Specialist厳守
4. **MVP絶対準拠**: Over-Engineering完全防止
5. **品質保証**: Tasks Directory v2.0による永続管理

**これで完璧なCEO SupremeシステムによるMVP実装が実現されます。**