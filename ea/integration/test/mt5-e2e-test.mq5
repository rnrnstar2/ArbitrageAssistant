//+------------------------------------------------------------------+
//|                                              mt5-e2e-test.mq5    |
//|                          Copyright 2024, ArbitrageAssistant      |
//|                                          Integration E2E Test    |
//+------------------------------------------------------------------+
#property copyright "Copyright 2024, ArbitrageAssistant"
#property link      "https://example.com"
#property version   "1.00"
#property strict

// WebSocket DLL import
#import "HedgeSystemWebSocket.dll"
   bool WSConnect(string url, string token);
   void WSDisconnect();
   bool WSSendMessage(string message);
   string WSReceiveMessage();
   bool WSIsConnected();
#import

//+------------------------------------------------------------------+
//| Test Configuration                                               |
//+------------------------------------------------------------------+
input bool   RUN_CONNECTION_TEST  = true;   // 接続テスト実行
input bool   RUN_COMMAND_TEST     = true;   // コマンドテスト実行
input bool   RUN_TRAIL_TEST       = true;   // トレールテスト実行
input bool   RUN_RECONNECT_TEST   = true;   // 再接続テスト実行
input bool   RUN_PERFORMANCE_TEST = true;   // パフォーマンステスト実行
input int    TEST_DURATION        = 3600;   // テスト期間（秒）

//+------------------------------------------------------------------+
//| Test Results Structure                                           |
//+------------------------------------------------------------------+
struct TestResult
{
    string testName;
    bool   passed;
    string details;
    double latency;
    datetime timestamp;
};

//+------------------------------------------------------------------+
//| E2E Test Class                                                   |
//+------------------------------------------------------------------+
class MT5EndToEndTest
{
private:
    TestResult m_results[];
    int        m_resultCount;
    datetime   m_testStart;
    datetime   m_testEnd;
    HedgeSystemConnector* m_connector;
    
    // パフォーマンス測定用
    double     m_totalLatency;
    int        m_latencyCount;
    double     m_maxLatency;
    double     m_minLatency;
    
public:
    MT5EndToEndTest();
    ~MT5EndToEndTest();
    
    void RunAllTests();
    void GenerateReport();
    
private:
    // 個別テスト
    void TestConnection();
    void TestOpenCommand();
    void TestCloseCommand();
    void TestTrailTriggered();
    void TestAutoReconnect();
    void TestPerformance();
    
    // ヘルパー関数
    void AddResult(string testName, bool passed, string details, double latency = 0);
    double MeasureLatency(datetime start);
    bool WaitForResponse(int timeoutMs);
    string CreateTestOrderMessage(string command, string symbol, double lots, ulong ticket = 0);
    bool ValidateResponse(string response, string expectedType);
    bool SendMessage(string message);
    string GetLastResponse();
    bool HasNewResponse();
    bool IsConnected();
    bool IsTrailActive(string positionId);
};

//+------------------------------------------------------------------+
//| Constructor                                                      |
//+------------------------------------------------------------------+
MT5EndToEndTest::MT5EndToEndTest()
{
    m_resultCount = 0;
    m_totalLatency = 0;
    m_latencyCount = 0;
    m_maxLatency = 0;
    m_minLatency = 999999;
    m_connector = new HedgeSystemConnector();
}

//+------------------------------------------------------------------+
//| Destructor                                                       |
//+------------------------------------------------------------------+
MT5EndToEndTest::~MT5EndToEndTest()
{
    if(m_connector != NULL)
    {
        delete m_connector;
    }
}

