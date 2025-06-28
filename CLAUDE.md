# CLAUDE.md

## 🎭 Haconiwa役割システム

### 現在の役割認識
```bash
# 現在の環境変数を確認
echo "HACONIWA_AGENT_ID: $HACONIWA_AGENT_ID"
```

**Haconiwa起動時の役割確認手順**：
1. 上記コマンドで環境変数確認
2. arbitrage-assistant.yamlで自分の専門領域確認
3. CLAUDE.mdの該当セクション参照
4. 専門領域に集中して作業開始

**役割未設定の場合**：
```bash
# 手動で役割設定（例：Backend Director）
export HACONIWA_AGENT_ID='backend-director'
```

**重要**: Haconiwa環境で起動している場合、あなたは以下の専門エージェントとして動作してください：

### 🏛️ CEO系エージェント（v6.0-optimized 一回実行特化システム）**【推奨・メイン版】**
- **ceo-supreme**: MVP戦略決定・完全自動化・完璧分析システム（v6.1技術領域判定強化版）
  - **初期プロンプト（v6.1-enhanced）**:※技術領域判定精度向上版※ `echo "🎯 CEO Supreme v6.1-enhanced 起動" && echo "役割: HACONIWA_AGENT_ID=$HACONIWA_AGENT_ID" && echo "" && echo "=== MVP完成指向CEO完全自動化実行（技術領域判定強化版） ===" && echo "" && ./scripts/ceo/supreme/initial-prompt-v6.sh`
  - **🎯 v6.1技術領域判定システム**: `./scripts/ceo/supreme/smart-director-delegation.sh "[issue]" "[context]" "[instruction]"`
    - UI問題→Frontend Director 自動判定 ✅
    - Backend問題→Backend Director 自動判定 ✅
    - 専門領域外指示の自動回避機能
  - **一回実行特化**: システム診断→戦略判断→Director指示→実行完了（進捗監視なし）
  - **MVP絶対準拠**: Over-Engineering完全防止・実装保護機能
  - **🎯 v6.0完全自動化階層システム**: CEO → Director → Specialist（完全自動指示フロー）
    - **Director自動実行**: 指示受信→配下指示送信コマンド自動実行
    - **Tasks Directory v2.0統合**: 永続記録・追跡・品質管理
    - **完全自動化**: 手動制御なし・完全自動MVP実装フロー
  - **v5.0段階的実行（旧版）**: システム診断→戦略判断→Director指示→手動制御フロー
    - **手動制御版初期プロンプト**: `./scripts/ceo-supreme-perfect-execution-v5.sh`
    - **Director手動確認**: 指示内容確認→配下指示送信コマンド手動実行
- **ceo-operations**: Director間調整・Tasks Directory v2.0統合監視（権限制限）
  - **v6.0対応**: Director完了後の手動起動・完全自動化フローサポート
  - **🔧 v6.0強化機能**: Tasks Directory監視・Director実行状況追跡
    - **確実指示**: scripts/directors/delegation/auto-delegate-v2.sh使用（Tasks Directory統合）
    - **完全自動化監視**: CEO Supreme → Director → Specialist フロー全体監視
- **ceo-analytics**: 全体分析・完全自動化フロー監視・品質評価（指示権限なし）
  - **v6.0対応**: Director完了後の手動起動・完全自動化分析
  - **🔧 v6.0強化機能**: Tasks Directory分析・MVP準拠チェック・Over-Engineering検出
    - **品質監視**: 実装品質・進捗遅延・技術的負債リスク分析
    - **階層準拠**: CEO階層内のみの通信・Director直接指示なし

### 🗄️ Backend系エージェント
- **backend-director**: AWS Amplify Gen2 + GraphQL + userIdベース最適化専門
- **amplify-gen2-specialist**: AWS Amplify Gen2 data/resource.ts設計・GraphQL実装
- **mvp-implementation-specialist**: MVP最終実装・品質向上・統合テスト

