# AWS Amplifyベース Hedge System MVP システム設計書 v7.0

## 1. システム概要

### 1-1. システムの目的

本システムは、ボーナスアービトラージ業務向けの**ポジション管理型自動取引システム**（Hedge System）です。複数のMT4/MT5口座を一元管理し、両建てポジションを管理者画面から設定して、動的に組み替えながら、クレジット（ボーナス）を活用した取引を実行します。1ユーザー1PCの制約のもと、シンプルで確実な取引実行を実現します。

### 1-2. システム構成要素

```mermaid
graph TB
    subgraph "ユーザー環境"
        Admin[管理者画面<br/>Next.js]
        Client[Hedge System<br/>Tauri App]
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
    Client <-->|HTTPS/WSS| Auth
    Client <-->|GraphQL| API
    Client <-->|WebSocket| EA1 & EA2
    API <--> DB

    style Admin fill:#e1f5fe
    style Client fill:#f3e5f5
    style EA1 fill:#fff3e0
    style EA2 fill:#fff3e0
```

### 1-3. 主要機能（MVP範囲）

- **口座管理**: MT4/MT5の複数口座情報とクレジット（ボーナス）管理（管理画面から作成）
- **ポジション管理**: エントリー・決済・トレール設定を個別管理（全て管理画面から作成）
- **両建て管理**: 口座全体で両建てポジションを動的に組み替え
- **トレーリングストップ**: トレール設定を持つポジションが独立してアクション実行
- **ロスカット対応**: ポジションのトレール設定からトリガーされる自動アクション実行
- **リアルタイム監視**: ポジション状態とアクション実行状況のモニタリング
- **シンプルな実行判定**: 1ユーザー1PC制約による確実な処理

## 2. データベース設計

### 2-1. データモデル全体図（userId最適化版）

```mermaid
erDiagram
    User ||--o{ Account : owns
    User ||--o{ Position : creates
    User ||--o{ Action : creates
    Account ||--o{ Position : has
    Account ||--o{ Action : targets
    Position ||--o{ Action : triggers

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
        float balance "現金残高"
        float credit "クレジット（ボーナス）"
        float equity "有効証拠金"
        boolean isActive "有効/無効"
        datetime lastUpdated
    }

    Position {
        string id PK
        string userId FK "作成者・実行担当"
        string accountId FK "所属口座"
        ExecutionType executionType "ENTRY/EXIT"
        PositionStatus status "必須"
        Symbol symbol "必須"
        float volume "必須・ロット数"
        float entryPrice "約定価格"
        datetime entryTime "約定時刻"
        float exitPrice "決済価格"
        datetime exitTime "決済時刻"
        string exitReason "決済理由"
        float trailWidth "トレール幅（0で即時実行）"
        string triggerActionIds "Optional・JSON配列"
        string mtTicket "MT4/5チケット番号"
        string memo "実行理由・メモ"
        datetime createdAt
        datetime updatedAt
    }

    Action {
        string id PK
        string userId FK "作成者・実行担当"
        string accountId FK "対象口座"
        string positionId FK "対象ポジション"
        string triggerPositionId FK "トリガー元ポジション"
        ActionType type "必須・ENTRY/CLOSE"
        ActionStatus status "必須"
        datetime createdAt
        datetime updatedAt
    }
```

### 2-2. userId追加による最適化効果

| 改善項目                  | 説明                            | クエリ例（GSI使用）                                                       |
| ------------------------- | ------------------------------- | ------------------------------------------------------------------------- |
| **1. 高速な担当判定**     | userIdのGSIで直接検索           | `listPositionsByUserId(userId: "user-123", limit: 100)`                   |
| **2. 実行対象の即座判定** | Account経由せずに判定可能       | `listActionsByUserIdAndStatus(userId: $myUserId, statusEq: "EXECUTING")`  |
| **3. 監視対象の効率化**   | 自分のトレール対象のみ監視      | `listPositionsByUserId(userId: $myUserId, filter: {trailWidth: {gt: 0}})` |
| **4. ユーザー別集計**     | GSI使用でユーザー単位の高速集計 | `listPositionsByUserIdAndStatus(userId: $userId, statusEq: "OPEN")`       |