//+------------------------------------------------------------------+
//| Run All Tests                                                    |
//+------------------------------------------------------------------+
void MT5EndToEndTest::RunAllTests()
{
    m_testStart = TimeCurrent();
    Print("=== MT5 End-to-End Test Started ===");
    Print("Test Start Time: ", TimeToString(m_testStart));
    
    // 接続テスト
    if(RUN_CONNECTION_TEST)
    {
        TestConnection();
    }
    
    // コマンドテスト
    if(RUN_COMMAND_TEST && m_connector.IsConnected())
    {
        TestOpenCommand();
        Sleep(2000); // 2秒待機
        TestCloseCommand();
    }
    
    // トレールテスト
    if(RUN_TRAIL_TEST && m_connector.IsConnected())
    {
        TestTrailTriggered();
    }
    
    // 再接続テスト
    if(RUN_RECONNECT_TEST)
    {
        TestAutoReconnect();
    }
    
    // パフォーマンステスト
    if(RUN_PERFORMANCE_TEST && m_connector.IsConnected())
    {
        TestPerformance();
    }
    
    m_testEnd = TimeCurrent();
    GenerateReport();
}

//+------------------------------------------------------------------+
//| Connection Test                                                  |
//+------------------------------------------------------------------+
void MT5EndToEndTest::TestConnection()
{
    Print("Running Connection Test...");
    datetime start = GetMicrosecondCount();
    
    bool connected = m_connector.Connect(WS_URL, AUTH_TOKEN, 
                                       AccountInfoString(ACCOUNT_NAME) + "_TEST");
    
    double latency = MeasureLatency(start);
    
    if(connected)
    {
        AddResult("Connection Test", true, "Successfully connected to WebSocket", latency);
    }
    else
    {
        AddResult("Connection Test", false, "Failed to connect to WebSocket", latency);
    }
}

//+------------------------------------------------------------------+
//| Open Command Test                                                |
//+------------------------------------------------------------------+
void MT5EndToEndTest::TestOpenCommand()
{
    Print("Running Open Command Test...");
    
    string message = CreateTestOrderMessage("OPEN", "EURUSD", 0.01);
    datetime start = GetMicrosecondCount();
    
    if(m_connector.SendMessage(message))
    {
        if(WaitForResponse(5000)) // 5秒待機
        {
            string response = m_connector.GetLastResponse();
            double latency = MeasureLatency(start);
            
            if(ValidateResponse(response, "OPENED"))
            {
                AddResult("Open Command Test", true, "OPEN command executed successfully", latency);
            }
            else
            {
                AddResult("Open Command Test", false, "Invalid response: " + response, latency);
            }
        }
        else
        {
            AddResult("Open Command Test", false, "Timeout waiting for response", 0);
        }
    }
    else
    {
        AddResult("Open Command Test", false, "Failed to send OPEN command", 0);
    }
}

//+------------------------------------------------------------------+
//| Close Command Test                                               |
//+------------------------------------------------------------------+
void MT5EndToEndTest::TestCloseCommand()
{
    Print("Running Close Command Test...");
    
    // 既存のポジションを取得
    if(PositionsTotal() > 0)
    {
        ulong ticket = PositionGetTicket(0);
        string message = CreateTestOrderMessage("CLOSE", "", 0, ticket);
        datetime start = GetMicrosecondCount();
        
        if(m_connector.SendMessage(message))
        {
            if(WaitForResponse(5000))
            {
                string response = m_connector.GetLastResponse();
                double latency = MeasureLatency(start);
                
                if(ValidateResponse(response, "CLOSED"))
                {
                    AddResult("Close Command Test", true, "CLOSE command executed successfully", latency);
                }
                else
                {
                    AddResult("Close Command Test", false, "Invalid response: " + response, latency);
                }
            }
            else
            {
                AddResult("Close Command Test", false, "Timeout waiting for response", 0);
            }
        }
        else
        {
            AddResult("Close Command Test", false, "Failed to send CLOSE command", 0);
        }
    }
    else
    {
        AddResult("Close Command Test", false, "No positions to close", 0);
    }
}