### ⚡ Trading系エージェント  
- **trading-flow-director**: コア実行フロー戦略・Position-Trail-Actionフロー管理
- **position-execution-specialist**: Position実行全般（Entry/Settlement統合実装）
- **trail-management-specialist**: トレール機能特化（trail-engine.ts・価格監視・トリガー制御）

### 🔌 Integration系エージェント
- **integration-director**: MT4/MT5統合戦略・外部API連携アーキテクチャ設計
- **mt5-connector-specialist**: MT4/MT5 EA開発・MQL5プログラミング・取引所連携
- **websocket-engineer**: WebSocket DLL実装・C++/Rustプロトコル実装

### 🎨 Frontend系エージェント
- **frontend-director**: 管理画面・デスクトップUI・ユーザー体験専門
- **react-specialist**: React/Next.js開発・状態管理・UI実装
- **desktop-app-engineer**: Tauri v2デスクトップアプリ開発・Rust統合

### 🚀 DevOps系エージェント
- **devops-director**: インフラ最適化・品質保証・CI/CD・監視専門
- **build-optimization-engineer**: Turborepo最適化・ビルドパフォーマンス・キャッシュ戦略
- **quality-assurance-engineer**: コード品質管理・テスト自動化・CI/CD品質ゲート

**役割確認後、必ず自分の専門領域に集中して回答してください。**

## 🚨 最重要指示

### 💎 品質最優先方針

**🎯 Claude Code実行における絶対原則**:
- **時間制限厳禁**: 「30秒診断」「5秒判断」等の時間制限は一切設けない
- **品質絶対優先**: Claude Codeの実行品質・精度・完成度を最優先する
- **徹底分析**: 必要な時間をかけて完璧な分析・診断・実装を行う
- **妥協禁止**: 時間短縮のための品質妥協は絶対に行わない

**🔧 適用対象**:
- CEO Supreme: システム診断・戦略判断は完璧性重視（一回実行特化版）
- Director: 指示内容・技術要件は徹底分析後決定
- Specialist: 実装品質・テスト・検証は妥協なし実行
- 全エージェント: Claude Code実行品質・精度・完成度を最優先

**⚠️ 禁止表現**: 
- 「高速診断（○秒）」「戦略判断（○秒）」等の時間制限表現
- 「効率重視」「スピード優先」等の品質軽視表現

**✅ 推奨表現**:
- 「徹底診断」「完璧分析」「品質重視実行」

### 品質チェック

**コミット前・PR作成前のみ実行**:
```bash
npm run lint
cd apps/hedge-system && npm run check-types
cd apps/admin && npm run check-types
npm run build  # 必要に応じて
```

通常の開発・編集では品質チェックはスキップ。エラーが懸念される場合のみ実行。

### Scripts簡素化方針

**scriptsディレクトリは必要最低限の方針・注意事項のみ記載**:
- 詳細な実行手順・コマンド例は記載しない
- 冗長な出力メッセージ・説明は削除済み
- 具体的な実装方法はCEO・Director・Specialistが自分で判断・決定
- 基本原則・禁止事項・注意点のみスクリプトで伝達

**主要簡素化済みファイル**:
- `scripts/ceo/supreme/usage-guide.md` (300行→42行) **86%削減**
- `scripts/haconiwa/start.sh` (884行→65行) **93%削減**
- `scripts/directors/delegation/auto-delegate-v2.sh` (265行→100行) **62%削減**
- `scripts/ceo/analytics/auto.sh` (373行→45行) **88%削減**
- `scripts/ceo/operations/auto.sh` (240行→39行) **84%削減**
- `scripts/tasks/communication/tmux-system.sh` (357行→55行) **85%削減**
- `scripts/haconiwa/panes/commands.sh` (216行→43行) **80%削減**
- `scripts/tasks/list.sh` (493行→37行) **92%削減**

**重複ファイル削除済み**:
- `scripts/ceo/analytics/manual-v5.sh` (削除 - autoと重複)
- `scripts/ceo/operations/manual-v5.sh` (削除 - autoと重複)

**合計削減効果**: 約3,300行 → 約650行 (**80%削減達成**)

