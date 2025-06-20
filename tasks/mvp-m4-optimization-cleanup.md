# Task M-4: WebWorker・最適化機能削除

## 目的
MVP要件を超えたWebWorker利用、仮想化リスト、メモ化最適化、
キャッシュマネージャーなどの過度な最適化機能を削除する。

## 削除対象

### `/apps/admin/lib/optimization/` (5ファイル)
- `VirtualizedPositionList.tsx` - 仮想化リスト
- `MemoizedComponents.tsx` - メモ化コンポーネント
- `price-calculation.worker.ts` - WebWorker価格計算
- `PriceCalculationManager.ts` - 価格計算マネージャー
- `CacheManager.ts` - キャッシュマネージャー

## 実行手順

1. **依存関係確認**
   ```bash
   rg "import.*lib/optimization" apps/
   rg "VirtualizedPositionList" apps/
   rg "MemoizedComponents" apps/
   rg "PriceCalculationManager" apps/
   rg "CacheManager" apps/
   ```

2. **WebWorker確認**
   ```bash
   rg "Worker" apps/admin/
   rg "\.worker\." apps/admin/
   ```

3. **段階的削除**
   - WebWorkerファイルを先に削除
   - マネージャークラス削除
   - コンポーネント削除
   - 依存箇所を通常の実装に変更

4. **置き換え作業**
   - 仮想化リスト → 通常のリスト
   - メモ化コンポーネント → 通常のコンポーネント
   - キャッシュ管理 → シンプルな状態管理

## 実行コマンド
```bash
# 削除実行
rm -rf /Users/rnrnstar/github/ArbitrageAssistant/apps/admin/lib/optimization/

# 依存関係確認とエラー修正
npm run build
npm run lint
```

## 期待される削除行数
約800-1,200行

## 完了条件
- [ ] optimizationディレクトリの完全削除
- [ ] 依存関係エラーの修正完了
- [ ] 通常の実装への置き換え完了
- [ ] Admin アプリのビルド・テスト成功