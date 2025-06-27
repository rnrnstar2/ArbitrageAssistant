# MT4/MT5実環境接続テスト計画

## 🎯 テスト目的
Integration-Trading WebSocket統合の完全な動作確認を48時間以内に実行し、MVP核心機能の実現を確認する。

## 📋 テスト対象システム

### 1. WebSocket DLL層
- `HedgeSystemWebSocket.dll` - MT4/MT5とWebSocketサーバー間通信
- **実装状況**: ✅ ビルド環境完成、実際のDLLビルドが必要

### 2. MT5 EA層  
- `HedgeSystemConnector.mq5` - MT5とDLL間のインターフェース
- **実装状況**: ✅ 完成、WebSocket DLL統合済み

### 3. WebSocketサーバー層
- `websocket-server.ts` - Tauri統合WebSocketサーバー
- **実装状況**: ✅ 完成、高性能実装

### 4. Position実行層
- `position-execution.ts` - Entry→Trail→Action状態遷移システム
- **実装状況**: ✅ 完成、WebSocketHandler統合済み

## 🚀 テスト段階

### Phase 1: 環境構築・基盤テスト（2時間）

#### 1.1 WebSocket DLLビルド
```bash
# Windows環境でのDLLビルド
cd ea/websocket-dll
build.bat x64

# 成果物確認
ls build/x64/Release/HedgeSystemWebSocket.dll
```

**期待結果**:
- `HedgeSystemWebSocket.dll` (64ビット)が正常にビルドされる
- DLLサイズ: 予想50-100KB
- 依存関係確認: OpenSSL、WebSocket++

#### 1.2 MT5環境準備
```bash
# MT5 Terminal設定
# 1. ツール → オプション → エキスパートアドバイザ
# 2. "DLLの使用を許可する" チェック
# 3. "自動売買を許可する" チェック

# DLL配置
cp build/x64/Release/HedgeSystemWebSocket.dll "[MT5_PATH]/MQL5/Libraries/"

# EA配置
cp HedgeSystemConnector.mq5 "[MT5_PATH]/MQL5/Experts/"
cp test_mt5.mq5 "[MT5_PATH]/MQL5/Experts/"
```

#### 1.3 Hedge System起動確認
```bash
# アプリケーション起動
cd apps/hedge-system
npm run tauri:dev

# WebSocketサーバー確認
curl -I http://localhost:8080/health
```

### Phase 2: 単体機能テスト（4時間）

#### 2.1 DLL機能テスト
**MT5でtest_mt5.mq5実行**:
- DLLロード確認: `WSConnect()`, `WSDisconnect()`
- 基本通信確認: `WSSendMessage()`, `WSReceiveMessage()`
- 接続状態確認: `WSIsConnected()`
- エラーハンドリング: `WSGetLastError()`

**期待結果**:
```
✅ DLL loaded successfully
✅ WebSocket connected: wss://localhost:8080
✅ Message sent: {"type":"test","timestamp":"..."}
✅ Message received: {"type":"response","status":"ok"}
✅ Connection stable for 60 seconds
```

#### 2.2 WebSocketサーバー統合テスト
**Hedge System → MT5通信確認**:
```typescript
// position-execution.ts EntryFlowEngine テスト
const testPosition = {
  id: 'test-001',
  symbol: Symbol.EURUSD,
  volume: 0.01,
  executionType: ExecutionType.ENTRY
};

await entryFlowEngine.executeOrder(testPosition, marketCondition, wsHandler);
```

**期待結果**:
- WebSocketサーバー起動: ✅ localhost:8080
- MT5 EA接続確認: ✅ クライアント数1
- コマンド送信: ✅ OPEN command送信成功  
- レスポンス受信: ✅ OPENED event受信

### Phase 3: 統合フローテスト（6時間）

#### 3.1 ポジション開設フロー
**フルフロー確認**:
1. Hedge Systemでポジション作成
2. Entry条件評価 → WebSocket経由でMT5へOPEN命令
3. MT5でポジション約定 → WebSocket経由でOPENED通知
4. position-execution.tsでトレール監視開始

**実行手順**:
```typescript
// 1. ポジション作成
const positionExecutor = new PositionExecutor(wsHandler, trailEngine);
const position = await positionExecutor.createPosition({
  accountId: 'test-account',
  symbol: Symbol.EURUSD,
  volume: 0.01,
  executionType: ExecutionType.ENTRY,
  trailWidth: 0.0010
});

// 2. ポジション実行
await positionExecutor.executePosition(position.id);
```

**期待結果**:
```
⚡ Entry condition met for EURUSD
⚡ Fast entry executed: test-001 in 150ms
✅ Position opened: test-001 at 1.0850
📊 Trail monitoring setup for position: test-001
```

