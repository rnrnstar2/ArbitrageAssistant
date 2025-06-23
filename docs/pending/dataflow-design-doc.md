# データフロー設計書 - Hedge System MVP

## 1. はじめに

### 1-1. 本書の目的

本書は、Hedge System MVP内でのデータの流れ、処理タイミング、同期メカニズムを詳細に定義します。システム全体のデータフローを可視化し、開発者が実装時に参照できる具体的な指針を提供します。

### 1-2. データフローの基本原則

- **イベント駆動**: GraphQL SubscriptionとWebSocketによるリアルタイム伝播
- **結果整合性**: 非同期処理を許容し、最終的な整合性を保証
- **冪等性**: 同じ操作を複数回実行しても結果が変わらない設計

## 2. データフロー全体像

### 2-1. システム間データフロー概要

```mermaid
graph TB
    subgraph "入力層"
        UI[管理画面<br/>ユーザー操作]
        MT[MT4/MT5<br/>価格・約定情報]
        Timer[定期処理<br/>タイマー]
    end

    subgraph "処理層"
        API[AppSync API]
        HS[Hedge System]
        Engine[実行エンジン]
    end

    subgraph "データ層"
        DB[(DynamoDB)]
        Cache[ローカルキャッシュ]
    end

    subgraph "出力層"
        Sub[GraphQL Subscription]
        WS[WebSocket通知]
        Log[ログ出力]
    end

    UI --> API
    MT --> HS
    Timer --> HS
    API --> DB
    HS --> Cache
    HS --> Engine
    Engine --> API
    DB --> Sub
    HS --> WS
    All --> Log
```

### 2-2. データカテゴリと特性

| カテゴリ               | データ種別       | 更新頻度 | 同期方式       | 整合性要件       |
| ---------------------- | ---------------- | -------- | -------------- | ---------------- |
| **マスタデータ**       | User, Account    | 低       | 同期           | 強整合性         |
| **トランザクション**   | Position, Action | 高       | 非同期         | 結果整合性       |
| **リアルタイムデータ** | 価格, 残高       | 極高     | ストリーミング | ベストエフォート |
| **集計データ**         | 統計, レポート   | 中       | バッチ         | 結果整合性       |

## 3. ポジション実行フロー詳細

### 3-1. エントリー実行データフロー

```mermaid
sequenceDiagram
    participant U as ユーザー
    participant UI as 管理画面
    participant API as AppSync
    participant DB as DynamoDB
    participant Sub as Subscription
    participant HS as Hedge System
    participant Cache as LocalCache
    participant EA as MT4/MT5 EA

    Note over U,EA: フェーズ1: アクション・ポジション作成
    U->>UI: エントリー計画作成
    UI->>API: mutation createAction(type:ENTRY)
    API->>DB: Action保存(status:PENDING)
    API->>DB: Position自動生成(status:PENDING)
    DB-->>API: 作成完了
    API-->>UI: Response(actionId, positionId)

    Note over U,EA: フェーズ2: トレール設定（オプション）
    opt トレール設定あり
        UI->>API: mutation updatePosition(trailWidth)
        API->>DB: Position更新
        loop トリガーアクション作成
            UI->>API: mutation createAction
            API->>DB: Action保存
        end
        UI->>API: mutation updatePosition(triggerActionIds)
        API->>DB: Position更新
    end

    Note over U,EA: フェーズ3: 実行開始
    U->>UI: 実行ボタン押下
    UI->>API: mutation updatePosition(status:OPENING)
    API->>DB: ステータス更新
    DB-->>Sub: 変更イベント発火

    Note over U,EA: フェーズ4: Hedge System処理
    Sub-->>HS: onUpdatePosition通知
    HS->>HS: userId確認
    alt 自分の担当
        HS->>Cache: ポジション情報キャッシュ
        HS->>EA: OPEN命令送信
        EA->>EA: OrderSend実行
        EA-->>HS: 約定通知(ticket#)
        HS->>Cache: 約定情報更新
        HS->>API: mutation updatePosition(status:OPEN)
        API->>DB: ステータス・価格更新
    else 他ユーザーの担当
        HS->>HS: 処理スキップ
    end

    Note over U,EA: フェーズ5: トレール監視開始
    opt trailWidth > 0
        HS->>HS: 監視リストに追加
        loop 価格監視
            EA->>HS: 価格更新
            HS->>Cache: 価格キャッシュ更新
            HS->>HS: トレール条件判定
        end
    end
```

### 3-2. ポジション状態遷移とデータ更新

