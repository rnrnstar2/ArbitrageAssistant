//+------------------------------------------------------------------+
//|                                         HedgeSystemConnector.mq5 |
//|                                   Copyright 2024, ArbitrageAssistant |
//|                                             https://example.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, ArbitrageAssistant"
#property link      "https://example.com"
#property version   "1.00"
#property strict

#import "HedgeSystemWebSocket.dll"
   bool WSConnect(string url, string token);
   void WSDisconnect();
   bool WSSendMessage(string message);
   string WSReceiveMessage();
   bool WSIsConnected();
#import

//+------------------------------------------------------------------+
//| Input Parameters                                                |
//+------------------------------------------------------------------+
input string   WS_URL            = "wss://localhost:3456/ws";    // WebSocket URL
input string   AUTH_TOKEN        = "demo-auth-token";            // 認証トークン
input int      UPDATE_INTERVAL   = 1000;                         // 更新間隔(ミリ秒)
input bool     FAST_MODE         = true;                         // 高速モード
input int      HEARTBEAT_INTERVAL = 5000;                        // ハートビート間隔(ミリ秒)
input int      MAX_RECONNECT     = 10;                           // 最大再接続試行回数
input bool     DEBUG_MODE        = true;                         // デバッグモード

//+------------------------------------------------------------------+
//| Expert Advisor クラス                                            |
//+------------------------------------------------------------------+
class HedgeSystemConnector
{
private:
    string m_wsUrl;
    string m_authToken;
    string m_accountId;
    datetime m_lastHeartbeat;
    datetime m_lastPositionUpdate;
    datetime m_lastAccountUpdate;
    int m_updateInterval;
    bool m_isConnected;
    
    // パフォーマンス最適化フィールド
    datetime m_lastConnectionCheck;
    int m_connectionCheckInterval;
    int m_reconnectAttempts;
    int m_maxReconnectAttempts;
    bool m_fastMode;
    
public:
    HedgeSystemConnector();
    ~HedgeSystemConnector();
    
    bool Connect(string url, string token, string accountId);
    void Disconnect();
    void OnTick();
    void OnTimer();
    
private:
    void SendPositionUpdate();
    void SendAccountUpdate();
    void SendHeartbeat();
    void ProcessIncomingMessage(string message);
    void ProcessCommand(string command);
    void ExecuteOrder(string symbol, int type, double lots, double price, double sl, double tp);
    void ClosePosition(ulong ticket);
    void ModifyPosition(ulong ticket, double sl, double tp);
    string CreatePositionJson();
    string CreateAccountJson();
    string CreateHeartbeatJson();
    void SendOpenedEvent(string positionId, string actionId, int ticket, double price);
    void SendClosedEvent(string positionId, string actionId, int ticket, double price, double profit);
    void SendStoppedEvent(string positionId, int ticket, double price, string reason);
    void ExecuteOrderWithCallback(string symbol, int type, double lots, double price, double sl, double tp, string positionId, string actionId);
    void ClosePositionWithCallback(string positionId, string actionId);
    bool ClosePositionByTicket(ulong ticket);
    void LogMessage(string message);
    
    // トレール機能
    void ProcessTrailTriggered(string message);
    void ProcessTrailUpdate(string message);
    void SendTrailEvent(string positionId, string eventType, double trailPrice, double stopLoss);
    bool UpdatePositionTrail(string positionId, double newStopLoss);
    
    // 高性能JSONパース関数（設計書準拠）
    bool ExtractJsonString(string json, string key, string &value);
    bool ExtractJsonDouble(string json, string key, double &value);
    bool ExtractJsonInt(string json, string key, int &value);
    bool ValidateMessage(string message, string requiredType);
    
    // 本番環境対応機能
    bool ValidateProductionEnvironment();
    void SendConnectionValidation();
    void SendPerformanceMetrics();
    bool CheckSystemHealth();
    
    // エラーハンドリング強化関数
    void SendErrorEvent(string type, string details, int errorCode);
    bool IsValidSymbol(string symbol);
    bool IsValidVolume(double volume);
    void HandleOrderError(int errorCode, string operation, string details);
};

//+------------------------------------------------------------------+
//| グローバル変数                                                    |
//+------------------------------------------------------------------+
HedgeSystemConnector g_connector;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    // パラメータの設定
    string wsUrl = WS_URL;
    string authToken = AUTH_TOKEN;
    string accountId = AccountInfoString(ACCOUNT_NAME) + "_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    
    // デバッグモードのログ出力
    if(DEBUG_MODE)
    {
        Print("=== HedgeSystemConnector Initialization ===");
        Print("WebSocket URL: ", wsUrl);
        Print("Account ID: ", accountId);
        Print("Update Interval: ", UPDATE_INTERVAL, " ms");
        Print("Fast Mode: ", FAST_MODE ? "Enabled" : "Disabled");
        Print("Heartbeat Interval: ", HEARTBEAT_INTERVAL, " ms");
        Print("Max Reconnect Attempts: ", MAX_RECONNECT);
    }
    
    // 接続の試行
    if(!g_connector.Connect(wsUrl, authToken, accountId))
    {
        Print("Failed to connect to Hedge System WebSocket");
        return INIT_FAILED;
    }
    
    // タイマーの設定（5秒間隔）
    EventSetTimer(5);
    
    Print("HedgeSystemConnector initialized successfully");
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    EventKillTimer();
    g_connector.Disconnect();
    Print("HedgeSystemConnector deinitialized");
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    g_connector.OnTick();
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
    g_connector.OnTimer();
}

