# 🚀 Haconiwa並列開発 - あなたの次のステップ

## ✅ 完了済み準備作業
- [x] `dev` ブランチ作成・プッシュ
- [x] `arbitrage-assistant.yaml` defaultBranch最適化 (main → dev)
- [x] Haconiwa設定検証 (7つの設定を確認済み)

## 🎯 あなたが実行すべきタスク

### Phase 1: Haconiwa環境起動

```bash
# 1. Haconiwa Space起動
haconiwa apply -f arbitrage-assistant.yaml
haconiwa space start -c arbitrage-assistant

# 2. CEO環境への接続確認
haconiwa space attach -c arbitrage-assistant
# → tmux環境で6つのWindow確認
```

### Phase 2: CEO→Director指示フロー開始

```bash
# 3. CEO Window (Window 1) で戦略指示
haconiwa space attach -r room-ceo

# CEO Claude Codeに指示例：
# "第1フェーズMVP実装を開始します。各Director準備状況を確認してください。ultrathink"
```

### Phase 3: 各Director環境確認

```bash
# 4. Backend Director確認 (Window 2)
haconiwa space attach -r room-backend

# 5. Trading Director確認 (Window 3)  
haconiwa space attach -r room-trading

# 6. Integration Director確認 (Window 4)
haconiwa space attach -r room-integration

# 7. Frontend Director確認 (Window 5)
haconiwa space attach -r room-frontend

# 8. DevOps Director確認 (Window 6)
haconiwa space attach -r room-devops
```

### Phase 4: 並列開発実行

```bash
# 9. 全Room同時Claude Code起動
haconiwa space run -c arbitrage-assistant --claude-code

# 10. 進捗監視
haconiwa monitor -c arbitrage-assistant
haconiwa scan  # AI分析実行
```

## 🎮 推奨ワークフロー

### CEO Claude Code指示例
```
"Phase 1実装開始：
1. Backend Director: GraphQL基盤実装開始
2. Trading Director: アービトラージエンジン基盤実装開始  
3. Integration Director: MT5統合基盤実装開始
4. Frontend Director: 管理画面基盤実装開始
5. DevOps Director: ビルド最適化実装開始

各Director準備完了後、独立worktree環境で並列実行してください。ultrathink"
```

### タスク管理コマンド
```bash
# タスク作成・割り当て
haconiwa task new phase1-implementation
haconiwa task assign mvp-graphql-backend backend-director

# タスク進捗確認
haconiwa task show mvp-graphql-backend
haconiwa task done mvp-graphql-backend  # 完了時
```

## 🛡️ 重要な注意事項

1. **ブランチ戦略**: 全タスクはdevブランチ基準で作成される
2. **隔離環境**: 各タスクは`haconiwa-dev-world/tasks/`で独立実行
3. **品質保証**: 各タスク完了時に品質チェック必須
4. **統合フロー**: feature → dev → main の順序厳守

## 🎯 成功の指標

- [ ] 6つのWindow全てでClaude Code起動
- [ ] 各DirectorがMVPタスクを理解・実行開始
- [ ] 並列worktree環境で競合なし開発
- [ ] CEO→Director階層指示が機能

## 🚨 トラブル時の対処

```bash
# Space状態確認
haconiwa space ls
haconiwa space status -c arbitrage-assistant

# 強制リセット（必要時のみ）
haconiwa space stop -c arbitrage-assistant
haconiwa space clean -c arbitrage-assistant
```

## 📞 次回サポート時の情報

実行結果・エラー・進捗状況を共有してください：
- どのフェーズまで完了したか
- エラーメッセージ（あれば）
- 各Director Windowの状況

---

**すぐに開始**: `haconiwa apply -f arbitrage-assistant.yaml`