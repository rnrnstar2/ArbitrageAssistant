# 【緊急】TypeScript型安全性問題解決

## 📋 タスク情報
- **作成者**: director-coordinator
- **担当者**: frontend-director → react-specialist
- **優先度**: P0 (最高優先)
- **状態**: created
- **作成日時**: 2025-06-27 12:00
- **期限**: 2025-06-27 18:00

## 🎯 指示内容

### 緊急課題
**admin: 11件, hedge-system: 14件の TypeScript エラーを即座に解決**

### 主要原因分析
1. **Amplify Gen2 API変更**: `allow.owner()` API不整合
2. **GraphQLスキーマ型定義**: amplify_outputs.json再生成必要
3. **型定義不整合**: shared-types パッケージとの不整合

### 技術要件
```bash
# 1. Amplify Gen2スキーマ再生成
cd packages/shared-backend
npx amplify generate graphql-client-code

# 2. 型チェック実行・エラー確認
cd apps/admin && npm run check-types
cd apps/hedge-system && npm run check-types

# 3. 段階的修正
# - allow.owner() → 正しいAmplify Gen2 API
# - GraphQL型定義の整合性確保
# - shared-types パッケージ更新
```

### 完了条件
- [ ] admin TypeScriptエラー: 11件 → 0件
- [ ] hedge-system TypeScriptエラー: 14件 → 0件
- [ ] `npm run check-types` 全てパス
- [ ] `npm run lint` 全てパス
- [ ] ビルド成功確認

### 技術参考
- MVPシステム設計.md「2-4. 認証・権限設計」
- packages/shared-backend/amplify/data/resource.ts
- Backend Director調査レポートの認証グループ不整合問題

### 影響度
**🚨 Critical**: 全システム統合テスト・本番デプロイがブロックされる

## 📊 実行結果
### 実行者: 
### 実行開始日時: 
### 実行完了日時: 

### 実装内容
[実装した修正内容の詳細]

### 成果物
- [ ] 修正ファイル一覧
- [ ] 型エラー解決確認
- [ ] テスト実行結果

### パフォーマンス・品質確認
- [ ] Lint通過: 
- [ ] 型チェック通過: 
- [ ] ビルド成功: 

## 🔄 進捗履歴
- 2025-06-27 12:00 **director-coordinator**: タスク作成・最優先指定

## 💬 コミュニケーションログ
### Director → Specialist
2025-06-27 12:00 - director-coordinator: Frontend型安全性問題の緊急解決を依頼。MVPリリースのクリティカルパスです。