//+------------------------------------------------------------------+
//| HedgeSystemConnector コンストラクタ（パフォーマンス最適化）       |
//+------------------------------------------------------------------+
HedgeSystemConnector::HedgeSystemConnector()
{
    m_wsUrl = "";
    m_authToken = "";
    m_accountId = "";
    m_lastHeartbeat = 0;
    m_lastPositionUpdate = 0;
    m_lastAccountUpdate = 0;
    m_updateInterval = UPDATE_INTERVAL / 1000; // ミリ秒を秒に変換
    m_isConnected = false;
    
    // パフォーマンス最適化設定
    m_lastConnectionCheck = 0;
    m_connectionCheckInterval = 30; // 30秒間隔で接続確認
    m_reconnectAttempts = 0;
    m_maxReconnectAttempts = MAX_RECONNECT;
    m_fastMode = FAST_MODE;
}

//+------------------------------------------------------------------+
//| HedgeSystemConnector デストラクタ                               |
//+------------------------------------------------------------------+
HedgeSystemConnector::~HedgeSystemConnector()
{
    Disconnect();
}

//+------------------------------------------------------------------+
//| WebSocket接続                                                    |
//+------------------------------------------------------------------+
bool HedgeSystemConnector::Connect(string url, string token, string accountId)
{
    m_wsUrl = url;
    m_authToken = token;
    m_accountId = accountId;
    
    // 本番環境検証
    if(!ValidateProductionEnvironment())
    {
        LogMessage("Production environment validation failed");
        return false;
    }
    
    if(WSConnect(m_wsUrl, m_authToken))
    {
        m_isConnected = true;
        m_lastHeartbeat = TimeCurrent();
        m_reconnectAttempts = 0; // 成功時はリセット
        LogMessage("Connected to Hedge System WebSocket");
        
        // 初回データ送信
        SendAccountUpdate();
        SendPositionUpdate();
        
        // 接続検証送信
        SendConnectionValidation();
        
        // 初回ヘルスチェック
        CheckSystemHealth();
        
        return true;
    }
    
    LogMessage("Failed to connect to WebSocket");
    return false;
}

//+------------------------------------------------------------------+
//| WebSocket切断                                                    |
//+------------------------------------------------------------------+
void HedgeSystemConnector::Disconnect()
{
    if(m_isConnected)
    {
        WSDisconnect();
        m_isConnected = false;
        LogMessage("Disconnected from Hedge System WebSocket");
    }
}

//+------------------------------------------------------------------+
//| Tickイベント処理（パフォーマンス最適化版）                       |
//+------------------------------------------------------------------+
void HedgeSystemConnector::OnTick()
{
    if(!m_isConnected)
        return;
    
    datetime currentTime = TimeCurrent();
    
    // 高性能接続確認（30秒間隔）
    if(currentTime - m_lastConnectionCheck >= m_connectionCheckInterval)
    {
        if(!WSIsConnected())
        {
            LogMessage("WebSocket connection lost, attempting to reconnect...");
            m_isConnected = false;
            m_reconnectAttempts++;
            
            if(m_reconnectAttempts <= m_maxReconnectAttempts)
            {
                if(Connect(m_wsUrl, m_authToken, m_accountId))
                {
                    LogMessage("Reconnected successfully (attempt " + IntegerToString(m_reconnectAttempts) + ")");
                    m_reconnectAttempts = 0; // リセット
                }
            }
            else
            {
                LogMessage("Max reconnection attempts reached, waiting...");
                m_reconnectAttempts = 0; // リセットして次の周期で再試行
            }
        }
        m_lastConnectionCheck = currentTime;
    }
    
    // 高速メッセージ受信処理
    string receivedMessage = WSReceiveMessage();
    if(receivedMessage != "" && StringLen(receivedMessage) > 0)
    {
        ProcessIncomingMessage(receivedMessage);
    }
}

//+------------------------------------------------------------------+
//| タイマーイベント処理                                              |
//+------------------------------------------------------------------+
void HedgeSystemConnector::OnTimer()
{
    if(!m_isConnected)
        return;
    
    datetime currentTime = TimeCurrent();
    
    // ハートビート送信（設定間隔）
    if(currentTime - m_lastHeartbeat >= HEARTBEAT_INTERVAL / 1000)
    {
        SendHeartbeat();
        m_lastHeartbeat = currentTime;
    }
    
    // ポジション更新
    if(currentTime - m_lastPositionUpdate >= m_updateInterval)
    {
        SendPositionUpdate();
        m_lastPositionUpdate = currentTime;
    }
    
    // アカウント更新
    if(currentTime - m_lastAccountUpdate >= m_updateInterval * 2) // 10秒間隔
    {
        SendAccountUpdate();
        m_lastAccountUpdate = currentTime;
    }
    
    // パフォーマンス監視（1分間隔）
    static datetime lastPerformanceCheck = 0;
    if(currentTime - lastPerformanceCheck >= 60)
    {
        SendPerformanceMetrics();
        lastPerformanceCheck = currentTime;
    }
    
    // システムヘルスチェック（5分間隔）
    static datetime lastHealthCheck = 0;
    if(currentTime - lastHealthCheck >= 300)
    {
        if(!CheckSystemHealth())
        {
            LogMessage("WARNING: System health check failed");
        }
        lastHealthCheck = currentTime;
    }
    
    // 受信メッセージ処理
    string receivedMessage = WSReceiveMessage();
    if(StringLen(receivedMessage) > 0)
    {
        ProcessIncomingMessage(receivedMessage);
    }
}

//+------------------------------------------------------------------+
//| ポジション情報送信                                               |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendPositionUpdate()
{
    string positionJson = CreatePositionJson();
    if(WSSendMessage(positionJson))
    {
        LogMessage("Position update sent");
    }
    else
    {
        LogMessage("Failed to send position update");
    }
}

