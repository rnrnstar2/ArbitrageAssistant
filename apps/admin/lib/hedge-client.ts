import { useState, useEffect } from 'react';

/**
 * Hedge System HTTP API クライアント
 * Admin WebアプリからHedge SystemのAPIを呼び出すためのクライアント
 */

interface HedgeSystemConfig {
  baseUrl: string;
  timeout: number;
}

interface TradeCommand {
  id?: string;
  type: 'ENTRY' | 'CLOSE';
  accountId: string;
  symbol: string;
  direction?: 'buy' | 'sell';
  volume?: number;
  price?: number;
}

interface Position {
  id: string;
  accountId: string;
  symbol: string;
  volume: number;
  direction: 'buy' | 'sell';
  openPrice: number;
  currentPrice?: number;
  profit?: number;
  status: 'open' | 'closed' | 'pending';
  openTime: Date;
}

interface Account {
  id: string;
  name: string;
  balance: number;
  equity: number;
  freeMargin: number;
  marginLevel: number;
  isConnected: boolean;
  server: string;
}

interface Connection {
  id: string;
  accountId: string;
  status: 'connected' | 'disconnected' | 'connecting';
  lastUpdate: Date;
  latency?: number;
}

interface WSStats {
  totalConnections: number;
  activeConnections: number;
  messagesPerSecond: number;
  errors: number;
  uptime: number;
}

interface TradeRecord {
  id: string;
  accountId: string;
  symbol: string;
  type: 'ENTRY' | 'CLOSE';
  volume: number;
  price: number;
  profit?: number;
  commission?: number;
  timestamp: Date;
  status: 'success' | 'failed' | 'pending';
}

interface RealtimeData {
  positions: Position[];
  accounts: Account[];
  connections: Connection[];
  lastUpdate: Date;
}

interface AccountData {
  account: Account;
  positions: Position[];
}

interface HedgeSystemStats {
  totalPositions: number;
  activeAccounts: number;
  totalAccounts: number;
  wsConnections: number;
  wsStats: WSStats;
}

interface HedgeSystemResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export class HedgeSystemClient {
  private config: HedgeSystemConfig;
  
  constructor(config: Partial<HedgeSystemConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3001',
      timeout: config.timeout || 10000
    };
  }
  
  /**
   * APIリクエスト共通処理
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<HedgeSystemResponse<T>> {
    const url = `${this.config.baseUrl}${endpoint}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw error;
      }
      
      throw new Error('Unknown error occurred');
    }
  }
  
  /**
   * ヘルスチェック
   */
  async checkHealth(): Promise<HedgeSystemResponse<{ status: string; uptime: number; connections: number }>> {
    return this.request('/api/health');
  }
  
  /**
   * リアルタイムデータ取得
   */
  async getRealtimeData(): Promise<HedgeSystemResponse<RealtimeData>> {
    return this.request('/api/realtime');
  }
  
  /**
   * 特定アカウントのデータ取得
   */
  async getAccountData(accountId: string): Promise<HedgeSystemResponse<AccountData>> {
    return this.request(`/api/accounts/${encodeURIComponent(accountId)}`);
  }
  
  /**
   * 取引指令送信
   */
  async sendTradeCommand(command: TradeCommand): Promise<HedgeSystemResponse<{ commandId: string }>> {
    return this.request('/api/command', {
      method: 'POST',
      body: JSON.stringify(command)
    });
  }
  
  /**
   * 取引履歴取得
   */
  async getTradeHistory(filters: {
    accountId?: string;
    symbol?: string;
    limit?: number;
  } = {}): Promise<HedgeSystemResponse<{ trades: TradeRecord[] }>> {
    const params = new URLSearchParams();
    
    if (filters.accountId) params.append('accountId', filters.accountId);
    if (filters.symbol) params.append('symbol', filters.symbol);
    if (filters.limit) params.append('limit', filters.limit.toString());
    
    const query = params.toString();
    const endpoint = query ? `/api/history?${query}` : '/api/history';
    
    return this.request(endpoint);
  }
  
  /**
   * 統計データ取得
   */
  async getStats(): Promise<HedgeSystemResponse<HedgeSystemStats>> {
    return this.request('/api/stats');
  }
  
  /**
   * 接続テスト
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.checkHealth();
      return response.success;
    } catch (error) {
      console.error('Hedge System connection test failed:', error);
      return false;
    }
  }
  
  /**
   * 定期的なデータ取得用
   */
  async startPolling(
    callback: (data: RealtimeData) => void,
    interval: number = 5000
  ): Promise<() => void> {
    let isActive = true;
    
    const poll = async () => {
      if (!isActive) return;
      
      try {
        const response = await this.getRealtimeData();
        if (response.success && response.data) {
          callback(response.data);
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
      
      if (isActive) {
        setTimeout(poll, interval);
      }
    };
    
    // 初回実行
    poll();
    
    // 停止関数を返す
    return () => {
      isActive = false;
    };
  }
}

// デフォルトインスタンス作成
export const hedgeClient = new HedgeSystemClient();

// React Hook用
export function useHedgeSystemConnection() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const testConnection = async () => {
    try {
      const connected = await hedgeClient.testConnection();
      setIsConnected(connected);
      setLastError(null);
      return connected;
    } catch (error) {
      setIsConnected(false);
      setLastError(error instanceof Error ? error.message : 'Unknown error');
      return false;
    }
  };
  
  useEffect(() => {
    testConnection();
    
    // 定期的な接続チェック
    const interval = setInterval(testConnection, 30000); // 30秒
    
    return () => clearInterval(interval);
  }, []);
  
  return {
    isConnected,
    lastError,
    testConnection
  };
}

// 型エクスポート
export type {
  TradeCommand,
  Position,
  Account,
  Connection,
  WSStats,
  TradeRecord,
  RealtimeData,
  AccountData,
  HedgeSystemStats,
  HedgeSystemResponse
};