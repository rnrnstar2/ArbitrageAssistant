# GitHub Secrets設定手順

**⚠️ 重要**: このファイルは削除予定です。詳細な設定手順は `docs/AWS_SECRETS_SETUP.md` を参照してください。

## 移行先

**新しいドキュメント**: [`docs/AWS_SECRETS_SETUP.md`](docs/AWS_SECRETS_SETUP.md)

上記ファイルには以下の詳細情報が含まれています：
- AWS IAMユーザーの作成手順
- 必要な権限ポリシー
- GitHub Secretsの設定方法
- セキュリティのベストプラクティス
- トラブルシューティング

## クイックリファレンス

### 必要なGitHub Secrets

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

### リリース実行

```bash
# 🚨 重要: 必ずこのスクリプトを使用すること
npm run release:hedge
```

## 削除予定について

このファイルは `docs/AWS_SECRETS_SETUP.md` に統合されるため、近日中に削除される予定です。新しいドキュメントをブックマークしてください。