### 2-3. 列挙型（Enum）定義

| 列挙型名           | 値                             | 説明                                 |
| ------------------ | ------------------------------ | ------------------------------------ |
| **Symbol**         | USDJPY, EURUSD, EURGBP, XAUUSD | 取引可能な銘柄                       |
| **PositionStatus** | PENDING                        | 作成済み・発注待機中                 |
|                    | OPENING                        | 発注処理中（実行開始後）             |
|                    | OPEN                           | エントリー約定済み・ポジション保有中 |
|                    | CLOSING                        | 決済指令済みでクローズ処理中         |
|                    | CLOSED                         | ポジション決済済み                   |
|                    | STOPPED                        | ロスカット執行済み                   |
|                    | CANCELED                       | 発注失敗等でポジション不成立         |
| **ActionType**     | ENTRY                          | 新規エントリー                       |
|                    | CLOSE                          | 通常クローズ                         |
| **ExecutionType**  | ENTRY                          | エントリー実行                       |
|                    | EXIT                           | 決済実行                             |
| **TriggerType**    | POSITION_TRAIL                 | ポジションのトレール経由             |
| **ActionStatus**   | PENDING                        | アクション待機中                     |
|                    | EXECUTING                      | 実行中                               |
|                    | EXECUTED                       | 実行完了                             |
|                    | FAILED                         | 実行失敗                             |
| **UserRole**       | CLIENT                         | 一般ユーザー                         |
|                    | ADMIN                          | 管理者                               |
| **PCStatus**       | ONLINE                         | PC接続中                             |
|                    | OFFLINE                        | PC未接続                             |

### 2-4. 認証・権限設計

各モデルの権限設定：

- **User**: 本人は読み取り・更新可、ADMINロールは全操作可
- **Account**: 所有者とADMINは全操作可
- **Position/Action**: userIdベースでの所有者とADMINグループは全操作可

## 3. 複数Hedge System間の連携

### 3-1. トレール条件達成時の連携フロー

```mermaid
sequenceDiagram
    participant U1 as User1
    participant HS1 as Hedge System 1<br/>(User1 PC)
    participant API as AppSync<br/>(クラウド)
    participant HS2 as Hedge System 2<br/>(User2 PC)
    participant U2 as User2
    participant EA1 as MT4/5 EA<br/>(User1)
    participant EA2 as MT4/5 EA<br/>(User2)

    Note over U1,EA2: 初期設定フェーズ
    U1->>API: Position A作成<br/>trailWidth: 50<br/>triggerActionIds: [act-001]
    U2->>API: Action(act-001)作成<br/>type: ENTRY<br/>status: PENDING
    U2->>API: Position B作成<br/>actionId: act-001<br/>status: PENDING

    Note over U1,EA2: トレール監視フェーズ
    HS1->>HS1: Position A監視開始
    loop 価格監視
        EA1->>HS1: PRICE更新
        HS1->>HS1: トレール条件判定
    end

    Note over U1,EA2: トレール発動フェーズ
    HS1->>HS1: トレール条件成立！
    HS1->>API: updateAction(act-001)<br/>PENDING→EXECUTING

    Note over U1,EA2: 別システムでの実行フェーズ
    API-->>HS2: Action Subscription通知<br/>(act-001: EXECUTING)
    HS2->>HS2: userId確認: User2が担当
    HS2->>API: updatePosition(status:OPENING)
    HS2->>EA2: OPEN命令
    EA2->>EA2: OrderSend実行
    EA2-->>HS2: OPENED通知
    HS2->>API: updatePosition(status:OPEN)
    HS2->>API: updateAction(act-001)<br/>EXECUTING→EXECUTED
```

### 3-2. 複数システム連携の詳細