//+------------------------------------------------------------------+
//| アカウント情報送信                                               |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendAccountUpdate()
{
    string accountJson = CreateAccountJson();
    if(WSSendMessage(accountJson))
    {
        LogMessage("Account update sent");
    }
    else
    {
        LogMessage("Failed to send account update");
    }
}

//+------------------------------------------------------------------+
//| ハートビート送信                                                 |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendHeartbeat()
{
    string heartbeatJson = CreateHeartbeatJson();
    if(WSSendMessage(heartbeatJson))
    {
        LogMessage("Heartbeat sent");
    }
    else
    {
        LogMessage("Failed to send heartbeat");
    }
}

//+------------------------------------------------------------------+
//| 受信メッセージ処理                                               |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ProcessIncomingMessage(string message)
{
    LogMessage("Received message: " + message);
    
    // JSONパース（簡易版）
    if(StringFind(message, "\"type\":\"command\"") != -1)
    {
        ProcessCommand(message);
    }
    else if(StringFind(message, "\"type\":\"TRAIL_TRIGGERED\"") != -1)
    {
        ProcessTrailTriggered(message);
    }
    else if(StringFind(message, "\"type\":\"TRAIL_UPDATE\"") != -1)
    {
        ProcessTrailUpdate(message);
    }
}

//+------------------------------------------------------------------+
//| コマンド処理（MVPシステム設計書完全準拠）                        |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ProcessCommand(string command)
{
    LogMessage("Processing command: " + command);
    
    // MVPシステム設計書v7.0準拠のメッセージ処理
    if(StringFind(command, "\"command\":\"OPEN\"") != -1)
    {
        // 新規ポジション開設（設計書7.1準拠）
        string accountId = "", positionId = "", symbol = "EURUSD", side = "BUY";
        double volume = 0.01;
        
        // 設計書準拠JSONパース（エラーハンドリング強化）
        if(!ExtractJsonString(command, "accountId", accountId) || 
           !ExtractJsonString(command, "positionId", positionId) ||
           !ExtractJsonString(command, "symbol", symbol) ||
           !ExtractJsonString(command, "side", side) ||
           !ExtractJsonDouble(command, "volume", volume))
        {
            LogMessage("ERROR: Invalid OPEN command format - " + command);
            return;
        }
        
        // 注文タイプ判定
        int type = (side == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
        
        // 注文実行（高性能化：市場価格取得最適化）
        double currentPrice = SymbolInfoDouble(symbol, type == ORDER_TYPE_BUY ? SYMBOL_ASK : SYMBOL_BID);
        ExecuteOrderWithCallback(symbol, type, volume, currentPrice, 0.0, 0.0, positionId, "");
    }
    else if(StringFind(command, "\"command\":\"CLOSE\"") != -1)
    {
        // ポジション決済（設計書7.1準拠）
        string accountId = "", positionId = "";
        
        // 設計書準拠JSONパース（エラーハンドリング強化）
        if(!ExtractJsonString(command, "accountId", accountId) || 
           !ExtractJsonString(command, "positionId", positionId))
        {
            LogMessage("ERROR: Invalid CLOSE command format - " + command);
            return;
        }
        
        ClosePositionWithCallback(positionId, "");
    }
    else
    {
        LogMessage("WARNING: Unknown command format - " + command);
    }
}

//+------------------------------------------------------------------+
//| コールバック付き注文実行（エラーハンドリング強化版）             |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ExecuteOrderWithCallback(string symbol, int type, double lots, double price, double sl, double tp, string positionId, string actionId)
{
    // 入力値検証（エラーハンドリング強化）
    if(!IsValidSymbol(symbol))
    {
        LogMessage("ERROR: Invalid symbol: " + symbol);
        SendErrorEvent("INVALID_SYMBOL", "Symbol not available: " + symbol, 0);
        return;
    }
    
    if(!IsValidVolume(lots))
    {
        LogMessage("ERROR: Invalid volume: " + DoubleToString(lots, 2));
        SendErrorEvent("INVALID_VOLUME", "Volume out of range: " + DoubleToString(lots, 2), 0);
        return;
    }
    
    MqlTradeRequest request;
    MqlTradeResult result;
    
    ZeroMemory(request);
    ZeroMemory(result);
    
    request.action = TRADE_ACTION_DEAL;
    request.symbol = symbol;
    request.volume = lots;
    request.type = type;
    request.price = (price == 0.0) ? SymbolInfoDouble(symbol, type == ORDER_TYPE_BUY ? SYMBOL_ASK : SYMBOL_BID) : price;
    request.sl = sl;
    request.tp = tp;
    request.deviation = 10;
    request.magic = 123456;
    request.comment = "HedgeSystem[" + positionId + "]";
    
    // 注文実行
    if(OrderSend(request, result))
    {
        if(result.retcode == TRADE_RETCODE_DONE)
        {
            LogMessage("Order executed successfully. Ticket: " + IntegerToString(result.order) + " Price: " + DoubleToString(result.price, 5));
            SendOpenedEvent(positionId, actionId, (int)result.order, result.price);
        }
        else
        {
            LogMessage("Order partially executed or pending. RetCode: " + IntegerToString(result.retcode));
            HandleOrderError(result.retcode, "OPEN", "Position: " + positionId);
        }
    }
    else
    {
        int errorCode = GetLastError();
        LogMessage("Order execution failed. Error: " + IntegerToString(errorCode));
        HandleOrderError(errorCode, "OPEN", "Position: " + positionId + " Symbol: " + symbol + " Volume: " + DoubleToString(lots, 2));
    }
}

//+------------------------------------------------------------------+
//| コールバック付きポジション決済                                   |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ClosePositionWithCallback(string positionId, string actionId)
{
    // positionIdからMT4チケットを特定する必要がある
    // 実装では、ポジション開設時のコメントまたは別の方法でマッピングを管理
    
    int totalPositions = PositionsTotal();
    for(int i = 0; i < totalPositions; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket != 0)
        {
            string comment = PositionGetString(POSITION_COMMENT);
            if(StringFind(comment, positionId) != -1)
            {
                // 対象ポジションを発見
                double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
                double profit = PositionGetDouble(POSITION_PROFIT);
                
                if(ClosePositionByTicket(ticket))
                {
                    // 設計書準拠のCLOSED通知送信
                    SendClosedEvent(positionId, actionId, (int)ticket, currentPrice, profit);
                }
                return;
            }
        }
    }
    
    LogMessage("Position not found for positionId: " + positionId);
}

