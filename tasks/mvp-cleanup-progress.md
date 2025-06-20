# MVP過剰実装削除タスク - 進行状況

## 概要
Phase 1 MVP要件を超えた過剰実装を安全に削除し、最小限の機能に絞る。
MVPとして不必要な複雑性を排除し、開発・保守性を向上させる。

## 優先度：High - MVP完成の加速

## 実行済みタスク ✅

### ✅ バックアップ作成
- mvp-cleanup-backupブランチ作成済み
- 削除前状態をコミット済み

### ✅ プロジェクト構造確認
- 削除対象ディレクトリの存在確認完了
- 依存関係マッピング完了

### ✅ Task M-1: AI/ML機能全削除 
**削除対象：** 存在しないため削除不要
- `/packages/ml-engine/` - 存在せず
- `/apps/hedge-system/src/features/analysis/ml-*` - 存在せず
- `/apps/admin/features/analytics/ai-*` - 存在せず

### 🔄 Task M-2: 開発・デバッグツール削除（進行中）
**削除済み：**
- ✅ `/apps/hedge-system/components/debug/` - 5ファイル削除済み
- ✅ `/apps/hedge-system/src/dev-tools/` - 4ファイル削除済み

**修正中：**
- 🔄 system-diagnostics.ts - EASimulator依存削除中
- 🔄 debug-tools.ts - EASimulator依存削除予定

## 残りタスク

### Task M-3: 高度品質監視削除
**削除対象：**
- `/apps/hedge-system/lib/quality/` - 9ファイル
- `/apps/hedge-system/components/quality/` - 2ファイル
- `/apps/hedge-system/lib/performance/` - 4ファイル

### Task M-4: WebWorker・最適化機能削除
**削除対象：**
- `/apps/admin/lib/optimization/` - 5ファイル

### ~~Task M-5: 複雑ヘッジ機能の簡素化~~ ❌ **削除対象外**
**理由：** ヘッジ機能はArbitrageAssistantのコア機能のため保持
- `/apps/hedge-system/src/features/trading/hedge/` - **全機能保持**

### Task M-6: 詳細レポート機能削除
**削除対象：**
- `/apps/admin/features/analytics/` - 存在確認要

### Task M-7: 高度通知システム簡素化
**削除対象：**
- 複雑な通知機能（調査要）

### Task M-8: E2E・高度テスト削除
**削除対象：**
- E2Eテスト（存在確認要）
- パフォーマンステスト（調査要）

## 削除実行ガイドライン

### 安全削除手順
1. **依存関係確認**
   ```bash
   rg "import.*削除対象" apps/
   rg "from.*削除対象" apps/
   ```

2. **段階的削除**
   - 1つずつファイル削除
   - 都度ビルドテスト実行
   - エラー修正

3. **最終確認**
   ```bash
   npm run build
   npm run lint
   npm run test
   ```

## 期待効果

### コード量削減
- **削除予定：** 約5,000-7,000行
- **保持予定：** 約9,000-11,000行（MVP適正サイズ）

### 保守性向上
- 複雑性排除によるバグリスク減少
- 新規開発者の理解コスト削減
- テスト実行時間短縮

### 開発速度向上
- MVP完成まで2-3週間 → 1-2週間に短縮
- 残りタスクの複雑性減少

## ✅ 完了済みタスク全て完了
1. ✅ Task M-1: AI/ML機能全削除（該当ファイルなし）
2. ✅ Task M-2: 開発・デバッグツール削除（9ファイル削除）
3. ✅ Task M-3: 高度品質監視削除（15ファイル削除）
4. ✅ Task M-4: WebWorker・最適化機能削除（5ファイル削除）
5. ❌ Task M-5: ヘッジ機能簡素化（削除対象外 - コア機能保持）
6. ✅ Task M-6: 詳細レポート機能削除（analyticsディレクトリ削除）
7. ✅ Task M-7: 高度通知システム簡素化（4ファイル削除）
8. ✅ Task M-8: E2E・高度テスト削除（7ファイル削除）

## 総削除ファイル数: 約40ファイル
## 推定削除行数: 3,000-4,000行（25%削減）