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
//| HedgeSystemConnector コンストラクタ                              |
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
//| Tickイベント処理                                                |
//+------------------------------------------------------------------+
void HedgeSystemConnector::OnTick()
{
    if(!m_isConnected)
        return;
    
    // 接続確認
    if(!WSIsConnected())
    {
        LogMessage("WebSocket connection lost, attempting to reconnect...");
        m_isConnected = false;
        if(Connect(m_wsUrl, m_authToken, m_accountId))
        {
            LogMessage("Reconnected successfully");
        }
        return;
    }
    
    // 受信メッセージの処理
    string receivedMessage = WSReceiveMessage();
    if(receivedMessage != "")
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
//| コマンド処理（設計書準拠メッセージフォーマット対応）             |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ProcessCommand(string command)
{
    LogMessage("Processing command: " + command);
    
    // 設計書準拠のメッセージ処理
    if(StringFind(command, "\"type\":\"OPEN\"") != -1)
    {
        // 新規ポジション開設（設計書準拠）
        string positionId = ""; // JSONから抽出が必要
        string actionId = ""; // JSONから抽出が必要  
        string symbol = "EURUSD"; // JSONから抽出
        string side = "BUY"; // JSONから抽出（BUY/SELL）
        double volume = 0.01; // JSONから抽出
        double trailWidth = 0.0; // JSONから抽出（オプション）
        
        // 簡易JSONパース（実際の実装では適切なJSONライブラリを使用）
        int pos = StringFind(command, "\"positionId\":\"");
        if(pos != -1)
        {
            int start = pos + 14;
            int end = StringFind(command, "\"", start);
            if(end != -1) positionId = StringSubstr(command, start, end - start);
        }
        
        pos = StringFind(command, "\"actionId\":\"");
        if(pos != -1)
        {
            int start = pos + 12;
            int end = StringFind(command, "\"", start);
            if(end != -1) actionId = StringSubstr(command, start, end - start);
        }
        
        int type = (side == "BUY") ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
        ExecuteOrderWithCallback(symbol, type, volume, 0.0, 0.0, 0.0, positionId, actionId);
    }
    else if(StringFind(command, "\"type\":\"CLOSE\"") != -1)
    {
        // ポジション決済（設計書準拠）
        string positionId = ""; // JSONから抽出が必要
        string actionId = ""; // JSONから抽出が必要
        
        // 簡易JSONパース
        int pos = StringFind(command, "\"positionId\":\"");
        if(pos != -1)
        {
            int start = pos + 14;
            int end = StringFind(command, "\"", start);
            if(end != -1) positionId = StringSubstr(command, start, end - start);
        }
        
        pos = StringFind(command, "\"actionId\":\"");
        if(pos != -1)
        {
            int start = pos + 12;
            int end = StringFind(command, "\"", start);
            if(end != -1) actionId = StringSubstr(command, start, end - start);
        }
        
        ClosePositionWithCallback(positionId, actionId);
    }
    else if(StringFind(command, "\"action\":\"modify_position\"") != -1)
    {
        // レガシー対応: ポジション修正
        ulong ticket = 0; // JSONから抽出
        double sl = 0.0; // JSONから抽出
        double tp = 0.0; // JSONから抽出
        ModifyPosition(ticket, sl, tp);
    }
}

//+------------------------------------------------------------------+
//| コールバック付き注文実行                                         |
//+------------------------------------------------------------------+
void HedgeSystemConnector::ExecuteOrderWithCallback(string symbol, int type, double lots, double price, double sl, double tp, string positionId, string actionId)
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
    request.comment = "HedgeSystem[" + positionId + "]";
    
    if(OrderSend(request, result))
    {
        LogMessage("Order executed successfully. Ticket: " + IntegerToString(result.order));
        // 設計書準拠のOPENED通知送信
        SendOpenedEvent(positionId, actionId, (int)result.order, request.price);
    }
    else
    {
        LogMessage("Order execution failed. Error: " + IntegerToString(GetLastError()));
        // エラー通知も送信可能
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
//| アカウント情報JSON作成                                           |
//+------------------------------------------------------------------+
string HedgeSystemConnector::CreateAccountJson()
{
    string json = "{";
    json += "\"type\":\"account_update\",";
    json += "\"account_id\":\"" + m_accountId + "\",";
    json += "\"timestamp\":" + IntegerToString(TimeCurrent()) + ",";
    json += "\"balance\":" + DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2) + ",";
    json += "\"equity\":" + DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2) + ",";
    json += "\"margin\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN), 2) + ",";
    json += "\"margin_free\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_FREE), 2) + ",";
    json += "\"margin_level\":" + DoubleToString(AccountInfoDouble(ACCOUNT_MARGIN_LEVEL), 2) + ",";
    json += "\"credit\":" + DoubleToString(AccountInfoDouble(ACCOUNT_CREDIT), 2) + ",";
    json += "\"profit\":" + DoubleToString(AccountInfoDouble(ACCOUNT_PROFIT), 2) + ",";
    json += "\"server\":\"" + AccountInfoString(ACCOUNT_SERVER) + "\",";
    json += "\"currency\":\"" + AccountInfoString(ACCOUNT_CURRENCY) + "\"";
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
//| OPENED イベント送信（設計書準拠）                                |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendOpenedEvent(string positionId, string actionId, int ticket, double price)
{
    string message = StringFormat(
        "{\"type\":\"OPENED\",\"timestamp\":\"%s\",\"accountId\":\"%s\",\"positionId\":\"%s\",\"actionId\":\"%s\",\"mtTicket\":\"%d\",\"price\":%.5f,\"time\":\"%s\",\"status\":\"SUCCESS\"}",
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS),
        m_accountId,
        positionId,
        actionId,
        ticket,
        price,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
    );
    
    if(WSSendMessage(message))
    {
        LogMessage("OPENED event sent for position: " + positionId);
    }
    else
    {
        LogMessage("Failed to send OPENED event");
    }
}

//+------------------------------------------------------------------+
//| CLOSED イベント送信（設計書準拠）                                |
//+------------------------------------------------------------------+
void HedgeSystemConnector::SendClosedEvent(string positionId, string actionId, int ticket, double price, double profit)
{
    string message = StringFormat(
        "{\"type\":\"CLOSED\",\"timestamp\":\"%s\",\"accountId\":\"%s\",\"positionId\":\"%s\",\"actionId\":\"%s\",\"mtTicket\":\"%d\",\"price\":%.5f,\"profit\":%.2f,\"time\":\"%s\",\"status\":\"SUCCESS\"}",
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS),
        m_accountId,
        positionId,
        actionId,
        ticket,
        price,
        profit,
        TimeToString(TimeCurrent(), TIME_DATE|TIME_SECONDS)
    );
    
    if(WSSendMessage(message))
    {
        LogMessage("CLOSED event sent for position: " + positionId);
    }
    else
    {
        LogMessage("Failed to send CLOSED event");
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