//+------------------------------------------------------------------+
//| Trail Triggered Test                                             |
//+------------------------------------------------------------------+
void MT5EndToEndTest::TestTrailTriggered()
{
    Print("Running Trail Triggered Test...");
    
    // トレールイベントのシミュレーション
    string trailMessage = "{\"type\":\"TRAIL_TRIGGERED\",\"positionId\":\"test-001\",\"trailPrice\":1.1050,\"stopLoss\":1.1045}";
    
    if(m_connector.SendMessage(trailMessage))
    {
        Sleep(1000); // 1秒待機
        
        // トレール処理の確認
        if(m_connector.IsTrailActive("test-001"))
        {
            AddResult("Trail Triggered Test", true, "Trail event processed successfully", 0);
        }
        else
        {
            AddResult("Trail Triggered Test", false, "Trail event not processed", 0);
        }
    }
    else
    {
        AddResult("Trail Triggered Test", false, "Failed to send trail event", 0);
    }
}

//+------------------------------------------------------------------+
//| Auto Reconnect Test                                              |
//+------------------------------------------------------------------+
void MT5EndToEndTest::TestAutoReconnect()
{
    Print("Running Auto Reconnect Test...");
    
    // 意図的に切断
    m_connector.Disconnect();
    Sleep(2000);
    
    // 再接続試行
    datetime start = GetMicrosecondCount();
    int attempts = 0;
    bool reconnected = false;
    
    while(attempts < 5 && !reconnected)
    {
        reconnected = m_connector.Connect(WS_URL, AUTH_TOKEN, 
                                        AccountInfoString(ACCOUNT_NAME) + "_TEST");
        if(!reconnected)
        {
            Sleep(2000);
            attempts++;
        }
    }
    
    double latency = MeasureLatency(start);
    
    if(reconnected)
    {
        AddResult("Auto Reconnect Test", true, 
                 StringFormat("Reconnected after %d attempts", attempts + 1), latency);
    }
    else
    {
        AddResult("Auto Reconnect Test", false, "Failed to reconnect after 5 attempts", latency);
    }
}

//+------------------------------------------------------------------+
//| Performance Test                                                 |
//+------------------------------------------------------------------+
void MT5EndToEndTest::TestPerformance()
{
    Print("Running Performance Test...");
    Print("Duration: ", TEST_DURATION, " seconds");
    
    datetime testStart = TimeCurrent();
    int messageCount = 0;
    double totalLatency = 0;
    
    while(TimeCurrent() - testStart < TEST_DURATION)
    {
        // ハートビート送信
        datetime start = GetMicrosecondCount();
        string heartbeat = "{\"type\":\"HEARTBEAT\",\"timestamp\":" + 
                          IntegerToString(TimeCurrent()) + "}";
        
        if(m_connector.SendMessage(heartbeat))
        {
            double latency = MeasureLatency(start);
            totalLatency += latency;
            messageCount++;
            
            // 統計更新
            if(latency > m_maxLatency) m_maxLatency = latency;
            if(latency < m_minLatency) m_minLatency = latency;
        }
        
        Sleep(1000); // 1秒間隔
    }
    
    double avgLatency = messageCount > 0 ? totalLatency / messageCount : 0;
    
    string details = StringFormat("Messages: %d, Avg: %.2fms, Min: %.2fms, Max: %.2fms",
                                messageCount, avgLatency, m_minLatency, m_maxLatency);
    
    // 10ms以下の要件チェック
    bool passed = avgLatency <= 10.0;
    AddResult("Performance Test", passed, details, avgLatency);
}

//+------------------------------------------------------------------+
//| Helper: Add Test Result                                          |
//+------------------------------------------------------------------+
void MT5EndToEndTest::AddResult(string testName, bool passed, string details, double latency)
{
    ArrayResize(m_results, m_resultCount + 1);
    m_results[m_resultCount].testName = testName;
    m_results[m_resultCount].passed = passed;
    m_results[m_resultCount].details = details;
    m_results[m_resultCount].latency = latency;
    m_results[m_resultCount].timestamp = TimeCurrent();
    m_resultCount++;
    
    Print(testName, ": ", passed ? "PASSED" : "FAILED", " - ", details);
}

