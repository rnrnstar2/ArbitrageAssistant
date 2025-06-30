# ArbitrageAssistant - 統合設計書（コンパクト版）

## 1. システム全体像（MVPシステム設計v7.0準拠）

### 5部門構成アーキテクチャ
- **Backend**: AWS Amplify Gen2・GraphQL・DynamoDB・userIdベース最適化
- **Frontend**: Tauri v2・Next.js 15・React 19・管理者/ユーザー画面
- **Integration**: MT5連携・WebSocket・リアルタイム通信・API統合
- **Core**: Position-Trail-Action（MVP核心）・状態遷移・実行ロジック
- **Quality**: テスト・品質保証・パフォーマンス・セキュリティ

### userIdベース最適化戦略
- 全データ・通信・処理がuserIdを基軸とした設計
- ユーザー特化パフォーマンス・カスタマイゼーション実現
- スケーラブル・セキュアなマルチユーザー対応

### Monorepo構成
```
apps/
├── admin/          # Web管理画面（Next.js）
└── hedge-system/   # デスクトップアプリ（Tauri）
packages/
├── shared-backend/ # AWS Amplify Gen2
├── ui/            # 共通コンポーネント
└── configs/       # 共通設定
```

## 2. 技術統合仕様

### GraphQL Schema統一
- **User管理**: `User`, `UserSettings`, `UserPermissions`
- **Position管理**: `Position`, `PositionTrail`, `PositionAction`
- **市場データ**: `MarketData`, `PriceAlert`, `ArbitrageOpportunity`
- **統一認証**: AWS Cognito・userIdベース権限管理

### WebSocket Protocol統一
- **接続管理**: userId単位接続・自動再接続・ハートビート
- **メッセージ形式**: `{type, userId, data, timestamp}`統一
- **トピック購読**: `market.${userId}`, `position.${userId}`, `alert.${userId}`

### パフォーマンス基準統一
- **レスポンス時間**: API <100ms, WebSocket <50ms
- **メモリ使用量**: フロントエンド <512MB, バックエンド <1GB
- **同期精度**: 価格データ <1秒, Position状態 <500ms

## 3. 部門間連携仕様

### データフロー設計
```
User Input → Frontend → GraphQL → Backend → DynamoDB
Market Data → Integration → WebSocket → Frontend → UI Update
Position Management → Core → Trail Logic → Action Execution
```

### 通信方式統一
- **同期**: GraphQL Queries/Mutations（認証・設定・履歴）
- **非同期**: WebSocket Subscriptions（市場データ・Position状態）
- **エラーハンドリング**: 統一エラー形式・自動リトライ・ユーザー通知

### 責任境界明確化
- **Backend**: データ永続化・認証・ビジネスロジック
- **Frontend**: UI・UX・状態管理・リアルタイム表示
- **Integration**: 外部API・プロトコル変換・データ正規化
- **Core**: アルゴリズム・計算・意思決定エンジン
- **Quality**: テスト自動化・品質メトリクス・監視

## 4. 開発・運用基準

### 基本コマンド
```bash
npm run dev                    # 全アプリ開発サーバー
npm run build                  # 全アプリビルド
npm run lint                   # ESLint --max-warnings 0
npm run test                   # 全テスト実行
npm run release:hedge [type]   # リリース自動化
```

### 品質基準（Zero Warnings Policy）
- **TypeScript**: strict mode・型安全性100%
- **ESLint**: --max-warnings 0・コード品質統一
- **テスト**: 重要機能100%カバレッジ・E2Eテスト
- **パフォーマンス**: Core Web Vitals準拠・レスポンス基準遵守

### CI/CD統一設定
- **自動テスト**: PRマージ前・品質ゲート・デプロイ前検証
- **自動デプロイ**: Staging→Production・ロールバック対応
- **監視・アラート**: パフォーマンス・エラー・セキュリティ統合監視

---

**前提条件**: Node.js >=20, npm >=9.8.0, Rust (Tauri用)
**技術スタック**: React 19, Next.js 15.3.2, Tauri v2, AWS Amplify Gen2, TypeScript 5.5.4