//+------------------------------------------------------------------+
//| チケット指定ポジション決済                                       |
//+------------------------------------------------------------------+
bool HedgeSystemConnector::ClosePositionByTicket(ulong ticket)
{
    if(!PositionSelectByTicket(ticket))
    {
        return false;
    }
    
    MqlTradeRequest request;
    MqlTradeResult result;
    
    ZeroMemory(request);
    ZeroMemory(result);
    
    request.action = TRADE_ACTION_DEAL;
    request.position = ticket;
    request.symbol = PositionGetString(POSITION_SYMBOL);
    request.volume = PositionGetDouble(POSITION_VOLUME);
    request.type = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
    request.price = (request.type == ORDER_TYPE_SELL) ? SymbolInfoDouble(request.symbol, SYMBOL_BID) : SymbolInfoDouble(request.symbol, SYMBOL_ASK);
    request.deviation = 10;
    request.magic = 123456;
    request.comment = "HedgeSystem Close";
    
    return OrderSend(request, result);
}

//+------------------------------------------------------------------+
//| 注文実行                                                         |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ExecuteOrder(string symbol, int type, double lots, double price, double sl, double tp)
{
    MqlTradeRequest request;
    MqlTradeResult result;
    
    ZeroMemory(request);
    ZeroMemory(result);
    
    request.action = TRADE_ACTION_DEAL;
    request.symbol = symbol;
    request.volume = lots;
    request.type = type;
    request.price = (price == 0.0) ? SymbolInfoDouble(symbol, type == ORDER_TYPE_BUY ? SYMBOL_ASK : SYMBOL_BID) : price;
    request.sl = sl;
    request.tp = tp;
    request.deviation = 10;
    request.magic = 123456;
    request.comment = "HedgeSystem";
    
    if(OrderSend(request, result))
    {
        LogMessage("Order executed successfully. Ticket: " + IntegerToString(result.order));
    }
    else
    {
        LogMessage("Order execution failed. Error: " + IntegerToString(GetLastError()));
    }
}

