# Turborepo最適化タスク実行手順

## 📋 タスク概要

MVPシステム設計.md準拠でAmplify Gen2ベストプラクティスに従ったTurborepo最適化を実行する。

## 🚀 実行フェーズ

### フェーズ1: 基盤最適化（直列実行）
1. `task-1-type-sharing.md` - 型共有改善（tsconfig.json paths設定）
2. `task-2-amplify-config.md` - amplify_outputs.json一元管理

### フェーズ2: パフォーマンス最適化（並列実行可能）
- `task-3-1-turborepo-optimization.md` - Turborepo設定最適化
- `task-3-2-dependency-cleanup.md` - 依存関係整理

### フェーズ3: 最終検証（直列実行）
3. `task-4-build-verification.md` - ビルド検証とパフォーマンステスト

## 💻 実行コマンド例

### Claude Code での実行
```bash
# フェーズ1（直列実行）
"tasks/task-1-type-sharing.md を実行して。完了後このファイルを削除"
"tasks/task-2-amplify-config.md を実行して。完了後このファイルを削除"

# フェーズ2（並列実行可能）
"tasks/task-3-1-turborepo-optimization.md を実行して。完了後このファイルを削除"
"tasks/task-3-2-dependency-cleanup.md を実行して。完了後このファイルを削除"

# フェーズ3（最終検証）
"tasks/task-4-build-verification.md を実行して。完了後このファイルを削除"
```

### 手動実行の場合
```bash
# 各タスクで指定された手順に従って実行
cat tasks/task-1-type-sharing.md
# → 手順に従って実装
```

## ⚠️ 重要事項

- 各タスクは MVPシステム設計.md の内容を理解してから実行
- shared-backend は軽量維持、shared-amplify はフル機能維持
- Amplify Gen2ベストプラクティス準拠
- 品質基準：ESLint --max-warnings 0, TypeScript strict mode