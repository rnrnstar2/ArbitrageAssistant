#pragma once

#ifndef HEDGESYSTEMWEBSOCKET_H
#define HEDGESYSTEMWEBSOCKET_H

#ifdef __cplusplus
extern "C" {
#endif

#ifdef HEDGESYSTEMWEBSOCKET_EXPORTS
#define HEDGESYSTEMWEBSOCKET_API __declspec(dllexport)
#else
#define HEDGESYSTEMWEBSOCKET_API __declspec(dllimport)
#endif

// WebSocket接続関数
HEDGESYSTEMWEBSOCKET_API bool WSConnect(const char* url, const char* token);

// WebSocket切断関数
HEDGESYSTEMWEBSOCKET_API void WSDisconnect();

// メッセージ送信関数
HEDGESYSTEMWEBSOCKET_API bool WSSendMessage(const char* message);

// メッセージ受信関数（ノンブロッキング）
HEDGESYSTEMWEBSOCKET_API const char* WSReceiveMessage();

// 接続状態確認関数
HEDGESYSTEMWEBSOCKET_API bool WSIsConnected();

// エラー取得関数
HEDGESYSTEMWEBSOCKET_API const char* WSGetLastError();

// リソース解放関数
HEDGESYSTEMWEBSOCKET_API void WSFreeString(const char* str);

#ifdef __cplusplus
}
#endif

#endif // HEDGESYSTEMWEBSOCKET_H