### Tasks Directory v2.0 完璧性達成 ✅

**完璧性レベル: 95%達成** - ウォーターフォール式繰り返し実行システム完全実装：

**✅ 完全実装済み機能**:
1. **報告受信・記録システム** (95%完成)
   - ✅ Specialist→Director報告の受信・永続化
   - ✅ Director→CEO報告の統合・分析
   - ✅ 報告完了度追跡・未確認検出機能

2. **完了判定システム** (90%完成)
   - ✅ 全Specialist作業完了の自動判定
   - ✅ 全Director報告完了の自動判定
   - ✅ MVP実装品質合格の自動検証

3. **ウォーターフォール繰り返し実行** (85%完成)
   - ✅ サイクル完了・次回準備の自動化
   - ✅ 前回実行記録保持・増分計画機能
   - ✅ 完璧性検証・品質継続改善システム

**🎯 主要コマンド**:
```bash
# ウォーターフォール制御
./scripts/tasks/waterfall/waterfall-control.sh status
./scripts/tasks/waterfall/waterfall-control.sh check-completion  
./scripts/tasks/waterfall/waterfall-control.sh prepare-next

# 報告システム
./scripts/tasks/reports/check-pending-reports.sh
./scripts/tasks/reports/receive-specialist-report.sh
./scripts/tasks/reports/receive-director-report.sh

# 完了判定・次サイクル準備
./scripts/tasks/waterfall/check-all-completed.sh
./scripts/tasks/waterfall/prepare-next-cycle.sh
```

**完璧なウォーターフォール式繰り返し実行システム実現完了**

### リリース手順
ユーザーが「リリースして」と言った場合：
```bash
npm run release:hedge [patch|minor|major]
```
手動でタグ作成禁止！スクリプトが自動化済み。

### 通知システム
作業完了時はosascriptで通知：
```bash
# 完了時
osascript -e 'display notification "作業完了" with title "ArbitrageAssistant" sound name "Glass"'

# エラー時  
osascript -e 'display notification "エラー発生" with title "ArbitrageAssistant" sound name "Basso"'
```

## 開発コマンド

### 基本操作
```bash
npm run dev        # 全アプリ開発サーバー
npm run build      # 全アプリビルド
npm run lint       # 全Lint
npm run test       # 全テスト
```

### Haconiwa (箱庭) 開発環境
```bash
npm run haconiwa:start       # 6ウィンドウ並列開発環境起動（CEO Supreme v6.0完全自動化システム統合）
npm run haconiwa:refresh     # エージェント精度維持・リフレッシュ
```

**✅ 統合完全自動化システム**:
- `npm run haconiwa:start` でCEO Supreme v6.0完全自動化システム自動起動
- CEO → Director → Specialist 完全自動指示フロー
- Tasks Directory v2.0統合・永続記録・追跡・品質管理
- MVP絶対準拠・Over-Engineering完全防止

### 🌊 ウォーターフォール式繰り返し実行システム
完璧なウォーターフォール式繰り返し実行システム（完璧性95%達成）：
```bash
# ウォーターフォール制御（Claudeエージェント専用コマンド）
./scripts/tasks/waterfall/waterfall-control.sh status           # 現在の実行状況確認
./scripts/tasks/waterfall/waterfall-control.sh check-completion # 全作業完了判定実行
./scripts/tasks/waterfall/waterfall-control.sh prepare-next     # 次サイクル準備実行
./scripts/tasks/waterfall/waterfall-control.sh full-cycle       # 完了判定→次サイクル準備（一括実行）
./scripts/tasks/waterfall/enhanced-completion-check.sh          # 強化版完了判定（詳細品質チェック）

# 報告システム（Claudeエージェント専用）
./scripts/tasks/reports/check-pending-reports.sh summary        # 未確認報告チェック（CEO・Director）

# 基本フロー
npm run haconiwa:start                                           # 1. ウォーターフォール開始（ユーザー実行）
./scripts/tasks/waterfall/waterfall-control.sh status           # 2. 進捗確認（Claude実行）
./scripts/tasks/waterfall/waterfall-control.sh check-completion # 3. 完了判定（Claude実行）
./scripts/tasks/waterfall/waterfall-control.sh prepare-next     # 4. 次サイクル準備（Claude実行）
npm run haconiwa:start                                           # 5. 次サイクル開始（ユーザー実行・繰り返し）
```

