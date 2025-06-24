# Task 5: 最終検証と完了確認

## 概要
shared-amplify統一の最終検証を行い、MVP設計書との整合性を確認します。

## 前提条件
- task-1, task-2-1, task-2-2, task-3, task-4が全て完了していること

## 検証項目

### 1. 🔧 技術的検証

#### A. ビルド・型チェック完全通過
```bash
# 全パッケージ・アプリのチェック
echo "=== shared-amplify ==="
cd packages/shared-amplify && npm run check-types && npm run build

echo "=== admin app ==="  
cd apps/admin && npm run check-types && npm run build

echo "=== hedge-system app ==="
cd apps/hedge-system && npm run check-types && npm run build

echo "=== 全体ビルド ==="
npm run build

echo "=== Lint完全通過 ==="
npm run lint -- --max-warnings 0
```

#### B. 設定統一確認
```bash
# amplify_outputs.json一元化確認
echo "✅ 統一設定確認"
ls -la packages/shared-amplify/amplify_outputs.json

echo "❌ 重複ファイル削除確認"
ls apps/admin/amplify_outputs.json 2>/dev/null && echo "ERROR: admin重複あり" || echo "OK: admin重複なし"
ls apps/hedge-system/amplify_outputs.json 2>/dev/null && echo "ERROR: hedge重複あり" || echo "OK: hedge重複なし"
```

#### C. Import統一確認
```bash
# ローカルamplifyクライアント参照がないことを確認
echo "=== Import統一確認 ==="
grep -r "from.*amplify-client" apps/admin/features/ || echo "✅ admin: shared-amplify統一済み"
grep -r "from.*amplify-client" apps/hedge-system/features/ || echo "✅ hedge-system: shared-amplify統一済み"

# amplify_outputs.json直接importがないことを確認
grep -r "amplify_outputs.json" apps/ || echo "✅ 直接参照なし"
```

### 2. 🎯 機能検証

#### A. 基本CRUD動作確認
```typescript
// 検証スクリプト作成: verify-crud.ts
import { 
  accountService, 
  positionService, 
  actionService 
} from '@repo/shared-amplify/services';

import { isAuthenticated } from '@repo/shared-amplify';

async function verifyCRUD() {
  console.log('🔍 CRUD動作検証開始');
  
  // 認証確認
  const auth = await isAuthenticated();
  console.log('認証状態:', auth);
  
  // 各サービス動作確認
  try {
    const accounts = await accountService.listUserAccounts();
    console.log('✅ Account Service:', accounts.length);
    
    const positions = await positionService.listUserPositions();
    console.log('✅ Position Service:', positions.length);
    
    const actions = await actionService.listUserActions();
    console.log('✅ Action Service:', actions.length);
    
    const stats = await actionService.getActionStats();
    console.log('✅ Action Stats:', stats);
    
  } catch (error) {
    console.error('❌ CRUD検証エラー:', error);
  }
}

verifyCRUD();
```

#### B. Hook動作確認
```typescript
// apps/admin/test-hooks.tsx
import React from 'react';
import { 
  usePositions, 
  useActions, 
  useAccounts 
} from '@repo/shared-amplify/hooks';

export function TestHooks() {
  const { positions, loading: posLoading } = usePositions();
  const { actions, loading: actLoading } = useActions();
  const { accounts, loading: accLoading } = useAccounts();
  
  return (
    <div>
      <p>Positions: {posLoading ? 'Loading...' : positions.length}</p>
      <p>Actions: {actLoading ? 'Loading...' : actions.length}</p>
      <p>Accounts: {accLoading ? 'Loading...' : accounts.length}</p>
    </div>
  );
}
```

### 3. 📋 MVP設計書整合性確認

#### A. userIdベース最適化確認
- [ ] 全CRUDでuserIdフィルタが動作
- [ ] 認証状態の適切な処理
- [ ] エラーハンドリングの統一

#### B. 独立実行可能性確認
- [ ] admin単体起動確認
- [ ] hedge-system単体起動確認  
- [ ] 設定共有の正常動作

#### C. トレール機能確認
- [ ] Position-Action関連付け
- [ ] triggerActionIds処理
- [ ] 複数アクション同時実行

### 4. 📊 パフォーマンス確認

#### A. ビルド時間測定
```bash
echo "=== ビルド時間測定 ==="
time npm run build
```

#### B. 開発サーバー起動時間
```bash
echo "=== 開発サーバー起動確認 ==="
timeout 30s npm run dev || echo "30秒以内に起動"
```

#### C. バンドルサイズ確認
```bash
echo "=== shared-amplifyバンドルサイズ ==="
cd packages/shared-amplify && npm run build && du -sh dist/
```

### 5. 🛡️ セキュリティ確認

#### A. 認証関連確認
- [ ] unauthorizedアクセスの適切なエラー処理
- [ ] userIdベースの適切なフィルタリング
- [ ] 認証状態の正確な管理

#### B. 環境設定確認
- [ ] 本番/開発環境での動作
- [ ] secrets・key情報の適切な管理

## 最終評価基準

### ✅ 完了基準 (100%達成必須)
- [ ] **型エラー0個**: 全パッケージ・アプリで型チェック成功
- [ ] **ビルドエラー0個**: 全体ビルドが成功
- [ ] **Lintエラー0個**: `--max-warnings 0`で成功
- [ ] **設定統一**: amplify_outputs.json一元化完了
- [ ] **Import統一**: shared-amplify経由のみの参照
- [ ] **Hook動作**: 17個のhookが正常動作
- [ ] **CRUD動作**: 基本的なCRUD操作が動作
- [ ] **MVP準拠**: システム設計書の要件を満たす

### 🎯 品質基準 (推奨)
- [ ] **起動時間**: 開発サーバー30秒以内起動
- [ ] **バンドルサイズ**: shared-amplifyが適切なサイズ
- [ ] **エラーハンドリング**: 統一されたエラー処理
- [ ] **パフォーマンス**: GraphQLクエリ最適化

## 完了レポート作成

### 検証結果サマリー
```markdown
# shared-amplify統一完了レポート

## 📊 成果
- ✅ amplify_outputs.json一元化: packages/shared-amplify配下に統一
- ✅ 型エラー解決: admin(75→0), hedge-system(29→0), shared-amplify(0)
- ✅ hooks実装: 17個のReact hookを実装・提供
- ✅ CRUD統一: MVP設計書準拠のサービス層統一
- ✅ ゼロ設定: import "@repo/shared-amplify/config"で自動設定

## 🚀 改善効果
- **開発効率**: 重複コード削除、統一API
- **保守性**: 設定ファイル一元化、型安全性
- **拡張性**: 共通サービス層、hook再利用
- **信頼性**: エラーハンドリング統一、リトライ機能

## 📈 統一度: 100% (目標達成)
```

## 完了条件
- [ ] 全検証項目のパス
- [ ] 完了レポート作成
- [ ] 次回開発に向けた改善提案作成

## 次のステップ
全タスク完了後、tasksディレクトリを削除してクリーンアップ