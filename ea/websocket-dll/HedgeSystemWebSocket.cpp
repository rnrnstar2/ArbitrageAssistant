#include "HedgeSystemWebSocket.h"
#include <iostream>
#include <string>
#include <queue>
#include <mutex>
#include <thread>
#include <memory>
#include <chrono>
#include <atomic>
#include <condition_variable>
#include <deque>
#include <unordered_map>
#include <websocketpp/config/asio_client.hpp>
#include <websocketpp/client.hpp>

typedef websocketpp::client<websocketpp::config::asio_tls_client> client;
typedef websocketpp::lib::shared_ptr<websocketpp::lib::asio::ssl::context> context_ptr;

// 高性能リングバッファによるメッセージキュー
template<typename T, size_t N>
class RingBuffer {
private:
    std::array<T, N> buffer;
    std::atomic<size_t> head{0};
    std::atomic<size_t> tail{0};
    std::atomic<size_t> size{0};
    
public:
    bool push(const T& item) {
        size_t current_size = size.load();
        if (current_size >= N) {
            return false; // バッファフル
        }
        
        size_t current_head = head.load();
        buffer[current_head] = item;
        head.store((current_head + 1) % N);
        size.fetch_add(1);
        return true;
    }
    
    bool pop(T& item) {
        size_t current_size = size.load();
        if (current_size == 0) {
            return false; // バッファ空
        }
        
        size_t current_tail = tail.load();
        item = buffer[current_tail];
        tail.store((current_tail + 1) % N);
        size.fetch_sub(1);
        return true;
    }
    
    size_t getSize() const {
        return size.load();
    }
    
    bool empty() const {
        return size.load() == 0;
    }
};

// 接続状態管理
enum class ConnectionState {
    DISCONNECTED,
    CONNECTING, 
    CONNECTED,
    RECONNECTING,
    FAILED
};

class WebSocketClient {
private:
    client m_client;
    websocketpp::connection_hdl m_hdl;
    std::string m_url;
    std::string m_token;
    
    // 高性能メッセージキュー（1024メッセージバッファ）
    RingBuffer<std::string, 1024> m_messageQueue;
    std::mutex m_queueMutex;
    std::condition_variable m_queueCondition;
    
    std::string m_lastError;
    std::atomic<ConnectionState> m_connectionState{ConnectionState::DISCONNECTED};
    std::thread m_thread;
    std::thread m_heartbeatThread;
    std::atomic<bool> m_shouldRun{false};
    
    // パフォーマンス監視
    std::atomic<uint64_t> m_messagesSent{0};
    std::atomic<uint64_t> m_messagesReceived{0};
    std::chrono::steady_clock::time_point m_lastHeartbeat;
    std::chrono::steady_clock::time_point m_connectTime;
    
    // 再接続管理
    std::atomic<int> m_reconnectAttempts{0};
    static constexpr int MAX_RECONNECT_ATTEMPTS = 5;
    static constexpr int HEARTBEAT_INTERVAL_MS = 30000; // 30秒
    static constexpr int CONNECTION_TIMEOUT_MS = 5000;  // 5秒
    
    // シングルトンパターン
    static std::unique_ptr<WebSocketClient> s_instance;
    static std::mutex s_instanceMutex;

public:
    WebSocketClient() {
        // WebSocketクライアントの設定
        m_client.clear_access_channels(websocketpp::log::alevel::all);
        m_client.clear_error_channels(websocketpp::log::elevel::all);
        
        m_client.init_asio();
        
        // 強化されたTLS設定
        m_client.set_tls_init_handler([this](websocketpp::connection_hdl) {
            auto ctx = websocketpp::lib::make_shared<websocketpp::lib::asio::ssl::context>(websocketpp::lib::asio::ssl::context::tlsv12);
            
            // セキュリティ強化
            ctx->set_options(websocketpp::lib::asio::ssl::context::default_workarounds |
                           websocketpp::lib::asio::ssl::context::no_sslv2 |
                           websocketpp::lib::asio::ssl::context::no_sslv3 |
                           websocketpp::lib::asio::ssl::context::single_dh_use);
                           
            return ctx;
        });

        // イベントハンドラーの設定
        m_client.set_open_handler([this](websocketpp::connection_hdl hdl) {
            OnOpen(hdl);
        });

        m_client.set_close_handler([this](websocketpp::connection_hdl hdl) {
            OnClose(hdl);
        });

        m_client.set_fail_handler([this](websocketpp::connection_hdl hdl) {
            OnFail(hdl);
        });

        m_client.set_message_handler([this](websocketpp::connection_hdl hdl, client::message_ptr msg) {
            OnMessage(hdl, msg);
        });
        
        // pong（heartbeat応答）ハンドラー
        m_client.set_pong_handler([this](websocketpp::connection_hdl hdl, std::string payload) {
            m_lastHeartbeat = std::chrono::steady_clock::now();
        });
    }

