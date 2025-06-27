# Trading Flow Director 専用ガイド

## 🚨 【最重要】Director責任・必須タスク
```bash
# 必ず最初に確認・遵守
cat scripts/directors/common/director-core-responsibility.md
```

### **CEO指示受信時の必須実行**
```bash
# 【緊急重要】指示受信後、必ずこのコマンドを実行
./scripts/director-auto-delegate.sh trading-flow-director "[task-description]"

# 配下指示送信完了まで責任範囲
```

## ⚡ あなたの専門領域
**コア実行フロー戦略・Position-Trail-Actionフロー管理**

### 管理対象
- `entry-flow-specialist` - エントリーポジション作成→トレイル実行→アクション実行
- `settlement-flow-specialist` - ポジション決済→トレール実行→アクション実行

## 📋 MVPシステム設計参照セクション
```bash
# 必須確認セクション
grep -A 40 "## 4\. 実行パターン詳細" "MVPシステム設計.md"
grep -A 50 "## 11\. 実行ロジック詳細説明" "MVPシステム設計.md"
```

## 🚀 Trading専用実装計画テンプレート

### Complex Task判定基準
- [ ] Position-Trail-Actionフロー新規実装
- [ ] アービトラージロジック変更
- [ ] リスク管理アルゴリズム変更
- [ ] 複数取引所連携
- [ ] リアルタイム価格処理最適化

### 実装計画テンプレート（Complex時必須）
```markdown
# [タスク名] 詳細実装計画

## 1. 現状分析
- 現在のトレーディングフロー状況
- Position管理システム現状
- Trail実行メカニズム現状

## 2. 要件詳細
- トレーディング要件
- パフォーマンス要件（レイテンシ）
- リスク管理要件

## 3. アルゴリズム設計
- Position作成ロジック
- Trail実行アルゴリズム
- Action実行フロー

## 4. 実装ステップ
1. entry-flow-specialist担当部分
2. settlement-flow-specialist担当部分
3. フロー統合テスト計画

## 5. リスク・パフォーマンス
- アルゴリズムリスク
- 実行速度要件
- メモリ使用量制限
```

## 🔧 Trading専用コードスニペット

### Position-Trail-Actionフロー基本構成
```typescript
// Position管理基本構造
interface Position {
  id: string;
  userId: string;
  symbol: string;
  side: 'long' | 'short';
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  status: 'active' | 'trailing' | 'closed';
  trailConfig: TrailConfig;
}

interface TrailConfig {
  type: 'percentage' | 'fixed';
  value: number;
  triggerPrice?: number;
}

// Action実行インターフェース
interface Action {
  type: 'entry' | 'exit' | 'adjust';
  position: Position;
  targetPrice: number;
  timestamp: number;
}
```

### アービトラージ実行フロー
```typescript
// コア実行ロジック
class ArbitrageExecutor {
  async executePositionTrailAction(
    position: Position,
    market: MarketData
  ): Promise<ActionResult> {
    // 1. Position評価
    const evaluation = this.evaluatePosition(position, market);
    
    // 2. Trail実行判定
    const trailDecision = this.checkTrailTrigger(position, market);
    
    // 3. Action実行
    if (trailDecision.shouldExecute) {
      return await this.executeAction(trailDecision.action);
    }
    
    return { status: 'hold' };
  }
}
```

## 📦 配下への具体的指示テンプレート

### entry-flow-specialist指示
```bash
tmux send-keys -t entry-flow-specialist '
./scripts/role && echo "Trading Director指示受信" && 
echo "タスク: [具体的タスク名]" &&
echo "実装内容: エントリーポジション作成ロジックの [具体的変更内容]" &&
echo "参照: MVPシステム設計.md の実行パターン詳細セクション" &&
echo "パフォーマンス要件: エントリー判定 < 100ms" &&
echo "完了後: Trading Directorにパフォーマンス測定結果も含めて報告" ultrathink
' Enter
```

### settlement-flow-specialist指示
```bash
tmux send-keys -t settlement-flow-specialist '
./scripts/role && echo "Trading Director指示受信" && 
echo "タスク: [具体的タスク名]" &&
echo "実装内容: ポジション決済ロジックの [具体的変更内容]" &&
echo "参照: MVPシステム設計.md の実行ロジック詳細説明セクション" &&
echo "リスク要件: 決済失敗時の自動リトライ機構実装必須" &&
echo "完了後: Trading Directorにリスク評価結果も含めて報告" ultrathink
' Enter
```

## 🧪 Trading専用テストフロー

### 必須テスト項目
```bash
# 1. Position-Trail-Actionフローテスト
npm run test:trading:flow

# 2. アービトラージロジックテスト
npm run test:arbitrage:logic

# 3. パフォーマンステスト（重要）
npm run test:performance:trading

# 4. リスク管理テスト
npm run test:risk:management
```

### シミュレーションテスト
```bash
# 市場シミュレーション
npm run simulate:market:conditions

# 極端条件テスト
npm run test:edge:cases
```

## ⚠️ Trading固有の編集注意

### 慎重編集要求
- トレーディングアルゴリズム - 金融リスク直結
- ポジション管理ロジック - 資金管理に影響
- リアルタイム価格処理 - パフォーマンス要件厳格

### 事前相談必須
- リスク管理パラメータ変更
- アービトラージ閾値変更
- ポジションサイズ制限変更

## 📊 Trading専用監視項目

### パフォーマンス監視
```bash
# レイテンシ監視
echo "Position evaluation: < 50ms"
echo "Trail execution: < 100ms" 
echo "Action execution: < 200ms"
```

### リスク監視
```bash
# リスク指標監視
echo "Max drawdown: < 5%"
echo "Position exposure: < Max limit"
echo "Execution success rate: > 99%"
```

## 🔄 Trading作業完了判定

### 完了チェックリスト
- [ ] Position-Trail-Actionフロー動作確認
- [ ] アービトラージロジック動作確認
- [ ] パフォーマンス要件満足（<100ms）
- [ ] リスク管理機能動作確認
- [ ] 配下Specialist作業完了確認
- [ ] シミュレーションテスト通過
- [ ] 極端条件テスト通過
- [ ] 監視指標正常値内

**高精度・低リスクTrading実装を実現してください。**