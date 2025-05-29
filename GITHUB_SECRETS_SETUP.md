# GitHub Secrets設定手順

Tauri アプリの自動署名とリリース、Claude Code GitHub Actionsに必要な機密情報をGitHub Secretsに設定します。

## 必要なSecrets

GitHubリポジトリの `Settings` > `Secrets and variables` > `Actions` で以下を設定：

### 1. TAURI_SIGNING_PRIVATE_KEY

**説明**: アプリ更新用の署名に使用する秘密鍵

**設定値**: 
```bash
# ローカルで秘密鍵の内容を取得
cat apps/hedge-system/.tauri/hedge-system.key
```

取得した内容全体（コメント行含む）をコピーしてGitHub Secretsに設定

### 2. TAURI_SIGNING_PRIVATE_KEY_PASSWORD

**説明**: 秘密鍵のパスワード

**設定値**: `hedge-system-key`

### 3. CLAUDE_GITHUB_TOKEN

**説明**: GitHub APIアクセス用のPersonal Access Token

**設定方法**:
1. GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Generate new token (classic) で以下の権限を付与：
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)
3. 生成されたトークンをコピーして設定

### 4. CLAUDE_ACCESS_TOKEN

**説明**: Claude Max OAuthアクセストークン

**取得方法**:
```bash
# Claude OAuth トークン抽出スクリプトを実行
node scripts/extract-claude-oauth-tokens.js
```

### 5. CLAUDE_REFRESH_TOKEN  

**説明**: Claude Max OAuthリフレッシュトークン

**取得方法**: 上記スクリプトで同時に表示される

### 6. CLAUDE_EXPIRES_AT

**説明**: Claude Max OAuthトークンの有効期限

**取得方法**: 上記スクリプトで同時に表示される

## 設定手順

1. GitHubリポジトリページで `Settings` タブをクリック
2. 左サイドバーの `Secrets and variables` > `Actions` をクリック  
3. `New repository secret` ボタンをクリック
4. 各Secretを順番に追加

### Claude Code用のOAuthトークン取得

```bash
# 1. Claude Code CLIをインストール（未インストールの場合）
npm install -g @anthropic-ai/claude-code

# 2. Claude Maxアカウントでログイン
claude login

# 3. OAuthトークンを抽出
node scripts/extract-claude-oauth-tokens.js
```

### 全Secretsの追加

- `TAURI_SIGNING_PRIVATE_KEY`: 秘密鍵ファイルの内容
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: `hedge-system-key`
- `CLAUDE_GITHUB_TOKEN`: GitHub Personal Access Token
- `CLAUDE_ACCESS_TOKEN`: 抽出したアクセストークン
- `CLAUDE_REFRESH_TOKEN`: 抽出したリフレッシュトークン
- `CLAUDE_EXPIRES_AT`: 抽出した有効期限

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

## Claude Code GitHub Actions の使い方

### トリガー方法

Issue、PR、コメントで `@claude` をメンションすると Claude Code が起動します：

```markdown
@claude このバグを修正してください
```

### 制限事項

- **Claude Maxプラン専用**: 個人のClaude Maxサブスクリプションが必要
- **プライベートリポジトリ推奨**: 公開リポジトリでの使用は避ける
- **会話ターン制限**: 20ターンまでに制限（過度な使用を防ぐため）
- **非公式サポート**: Anthropic公式のサポート対象外

### セキュリティ注意事項

1. **OAuthトークンは定期的に更新が必要**
   - トークンの有効期限が切れたら再度抽出して更新
   
2. **個人使用限定**
   - Claude Maxは個人プランのため、チームでの共有は避ける
   
3. **責任ある使用**
   - 過度な使用はアカウント停止の可能性あり

## トラブルシューティング

### Tauri リリース関連
- GitHub Actionsが失敗する場合、Secretsの設定内容を確認
- 秘密鍵にスペースや改行が含まれているか確認
- パスワードが正確に設定されているか確認

### Claude Code 関連
- `Authentication failed`エラー: OAuthトークンを再取得
- `Rate limit exceeded`エラー: 使用頻度を下げる
- アクションが起動しない: `@claude`メンションが含まれているか確認