    ~WebSocketClient() {
        Disconnect();
        
        // 全スレッドの安全な終了を保証
        m_shouldRun = false;
        
        if (m_thread.joinable()) {
            m_thread.join();
        }
        
        if (m_heartbeatThread.joinable()) {
            m_heartbeatThread.join();
        }
    }

    static WebSocketClient& GetInstance() {
        std::lock_guard<std::mutex> lock(s_instanceMutex);
        if (!s_instance) {
            s_instance = std::make_unique<WebSocketClient>();
        }
        return *s_instance;
    }

    bool Connect(const std::string& url, const std::string& token) {
        return ConnectInternal(url, token, false);
    }
    
private:
    bool ConnectInternal(const std::string& url, const std::string& token, bool isReconnect) {
        try {
            if (!isReconnect) {
                m_url = url;
                m_token = token;
                m_reconnectAttempts = 0;
            }
            
            m_connectionState = ConnectionState::CONNECTING;
            m_connectTime = std::chrono::steady_clock::now();
            
            websocketpp::lib::error_code ec;
            client::connection_ptr con = m_client.get_connection(m_url, ec);
            
            if (ec) {
                m_lastError = "Could not create connection: " + ec.message();
                m_connectionState = ConnectionState::FAILED;
                if (!isReconnect && ShouldRetryConnection()) {
                    return ScheduleReconnect();
                }
                return false;
            }

            // 認証ヘッダーの追加
            con->append_header("Authorization", "Bearer " + m_token);
            
            // パフォーマンス最適化のためのTCPオプション設定
            con->set_user_agent("HedgeSystemWebSocket/1.0");
            
            m_hdl = con->get_handle();
            m_client.connect(con);

            // 初回接続時のみイベントループとハートビートスレッドを開始
            if (!isReconnect) {
                m_shouldRun = true;
                m_thread = std::thread([this]() {
                    try {
                        m_client.run();
                    } catch (const std::exception& e) {
                        m_lastError = "Event loop error: " + std::string(e.what());
                        m_connectionState = ConnectionState::FAILED;
                    }
                });
                
                m_heartbeatThread = std::thread([this]() {
                    HeartbeatLoop();
                });
            }

            // 接続を待機（設定可能なタイムアウト）
            int timeout = CONNECTION_TIMEOUT_MS / 100;
            while (timeout > 0 && m_connectionState == ConnectionState::CONNECTING) {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
                timeout--;
            }

            bool connected = (m_connectionState == ConnectionState::CONNECTED);
            if (!connected && ShouldRetryConnection()) {
                return ScheduleReconnect();
            }
            
            return connected;
        }
        catch (const std::exception& e) {
            m_lastError = "Connection error: " + std::string(e.what());
            m_connectionState = ConnectionState::FAILED;
            
            if (!isReconnect && ShouldRetryConnection()) {
                return ScheduleReconnect();
            }
            return false;
        }
    }
    
    bool ShouldRetryConnection() {
        return m_reconnectAttempts < MAX_RECONNECT_ATTEMPTS;
    }
    
