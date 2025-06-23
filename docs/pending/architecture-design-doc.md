# アーキテクチャ設計書 - Hedge System MVP

## 1. はじめに

### 1-1. 本書の目的
本書は、Hedge System MVPのソフトウェアアーキテクチャ、技術スタック、およびコンポーネント間の相互作用を詳細に定義します。

### 1-2. アーキテクチャ原則
- **クラウドネイティブ**: AWS Amplifyを最大限活用
- **イベント駆動**: リアルタイム性を重視した非同期処理
- **疎結合**: コンポーネント間の独立性を保持
- **スケーラビリティ**: 将来の拡張を考慮した設計
- **セキュアバイデザイン**: セキュリティを設計段階から組み込み

## 2. アーキテクチャ全体像

### 2-1. レイヤードアーキテクチャ

```mermaid
graph TB
    subgraph "プレゼンテーション層"
        UI1[管理画面<br/>Next.js]
        UI2[Hedge System<br/>Tauri Desktop]
    end

    subgraph "アプリケーション層"
        BL1[ポジション管理<br/>ロジック]
        BL2[トレール判定<br/>エンジン]
        BL3[アクション実行<br/>エンジン]
        BL4[両建て管理<br/>ロジック]
    end

    subgraph "インフラ層"
        API[AWS AppSync<br/>GraphQL]
        Auth[Amazon Cognito]
        DB[(DynamoDB)]
        WS[WebSocket<br/>Server]
    end

    subgraph "外部システム層"
        MT1[MT4/MT5<br/>Terminal]
        EA[Expert<br/>Advisor]
    end

    UI1 --> API
    UI2 --> API
    UI2 --> BL1 & BL2 & BL3 & BL4
    BL1 & BL2 & BL3 & BL4 --> WS
    WS --> EA
    EA --> MT1
    API --> DB
    UI1 & UI2 --> Auth
```

### 2-2. デプロイメントアーキテクチャ

```mermaid
graph LR
    subgraph "Client Side"
        subgraph "User PC"
            Browser[Web Browser]
            Desktop[Tauri App]
            MT[MetaTrader]
        end
    end

    subgraph "AWS Cloud"
        subgraph "AWS Amplify"
            CF[CloudFront<br/>CDN]
            S3[S3<br/>Static Hosting]
        end
        
        subgraph "Compute"
            AppSync[AWS AppSync]
            Lambda[Lambda<br/>Functions]
        end
        
        subgraph "Data"
            DDB[(DynamoDB)]
            Cognito[Cognito]
        end
    end

    Browser --> CF
    CF --> S3
    Browser --> AppSync
    Desktop --> AppSync
    AppSync --> Lambda
    Lambda --> DDB
    Browser & Desktop --> Cognito
    Desktop <--> MT
```

## 3. Hedge Systemクライアント詳細

### 3-1. コンポーネント構成

```mermaid
graph TB
    subgraph "Hedge System Client (Tauri)"
        subgraph "Frontend (React)"
            UI[UIコンポーネント]
            Store[状態管理<br/>Zustand]
            GQL[GraphQL Client<br/>Apollo]
        end

        subgraph "Backend (Rust)"
            Core[コアロジック]
            WSS[WebSocketサーバー<br/>127.0.0.1:8080]
            DB[ローカルDB<br/>SQLite]
            IPC[IPC通信]
        end

        subgraph "ビジネスロジック"
            PM[ポジション管理]
            TM[トレール監視]
            AM[アクション実行]
            HM[両建て管理]
        end
    end

    UI <--> IPC
    IPC <--> Core
    Core --> PM & TM & AM & HM
    PM & TM & AM & HM --> DB
    WSS <--> External[MT4/MT5 EA]
    GQL <--> Cloud[AWS AppSync]
    Store <--> UI
```

### 3-2. 主要モジュール詳細

#### 3-2-1. 口座管理モジュール

