"use client";

import React, { useEffect } from "react";
import { WebSocketProvider, useWebSocket, useWebSocketCommands } from "./index";
import { useAuth } from "../../hooks/useAuth";

// WebSocket接続テストコンポーネント
export function WebSocketTest() {
  const { isAuthenticated, getWebSocketConnectionOptions } = useAuth();
  const { connectionState, isConnected, connect, disconnect, lastMessage, connectionStats } = useWebSocket();
  const { sendPositionUpdate, sendAccountUpdate } = useWebSocketCommands();

  // 認証後に自動接続
  useEffect(() => {
    if (isAuthenticated && connectionState === "disconnected") {
      const options = getWebSocketConnectionOptions();
      if (options) {
        connect(options);
      }
    }
  }, [isAuthenticated, connectionState, connect, getWebSocketConnectionOptions]);

  // テストメッセージ送信
  const handleSendTestMessage = () => {
    if (isConnected) {
      sendPositionUpdate({
        accountId: "test-account-001",
        positions: [
          {
            id: "pos-001",
            accountId: "test-account-001",
            symbol: "EURUSD",
            type: "buy",
            lots: 0.1,
            openPrice: 1.0850,
            currentPrice: 1.0855,
            profit: 5.0,
            swapTotal: 0,
            commission: 0.5,
            status: "open",
            openedAt: new Date().toISOString(),
          }
        ],
        timestamp: Date.now(),
      });
    }
  };

  return (
    <div className="p-4 border rounded-lg">
      <h3 className="text-lg font-semibold mb-4">WebSocket接続テスト</h3>
      
      <div className="space-y-2">
        <div>
          <strong>接続状態:</strong> 
          <span className={`ml-2 px-2 py-1 rounded text-sm ${
            isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}>
            {connectionState}
          </span>
        </div>

        {connectionStats && (
          <div>
            <strong>再接続試行回数:</strong> {connectionStats.reconnectAttempts}
          </div>
        )}

        <div className="flex gap-2">
          <button 
            onClick={() => {
              const options = getWebSocketConnectionOptions();
              if (options) connect(options);
            }}
            disabled={isConnected}
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
          >
            接続
          </button>
          
          <button 
            onClick={disconnect}
            disabled={!isConnected}
            className="px-4 py-2 bg-red-500 text-white rounded disabled:opacity-50"
          >
            切断
          </button>
          
          <button 
            onClick={handleSendTestMessage}
            disabled={!isConnected}
            className="px-4 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            テストメッセージ送信
          </button>
        </div>

        {lastMessage && (
          <div className="mt-4 p-3 bg-gray-100 rounded">
            <strong>最新メッセージ:</strong>
            <pre className="text-sm mt-2 overflow-auto">
              {JSON.stringify(lastMessage, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// テスト用ラッパーコンポーネント
export function WebSocketTestWrapper() {
  return (
    <WebSocketProvider>
      <WebSocketTest />
    </WebSocketProvider>
  );
}