```mermaid
graph TB
    subgraph "User1環境"
        HS1[Hedge System 1]
        EA1[MT4/5 EA]
        Pos1[Position A<br/>trailWidth: 50]
    end

    subgraph "User2環境"
        HS2[Hedge System 2]
        EA2[MT4/5 EA]
        Action1[Action: ENTRY<br/>status: PENDING]
    end

    subgraph "User3環境"
        HS3[Hedge System 3]
        EA3[MT4/5 EA]
        Action2[Action: CLOSE<br/>status: PENDING]
    end

    subgraph "AWS AppSync"
        Sub[GraphQL<br/>Subscriptions]
        DB[(DynamoDB)]
    end

    Pos1 -->|トレール監視| HS1
    HS1 -->|条件成立| Update1[triggerActionIds<br/>実行]
    Update1 -->|act-001,act-002| DB

    DB -->|Subscription| Sub
    Sub -->|userId判定| HS2
    Sub -->|userId判定| HS3

    HS2 -->|自分の担当| EA2
    HS3 -->|自分の担当| EA3

    style Pos1 fill:#e1f5fe
    style Action1 fill:#f3e5f5
    style Action2 fill:#fff3e0
```

## 4. 実行パターン詳細

### 4-1. エントリー実行パターン

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as 管理画面
    participant API as AppSync
    participant HS as Hedge System
    participant EA as MT4/MT5

    Note over U,EA: エントリーアクション作成フェーズ
    U->>UI: エントリー計画作成画面
    U->>UI: 対象口座選択
    U->>UI: エントリー情報入力
    U->>UI: トレール幅設定（0で即時実行）
    U->>UI: トレール時のアクション設定
    U->>UI: 作成ボタン

    UI->>API: createAction(type:ENTRY, status:PENDING)
    UI->>API: createPosition(userId, actionId, status:PENDING, trailWidth)
    loop トレール用アクション
        UI->>API: createAction(userId, PENDING)
    end
    UI->>API: updatePosition(triggerActionIds)
    API-->>UI: 作成完了

    Note over U,EA: 実行フェーズ
    U->>UI: エントリー実行ボタン
    UI->>API: updatePosition(status:OPENING)
    API-->>HS: Position Subscription通知

    HS->>HS: userId確認（自分の担当か？）
    HS->>EA: OPEN命令
    EA->>EA: OrderSend実行
    EA->>HS: OPENED通知
    HS->>API: updatePosition(status:OPEN, mtTicket)

    Note over U,EA: トレール監視開始（status:OPEN後）
    HS->>HS: トレール監視開始
    alt トレール幅 = 0
        HS->>HS: 即時トリガー
        HS->>API: updateAction(PENDING→EXECUTING)
    else トレール幅 > 0
        loop 価格監視
            EA->>HS: PRICE更新
            HS->>HS: トレール条件判定
            opt 条件成立
                HS->>API: updateAction(PENDING→EXECUTING)
            end
        end
    end
```

### 4-2. 決済実行パターン

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as 管理画面
    participant API as AppSync
    participant HS as Hedge System
    participant EA as MT4/MT5

    Note over U,EA: 決済設定フェーズ
    U->>UI: 決済対象ポジション選択
    U->>UI: 決済アクション作成
    U->>UI: 残存ポジション選択
    U->>UI: トレール幅設定（0で即時実行）
    U->>UI: トレール時のアクション設定
    U->>UI: 作成ボタン

    UI->>API: createAction(userId, type:CLOSE, PENDING)
    UI->>API: updatePosition(trailWidth)
    loop トレール用アクション
        UI->>API: createAction(userId, PENDING)
    end
    UI->>API: updatePosition(triggerActionIds)

    Note over U,EA: 決済実行フェーズ
    U->>UI: 決済実行ボタン
    UI->>API: updatePosition(status:CLOSING)
    API-->>HS: Position Subscription通知

    HS->>HS: userId確認（自分の担当か？）
    HS->>EA: CLOSE命令
    EA->>EA: OrderClose実行
    EA->>HS: CLOSED通知
    HS->>API: updatePosition(status:CLOSED)
    HS->>API: updateAction(status:EXECUTED)

    Note over U,EA: 残存ポジションのトレール監視
    HS->>HS: トレール設定確認
    alt トレール幅 = 0
        HS->>HS: 即時トリガー
        HS->>API: updateAction(PENDING→EXECUTING)
    else トレール幅 > 0
        loop 価格監視
            EA->>HS: PRICE更新
            HS->>HS: トレール条件判定
            opt 条件成立
                HS->>API: updateAction(PENDING→EXECUTING)
            end
        end
    end
```