```typescript
interface AccountManager {
  // 口座情報の管理
  accounts: Map<string, Account>;
  
  // 口座の登録・更新
  registerAccount(account: Account): Promise<void>;
  updateAccountInfo(accountId: string, info: AccountInfo): void;
  
  // クレジット監視
  monitorCredit(accountId: string): Observable<CreditChange>;
  
  // 残高・証拠金監視
  monitorBalance(accountId: string): Observable<BalanceUpdate>;
  
  // ユーザー所有確認
  isOwnAccount(accountId: string, userId: string): boolean;
}
```

#### 3-2-2. ポジション実行エンジン

```typescript
interface PositionExecutionEngine {
  // ポジション実行管理
  executePosition(positionId: string): Promise<ExecutionResult>;
  
  // ステータス遷移管理
  transitionStatus(
    positionId: string, 
    newStatus: PositionStatus
  ): Promise<void>;
  
  // MT4/5連携
  sendOrderToMT(order: OrderRequest): Promise<MTResponse>;
  
  // 実行判定
  canExecute(position: Position, userId: string): boolean;
}
```

#### 3-2-3. トレール判定エンジン

```mermaid
stateDiagram-v2
    [*] --> Monitoring: 監視開始
    
    state Monitoring {
        [*] --> LoadPositions: ポジション取得
        LoadPositions --> FilterByUser: userId絞り込み
        FilterByUser --> FilterByTrail: トレール設定確認
        FilterByTrail --> CheckPrice: 価格確認
        
        CheckPrice --> Evaluate: 条件評価
        Evaluate --> Triggered: 条件成立
        Evaluate --> Continue: 条件未成立
        Continue --> CheckPrice
        
        Triggered --> ExecuteActions: アクション実行
        ExecuteActions --> [*]
    }
```

```typescript
interface TrailEngine {
  // トレール監視対象の管理
  monitoredPositions: Map<string, TrailConfig>;
  
  // 監視開始・停止
  startMonitoring(position: Position): void;
  stopMonitoring(positionId: string): void;
  
  // 条件判定
  evaluateTrailCondition(
    position: Position, 
    currentPrice: number
  ): boolean;
  
  // トリガー実行
  triggerActions(actionIds: string[]): Promise<void>;
}
```

#### 3-2-4. 両建て管理モジュール

```typescript
interface HedgeManager {
  // ポジション分析
  analyzePositions(positions: Position[]): HedgeAnalysis;
  
  // ネットポジション計算
  calculateNetPosition(positions: Position[]): NetPosition;
  
  // 最適化提案
  suggestOptimization(
    positions: Position[], 
    credit: number
  ): OptimizationPlan;
  
  // リスク評価
  evaluateRisk(positions: Position[]): RiskMetrics;
}
```

### 3-3. データフロー

```mermaid
graph LR
    subgraph "入力"
        Price[価格データ]
        User[ユーザー操作]
        Cloud[クラウド通知]
    end

    subgraph "処理"
        Engine[実行エンジン]
        Trail[トレール判定]
        Risk[リスク計算]
    end

    subgraph "出力"
        MT[MT4/5命令]
        API[API更新]
        UI[画面更新]
    end

    Price --> Trail
    User --> Engine
    Cloud --> Engine
    Trail --> Engine
    Engine --> Risk
    Engine --> MT
    Engine --> API
    Risk --> UI
```

## 4. 管理者画面（Next.js）詳細

### 4-1. アプリケーション構成

```mermaid
graph TB
    subgraph "Next.js Application"
        subgraph "Pages (App Router)"
            Home[/dashboard]
            Accounts[/accounts]
            Positions[/positions]
            Actions[/actions]
            Monitor[/monitor]
        end

        subgraph "Components"
            Layout[Layout]
            Forms[Form Components]
            Tables[Table Components]
            Charts[Chart Components]
            Realtime[Realtime Components]
        end

        subgraph "Hooks & Utils"
            GraphQL[GraphQL Hooks]
            Auth[Auth Hooks]
            Subscribe[Subscription Hooks]
            Calc[計算ユーティリティ]
        end

        subgraph "State Management"
            Context[React Context]
            Cache[Apollo Cache]
            Local[Local State]
        end
    end

    Pages --> Components
    Components --> Hooks
    Hooks --> State
```

### 4-2. 主要画面構成

#### 4-2-1. ダッシュボード

