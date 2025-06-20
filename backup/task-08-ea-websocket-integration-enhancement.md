# Task 08: EA-WebSocket連携機能の強化

## 概要
EA（Expert Advisor）とのWebSocket通信機能を強化し、安定したリアルタイム双方向通信を実現する。

## 実装範囲

### 1. WebSocket通信の強化
- **接続管理**
  - 自動再接続機能の改善
  - ハートビート機能の実装
  - 接続品質監視

- **メッセージ形式標準化**
  - JSON形式でのメッセージ交換
  - メッセージタイプの定義
  - エラーハンドリングの統一

### 2. EA側データ送信機能
- **リアルタイムデータ**
  - ポジション情報（開始・更新・終了）
  - 残高・有効証拠金情報
  - ボーナス額情報
  - ロスカット通知

- **市場データ**
  - 現在価格情報
  - スプレッド情報
  - 市場開閉状態

### 3. システム→EA コマンド送信
- **トレード指示**
  - エントリー指示
  - 決済指示
  - トレール設定指示

- **システム管理**
  - 接続テスト
  - 設定更新指示
  - アップデート指示

## 参考ファイル
- `apps/hedge-system/lib/websocket/`
- `ea/HedgeSystemConnector.mq5`
- `ea/websocket-dll/`

## 実装手順

### Phase 1: WebSocket基盤強化
1. `lib/websocket/` の機能拡張
2. `websocket-client.ts` の改良
3. `message-types.ts` の標準化
4. 接続管理機能の強化

### Phase 2: EA連携メッセージ定義
5. EA向けメッセージスキーマ定義
6. レスポンス形式の標準化
7. エラーコードの体系化
8. バリデーション機能の実装

### Phase 3: データ同期機能
9. リアルタイムデータ同期
10. データ整合性チェック
11. 遅延・欠損データの処理
12. 重複送信防止機能

### Phase 4: 監視・デバッグ機能
13. WebSocket通信の監視機能
14. メッセージログ機能
15. デバッグ・診断ツール
16. パフォーマンス監視

## メッセージ形式定義

### EA → システム（データ送信）
```typescript
interface EAMessage {
  type: 'position_update' | 'account_info' | 'market_data' | 'losscut_alert' | 'heartbeat'
  timestamp: number
  accountId: string
  data: any
  messageId: string
}

// ポジション更新
interface PositionUpdate {
  positionId: string
  symbol: string
  type: 'buy' | 'sell'
  lots: number
  openPrice: number
  currentPrice: number
  profit: number
  swapPoints: number
  commission: number
  status: 'open' | 'closed'
}

// アカウント情報
interface AccountInfo {
  balance: number
  equity: number
  freeMargin: number
  marginLevel: number
  bonusAmount: number
  profit: number
  credit: number
}
```

### システム → EA（コマンド送信）
```typescript
interface SystemCommand {
  type: 'open_position' | 'close_position' | 'update_trail' | 'test_connection'
  commandId: string
  timestamp: number
  data: any
}

// ポジション開始指示
interface OpenPositionCommand {
  symbol: string
  type: 'buy' | 'sell'
  lots: number
  price?: number // 指値の場合
  stopLoss?: number
  takeProfit?: number
  comment?: string
}
```

## 完了条件
- [ ] 安定したWebSocket接続機能
- [ ] 標準化されたメッセージ形式
- [ ] EA側データの正確な送信
- [ ] システム側コマンドの確実な実行
- [ ] エラーハンドリング・復旧機能
- [ ] 通信監視・デバッグ機能
- [ ] パフォーマンス要件達成（100-200ms）

## 注意事項
- EA側の実装も並行して進める必要
- MT4/MT5のWebSocket制限への対応
- 大量データ送信時のパフォーマンス
- セキュリティ・認証の確保
- 複数EA同時接続時の処理
- ネットワーク障害時の適切な復旧

## EA側実装要件
- MQL5でのWebSocketクライアント実装
- DLL経由での通信機能
- データ送信の最適化
- エラー時の自動復旧
- 設定ファイルでの接続先管理

## 通信品質要件
- **レスポンス時間**: EA→システム 100ms以内
- **コマンド実行**: システム→EA 200ms以内
- **接続安定性**: 99.5%以上の稼働率
- **データ整合性**: 100%（重複・欠損なし）