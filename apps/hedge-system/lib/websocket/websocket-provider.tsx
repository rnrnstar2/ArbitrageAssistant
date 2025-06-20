"use client";

import React, { createContext, useContext, useEffect, useRef, useState, ReactNode, useCallback } from "react";
import { WebSocketClient, WebSocketConnectionState, WebSocketConnectionOptions, WebSocketEventType } from "./websocket-client";
import { WebSocketMessage, PositionUpdateMessage, AccountUpdateMessage, isPositionUpdateMessage, isAccountUpdateMessage, isMarketDataMessage, isLosscutAlertMessage } from "./message-types";

export interface WebSocketContextType {
  connectionState: WebSocketConnectionState;
  isConnected: boolean;
  connect: (options: WebSocketConnectionOptions) => void;
  disconnect: () => void;
  sendMessage: (message: WebSocketMessage) => void;
  lastMessage: WebSocketMessage | null;
  connectionStats: ReturnType<WebSocketClient["getConnectionStats"]> | null;
  error: any;
  errorStats: ReturnType<WebSocketClient["getErrorStats"]> | null;
  clearErrorHistory: () => void;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
  autoConnect?: boolean;
  connectionOptions?: WebSocketConnectionOptions;
}

export function WebSocketProvider({ 
  children, 
  autoConnect = false,
  connectionOptions 
}: WebSocketProviderProps) {
  const [connectionState, setConnectionState] = useState<WebSocketConnectionState>("disconnected");
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<any>(null);
  const [connectionStats, setConnectionStats] = useState<ReturnType<WebSocketClient["getConnectionStats"]> | null>(null);
  const [errorStats, setErrorStats] = useState<ReturnType<WebSocketClient["getErrorStats"]> | null>(null);
  
  const wsClient = useRef<WebSocketClient | null>(null);
  const isConnected = connectionState === "connected";

  const connect = useCallback((options: WebSocketConnectionOptions) => {
    if (wsClient.current) {
      wsClient.current.disconnect();
    }

    wsClient.current = new WebSocketClient(options);

    // Set up event listeners
    wsClient.current.on("connection_state_changed", (_, state) => {
      setConnectionState(state);
      setConnectionStats(wsClient.current?.getConnectionStats() || null);
      setErrorStats(wsClient.current?.getErrorStats() || null);
    });

    wsClient.current.on("message_received", (_, message) => {
      setLastMessage(message);
    });

    wsClient.current.on("error", (_, errorData) => {
      setError(errorData);
      setErrorStats(wsClient.current?.getErrorStats() || null);
      console.error("WebSocket error:", errorData);
    });

    wsClient.current.on("heartbeat_sent", (_, message) => {
      console.debug("Heartbeat sent:", message);
    });

    wsClient.current.on("heartbeat_received", (_, message) => {
      console.debug("Heartbeat received:", message);
      setConnectionStats(wsClient.current?.getConnectionStats() || null);
    });

    wsClient.current.connect();
  }, []);

  const disconnect = useCallback(() => {
    if (wsClient.current) {
      wsClient.current.disconnect();
      wsClient.current = null;
    }
    setConnectionState("disconnected");
    setConnectionStats(null);
    setError(null);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsClient.current && isConnected) {
      wsClient.current.send(message);
    } else {
      console.warn("Cannot send message: WebSocket not connected");
    }
  }, [isConnected]);

  const clearErrorHistory = useCallback(() => {
    if (wsClient.current) {
      wsClient.current.clearErrorHistory();
      setErrorStats(wsClient.current.getErrorStats());
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && connectionOptions && !wsClient.current) {
      connect(connectionOptions);
    }

    // Cleanup on unmount
    return () => {
      if (wsClient.current) {
        wsClient.current.disconnect();
      }
    };
  }, [autoConnect, connectionOptions, connect]);

  // Update connection stats periodically
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(() => {
      if (wsClient.current) {
        setConnectionStats(wsClient.current.getConnectionStats());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isConnected]);

  const contextValue: WebSocketContextType = {
    connectionState,
    isConnected,
    connect,
    disconnect,
    sendMessage,
    lastMessage,
    connectionStats,
    error,
    errorStats,
    clearErrorHistory,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextType {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
}

// Hook for sending specific message types
export function useWebSocketCommands() {
  const { sendMessage, isConnected } = useWebSocket();

  const sendPositionUpdate = useCallback((payload: any) => {
    sendMessage({
      type: "position_update",
      payload,
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const sendAccountUpdate = useCallback((payload: any) => {
    sendMessage({
      type: "account_update", 
      payload,
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const sendCommand = useCallback((payload: any) => {
    sendMessage({
      type: "command",
      payload,
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const requestRealtimeData = useCallback((accountId: string, dataTypes?: ('account' | 'positions' | 'market' | 'margin')[]) => {
    sendMessage({
      type: "command",
      payload: {
        commandId: `req_${Date.now()}`,
        action: "request_realtime_data",
        params: {
          dataTypes: dataTypes || ['account', 'positions', 'market', 'margin'],
          updateInterval: 1, // 1 second updates
          responseFormat: 'detailed'
        },
        targetClientId: accountId,
      },
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const requestAccountData = useCallback((accountId: string) => {
    sendMessage({
      type: "command",
      payload: {
        commandId: `req_acc_${Date.now()}`,
        action: "request_account_data",
        params: {
          includeBonus: true,
          includeMarginInfo: true,
          responseFormat: 'detailed'
        },
        targetClientId: accountId,
      },
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const requestPositionData = useCallback((accountId: string, symbols?: string[]) => {
    sendMessage({
      type: "command",
      payload: {
        commandId: `req_pos_${Date.now()}`,
        action: "request_position_data",
        params: {
          symbols,
          includeHistory: false,
          responseFormat: 'detailed'
        },
        targetClientId: accountId,
      },
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const requestMarketData = useCallback((accountId: string, symbols: string[]) => {
    sendMessage({
      type: "command",
      payload: {
        commandId: `req_mkt_${Date.now()}`,
        action: "request_market_data",
        params: {
          symbols,
          includeSpread: true,
          includeVolume: true,
          responseFormat: 'detailed'
        },
        targetClientId: accountId,
      },
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  const requestMarginData = useCallback((accountId: string) => {
    sendMessage({
      type: "command",
      payload: {
        commandId: `req_mrg_${Date.now()}`,
        action: "request_margin_data",
        params: {
          includeUsedMargin: true,
          includeFreeMargin: true,
          includeMarginLevel: true,
          responseFormat: 'detailed'
        },
        targetClientId: accountId,
      },
      timestamp: Date.now(),
    });
  }, [sendMessage]);

  return {
    sendPositionUpdate,
    sendAccountUpdate,
    sendCommand,
    requestRealtimeData,
    requestAccountData,
    requestPositionData,
    requestMarketData,
    requestMarginData,
    isConnected,
  };
}

// Hook for subscribing to realtime data updates
export function useRealtimeData(accountId?: string) {
  const { lastMessage } = useWebSocket();
  const wsClient = useRef<WebSocketClient | null>(null);
  
  const [positionData, setPositionData] = useState<any>(null);
  const [accountData, setAccountData] = useState<any>(null);
  const [marketData, setMarketData] = useState<any>(null);
  const [losscutAlert, setLosscutAlert] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Handle incoming messages
  useEffect(() => {
    if (!lastMessage) return;

    // Position updates
    if (isPositionUpdateMessage(lastMessage)) {
      const payload = lastMessage.payload;
      if (!accountId || payload.accountId === accountId) {
        setPositionData(payload);
        setLastUpdate(new Date());
      }
    }

    // Account updates
    if (isAccountUpdateMessage(lastMessage)) {
      const payload = lastMessage.payload;
      if (!accountId || payload.accountId === accountId) {
        setAccountData(payload);
        setLastUpdate(new Date());
      }
    }

    // Market data updates
    if (lastMessage.type === "market_data") {
      setMarketData(lastMessage.payload);
      setLastUpdate(new Date());
    }

    // Losscut alerts
    if (lastMessage.type === "losscut_alert") {
      const payload = lastMessage.payload as any;
      if (!accountId || payload.accountId === accountId) {
        setLosscutAlert(payload);
        setLastUpdate(new Date());
      }
    }
  }, [lastMessage, accountId]);

  return {
    positionData,
    accountData,
    marketData,
    losscutAlert,
    lastUpdate,
  };
}

// Hook for subscribing to specific WebSocket events
export function useWebSocketEvent<T = any>(
  eventType: WebSocketEventType,
  handler: (data: T) => void
) {
  const wsClient = useRef<WebSocketClient | null>(null);

  useEffect(() => {
    // Get WebSocket client from somewhere (needs to be implemented)
    // For now, this is a placeholder
    const handleEvent = (_: WebSocketEventType, data: T) => {
      handler(data);
    };

    // TODO: Add event listener to WebSocket client
    // wsClient.current?.on(eventType, handleEvent);

    return () => {
      // TODO: Remove event listener
      // wsClient.current?.off(eventType, handleEvent);
    };
  }, [eventType, handler]);
}