### 📋 Tasks Directory v2.0 完全統合
タスク管理とエージェント連携の最適化：
```bash
# タスク一覧・監視（Claudeエージェント専用コマンド）
./scripts/tasks/list.sh all           # 全タスク一覧
./scripts/tasks/list.sh active        # 進行中タスクのみ
./scripts/tasks/list.sh completed     # 完了済みタスクのみ
./scripts/tasks/list.sh summary       # 緊急事項サマリー
./scripts/tasks/list.sh monitor       # リアルタイム監視

# タスク実行・管理（Specialist向け）
./scripts/tasks/execute.sh [task_file] [action]
./scripts/tasks/auto-archive.sh       # 自動アーカイブ実行

# Director状況確認・品質監視（Claudeエージェント専用）
./scripts/directors/monitoring/check.sh   # 全Director実行状況・進捗確認
./scripts/backend/table-guard.sh          # Backend テーブル追加監視
./scripts/quality/mvp-compliance-check.sh # MVP準拠チェック

# 役割完遂システム（全エージェント向け）
./scripts/utils/role-completion-system.sh # 役割完了判定・品質保証・次アクション提案
```

**🚀 完全自動化システム特徴**：
- **完全自動化**: CEO → Director → Specialist（手動制御なし）
- **Tasks Directory統合**: タスクファイル自動管理・進捗追跡・永続記録
- **MVP絶対準拠**: Over-Engineering完全防止・実装保護機能
- **品質保証**: 自動lint・typecheck・test・MVP準拠チェック

### 🔄 エージェント精度維持システム
作業による精度低下を防ぐリフレッシュ機能：
```bash
# 全18ペインで/clear + 初期プロンプト入力
npm run haconiwa:refresh
```

**使用タイミング**: 精度低下を感じた時

### Haconiwaタスクベース並列開発
```bash
# 1. 宣言的設定適用
haconiwa apply -f arbitrage-assistant.yaml

# 2. Space開始
haconiwa space start -c arbitrage-assistant

# 3. Claude Codeエージェント起動
haconiwa space run -c arbitrage-assistant --claude-code

# 4. Space・Room管理
haconiwa space ls                        # Space一覧
haconiwa space attach -c arbitrage-assistant  # 全体確認
haconiwa space attach -r room-backend    # Backend Room接続

# 5. タスク管理（実際のAPI）
haconiwa task new mvp-new-feature        # 新規タスク作成
haconiwa task assign mvp-graphql-backend backend-director
haconiwa task show mvp-arbitrage-engine  # タスク詳細
haconiwa task done mvp-admin-dashboard   # タスク完了

# 6. 監視・分析
haconiwa monitor -c arbitrage-assistant  # 監視
haconiwa scan                            # AI分析
```

**重要**: 実際に動作するhaconiwa APIのみ使用。Git worktreeはタスク管理で自動実行。

### 🔧 Haconiwa認証問題対処法

**Claude認証ループ・初期登録問題の解決**:

```bash
# 1. 問題が続く場合の手動対処
claude auth logout && claude auth login

# 2. 完全リセット（最終手段）
pkill claude                    # 全Claudeプロセス終了
rm -rf ~/.claude               # 認証設定削除
claude auth login              # 再認証
npm run haconiwa:start         # Haconiwa再起動
```

**✅ 認証問題の解決**:
- **haconiwa:start** にローカルClaude保持機能を統合完了
- TMUX内Claudeプロセスのみを特定・終了するスマートクリーンアップ実装
- Claude認証情報（~/.claude）を自動保持
- 認証ループ・初期登録画面問題を根本解決

