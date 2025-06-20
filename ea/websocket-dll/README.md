# HedgeSystem WebSocket DLL

MT4/MT5のExpert Advisor（EA）からWebSocket通信を行うためのC++ DLLライブラリです。

## 概要

このDLLは、MT4/MT5のEAとHedge SystemのWebSocketサーバー間で双方向通信を行うためのインターフェースを提供します。

## 機能

- WebSocket接続の確立と管理
- メッセージの送受信
- 自動再接続機能
- TLS/SSL暗号化対応
- エラーハンドリング

## ビルド要件

### Windows (推奨)
- Visual Studio 2019以降
- CMake 3.15以降
- OpenSSL
- websocketpp（自動ダウンロード）
- asio（自動ダウンロード）

### 依存関係のインストール

#### OpenSSLのインストール（Windows）
```bash
# vcpkgを使用する場合
vcpkg install openssl:x64-windows

# または、公式サイトからダウンロード
# https://slproweb.com/products/Win32OpenSSL.html
```

## ビルド手順

### Windows（Visual Studio）
```bash
mkdir build
cd build
cmake .. -G "Visual Studio 16 2019" -A x64
cmake --build . --config Release
```

### Windows（MinGW）
```bash
mkdir build
cd build
cmake .. -G "MinGW Makefiles"
make
```

## 使用方法

### 1. DLLファイルの配置
ビルドされた`HedgeSystemWebSocket.dll`をMT4/MT5の`Libraries`フォルダに配置します。

**MT4の場合:**
```
C:\Users\[ユーザー名]\AppData\Roaming\MetaQuotes\Terminal\[Terminal ID]\MQL4\Libraries\
```

**MT5の場合:**
```
C:\Users\[ユーザー名]\AppData\Roaming\MetaQuotes\Terminal\[Terminal ID]\MQL5\Libraries\
```

### 2. EAでの使用例

```mql5
#import "HedgeSystemWebSocket.dll"
   bool WSConnect(string url, string token);
   void WSDisconnect();
   bool WSSendMessage(string message);
   string WSReceiveMessage();
   bool WSIsConnected();
   string WSGetLastError();
#import

// 接続
bool connected = WSConnect("wss://your-server.com/ws", "your-auth-token");

// メッセージ送信
if (connected) {
    string message = "{\"type\":\"position_update\",\"data\":{}}";
    WSS endMessage(message);
}

// メッセージ受信
string receivedMessage = WSReceiveMessage();
if (receivedMessage != "") {
    // 受信したメッセージを処理
    Print("Received: " + receivedMessage);
}

// 接続状態確認
if (!WSIsConnected()) {
    Print("Connection lost");
}

// 切断
WSDisconnect();
```

## API リファレンス

### WSConnect
```cpp
bool WSConnect(const char* url, const char* token)
```
WebSocketサーバーに接続します。

**パラメータ:**
- `url`: WebSocketサーバーのURL（例: "wss://server.com/ws"）
- `token`: 認証トークン

**戻り値:**
- `true`: 接続成功
- `false`: 接続失敗

### WSDisconnect
```cpp
void WSDisconnect()
```
WebSocket接続を切断します。

### WSSendMessage
```cpp
bool WSSendMessage(const char* message)
```
メッセージを送信します。

**パラメータ:**
- `message`: 送信するメッセージ（JSON文字列を推奨）

**戻り値:**
- `true`: 送信成功
- `false`: 送信失敗

### WSReceiveMessage
```cpp
const char* WSReceiveMessage()
```
受信したメッセージを取得します（ノンブロッキング）。

**戻り値:**
- 受信したメッセージ文字列
- 空文字列: 受信メッセージなし

### WSIsConnected
```cpp
bool WSIsConnected()
```
接続状態を確認します。

**戻り値:**
- `true`: 接続中
- `false`: 切断中

### WSGetLastError
```cpp
const char* WSGetLastError()
```
最後に発生したエラーメッセージを取得します。

**戻り値:**
- エラーメッセージ文字列

## 設定とカスタマイズ

### タイムアウト設定
接続タイムアウトは現在5秒に設定されています。必要に応じてソースコードを修正してください。

### ログレベル
デバッグ用にログレベルを調整する場合は、`HedgeSystemWebSocket.cpp`の以下の行を修正してください：

```cpp
// ログを有効にする場合
m_client.set_access_channels(websocketpp::log::alevel::all);
m_client.set_error_channels(websocketpp::log::elevel::all);
```

## トラブルシューティング

### よくある問題

#### 1. DLLが読み込まれない
- DLLファイルが正しいディレクトリに配置されているか確認
- DLLの依存関係（OpenSSL等）が満たされているか確認
- MT4/MT5のDLL使用許可設定を確認

#### 2. 接続エラー
- WebSocketサーバーのURLが正しいか確認
- 認証トークンが有効か確認
- ファイアウォール設定を確認
- `WSGetLastError()`でエラー詳細を確認

#### 3. メッセージが受信されない
- `WSReceiveMessage()`を定期的に呼び出しているか確認
- サーバーから実際にメッセージが送信されているか確認

### デバッグ方法

1. ログの有効化
2. `WSGetLastError()`でエラー確認
3. サーバー側のログ確認
4. ネットワークトラフィックの監視

## セキュリティ注意事項

- 認証トークンは安全に管理してください
- 本番環境では必ずTLS/SSL暗号化を使用してください
- 定期的にトークンを更新することを推奨します

## ライセンス

このプロジェクトはArbitrageAssistantプロジェクトの一部として開発されています。

## サポート

問題や質問がある場合は、プロジェクトのIssueトラッカーに投稿してください。