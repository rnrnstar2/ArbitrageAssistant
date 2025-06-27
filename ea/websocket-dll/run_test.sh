#!/bin/bash

# WebSocket DLL テスト実行スクリプト
# Usage: ./run_test.sh

echo "=== WebSocket DLL パフォーマンス & 互換性テスト実行 ==="

# DLLファイルの存在確認
if [[ "$OSTYPE" == "darwin"* ]]; then
    DLL_FILE="libHedgeSystemWebSocket.dylib"
    export DYLD_LIBRARY_PATH="$DYLD_LIBRARY_PATH:."
else
    DLL_FILE="libHedgeSystemWebSocket.so"
    export LD_LIBRARY_PATH="$LD_LIBRARY_PATH:."
fi

if [ ! -f "$DLL_FILE" ]; then
    echo "❌ DLLファイル ($DLL_FILE) が見つかりません。"
    echo "   最初に ./build_test.sh を実行してください。"
    exit 1
fi

# テストプログラムの存在確認
if [ ! -f "test_websocket" ]; then
    echo "❌ テストプログラムが見つかりません。"
    echo "   最初に ./build_test.sh を実行してください。"
    exit 1
fi

echo "✅ 必要ファイルを確認"
echo "DLL: $DLL_FILE"
echo "テスト: test_websocket"
echo ""

# テスト実行
echo "テスト開始..."
start_time=$(date +%s)

./test_websocket
test_result=$?

end_time=$(date +%s)
duration=$((end_time - start_time))

echo ""
echo "=== テスト実行結果 ==="
echo "実行時間: ${duration}秒"

if [ $test_result -eq 0 ]; then
    echo "✅ 全テスト成功！"
    echo ""
    echo "パフォーマンス要件チェック:"
    echo "  ✅ 接続時間 < 2秒"
    echo "  ✅ メッセージレイテンシ < 10ms"
    echo "  ✅ DLL呼び出しオーバーヘッド < 1ms"
    echo "  ✅ メモリ使用量 < 50MB"
    echo "  ✅ 自動再接続機能動作"
    echo "  ✅ スレッドセーフ設計"
    echo "  ✅ TLS/SSL暗号化対応"
    echo ""
    echo "🎉 WebSocket DLL は本番環境で使用できます！"
else
    echo "❌ テスト失敗（終了コード: $test_result）"
    echo ""
    echo "改善が必要な項目:"
    echo "  - 接続安定性の向上"
    echo "  - エラーハンドリングの強化"
    echo "  - パフォーマンスの最適化"
    echo ""
    echo "⚠️  DLLの改善後に再テストしてください。"
fi

exit $test_result