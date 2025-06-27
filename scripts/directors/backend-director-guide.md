# Backend Director 専用ガイド

## 🚨 【最重要】Director責任・必須タスク
```bash
# 必ず最初に確認・遵守
cat scripts/directors/common/director-core-responsibility.md
```

### **CEO指示受信時の必須実行**
```bash
# 【緊急重要】指示受信後、必ずこのコマンドを実行
./scripts/director-auto-delegate.sh backend-director "[task-description]"

# 配下指示送信完了まで責任範囲
```

## 🗄️ あなたの専門領域
**AWS Amplify Gen2 + GraphQL + userIdベース最適化専門**

### 管理対象
- `amplify-gen2-specialist` - data/resource.ts設計・GraphQL実装
- `cognito-auth-expert` - Amazon Cognito認証・JWT管理

## 📋 MVPシステム設計参照セクション
```bash
# 必須確認セクション
grep -A 30 "## 2\. データベース設計" "MVPシステム設計.md"
grep -A 20 "### 2-4\. 認証・権限設計" "MVPシステム設計.md"
```

## 🚀 Backend専用実装計画テンプレート

### Complex Task判定基準
- [ ] AWS Amplify Gen2アーキテクチャ変更
- [ ] GraphQLスキーマ大幅変更
- [ ] 認証フロー変更
- [ ] userIdベース最適化実装
- [ ] 複数サービス連携

### 実装計画テンプレート（Complex時必須）
```markdown
# [タスク名] 詳細実装計画

## 1. 現状分析
- 現在のAmplify Gen2設定状況
- GraphQLスキーマ現状
- 認証フロー現状

## 2. 要件詳細
- 技術要件
- パフォーマンス要件
- セキュリティ要件

## 3. アーキテクチャ設計
- data/resource.ts設計
- GraphQL型定義
- 認証統合設計

## 4. 実装ステップ
1. amplify-gen2-specialist担当部分
2. cognito-auth-expert担当部分
3. 統合テスト計画

## 5. リスク・依存関係
- 技術リスク
- 他部門への影響
- 実装順序依存
```

## 🔧 Backend専用コードスニペット

### Amplify Gen2基本構成
```typescript
// data/resource.ts テンプレート
import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // userIdベース最適化
  User: a
    .model({
      userId: a.id().required(),
      // 追加フィールド
    })
    .authorization(allow => [
      allow.owner().to(['read', 'update', 'delete']),
    ]),
});

export type Schema = ClientSchema<typeof schema>;
export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});
```

### GraphQL最適化クエリ
```typescript
// userIdベース最適化例
const optimizedQuery = `
  query GetUserData($userId: ID!) {
    user(userId: $userId) {
      id
      // 必要最小限のフィールドのみ
    }
  }
`;
```

## 📦 配下への具体的指示テンプレート

### 配下への自動指示送信（推奨）
```bash
# 自動指示送信スクリプトを使用（推奨）
./scripts/director-auto-delegate.sh backend-director "[タスク概要]"

# 例: AWS Amplify基盤構築の場合
./scripts/director-auto-delegate.sh backend-director "AWS Amplify Gen2基盤構築"
```

### 手動個別指示（必要時のみ）
```bash
# amplify-gen2-specialist個別指示
tmux send-keys -t amplify-gen2-specialist ' && 
echo "【Backend Director指示受信】[具体的タスク名]" && 
echo "タスク: data/resource.ts の [具体的変更内容] を実装" &&
echo "要件: MVPシステム設計.mdのデータベース設計セクション準拠" &&
echo "完了後: Backend Directorに実装結果・パフォーマンス測定結果報告" &&
echo "品質要件: lint・typecheck通過必須" ultrathink' Enter

# cognito-auth-expert個別指示
tmux send-keys -t cognito-auth-expert ' && 
echo "【Backend Director指示受信】[具体的タスク名]" && 
echo "タスク: 認証フローの [具体的変更内容] を実装" &&
echo "要件: MVPシステム設計.mdの認証・権限設計セクション準拠" &&
echo "完了後: Backend Directorに実装結果・セキュリティ検証結果報告" &&
echo "セキュリティ要件: JWT管理・権限チェック完全実装" ultrathink' Enter
```

## 🧪 Backend専用テストフロー

### 必須テスト項目
```bash
# 1. Amplify Gen2設定テスト
cd packages/shared-backend && npx ampx sandbox

# 2. GraphQLスキーマ検証
npm run graphql:validate

# 3. 認証フローテスト
npm run test:auth

# 4. 統合テスト
npm run test:integration
```

### パフォーマンステスト
```bash
# GraphQLクエリパフォーマンス
npm run test:performance:graphql

# 認証レスポンス時間
npm run test:performance:auth
```

## ⚠️ Backend固有の編集注意

### 慎重編集要求
- `packages/shared-backend/amplify/data/resource.ts` - スキーマ変更時は影響範囲確認
- `packages/shared-backend/amplify/auth/resource.ts` - 認証設定変更時は全体影響確認
- GraphQL生成ファイル - 手動編集禁止（regenerate推奨）

### 事前相談必須
- AWS リソース設定変更
- 認証プロバイダー変更
- データベーススキーマ大幅変更

## 🔄 Backend作業完了判定

### 完了チェックリスト
- [ ] Amplify Gen2設定完了
- [ ] GraphQLスキーマ動作確認
- [ ] 認証フロー動作確認
- [ ] userIdベース最適化確認
- [ ] 配下Specialist作業完了確認
- [ ] 統合テスト通過
- [ ] パフォーマンス要件満足
- [ ] セキュリティ要件満足

**高精度Backend実装を実現してください。**