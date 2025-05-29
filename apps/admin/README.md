# Admin Web Application

ArbitrageAssistantプロジェクトの管理用Webアプリケーション。取引データの管理、ユーザー管理、システム設定などの機能を提供します。

## 概要

Admin Appは、アービトラージ取引の管理・監視を行うためのWebベースの管理インターフェースです。

## 技術スタック

- **フレームワーク**: Next.js 15.3.2 (App Router)
- **言語**: TypeScript
- **UI**: Radix UI + shadcn/ui components
- **スタイリング**: Tailwind CSS v4
- **共通ライブラリ**: @repo/ui (モノレポ内の共通UIパッケージ)

## 開発環境のセットアップ

### 前提条件

- Node.js >= 20
- npm >= 9.8.0

### 開発サーバーの起動

```bash
# プロジェクトルートから
npm run dev

# または、このディレクトリから直接
cd apps/admin
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開いて確認できます。

## 利用可能なコマンド

```bash
# 開発サーバー（Turbopack使用）
npm run dev

# プロダクションビルド
npm run build

# プロダクションサーバー起動
npm run start

# ESLintによるコード検証
npm run lint

# TypeScript型チェック
npm run check-types

# Vitestテスト実行
npm run test
npm run test:watch
npm run test:coverage
```

## プロジェクト構造

```
admin/
├── app/                # Next.js App Router
│   ├── layout.tsx     # ルートレイアウト
│   ├── page.tsx       # ホームページ
│   └── globals.css    # グローバルスタイル
├── public/            # 静的アセット
└── components.json    # shadcn/ui設定
```

## モノレポとの統合

- **共通UIコンポーネント**: `@repo/ui`パッケージを使用
- **共通設定**: ESLint、TypeScript、Tailwind設定を共有
- **ビルド管理**: Turborepoによる効率的なビルド

## 開発ガイドライン

- ESLintの警告ゼロポリシー（`--max-warnings 0`）
- TypeScript strict mode使用
- shadcn/uiコンポーネントを基準としたUI開発

## デプロイ

現在は開発段階のため、デプロイ設定は未実装です。本格運用時はVercelまたはAWS Amplifyでの配布を検討しています。