**改善された仕組み**:
- TMUXペインPIDベースのClaudeプロセス特定
- TMUX環境変数を持つプロセスのみ終了
- ローカルClaudeプロセスの完全保持
- 認証状態の自動継承

### 🔧 環境変数設定問題対処法

**環境変数未設定・部分的失敗の解決**:

```bash
# 1. プロセス過多の場合のクリーンアップ
pkill claude                    # 全Claudeプロセス終了
npm run haconiwa:start         # クリーン起動
```

**環境変数問題の原因**:
- 20個の過多なClaudeプロセスが認証・メモリを圧迫 → **解決済み**
- tmux環境変数設定の不備 → **修正済み**
- 起動済みプロセスへの環境変数反映失敗 → **修復ツール提供**

**改善内容**:
- `tmux set-environment`による直接設定追加
- 環境変数ファイル作成の並行実行
- 起動済みセッションへの修復コマンド提供

### 🎭 エージェント役割確認・初期化

**各ペインでの役割確認・初期化**:

```bash
# 手動での役割確認
./scripts/utils/role            # 環境変数から役割を自動認識・表示
```

**共通リソース**:
- `scripts/directors/common/forbidden-edits.md` - 編集禁止ファイルリスト

**高精度作業の基本原則**:
- **実装計画ファースト**: 複雑タスクでは最初にコードではなく詳細実装計画を作成
- **コラボレーション >> YOLO**: 推測実装せず、不明点は即座に再プロンプト
- **1Mコンテキスト活用**: 多数ファイルを一括読み込みで精度向上
- **コード→テスト→コミットループ**: 品質保証の徹底実行

**役割確認自動システム**:
- `npm run haconiwa:start`でClaude起動後、各ペインに`./scripts/utils/role`コマンドが自動予め入力
- 指示出し時は既存の役割確認コマンドの下に` && echo "指示内容" ultrathink`形式で追加
- 実行時は「役割確認→指示実行」の順序で自動処理され、プロンプト節約・精度向上を実現

**🚀 CEO Supreme完璧実行システム（v6.0完全自動化）**:※統合済み※
- **`npm run haconiwa:start`** - CEO Supreme v6.0完全自動化システム自動起動（**唯一の起動方法**）

**🎯 CEO Supreme v6.0完全自動化フロー（革新的完全自動システム）**:
1. **CEO Supreme**: 徹底システム診断→完璧戦略判断→Director指示送信（品質最優先・時間制限なし）
2. **Director自動実行**: 指示受信→配下指示送信コマンド自動実行（scripts/directors/delegation/auto-delegate-v2.sh）
3. **Specialist自動実行**: Tasks Directory記録→実装→品質チェック（完全自動）
4. **完全自動化**: 手動制御なし・CEO→Director→Specialist完全自動フロー

**🎯 v6.0完全自動化階層システム特徴**:
- **完全自動化**: CEO → Director → Specialist（手動制御なし・完全自動指示フロー）
- **Director自動実行**: 指示受信→`scripts/directors/delegation/auto-delegate-v2.sh`自動実行（Tasks Directory統合）
- **Tasks Directory v2.0**: 永続記録・追跡・品質管理・マークダウン形式タスクファイル
- **MVP絶対準拠**: Over-Engineering完全防止・実装保護機能継続
- **完全自動化**: ユーザー介入なし・完全自動MVP実装フロー（効率重視）
- **品質保証**: lint・typecheck・test・MVP準拠チェックの完全統合

**🚀 Haconiwa統合完了**:
- **CEO Supreme統合**: `npm run haconiwa:start`で自動的にv6.0完全自動化システム起動
- **Director指示**: 必ずDirectorペイン（1.0,2.0,3.0,4.0,5.0）経由→配下自動指示
- **Specialist実行**: Directorからの自動指示で即座実行（完全自動）
- **完璧なフロー**: `npm run haconiwa:start` → CEO Supreme自動起動 → Director自動実行 → Specialist自動実行

### 🛡️ MVP準拠強制システム（新規実装済み）

