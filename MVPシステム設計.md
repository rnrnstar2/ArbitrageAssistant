# AWS Amplifyベース Hedge System MVP システム設計書 v4.0

## 1. システム概要

### 1-1. システムの目的
本システムは、ボーナスアービトラージ業務向けの**戦略実行型自動取引管理システム**（Hedge System）です。複数のMT4/MT5口座を一元管理し、取引戦略を「実行計画」として都度作成・実行します。1ユーザー1PCの制約のもと、シンプルで確実な取引実行を実現します。

### 1-2. システム構成要素
```mermaid
graph TB
    subgraph "ユーザー環境"
        Admin[管理者画面<br/>Next.js]
        Client1[Hedge System 1<br/>Tauri App]
        Client2[Hedge System 2<br/>Tauri App]
        EA1[MT4/MT5 EA<br/>口座A]
        EA2[MT4/MT5 EA<br/>口座B]
    end
    
    subgraph "AWS Amplify Cloud"
        Auth[Amazon Cognito<br/>認証]
        API[AWS AppSync<br/>GraphQL API]
        DB[(DynamoDB<br/>データベース)]
    end
    
    Admin <-->|HTTPS/WSS| Auth
    Admin <-->|GraphQL| API
    Client1 & Client2 <-->|HTTPS/WSS| Auth
    Client1 & Client2 <-->|GraphQL| API
    Client1 <-->|WebSocket| EA1
    Client2 <-->|WebSocket| EA2
    API <--> DB
    
    style Admin fill:#e1f5fe
    style Client1 fill:#f3e5f5
    style Client2 fill:#f3e5f5
    style EA1 fill:#fff3e0
    style EA2 fill:#fff3e0
```

### 1-3. 主要機能（MVP範囲）
- **口座管理**: MT4/MT5の複数口座情報を一元管理
- **エントリー戦略**: 複数のPENDINGポジションとアクションを事前作成し、実行ボタンで一括発注
- **決済戦略**: 既存ポジションを選択して一括決済計画を作成・実行
- **トレーリングストップ**: ポジション単位で設定されたトレール幅に基づく動的ストップロス管理
- **ロスカット対応**: ポジションのトレール設定からトリガーされる自動アクション実行
- **リアルタイム監視**: 戦略実行状況とポジション状態のモニタリング
- **シンプルな実行判定**: 1ユーザー1PC制約による確実な処理

## 2. データベース設計

### 2-1. データモデル全体図
```mermaid
erDiagram
    User ||--o{ Account : owns
    User ||--o{ Strategy : creates
    Account ||--o{ Position : has
    Account ||--o{ Action : targets
    Strategy ||--o{ Position : prepares
    Strategy ||--o{ Action : prepares
    Position ||--o{ Action : "can trigger"
    
    User {
        string id PK
        string email "必須・認証用"
        string name "必須・表示名"
        UserRole role "必須・CLIENT/ADMIN"
        PCStatus pcStatus "ONLINE/OFFLINE"
        boolean isActive "必須・アカウント状態"
    }
    
    Account {
        string id PK
        string userId FK "所有者"
        string brokerType "MT4/MT5"
        string accountNumber "口座番号"
        string serverName "サーバー名"
        string displayName "表示名"
        float balance "残高"
        float equity "有効証拠金"
        boolean isActive "有効/無効"
        datetime lastUpdated
    }
    
    Strategy {
        string id PK
        string userId FK "作成者"
        string type "ENTRY/EXIT"
        string status "PREPARED/EXECUTING/COMPLETED"
        datetime executedAt "実行日時"
    }
    
    Position {
        string id PK
        string accountId FK "所属口座"
        string strategyId FK "作成元戦略"
        PositionStatus status "必須"
        Symbol symbol "必須"
        float volume "必須・ロット数"
        float entryPrice "約定価格"
        datetime entryTime "約定時刻"
        float exitPrice "決済価格"
        datetime exitTime "決済時刻"
        string exitReason "決済理由"
        float trailWidth "個別トレール幅"
        boolean primary "主要ポジション"
        string mtTicket "MT4/5チケット番号"
    }
    
    Action {
        string id PK
        string accountId FK "対象口座"
        string strategyId FK "Optional・戦略起点"
        string positionId FK "必須・対象ポジション"
        string triggerPositionId FK "Optional・トリガー元"
        ActionType type "必須・ENTRY/CLOSE"
        ActionStatus status "必須"
        string triggerType "STRATEGY/POSITION/MANUAL"
        string params "Optional・実行パラメータJSON"
    }
```

