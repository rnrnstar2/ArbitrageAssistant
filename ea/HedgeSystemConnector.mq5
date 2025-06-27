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
    
    // 高性能JSONパース関数（設計書準拠）
    bool ExtractJsonString(string json, string key, string &value);
    bool ExtractJsonDouble(string json, string key, double &value);
    bool ExtractJsonInt(string json, string key, int &value);
    bool ValidateMessage(string message, string requiredType);
    
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
    string wsUrl = "wss://your-websocket-url.com/ws";
    string authToken = "your-auth-token";
    string accountId = AccountInfoString(ACCOUNT_NAME) + "_" + IntegerToString(AccountInfoInteger(ACCOUNT_LOGIN));
    
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
    m_updateInterval = 5; // 5秒間隔
    m_isConnected = false;
    
    // パフォーマンス最適化設定
    m_lastConnectionCheck = 0;
    m_connectionCheckInterval = 30; // 30秒間隔で接続確認
    m_reconnectAttempts = 0;
    m_maxReconnectAttempts = 5;
    m_fastMode = true; // 高性能モード有効
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
    
    if(WSConnect(m_wsUrl, m_authToken))
    {
        m_isConnected = true;
        m_lastHeartbeat = TimeCurrent();
        LogMessage("Connected to Hedge System WebSocket");
        
        // 初回データ送信
        SendAccountUpdate();
        SendPositionUpdate();
        
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
    
    // ハートビート送信
    if(currentTime - m_lastHeartbeat >= m_updateInterval)
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
    // 設計書7.1準拠フォーマット（EA → Hedge System）
    string message = StringFormat(
        "{\"event\":\"OPENED\",\"accountId\":\"%s\",\"positionId\":\"%s\",\"mtTicket\":\"%d\",\"price\":%.5f,\"time\":\"%s\",\"status\":\"SUCCESS\"}",
        m_accountId,
        positionId,
        ticket,
        price,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
    );
    
    if(WSSendMessage(message))
    {
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
    // 設計書7.1準拠フォーマット（決済イベント）
    string message = StringFormat(
        "{\"event\":\"CLOSED\",\"accountId\":\"%s\",\"positionId\":\"%s\",\"mtTicket\":\"%d\",\"price\":%.5f,\"profit\":%.2f,\"time\":\"%s\",\"status\":\"SUCCESS\"}",
        m_accountId,
        positionId,
        ticket,
        price,
        profit,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
    );
    
    if(WSSendMessage(message))
    {
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
    string message = StringFormat(
        "{\"type\":\"STOPPED\",\"timestamp\":\"%s\",\"accountId\":\"%s\",\"positionId\":\"%s\",\"mtTicket\":\"%d\",\"price\":%.5f,\"time\":\"%s\",\"reason\":\"%s\"}",
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS),
        m_accountId,
        positionId,
        ticket,
        price,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS),
        reason
    );
    
    if(WSSendMessage(message))
    {
        LogMessage("STOPPED event sent for position: " + positionId + " reason: " + reason);
    }
    else
    {
        LogMessage("Failed to send STOPPED event");
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