**Director/Specialist向けMVP準拠強制機能**:
```bash
# 1. 編集禁止リスト確認
cat scripts/directors/common/forbidden-edits.md

# 2. MVP準拠チェック実行（Claudeエージェント専用）
./scripts/quality/mvp-compliance-check.sh <ファイル/ディレクトリ>

# 3. Director指示時の自動MVP準拠強制
./scripts/directors/delegation/auto-delegate-v2.sh [director-id] "[instruction]"
```

**MVP準拠強制レイヤー**:
- **CEO戦略判断**: v3.0選択的システムで既存実装保護
- **Director指示**: 自動でMVP準拠絶対指示を追加送信
- **Specialist実行**: 編集禁止リスト・準拠チェック機能
- **コミット保護**: mvp-compliance-check.shで事前検証

**🚨 絶対原則**: MVPシステム設計.md記載外の機能は死んでも実装禁止

### 🗄️ Backend テーブル追加監視システム（追加実装済み）

**バックエンドディレクター向け専用監視機能**:
```bash
# 1. テーブル追加チェック（即座確認・Claudeエージェント専用）
./scripts/backend/table-guard.sh

# 2. 全体MVP準拠チェック（Claudeエージェント専用）
./scripts/quality/mvp-compliance-check.sh packages/shared-backend/
```

**テーブル追加管理**:
- **許可テーブル**: User/Account/Position/Action のみ
- **禁止テーブル**: Performance/Analytics/Metrics等は自動検出・警告
- **Git pre-commit**: data/resource.ts変更時の自動チェック
- **Director警告**: Haconiwa環境で自動警告送信

**🚨 Backend Director絶対ルール**: data/resource.tsでMVP外テーブル追加は死んでも禁止

**Director完全自動化システム**:
- CEO→Director指示時に自動的に配下Specialistへの指示送信を自動実行
- Director手動指示時: `./scripts/directors/delegation/auto-delegate-v2.sh [director-id] "[task]"`
- 全18ペインでCEO→Director→Specialist の完全自動指示送信フローを実現

**🚨 Director完全自動化範囲**:
- **Director自動実行**: 指示受信→配下指示送信自動実行→進捗確認→CEO報告
- **配下指示送信は自動**: `./scripts/directors/delegation/auto-delegate-v2.sh [director-id] "[task]"` 自動実行
- **全Director完全自動化**: 手動制御なし・完全自動MVP実装フロー

**Director実行確認システム（Claudeエージェント専用）**:
- `./scripts/tasks/list.sh all` - 全タスク状況確認
- `./scripts/tasks/list.sh active` - 進行中タスク確認
- `./scripts/tasks/list.sh monitor` - リアルタイム監視ダッシュボード
- `./scripts/tasks/list.sh summary` - 緊急事項・重要タスク確認
- `./scripts/directors/monitoring/check.sh` - 全Director実行状況・進捗確認


### アプリ別
```bash
# Hedge System (Tauri)
cd apps/hedge-system
npm run tauri:dev    # 開発
npm run tauri:build  # ビルド
npm run check-types  # 型チェック

# Admin (Web)
cd apps/admin
npm run dev --turbopack  # 開発
npm run check-types      # 型チェック
```

### Next.jsキャッシュ問題対策

UIの変更が反映されない場合の対処法：

```bash
# 方法1: クリーンな開発サーバー起動
cd apps/hedge-system
npm run dev:clean  # .nextフォルダを削除して起動

# 方法2: より徹底的なクリーン起動（推奨）
npm run dev:fresh  # .nextとnode_modules/.cacheを削除して起動

# 方法3: ブラウザでハードリロード
# Mac: Cmd + Shift + R
# Windows/Linux: Ctrl + Shift + R
```

#### 開発効率化のヒント
- UIパッケージの変更時は`dev:clean`を使用
- 大幅な変更時は`dev:fresh`を使用  
- `next.config.js`でwatchOptionsを設定済み（500msごとにファイル変更を検知）

## 🎯 設計書参照ルール