```mermaid
stateDiagram-v2
    [*] --> PENDING: createPosition

    state PENDING {
        [*] --> WaitingExecution
        WaitingExecution --> ConfiguringTrail: トレール設定
        ConfiguringTrail --> WaitingExecution: 設定完了
    }

    PENDING --> OPENING: updatePosition

    state OPENING {
        [*] --> SendingOrder
        SendingOrder --> WaitingResponse: EA通信
        WaitingResponse --> ProcessingResponse: 応答受信
    }

    OPENING --> OPEN: 約定成功
    OPENING --> CANCELED: 約定失敗

    state OPEN {
        [*] --> Monitoring
        Monitoring --> CheckingTrail: 価格更新
        CheckingTrail --> TriggeringActions: 条件成立
        CheckingTrail --> Monitoring: 条件未成立
        TriggeringActions --> Monitoring: アクション実行
    }

    OPEN --> CLOSING: 決済指示
    OPEN --> STOPPED: ロスカット

    state CLOSING {
        [*] --> SendingClose
        SendingClose --> WaitingClose: EA通信
        WaitingClose --> ProcessingClose: 応答受信
    }

    CLOSING --> CLOSED: 決済成功
    CLOSING --> OPEN: 決済失敗
    STOPPED --> [*]
    CLOSED --> [*]
    CANCELED --> [*]
```

### 3-3. データ更新タイミング

| イベント           | 更新対象         | 更新内容                                | 通知先         |
| ------------------ | ---------------- | --------------------------------------- | -------------- |
| **ポジション作成** | Position, Action | 初期データ                              | -              |
| **実行開始**       | Position.status  | PENDING→OPENING                         | 全Hedge System |
| **約定成功**       | Position         | status, entryPrice, entryTime, mtTicket | 全Hedge System |
| **価格更新**       | LocalCache       | currentPrice, unrealizedPL              | ローカルのみ   |
| **トレール発動**   | Action.status    | PENDING→EXECUTING                       | 全Hedge System |
| **決済完了**       | Position         | status, exitPrice, exitTime, realizedPL | 全Hedge System |

## 4. トレール実行フロー詳細

### 4-1. トレール監視データフロー

```mermaid
graph TB
    subgraph "監視対象選定"
        All[全ポジション] -->|GSI: byUserId| Mine[自分のポジション]
        Mine -->|Filter| Trail[trailWidth > 0]
        Trail -->|Filter| Open[status = OPEN]
    end

    subgraph "価格監視ループ"
        Open --> Load[ポジション読込]
        Load --> Price[価格取得]
        Price --> Calc[トレール計算]

        Calc --> Check{条件判定}
        Check -->|未成立| Wait[待機]
        Wait --> Price
        Check -->|成立| Trigger[トリガー]
    end

    subgraph "アクション実行"
        Trigger --> GetIds[triggerActionIds取得]
        GetIds --> Update[Action更新]
        Update --> Notify[通知発火]
    end

    subgraph "実行フロー"
        Notify --> HSCheck{担当確認}
        HSCheck -->|自分| Execute[実行]
        HSCheck -->|他者| Skip[スキップ]
    end
```

### 4-2. トレール条件判定フロー

トレール条件は以下の要素で判定：

- **現在価格と約定価格の差**: pips単位で計算
- **売買方向**: BUYは価格上昇、SELLは価格下降で発動
- **トレール幅**: 設定されたpips以上の変動で発動
- **ポジションステータス**: OPEN状態のみ監視対象

### 4-3. 複数ポジション並列トレール

```mermaid
sequenceDiagram
    participant Timer as 監視タイマー
    participant Monitor as トレール監視
    participant Cache as キャッシュ
    participant API as AppSync
    participant Sub as Subscription
    participant HS1 as Hedge System 1
    participant HS2 as Hedge System 2

    Note over Timer,HS2: 並列監視フロー
    Timer->>Monitor: 定期実行(100ms)
    Monitor->>Cache: 監視対象取得
    Cache-->>Monitor: Position[], userId確認済み

    par ポジションA監視
        Monitor->>Monitor: Position A評価
        opt 条件成立
            Monitor->>API: updateAction(act-001)
            API-->>Sub: onUpdateAction
            Sub-->>HS2: 通知(User2担当)
        end
    and ポジションB監視
        Monitor->>Monitor: Position B評価
        opt 条件成立
            Monitor->>API: updateAction(act-002)
            API-->>Sub: onUpdateAction
            Sub-->>HS1: 通知(User1担当)
        end
    and ポジションC監視
        Monitor->>Monitor: Position C評価
        Note right of Monitor: 条件未成立
    end

    Monitor->>Cache: 評価結果更新
```

## 5. アクション連携フロー

### 5-1. クロスユーザーアクション実行

```mermaid
graph LR
    subgraph "User1環境"
        Pos1[Position A<br/>トレール監視中]
        HS1[Hedge System 1]
        Act1[triggerActionIds:<br/>[act-001]]
    end

    subgraph "User2環境"
        Act2[Action(act-001)<br/>type: ENTRY<br/>status: PENDING]
        Pos2[Position B<br/>status: PENDING]
        HS2[Hedge System 2]
    end

    subgraph "AWS Cloud"
        API[AppSync]
        DB[(DynamoDB)]
        Sub[Subscription]
    end

    Pos1 -->|監視| HS1
    HS1 -->|条件成立| Act1
    Act1 -->|更新| API
    API --> DB
    DB --> Sub
    Sub -->|通知| HS2
    HS2 -->|userId確認| Act2
    Act2 -->|実行| Pos2
    Pos2 -->|PENDING→OPEN| API
```

### 5-2. アクションチェーン実行

アクションの連鎖的な実行パターン：