### 2-2. 列挙型（Enum）定義

| 列挙型名 | 値 | 説明 |
|---------|-----|------|
| **Symbol** | USDJPY, EURUSD, EURGBP, XAUUSD | 取引可能な銘柄 |
| **PositionStatus** | PENDING | 戦略作成済み・発注待機中 |
| | OPENING | 発注処理中（戦略実行後） |
| | OPEN | エントリー約定済み・ポジション保有中 |
| | CLOSING | 決済指令済みでクローズ処理中 |
| | CLOSED | ポジション決済済み |
| | STOPPED | ロスカット執行済み |
| | CANCELED | 発注失敗等でポジション不成立 |
| **ActionType** | ENTRY | 新規エントリー |
| | CLOSE | 通常クローズ |
| **ActionStatus** | PENDING | アクション待機中 |
| | EXECUTING | 実行中 |
| | EXECUTED | 実行完了 |
| | FAILED | 実行失敗 |
| **UserRole** | CLIENT | 一般ユーザー |
| | ADMIN | 管理者 |
| **PCStatus** | ONLINE | PC接続中 |
| | OFFLINE | PC未接続 |

### 2-3. 認証・権限設計

各モデルの権限設定：
- **User**: 本人は読み取り・更新可、ADMINロールは全操作可
- **Account**: 所有者とADMINは全操作可、口座情報は所有者のみ閲覧可
- **Strategy/Position/Action**: 所有者（作成者）とADMINグループは全操作可

## 3. 戦略実行パターン詳細

### 3-1. エントリー戦略パターン
```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as 管理画面
    participant API as AppSync
    participant HS as Hedge System
    participant EA as MT4/MT5
    
    Note over U,EA: 戦略準備フェーズ
    U->>UI: エントリー戦略作成画面
    U->>UI: 対象口座選択（複数可）
    U->>UI: ポジション情報入力（複数）
    U->>UI: primaryPosition指定（1つのみ）
    U->>UI: primaryのトレール幅設定
    U->>UI: トレール時のアクション設定
    U->>UI: 戦略作成ボタン
    UI->>API: createStrategy(type:ENTRY)
    loop 各ポジション
        UI->>API: createPosition(status:PENDING, trailWidth, primary)
        UI->>API: createAction(type:CLOSE/ENTRY, status:PENDING)
        Note right of API: トレール用アクションを<br/>事前作成（待機状態）
    end
    API-->>UI: 戦略ID返却
    
    Note over U,EA: 実行フェーズ
    U->>UI: 戦略実行ボタン
    UI->>API: updateStrategy(status:EXECUTING)
    UI->>API: updatePositions(status:OPENING)
    API-->>HS: Subscription通知
    
    loop 各OPENINGポジション
        HS->>HS: 担当確認（accountId→userId）
        HS->>EA: OPEN命令
        EA->>EA: OrderSend実行
        EA->>HS: OPENED通知
        HS->>API: updatePosition(status:OPEN, mtTicket)
    end
    
    API->>API: updateStrategy(status:COMPLETED)
    
    Note over U,EA: トレール監視フェーズ
    HS->>API: primaryポジション確認
    HS->>HS: primaryのトレール幅で監視開始
    loop 価格監視
        EA->>HS: PRICE更新
        HS->>HS: トレール条件判定
        opt 条件成立
            HS->>API: strategyに紐づく全Actionをupdate(status:EXECUTING)
            Note right of HS: PENDINGアクションを<br/>実行状態に変更
            API-->>HS: Action Subscription
            HS->>EA: アクション実行
            EA->>HS: 実行結果
            HS->>API: updateAction(status:EXECUTED)
        end
    end
```