### 4-3. ロスカット対応パターン

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as 管理画面
    participant API as AppSync
    participant HS as Hedge System
    participant EA as MT4/MT5

    Note over U,EA: ロスカット設定フェーズ
    U->>UI: ポジション選択
    U->>UI: トレール幅設定
    U->>UI: トレール時のアクション設定
    U->>UI: 設定保存

    UI->>API: updatePosition(trailWidth)
    loop トレール時アクション
        UI->>API: createAction(userId, PENDING)
    end
    UI->>API: updatePosition(triggerActionIds)

    Note over U,EA: ロスカット発生時
    EA->>HS: ロスカット通知
    HS->>API: updatePosition(status:STOPPED)
    HS->>API: getPosition(triggerActionIds確認)

    opt トレール設定あり
        loop 各triggerActionId
            HS->>API: updateAction(PENDING→EXECUTING)
        end
        API-->>HS: Action Subscription通知
        HS->>EA: アクション実行
    end
```

## 5. システムアーキテクチャ詳細

### 5-1. Hedge Systemクライアント（Tauriアプリ）

```mermaid
graph TB
    subgraph "Hedge Systemクライアント"
        AccountMgr[口座管理<br/>クレジット監視]
        PositionExec[ポジション<br/>実行エンジン]
        HedgeMgr[両建て<br/>管理]
        TrailEngine[トレール<br/>判定エンジン]
        ActionSync[アクション<br/>同期実行]
        WSServer[WebSocket<br/>サーバー]
        CloudSync[クラウド<br/>同期]
    end

    AccountMgr --> PositionExec
    HedgeMgr --> PositionExec
    PositionExec --> TrailEngine
    TrailEngine --> ActionSync
    ActionSync --> WSServer
    CloudSync <--> all

    WSServer <--> EA[MT4/MT5 EA]
    CloudSync <--> API[AppSync API]
```

主要機能：

1. **口座管理**

   - 接続中の口座情報管理
   - 残高・クレジット・証拠金の定期更新
   - クレジット変動の監視
   - userIdによる所有者特定

2. **ポジション実行エンジン**

   - 個別ポジションの実行管理
   - ポジションステータスの遷移管理
   - userIdベースの実行判定

3. **両建て管理**

   - 口座全体のポジション監視
   - 両建ての動的な組み替え支援
   - ネットポジションの計算
   - クレジット活用状況の可視化

4. **トレール判定エンジン**
   - トレール設定を持つ全ポジションの監視
   - 各ポジション独立したトレール条件判定
   - triggerActionIdsの実行管理

### 5-2. ポジション実行フロー

```mermaid
stateDiagram-v2
    [*] --> Created: ポジション作成

    state Setup {
        Created --> Pending: status:PENDING設定
        Pending --> TrailConfig: トレール設定判定

        state TrailConfig {
            [*] --> CheckTrail: トレール必要？
            CheckTrail --> WithTrail: Yes
            CheckTrail --> NoTrail: No

            WithTrail --> SetTrailWidth: trailWidth設定
            SetTrailWidth --> CreateActions: トリガーアクション作成
            CreateActions --> SetActionIds: triggerActionIds設定
            SetActionIds --> [*]

            NoTrail --> [*]
        }
    }

    Setup --> Ready: 実行準備完了

    state Execution {
        Ready --> UserAction: ユーザー実行操作
        UserAction --> UpdateStatus: status更新
        UpdateStatus --> Opening: PENDING→OPENING
        Opening --> Notify: Subscription発火
    }

    Execution --> Processing: Hedge System処理

    state Processing {
        [*] --> CheckUser: userId確認
        CheckUser --> IsMyPosition: 自分の担当？
        IsMyPosition --> SendOrder: Yes：EA命令送信
        IsMyPosition --> Skip: No：スキップ
        SendOrder --> WaitResult: 約定待機
        WaitResult --> [*]
    }

    Processing --> Result: 処理結果

    state Result {
        [*] --> CheckResult: 結果判定
        CheckResult --> Success: 成功
        CheckResult --> Failed: 失敗

        Success --> Open: status:OPEN
        Failed --> Canceled: status:CANCELED

        Open --> StartMonitor: 監視開始
        Canceled --> [*]
    }

    Result --> Monitoring: トレール監視

    state Monitoring {
        StartMonitor --> CheckTrailSetting: トレール設定確認
        CheckTrailSetting --> HasTrail: trailWidth > 0
        CheckTrailSetting --> NoMonitor: トレールなし

        HasTrail --> PriceWatch: 価格監視
        PriceWatch --> TrailJudge: 条件判定
        TrailJudge --> Triggered: 条件成立
        TrailJudge --> Continue: 未成立
        Continue --> PriceWatch

        Triggered --> ExecuteActions: triggerActionIds実行
        NoMonitor --> [*]
    }

    Monitoring --> [*]: 決済/ロスカット