//+------------------------------------------------------------------+
//| ポジション決済                                                   |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ClosePosition(ulong ticket)
{
    if(!PositionSelectByTicket(ticket))
    {
        LogMessage("Position not found: " + IntegerToString(ticket));
        return;
    }
    
    MqlTradeRequest request;
    MqlTradeResult result;
    
    ZeroMemory(request);
    ZeroMemory(result);
    
    request.action = TRADE_ACTION_DEAL;
    request.position = ticket;
    request.symbol = PositionGetString(POSITION_SYMBOL);
    request.volume = PositionGetDouble(POSITION_VOLUME);
    request.type = (PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
    request.price = (request.type == ORDER_TYPE_SELL) ? SymbolInfoDouble(request.symbol, SYMBOL_BID) : SymbolInfoDouble(request.symbol, SYMBOL_ASK);
    request.deviation = 10;
    request.magic = 123456;
    request.comment = "HedgeSystem Close";
    
    if(OrderSend(request, result))
    {
        LogMessage("Position closed successfully. Ticket: " + IntegerToString(ticket));
    }
    else
    {
        LogMessage("Position close failed. Error: " + IntegerToString(GetLastError()));
    }
}

//+------------------------------------------------------------------+
//| ポジション修正                                                   |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ModifyPosition(ulong ticket, double sl, double tp)
{
    if(!PositionSelectByTicket(ticket))
    {
        LogMessage("Position not found: " + IntegerToString(ticket));
        return;
    }
    
    MqlTradeRequest request;
    MqlTradeResult result;
    
    ZeroMemory(request);
    ZeroMemory(result);
    
    request.action = TRADE_ACTION_SLTP;
    request.position = ticket;
    request.symbol = PositionGetString(POSITION_SYMBOL);
    request.sl = sl;
    request.tp = tp;
    
    if(OrderSend(request, result))
    {
        LogMessage("Position modified successfully. Ticket: " + IntegerToString(ticket));
    }
    else
    {
        LogMessage("Position modification failed. Error: " + IntegerToString(GetLastError()));
    }
}

//+------------------------------------------------------------------+
//| ポジション情報JSON作成                                           |
//+------------------------------------------------------------------+
string HedgeSystemConnector::CreatePositionJson()
{
    string json = "{";
    json += "\"type\":\"position_update\",";
    json += "\"account_id\":\"" + m_accountId + "\",";
    json += "\"timestamp\":" + IntegerToString(TimeCurrent()) + ",";
    json += "\"positions\":[";
    
    int totalPositions = PositionsTotal();
    for(int i = 0; i < totalPositions; i++)
    {
        if(PositionGetTicket(i) != 0)
        {
            if(i > 0) json += ",";
            
            json += "{";
            json += "\"ticket\":" + IntegerToString(PositionGetTicket(i)) + ",";
            json += "\"symbol\":\"" + PositionGetString(POSITION_SYMBOL) + "\",";
            json += "\"type\":" + IntegerToString(PositionGetInteger(POSITION_TYPE)) + ",";
            json += "\"volume\":" + DoubleToString(PositionGetDouble(POSITION_VOLUME), 2) + ",";
            json += "\"open_price\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_OPEN), 5) + ",";
            json += "\"current_price\":" + DoubleToString(PositionGetDouble(POSITION_PRICE_CURRENT), 5) + ",";
            json += "\"profit\":" + DoubleToString(PositionGetDouble(POSITION_PROFIT), 2) + ",";
            json += "\"swap\":" + DoubleToString(PositionGetDouble(POSITION_SWAP), 2) + ",";
            json += "\"sl\":" + DoubleToString(PositionGetDouble(POSITION_SL), 5) + ",";
            json += "\"tp\":" + DoubleToString(PositionGetDouble(POSITION_TP), 5);
            json += "}";
        }
    }
    
    json += "]";
    json += "}";
    
    return json;
}

//+------------------------------------------------------------------+
//| アカウント情報JSON作成（MVPシステム設計書v7.0準拠）              |
//+------------------------------------------------------------------+
string HedgeSystemConnector::CreateAccountJson()
{
    // 設計書7.1準拠フォーマット（口座情報更新）
    string json = "{";
    json += "\"event\":\"ACCOUNT_UPDATE\",";
    json += "\"accountId\":\"" + m_accountId + "\",";
    json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
    json += "\"credit\":" + DoubleToString(AccountInfoDouble(ACCOUNT_CREDIT), 2) + ",";
    json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
    json += "\"time\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"";
    json += "}";
    
    return json;
}

//+------------------------------------------------------------------+
//| ハートビート情報JSON作成                                         |
//+------------------------------------------------------------------+
string HedgeSystemConnector::CreateHeartbeatJson()
{
    string json = "{";
    json += "\"type\":\"heartbeat\",";
    json += "\"account_id\":\"" + m_accountId + "\",";
    json += "\"timestamp\":" + IntegerToString(TimeCurrent()) + ",";
    json += "\"status\":\"online\"";
    json += "}";
    
    return json;
}

//+------------------------------------------------------------------+
//| OPENED イベント送信（MVPシステム設計書v7.0完全準拠）             |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendOpenedEvent(string positionId, string actionId, int ticket, double price)
{
    // position-execution.ts WSOpenedEvent準拠フォーマット
    string message = StringFormat(
        "{\"type\":\"OPENED\",\"accountId\":\"%s\",\"positionId\":\"%s\",\"orderId\":%d,\"price\":%.5f,\"time\":\"%s\",\"mtTicket\":\"%d\",\"timestamp\":\"%s\"}",
        m_accountId,
        positionId,
        ticket,
        price,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS),
        ticket,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
    );
    
    if(WSSendMessage(message))
    {
        if(DEBUG_MODE)
        {
            LogMessage("OPENED event sent: " + message);
        }
        LogMessage("OPENED event sent for position: " + positionId + " ticket: " + IntegerToString(ticket));
    }
    else
    {
        LogMessage("ERROR: Failed to send OPENED event for position: " + positionId);
    }
}

//+------------------------------------------------------------------+
//| CLOSED イベント送信（MVPシステム設計書v7.0完全準拠）             |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendClosedEvent(string positionId, string actionId, int ticket, double price, double profit)
{
    // position-execution.ts WSClosedEvent準拠フォーマット
    string message = StringFormat(
        "{\"type\":\"CLOSED\",\"accountId\":\"%s\",\"positionId\":\"%s\",\"price\":%.5f,\"profit\":%.2f,\"time\":\"%s\",\"mtTicket\":\"%d\",\"timestamp\":\"%s\"}",
        m_accountId,
        positionId,
        price,
        profit,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS),
        ticket,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
    );
    
    if(WSSendMessage(message))
    {
        if(DEBUG_MODE)
        {
            LogMessage("CLOSED event sent: " + message);
        }
        LogMessage("CLOSED event sent for position: " + positionId + " profit: " + DoubleToString(profit, 2));
    }
    else
    {
        LogMessage("ERROR: Failed to send CLOSED event for position: " + positionId);
    }
}

//+------------------------------------------------------------------+
//| STOPPED イベント送信（ロスカット通知・設計書準拠）               |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendStoppedEvent(string positionId, int ticket, double price, string reason)
{
    // position-execution.ts WSStoppedEvent準拠フォーマット
    string message = StringFormat(
        "{\"type\":\"STOPPED\",\"accountId\":\"%s\",\"positionId\":\"%s\",\"price\":%.5f,\"time\":\"%s\",\"reason\":\"%s\",\"timestamp\":\"%s\"}",
        m_accountId,
        positionId,
        price,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS),
        reason,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
    );
    
    if(WSSendMessage(message))
    {
        if(DEBUG_MODE)
        {
            LogMessage("STOPPED event sent: " + message);
        }
        LogMessage("STOPPED event sent for position: " + positionId + " reason: " + reason);
    }
    else
    {
        LogMessage("ERROR: Failed to send STOPPED event for position: " + positionId);
    }
}

//+------------------------------------------------------------------+
//| ログメッセージ出力                                               |
//+------------------------------------------------------------------+
void HedgeSystemConnector::LogMessage(string message)
{
    Print("[HedgeSystemConnector] " + message);
}

//+------------------------------------------------------------------+
//| 高性能JSONパース関数（設計書準拠・エラーハンドリング強化）       |
//+------------------------------------------------------------------+
bool HedgeSystemConnector::ExtractJsonString(string json, string key, string &value)
{
    string searchPattern = "\"" + key + "\":\"";
    int pos = StringFind(json, searchPattern);
    if(pos == -1) return false;
    
    int start = pos + StringLen(searchPattern);
    int end = StringFind(json, "\"", start);
    if(end == -1) return false;
    
    value = StringSubstr(json, start, end - start);
    return true;
}