### 3-2. 決済戦略パターン
```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as 管理画面
    participant API as AppSync
    participant HS as Hedge System
    participant EA as MT4/MT5
    
    Note over U,EA: 戦略準備フェーズ
    U->>UI: 決済戦略作成画面
    U->>UI: 既存ポジション選択（複数）
    U->>UI: primaryPosition指定（1つのみ）
    U->>UI: primaryのトレール幅設定
    U->>UI: トレール時のアクション設定
    U->>UI: 戦略作成ボタン
    UI->>API: createStrategy(type:EXIT)
    loop 選択ポジション
        UI->>API: createAction(type:CLOSE, status:PENDING)
    end
    UI->>API: updatePosition(primary:true, trailWidth)
    Note right of API: primaryポジションの<br/>トレール用アクション作成
    
    Note over U,EA: 実行フェーズ
    U->>UI: 戦略実行ボタン
    UI->>API: updateStrategy(status:EXECUTING)
    API-->>HS: Subscription通知
    
    HS->>API: primaryポジション確認
    HS->>HS: primaryのトレール幅で監視開始
    loop 価格監視
        EA->>HS: PRICE更新
        HS->>HS: トレール条件判定
        opt 条件成立
            HS->>API: strategyに紐づく全Actionをupdate(status:EXECUTING)
            Note right of HS: トレール用アクションを<br/>実行状態に変更
            API-->>HS: Action Subscription
            HS->>EA: アクション実行
            EA->>HS: 実行結果
            HS->>API: updateAction(status:EXECUTED)
        end
    end
```

### 3-3. ロスカット対応パターン
```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as 管理画面
    participant API as AppSync
    participant HS1 as Hedge System 1
    participant HS2 as Hedge System 2
    participant EA1 as MT4/MT5 (PC1)
    participant EA2 as MT4/MT5 (PC2)
    
    Note over U,EA2: ロスカット設定フェーズ
    U->>UI: ポジション選択
    U->>UI: トレール幅設定
    U->>UI: トレール時のアクション内容設定
    U->>UI: 設定保存
    UI->>API: updatePosition(trailWidth)
    UI->>API: createAction(type:CLOSE/ENTRY, status:PENDING)
    Note right of API: トレール用アクションを<br/>事前作成（待機状態）
    
    Note over U,EA2: ロスカット発生時
    EA1->>HS1: ロスカット通知
    HS1->>API: updatePosition(status:STOPPED)
    HS1->>API: getPosition(トレール設定確認)
    opt トレール設定あり
        HS1->>API: updateAction(status:EXECUTING)
        Note right of HS1: PENDINGアクションを<br/>実行状態に変更
        API-->>HS2: Action Subscription通知
        HS2->>HS2: 担当確認（accountId→userId）
        HS2->>EA2: アクション実行
        EA2->>HS2: 実行結果
        HS2->>API: updateAction(status:EXECUTED)
        API-->>HS1: 完了通知
    end
```

## 4. システムアーキテクチャ詳細

### 4-1. Hedge Systemクライアント（Tauriアプリ）

```mermaid
graph TB
    subgraph "Hedge Systemクライアント"
        AccountMgr[口座管理]
        StrategyExec[戦略実行<br/>エンジン]
        PositionMon[ポジション<br/>監視]
        ActionSync[アクション<br/>同期実行]
        TrailEngine[トレール<br/>判定エンジン]
        WSServer[WebSocket<br/>サーバー]
        CloudSync[クラウド<br/>同期]
    end
    
    AccountMgr --> StrategyExec
    StrategyExec --> PositionMon
    PositionMon --> TrailEngine
    TrailEngine --> ActionSync
    ActionSync --> WSServer
    CloudSync <--> AccountMgr
    CloudSync <--> ActionSync
    
    WSServer <--> EA[MT4/MT5 EA]
    CloudSync <--> API[AppSync API]
```

主要機能：
1. **口座管理**
   - 接続中の口座情報管理
   - 口座残高・証拠金の定期更新
   - 口座別のポジション管理
   - userIdによる所有者特定

2. **戦略実行エンジン**
   - 実行指示を受けた戦略の処理
   - ポジションステータスの遷移管理（PENDING→OPENING→OPEN）
   - userIdベースの実行判定

3. **アクション同期実行**
   - AppSyncのActionテーブルをSubscription（状態変更監視）
   - PENDING→EXECUTINGの変更を検知
   - accountId → userId → 1PCで実行判定
   - 実行結果のAppSync反映（EXECUTED/FAILED）

4. **トレール判定エンジン**
   - ポジションのトレール幅設定に基づく監視
   - 条件成立時のアクションステータス更新（PENDING→EXECUTING）
   - エントリー後のトレール処理
   - ロスカット後のトレール処理
   - 決済戦略のprimaryポジション監視

### 4-2. アクション同期実行メカニズム

