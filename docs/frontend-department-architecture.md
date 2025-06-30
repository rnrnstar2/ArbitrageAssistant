# Frontend部門設計書（コンパクト版）

## 1. アプリ構成

### Tauri Hedge System（デスクトップ）
- apps/hedge-system：Position-Trail-Action専用UI
- デスクトップネイティブ：Tauri v2 + Rust backend
- パフォーマンス目標：<16ms描画、<100ms更新

### Next.js Admin（Web管理画面）
- apps/admin：Account/Position管理UI
- Web管理画面：ブラウザアクセス
- パフォーマンス目標：<2s読み込み、<100ms操作応答

### 共通目標
- レスポンシブUI、リアルタイム同期、エラーハンドリング

## 2. 技術スタック

### フロントエンド共通
- Next.js 15.3.2 + React 19
- TypeScript 5.5.4（strict mode）
- Tailwind CSS v4

### UI・スタイリング
- shadcn/ui（**編集禁止**・標準版信頼使用）
- Tailwind v4設定：apps/*/tailwind.config.ts
- レスポンシブ：mobile-first design

### GraphQL・WebSocket統合
- GraphQL Client：AWS Amplify Client
- Subscription：リアルタイム状態更新
- WebSocket：MT5 EA直接通信（Hedge Systemのみ）
- Authentication：AWS Cognito統合

### 開発・品質
- ESLint --max-warnings 0（ゼロ警告ポリシー）
- Testing：Vitest + React Testing Library
- Build：Turborepo monorepo

## 3. 主要機能

### Position-Trail-Action UI
- Position表示：ID、Symbol、Volume、Entry Price
- Trail状態：Active/Inactive、StopLoss動的表示
- Action実行：Start/Stop/Close buttons

### リアルタイム状態更新（<100ms）
- GraphQL Subscription：Position/Trail状態変更
- WebSocket：MT5価格・実行状況（Hedge Systemのみ）
- UI自動更新：状態変更時instant refresh

### WebSocket通信処理
- Tauri：Rust WebSocket server（MT5 EA ⟷ System）
- Admin：GraphQL Subscription（AWS AppSync ⟷ Browser）
- Error handling：接続断、再接続自動処理

### 管理画面機能
- Account管理：追加・編集・削除
- Position一覧：ソート・フィルタ・検索
- SystemStatus：接続状況・動作確認

## 4. 部門間連携

### Backend連携
- GraphQL Subscription受信：Position/Trail/Action状態
- Mutation送信：Create/Update/Delete操作
- Authentication：Cognito token管理

### Integration連携
- WebSocketクライアント（Hedge System）：MT5 EA価格受信
- WebSocket状態管理：Connection/Error handling

### Core連携
- 状態管理：Position-Trail-Action lifecycle
- UI更新トリガー：Core状態変更 → Frontend描画更新

## 5. 開発コマンド

```bash
# Hedge System開発
cd apps/hedge-system && npm run tauri:dev

# Admin開発  
cd apps/admin && npm run dev --turbopack

# 型チェック
npm run check-types

# 品質チェック（コミット前必須）
npm run lint
```