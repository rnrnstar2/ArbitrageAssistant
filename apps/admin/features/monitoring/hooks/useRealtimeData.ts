import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/api';

interface SystemStatus {
  isHealthy: boolean;
  hedgeSystemStatus: 'online' | 'offline' | 'error';
  amplifyStatus: 'connected' | 'disconnected' | 'error';
  webSocketStatus: 'active' | 'inactive' | 'error';
  authStatus: 'authenticated' | 'unauthenticated' | 'error';
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
  logs: Array<{
    timestamp: string;
    level: 'info' | 'warn' | 'error';
    message: string;
  }>;
}

interface EAConnection {
  connectionId: string;
  status: 'connected' | 'disconnected' | 'error';
  platform: 'MT4' | 'MT5';
  accountNumber: string;
  lastHeartbeat: Date;
  version: string;
  latency: number;
}

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

interface Metrics {
  activePositions: number;
  dailyPnL: number;
  chartData: Array<{
    timestamp: string;
    pnl: number;
    positions: number;
    volume: number;
  }>;
}

export function useRealtimeData() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    isHealthy: true,
    hedgeSystemStatus: 'online',
    amplifyStatus: 'connected',
    webSocketStatus: 'active',
    authStatus: 'authenticated',
    uptime: 0,
    memoryUsage: 45.2,
    cpuUsage: 23.1,
    logs: []
  });

  const [connections, setConnections] = useState<EAConnection[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({
    activePositions: 0,
    dailyPnL: 0,
    chartData: []
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = generateClient();

  // システム状態の取得
  const fetchSystemStatus = async () => {
    try {
      // 実際の実装では、Hedge SystemやAWS Amplifyから状態を取得
      // ここではモックデータを使用
      setSystemStatus(prev => ({
        ...prev,
        uptime: prev.uptime + 1,
        memoryUsage: 40 + Math.random() * 20,
        cpuUsage: 20 + Math.random() * 30
      }));
    } catch (err) {
      setError(err as Error);
    }
  };

  // EA接続状況の取得
  const fetchEAConnections = async () => {
    try {
      // 実際の実装では、WebSocketサーバーから接続情報を取得
      // ここではモックデータを使用
      const mockConnections: EAConnection[] = [
        {
          connectionId: 'ea-001',
          status: 'connected',
          platform: 'MT4',
          accountNumber: '12345678',
          lastHeartbeat: new Date(),
          version: '1.0.0',
          latency: 45
        },
        {
          connectionId: 'ea-002',
          status: 'connected',
          platform: 'MT5',
          accountNumber: '87654321',
          lastHeartbeat: new Date(),
          version: '1.0.0',
          latency: 52
        }
      ];
      setConnections(mockConnections);
    } catch (err) {
      setError(err as Error);
    }
  };

  // メトリクスの取得
  const fetchMetrics = async () => {
    try {
      const query = /* GraphQL */ `
        query GetMetrics {
          listPositions(filter: { status: { eq: "open" } }) {
            items {
              positionId
              volume
            }
          }
        }
      `;

      const result = await client.graphql({ query }) as any;
      const activePositions = result.data?.listPositions?.items || [];

      // チャートデータの生成（実際の実装では履歴データを取得）
      const chartData = Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(Date.now() - (19 - i) * 60000).toISOString(),
        pnl: Math.random() * 10000 - 5000,
        positions: activePositions.length + Math.floor(Math.random() * 5),
        volume: Math.random() * 100
      }));

      setMetrics({
        activePositions: activePositions.length,
        dailyPnL: Math.random() * 20000 - 10000,
        chartData
      });
    } catch (err) {
      setError(err as Error);
    }
  };

  // リアルタイム更新の設定
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchSystemStatus(),
          fetchEAConnections(),
          fetchMetrics()
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // 定期更新
    const interval = setInterval(fetchData, 5000);

    return () => clearInterval(interval);
  }, []);

  return {
    systemStatus,
    connections,
    alerts,
    metrics,
    loading,
    error
  };
}