//+------------------------------------------------------------------+
//| EA Name: ReliableWebSocketClient                                  |
//| Description: 信頼性の高いWebSocket通信でポジション管理           |
//+------------------------------------------------------------------+

#property copyright "ArbitrageAssistant"
#property version   "1.00"
#property strict

// WebSocket関連の設定
string WebSocketURL = "wss://your-api-gateway-url/production";
string AccountID = "";
int HeartbeatInterval = 30; // 30秒
int FullSyncInterval = 300; // 5分
int MaxReconnectAttempts = 10;
int ReconnectDelay = 5; // 5秒

// グローバル変数
datetime LastHeartbeat = 0;
datetime LastFullSync = 0;
int ReconnectAttempts = 0;
bool IsConnected = false;
ulong LastSyncVersion = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit() {
    AccountID = IntegerToString(AccountNumber());
    
    Print("Starting ReliableWebSocketClient for account: ", AccountID);
    
    // WebSocket接続初期化
    if (!InitializeWebSocket()) {
        Print("Failed to initialize WebSocket connection");
        return INIT_FAILED;
    }
    
    // 初回完全同期
    SendFullSync();
    
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                |
//+------------------------------------------------------------------+
void OnDeinit(const int reason) {
    Print("Shutting down ReliableWebSocketClient. Reason: ", reason);
    CloseWebSocket();
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick() {
    // 接続状態チェック
    if (!IsConnected) {
        AttemptReconnection();
        return;
    }
    
    // ハートビート送信
    if (TimeCurrent() - LastHeartbeat >= HeartbeatInterval) {
        SendHeartbeat();
    }
    
    // 定期完全同期
    if (TimeCurrent() - LastFullSync >= FullSyncInterval) {
        SendFullSync();
    }
    
    // ポジション変更検出・送信（ライフサイクル変更のみ）
    CheckAndSendPositionLifecycleUpdates();
}

//+------------------------------------------------------------------+
//| WebSocket初期化                                                 |
//+------------------------------------------------------------------+
bool InitializeWebSocket() {
    // TODO: 実際のWebSocket初期化実装
    // ここでは模擬的な実装
    
    Print("Connecting to WebSocket: ", WebSocketURL);
    
    // 認証情報とアカウントIDを送信
    string authMessage = CreateAuthMessage();
    if (!SendWebSocketMessage(authMessage)) {
        Print("Failed to send authentication message");
        return false;
    }
    
    IsConnected = true;
    ReconnectAttempts = 0;
    Print("WebSocket connection established");
    
    return true;
}

//+------------------------------------------------------------------+
//| ハートビート送信                                                |
//+------------------------------------------------------------------+
void SendHeartbeat() {
    string heartbeatJson = StringFormat(
        "{"
        "\"type\": \"HEARTBEAT\","
        "\"accountId\": \"%s\","
        "\"timestamp\": \"%s\","
        "\"positionCount\": %d,"
        "\"balance\": %.2f,"
        "\"equity\": %.2f,"
        "\"margin\": %.2f,"
        "\"marginLevel\": %.2f,"
        "\"syncVersion\": %d"
        "}",
        AccountID,
        TimeToString(TimeCurrent()),
        PositionsTotal(),
        AccountBalance(),
        AccountEquity(),
        AccountMargin(),
        AccountMargin() > 0 ? AccountEquity() / AccountMargin() * 100 : 0,
        CalculateCurrentSyncVersion()
    );
    
    if (SendWebSocketMessage(heartbeatJson)) {
        LastHeartbeat = TimeCurrent();
        Print("Heartbeat sent successfully");
    } else {
        Print("Failed to send heartbeat - connection may be lost");
        IsConnected = false;
    }
}

//+------------------------------------------------------------------+
//| 完全同期送信                                                     |
//+------------------------------------------------------------------+
void SendFullSync() {
    Print("Sending full position sync...");
    
    string positionsArray = "";
    int totalPositions = PositionsTotal();
    
    for (int i = 0; i < totalPositions; i++) {
        if (PositionSelect(i)) {
            string positionJson = CreatePositionJson(i);
            
            if (i > 0) positionsArray += ",";
            positionsArray += positionJson;
        }
    }
    
    ulong syncVersion = CalculateCurrentSyncVersion();
    
    string fullSyncJson = StringFormat(
        "{"
        "\"type\": \"FULL_SYNC\","
        "\"accountId\": \"%s\","
        "\"timestamp\": \"%s\","
        "\"positions\": [%s],"
        "\"syncVersion\": %d"
        "}",
        AccountID,
        TimeToString(TimeCurrent()),
        positionsArray,
        syncVersion
    );
    
    if (SendWebSocketMessage(fullSyncJson)) {
        LastFullSync = TimeCurrent();
        LastSyncVersion = syncVersion;
        Print("Full sync sent successfully. Positions: ", totalPositions);
    } else {
        Print("Failed to send full sync");
        IsConnected = false;
    }
}

//+------------------------------------------------------------------+
//| ポジションライフサイクル変更検出・送信                          |
//+------------------------------------------------------------------+
void CheckAndSendPositionLifecycleUpdates() {
    // 現在の同期バージョンを計算
    ulong currentSyncVersion = CalculateCurrentSyncVersion();
    
    // 前回と異なる場合のみポジションライフサイクル更新を送信
    if (currentSyncVersion != LastSyncVersion) {
        SendPositionLifecycleUpdates();
        LastSyncVersion = currentSyncVersion;
    }
}

//+------------------------------------------------------------------+
//| ポジションライフサイクル更新送信                                |
//+------------------------------------------------------------------+
void SendPositionLifecycleUpdates() {
    int totalPositions = PositionsTotal();
    
    for (int i = 0; i < totalPositions; i++) {
        if (PositionSelect(i)) {
            string updateJson = StringFormat(
                "{"
                "\"type\": \"POSITION_LIFECYCLE_UPDATE\","
                "\"accountId\": \"%s\","
                "\"timestamp\": \"%s\","
                "\"position\": %s"
                "}",
                AccountID,
                TimeToString(TimeCurrent()),
                CreatePositionJson(i)
            );
            
            SendWebSocketMessage(updateJson);
        }
    }
}

//+------------------------------------------------------------------+
//| ポジションJSON作成（DB永続化用・リアルタイムデータ除外）        |
//+------------------------------------------------------------------+
string CreatePositionJson(int index) {
    if (!PositionSelect(index)) return "";
    
    return StringFormat(
        "{"
        "\"mtPositionId\": \"%d\","
        "\"symbol\": \"%s\","
        "\"type\": \"%s\","
        "\"volume\": %.2f,"
        "\"openPrice\": %.5f,"
        "\"openTime\": \"%s\","
        "\"lastSync\": \"%s\","
        "\"isActive\": true"
        "}",
        PositionGetInteger(POSITION_IDENTIFIER),
        PositionGetString(POSITION_SYMBOL),
        PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? "BUY" : "SELL",
        PositionGetDouble(POSITION_VOLUME),
        PositionGetDouble(POSITION_PRICE_OPEN),
        TimeToString(PositionGetInteger(POSITION_TIME)),
        TimeToString(TimeCurrent())
    );
}

//+------------------------------------------------------------------+
//| リアルタイム価格・利益データ送信（WebSocket専用・DB保存なし）   |
//+------------------------------------------------------------------+
string CreateRealtimePriceJson(int index) {
    if (!PositionSelect(index)) return "";
    
    return StringFormat(
        "{"
        "\"type\": \"REALTIME_PRICE_UPDATE\","
        "\"accountId\": \"%s\","
        "\"mtPositionId\": \"%d\","
        "\"currentPrice\": %.5f,"
        "\"profit\": %.2f,"
        "\"swap\": %.2f,"
        "\"timestamp\": \"%s\""
        "}",
        AccountID,
        PositionGetInteger(POSITION_IDENTIFIER),
        PositionGetDouble(POSITION_PRICE_CURRENT),
        PositionGetDouble(POSITION_PROFIT),
        PositionGetDouble(POSITION_SWAP),
        TimeToString(TimeCurrent())
    );
}

//+------------------------------------------------------------------+
//| 認証メッセージ作成                                              |
//+------------------------------------------------------------------+
string CreateAuthMessage() {
    return StringFormat(
        "{"
        "\"type\": \"AUTH\","
        "\"accountId\": \"%s\","
        "\"timestamp\": \"%s\","
        "\"broker\": \"%s\","
        "\"version\": \"1.0\""
        "}",
        AccountID,
        TimeToString(TimeCurrent()),
        AccountCompany()
    );
}

//+------------------------------------------------------------------+
//| 現在の同期バージョン計算                                        |
//+------------------------------------------------------------------+
ulong CalculateCurrentSyncVersion() {
    string hashData = "";
    int totalPositions = PositionsTotal();
    
    // 全ポジションの識別子とボリュームを結合
    for (int i = 0; i < totalPositions; i++) {
        if (PositionSelect(i)) {
            hashData += IntegerToString(PositionGetInteger(POSITION_IDENTIFIER));
            hashData += DoubleToString(PositionGetDouble(POSITION_VOLUME), 2);
        }
    }
    
    // 簡易ハッシュ計算
    ulong hash = 0;
    for (int i = 0; i < StringLen(hashData); i++) {
        hash = hash * 31 + StringGetCharacter(hashData, i);
    }
    
    return hash;
}

//+------------------------------------------------------------------+
//| WebSocketメッセージ送信                                         |
//+------------------------------------------------------------------+
bool SendWebSocketMessage(string message) {
    // TODO: 実際のWebSocket送信実装
    // ここでは模擬的な実装
    
    // メッセージサイズチェック
    if (StringLen(message) > 8192) {
        Print("Message too large: ", StringLen(message), " bytes");
        return false;
    }
    
    // 実際の送信処理（例: HTTP POSTまたはWebSocket DLL使用）
    // bool result = WebSocketSendDLL(message);
    
    // 模擬実装: 成功をランダムに決定（テスト用）
    bool result = MathRand() % 100 < 95; // 95%成功率
    
    if (!result) {
        Print("WebSocket send failed for message type: ", ExtractMessageType(message));
    }
    
    return result;
}

//+------------------------------------------------------------------+
//| メッセージタイプ抽出                                            |
//+------------------------------------------------------------------+
string ExtractMessageType(string message) {
    int start = StringFind(message, "\"type\": \"");
    if (start == -1) return "UNKNOWN";
    
    start += 8; // "type": " の長さ
    int end = StringFind(message, "\"", start);
    if (end == -1) return "UNKNOWN";
    
    return StringSubstr(message, start, end - start);
}

//+------------------------------------------------------------------+
//| 再接続試行                                                       |
//+------------------------------------------------------------------+
void AttemptReconnection() {
    if (ReconnectAttempts >= MaxReconnectAttempts) {
        Print("Max reconnection attempts reached. Manual intervention required.");
        return;
    }
    
    static datetime lastReconnectAttempt = 0;
    if (TimeCurrent() - lastReconnectAttempt < ReconnectDelay) {
        return; // まだ待機時間中
    }
    
    ReconnectAttempts++;
    lastReconnectAttempt = TimeCurrent();
    
    Print("Attempting reconnection #", ReconnectAttempts, "/", MaxReconnectAttempts);
    
    if (InitializeWebSocket()) {
        Print("Reconnection successful");
        // 再接続後は完全同期を実行
        SendFullSync();
    } else {
        Print("Reconnection failed. Will retry in ", ReconnectDelay, " seconds.");
    }
}

//+------------------------------------------------------------------+
//| WebSocket切断                                                   |
//+------------------------------------------------------------------+
void CloseWebSocket() {
    // TODO: 実際のWebSocket切断実装
    IsConnected = false;
    Print("WebSocket connection closed");
}

//+------------------------------------------------------------------+
//| サーバーからのメッセージ受信処理                                |
//+------------------------------------------------------------------+
void OnWebSocketMessage(string message) {
    // サーバーからのメッセージ処理
    string messageType = ExtractMessageType(message);
    
    if (messageType == "REQUEST_FULL_SYNC") {
        Print("Full sync requested by server");
        SendFullSync();
    }
    else if (messageType == "PING") {
        // Pongレスポンス
        string pongMessage = "{\"type\": \"PONG\", \"timestamp\": \"" + TimeToString(TimeCurrent()) + "\"}";
        SendWebSocketMessage(pongMessage);
    }
    else if (messageType == "TRADE_COMMAND") {
        // トレードコマンド処理
        ProcessTradeCommand(message);
    }
}

//+------------------------------------------------------------------+
//| トレードコマンド処理                                            |
//+------------------------------------------------------------------+
void ProcessTradeCommand(string commandJson) {
    Print("Received trade command: ", commandJson);
    // TODO: JSONパース・トレード実行実装
    
    // 実行結果をサーバーに報告
    string resultJson = StringFormat(
        "{"
        "\"type\": \"TRADE_RESULT\","
        "\"accountId\": \"%s\","
        "\"timestamp\": \"%s\","
        "\"success\": true,"
        "\"message\": \"Trade executed successfully\""
        "}",
        AccountID,
        TimeToString(TimeCurrent())
    );
    
    SendWebSocketMessage(resultJson);
}