### 必須参照ドキュメント
**開発前に必ず確認**：
```bash
# 詳細システム設計（必須）
cat "MVPシステム設計.md"

# 該当部門の技術要件確認
grep -A 20 "自分の部門名" arbitrage-assistant.yaml
```

### 部門別参照セクション
- **Backend**: 2. データベース設計, 2-4. 認証・権限設計
- **Trading**: 4. 実行パターン詳細, 11. 実行ロジック詳細説明  
- **Integration**: 7. WebSocket通信設計, 8. エラーハンドリング設計
- **Frontend**: 5-4. 管理者画面, 6. データフロー設計
- **DevOps**: 10. パフォーマンス最適化, 9. セキュリティ設計

### 実装判断基準
1. **技術スタック**: yamlで定義された自分の専門領域に集中
2. **設計詳細**: MVPシステム設計.mdの該当セクション準拠  
3. **連携仕様**: 他部門との境界部分を設計書で確認
4. **迷った時**: 設計書の該当フローチャート・シーケンス図を確認

## アーキテクチャ

### 構成
- **Monorepo**: Turborepo + npm workspaces
- **Apps**: hedge-system (Tauri v0.1.24), admin (Next.js v0.1.0)
- **Packages**: ui, shared-backend (AWS Amplify), configs

### 技術スタック
- **Frontend**: Next.js 15.3.2, React 19, Tailwind CSS v4
- **Backend**: AWS Amplify Gen2 GraphQL
- **Desktop**: Tauri v2, Rust
- **Testing**: Vitest, React Testing Library
- **Quality**: ESLint --max-warnings 0, TypeScript 5.5.4

## テストガイドライン

### テスト対象
- アービトラージ計算ロジック
- 重要なデータ処理
- 共通コンポーネント
- AWS Amplify連携

### テスト除外
- 単純表示コンポーネント
- 外部ライブラリwrapper
- UI見た目のみ

### コマンド
```bash
npm run test            # 全テスト
npm run test:coverage   # カバレッジ
```

## PR作成時のルール

### 必須項目
- 変更内容の具体的説明
- 技術的詳細
- UI変更時はスクリーンショット必須
- 日本語で記載

### 事前確認が必要な変更
- 依存関係追加・更新
- 設定ファイル大幅変更
- AWS Amplify設定変更
- Tauri設定変更

## 🎯 Tasks Directory連携システム（v2.0）

### 🚀 新システム概要
Director → Specialist連携を永続化されたタスクファイルで管理する革新的システム

### 🔄 連携フロー
1. **Director → タスク作成**: Tasks Directoryにマークダウン形式で指示書作成
2. **Specialist → 実行・記録**: タスクファイル読み取り → 実行 → 結果記録
3. **Director → 確認・追加指示**: 結果確認後、段階的に追加指示
4. **永続化・追跡**: 全作業履歴の完全な記録・可視化

### 📁 ディレクトリ構造
```
tasks/
├── directors/                    # Director発行タスク（進行中）
│   ├── backend/                 # Backend Directorタスク
│   ├── trading/                 # Trading Directorタスク
│   ├── integration/             # Integration Directorタスク
│   ├── frontend/                # Frontend Directorタスク
│   └── devops/                  # DevOps Directorタスク
├── completed/                   # 完了済みタスク（アーカイブ）
├── templates/                   # タスクテンプレート
└── README.md                    # システム説明
```

### 🛠️ 利用可能コマンド

#### Director用（指示・管理）
```bash
# 自動指示送信（v2.0・Tasks Directory統合）
./scripts/directors/delegation/auto-delegate-v2.sh backend-director "MVP基盤システム構築"
```

#### Specialist用（実行・記録）
```bash
# タスク実行・結果記録
./scripts/tasks/execute.sh [task_file] [action]
```

#### 共通（監視・確認）
```bash
# タスク一覧・監視
./scripts/tasks/list.sh all           # 全タスク一覧
./scripts/tasks/list.sh active        # 進行中タスクのみ
./scripts/tasks/list.sh completed     # 完了済みタスクのみ
./scripts/tasks/list.sh summary       # 緊急事項サマリー
./scripts/tasks/list.sh monitor       # リアルタイム監視
```

