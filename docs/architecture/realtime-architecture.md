# リアルタイムアーキテクチャ設計

## 現在の問題

現在の構成は技術的に実現困難：
```
❌ EA → Hedge System (Desktop) → ??? → Admin (Web)
```

- Hedge System: 各クライアントPCのTauriデスクトップアプリ
- Admin: 中央のNext.js Webアプリ
- 通信方法が不明確

## 推奨アーキテクチャ

### Option 1: Central Server方式（推奨）

```
EA (MT4/MT5) → WebSocket → Central Server → AppSync Events → Admin Web
                                ↓
                         DynamoDB (重要データのみ)
```

#### 実装詳細

**Central Server (AWS Lambda + API Gateway WebSocket)**
```typescript
// lambda/websocket-handler.ts
export const handler = async (event: APIGatewayProxyEvent) => {
  const { eventType, connectionId } = event.requestContext;
  
  switch (eventType) {
    case 'CONNECT':
      await registerConnection(connectionId);
      break;
      
    case 'MESSAGE':
      const message = JSON.parse(event.body);
      await processMessage(message, connectionId);
      break;
      
    case 'DISCONNECT':
      await unregisterConnection(connectionId);
      break;
  }
};

async function processMessage(message: any, connectionId: string) {
  // 1. リアルタイムデータはメモリキャッシュ
  await updateRealtimeCache(message);
  
  // 2. 重要データのみ永続化
  if (shouldPersist(message)) {
    await saveToDynamoDB(message);
  }
  
  // 3. Admin Webに配信
  await broadcastToAdminClients(message);
}
```

**Admin Web (Next.js)**
```typescript
// hooks/useRealtimeData.ts
export function useRealtimeData() {
  const [data, setData] = useState({});
  
  useEffect(() => {
    // AppSync Events購読
    const subscription = events.subscribe({
      channelName: 'trading-data',
      onMessage: (event) => {
        setData(prev => ({
          ...prev,
          [event.type]: event.data
        }));
      }
    });
    
    return () => subscription.unsubscribe();
  }, []);
  
  return data;
}
```

### Option 2: Serverless方式

```
EA (MT4/MT5) → AppSync Events → Admin Web
                     ↓
              DynamoDB (重要データのみ)
```

#### 実装詳細

**EA側 WebSocket Client**
```cpp
// EA/websocket-client.cpp
class AppSyncEventsClient {
private:
    WebSocketpp::client<WebSocketpp::config::asio_tls_client> client;
    
public:
    void publishPositionUpdate(const Position& position) {
        json message = {
            {"channelName", "position-updates"},
            {"event", {
                {"type", "POSITION_UPDATE"},
                {"accountId", position.accountId},
                {"symbol", position.symbol},
                {"currentPrice", position.currentPrice},
                {"profit", position.profit}
            }}
        };
        
        client.send(message.dump());
    }
};
```

## データ分離戦略

### リアルタイムデータ（揮発性）
```typescript
interface RealtimeCache {
  // メモリのみ、永続化なし
  marketPrices: {
    [symbol: string]: {
      bid: number;
      ask: number;
      timestamp: number;
    }
  };
  
  activePositions: {
    [accountId: string]: Position[];
  };
  
  accountBalances: {
    [accountId: string]: {
      balance: number;
      equity: number;
      margin: number;
      marginLevel: number;
      lastUpdate: number;
    }
  };
}
```

### 永続化データ（重要イベントのみ）
```typescript
interface PersistentEvents {
  // DynamoDBに保存
  positionEvents: {
    type: 'OPEN' | 'CLOSE' | 'MODIFY';
    accountId: string;
    mt4TradeId: string;
    timestamp: number;
    details: any;
  }[];
  
  systemTrades: {
    accountId: string;
    mt4TradeId: string;
    executedAt: Date;
  }[];
  
  criticalAlerts: {
    type: 'MARGIN_CALL' | 'CONNECTION_LOST' | 'SYSTEM_ERROR';
    severity: 'HIGH' | 'CRITICAL';
    message: string;
    timestamp: Date;
  }[];
}
```

## 実装優先順位

### Phase 1: Central Server構築
1. AWS Lambda WebSocket Handler
2. AppSync Events設定
3. EA WebSocket Client実装

### Phase 2: リアルタイム機能
1. ポジション情報のリアルタイム配信
2. 残高情報のリアルタイム更新
3. アラート通知システム

### Phase 3: 最適化
1. データキャッシュ戦略
2. レイテンシ最適化
3. スケーリング対応

## コスト試算

### AppSync Events
- 接続料金: $0.08 / 百万接続分
- メッセージ料金: $0.25 / 百万メッセージ
- 月間100万メッセージ想定: ~$250

### Lambda + API Gateway WebSocket
- Lambda実行料金: $0.0000166667 / 100ms
- WebSocket接続料金: $0.25 / 百万接続分
- 月間想定: ~$200-300

推奨: AppSync Events（管理が簡単、コスト効率良い）"