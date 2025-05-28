# Hedge System

アービトラージ取引のためのヘッジシステムデスクトップアプリケーション。

## 概要

Hedge SystemはTauriとNext.jsを使用して構築されたクロスプラットフォームデスクトップアプリケーションです。アービトラージ取引におけるヘッジ戦略の実行と管理を支援します。

## 技術スタック

- **フロントエンド**: Next.js 15.3.2、React 19、TypeScript
- **デスクトップフレームワーク**: Tauri 2.0 (Rust)
- **UI コンポーネント**: Radix UI、shadcn/ui
- **スタイリング**: Tailwind CSS
- **認証**: AWS Amplify Auth

## 機能

- 🔐 セキュアな認証システム
- 🖥️ ネイティブデスクトップアプリケーション
- 🌓 ダークモード対応
- 🔄 自動アップデート機能
- 📊 リアルタイム取引データ表示（開発中）

## 開発環境のセットアップ

### 前提条件

- Node.js >= 20
- npm >= 9.8.0
- Rust（最新の安定版）
- Tauri CLI

### インストール

```bash
# プロジェクトルートから
cd apps/hedge-system

# 依存関係をインストール
npm install
```

## 開発

### Webアプリとして開発
```bash
npm run dev
```
ブラウザで [http://localhost:3000](http://localhost:3000) を開いて確認できます。

### デスクトップアプリとして開発
```bash
npm run tauri:dev
```
Tauriがデスクトップウィンドウを起動し、ホットリロードが有効になります。

## ビルド

### プロダクションビルド（デスクトップアプリ）
```bash
npm run tauri:build
```

### リリースビルド（アップデーター付き）
```bash
npm run tauri:release
```

### Webアプリのみビルド
```bash
npm run build
```

## プロジェクト構造

```
hedge-system/
├── app/                    # Next.js App Router
│   ├── NavigationLayout.tsx # ナビゲーションレイアウト
│   ├── layout.tsx          # ルートレイアウト
│   └── page.tsx            # ホームページ
├── components/             # Reactコンポーネント
│   ├── auth/              # 認証関連コンポーネント
│   └── providers.tsx      # コンテキストプロバイダー
├── hooks/                 # カスタムフック
├── src-tauri/            # Tauri（Rust）バックエンド
│   ├── src/              # Rustソースコード
│   ├── icons/            # アプリアイコン
│   └── tauri.conf.json   # Tauri設定
└── public/               # 静的アセット
```

## 設定

### Tauri設定
`src-tauri/tauri.conf.json`でアプリの動作を設定：
- ウィンドウサイズ: 800x600（リサイズ可能）
- アップデーター: GitHub Releasesを使用
- セキュリティ: CSPとケーパビリティ設定

### 環境変数
必要に応じて`.env.local`ファイルを作成：
```env
# 開発環境用の設定
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## リリース

### バージョンアップ
```bash
npm version patch  # または minor, major
```

### GitHubリリース
```bash
git tag hedge-system-v0.1.1
git push origin hedge-system-v0.1.1
```
GitHub Actionsが自動的にビルドとリリースを作成します。

## トラブルシューティング

### Tauriビルドエラー
- Rustが最新バージョンであることを確認
- `cargo clean`を実行してキャッシュをクリア

### 認証エラー
- `amplify_outputs.json`が存在することを確認
- AWS Amplifyバックエンドが正しく設定されているか確認

## ライセンス

このプロジェクトは独占的ソフトウェアです。すべての権利を保有しています。