//+------------------------------------------------------------------+
//| Helper: Measure Latency                                          |
//+------------------------------------------------------------------+
double MT5EndToEndTest::MeasureLatency(datetime start)
{
    return (double)(GetMicrosecondCount() - start) / 1000.0; // マイクロ秒をミリ秒に変換
}

//+------------------------------------------------------------------+
//| Helper: Wait for Response                                        |
//+------------------------------------------------------------------+
bool MT5EndToEndTest::WaitForResponse(int timeoutMs)
{
    datetime start = GetMicrosecondCount();
    while((GetMicrosecondCount() - start) / 1000 < timeoutMs)
    {
        if(m_connector.HasNewResponse())
        {
            return true;
        }
        Sleep(10);
    }
    return false;
}

//+------------------------------------------------------------------+
//| Helper: Create Test Order Message                                |
//+------------------------------------------------------------------+
string MT5EndToEndTest::CreateTestOrderMessage(string command, string symbol, double lots, ulong ticket = 0)
{
    if(command == "OPEN")
    {
        return StringFormat("{\"type\":\"OPEN\",\"symbol\":\"%s\",\"lots\":%.2f,\"positionId\":\"test-%d\",\"actionId\":\"action-%d\"}",
                          symbol, lots, GetTickCount(), GetTickCount());
    }
    else if(command == "CLOSE" && ticket > 0)
    {
        return StringFormat("{\"type\":\"CLOSE\",\"ticket\":%d,\"positionId\":\"test-%d\",\"actionId\":\"action-%d\"}",
                          ticket, GetTickCount(), GetTickCount());
    }
    return "";
}

//+------------------------------------------------------------------+
//| Helper: Validate Response                                        |
//+------------------------------------------------------------------+
bool MT5EndToEndTest::ValidateResponse(string response, string expectedType)
{
    return StringFind(response, "\"type\":\"" + expectedType + "\"") >= 0;
}

//+------------------------------------------------------------------+
//| Generate Test Report                                             |
//+------------------------------------------------------------------+
void MT5EndToEndTest::GenerateReport()
{
    Print("=== MT5 End-to-End Test Report ===");
    Print("Test Duration: ", (m_testEnd - m_testStart), " seconds");
    Print("Total Tests: ", m_resultCount);
    
    int passed = 0;
    int failed = 0;
    
    for(int i = 0; i < m_resultCount; i++)
    {
        if(m_results[i].passed)
            passed++;
        else
            failed++;
    }
    
    Print("Passed: ", passed);
    Print("Failed: ", failed);
    Print("Success Rate: ", passed * 100.0 / m_resultCount, "%");
    
    // 詳細結果
    Print("\n=== Detailed Results ===");
    for(int i = 0; i < m_resultCount; i++)
    {
        Print(m_results[i].testName, ": ", 
              m_results[i].passed ? "PASSED" : "FAILED",
              " - ", m_results[i].details);
        if(m_results[i].latency > 0)
        {
            Print("  Latency: ", DoubleToString(m_results[i].latency, 2), " ms");
        }
    }
    
    // パフォーマンス統計
    if(m_latencyCount > 0)
    {
        Print("\n=== Performance Statistics ===");
        Print("Average Latency: ", DoubleToString(m_totalLatency / m_latencyCount, 2), " ms");
        Print("Min Latency: ", DoubleToString(m_minLatency, 2), " ms");
        Print("Max Latency: ", DoubleToString(m_maxLatency, 2), " ms");
    }
}

//+------------------------------------------------------------------+
//| Global Test Instance                                             |
//+------------------------------------------------------------------+
MT5EndToEndTest* g_test = NULL;

//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
    g_test = new MT5EndToEndTest();
    
    // テスト実行
    g_test.RunAllTests();
    
    return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
    if(g_test != NULL)
    {
        delete g_test;
        g_test = NULL;
    }
}

//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
    // E2Eテストでは使用しない
}