```

### 5-3. アクション実行の担当判定フロー

```mermaid
flowchart TD
    Start[Action Subscription受信] --> GetAction[Action情報取得]
    GetAction --> CheckUserId{userId確認}

    CheckUserId -->|自分のuserId| MyAction[自分の担当アクション]
    CheckUserId -->|他のuserId| OtherAction[他ユーザーの担当]

    MyAction --> CheckStatus{status確認}
    CheckStatus -->|EXECUTING| Execute[実行処理開始]
    CheckStatus -->|その他| Skip1[処理スキップ]

    Execute --> GetAccount[accountId取得]
    GetAccount --> ConnectEA[対象EA接続確認]
    ConnectEA --> SendCommand[コマンド送信]
    SendCommand --> UpdateResult[結果更新]

    OtherAction --> Skip2[処理スキップ]

    style MyAction fill:#e1f5fe
    style Execute fill:#c8e6c9
    style OtherAction fill:#ffcdd2
    style Skip1 fill:#eeeeee
    style Skip2 fill:#eeeeee
```

### 5-4. 管理者画面（Next.js）

```mermaid
graph TB
    subgraph "管理者画面"
        Account[口座管理]
        Position[ポジション管理]
        Hedge[両建て管理]
        Monitor[リアルタイム監視]
    end

    Account --> Balance[残高・クレジット<br/>表示]
    Account --> Status[接続状態<br/>管理]

    Position --> Create[個別ポジション<br/>作成]
    Position --> Trail[トレール設定<br/>アクション設定]

    Hedge --> View[両建て状況<br/>一覧表示]
    Hedge --> Adjust[組み替え<br/>操作]

    Monitor --> Live[ポジション<br/>状態表示]
    Monitor --> Action[アクション<br/>実行状況]
```

**主要機能：**

1. **口座管理**

   - 残高・クレジット・証拠金の表示
   - クレジット変動履歴
   - 口座接続状態

2. **ポジション管理**

   - 個別ポジション作成・実行
   - トレール設定（任意のポジションに設定可能）
   - アクション管理

3. **両建て管理**
   - 口座全体の俯瞰
   - ネットポジション表示
   - 動的な組み替え操作
   - クレジット活用の最適化

## 6. データフロー設計

### 6-1. トレール実行フロー

```mermaid
stateDiagram-v2
    [*] --> Monitoring: 全ポジション監視

    state Monitoring {
        [*] --> CheckPositions: トレール設定確認
        CheckPositions --> Position1: Position A
        CheckPositions --> Position2: Position B
        CheckPositions --> PositionN: Position N

        Position1 --> TrailCheck1: トレール判定
        Position2 --> TrailCheck2: トレール判定
        PositionN --> TrailCheckN: トレール判定

        TrailCheck1 --> [*]
        TrailCheck2 --> [*]
        TrailCheckN --> [*]
    }

    Monitoring --> Triggered: いずれか条件成立

    state Triggered {
        [*] --> GetActions: triggerActionIds取得
        GetActions --> UpdateActions: 各Action更新
        UpdateActions --> [*]: PENDING→EXECUTING
    }

    Triggered --> Execution: Subscription経由
    Execution --> [*]
