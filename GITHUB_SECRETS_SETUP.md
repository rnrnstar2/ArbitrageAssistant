# GitHub Secrets設定手順

Tauri アプリの自動リリースに必要な機密情報をGitHub Secretsに設定します。

## 必要なSecrets

GitHubリポジトリの `Settings` > `Secrets and variables` > `Actions` で以下を設定：

### AWS認証情報（S3配布用）

- **AWS_ACCESS_KEY_ID**: AWS IAMユーザーのアクセスキーID
- **AWS_SECRET_ACCESS_KEY**: AWS IAMユーザーのシークレットアクセスキー

## 設定手順

1. GitHubリポジトリページで `Settings` タブをクリック
2. 左サイドバーの `Secrets and variables` > `Actions` をクリック  
3. `New repository secret` ボタンをクリック
4. 以下のSecretを追加：
   - **Name**: `AWS_ACCESS_KEY_ID`
   - **Value**: AWS IAMユーザーのアクセスキーID
   - **Name**: `AWS_SECRET_ACCESS_KEY`
   - **Value**: AWS IAMユーザーのシークレットアクセスキー

## リリース実行

GitHub Secretsが設定されたら、以下のコマンドでリリースを実行：

```bash
# 自動リリーススクリプトを使用（推奨）
npm run release:hedge-system
```

または手動実行：

```bash
# バージョンを更新（必要に応じて）
cd apps/hedge-system
npm version patch  # または minor, major

# Gitタグを作成してプッシュ
git tag hedge-system-v0.1.1
git push origin hedge-system-v0.1.1
```

GitHub Actionsが自動実行され、macOS（Intel/Apple Silicon）、Windowsの各バイナリが生成されます。

## 生成される配布ファイル

- **macOS**: `.dmg` (インストーラー), `.app.tar.gz` (更新用)
- **Windows**: `.msi` (インストーラー), `.exe`, `.zip` (更新用)

## 配布URL

- **S3バケット**: `amplify-arbitrageassistantreleases`
- **アップデーターエンドポイント**: `https://amplify-arbitrageassistantreleases.s3.ap-northeast-1.amazonaws.com/releases/hedge-system/latest.json`
- **バージョン別配布**: `https://amplify-arbitrageassistantreleases.s3.ap-northeast-1.amazonaws.com/releases/hedge-system/v{version}/`

## トラブルシューティング

### Tauri リリース関連
- GitHub Actionsが失敗する場合、Secretsの設定内容を確認
- AWS認証情報が正確に設定されているか確認
- S3バケットのアクセス権限を確認