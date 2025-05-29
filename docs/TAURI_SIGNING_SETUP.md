# Tauri 署名設定ガイド

## 概要
Tauriアップデーター機能を使用するには、アプリケーションの署名が必要です。このドキュメントでは、署名用の鍵の生成とGitHub Actionsでの設定方法を説明します。

## 鍵の生成

1. ローカル環境で以下のコマンドを実行して鍵ペアを生成：
```bash
cd apps/hedge-system
npx @tauri-apps/cli signer generate -w ~/.tauri/hedge-system.key -p "your-secure-password" --ci -f
```

2. 生成されるファイル：
   - `~/.tauri/hedge-system.key` - 秘密鍵（絶対に公開しないこと）
   - `~/.tauri/hedge-system.key.pub` - 公開鍵

## tauri.conf.jsonの設定

公開鍵を`tauri.conf.json`の`plugins.updater.pubkey`に追加します：

```json
{
  "plugins": {
    "updater": {
      "endpoints": [
        "https://amplify-arbitrageassistantreleases.s3.ap-northeast-1.amazonaws.com/releases/hedge-system/latest.json"
      ],
      "pubkey": "YOUR_PUBLIC_KEY_CONTENT_HERE"
    }
  }
}
```

## GitHub Actionsの環境変数設定

### 必要な環境変数

1. **TAURI_SIGNING_PRIVATE_KEY**
   - 秘密鍵の内容（Base64エンコード済み）
   - 上記の例では: `dW50cnVzdGVkIGNvbW1lbnQ6IHJzaWduIGVuY3J5cHRlZCBzZWNyZXQga2V5...`

2. **TAURI_SIGNING_PRIVATE_KEY_PASSWORD**
   - 鍵生成時に設定したパスワード

### GitHub Secretsへの設定方法

1. GitHubリポジトリの Settings → Secrets and variables → Actions へ移動

2. "New repository secret" をクリック

3. 以下のシークレットを追加：
   - Name: `TAURI_SIGNING_PRIVATE_KEY`
   - Value: 秘密鍵ファイルの内容をそのまま貼り付け

4. もう一つシークレットを追加：
   - Name: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   - Value: 鍵生成時に設定したパスワード

### ワークフローでの使用

GitHub Actionsワークフローでは、これらの環境変数が自動的に使用されます：

```yaml
- name: Build Tauri app
  uses: tauri-apps/tauri-action@v0
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
```

## セキュリティ上の注意事項

- **秘密鍵は絶対に公開リポジトリにコミットしないこと**
- パスワードは十分に強力なものを使用すること
- GitHub Secretsは適切なアクセス権限を持つユーザーのみがアクセスできるように管理すること

## トラブルシューティング

### エラー: "missing field `pubkey`"
- `tauri.conf.json`に公開鍵が設定されていることを確認

### エラー: "failed to sign"
- GitHub Secretsに環境変数が正しく設定されていることを確認
- パスワードが正しいことを確認

### エラー: "invalid signature"
- 公開鍵と秘密鍵のペアが一致していることを確認
- アーティファクトが改ざんされていないことを確認