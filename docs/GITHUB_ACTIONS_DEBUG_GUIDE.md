# GitHub Actions デバッグガイド

## ghコマンドを使ったデバッグアクションプラン

### 1. ワークフローの実行状況確認
```bash
# 最新のワークフロー実行一覧を表示
gh run list

# 特定のワークフローの実行一覧
gh run list --workflow=<workflow-name>

# 失敗したワークフローのみ表示
gh run list --status=failure
```

### 2. 実行の詳細確認
```bash
# 特定の実行IDの詳細を表示
gh run view <run-id>

# 実行のジョブ一覧を表示
gh run view <run-id> --job=<job-id>

# Webブラウザで開く
gh run view <run-id> --web
```

### 3. ログの確認
```bash
# 実行のログを表示
gh run view <run-id> --log

# 失敗したステップのログのみ表示
gh run view <run-id> --log-failed

# 特定のジョブのログを表示
gh run view <run-id> --job=<job-id> --log
```

### 4. ワークフローの再実行
```bash
# 失敗したジョブのみ再実行
gh run rerun <run-id> --failed

# 全てのジョブを再実行
gh run rerun <run-id>

# デバッグモードで再実行
gh run rerun <run-id> --debug
```

### 5. アーティファクトの確認
```bash
# アーティファクト一覧を表示
gh run download <run-id> --dry-run

# 特定のアーティファクトをダウンロード
gh run download <run-id> --name=<artifact-name>

# 全てのアーティファクトをダウンロード
gh run download <run-id>
```

### 6. ワークフローのキャンセル
```bash
# 実行中のワークフローをキャンセル
gh run cancel <run-id>
```

### 7. 実用的なデバッグフロー
```bash
# 1. 最新の失敗を確認
gh run list --status=failure --limit=5

# 2. 失敗の詳細を確認
gh run view <run-id> --log-failed

# 3. 必要に応じて全ログを確認
gh run view <run-id> --log > workflow.log

# 4. 問題を修正後、失敗したジョブのみ再実行
gh run rerun <run-id> --failed
```

### 8. よくあるデバッグシナリオ

#### シークレット関連のエラー
```bash
# リポジトリのシークレット一覧を確認
gh secret list

# シークレットの設定
gh secret set <SECRET_NAME>
```

#### 権限関連のエラー
```bash
# ワークフローの権限を確認
gh api repos/{owner}/{repo}/actions/permissions
```

#### 依存関係のエラー
```bash
# キャッシュの確認
gh api repos/{owner}/{repo}/actions/caches
```

### 9. ローカルでのテスト（act使用時の補完）
```bash
# actでの実行前にGitHub側の設定を確認
gh workflow view <workflow-name>

# 実際のGitHub Actionsの環境変数を確認
gh run view <run-id> --json jobs --jq '.jobs[].steps[].env'
```

### 10. トラブルシューティングTips
- `--json`と`--jq`オプションを使って特定の情報を抽出
- `gh api`で直接GitHub APIを叩いて詳細情報を取得
- `gh run watch`で実行中のワークフローをリアルタイム監視