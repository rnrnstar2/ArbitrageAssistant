#include "HedgeSystemWebSocket.h"
#include <iostream>
#include <string>
#include <queue>
#include <mutex>
#include <thread>
#include <memory>
#include <chrono>
#include <websocketpp/config/asio_client.hpp>
#include <websocketpp/client.hpp>

typedef websocketpp::client<websocketpp::config::asio_tls_client> client;
typedef websocketpp::lib::shared_ptr<websocketpp::lib::asio::ssl::context> context_ptr;

class WebSocketClient {
private:
    client m_client;
    websocketpp::connection_hdl m_hdl;
    std::string m_url;
    std::string m_token;
    std::queue<std::string> m_messageQueue;
    std::mutex m_queueMutex;
    std::string m_lastError;
    bool m_connected;
    std::thread m_thread;
    bool m_shouldRun;

    static std::unique_ptr<WebSocketClient> s_instance;
    static std::mutex s_instanceMutex;

public:
    WebSocketClient() : m_connected(false), m_shouldRun(false) {
        // WebSocketクライアントの設定
        m_client.clear_access_channels(websocketpp::log::alevel::all);
        m_client.clear_error_channels(websocketpp::log::elevel::all);
        
        m_client.init_asio();
        m_client.set_tls_init_handler([this](websocketpp::connection_hdl) {
            return websocketpp::lib::make_shared<websocketpp::lib::asio::ssl::context>(websocketpp::lib::asio::ssl::context::sslv23);
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
    }

    ~WebSocketClient() {
        Disconnect();
    }

    static WebSocketClient& GetInstance() {
        std::lock_guard<std::mutex> lock(s_instanceMutex);
        if (!s_instance) {
            s_instance = std::make_unique<WebSocketClient>();
        }
        return *s_instance;
    }

    bool Connect(const std::string& url, const std::string& token) {
        try {
            m_url = url;
            m_token = token;
            
            websocketpp::lib::error_code ec;
            client::connection_ptr con = m_client.get_connection(url, ec);
            
            if (ec) {
                m_lastError = "Could not create connection: " + ec.message();
                return false;
            }

            // 認証ヘッダーの追加
            con->append_header("Authorization", "Bearer " + token);
            
            m_hdl = con->get_handle();
            m_client.connect(con);

            // 別スレッドでイベントループを実行
            m_shouldRun = true;
            m_thread = std::thread([this]() {
                m_client.run();
            });

            // 接続を待機（最大5秒）
            int timeout = 50; // 5秒（100ms * 50）
            while (timeout > 0 && !m_connected) {
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
                timeout--;
            }

            return m_connected;
        }
        catch (const std::exception& e) {
            m_lastError = "Connection error: " + std::string(e.what());
            return false;
        }
    }

    void Disconnect() {
        if (m_connected) {
            try {
                websocketpp::lib::error_code ec;
                m_client.close(m_hdl, websocketpp::close::status::going_away, "", ec);
                
                m_shouldRun = false;
                if (m_thread.joinable()) {
                    m_thread.join();
                }
                
                m_connected = false;
            }
            catch (const std::exception& e) {
                m_lastError = "Disconnect error: " + std::string(e.what());
            }
        }
    }

    bool SendMessage(const std::string& message) {
        if (!m_connected) {
            m_lastError = "Not connected";
            return false;
        }

        try {
            websocketpp::lib::error_code ec;
            m_client.send(m_hdl, message, websocketpp::frame::opcode::text, ec);
            
            if (ec) {
                m_lastError = "Send error: " + ec.message();
                return false;
            }
            
            return true;
        }
        catch (const std::exception& e) {
            m_lastError = "Send exception: " + std::string(e.what());
            return false;
        }
    }

    std::string ReceiveMessage() {
        std::lock_guard<std::mutex> lock(m_queueMutex);
        if (m_messageQueue.empty()) {
            return "";
        }
        
        std::string message = m_messageQueue.front();
        m_messageQueue.pop();
        return message;
    }

    bool IsConnected() const {
        return m_connected;
    }

    std::string GetLastError() const {
        return m_lastError;
    }

private:
    void OnOpen(websocketpp::connection_hdl hdl) {
        m_connected = true;
        m_lastError.clear();
    }

    void OnClose(websocketpp::connection_hdl hdl) {
        m_connected = false;
        m_lastError = "Connection closed";
    }

    void OnFail(websocketpp::connection_hdl hdl) {
        m_connected = false;
        m_lastError = "Connection failed";
    }

    void OnMessage(websocketpp::connection_hdl hdl, client::message_ptr msg) {
        std::lock_guard<std::mutex> lock(m_queueMutex);
        m_messageQueue.push(msg->get_payload());
    }
};

// 静的メンバーの定義
std::unique_ptr<WebSocketClient> WebSocketClient::s_instance = nullptr;
std::mutex WebSocketClient::s_instanceMutex;

// 文字列のメモリ管理用
static std::mutex g_stringMutex;
static std::string g_tempString;
static std::string g_errorString;

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
        std::lock_guard<std::mutex> lock(g_stringMutex);
        g_tempString = WebSocketClient::GetInstance().ReceiveMessage();
        return g_tempString.c_str();
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
        std::lock_guard<std::mutex> lock(g_stringMutex);
        g_errorString = WebSocketClient::GetInstance().GetLastError();
        return g_errorString.c_str();
    }
    catch (...) {
        return "Unknown error";
    }
}

HEDGESYSTEMWEBSOCKET_API void WSFreeString(const char* str) {
    // この実装では特に何もしない（静的バッファを使用しているため）
    // 実際の本格実装では動的メモリ管理が必要
}

} // extern "C"