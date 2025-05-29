# GitHub Secrets設定手順

Tauri アプリの自動署名とリリースに必要な機密情報をGitHub Secretsに設定します。

## 必要なSecrets

GitHubリポジトリの `Settings` > `Secrets and variables` > `Actions` で以下を設定：

### 1. TAURI_SIGNING_PRIVATE_KEY

**説明**: アプリ更新用の署名に使用する秘密鍵（Base64エンコード）

**設定値**: 
```bash
# ローカルで秘密鍵をBase64エンコード
cat apps/hedge-system/.tauri/hedge-system.key | base64 | tr -d '\n'
```

出力された文字列（改行なしの1行）をGitHub Secretsに設定


## 設定手順

1. GitHubリポジトリページで `Settings` タブをクリック
2. 左サイドバーの `Secrets and variables` > `Actions` をクリック  
3. `New repository secret` ボタンをクリック
4. 以下のSecretを追加：
   - **Name**: `TAURI_SIGNING_PRIVATE_KEY`
   - **Value**: Base64エンコードした秘密鍵（上記コマンドの出力）

## リリース実行

GitHub Secretsが設定されたら、以下のコマンドでリリースを実行：

```bash
# バージョンを更新（必要に応じて）
cd apps/hedge-system
npm version patch  # または minor, major

# Gitタグを作成してプッシュ
git tag hedge-system-v0.1.1
git push origin hedge-system-v0.1.1
```

GitHub Actionsが自動実行され、macOS（Universal）、Windowsの各バイナリが生成されます。

## 生成される配布ファイル

- **macOS**: `.dmg` (インストーラー), `.app.tar.gz` (更新用)
- **Windows**: `.msi` (インストーラー), `.exe`, `.zip` (更新用)

## トラブルシューティング

### Tauri リリース関連
- GitHub Actionsが失敗する場合、Secretsの設定内容を確認
- 秘密鍵にスペースや改行が含まれているか確認
- パスワードが正確に設定されているか確認
