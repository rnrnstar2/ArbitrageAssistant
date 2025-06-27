# MT5 Production Deployment Guide

## 🚀 48時間以内完了計画

### Phase 1: 前提条件確認 (0-2時間)

#### WebSocket DLL確認
```bash
# WebSocket DLLビルド状況確認
ls -la websocket-dll/build/
# 期待結果: HedgeSystemWebSocket.dll

# DLLテスト実行
cd websocket-dll
./run_test.sh
```

#### MT5環境準備
- **MT5 Build 3200+** 確認
- **デモ口座開設**: XM Trading または FXCM
- **DLL許可設定**: ツール→オプション→エキスパート

### Phase 2: 統合テスト (2-8時間)

#### 1. WebSocket通信テスト
```mql5
// テスト用パラメータ設定
WS_URL = "wss://localhost:3456/ws"  // 開発環境
AUTH_TOKEN = "demo-test-token"
DEBUG_MODE = true
FAST_MODE = false  // 安定性優先
```

#### 2. position-execution.ts連携確認
| テストケース | 期待結果 | 確認方法 |
|-------------|----------|----------|
| OPEN Command | WSOpenedEvent送信 | ログ確認 |
| CLOSE Command | WSClosedEvent送信 | ログ確認 |
| Trail Triggered | Trail発動処理 | ポジション更新確認 |
| Stop Loss | WSStoppedEvent送信 | ログ確認 |

#### 3. パフォーマンステスト
```bash
# E2Eテスト実行
# MT5でmt5-e2e-test.mq5を実行
# 結果確認: レイテンシ < 10ms, 成功率 > 95%
```

### Phase 3: 本番環境デプロイ (8-24時間)

#### 1. 本番設定適用
```mql5
// 本番用パラメータ
WS_URL = "wss://production-url.com/ws"
AUTH_TOKEN = "production-auth-token"
DEBUG_MODE = false
FAST_MODE = true
MAX_RECONNECT = 20  // 本番環境では高めに設定
```

#### 2. リアル口座接続
- **最小Lot**: 0.01で初期テスト
- **監視体制**: 24時間監視開始
- **エラーアラート**: Slackまたはメール通知設定

#### 3. 段階的展開
1. **1アカウント**: 24時間テスト
2. **3アカウント**: 48時間テスト
3. **全アカウント**: 本格運用開始

### Phase 4: 24時間監視 (24-48時間)

#### 監視項目
- **接続安定性**: 99%以上維持
- **レイテンシ**: 平均 < 10ms
- **エラー率**: < 1%
- **トレール精度**: 100%

#### 緊急時対応
```bash
# 緊急停止
pkill -f HedgeSystemConnector
# ログ確認
tail -f /path/to/mt5/logs/
```

## 📊 本番環境要件

### システム要件
- **OS**: Windows 10/11 または Windows Server 2019+
- **MT5**: Build 3200以上
- **CPU**: 4コア以上推奨
- **RAM**: 8GB以上
- **ネットワーク**: 安定した高速接続

### セキュリティ要件
- **ファイアウォール**: WebSocket ポート開放
- **認証**: 本番用JWT トークン
- **ログ**: 全イベント記録
- **バックアップ**: 設定ファイル自動バックアップ

### パフォーマンス要件
- **レイテンシ**: < 10ms (目標: 5ms以下)
- **スループット**: 1000 req/sec
- **可用性**: 99.9%
- **復旧時間**: < 30秒

## 🔧 設定ファイル

### MT5 EA設定
```ini
; HedgeSystemConnector設定
WS_URL=wss://production.hedgesystem.com/ws
AUTH_TOKEN=prod_token_2024_secure
UPDATE_INTERVAL=500
FAST_MODE=true
HEARTBEAT_INTERVAL=3000
MAX_RECONNECT=20
DEBUG_MODE=false
```

### Hedge System設定
```typescript
// apps/hedge-system/lib/websocket-server.ts
const CONFIG = {
  port: 3456,
  maxConnections: 100,
  heartbeatInterval: 30000,
  reconnectTimeout: 5000,
  messageQueueSize: 1000
}
```

## 🚨 トラブルシューティング

### 接続問題
```bash
# 1. DLL配置確認
ls "C:\Users\[User]\AppData\Roaming\MetaQuotes\Terminal\[ID]\MQL5\Libraries\HedgeSystemWebSocket.dll"

# 2. ポート確認
netstat -an | findstr 3456

# 3.認証確認
# AuthTokenの有効性をWebアプリで確認
```

### パフォーマンス問題
```mql5
// デバッグモード有効化
input bool DEBUG_MODE = true;

// レイテンシ測定
datetime start = GetMicrosecondCount();
// 処理実行
double latency = (GetMicrosecondCount() - start) / 1000.0;
```

### エラー対応
| エラー | 原因 | 対処法 |
|--------|------|--------|
| Connection Refused | WebSocketサーバー停止 | サーバー再起動 |
| Authentication Failed | 無効なトークン | トークン更新 |
| DLL Load Error | DLL配置不備 | DLL再配置・権限確認 |
| High Latency | ネットワーク遅延 | 接続先変更・設定調整 |

## 📈 成功指標

### 24時間後の目標
- ✅ 全EA接続安定 (99%+)
- ✅ レイテンシ目標達成 (< 10ms)
- ✅ トレール機能100%動作
- ✅ エラー率最小化 (< 1%)

### 48時間後の目標
- ✅ 本格運用開始準備完了
- ✅ 監視体制確立
- ✅ パフォーマンス最適化完了
- ✅ ドキュメント整備完了

## 🔗 関連リソース

### ドキュメント
- [MT5 Demo Setup Guide](./MT5_DEMO_SETUP.md)
- [E2E Test Report](./TEST_REPORT.md)
- [WebSocket DLL Build Guide](./websocket-dll/README.md)

### 監視ツール
- **Hedge System Dashboard**: http://localhost:3000
- **MT5 Expert Log**: Terminal→Experts タブ
- **System Monitor**: Task Manager→Performance

### サポート連絡先
- **Trading Team**: trading-director
- **Integration Team**: integration-director
- **WebSocket Team**: websocket-engineer