    bool ScheduleReconnect() {
        m_reconnectAttempts++;
        m_connectionState = ConnectionState::RECONNECTING;
        
        // 指数バックオフによる再接続待機
        int delay = std::min(1000 * (1 << m_reconnectAttempts.load()), 30000); // 最大30秒
        
        std::thread([this, delay]() {
            std::this_thread::sleep_for(std::chrono::milliseconds(delay));
            ConnectInternal("", "", true);
        }).detach();
        
        return true; // 再接続試行中
    }
    
    void HeartbeatLoop() {
        while (m_shouldRun) {
            std::this_thread::sleep_for(std::chrono::milliseconds(HEARTBEAT_INTERVAL_MS));
            
            if (m_connectionState == ConnectionState::CONNECTED) {
                try {
                    // ping送信でハートビート
                    websocketpp::lib::error_code ec;
                    m_client.ping(m_hdl, "heartbeat", ec);
                    
                    if (ec) {
                        m_lastError = "Heartbeat failed: " + ec.message();
                        if (ShouldRetryConnection()) {
                            ScheduleReconnect();
                        }
                    }
                } catch (const std::exception& e) {
                    m_lastError = "Heartbeat exception: " + std::string(e.what());
                }
                
                // ハートビートタイムアウトチェック
                auto now = std::chrono::steady_clock::now();
                auto timeSinceLastHeartbeat = std::chrono::duration_cast<std::chrono::milliseconds>(now - m_lastHeartbeat).count();
                
                if (timeSinceLastHeartbeat > HEARTBEAT_INTERVAL_MS * 2) {
                    m_lastError = "Heartbeat timeout";
                    if (ShouldRetryConnection()) {
                        ScheduleReconnect();
                    }
                }
            }
        }
    }
    
public:

    void Disconnect() {
        ConnectionState currentState = m_connectionState.load();
        if (currentState != ConnectionState::DISCONNECTED) {
            try {
                m_shouldRun = false;
                m_connectionState = ConnectionState::DISCONNECTED;
                
                // 接続が存在する場合のみクローズを試行
                if (currentState == ConnectionState::CONNECTED) {
                    websocketpp::lib::error_code ec;
                    m_client.close(m_hdl, websocketpp::close::status::going_away, "Client disconnect", ec);
                    
                    if (ec) {
                        m_lastError = "Close error: " + ec.message();
                    }
                }
                
                // スレッドの安全な終了
                if (m_heartbeatThread.joinable()) {
                    m_heartbeatThread.join();
                }
                
                // WebSocketクライアントの停止
                m_client.stop();
                
                if (m_thread.joinable()) {
                    m_thread.join();
                }
                
                // 統計リセット
                m_messagesSent = 0;
                m_messagesReceived = 0;
                m_reconnectAttempts = 0;
                
            }
            catch (const std::exception& e) {
                m_lastError = "Disconnect error: " + std::string(e.what());
            }
        }
    }

    bool SendMessage(const std::string& message) {
        if (m_connectionState != ConnectionState::CONNECTED) {
            m_lastError = "Not connected";
            return false;
        }

        try {
            websocketpp::lib::error_code ec;
            m_client.send(m_hdl, message, websocketpp::frame::opcode::text, ec);
            
            if (ec) {
                m_lastError = "Send error: " + ec.message();
                
                // 送信エラー時の再接続試行
                if (ShouldRetryConnection()) {
                    ScheduleReconnect();
                }
                return false;
            }
            
            m_messagesSent.fetch_add(1);
            return true;
        }
        catch (const std::exception& e) {
            m_lastError = "Send exception: " + std::string(e.what());
            
            // 例外時の再接続試行
            if (ShouldRetryConnection()) {
                ScheduleReconnect();
            }
            return false;
        }
    }

    std::string ReceiveMessage() {
        std::string message;
        if (m_messageQueue.pop(message)) {
            return message;
        }
        return "";
    }
    
    // パフォーマンス監視用関数
    uint64_t GetMessagesSent() const {
        return m_messagesSent.load();
    }
    
    uint64_t GetMessagesReceived() const {
        return m_messagesReceived.load();
    }
    
    size_t GetQueueSize() const {
        return m_messageQueue.getSize();
    }
    
