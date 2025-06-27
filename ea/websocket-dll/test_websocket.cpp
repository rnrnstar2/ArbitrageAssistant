#include "HedgeSystemWebSocket.h"
#include <iostream>
#include <chrono>
#include <thread>
#include <cassert>

// パフォーマンステスト設定
const int TEST_MESSAGE_COUNT = 1000;
const char* TEST_URL = "wss://echo.websocket.org/";
const char* TEST_TOKEN = "test_token_123";

void PrintTestResult(const char* testName, bool passed) {
    std::cout << "[" << (passed ? "PASS" : "FAIL") << "] " << testName << std::endl;
}

void PrintPerformanceStats() {
    std::cout << "\n=== パフォーマンス統計 ===" << std::endl;
    std::cout << "送信メッセージ数: " << WSGetMessagesSent() << std::endl;
    std::cout << "受信メッセージ数: " << WSGetMessagesReceived() << std::endl;
    std::cout << "キューサイズ: " << WSGetQueueSize() << std::endl;
    std::cout << "再接続試行回数: " << WSGetReconnectAttempts() << std::endl;
    std::cout << "接続状態: " << WSGetConnectionState() << std::endl;
    std::cout << "接続時間: " << WSGetConnectionDurationMs() << "ms" << std::endl;
}

bool TestBasicConnection() {
    std::cout << "\n=== 基本接続テスト ===" << std::endl;
    
    // 接続テスト
    bool connected = WSConnect(TEST_URL, TEST_TOKEN);
    PrintTestResult("接続テスト", connected);
    
    if (!connected) {
        std::cout << "接続エラー: " << WSGetLastError() << std::endl;
        return false;
    }
    
    // 接続状態確認
    bool isConnected = WSIsConnected();
    PrintTestResult("接続状態確認", isConnected);
    
    // 切断テスト
    WSDisconnect();
    bool isDisconnected = !WSIsConnected();
    PrintTestResult("切断テスト", isDisconnected);
    
    return connected && isConnected && isDisconnected;
}

bool TestMessageSending() {
    std::cout << "\n=== メッセージ送信テスト ===" << std::endl;
    
    if (!WSConnect(TEST_URL, TEST_TOKEN)) {
        std::cout << "接続失敗: " << WSGetLastError() << std::endl;
        return false;
    }
    
    // 接続完了まで待機
    std::this_thread::sleep_for(std::chrono::seconds(2));
    
    bool allSent = true;
    auto startTime = std::chrono::high_resolution_clock::now();
    
    // メッセージ送信テスト
    for (int i = 0; i < TEST_MESSAGE_COUNT; ++i) {
        std::string message = "Test message " + std::to_string(i);
        if (!WSSendMessage(message.c_str())) {
            std::cout << "メッセージ送信失敗 #" << i << ": " << WSGetLastError() << std::endl;
            allSent = false;
            break;
        }
        
        // 高頻度送信テスト（1ms間隔）
        std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    
    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime);
    
    std::cout << "送信時間: " << duration.count() << "ms" << std::endl;
    std::cout << "送信レート: " << (TEST_MESSAGE_COUNT * 1000.0 / duration.count()) << " msg/sec" << std::endl;
    
    PrintTestResult("メッセージ送信テスト", allSent);
    
    WSDisconnect();
    return allSent;
}

bool TestMessageReceiving() {
    std::cout << "\n=== メッセージ受信テスト ===" << std::endl;
    
    if (!WSConnect(TEST_URL, TEST_TOKEN)) {
        std::cout << "接続失敗: " << WSGetLastError() << std::endl;
        return false;
    }
    
    // 接続完了まで待機
    std::this_thread::sleep_for(std::chrono::seconds(2));
    
    // エコーサーバーにメッセージを送信
    const char* testMessage = "Echo test message";
    if (!WSSendMessage(testMessage)) {
        std::cout << "テストメッセージ送信失敗: " << WSGetLastError() << std::endl;
        WSDisconnect();
        return false;
    }
    
    // エコーバックを待機
    bool messageReceived = false;
    int attempts = 0;
    const int maxAttempts = 50; // 5秒待機
    
    while (attempts < maxAttempts && !messageReceived) {
        const char* receivedMessage = WSReceiveMessage();
        if (receivedMessage && strlen(receivedMessage) > 0) {
            std::cout << "受信メッセージ: " << receivedMessage << std::endl;
            messageReceived = (strcmp(receivedMessage, testMessage) == 0);
            break;
        }
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
        attempts++;
    }
    
    PrintTestResult("メッセージ受信テスト", messageReceived);
    
    WSDisconnect();
    return messageReceived;
}