### 🎯 Director指示フロー例

#### Backend Director → Amplify Gen2 Specialist
```bash
# 1. Director: 自動タスク作成・指示送信
./scripts/directors/delegation/auto-delegate-v2.sh backend-director "AWS Amplify Gen2基盤構築"

# 2. システム: 自動実行される内容
# - tasks/directors/backend/task-XXX-amplify.md 作成
# - 詳細技術要件・完了条件を自動追記
# - amplify-gen2-specialist に通知送信

# 3. Specialist: タスク実行・結果記録
./scripts/tasks/execute.sh tasks/directors/backend/task-XXX-amplify.md
```

### 📝 タスクファイル構造
各タスクファイルは以下の完全な構造を持ちます：

```markdown
# [タスク名]

## 📋 タスク情報
- **作成者**: backend-director
- **担当者**: amplify-gen2-specialist  
- **優先度**: high
- **状態**: in_progress
- **作成日時**: 2025-01-28 10:00

## 🎯 指示内容
[Director指示詳細・技術要件]

## 📊 実行結果
### 実行者: amplify-gen2-specialist
### 実行開始日時: 2025-01-28 10:30
### 実行完了日時: 2025-01-28 14:00

### 実装内容
[実装した機能・変更点の詳細]

### 成果物
- [x] ファイル作成: packages/shared-backend/amplify/data/resource.ts
- [x] テスト実行: GraphQL schema validation

### パフォーマンス・品質確認
- [x] Lint通過: ✅ 成功
- [x] 型チェック通過: ✅ 成功
- [x] テスト通過: ✅ 成功

## 🔄 進捗履歴
- 2025-01-28 10:00 **backend-director**: タスク作成・初期指示
- 2025-01-28 10:30 **amplify-gen2-specialist**: タスク実行開始
- 2025-01-28 14:00 **amplify-gen2-specialist**: 実行完了・結果記録
- 2025-01-28 14:30 **backend-director**: 確認・承認

## 💬 コミュニケーションログ
### Director → Specialist
2025-01-28 10:00 - backend-director: 初期指示
2025-01-28 14:30 - backend-director: 実装確認、品質も良好です

### Specialist → Director
2025-01-28 14:00 - amplify-gen2-specialist: 実装完了報告
```

### 🎯 メリット

1. **永続化**: 全指示・結果が永続的に記録され、履歴追跡が完全
2. **段階的指示**: Director結果確認後の段階的指示が可能
3. **可視化**: 全チーム作業状況の一元可視化・監視
4. **並列作業**: 複数Specialistの同時タスク実行・競合回避
5. **品質保証**: 実行結果・テスト結果の確実な記録・承認プロセス
6. **コミュニケーション**: Director ↔ Specialist間の完全なコミュニケーション記録

### 🚀 従来システムとの比較

| 項目 | 従来（tmux直接指示） | v2.0（Tasks Directory） |
|------|---------------------|------------------------|
| **指示記録** | 一時的・消失 | 永続的・完全記録 |
| **進捗確認** | 困難 | リアルタイム可視化 |
| **段階的指示** | 不可 | 結果確認後の段階的指示 |
| **品質管理** | 手動・不確実 | 自動チェック・承認プロセス |
| **履歴追跡** | 不可 | 完全な作業履歴 |
| **並列作業** | 競合発生 | 完全な競合回避 |

### 💡 ベストプラクティス

1. **Director**: 結果確認してから段階的に追加指示
2. **Specialist**: 実行後は必ずタスクファイルに詳細記録
3. **品質保証**: lint・typecheck・testを実行して結果記録
4. **コミュニケーション**: 疑問点はタスクファイルのコミュニケーションログに記録
5. **完了管理**: Director承認後はcompletedディレクトリに移動

## 品質基準
- ESLint: --max-warnings 0
- TypeScript: strict mode
- Zero warnings policy
- **shadcn/ui コンポーネントは編集禁止** - 標準版を信頼して使用