```typescript
interface DashboardProps {
  // リアルタイムデータ
  accounts: Account[];
  positions: Position[];
  activeActions: Action[];
  
  // 集計データ
  totalBalance: number;
  totalCredit: number;
  netPosition: NetPosition;
  
  // アラート
  alerts: Alert[];
}
```

#### 4-2-2. ポジション管理画面

```mermaid
graph TB
    subgraph "ポジション管理画面"
        List[ポジション一覧]
        Create[作成フォーム]
        Detail[詳細表示]
        Trail[トレール設定]
    end

    List -->|選択| Detail
    List -->|新規| Create
    Detail -->|編集| Trail
    Create -->|アクション作成| Action[アクション<br/>自動生成]
    Trail -->|保存| Update[DB更新]
```

### 4-3. リアルタイム更新機構

```typescript
// GraphQL Subscription実装例
const POSITION_SUBSCRIPTION = gql`
  subscription OnPositionUpdate($userId: ID!) {
    onUpdatePosition(userId: $userId) {
      id
      status
      entryPrice
      currentPrice
      unrealizedPL
      trailWidth
      updatedAt
    }
  }
`;

// Subscription Hook
function usePositionSubscription(userId: string) {
  const { data, loading, error } = useSubscription(
    POSITION_SUBSCRIPTION,
    { 
      variables: { userId },
      // 再接続設定
      shouldResubscribe: true,
    }
  );
  
  return { position: data?.onUpdatePosition, loading, error };
}
```

## 5. AWS Amplifyインフラ構成

### 5-1. インフラアーキテクチャ

```mermaid
graph TB
    subgraph "Frontend Hosting"
        CF[CloudFront]
        S3[S3 Bucket]
        CF --> S3
    end

    subgraph "API Layer"
        APIGW[API Gateway]
        AppSync[AWS AppSync]
        Lambda1[Resolver Functions]
        Lambda2[Business Logic]
        
        APIGW --> Lambda2
        AppSync --> Lambda1
    end

    subgraph "Authentication"
        Cognito[Amazon Cognito]
        UserPool[User Pool]
        IdPool[Identity Pool]
        
        Cognito --> UserPool
        Cognito --> IdPool
    end

    subgraph "Data Layer"
        DDB[(DynamoDB)]
        DStream[DynamoDB Streams]
        
        DDB --> DStream
        DStream --> Lambda1
    end

    subgraph "Monitoring"
        CW[CloudWatch]
        XRay[X-Ray]
    end

    AppSync --> DDB
    Lambda1 & Lambda2 --> CW
    All --> XRay
```

### 5-2. DynamoDBテーブル設計

```yaml
Tables:
  - TableName: Users
    PartitionKey: id (S)
    GSI:
      - IndexName: byEmail
        PartitionKey: email (S)
    
  - TableName: Accounts
    PartitionKey: id (S)
    GSI:
      - IndexName: byUserId
        PartitionKey: userId (S)
        SortKey: createdAt (S)
    
  - TableName: Positions
    PartitionKey: id (S)
    GSI:
      - IndexName: byUserId
        PartitionKey: userId (S)
        SortKey: createdAt (S)
      - IndexName: byAccountId
        PartitionKey: accountId (S)
        SortKey: status (S)
      - IndexName: byUserIdAndStatus
        PartitionKey: userId (S)
        SortKey: status (S)
    
  - TableName: Actions
    PartitionKey: id (S)
    GSI:
      - IndexName: byUserId
        PartitionKey: userId (S)
        SortKey: createdAt (S)
      - IndexName: byUserIdAndStatus
        PartitionKey: userId (S)
        SortKey: status (S)
```

### 5-3. GraphQL スキーマ構成

```graphql
type Subscription {
  # ユーザー別のリアルタイム更新
  onCreatePosition(userId: ID!): Position
    @aws_subscribe(mutations: ["createPosition"])
  
  onUpdatePosition(userId: ID!): Position
    @aws_subscribe(mutations: ["updatePosition"])
  
  onCreateAction(userId: ID!): Action
    @aws_subscribe(mutations: ["createAction"])
  
  onUpdateAction(userId: ID!): Action
    @aws_subscribe(mutations: ["updateAction"])
  
  # 口座情報のリアルタイム更新
  onUpdateAccount(userId: ID!): Account
    @aws_subscribe(mutations: ["updateAccount"])
}
```