- **初期トリガー**: ロスカットやトレール条件成立
- **連鎖実行**: triggerActionIdsに基づく自動実行
- **実行順序**: タイムスタンプによる順序保証
- **結果追跡**: 各アクションの成功/失敗を記録

## 6. リアルタイム同期メカニズム

### 6-1. GraphQL Subscription フロー

```mermaid
sequenceDiagram
    participant Client as クライアント
    participant AppSync as AWS AppSync
    participant Resolver as Lambda Resolver
    participant DDB as DynamoDB
    participant Stream as DDB Streams

    Note over Client,Stream: Subscription確立
    Client->>AppSync: subscription onUpdatePosition($userId)
    AppSync->>Client: WebSocket接続確立

    Note over Client,Stream: データ更新フロー
    Client->>AppSync: mutation updatePosition
    AppSync->>Resolver: リゾルバー実行
    Resolver->>DDB: UpdateItem
    DDB->>Stream: 変更イベント
    Stream->>AppSync: イベント通知

    Note over Client,Stream: フィルタリング配信
    AppSync->>AppSync: userId判定
    AppSync->>Client: 該当ユーザーのみ通知
    Client->>Client: UIリアルタイム更新
```

### 6-2. データ同期優先度マトリクス

```mermaid
graph TD
    subgraph "優先度: 最高（即時）"
        S1[ポジションステータス変更]
        S2[アクション実行状態]
        S3[ロスカット通知]
    end

    subgraph "優先度: 高（1秒以内）"
        H1[トレール条件成立]
        H2[約定通知]
        H3[エラー通知]
    end

    subgraph "優先度: 中（30秒）"
        M1[口座残高更新]
        M2[証拠金情報]
        M3[統計情報]
    end

    subgraph "優先度: 低（5分）"
        L1[ログデータ]
        L2[分析データ]
        L3[レポート]
    end
```

### 6-3. オプティミスティック更新

楽観的UI更新パターンにより、ユーザー体験を向上：

1. **即座にUIを更新** - ユーザー操作に対して即座に反応
2. **バックグラウンドでAPI実行** - 実際のデータ更新を非同期で実行
3. **結果に応じて調整** - 成功時は確定、失敗時はロールバック

## 7. バッチ処理フロー

### 7-1. 定期バッチ処理

```mermaid
graph TB
    subgraph "30秒バッチ"
        Timer1[タイマー起動] --> Accounts[口座情報収集]
        Accounts --> Balance[残高計算]
        Balance --> Credit[クレジット計算]
        Credit --> Batch1[バッチ更新]
        Batch1 --> API1[AppSync更新]
    end

    subgraph "5分バッチ"
        Timer2[タイマー起動] --> Stats[統計収集]
        Stats --> Aggregate[集計処理]
        Aggregate --> Report[レポート生成]
        Report --> S3[S3保存]
    end

    subgraph "日次バッチ"
        Timer3[タイマー起動] --> Archive[アーカイブ]
        Archive --> Clean[データクリーン]
        Clean --> Backup[バックアップ]
    end
```

## 8. エラー処理とリカバリーフロー

### 8-1. エラー伝播フロー

```mermaid
graph TB
    subgraph "エラー発生源"
        E1[MT4/5通信エラー]
        E2[API呼び出しエラー]
        E3[権限エラー]
        E4[データ不整合]
    end

    subgraph "エラーハンドリング"
        Handler[エラーハンドラー]
        Classify[エラー分類]
        Retry[リトライ判定]
        Fallback[フォールバック]
    end

    subgraph "リカバリーアクション"
        R1[自動リトライ]
        R2[手動介入要求]
        R3[データロールバック]
        R4[アラート通知]
    end

    E1 & E2 & E3 & E4 --> Handler
    Handler --> Classify
    Classify --> Retry
    Retry -->|可能| R1
    Retry -->|不可| Fallback
    Fallback --> R2 & R3 & R4
```

## 9. パフォーマンス最適化

### 9-1. データキャッシング戦略

```mermaid
graph LR
    subgraph "キャッシュレイヤー"
        L1[メモリキャッシュ<br/>10秒TTL]
        L2[Redis<br/>60秒TTL]
        L3[DynamoDB<br/>永続化]
    end

    subgraph "読み取りパス"
        Read[読み取り要求] --> L1
        L1 -->|Miss| L2
        L2 -->|Miss| L3
        L3 --> Fill[キャッシュ充填]
        Fill --> L2
        Fill --> L1
    end

    subgraph "書き込みパス"
        Write[書き込み要求] --> L3
        L3 --> Invalidate[キャッシュ無効化]
        Invalidate --> L1
        Invalidate --> L2
    end
```

## 10. まとめ

本データフロー設計により、以下を実現します：

1. **高パフォーマンス**: 効率的なデータアクセスパターンとキャッシング戦略
2. **リアルタイム性**: GraphQL SubscriptionとWebSocketによる即時更新
3. **信頼性**: エラーハンドリングとリカバリーメカニズム
4. **スケーラビリティ**: 非同期処理とバッチ処理による負荷分散

この設計により、複数ユーザー間での協調動作を含む、複雑なトレーディングシステムのデータフローを効率的に管理できます。