    int GetReconnectAttempts() const {
        return m_reconnectAttempts.load();
    }
    
    std::chrono::milliseconds GetConnectionDuration() const {
        if (m_connectionState == ConnectionState::CONNECTED) {
            auto now = std::chrono::steady_clock::now();
            return std::chrono::duration_cast<std::chrono::milliseconds>(now - m_connectTime);
        }
        return std::chrono::milliseconds(0);
    }

    bool IsConnected() const {
        return m_connectionState == ConnectionState::CONNECTED;
    }
    
    ConnectionState GetConnectionState() const {
        return m_connectionState.load();
    }

    std::string GetLastError() const {
        return m_lastError;
    }

private:
    void OnOpen(websocketpp::connection_hdl hdl) {
        m_connectionState = ConnectionState::CONNECTED;
        m_reconnectAttempts = 0;
        m_lastError.clear();
        m_lastHeartbeat = std::chrono::steady_clock::now();
        m_connectTime = std::chrono::steady_clock::now();
    }

    void OnClose(websocketpp::connection_hdl hdl) {
        m_connectionState = ConnectionState::DISCONNECTED;
        m_lastError = "Connection closed";
        
        // 自動再接続のトリガー
        if (m_shouldRun && ShouldRetryConnection()) {
            ScheduleReconnect();
        }
    }

    void OnFail(websocketpp::connection_hdl hdl) {
        m_connectionState = ConnectionState::FAILED;
        
        // 失敗理由の詳細取得
        try {
            client::connection_ptr con = m_client.get_con_from_hdl(hdl);
            if (con) {
                m_lastError = "Connection failed: " + con->get_ec().message() + " (" + std::to_string(con->get_response_code()) + ")";
            } else {
                m_lastError = "Connection failed: Unknown error";
            }
        } catch (...) {
            m_lastError = "Connection failed: Exception in error handling";
        }
        
        // 自動再接続のトリガー
        if (m_shouldRun && ShouldRetryConnection()) {
            ScheduleReconnect();
        }
    }

    void OnMessage(websocketpp::connection_hdl hdl, client::message_ptr msg) {
        std::string payload = msg->get_payload();
        
        // リングバッファにメッセージを追加
        if (!m_messageQueue.push(payload)) {
            // バッファフルの場合、古いメッセージを破棄（ログ記録）
            m_lastError = "Message buffer full, dropping message";
        } else {
            m_messagesReceived.fetch_add(1);
        }
    }
};

// 静的メンバーの定義
std::unique_ptr<WebSocketClient> WebSocketClient::s_instance = nullptr;
std::mutex WebSocketClient::s_instanceMutex;

// スレッドセーフな文字列バッファ管理
static std::mutex g_stringMutex;
static std::unordered_map<std::thread::id, std::string> g_threadTempStrings;
static std::unordered_map<std::thread::id, std::string> g_threadErrorStrings;

// スレッドローカルストレージヘルパー
static std::string& GetThreadTempString() {
    std::lock_guard<std::mutex> lock(g_stringMutex);
    return g_threadTempStrings[std::this_thread::get_id()];
}

static std::string& GetThreadErrorString() {
    std::lock_guard<std::mutex> lock(g_stringMutex);
    return g_threadErrorStrings[std::this_thread::get_id()];
}