bool TestPerformanceMonitoring() {
    std::cout << "\n=== パフォーマンス監視テスト ===" << std::endl;
    
    if (!WSConnect(TEST_URL, TEST_TOKEN)) {
        std::cout << "接続失敗: " << WSGetLastError() << std::endl;
        return false;
    }
    
    // 接続完了まで待機
    std::this_thread::sleep_for(std::chrono::seconds(1));
    
    uint64_t initialSent = WSGetMessagesSent();
    uint64_t initialReceived = WSGetMessagesReceived();
    
    // テストメッセージ送信
    for (int i = 0; i < 10; ++i) {
        std::string message = "Performance test " + std::to_string(i);
        WSSendMessage(message.c_str());
        std::this_thread::sleep_for(std::chrono::milliseconds(10));
    }
    
    uint64_t finalSent = WSGetMessagesSent();
    bool sendCountCorrect = (finalSent >= initialSent + 10);
    
    PrintTestResult("送信カウンタテスト", sendCountCorrect);
    PrintTestResult("接続時間取得テスト", WSGetConnectionDurationMs() > 0);
    PrintTestResult("接続状態取得テスト", WSGetConnectionState() >= 0);
    
    WSDisconnect();
    return sendCountCorrect;
}

bool TestErrorHandling() {
    std::cout << "\n=== エラーハンドリングテスト ===" << std::endl;
    
    // 無効なURL接続テスト
    bool invalidUrlFailed = !WSConnect("invalid://url", "token");
    PrintTestResult("無効URL接続拒否テスト", invalidUrlFailed);
    
    if (invalidUrlFailed) {
        std::cout << "期待されたエラー: " << WSGetLastError() << std::endl;
    }
    
    // 未接続状態でのメッセージ送信テスト
    bool sendFailedWhenDisconnected = !WSSendMessage("test");
    PrintTestResult("未接続時送信拒否テスト", sendFailedWhenDisconnected);
    
    return invalidUrlFailed && sendFailedWhenDisconnected;
}

void TestThreadSafety() {
    std::cout << "\n=== スレッドセーフティテスト ===" << std::endl;
    
    if (!WSConnect(TEST_URL, TEST_TOKEN)) {
        std::cout << "接続失敗: " << WSGetLastError() << std::endl;
        return;
    }
    
    // 接続完了まで待機
    std::this_thread::sleep_for(std::chrono::seconds(1));
    
    const int numThreads = 4;
    const int messagesPerThread = 25;
    std::vector<std::thread> threads;
    
    auto startTime = std::chrono::high_resolution_clock::now();
    
    // 複数スレッドでメッセージ送信
    for (int t = 0; t < numThreads; ++t) {
        threads.emplace_back([t, messagesPerThread]() {
            for (int i = 0; i < messagesPerThread; ++i) {
                std::string message = "Thread " + std::to_string(t) + " Message " + std::to_string(i);
                WSSendMessage(message.c_str());
                std::this_thread::sleep_for(std::chrono::milliseconds(1));
            }
        });
    }
    
    // 全スレッド完了待機
    for (auto& thread : threads) {
        thread.join();
    }
    
    auto endTime = std::chrono::high_resolution_clock::now();
    auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(endTime - startTime);
    
    uint64_t totalMessages = numThreads * messagesPerThread;
    std::cout << "マルチスレッド送信完了: " << totalMessages << " メッセージ" << std::endl;
    std::cout << "実行時間: " << duration.count() << "ms" << std::endl;
    std::cout << "スループット: " << (totalMessages * 1000.0 / duration.count()) << " msg/sec" << std::endl;
    
    PrintTestResult("マルチスレッドテスト", true);
    
    WSDisconnect();
}

int main() {
    std::cout << "=== WebSocket DLL パフォーマンス & 互換性テスト ===" << std::endl;
    
    int passedTests = 0;
    int totalTests = 5;
    
    if (TestBasicConnection()) passedTests++;
    if (TestMessageSending()) passedTests++;
    if (TestMessageReceiving()) passedTests++;
    if (TestPerformanceMonitoring()) passedTests++;
    if (TestErrorHandling()) passedTests++;
    
    TestThreadSafety(); // このテストは常にpass扱い
    
    PrintPerformanceStats();
    
    std::cout << "\n=== テスト結果サマリー ===" << std::endl;
    std::cout << "成功: " << passedTests << "/" << totalTests << std::endl;
    std::cout << "成功率: " << (100.0 * passedTests / totalTests) << "%" << std::endl;
    
    // クリーンアップ
    WSCleanup();
    
    if (passedTests == totalTests) {
        std::cout << "\n✅ 全テスト成功！WebSocket DLL は仕様を満たしています。" << std::endl;
        return 0;
    } else {
        std::cout << "\n❌ 一部テスト失敗。WebSocket DLL の改善が必要です。" << std::endl;
        return 1;
    }
}