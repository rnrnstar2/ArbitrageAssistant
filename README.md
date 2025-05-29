# ArbitrageAssistant

アービトラージ取引ツールを含むモノレポジトリ。管理用Webアプリケーションとヘッジシステムデスクトップアプリケーションを含みます。

## 概要

ArbitrageAssistantは、最新のWeb技術で構築された包括的な取引アシスタントプラットフォームです。以下のコンポーネントで構成されています：

- **Admin App**: Web ベースの管理インターフェース
- **Hedge System**: ヘッジ取引業務用の Tauri デスクトップアプリケーション

## 技術スタック

- **フロントエンド**: React 19、Next.js 15.3.2、TypeScript
- **デスクトップ**: Tauri (Rust + Next.js)
- **バックエンド**: AWS Amplify Gen2
- **UI**: Radix UI、shadcn/ui、Tailwind CSS
- **ビルド**: Turborepo、npm workspaces

## 前提条件

- Node.js >= 20
- npm >= 9.8.0
- Rust（Tauriデスクトップアプリ開発用）

## macOSユーザーへの重要な注意事項

現在、Hedge SystemのmacOS版は開発者証明書で署名されていないため、初回起動時に「壊れている」というエラーが表示される場合があります。

**解決方法：**

### 最も簡単な方法: ターミナルコマンド
```bash
xattr -cr /Applications/Hedge\ System.app
```
※このコマンドで検疫属性が削除され、アプリが正常に起動します

### その他の方法: 右クリックで開く
1. Finderでアプリを右クリック
2. 「開く」を選択

詳細は[macOS署名設定ガイド](docs/MACOS_SIGNING_SETUP.md)を参照してください。

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/yourusername/ArbitrageAssistant.git
cd ArbitrageAssistant

# 依存関係をインストール
npm install
```

## 開発

### すべてのアプリケーションを起動
```bash
npm run dev
```

### 特定のアプリを実行
```bash
# Admin Webアプリ
cd apps/admin
npm run dev

# ヘッジシステムデスクトップアプリ
cd apps/hedge-system
npm run tauri:dev
```

## ビルド

### すべてのパッケージとアプリをビルド
```bash
npm run build
```

### 特定のアプリをビルド
```bash
# Admin Webアプリ
cd apps/admin
npm run build

# ヘッジシステムデスクトップアプリ
cd apps/hedge-system
npm run tauri:build
```

## プロジェクト構造

```
ArbitrageAssistant/
├── apps/
│   ├── admin/          # Webベース管理インターフェース
│   └── hedge-system/   # Tauriデスクトップアプリケーション
├── packages/
│   └── shared-backend/ # AWS Amplifyバックエンド
├── scripts/            # ビルド・テストスクリプト
└── turbo.json         # Turborepo設定
```

## 利用可能なスクリプト

- `npm run dev` - すべてのアプリを開発モードで起動
- `npm run build` - すべてのアプリとパッケージをビルド
- `npm run lint` - すべてのコードをリント
- `npm run format` - Prettierでコードをフォーマット

## リリースプロセス

ヘッジシステムの新しいリリースを作成するには：

```bash
# リリースタグを作成してプッシュ
git tag hedge-system-v0.1.1
git push origin hedge-system-v0.1.1
```

これにより、GitHub Actionsワークフローがトリガーされ、ビルドとリリースが作成されます。

## コントリビューション

1. リポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add some amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

このプロジェクトは独占的ソフトウェアです。すべての権利を保有しています。

## サポート

問題や機能リクエストについては、GitHubのイシュートラッカーをご利用ください。