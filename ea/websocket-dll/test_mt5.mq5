//+------------------------------------------------------------------+
//|                                     WebSocketDLL_Test.mq5        |
//|                        Copyright 2025, ArbitrageAssistant        |
//|                                                                  |
//+------------------------------------------------------------------+
#property copyright "Copyright 2025, ArbitrageAssistant"
#property link      "https://github.com/ArbitrageAssistant"
#property version   "1.00"
#property strict

//+------------------------------------------------------------------+
//| DLL imports                                                      |
//+------------------------------------------------------------------+
#import "HedgeSystemWebSocket.dll"
int WSConnect(string url, string token);
void WSDisconnect();
int WSSendMessage(string message);
string WSReceiveMessage();
int WSIsConnected();
string WSGetLastError();
void WSFreeString(string str);
ulong WSGetMessagesSent();
ulong WSGetMessagesReceived();
int WSGetQueueSize();
int WSGetReconnectAttempts();
int WSGetConnectionState();
ulong WSGetConnectionDurationMs();
void WSCleanup();
#import

//+------------------------------------------------------------------+
//| Global variables                                                 |
//+------------------------------------------------------------------+
input string InpWebSocketURL = "wss://localhost:8080";  // WebSocket URL
input string InpAuthToken = "test-token";               // Authentication Token
input int InpTestDuration = 60;                         // Test duration in seconds

bool g_connected = false;
datetime g_startTime;
int g_messageCount = 0;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    Print("=== WebSocket DLL Test Starting ===");
    Print("DLL Test Version: 1.0");
    Print("WebSocket URL: ", InpWebSocketURL);
    
    // Attempt to connect
    Print("Attempting WebSocket connection...");
    int result = WSConnect(InpWebSocketURL, InpAuthToken);
    
    if(result == 1)
    {
        g_connected = true;
        g_startTime = TimeCurrent();
        Print("✅ WebSocket connected successfully!");
        
        // Send initial test message
        string initMsg = "{\"type\":\"init\",\"clientId\":\"MT5_TEST\",\"timestamp\":" + 
                        IntegerToString(TimeCurrent()) + "}";
        
        if(WSSendMessage(initMsg) == 1)
        {
            Print("✅ Initial message sent successfully");
            g_messageCount++;
        }
        else
        {
            Print("❌ Failed to send initial message");
        }
    }
    else
    {
        Print("❌ WebSocket connection failed!");
        string error = WSGetLastError();
        Print("Error: ", error);
        WSFreeString(error);
        return INIT_FAILED;
    }
    
    // Set timer for periodic operations
    EventSetTimer(1); // 1 second timer
    
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    Print("=== WebSocket DLL Test Ending ===");
    
    // Kill timer
    EventKillTimer();
    
    if(g_connected)
    {
        // Get final statistics
        ulong sent = WSGetMessagesSent();
        ulong received = WSGetMessagesReceived();
        int queueSize = WSGetQueueSize();
        ulong duration = WSGetConnectionDurationMs();
        
        Print("📊 Final Statistics:");
        Print("- Messages Sent: ", sent);
        Print("- Messages Received: ", received);
        Print("- Queue Size: ", queueSize);
        Print("- Connection Duration: ", duration, " ms");
        Print("- Reconnect Attempts: ", WSGetReconnectAttempts());
        
        // Disconnect
        WSDisconnect();
        g_connected = false;
        Print("✅ WebSocket disconnected");
    }
    
    // Cleanup
    WSCleanup();
    Print("✅ DLL cleanup completed");
}

//+------------------------------------------------------------------+
//| Timer function                                                   |
//+------------------------------------------------------------------+
void OnTimer()
{
    if(!g_connected)
        return;
        
    // Check connection status
    if(WSIsConnected() != 1)
    {
        Print("⚠️ Connection lost! State: ", WSGetConnectionState());
        g_connected = false;
        return;
    }
    
    // Send periodic test message
    if(g_messageCount % 5 == 0) // Every 5 seconds
    {
        string testMsg = StringFormat("{\"type\":\"ping\",\"sequence\":%d,\"timestamp\":%d}", 
                                     g_messageCount, TimeCurrent());
        
        if(WSSendMessage(testMsg) == 1)
        {
            Print("📤 Sent: ", testMsg);
        }
    }
    g_messageCount++;
    
    // Check for incoming messages
    string received = WSReceiveMessage();
    if(received != NULL && StringLen(received) > 0)
    {
        Print("📥 Received: ", received);
        WSFreeString(received);
    }
    
    // Check test duration
    if(TimeCurrent() - g_startTime > InpTestDuration)
    {
        Print("Test duration completed. Stopping EA...");
        ExpertRemove();
    }
}

//+------------------------------------------------------------------+
//| Tick function                                                    |
//+------------------------------------------------------------------+
void OnTick()
{
    // Check for messages on each tick
    if(g_connected && WSIsConnected() == 1)
    {
        string msg = WSReceiveMessage();
        if(msg != NULL && StringLen(msg) > 0)
        {
            ProcessMessage(msg);
            WSFreeString(msg);
        }
    }
}

//+------------------------------------------------------------------+
//| Process received message                                         |
//+------------------------------------------------------------------+
void ProcessMessage(string message)
{
    Print("📨 Processing: ", message);
    
    // Simple JSON parsing (basic example)
    if(StringFind(message, "\"type\":\"pong\"") >= 0)
    {
        Print("✅ Received pong response");
    }
    else if(StringFind(message, "\"type\":\"quote\"") >= 0)
    {
        Print("📊 Received market quote");
        // Process quote data here
    }
    else if(StringFind(message, "\"type\":\"error\"") >= 0)
    {
        Print("❌ Received error message");
    }
}

//+------------------------------------------------------------------+
//| Test various DLL functions                                      |
//+------------------------------------------------------------------+
void TestDLLFunctions()
{
    Print("=== Testing DLL Functions ===");
    
    // Test connection state
    int state = WSGetConnectionState();
    Print("Connection State: ", state);
    
    // Test message counters
    Print("Messages Sent: ", WSGetMessagesSent());
    Print("Messages Received: ", WSGetMessagesReceived());
    
    // Test queue size
    Print("Queue Size: ", WSGetQueueSize());
    
    // Test connection duration
    Print("Connection Duration: ", WSGetConnectionDurationMs(), " ms");
    
    // Test error handling
    string error = WSGetLastError();
    if(error != NULL && StringLen(error) > 0)
    {
        Print("Last Error: ", error);
        WSFreeString(error);
    }
    else
    {
        Print("No errors");
    }
    
    Print("=== DLL Function Test Complete ===");
}

//+------------------------------------------------------------------+