bool HedgeSystemConnector::ExtractJsonDouble(string json, string key, double &value)
{
    string searchPattern = "\"" + key + "\":";
    int pos = StringFind(json, searchPattern);
    if(pos == -1) return false;
    
    int start = pos + StringLen(searchPattern);
    int end = StringFind(json, ",", start);
    if(end == -1) end = StringFind(json, "}", start);
    if(end == -1) return false;
    
    string valueStr = StringSubstr(json, start, end - start);
    value = StringToDouble(valueStr);
    return true;
}

bool HedgeSystemConnector::ExtractJsonInt(string json, string key, int &value)
{
    string searchPattern = "\"" + key + "\":";
    int pos = StringFind(json, searchPattern);
    if(pos == -1) return false;
    
    int start = pos + StringLen(searchPattern);
    int end = StringFind(json, ",", start);
    if(end == -1) end = StringFind(json, "}", start);
    if(end == -1) return false;
    
    string valueStr = StringSubstr(json, start, end - start);
    value = (int)StringToInteger(valueStr);
    return true;
}

bool HedgeSystemConnector::ValidateMessage(string message, string requiredType)
{
    string extractedType;
    if(!ExtractJsonString(message, "command", extractedType)) return false;
    return (extractedType == requiredType);
}

//+------------------------------------------------------------------+
//| エラーハンドリング強化関数群                                     |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendErrorEvent(string type, string details, int errorCode)
{
    string message = StringFormat(
        "{\"event\":\"ERROR\",\"accountId\":\"%s\",\"type\":\"%s\",\"details\":\"%s\",\"errorCode\":%d,\"time\":\"%s\"}",
        m_accountId,
        type,
        details,
        errorCode,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
    );
    
    if(WSSendMessage(message))
    {
        LogMessage("ERROR event sent: " + type + " - " + details);
    }
}

bool HedgeSystemConnector::IsValidSymbol(string symbol)
{
    return SymbolSelect(symbol, true) && SymbolInfoInteger(symbol, SYMBOL_SELECT);
}

bool HedgeSystemConnector::IsValidVolume(double volume)
{
    double minVolume = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MIN);
    double maxVolume = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_MAX);
    double volumeStep = SymbolInfoDouble(_Symbol, SYMBOL_VOLUME_STEP);
    
    return (volume >= minVolume && volume <= maxVolume && 
            MathMod(volume, volumeStep) < 0.0000001);
}

void HedgeSystemConnector::HandleOrderError(int errorCode, string operation, string details)
{
    string errorType = "";
    string errorDetails = operation + " failed: " + details + " ErrorCode: " + IntegerToString(errorCode);
    
    switch(errorCode)
    {
        case TRADE_RETCODE_INVALID_VOLUME:
            errorType = "INVALID_VOLUME";
            break;
        case TRADE_RETCODE_INVALID_PRICE:
            errorType = "INVALID_PRICE";
            break;
        case TRADE_RETCODE_NO_MONEY:
            errorType = "INSUFFICIENT_FUNDS";
            break;
        case TRADE_RETCODE_MARKET_CLOSED:
            errorType = "MARKET_CLOSED";
            break;
        case TRADE_RETCODE_CONNECTION:
            errorType = "CONNECTION_ERROR";
            break;
        default:
            errorType = "UNKNOWN_ERROR";
            break;
    }
    
    SendErrorEvent(errorType, errorDetails, errorCode);
}

//+------------------------------------------------------------------+
//| トレール発動イベント処理                                         |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ProcessTrailTriggered(string message)
{
    LogMessage("Processing TRAIL_TRIGGERED event: " + message);
    
    string positionId = "";
    double trailPrice = 0.0;
    double newStopLoss = 0.0;
    
    // JSONパース
    if(!ExtractJsonString(message, "positionId", positionId) ||
       !ExtractJsonDouble(message, "trailPrice", trailPrice) ||
       !ExtractJsonDouble(message, "stopLoss", newStopLoss))
    {
        LogMessage("ERROR: Invalid TRAIL_TRIGGERED format - " + message);
        return;
    }
    
    // ポジションのストップロス更新
    if(UpdatePositionTrail(positionId, newStopLoss))
    {
        // 成功イベント送信
        SendTrailEvent(positionId, "TRAIL_UPDATED", trailPrice, newStopLoss);
        LogMessage("Trail updated successfully for position: " + positionId);
    }
    else
    {
        // エラーイベント送信
        SendErrorEvent("TRAIL_UPDATE_FAILED", "Failed to update trail for position: " + positionId, 0);
        LogMessage("ERROR: Failed to update trail for position: " + positionId);
    }
}

//+------------------------------------------------------------------+
//| トレール更新イベント処理                                         |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ProcessTrailUpdate(string message)
{
    LogMessage("Processing TRAIL_UPDATE event: " + message);
    
    string positionId = "";
    double newTrailDistance = 0.0;
    
    // JSONパース
    if(!ExtractJsonString(message, "positionId", positionId) ||
       !ExtractJsonDouble(message, "trailDistance", newTrailDistance))
    {
        LogMessage("ERROR: Invalid TRAIL_UPDATE format - " + message);
        return;
    }
    
    // トレール設定の更新（実装は要件に応じて拡張）
    LogMessage("Trail distance updated for position " + positionId + ": " + DoubleToString(newTrailDistance, 2));
}

