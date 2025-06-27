# WebSocket DLL Build Guide

## 概要
HedgeSystemWebSocket DLLは、MT4/MT5とWebSocketサーバー間の通信を可能にするC++ライブラリです。

## 必要な環境

### Windows
- Visual Studio 2019/2022 (C++開発ツール)
- CMake 3.15以上
- OpenSSL 1.1.1以上
- Git

### macOS/Linux
- CMake 3.15以上
- C++17対応コンパイラ (clang++ または g++)
- OpenSSL
- Git
- websocketpp
- asio

## ビルド手順

### Windows

1. **依存関係のインストール**
   ```cmd
   # OpenSSLをダウンロード・インストール
   # https://slproweb.com/products/Win32OpenSSL.html
   ```

2. **ビルド実行**
   ```cmd
   # 64ビット版
   build.bat x64
   
   # 32ビット版
   build.bat x86
   ```

3. **成果物の確認**
   - `build/x64/Release/HedgeSystemWebSocket.dll` (64ビット)
   - `build/x86/Release/HedgeSystemWebSocket.dll` (32ビット)

### macOS/Linux

1. **依存関係のインストール**
   ```bash
   # macOS
   brew install cmake openssl websocketpp asio
   
   # Ubuntu/Debian
   sudo apt-get install cmake libssl-dev libwebsocketpp-dev libasio-dev
   ```

2. **ビルド実行**
   ```bash
   # ビルドスクリプトに実行権限を付与
   chmod +x build.sh
   
   # ビルド実行
   ./build.sh
   ```

3. **成果物の確認**
   - macOS: `build/libHedgeSystemWebSocket.dylib`
   - Linux: `build/libHedgeSystemWebSocket.so`

## トラブルシューティング

### macOS: C++標準ライブラリが見つからない場合

macOS Sequoia 15以降で、Xcode Command Line Toolsのインストールに問題がある場合：

1. **Xcodeのフルインストール**
   - App StoreからXcodeをインストール
   - Xcodeを一度起動して、追加コンポーネントをインストール

2. **Command Line Toolsの再インストール**
   ```bash
   sudo rm -rf /Library/Developer/CommandLineTools
   xcode-select --install
   ```

3. **GCCの使用（代替案）**
   ```bash
   brew install gcc
   # CMakeLists.txtでコンパイラを指定
   cmake -DCMAKE_CXX_COMPILER=g++-15 ..
   ```

### Windows: OpenSSLが見つからない場合

1. OpenSSLのインストールパスを確認
2. 環境変数 `OPENSSL_ROOT_DIR` を設定：
   ```cmd
   set OPENSSL_ROOT_DIR=C:\Program Files\OpenSSL-Win64
   ```

### ビルドエラーの一般的な対処法

1. **クリーンビルド**
   ```bash
   # macOS/Linux
   ./build.sh clean
   ./build.sh
   
   # Windows
   rmdir /s /q build
   build.bat
   ```

2. **CMakeキャッシュのクリア**
   ```bash
   rm -rf build/CMakeCache.txt
   ```

## MT5での使用方法

1. **DLLファイルの配置**
   - MT5インストールディレクトリの `MQL5/Libraries/` にDLLをコピー

2. **EA側の実装**
   ```mql5
   #import "HedgeSystemWebSocket.dll"
   int WSConnect(string url, string token);
   void WSDisconnect();
   int WSSendMessage(string message);
   string WSReceiveMessage();
   int WSIsConnected();
   #import
   ```

3. **MT5設定**
   - ツール → オプション → エキスパートアドバイザ
   - 「DLLの使用を許可する」にチェック

## API仕様

### 基本関数
- `WSConnect(url, token)` - WebSocket接続を確立
- `WSDisconnect()` - 接続を切断
- `WSSendMessage(message)` - メッセージ送信
- `WSReceiveMessage()` - メッセージ受信（非ブロッキング）
- `WSIsConnected()` - 接続状態確認

### パフォーマンス監視関数
- `WSGetMessagesSent()` - 送信メッセージ数
- `WSGetMessagesReceived()` - 受信メッセージ数
- `WSGetQueueSize()` - キューサイズ
- `WSGetReconnectAttempts()` - 再接続試行回数

## ビルド設定のカスタマイズ

`CMakeLists.txt` で以下の設定が可能：
- C++標準バージョン（デフォルト: C++17）
- 最適化レベル
- デバッグシンボル
- 静的/動的リンク

## パフォーマンス最適化

- リングバッファによる高速メッセージキュー
- ロックフリーアルゴリズムの使用
- 自動再接続機能
- ハートビート管理