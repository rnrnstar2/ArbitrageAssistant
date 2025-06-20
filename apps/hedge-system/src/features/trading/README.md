# リアルタイムポジション表示・更新機能

このモジュールは、AWS Amplify GraphQL APIとSubscriptionを使用してポジション情報のリアルタイム表示と自動更新機能を提供します。

## 実装されている機能

### 1. GraphQL Query & Subscription
- **ファイル**: `graphql/queries.ts`, `graphql/subscriptions.ts`
- ポジション一覧取得クエリ
- アカウント情報取得クエリ
- ポジション作成/更新/削除サブスクリプション
- アカウント更新サブスクリプション
- TypeScript型定義

### 2. リアルタイム更新フック
- **ファイル**: `hooks/useRealtimePositions.ts`
- GraphQL Subscriptionによるリアルタイム更新
- 接続状態監視
- 自動再接続機能
- エラーハンドリング

### 3. リアルタイム表示コンポーネント
- **ファイル**: `../monitoring/RealtimeActivePositions.tsx`
- ポジション一覧のリアルタイム表示
- フィルタリング・ソート機能
- 統計情報表示
- 接続状態インジケーター

### 4. 統合ダッシュボード
- **ファイル**: `TradingDashboard.tsx`
- リアルタイムポジション表示
- エントリーフォーム統合
- ポジション詳細表示

## 使用方法

### 基本的な使用方法

```tsx
import { RealtimeActivePositions } from '@/features/trading'

function MyTradingPage() {
  const handlePositionClick = (position) => {
    console.log('Selected position:', position)
  }

  return (
    <RealtimeActivePositions 
      onPositionClick={handlePositionClick}
      autoRefreshInterval={30000} // 30秒間隔で自動更新
    />
  )
}
```

### フックを直接使用する場合

```tsx
import { useRealtimePositions } from '@/features/trading'

function CustomPositionComponent() {
  const { positions, accounts, loading, error, connectionStatus } = useRealtimePositions()

  if (loading) return <div>Loading...</div>
  if (error) return <div>Error: {error}</div>

  return (
    <div>
      <div>Connection: {connectionStatus}</div>
      <div>Positions: {positions.length}</div>
      {positions.map(position => (
        <div key={position.id}>
          {position.symbol} - {position.profit}
        </div>
      ))}
    </div>
  )
}
```

### 完全なダッシュボード使用

```tsx
import { TradingDashboard } from '@/features/trading'

function TradingPage() {
  return (
    <div className="p-6">
      <TradingDashboard />
    </div>
  )
}
```

## データフロー

1. **初期データ取得**: `useRealtimePositions`フックがマウント時にGraphQLクエリでポジション・アカウントデータを取得
2. **サブスクリプション開始**: ポジション作成/更新/削除、アカウント更新のサブスクリプションを開始
3. **リアルタイム更新**: サーバーからの変更通知を受信してUIを自動更新
4. **エラー処理**: 接続エラー時は自動的に再接続を試行
5. **自動更新**: 設定された間隔で手動リフレッシュも実行

## 接続状態の管理

接続状態は以下の4つの状態を持ちます：

- `connecting`: 接続試行中
- `connected`: 正常に接続済み
- `error`: 接続エラー（5秒後に自動再試行）
- `disconnected`: 切断状態

## パフォーマンス最適化

- **重複排除**: 同じポジションの重複作成を防止
- **効率的な更新**: 変更されたアイテムのみを更新
- **メモ化**: 統計計算やフィルタリング結果をuseMemoでキャッシュ
- **サブスクリプションクリーンアップ**: コンポーネントアンマウント時の適切なクリーンアップ

## エラーハンドリング

- GraphQLエラーのキャッチと表示
- 接続エラー時の自動再試行
- ユーザーフレンドリーなエラーメッセージ
- デバッグ用のコンソールログ

## デモ・テスト

デモコンポーネントを使用して機能をテストできます：

```tsx
import { RealtimePositionsDemo } from '@/features/trading/demo/RealtimePositionsDemo'

function DemoPage() {
  return <RealtimePositionsDemo />
}
```

## 依存関係

- `aws-amplify`: GraphQL API & Subscription
- `@aws-amplify/api-graphql`: GraphQL型サポート
- `react`: フック、コンポーネント
- `@repo/ui`: UIコンポーネント

## 注意事項

1. **認証**: Amplifyの認証が正しく設定されている必要があります
2. **GraphQLスキーマ**: amplify_outputs.jsonで定義されたスキーマと一致している必要があります
3. **権限**: ユーザーがPositionとAccountモデルにアクセス権限を持っている必要があります
4. **ネットワーク**: WebSocket接続のためのネットワーク設定が必要です

## トラブルシューティング

### 接続エラーの場合
1. Amplify設定の確認
2. ユーザー認証状態の確認
3. GraphQLエンドポイントの確認
4. ネットワーク接続の確認

### データが表示されない場合
1. GraphQLスキーマの確認
2. データベースにテストデータが存在するか確認
3. フィルター条件の確認
4. ブラウザの開発者ツールでエラーログ確認