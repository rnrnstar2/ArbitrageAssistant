#!/bin/bash

# WebSocket DLL テストビルドスクリプト
# Usage: ./build_test.sh

echo "=== WebSocket DLL テストビルド ==="

# 必要なライブラリの確認
echo "依存関係の確認..."
if ! pkg-config --exists openssl; then
    echo "❌ OpenSSLが見つかりません。インストールしてください："
    echo "   macOS: brew install openssl"
    echo "   Ubuntu: sudo apt-get install libssl-dev"
    exit 1
fi

# WebSocket++ ヘッダーの確認
if [ ! -d "/usr/local/include/websocketpp" ] && [ ! -d "/opt/homebrew/include/websocketpp" ]; then
    echo "❌ WebSocket++が見つかりません。インストールしてください："
    echo "   macOS: brew install websocketpp"
    echo "   Ubuntu: sudo apt-get install libwebsocketpp-dev"
    exit 1
fi

echo "✅ 依存関係OK"

# コンパイラーオプションの設定
CXX="g++"
CXXFLAGS="-std=c++11 -O2 -Wall -Wextra"
INCLUDES="-I. -I/usr/local/include -I/opt/homebrew/include"
LIBS="-lssl -lcrypto -lpthread"

# macOS特有の設定
if [[ "$OSTYPE" == "darwin"* ]]; then
    LIBS="$LIBS -framework Security -framework CoreFoundation"
    if [ -d "/opt/homebrew/lib" ]; then
        LIBS="-L/opt/homebrew/lib $LIBS"
    fi
fi

echo "コンパイル中..."

# DLL/共有ライブラリのビルド
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS (.dylib)
    $CXX $CXXFLAGS $INCLUDES -shared -fPIC \
        -DHEDGESYSTEMWEBSOCKET_EXPORTS \
        -o libHedgeSystemWebSocket.dylib \
        HedgeSystemWebSocket.cpp \
        $LIBS
    
    if [ $? -eq 0 ]; then
        echo "✅ DLL (.dylib) ビルド成功"
    else
        echo "❌ DLL ビルド失敗"
        exit 1
    fi
    
    # テストプログラムのビルド
    $CXX $CXXFLAGS $INCLUDES \
        -o test_websocket \
        test_websocket.cpp \
        -L. -lHedgeSystemWebSocket \
        $LIBS
        
    if [ $? -eq 0 ]; then
        echo "✅ テストプログラム ビルド成功"
    else
        echo "❌ テストプログラム ビルド失敗"
        exit 1
    fi
    
else
    # Linux (.so)
    $CXX $CXXFLAGS $INCLUDES -shared -fPIC \
        -DHEDGESYSTEMWEBSOCKET_EXPORTS \
        -o libHedgeSystemWebSocket.so \
        HedgeSystemWebSocket.cpp \
        $LIBS
    
    if [ $? -eq 0 ]; then
        echo "✅ DLL (.so) ビルド成功"
    else
        echo "❌ DLL ビルド失敗"
        exit 1
    fi
    
    # テストプログラムのビルド
    $CXX $CXXFLAGS $INCLUDES \
        -o test_websocket \
        test_websocket.cpp \
        -L. -lHedgeSystemWebSocket \
        $LIBS
        
    if [ $? -eq 0 ]; then
        echo "✅ テストプログラム ビルド成功"
    else
        echo "❌ テストプログラム ビルド失敗"
        exit 1
    fi
fi

# 実行権限の付与
chmod +x test_websocket

echo ""
echo "=== ビルド完了 ==="
echo "DLLファイル: $(ls -la lib*.{dylib,so} 2>/dev/null | head -1)"
echo "テストファイル: $(ls -la test_websocket)"
echo ""
echo "テスト実行方法:"
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "  export DYLD_LIBRARY_PATH=\$DYLD_LIBRARY_PATH:."
else
    echo "  export LD_LIBRARY_PATH=\$LD_LIBRARY_PATH:."
fi
echo "  ./test_websocket"
echo ""
echo "または:"
echo "  ./run_test.sh"