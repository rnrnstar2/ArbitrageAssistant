# Task M-3: 高度品質監視削除

## 目的
MVP要件を超えた高度な品質監視・メトリクス機能を削除し、
基本的なWebSocket接続監視とエラーログのみを保持する。

## 削除対象

### `/apps/hedge-system/lib/quality/` (9ファイル)
- `quality-metrics-manager.ts` - 品質メトリクス管理
- `sla-manager.ts` - SLA管理
- `report-generator.ts` - 品質レポート生成
- `websocket-quality-integration.ts` - WebSocket品質統合
- `types.ts` - 品質関連型定義
- `index.ts` - エクスポートファイル
- `__tests__/quality-metrics-manager.test.ts`
- `__tests__/sla-manager.test.ts`
- `__tests__/websocket-quality-integration.test.ts`

### `/apps/hedge-system/components/quality/` (2ファイル)
- `QualityDashboard.tsx` - 品質ダッシュボード
- `hooks/useQualityMetrics.ts` - 品質メトリクスフック

### `/apps/hedge-system/lib/performance/` (4ファイル)
- `batch-processor.ts` - バッチ処理最適化
- `resource-monitor.ts` - リソース監視
- `performance-optimizer.ts` - パフォーマンス最適化
- `index.ts` - エクスポートファイル

## 保留対象（削除しない）
- 基本的なWebSocket接続監視
- エラーログ（最小限）

## 実行手順

1. **依存関係確認**
   ```bash
   rg "import.*lib/quality" apps/
   rg "import.*lib/performance" apps/
   rg "import.*components/quality" apps/
   ```

2. **段階的削除**
   - テストファイルを先に削除
   - 品質コンポーネント削除
   - ライブラリファイル削除
   - 依存箇所修正

3. **ビルド確認**
   ```bash
   npm run build
   npm run lint
   npm run test
   ```

## 期待される削除行数
約1,500-2,000行

## 完了条件
- [ ] 全削除対象ファイルの削除完了
- [ ] 依存関係エラーの修正完了
- [ ] ビルド・テスト成功
- [ ] 基本機能の動作確認