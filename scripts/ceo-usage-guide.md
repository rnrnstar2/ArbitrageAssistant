# CEO戦略的プロジェクト管理システム 使用ガイド

## 🎯 使用フロー

### 1. Haconiwa環境起動
```bash
npm run haconiwa:start
```
- 全18ペインでClaude起動
- 各ペインに役割確認コマンドが自動予め入力完了

### 2. CEOメインペインでの作業開始

#### Step 1: 戦略的分析システム確認
```bash
# CEOメインペイン (arbitrage-assistant:0.0) で実行
npm run ceo:strategic
```

#### Step 2: 戦略的分析実行
上記で表示されたCEO戦略的管理システムを段階的に実行：

1. **現状分析フェーズ**: プロジェクト構造・実装状況の詳細確認
2. **完成度評価フェーズ**: 各部門の実装完了度を数値評価
3. **優先順位決定フェーズ**: MVP要件・依存関係に基づく戦略判断
4. **実行計画作成フェーズ**: 具体的な実行順序・タスク依存関係決定
5. **指示実行フェーズ**: 必要な部門にのみ条件付き指示実行
6. **監視フェーズ**: 完了報告待ち・次フェーズ計画

#### Step 3: 条件付き指示実行
戦略的分析の結果に基づき、必要な部門にのみ指示：

```bash
# CEOメインペインで統一指示システム確認
npm run ceo:directive

# 分析結果に基づいて該当する指示のみ実行
# 例：Backend基盤構築が必要と判定された場合
tmux send-keys -t arbitrage-assistant:1.0 ' && echo "【CEO最優先指示】Backend基盤構築: AWS Amplify Gen2 + GraphQL + 認証システム完全実装を緊急実行してください。" && echo "配下への自動指示送信開始..." && ./scripts/director-auto-delegate.sh backend-director "AWS Amplify Gen2基盤構築" && echo "完了後CEO報告。" ultrathink' Enter
```

## 🎯 戦略的判断基準

### 厳格な実装必要判定（指示対象）
**条件分岐による厳格判定**：
- **Backend**: TSファイル < 5 **かつ** Amplify設定 < 3
- **Trading**: 核心ファイル（position*, arbitrage*, trading*） < 3
- **Integration**: MT5ファイル（*.mq5） < 1
- **Frontend**: Adminファイル < 10 **または** Hedgeファイル < 15
- **DevOps**: Workflowファイル < 1

### 指示スキップ判定（指示不要）
**基準値達成済み**：
- 上記条件を満たさない = 実装完了済み
- **重要**: 完成済み部門には指示を出してはいけない
- 最適化は別フェーズで対応

## 📋 部門別判定基準例

### 🗄️ Backend
- **要実装**: `packages/shared-backend`のTSファイル < 5個
- **最適化**: 基盤実装済み、パフォーマンス改善が目標

### ⚡ Trading  
- **要実装**: `position*`, `arbitrage*`ファイル < 3個
- **最適化**: 核心機能実装済み、実行速度向上が目標

### 🔌 Integration
- **要実装**: `ea/`ディレクトリのMQ5ファイル < 1個
- **最適化**: MT5統合済み、通信最適化が目標

### 🎨 Frontend
- **要実装**: `apps/admin/src`のTSXファイル < 10個
- **最適化**: UI実装済み、UX向上が目標

### 🚀 DevOps
- **要実装**: `.github/workflows`ファイル < 1個
- **最適化**: CI/CD実装済み、ビルド最適化が目標

## 🔄 継続的管理サイクル

### 1. 定期的な現状分析
- Director完了報告後
- 新機能追加時
- パフォーマンス問題発生時

### 2. 動的優先順位調整
- 技術的課題発見時
- ビジネス要件変更時
- 依存関係変化時

### 3. 実行監視・調整
- 進捗の継続監視
- 課題の早期発見
- 計画の動的調整

## 🎯 Director自動指示送信システム

### 自動指示送信フロー
1. **CEO指示実行** → Director指示受信
2. **自動トリガー** → `director-auto-delegate.sh`実行
3. **配下指示送信** → 該当Specialistに自動指示
4. **完了報告体制** → Director経由でCEOに報告

### 指示送信対象
- **Backend Director** → amplify-gen2-specialist, cognito-auth-expert
- **Trading Director** → entry-flow-specialist, settlement-flow-specialist  
- **Integration Director** → mt5-connector-specialist, websocket-engineer
- **Frontend Director** → react-specialist, desktop-app-engineer
- **DevOps Director** → build-optimization-engineer, quality-assurance-engineer

### 手動実行（必要時）
```bash
# Director配下への手動指示送信
npm run director:delegate backend-director "タスク概要"

# 直接スクリプト実行
./scripts/director-auto-delegate.sh trading-flow-director "Position-Trail-Action実装"
```

## ✨ システムの利点

### 📊 現状把握の正確性
- ファイル構成の実際確認
- 実装完了度の数値評価
- 推測ではなく事実ベースの判断

### 🎯 戦略的優先順位
- MVP要件との照合
- 依存関係の考慮
- ビジネス価値・技術リスクの評価

### ⚡ 効率的な指示
- 完成済み部分への無駄な指示を回避
- 必要な部分にのみ集中
- 実行順序の最適化

### 🔄 継続的改善
- 完了後の再分析
- 動的な計画調整
- 品質・パフォーマンスの継続向上

### 🤖 完全自動化の実現
- **CEO→Director→Specialist** の3層指示送信自動化
- 手動入力の大幅削減
- 指示忘れ・抜け漏れの完全防止
- 全18ペインでの一貫した指示伝達

### 📊 実行要約・完了監視システム
- **厳格な条件分岐判定**: 必要な部門のみに指示、完成済みはスキップ
- **実行順序明確化**: 依存関係に基づく戦略的実行順序の出力
- **完了監視体制**: 各Director完了報告待ちの一元管理
- **次フェーズ計画**: 実行結果に基づく動的な次ステップ計画
- **定量的実行サマリー**: 指示実行部門数・スキップ部門数・Specialist指示数の数値出力

### 🎯 CEO最終出力例
```
📊 実行判定結果サマリー：
総対象部門数: 5部門
指示実行部門: 2部門
指示スキップ: 3部門（実装完了済み）

📋 実行した指示内容：
✅ Backend Director: AWS Amplify Gen2基盤構築（最優先）
✅ Trading Director: Position-Trail-Action核心実装（高優先）

📈 実行順序・依存関係：
1. Backend基盤構築（緊急）
2. Trading核心実装（高優先）

🎯 各Director配下への自動指示送信：
• Backend Director → amplify-gen2-specialist, cognito-auth-expert
• Trading Director → entry-flow-specialist, settlement-flow-specialist

⏳ 完了報告待ちDirector：
• 🗄️ Backend Director: AWS Amplify Gen2基盤構築 完了報告待ち
• ⚡ Trading Director: Position-Trail-Action実装 完了報告待ち
```

**このシステムにより、CEOは真の戦略的プロジェクト管理を実現し、無駄な指示を排除し、完了監視と次フェーズ計画まで含めた完全なMVP管理を実行できます。**