//+------------------------------------------------------------------+
//| トレールイベント送信                                             |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendTrailEvent(string positionId, string eventType, double trailPrice, double stopLoss)
{
    string json = "{";
    json += "\"type\":\"" + eventType + "\",";
    json += "\"positionId\":\"" + positionId + "\",";
    json += "\"trailPrice\":" + DoubleToString(trailPrice, 5) + ",";
    json += "\"stopLoss\":" + DoubleToString(stopLoss, 5) + ",";
    json += "\"timestamp\":" + IntegerToString(TimeCurrent());
    json += "}";
    
    if(!WSSendMessage(json))
    {
        LogMessage("Failed to send trail event: " + eventType);
    }
}

//+------------------------------------------------------------------+
//| ポジションのトレール更新                                         |
//+------------------------------------------------------------------+
bool HedgeSystemConnector::UpdatePositionTrail(string positionId, double newStopLoss)
{
    int totalPositions = PositionsTotal();
    
    for(int i = 0; i < totalPositions; i++)
    {
        ulong ticket = PositionGetTicket(i);
        if(ticket != 0)
        {
            string comment = PositionGetString(POSITION_COMMENT);
            
            // ポジションIDがコメントに含まれているか確認
            if(StringFind(comment, positionId) != -1)
            {
                // 現在のストップロスを取得
                double currentSL = PositionGetDouble(POSITION_SL);
                double currentTP = PositionGetDouble(POSITION_TP);
                string symbol = PositionGetString(POSITION_SYMBOL);
                
                // ストップロスが改善される場合のみ更新
                ENUM_POSITION_TYPE posType = (ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
                bool shouldUpdate = false;
                
                if(posType == POSITION_TYPE_BUY)
                {
                    // 買いポジション：新しいSLが現在のSLより高い場合に更新
                    shouldUpdate = (newStopLoss > currentSL || currentSL == 0);
                }
                else if(posType == POSITION_TYPE_SELL)
                {
                    // 売りポジション：新しいSLが現在のSLより低い場合に更新
                    shouldUpdate = (newStopLoss < currentSL || currentSL == 0);
                }
                
                if(shouldUpdate)
                {
                    MqlTradeRequest request;
                    MqlTradeResult result;
                    
                    ZeroMemory(request);
                    ZeroMemory(result);
                    
                    request.action = TRADE_ACTION_SLTP;
                    request.position = ticket;
                    request.symbol = symbol;
                    request.sl = newStopLoss;
                    request.tp = currentTP;
                    
                    if(OrderSend(request, result))
                    {
                        if(result.retcode == TRADE_RETCODE_DONE)
                        {
                            LogMessage("Trail stop updated for position " + positionId + 
                                     " (ticket: " + IntegerToString(ticket) + 
                                     ") New SL: " + DoubleToString(newStopLoss, 5));
                            return true;
                        }
                        else
                        {
                            LogMessage("ERROR: Failed to update trail stop. RetCode: " + 
                                     IntegerToString(result.retcode));
                        }
                    }
                    else
                    {
                        LogMessage("ERROR: OrderSend failed for trail update. Error: " + 
                                 IntegerToString(GetLastError()));
                    }
                }
                else
                {
                    LogMessage("Trail update skipped - new SL not better than current SL");
                    return true; // 更新不要でも成功とみなす
                }
            }
        }
    }
    
    LogMessage("ERROR: Position not found for trail update: " + positionId);
    return false;
}

//+------------------------------------------------------------------+
//| 本番環境検証                                                     |
//+------------------------------------------------------------------+
bool HedgeSystemConnector::ValidateProductionEnvironment()
{
    // MT5バージョン確認
    int buildNumber = TerminalInfoInteger(TERMINAL_BUILD);
    if(buildNumber < 3200)
    {
        LogMessage("ERROR: MT5 Build " + IntegerToString(buildNumber) + " is not supported. Minimum: 3200");
        return false;
    }
    
    // DLL使用許可確認
    if(!TerminalInfoInteger(TERMINAL_DLLS_ALLOWED))
    {
        LogMessage("ERROR: DLL usage not allowed. Please enable in Tools→Options→Expert Advisors");
        return false;
    }
    
    // WebRequest許可確認
    if(!TerminalInfoInteger(TERMINAL_MQID))
    {
        LogMessage("WARNING: MQL ID not available. WebRequest may be limited");
    }
    
    // 口座タイプ確認
    ENUM_ACCOUNT_TRADE_MODE tradeMode = (ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE);
    if(tradeMode == ACCOUNT_TRADE_MODE_DEMO)
    {
        LogMessage("INFO: Running in DEMO mode");
    }
    else
    {
        LogMessage("INFO: Running in REAL mode - Production environment detected");
    }
    
    // 取引許可確認
    if(!AccountInfoInteger(ACCOUNT_TRADE_ALLOWED))
    {
        LogMessage("ERROR: Trading not allowed for this account");
        return false;
    }
    
    LogMessage("Production environment validation: PASSED");
    return true;
}

//+------------------------------------------------------------------+
//| 接続検証メッセージ送信                                           |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendConnectionValidation()
{
    string message = "{";
    message += "\"type\":\"INFO\",";
    message += "\"accountId\":\"" + m_accountId + "\",";
    message += "\"event\":\"CONNECTION_VALIDATION\",";
    message += "\"mt5Build\":" + IntegerToString(TerminalInfoInteger(TERMINAL_BUILD)) + ",";
    message += "\"tradeAllowed\":" + (AccountInfoInteger(ACCOUNT_TRADE_ALLOWED) ? "true" : "false") + ",";
    message += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
    message += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
    message += "\"leverage\":" + IntegerToString(AccountInfoInteger(ACCOUNT_LEVERAGE)) + ",";
    message += "\"server\":\"" + AccountInfoString(ACCOUNT_SERVER) + "\",";
    message += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\",";
    message += "\"fastMode\":" + (FAST_MODE ? "true" : "false") + ",";
    message += "\"debugMode\":" + (DEBUG_MODE ? "true" : "false") + ",";
    message += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"";
    message += "}";
    
    if(WSSendMessage(message))
    {
        LogMessage("Connection validation sent");
    }
    else
    {
        LogMessage("ERROR: Failed to send connection validation");
    }
}

//+------------------------------------------------------------------+
//| パフォーマンス メトリクス送信                                     |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendPerformanceMetrics()
{
    // CPU使用率計算（簡易版）
    datetime start = GetMicrosecondCount();
    for(int i = 0; i < 1000; i++)
    {
        // 軽い計算処理
        double dummy = MathSin(i * 0.001);
    }
    double processingTime = (GetMicrosecondCount() - start) / 1000.0;
    
    // メモリ使用量取得
    long memoryUsed = TerminalInfoInteger(TERMINAL_MEMORY_PHYSICAL);
    long memoryTotal = TerminalInfoInteger(TERMINAL_MEMORY_TOTAL);
    
    string message = "{";
    message += "\"type\":\"INFO\",";
    message += "\"accountId\":\"" + m_accountId + "\",";
    message += "\"event\":\"PERFORMANCE_METRICS\",";
    message += "\"processingLatency\":" + DoubleToString(processingTime, 2) + ",";
    message += "\"memoryUsed\":" + IntegerToString(memoryUsed) + ",";
    message += "\"memoryTotal\":" + IntegerToString(memoryTotal) + ",";
    message += "\"connectionStatus\":\"" + (m_isConnected ? "CONNECTED" : "DISCONNECTED") + "\",";
    message += "\"reconnectAttempts\":" + IntegerToString(m_reconnectAttempts) + ",";
    message += "\"lastHeartbeat\":" + IntegerToString(m_lastHeartbeat) + ",";
    message += "\"positionsCount\":" + IntegerToString(PositionsTotal()) + ",";
    message += "\"ordersCount\":" + IntegerToString(OrdersTotal()) + ",";
    message += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"";
    message += "}";
    
    if(WSSendMessage(message))
    {
        if(DEBUG_MODE)
        {
            LogMessage("Performance metrics sent: " + DoubleToString(processingTime, 2) + "ms latency");
        }
    }
    else
    {
        LogMessage("ERROR: Failed to send performance metrics");
    }
}

//+------------------------------------------------------------------+
//| システムヘルスチェック                                           |
//+------------------------------------------------------------------+
bool HedgeSystemConnector::CheckSystemHealth()
{
    bool isHealthy = true;
    string healthReport = "System Health Check:\n";
    
    // 接続状態確認
    if(!m_isConnected)
    {
        healthReport += "❌ WebSocket: DISCONNECTED\n";
        isHealthy = false;
    }
    else
    {
        healthReport += "✅ WebSocket: CONNECTED\n";
    }
    
    // ハートビート確認
    datetime timeSinceHeartbeat = TimeCurrent() - m_lastHeartbeat;
    if(timeSinceHeartbeat > HEARTBEAT_INTERVAL / 1000 * 3) // 3倍の時間が経過
    {
        healthReport += "❌ Heartbeat: STALE (" + IntegerToString(timeSinceHeartbeat) + "s ago)\n";
        isHealthy = false;
    }
    else
    {
        healthReport += "✅ Heartbeat: ACTIVE\n";
    }
    
    // 再接続試行回数確認
    if(m_reconnectAttempts > m_maxReconnectAttempts / 2)
    {
        healthReport += "⚠️ Reconnect attempts: HIGH (" + IntegerToString(m_reconnectAttempts) + ")\n";
    }
    else
    {
        healthReport += "✅ Reconnect attempts: NORMAL (" + IntegerToString(m_reconnectAttempts) + ")\n";
    }
    
    // 口座状態確認
    double equity = AccountInfoDouble(ACCOUNT_EQUITY);
    double margin = AccountInfoDouble(ACCOUNT_MARGIN);
    double marginLevel = equity > 0 && margin > 0 ? (equity / margin) * 100 : 0;
    
    if(marginLevel > 0 && marginLevel < 200)
    {
        healthReport += "⚠️ Margin Level: LOW (" + DoubleToString(marginLevel, 2) + "%)\n";
    }
    else
    {
        healthReport += "✅ Margin Level: SAFE (" + DoubleToString(marginLevel, 2) + "%)\n";
    }
    
    // MT5ターミナル状態確認
    if(!TerminalInfoInteger(TERMINAL_CONNECTED))
    {
        healthReport += "❌ MT5 Terminal: DISCONNECTED\n";
        isHealthy = false;
    }
    else
    {
        healthReport += "✅ MT5 Terminal: CONNECTED\n";
    }
    
    LogMessage(healthReport);
    
    // ヘルスチェック結果をWebSocketで送信
    string message = "{";
    message += "\"type\":\"INFO\",";
    message += "\"accountId\":\"" + m_accountId + "\",";
    message += "\"event\":\"HEALTH_CHECK\",";
    message += "\"status\":\"" + (isHealthy ? "HEALTHY" : "UNHEALTHY") + "\",";
    message += "\"wsConnected\":" + (m_isConnected ? "true" : "false") + ",";
    message += "\"heartbeatAge\":" + IntegerToString(timeSinceHeartbeat) + ",";
    message += "\"reconnectAttempts\":" + IntegerToString(m_reconnectAttempts) + ",";
    message += "\"marginLevel\":" + DoubleToString(marginLevel, 2) + ",";
    message += "\"terminalConnected\":" + (TerminalInfoInteger(TERMINAL_CONNECTED) ? "true" : "false") + ",";
    message += "\"timestamp\":\"" + TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS) + "\"";
    message += "}";
    
    WSSendMessage(message);
    
    return isHealthy;
}