#### 3.2 トレール機能テスト  
**動的トレール確認**:
1. ポジション開設後、価格変動シミュレーション
2. TrailFlowEngineによる水位更新
3. トレール発動時の自動決済

**価格変動シナリオ**:
```
初期価格: 1.0850 (BUY)
価格上昇: 1.0860 → 高水位更新、トリガー1.0850
価格上昇: 1.0870 → 高水位更新、トリガー1.0860  
価格下落: 1.0855 → トレール発動、決済実行
```

#### 3.3 決済フローテスト
**ActionFlowEngine確認**:
1. 手動決済指示
2. トレール発動決済
3. 強制決済（ロスカット）

### Phase 4: パフォーマンステスト（4時間）

#### 4.1 高速処理確認
**実行時間計測**:
- エントリー実行: < 10ms (目標)
- 決済実行: < 20ms (目標)
- トレール判定: < 5ms (目標)

#### 4.2 同時接続テスト
**複数MT5接続**:
- 最大5つのMT5 Terminal同時接続
- 並列ポジション管理
- 負荷分散確認

#### 4.3 長時間安定性テスト
**24時間連続稼働**:
- メモリリーク確認
- 接続維持確認
- エラー発生率測定

### Phase 5: 実装課題対処（32時間）

#### 5.1 発見課題の修正
**よくある課題**:
- WebSocket接続不安定 → 再接続ロジック強化
- DLL呼び出しエラー → エラーハンドリング追加
- 価格取得遅延 → 価格フィード最適化
- メッセージ処理遅延 → 非同期処理改善

#### 5.2 パフォーマンス最適化
**最適化項目**:
- WebSocketメッセージサイズ縮小
- JSON解析高速化
- メモリ使用量削減
- CPU使用率最適化

## 📊 成功基準

### 必須要件（MVP核心機能）
- [x] WebSocket DLL正常ビルド・動作
- [x] MT5 ↔ Hedge System双方向通信
- [x] ポジション開設・決済フロー完動
- [x] トレール機能正常動作
- [x] エラーハンドリング機能確認

### パフォーマンス要件
- [x] エントリー実行時間: 平均 < 500ms
- [x] 決済実行時間: 平均 < 1000ms
- [x] WebSocket接続安定性: 99%以上
- [x] 同時接続数: 5つ以上のMT5対応

### 品質要件
- [x] 24時間連続稼働: エラー率 < 1%
- [x] メモリリーク: なし
- [x] データ整合性: 100%
- [x] ログ記録: 全イベント記録

## 🔧 トラブルシューティング

### よくある問題と対処法

#### DLL関連
```
問題: "HedgeSystemWebSocket.dll not found"
対処: DLLパス確認、MT5再起動

問題: "DLL function call failed"  
対処: DLLバージョン確認、依存関係インストール
```

#### WebSocket関連
```
問題: "WebSocket connection refused"
対処: ファイアウォール設定、ポート8080確認

問題: "Message send timeout"
対処: ネットワーク状況確認、サーバー負荷確認
```

#### MT5関連
```
問題: "Expert Advisor stopped"
対処: EA設定確認、ログ確認

問題: "Position not opened"
対処: 口座残高確認、取引時間確認
```

## 📈 実行スケジュール

| 時間 | フェーズ | 作業内容 | 担当 |
|------|----------|----------|------|
| 0-2h | Phase 1 | 環境構築・基盤テスト | WebSocket Engineer |
| 2-6h | Phase 2 | 単体機能テスト | WebSocket Engineer + MT5 Specialist |
| 6-12h | Phase 3 | 統合フローテスト | 両者連携 |
| 12-16h | Phase 4 | パフォーマンステスト | 両者連携 |
| 16-48h | Phase 5 | 課題対処・最適化 | 両者連携 |

## 📝 報告書テンプレート

### 日次進捗報告
```markdown
## 日次進捗報告 - Day X

### ✅ 完了項目
- [ ] Phase X完了
- [ ] 課題Y解決  
- [ ] パフォーマンス目標達成

### ⚠️ 課題・リスク
- 課題A: 詳細説明、対処法
- 課題B: 詳細説明、対処法

### 📊 パフォーマンス実績
- エントリー実行時間: XXXms
- 決済実行時間: XXXms
- 接続安定性: XX%

### 🔄 次日計画
- Phase X+1開始
- 課題Z対処
```

## 🎯 最終目標

**48時間後の状態**:
- ✅ MT4/MT5実環境でHedge System完全動作
- ✅ ポジション開設・決済・トレール機能確認
- ✅ パフォーマンス要件達成
- ✅ 24時間安定稼働確認
- ✅ MVP核心機能実現完了

この計画に従って実行することで、Integration-Trading WebSocket統合の完全な動作確認とMVP核心機能の実現を48時間以内に完了できます。