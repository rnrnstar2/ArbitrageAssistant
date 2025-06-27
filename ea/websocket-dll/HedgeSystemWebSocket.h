#pragma once

#ifndef HEDGESYSTEMWEBSOCKET_H
#define HEDGESYSTEMWEBSOCKET_H

#include <stdint.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

// Platform-specific export/import macros
#ifdef _WIN32
    #ifdef HEDGESYSTEMWEBSOCKET_EXPORTS
        #define HEDGESYSTEMWEBSOCKET_API __declspec(dllexport)
    #else
        #define HEDGESYSTEMWEBSOCKET_API __declspec(dllimport)
    #endif
#else
    // On macOS/Linux, use visibility attributes
    #ifdef HEDGESYSTEMWEBSOCKET_EXPORTS
        #define HEDGESYSTEMWEBSOCKET_API __attribute__((visibility("default")))
    #else
        #define HEDGESYSTEMWEBSOCKET_API
    #endif
#endif

// WebSocket接続関数
HEDGESYSTEMWEBSOCKET_API int WSConnect(const char* url, const char* token);

// WebSocket切断関数
HEDGESYSTEMWEBSOCKET_API void WSDisconnect();

// メッセージ送信関数
HEDGESYSTEMWEBSOCKET_API int WSSendMessage(const char* message);

// メッセージ受信関数（ノンブロッキング）
HEDGESYSTEMWEBSOCKET_API const char* WSReceiveMessage();

// 接続状態確認関数
HEDGESYSTEMWEBSOCKET_API int WSIsConnected();

// エラー取得関数
HEDGESYSTEMWEBSOCKET_API const char* WSGetLastError();

// リソース解放関数
HEDGESYSTEMWEBSOCKET_API void WSFreeString(const char* str);

// パフォーマンス監視API
HEDGESYSTEMWEBSOCKET_API uint64_t WSGetMessagesSent();
HEDGESYSTEMWEBSOCKET_API uint64_t WSGetMessagesReceived();
HEDGESYSTEMWEBSOCKET_API size_t WSGetQueueSize();
HEDGESYSTEMWEBSOCKET_API int WSGetReconnectAttempts();
HEDGESYSTEMWEBSOCKET_API int WSGetConnectionState();
HEDGESYSTEMWEBSOCKET_API uint64_t WSGetConnectionDurationMs();

// DLL管理API
HEDGESYSTEMWEBSOCKET_API void WSCleanup();

#ifdef __cplusplus
}
#endif

#endif // HEDGESYSTEMWEBSOCKET_H