```

**設計のポイント：**

- すべてのトレール設定ありポジションを並列監視
- 各ポジションが独立してトリガー可能
- 複数ポジションが同時にトレール発動可能

### 6-2. データ同期優先度

| データ種別         | 同期頻度 | 優先度 | 説明                                 |
| ------------------ | -------- | ------ | ------------------------------------ |
| **ポジション状態** | 即時     | 最高   | PENDING→OPENING→OPEN等の遷移         |
| **アクション状態** | 即時     | 最高   | PENDING→EXECUTING→EXECUTED           |
| **トレール判定**   | 定期     | 高     | トレール設定ありポジションの条件監視 |
| **口座情報**       | 30秒毎   | 中     | 残高、クレジット、証拠金の定期更新   |
| **両建て状況**     | 変更時   | 中     | ポジション変更時の再計算             |

## 7. WebSocket通信設計

### 7-1. メッセージフォーマット

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
    "executionType": "ENTRY",
    "timestamp": "2025-06-22T10:00:00Z"
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
  "price": 150.5,
  "time": "2025-06-22T10:00:05Z",
  "status": "SUCCESS"
}
```

**口座情報更新イベント**

```json
{
  "event": "ACCOUNT_UPDATE",
  "accountId": "acc-123",
  "balance": 100000.0,
  "credit": 50000.0,
  "equity": 148000.0,
  "time": "2025-06-22T10:00:30Z"
}
```

**トレール発動イベント**

```json
{
  "event": "TRAIL_TRIGGERED",
  "positionId": "pos-456",
  "currentPrice": 151.5,
  "trailWidth": 50,
  "triggerActionIds": ["act-001", "act-002"]
}
```

### 7-2. 通信シーケンス

```mermaid
sequenceDiagram
    participant API as AppSync
    participant HS as Hedge System
    participant EA as MT4/MT5 EA
    participant MT as MetaTrader

    Note over API,MT: ポジション実行
    API-->>HS: Position Subscription (OPENING)
    HS->>HS: 実行判定（userId確認）
    HS->>EA: OPEN命令
    EA->>MT: OrderSend()
    MT->>EA: Ticket#12345678
    EA->>HS: OPENED通知
    HS->>API: updatePosition(mtTicket, status:OPEN)

    Note over API,MT: 口座情報更新
    loop 30秒毎
        EA->>MT: AccountInfo取得
        EA->>HS: ACCOUNT_UPDATE通知
        HS->>API: updateAccount(balance, credit, equity)
    end

    Note over API,MT: トレール監視
    HS->>API: listPositionsByUserId(userId: $myUserId)
    loop トレール設定ありポジション
        EA->>HS: PRICE更新
        HS->>HS: 各ポジション個別判定
        opt いずれか条件成立
            HS->>API: triggerActionIds実行
        end
    end
```

## 8. エラーハンドリング設計

### 8-1. エラー分類と対処

```mermaid
graph TD
    Error[エラー発生] --> Type{エラー種別}

    Type -->|ポジション実行エラー| Cancel[ポジション取消<br/>OPENING→CANCELED]
    Type -->|アクション実行エラー| Retry[アクション再試行<br/>EXECUTING→PENDING]
    Type -->|口座接続エラー| Reconnect[再接続処理<br/>口座状態更新]
    Type -->|同期エラー| Resync[AppSync再同期<br/>Subscription再接続]
    Type -->|トレールエラー| Skip[該当ポジションのみ<br/>スキップ]

    all --> Log[エラーログ記録]
```