```mermaid
graph TB
    subgraph "アクション作成（PENDING）"
        Strategy[戦略作成時] --> ActionP[Action<br/>status:PENDING]
        Manual[手動作成] --> ActionP
        Position[ロスカット設定] --> ActionP
    end
    
    subgraph "アクショントリガー"
        Exec[戦略実行] --> UpdateS[status:EXECUTING]
        Trail[トレール条件] --> UpdateS
        User[手動実行] --> UpdateS
    end
    
    subgraph "AppSync同期"
        UpdateS --> API[AppSync更新]
        API --> Sub[Subscription<br/>通知]
    end
    
    subgraph "実行判定（1ユーザー1PC）"
        Sub --> HS[各Hedge System]
        HS --> GetAccount[accountId取得]
        GetAccount --> GetUser[userId確認]
        GetUser --> Check{自分のユーザー？}
        
        Check -->|Yes| Execute[実行]
        Check -->|No| Skip[スキップ]
    end
```

### 4-3. 管理者画面（Next.js）

```mermaid
graph TB
    subgraph "管理者画面"
        Account[口座管理]
        Strategy[戦略管理]
        Position[ポジション管理]
        Monitor[リアルタイム監視]
    end
    
    Account --> List[口座一覧<br/>接続状態]
    Account --> Add[口座追加<br/>設定]
    
    Strategy --> Entry[エントリー戦略<br/>作成]
    Strategy --> Exit[決済戦略<br/>作成]
    Strategy --> Exec[戦略実行]
    
    Position --> View[ポジション<br/>一覧]
    Position --> Config[ロスカット設定<br/>トレール幅＋<br/>アクション作成]
    
    Monitor --> Live[リアルタイム<br/>状態表示]
```

## 5. データフロー設計

### 5-1. 戦略実行トリガーフロー
```mermaid
stateDiagram-v2
    [*] --> PREPARED: 戦略作成
    PREPARED --> EXECUTING: 実行ボタン
    
    state EXECUTING {
        [*] --> UpdateStrategy: Strategy更新
        UpdateStrategy --> CheckType: 戦略タイプ確認
        
        CheckType --> EntryFlow: ENTRY戦略
        CheckType --> ExitFlow: EXIT戦略
        
        state EntryFlow {
            UpdatePos: Position更新
            UpdatePos --> OPENING: PENDING→OPENING
        }
        
        state ExitFlow {
            UpdateAct: Action更新
            UpdateAct --> EXECUTING_ACT: PENDING→EXECUTING
        }
        
        EntryFlow --> [*]: エントリー開始
        ExitFlow --> [*]: 決済開始
    }
    
    EXECUTING --> COMPLETED: 処理完了
    COMPLETED --> [*]
```

### 5-2. ポジションステータス遷移
```mermaid
stateDiagram-v2
    [*] --> PENDING: 戦略作成時
    PENDING --> OPENING: 戦略実行時
    OPENING --> OPEN: 約定成功
    OPENING --> CANCELED: 約定失敗
    
    OPEN --> CLOSING: 決済指示
    CLOSING --> CLOSED: 決済成功
    CLOSING --> OPEN: 決済失敗
    
    OPEN --> STOPPED: ロスカット
    
    CLOSED --> [*]
    STOPPED --> [*]
    CANCELED --> [*]
```

### 5-3. アクション実行同期フロー
```mermaid
sequenceDiagram
    participant Trigger as トリガー源
    participant API as AppSync
    participant HS1 as Hedge System 1
    participant HS2 as Hedge System 2
    participant EA1 as EA (口座A)
    participant EA2 as EA (口座C)
    
    Note over Trigger,EA2: アクションステータス変更
    Trigger->>API: updateAction(PENDING→EXECUTING)
    API-->>HS1: Subscription通知
    API-->>HS2: Subscription通知
    
    Note over Trigger,EA2: 実行判定
    HS1->>HS1: 自ユーザーの口座A→実行
    HS2->>HS2: 自ユーザーの口座C→実行
    
    par 並列実行
        HS1->>EA1: アクション実行
        EA1->>HS1: 実行結果
        HS1->>API: updateAction(EXECUTED)
    and
        HS2->>EA2: アクション実行
        EA2->>HS2: 実行結果
        HS2->>API: updateAction(EXECUTED)
    end
```

### 5-4. データ同期優先度

