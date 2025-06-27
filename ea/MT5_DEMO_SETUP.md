# MT5 Demo Environment Setup Guide

## 📋 デモ環境セットアップ手順

### 1. デモ口座の準備
推奨ブローカー:
- **XM Trading** - MT5デモ口座（推奨）
- **FXCM** - MT5デモ口座
- **IC Markets** - MT5デモ口座

### 2. MT5インストールと設定

#### 2.1 ファイル配置
```
MT5 Data Folder/
├── MQL5/
│   ├── Experts/
│   │   ├── HedgeSystemConnector.mq5
│   │   └── ReliableWebSocketClient.mq5
│   └── Libraries/
│       └── HedgeSystemWebSocket.dll
```

#### 2.2 DLL許可設定
1. MT5メニュー → ツール → オプション
2. エキスパートアドバイザタブ
3. 以下にチェック:
   - [x] 自動売買を許可する
   - [x] DLLの使用を許可する
   - [x] WebRequestを許可するURLリスト

#### 2.3 WebRequest許可URL
以下のURLを追加:
```
https://your-hedge-system-api.com
wss://your-websocket-url.com
```

### 3. EA設定パラメータ

#### HedgeSystemConnector設定
```mql5
// 基本設定
input string WS_URL = "wss://localhost:3456/ws";  // WebSocket URL
input string AUTH_TOKEN = "demo-auth-token";      // 認証トークン
input int UPDATE_INTERVAL = 1000;                 // 更新間隔(ms)

// パフォーマンス設定
input bool FAST_MODE = true;                      // 高速モード
input int HEARTBEAT_INTERVAL = 5000;              // ハートビート間隔(ms)
input int MAX_RECONNECT_ATTEMPTS = 10;            // 最大再接続試行回数
```

### 4. 接続テスト手順

#### 4.1 初期接続テスト
1. HedgeSystemConnector.mq5をチャートにアタッチ
2. エキスパートログで接続状態確認
3. 期待されるログ:
   ```
   HedgeSystemConnector: Connecting to wss://localhost:3456/ws
   HedgeSystemConnector: Successfully connected
   HedgeSystemConnector: Authentication successful
   ```

#### 4.2 コマンド実行テスト
1. Hedge Systemから以下のテストコマンド送信:
   - OPEN (新規ポジション)
   - CLOSE (ポジション決済)
   - MODIFY (ポジション変更)

### 5. トラブルシューティング

#### DLL読み込みエラー
```
Cannot load 'HedgeSystemWebSocket.dll'
```
解決策:
- DLLファイルの配置確認
- Visual C++ Redistributable 2019インストール
- DLL許可設定の再確認

#### WebSocket接続エラー
```
Failed to connect to WebSocket server
```
解決策:
- URLの確認（ws:// or wss://）
- ファイアウォール設定確認
- WebRequestのURL許可確認

#### 認証エラー
```
Authentication failed
```
解決策:
- AUTH_TOKENの確認
- Hedge System側の認証設定確認

### 6. パフォーマンスチューニング

#### 推奨設定（低レイテンシ環境）
```mql5
UPDATE_INTERVAL = 100        // 100ms更新
FAST_MODE = true            // 高速モード有効
HEARTBEAT_INTERVAL = 5000   // 5秒ハートビート
```

#### 推奨設定（安定性重視）
```mql5
UPDATE_INTERVAL = 1000      // 1秒更新
FAST_MODE = false          // 通常モード
HEARTBEAT_INTERVAL = 10000 // 10秒ハートビート
```

## 📊 動作確認チェックリスト

- [ ] MT5デモ口座開設完了
- [ ] MT5ターミナルインストール完了
- [ ] DLL許可設定完了
- [ ] WebRequest URL許可設定完了
- [ ] HedgeSystemConnector.mq5配置完了
- [ ] HedgeSystemWebSocket.dll配置完了
- [ ] 初期接続テスト成功
- [ ] OPEN/CLOSEコマンドテスト成功
- [ ] 24時間連続稼働テスト開始

## 🔗 関連ドキュメント
- [HedgeSystemConnector実装詳細](./HedgeSystemConnector.mq5)
- [WebSocket DLLビルド手順](./websocket-dll/README.md)
- [MVPシステム設計書](../MVPシステム設計.md)