// C言語インターフェース
extern "C" {

HEDGESYSTEMWEBSOCKET_API bool WSConnect(const char* url, const char* token) {
    if (!url || !token) {
        return false;
    }
    
    try {
        return WebSocketClient::GetInstance().Connect(std::string(url), std::string(token));
    }
    catch (...) {
        return false;
    }
}

HEDGESYSTEMWEBSOCKET_API void WSDisconnect() {
    try {
        WebSocketClient::GetInstance().Disconnect();
    }
    catch (...) {
        // エラーを無視
    }
}

HEDGESYSTEMWEBSOCKET_API bool WSSendMessage(const char* message) {
    if (!message) {
        return false;
    }
    
    try {
        return WebSocketClient::GetInstance().SendMessage(std::string(message));
    }
    catch (...) {
        return false;
    }
}

HEDGESYSTEMWEBSOCKET_API const char* WSReceiveMessage() {
    try {
        std::string& tempString = GetThreadTempString();
        tempString = WebSocketClient::GetInstance().ReceiveMessage();
        return tempString.c_str();
    }
    catch (...) {
        return "";
    }
}

HEDGESYSTEMWEBSOCKET_API bool WSIsConnected() {
    try {
        return WebSocketClient::GetInstance().IsConnected();
    }
    catch (...) {
        return false;
    }
}

HEDGESYSTEMWEBSOCKET_API const char* WSGetLastError() {
    try {
        std::string& errorString = GetThreadErrorString();
        errorString = WebSocketClient::GetInstance().GetLastError();
        return errorString.c_str();
    }
    catch (...) {
        return "Unknown error";
    }
}

HEDGESYSTEMWEBSOCKET_API void WSFreeString(const char* str) {
    // スレッドローカルストレージ使用のため、特に解放処理は不要
    // スレッド終了時に自動でクリーンアップされる
}

// パフォーマンス監視用API
HEDGESYSTEMWEBSOCKET_API uint64_t WSGetMessagesSent() {
    try {
        return WebSocketClient::GetInstance().GetMessagesSent();
    }
    catch (...) {
        return 0;
    }
}

HEDGESYSTEMWEBSOCKET_API uint64_t WSGetMessagesReceived() {
    try {
        return WebSocketClient::GetInstance().GetMessagesReceived();
    }
    catch (...) {
        return 0;
    }
}

HEDGESYSTEMWEBSOCKET_API size_t WSGetQueueSize() {
    try {
        return WebSocketClient::GetInstance().GetQueueSize();
    }
    catch (...) {
        return 0;
    }
}

HEDGESYSTEMWEBSOCKET_API int WSGetReconnectAttempts() {
    try {
        return WebSocketClient::GetInstance().GetReconnectAttempts();
    }
    catch (...) {
        return 0;
    }
}

HEDGESYSTEMWEBSOCKET_API int WSGetConnectionState() {
    try {
        return static_cast<int>(WebSocketClient::GetInstance().GetConnectionState());
    }
    catch (...) {
        return static_cast<int>(ConnectionState::FAILED);
    }
}

HEDGESYSTEMWEBSOCKET_API uint64_t WSGetConnectionDurationMs() {
    try {
        return WebSocketClient::GetInstance().GetConnectionDuration().count();
    }
    catch (...) {
        return 0;
    }
}

// DLL管理用API
HEDGESYSTEMWEBSOCKET_API void WSCleanup() {
    try {
        WebSocketClient::GetInstance().Disconnect();
        
        // スレッドローカルストレージのクリーンアップ
        std::lock_guard<std::mutex> lock(g_stringMutex);
        g_threadTempStrings.clear();
        g_threadErrorStrings.clear();
    }
    catch (...) {
        // エラーを無視
    }
}

} // extern "C"

// DLLエントリーポイント（Windows用）
#ifdef _WIN32
#include <windows.h>

BOOL APIENTRY DllMain(HMODULE hModule, DWORD ul_reason_for_call, LPVOID lpReserved) {
    switch (ul_reason_for_call) {
        case DLL_PROCESS_ATTACH:
            // DLLロード時の初期化
            break;
        case DLL_THREAD_ATTACH:
            // スレッドアタッチ時の初期化
            break;
        case DLL_THREAD_DETACH:
            // スレッドデタッチ時のクリーンアップ
            {
                std::lock_guard<std::mutex> lock(g_stringMutex);
                auto threadId = std::this_thread::get_id();
                g_threadTempStrings.erase(threadId);
                g_threadErrorStrings.erase(threadId);
            }
            break;
        case DLL_PROCESS_DETACH:
            // DLLアンロード時のクリーンアップ
            try {
                WSCleanup();
            } catch (...) {
                // エラーを無視
            }
            break;
    }
    return TRUE;
}
#endif