| データ種別 | 同期頻度 | 優先度 | 説明 |
|-----------|---------|--------|------|
| **戦略実行** | 即時 | 最高 | ステータス変更とトリガー発火 |
| **ポジション状態** | 即時 | 最高 | PENDING→OPENING→OPEN等の遷移 |
| **アクション状態変更** | 即時 | 最高 | PENDING→EXECUTING→EXECUTED |
| **Subscription通知** | 即時 | 最高 | 状態変更の全PC配信 |
| **トレール判定** | 定期 | 高 | 条件成立時のアクション起動 |
| **口座情報** | 30秒毎 | 中 | 残高、証拠金の定期更新 |

## 6. WebSocket通信設計

### 6-1. メッセージフォーマット

**Hedge System → EA（コマンド）**
```json
{
  "command": "OPEN",
  "accountId": "acc-123",
  "positionId": "pos-456",
  "symbol": "USDJPY",
  "side": "BUY",
  "volume": 1.0,
  "metadata": {
    "strategyId": "strat-001",
    "timestamp": "2025-06-22T10:00:00Z"
  }
}
```

**アクション実行時のコマンド**
```json
{
  "command": "EXECUTE_ACTION",
  "accountId": "acc-123",
  "actionId": "act-789",
  "type": "CLOSE",
  "positionId": "pos-999",
  "params": {
    "volume": 1.0,
    "symbol": "USDJPY"
  },
  "metadata": {
    "triggerPositionId": "pos-456",
    "triggerType": "POSITION"
  }
}
```

**EA → Hedge System（イベント）**
```json
{
  "event": "OPENED",
  "accountId": "acc-123",
  "positionId": "pos-456",
  "mtTicket": "12345678",
  "price": 150.50,
  "time": "2025-06-22T10:00:05Z",
  "status": "SUCCESS"
}
```

**アクション実行結果**
```json
{
  "event": "ACTION_EXECUTED",
  "accountId": "acc-123",
  "actionId": "act-789",
  "result": "SUCCESS",
  "details": {
    "mtTicket": "87654321",
    "price": 151.00
  }
}
```

### 6-2. 通信シーケンス
```mermaid
sequenceDiagram
    participant API as AppSync
    participant HS as Hedge System
    participant EA as MT4/MT5 EA
    participant MT as MetaTrader
    
    Note over API,MT: 認証・接続
    EA->>HS: Connect(accountId, authToken)
    HS->>EA: Accept(sessionId)
    HS->>API: updateAccount(status:ONLINE)
    
    Note over API,MT: ポジションエントリー実行
    API-->>HS: Position Subscription (OPENING)
    HS->>HS: 実行判定（accountId→userId確認）
    HS->>EA: OPEN命令（ポジション情報）
    EA->>MT: OrderSend()
    MT->>EA: Ticket#12345678
    EA->>HS: OPENED通知（チケット番号含む）
    HS->>API: updatePosition(mtTicket, status:OPEN)
    
    Note over API,MT: アクション実行
    API-->>HS: Action Subscription (EXECUTING)
    HS->>HS: 実行判定（accountId→userId確認）
    HS->>EA: アクション実行命令
    EA->>MT: OrderSend/OrderClose
    MT->>EA: Ticket#87654321
    EA->>HS: 実行結果通知
    HS->>API: updateAction(status:EXECUTED)
    
    Note over API,MT: トレール監視
    HS->>HS: ポジションのトレール幅で監視開始
    loop 価格監視
        EA->>HS: PRICE更新
        HS->>HS: トレール条件判定
        opt 条件成立
            HS->>API: updateAction(PENDING→EXECUTING)
            Note right of HS: 事前作成済みアクションの<br/>ステータスを変更
        end
    end
    
    Note over API,MT: ロスカット処理
    MT->>EA: OnTradeTransaction(STOP_LOSS)
    EA->>HS: STOPPED通知
    HS->>API: updatePosition(STOPPED)
    HS->>API: getActions(positionId, status:PENDING)
    opt トレール用アクションあり
        HS->>API: updateAction(PENDING→EXECUTING)
        Note right of HS: 事前作成アクションを起動
    end
```

## 7. エラーハンドリング設計