## 6. セキュリティアーキテクチャ

### 6-1. 認証・認可フロー

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Cognito
    participant AppSync
    participant DynamoDB

    User->>Frontend: ログイン
    Frontend->>Cognito: 認証リクエスト
    Cognito-->>Frontend: JWTトークン
    Frontend->>AppSync: GraphQLリクエスト + JWT
    AppSync->>AppSync: JWT検証
    AppSync->>AppSync: 認可チェック
    AppSync->>DynamoDB: データアクセス
    DynamoDB-->>AppSync: データ
    AppSync-->>Frontend: レスポンス
```

### 6-2. データアクセス制御

```typescript
// GraphQL Resolver での認可実装例
export const updatePosition: Resolver = async (
  source,
  args,
  context
) => {
  const { userId } = context.identity;
  const { id, ...updates } = args.input;
  
  // 所有者確認
  const position = await getPosition(id);
  if (position.userId !== userId && !isAdmin(context)) {
    throw new UnauthorizedError("Access denied");
  }
  
  // 更新実行
  return await updatePositionItem(id, updates);
};
```

## 7. 通信アーキテクチャ

### 7-1. WebSocket通信設計

```mermaid
graph LR
    subgraph "Hedge System"
        WSServer[WebSocket Server<br/>127.0.0.1:8080]
        Handler[Message Handler]
        Queue[Command Queue]
    end

    subgraph "MT4/MT5"
        EA1[EA Instance 1]
        EA2[EA Instance 2]
        EA3[EA Instance N]
    end

    EA1 & EA2 & EA3 <-->|WSS| WSServer
    WSServer --> Handler
    Handler --> Queue
    Queue --> Executor[実行エンジン]
```

### 7-2. メッセージングパターン

```typescript
// Command パターン
interface Command {
  id: string;
  type: 'OPEN' | 'CLOSE' | 'MODIFY';
  accountId: string;
  payload: any;
  timestamp: Date;
}

// Event パターン
interface Event {
  id: string;
  type: 'OPENED' | 'CLOSED' | 'FAILED';
  accountId: string;
  correlationId: string;
  payload: any;
  timestamp: Date;
}

// Request-Response相関
class MessageCorrelator {
  private pending = new Map<string, PendingRequest>();
  
  async sendAndWait(command: Command): Promise<Event> {
    const promise = new Promise<Event>((resolve, reject) => {
      this.pending.set(command.id, { resolve, reject });
    });
    
    await this.send(command);
    return promise;
  }
}
```

## 8. エラーハンドリングアーキテクチャ

### 8-1. エラー分類と処理フロー

```mermaid
graph TD
    Error[エラー発生] --> Classify{分類}
    
    Classify -->|一時的| Retry[リトライ処理]
    Classify -->|永続的| Fail[失敗処理]
    Classify -->|ビジネス| Business[ビジネス処理]
    
    Retry --> RetryPolicy{リトライポリシー}
    RetryPolicy -->|成功| Success[正常終了]
    RetryPolicy -->|失敗| Fail
    
    Fail --> Log[ログ記録]
    Fail --> Notify[通知]
    Fail --> Recover[復旧処理]
    
    Business --> Handle[エラーハンドリング]
    Handle --> UserNotify[ユーザー通知]
```

### 8-2. サーキットブレーカーパターン

```typescript
class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  async execute<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitOpenError();
      }
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

## 9. パフォーマンス最適化

### 9-1. キャッシング戦略

```mermaid
graph TB
    subgraph "Multi-Layer Cache"
        L1[Browser Cache<br/>Service Worker]
        L2[Apollo Cache<br/>In-Memory]
        L3[CloudFront<br/>Edge Cache]
        L4[AppSync Cache<br/>Resolver Cache]
    end

    Request --> L1
    L1 -->|Miss| L2
    L2 -->|Miss| L3
    L3 -->|Miss| L4
    L4 -->|Miss| DB[(DynamoDB)]
```