### 8-2. 状態整合性の保証

- 個別ポジションのトランザクション処理
- 重複実行防止（アクションの排他制御）
- タイムアウト処理（OPENING/CLOSINGの自動解除）
- 両建て状態の整合性確認
- 1ユーザー1PC制約による実行の単純化

## 9. セキュリティ設計

### 9-1. 多層防御アーキテクチャ

```mermaid
graph TB
    subgraph "認証層"
        Cognito[Amazon Cognito]
        JWT[JWTトークン]
    end

    subgraph "通信層"
        HTTPS[HTTPS/TLS]
        WSS[WSS暗号化]
        Local[ローカル限定<br/>127.0.0.1]
    end

    subgraph "データ層"
        Encrypt[暗号化保存]
        Access[userIdベース<br/>アクセス制御]
        Audit[操作ログ]
    end
```

### 9-2. アクセス制御

- 口座情報はuserIdベースで制御
- 他ユーザーのポジション/アクションにアクセス不可
- トレール設定は作成者のみ変更可能
- クレジット情報の適切な管理

## 10. パフォーマンス最適化

### 10-1. 効率的な実行判定

```mermaid
graph LR
    subgraph "トレール監視最適化"
        All[全ポジション] --> Filter[userId + トレール<br/>フィルタ]
        Filter --> Trail[自分の<br/>トレール対象のみ]
    end

    subgraph "両建て管理"
        Positions[個別ポジション] --> Net[ネット計算]
        Net --> Display[効率的表示]
    end

    subgraph "口座更新"
        Account[口座情報] --> Batch[バッチ更新<br/>30秒毎]
        Batch --> Credit[クレジット<br/>変動監視]
    end
```

### 10-2. システム最適化手法

- **userIdによる高速フィルタリング**: GSI（Global Secondary Index）を使用した効率的なクエリ実行
- **トレール対象限定**: userId + trailWidth設定でダブルフィルタ
- **独立処理**: 各ポジションが独立して判定・実行
- **事前作成**: アクションの事前作成により実行時処理を軽減
- **バッチ更新**: 口座情報の定期バッチ更新
- **シンプルな判定**: 1ユーザー1PC制約によるロジック簡素化

## まとめ

本設計書では、Strategyテーブルを削除し、Positionを中心としたシンプルな設計を実現しています。さらにv7.0では、PositionとActionにuserIdを追加することで、大幅なパフォーマンス向上を実現しました。

**システムの核心要素：**

- **Position**: エントリー・決済・トレール管理を個別に実行
- **独立トレール**: トレール設定を持つ全ポジションが独立して機能
- **Action**: 事前作成されステータス変更でトリガーされる実行単位
- **Account**: クレジット（ボーナス）管理を含む口座情報
- **両建て管理**: 口座全体での動的なポジション組み替え

**v7.0での改善点：**

1. **userId追加によるDB最適化**: PositionとActionにuserIdを追加し、高速なフィルタリングを実現
2. **複数Hedge System連携の明確化**: トレール条件達成時の別PCでのアクション実行フローを可視化
3. **実行フローの修正**: ポジション実行フローのMermaid記法を正しく修正

**実装の重要ポイント：**

1. groupIdとprimaryフラグを削除し、よりシンプルな構造に
2. トレール設定（trailWidth + triggerActionIds）があるポジションが自動的にトレール機能を持つ
3. 複数ポジションが同時並行でトレール実行可能
4. クレジット管理によりボーナスアービトラージの本質に対応
5. 実行判定は userId による直接確認で高速化
6. ActionのParamsをJSON型から削除し、型安全性を向上

この設計により、不要な抽象化を排除し、より直感的で実装しやすいシステムが実現できます。両建ての動的な組み替えにも柔軟に対応可能で、複数ユーザー間の協調動作もスムーズに実現できます。