### 7-1. エラー分類と対処
```mermaid
graph TD
    Error[エラー発生] --> Type{エラー種別}
    
    Type -->|口座接続エラー| Reconnect[再接続処理<br/>口座状態更新]
    Type -->|戦略実行エラー| Rollback[状態ロールバック<br/>OPENING→PENDING]
    Type -->|アクション実行エラー| Retry[アクション再試行<br/>EXECUTING→PENDING]
    Type -->|同期エラー| Resync[AppSync再同期<br/>Subscription再接続]
    Type -->|トレールエラー| Skip[アクションスキップ<br/>ログ記録]
    
    Reconnect --> Log[エラーログ記録]
    Rollback --> Log
    PartialExec --> Log
    Resync --> Log
    Skip --> Log
```

### 7-2. 状態整合性の保証
- トランザクション的な状態更新（Strategy→Position→Action）
- 重複実行防止（アクションの排他制御）
- タイムアウト処理（OPENING/CLOSINGの自動解除）
- 1ユーザー1PC制約による実行の単純化

## 8. セキュリティ設計

### 8-1. 多層防御アーキテクチャ
```mermaid
graph TB
    subgraph "認証層"
        Cognito[Amazon Cognito]
        JWT[JWTトークン]
        Session[セッション管理]
    end
    
    subgraph "通信層"
        HTTPS[HTTPS/TLS]
        WSS[WSS暗号化]
        Local[ローカル限定<br/>127.0.0.1]
    end
    
    subgraph "データ層"
        Encrypt[暗号化保存]
        Access[口座別<br/>アクセス制御]
        Audit[操作ログ]
    end
```

### 8-2. 口座情報の保護
- 口座認証情報はEA側で管理（Hedge Systemには保存しない）
- 口座番号の部分マスキング表示
- userIdベースのアクセス制御（他ユーザーの口座にアクセス不可）
- アクションの実行権限管理（作成者のみステータス変更可）

## 9. パフォーマンス最適化

### 9-1. 効率的な実行判定
```mermaid
graph LR
    subgraph "1ユーザー1PC制約"
        User1[ユーザー1] --> PC1[PC1]
        User2[ユーザー2] --> PC2[PC2]
        User3[ユーザー3] --> PC3[PC3]
    end
    
    subgraph "口座と実行PC"
        PC1 --> Accounts1[口座A,B]
        PC2 --> Accounts2[口座C,D]
        PC3 --> Accounts3[口座E,F]
    end
    
    subgraph "Subscription最適化"
        Sub[全Action] --> Filter[userId判定]
        Filter --> Relevant[自ユーザーのみ実行]
    end
```

### 9-2. システム最適化手法
- **Subscription効率化**: userId判定による早期フィルタリング
- **バッチ処理**: 同一口座の複数アクションをまとめて実行
- **接続プーリング**: EA接続の再利用
- **非同期処理**: トレール判定とアクション実行の非同期化
- **事前作成**: アクションの事前作成により実行時の処理を最小化
- **シンプルな判定**: 1ユーザー1PC制約によるロジック簡素化

## まとめ

本設計書では、複数のMT4/MT5口座を統合管理し、戦略的な取引実行を可能にするシステムを定義しています。

**システムの核心要素：**
- **Account**: MT4/MT5口座情報の管理（userId経由でPC特定）
- **Strategy**: 使い捨ての実行計画（シンプルな状態管理のみ）
- **Position**: 口座に紐づく取引ポジション（トレール設定保持）
- **Action**: 事前作成されステータス変更でトリガーされる実行単位
- **1ユーザー1PC**: シンプルな実行判定ロジック

**実装の重要ポイント：**
1. 戦略実行時のポジションステータス遷移（PENDING→OPENING）がエントリートリガー
2. エントリー戦略ではポジションとトレール用アクションを事前作成（PENDING）
3. アクションはPENDINGで待機し、トレール条件成立時にEXECUTINGに変更
4. アクションのステータス変更がSubscription経由で全PCに通知
5. 実行判定は accountId → userId → 自PCかどうかの確認で決定（1ユーザー1PC）
6. 決済戦略のトレール幅はprimaryポジションから取得
7. 決済戦略では決済アクションとトレール用アクションを分けて管理

この設計により、複雑な取引シナリオにも対応できる柔軟性と、シンプルな実行判定による高い信頼性を実現します。特に、1ユーザー1PC制約を活用することで、データモデルと実行ロジックの両方が大幅に簡素化され、実装・保守が容易なシステムとなっています。