### 9-2. 非同期処理アーキテクチャ

```typescript
// イベント駆動処理
class EventProcessor {
  private eventBus = new EventEmitter();
  private workers = new Map<string, Worker>();
  
  // 非同期バッチ処理
  async processBatch(events: Event[]): Promise<void> {
    const batches = this.groupByType(events);
    
    await Promise.all(
      batches.map(batch => 
        this.processInWorker(batch.type, batch.events)
      )
    );
  }
  
  // Worker Thread活用
  private async processInWorker(
    type: string, 
    events: Event[]
  ): Promise<void> {
    const worker = this.workers.get(type);
    return new Promise((resolve, reject) => {
      worker.postMessage({ events });
      worker.once('message', resolve);
      worker.once('error', reject);
    });
  }
}
```

## 10. 監視・運用アーキテクチャ

### 10-1. ログ収集アーキテクチャ

```mermaid
graph LR
    subgraph "アプリケーション"
        App1[Hedge System]
        App2[管理画面]
        App3[Lambda]
    end

    subgraph "ログ収集"
        CWLogs[CloudWatch Logs]
        Kinesis[Kinesis Data Firehose]
    end

    subgraph "分析・可視化"
        S3[(S3)]
        Athena[Athena]
        QuickSight[QuickSight]
    end

    App1 & App2 & App3 --> CWLogs
    CWLogs --> Kinesis
    Kinesis --> S3
    S3 --> Athena
    Athena --> QuickSight
```

### 10-2. メトリクス設計

```yaml
CustomMetrics:
  Business:
    - MetricName: PositionExecutionTime
      Unit: Milliseconds
      Dimensions: [AccountType, Symbol]
    
    - MetricName: TrailTriggerCount
      Unit: Count
      Dimensions: [UserId, Symbol]
    
    - MetricName: ActivePositions
      Unit: Count
      Dimensions: [UserId, Status]
  
  Technical:
    - MetricName: WebSocketConnections
      Unit: Count
      Dimensions: [UserId]
    
    - MetricName: APILatency
      Unit: Milliseconds
      Dimensions: [Operation, StatusCode]
    
    - MetricName: CacheHitRate
      Unit: Percent
      Dimensions: [CacheLevel]
```

## 11. 開発・デプロイアーキテクチャ

### 11-1. CI/CDパイプライン

```mermaid
graph LR
    subgraph "開発"
        Dev[開発者] --> Git[GitHub]
    end

    subgraph "CI"
        Git --> GHA[GitHub Actions]
        GHA --> Test[自動テスト]
        Test --> Build[ビルド]
        Build --> Scan[セキュリティスキャン]
    end

    subgraph "CD"
        Scan --> Package[パッケージング]
        Package --> Deploy{デプロイ先}
        Deploy -->|Frontend| S3
        Deploy -->|API| Lambda
        Deploy -->|Desktop| Release[GitHub Release]
    end

    subgraph "環境"
        S3 --> Dev2[開発環境]
        S3 --> Stg[ステージング]
        S3 --> Prod[本番環境]
    end
```

### 11-2. 環境構成

| 環境 | 用途 | URL | 特徴 |
|------|------|-----|------|
| **開発環境** | 開発・テスト | dev.hedge-system.com | 自動デプロイ、ダミーデータ |
| **ステージング** | 受入テスト | stg.hedge-system.com | 本番同等構成、テストデータ |
| **本番環境** | 本番運用 | app.hedge-system.com | 高可用性、本番データ |

## 12. まとめ

本アーキテクチャ設計により、以下を実現します：

1. **高可用性**: AWS Amplifyの活用による99.9%の稼働率
2. **リアルタイム性**: WebSocketとGraphQL Subscriptionによる即時反映
3. **拡張性**: マイクロサービス的な設計による機能追加の容易さ
4. **セキュリティ**: 多層防御による堅牢なセキュリティ
5. **運用性**: 包括的な監視と自動化されたデプロイ

これらの設計により、ボーナスアービトラージ取引の自動化と効率化を実現し、ユーザーに価値を提供します。