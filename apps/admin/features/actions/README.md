# アクションベースアーキテクチャ実装

## 🎯 概要

ボーナスアービトラージのカモフラージュ戦略を「アクション」の組み合わせで実現する、疎結合な設計。

## 🚀 実装例

### 基本的なアクション作成
```tsx
import { ActionBuilder } from './components/ActionBuilder';

// エントリーアクション
const entryAction = {
  type: 'ENTRY',
  userId: 'user1',
  accountId: 'acc1',
  parameters: {
    symbol: 'USDJPY',
    direction: 'BUY',
    lots: 1.0
  }
};

// 待機アクション（カモフラージュ）
const waitAction = {
  type: 'WAIT',
  parameters: {
    waitSeconds: 300 // 5分待機
  }
};
```

### シーケンス作成
```tsx
import { SequenceBuilder } from './components/SequenceBuilder';

const camouflageSequence = {
  name: 'カモフラージュ両建て戦略',
  actions: [
    { type: 'ENTRY', userId: 'user1', accountId: 'acc1', 
      parameters: { symbol: 'USDJPY', direction: 'BUY', lots: 1.0 } },
    { type: 'WAIT', parameters: { waitSeconds: 180 } },
    { type: 'TRAIL_SET', userId: 'user1', accountId: 'acc1',
      parameters: { trailDistance: 20, trailStep: 5 } },
    { type: 'WAIT', parameters: { waitSeconds: 300 } },
    { type: 'ENTRY', userId: 'user2', accountId: 'acc2',
      parameters: { symbol: 'USDJPY', direction: 'SELL', lots: 0.8 } },
    { type: 'WAIT', parameters: { waitSeconds: 120 } },
    { type: 'ENTRY', userId: 'user2', accountId: 'acc2',
      parameters: { symbol: 'USDJPY', direction: 'SELL', lots: 0.2 } }
  ],
  camouflageSettings: {
    enabled: true,
    randomDelayMin: 60,
    randomDelayMax: 300,
    humanLikeExecution: true
  }
};
```

## 💡 利点

### 1. 疎結合設計
各アクションは独立しているため：
- 個別の実行・停止が可能
- エラー時の部分的な再実行
- アクションの差し替え・追加が容易

### 2. カモフラージュの実現
```tsx
// 出金拒否回避のパターン例
const avoidDetectionPattern = [
  // メインエントリー
  { type: 'ENTRY', lots: 1.0, direction: 'BUY' },
  
  // ランダム待機（検知回避）
  { type: 'WAIT', waitSeconds: random(120, 600) },
  
  // 自然なトレール設定
  { type: 'TRAIL_SET', trailDistance: 20 },
  
  // さらなる待機
  { type: 'WAIT', waitSeconds: random(300, 900) },
  
  // 段階的ヘッジ（同一ロット数を避ける）
  { type: 'ENTRY', lots: 0.7, direction: 'SELL', accountId: 'different' },
  { type: 'WAIT', waitSeconds: random(60, 300) },
  { type: 'ENTRY', lots: 0.3, direction: 'SELL', accountId: 'different' },
];
```

### 3. 再利用性
```tsx
// テンプレート化による再利用
const templates = {
  quickHedge: [
    { type: 'ENTRY', paramTemplate: '{{symbol}} {{direction}} {{lots}}' },
    { type: 'ENTRY', accountId: '{{hedgeAccount}}', direction: '{{oppositeDirection}}' }
  ],
  
  gradualClose: [
    { type: 'PARTIAL_CLOSE', closeRatio: 0.3 },
    { type: 'WAIT', waitSeconds: 300 },
    { type: 'PARTIAL_CLOSE', closeRatio: 0.5 },
    { type: 'WAIT', waitSeconds: 600 },
    { type: 'CLOSE', closeRatio: 1.0 }
  ]
};
```

### 4. 条件付き実行
```tsx
const conditionalActions = [
  {
    type: 'ENTRY',
    condition: {
      type: 'PRICE_CONDITION',
      parameters: { symbol: 'USDJPY', operator: '>=', price: 145.00 }
    }
  },
  {
    type: 'CLOSE',
    condition: {
      type: 'POSITION_STATE',
      parameters: { profitPips: 50 }
    }
  }
];
```

## 📊 データフロー

```
User Input → ActionBuilder → Action → ActionSequence → Execution Engine
                                              ↓
                              Monitor ← MT4/MT5 ← WebSocket
```

## 🛠 実装状況

### ✅ 完了
- [x] ActionBuilder コンポーネント
- [x] SequenceBuilder コンポーネント  
- [x] SortableActionCard コンポーネント
- [x] ドラッグ&ドロップ機能
- [x] 基本的なアクションタイプ（ENTRY, CLOSE, WAIT等）

### 🚧 進行中
- [ ] Amplifyスキーマ統合
- [ ] 実行エンジン実装
- [ ] リアルタイム監視機能
- [ ] カモフラージュアルゴリズム

### 📋 今後の実装予定
- [ ] 条件付き実行
- [ ] アクションテンプレート
- [ ] パフォーマンス分析
- [ ] A/Bテスト機能

## 🎨 UI/UX特徴

### アクションビルダー
- **直感的な操作**: アクションタイプをボタンで選択
- **動的フォーム**: タイプに応じて入力項目が変化
- **バリデーション**: リアルタイムでパラメータ検証

### シーケンスビルダー
- **ドラッグ&ドロップ**: アクションの順序を直感的に変更
- **ビジュアルフィードバック**: 実行順序が視覚的に分かりやすい
- **プレビュー機能**: 実行時間・リスクレベルを事前確認

### 実行監視
- **リアルタイム更新**: アクション実行状況をライブ表示
- **個別制御**: 各アクションの一時停止・キャンセル
- **エラーハンドリング**: 失敗時の自動リトライ・スキップ

## 💬 使用方法

1. **アクション作成**: ActionBuilderでアクションを定義
2. **シーケンス構築**: SequenceBuilderでアクションを組み合わせ
3. **カモフラージュ設定**: ランダム遅延やヒューマンライク実行を設定
4. **実行開始**: シーケンスを実行し、リアルタイム監視

この設計により、ボーナスアービトラージの複雑な要件を、シンプルで管理しやすい「アクション」の組み合わせで実現できます。