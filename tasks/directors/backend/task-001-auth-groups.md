# Backend認証グループ統一修正

## 📋 タスク情報
- **作成者**: director-coordinator
- **担当者**: backend-director → cognito-auth-expert
- **優先度**: P1 (高優先)
- **状態**: created
- **作成日時**: 2025-06-27 12:00
- **期限**: 2025-06-28 18:00

## 🎯 指示内容

### 課題概要
**認証グループ名の大文字・小文字不整合によるデプロイメント問題**

### 技術的問題
```diff
// auth/resource.ts (現在)
- groups: ['admin', 'client'],

// post-confirmation/handler.ts (現在)
- GroupName: 'client',

// amplify_outputs.json (実際)
+ "groups": [{"ADMIN": {"precedence": 0}}, {"CLIENT": {"precedence": 1}}]
```

### 修正要件
1. **グループ名統一**: 'ADMIN', 'CLIENT' に大文字統一
2. **post-confirmation修正**: デフォルトグループ設定の修正
3. **パスワードポリシー修正**: 設定と実際の統一

### 技術実装
```typescript
// packages/shared-backend/amplify/auth/resource.ts
groups: ['ADMIN', 'CLIENT'],

// packages/shared-backend/amplify/auth/post-confirmation/handler.ts
GroupName: 'CLIENT',

// パスワードポリシー統一
RequireUppercase: true,
RequireSymbols: true,
```

### 完了条件
- [ ] グループ名統一 (ADMIN, CLIENT)
- [ ] post-confirmation動作確認
- [ ] パスワードポリシー整合性確保
- [ ] デプロイテスト成功
- [ ] 認証フロー統合テスト成功

### 技術参考
- Backend Director調査レポート「認証グループ不整合」
- MVPシステム設計.md「2-4. 認証・権限設計」

### Frontend連携影響
Frontend型安全性問題解決後の統合テストで必要

## 📊 実行結果
### 実行者: 
### 実行開始日時: 
### 実行完了日時: 

### 実装内容
[認証設定修正の詳細]

### 成果物
- [ ] auth/resource.ts修正
- [ ] post-confirmation/handler.ts修正
- [ ] デプロイテスト確認

### パフォーマンス・品質確認
- [ ] Amplify deploy成功: 
- [ ] 認証フロー確認: 
- [ ] 統合テスト確認: 

## 🔄 進捗履歴
- 2025-06-27 12:00 **director-coordinator**: タスク作成・高優先指定

## 💬 コミュニケーションログ
### Director → Specialist
2025-06-27 12:00 - director-coordinator: 認証グループ不整合の修正を依頼。Frontend修正完了後に統合テスト実施予定。