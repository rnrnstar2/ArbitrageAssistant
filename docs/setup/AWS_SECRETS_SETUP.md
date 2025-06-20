# AWS Secrets Setup for GitHub Actions

TauriアプリのS3自動配布のために、GitHub SecretsにAWS認証情報を設定する必要があります。

## 必要なGitHub Secrets

以下のSecretsをGitHubリポジトリに設定してください：

### AWS Access Keys
- `AWS_ACCESS_KEY_ID`: AWSアクセスキーID
- `AWS_SECRET_ACCESS_KEY`: AWSシークレットアクセスキー

## AWS IAMユーザーの作成と設定

### 1. IAMユーザーの作成
1. AWS Management Console > IAM > Users
2. 「ユーザーを追加」をクリック
3. ユーザー名: `github-actions-s3-uploader`
4. 「プログラムによるアクセス」を選択

### 2. 必要な権限ポリシー
以下のカスタムポリシーを作成し、ユーザーにアタッチしてください：

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject",
                "s3:PutObjectAcl",
                "s3:GetObject",
                "s3:DeleteObject"
            ],
            "Resource": [
                "arn:aws:s3:::amplify-arbitrageassistantreleases/*"
            ]
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": [
                "arn:aws:s3:::amplify-arbitrageassistantreleases"
            ]
        }
    ]
}
```

### 3. アクセスキーの生成
1. ユーザー作成後、「セキュリティ認証情報」タブ
2. 「アクセスキーを作成」をクリック
3. アクセスキーIDとシークレットアクセスキーをコピー

## GitHub Secretsの設定方法

### 1. GitHubリポジトリでの設定
1. GitHub リポジトリ > Settings > Secrets and variables > Actions
2. 「New repository secret」をクリック
3. 以下のSecretsを追加：

| Name | Value |
|------|-------|
| `AWS_ACCESS_KEY_ID` | IAMユーザーのアクセスキーID |
| `AWS_SECRET_ACCESS_KEY` | IAMユーザーのシークレットアクセスキー |

### 2. 設定の確認
設定完了後、以下で動作確認できます：
```bash
# 🚨 重要: 必ずこのスクリプトを使用すること
npm run release:hedge-system

# または特定のバージョンタイプを指定
npm run release:hedge-system patch  # バグ修正
npm run release:hedge-system minor  # 新機能
npm run release:hedge-system major  # 破壊的変更
```

**注意**: 手動でのタグ作成・プッシュは推奨されません。自動スクリプトが以下を実行します：
- バージョン更新
- package.jsonとtauri.conf.jsonの同期
- 変更のコミット
- リリースタグの作成とプッシュ
- GitHub Actionsによる自動ビルド・配布の開始

## セキュリティのベストプラクティス

### 1. 最小権限の原則
- 作成したIAMユーザーには、必要最小限の権限のみを付与
- 特定のS3バケットへのアクセスのみ許可

### 2. アクセスキーの管理
- アクセスキーは定期的にローテーション
- 不要になったアクセスキーは無効化・削除

### 3. 監査ログの確認
- CloudTrailでS3操作ログを定期的に確認
- 異常なアクセスがないかモニタリング

## トラブルシューティング

### エラー: AccessDenied
- IAMユーザーの権限を確認
- バケット名が正しいか確認
- リージョンが `ap-northeast-1` に設定されているか確認

### エラー: Bucket does not exist
- S3バケットが作成されているか確認
- `./scripts/setup-s3-bucket-policy.sh` を実行

### エラー: Invalid credentials
- GitHub SecretsのAWS認証情報を確認
- アクセスキーが有効か確認

## 参考リンク

- [AWS IAM ユーザーガイド](https://docs.aws.amazon.com/ja_jp/IAM/latest/UserGuide/)
- [GitHub Secrets 設定ガイド](https://docs.github.com/ja/actions/security-guides/encrypted-secrets)
- [AWS S3 権限設定](https://docs.aws.amazon.com/ja_jp/AmazonS3/latest/userguide/access-policy-language-overview.html)