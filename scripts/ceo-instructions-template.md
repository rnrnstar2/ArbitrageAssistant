# 🏛️ CEO指示テンプレート集

## 🎯 CEO(0.0) → 各Directors基本指示

### 1. 環境変数確認 & 役割把握
```bash
echo "HACONIWA_AGENT_ID: $HACONIWA_AGENT_ID"
cat arbitrage-assistant.yaml | grep -A 10 "ceo-main"
cat "MVPシステム設計.md" | head -50
```

### 2. CEO → Backend Director(1.0) 指示
```
echo "CEO指示: Backend Director" && echo "=== MVP実装優先順位 ===" && echo "1. AWS Amplify Gen2 + DynamoDB設計 (1.1: amplify-gen2-specialist)" && echo "2. Cognito認証統合 (1.2: cognito-auth-expert)" && echo "3. GraphQL Subscription実装" && echo "4. userIdベース最適化実装" && echo "MVPシステム設計.md の '2. データベース設計' を参照してspecialistsに具体的指示を出してください" ultrathink
```

### 3. CEO → Trading Flow Director(2.0) 指示
```
echo "CEO指示: Trading Flow Director" && echo "=== MVP実装優先順位 ===" && echo "1. Position-Trail-Action基本フロー (2.1: entry-flow-specialist)" && echo "2. 決済・ロスカット処理 (2.2: settlement-flow-specialist)" && echo "3. アービトラージ計算ロジック" && echo "4. Tauri v2統合" && echo "MVPシステム設計.md の '4. 実行パターン詳細' を参照してspecialistsに具体的指示を出してください" ultrathink
```

### 4. CEO → Integration Director(3.0) 指示
```
echo "CEO指示: Integration Director" && echo "=== MVP実装優先順位 ===" && echo "1. MQL5 + WebSocket基盤 (3.1: mt5-connector-specialist)" && echo "2. C++ WebSocket DLL (3.2: websocket-engineer)" && echo "3. MT4/MT5通信プロトコル" && echo "4. ea/フォルダ構成実装" && echo "MVPシステム設計.md の '7. WebSocket通信設計' を参照してspecialistsに具体的指示を出してください" ultrathink
```

### 5. CEO → Frontend Director(4.0) 指示
```
echo "CEO指示: Frontend Director" && echo "=== MVP実装優先順位 ===" && echo "1. Next.js管理画面 (4.1: react-specialist)" && echo "2. Tauri v2デスクトップ (4.2: desktop-app-engineer)" && echo "3. GraphQL連携UI" && echo "4. Tailwind CSS v4実装" && echo "MVPシステム設計.md の '5-4. 管理者画面' を参照してspecialistsに具体的指示を出してください" ultrathink
```

### 6. CEO → DevOps Director(5.0) 指示
```
echo "CEO指示: DevOps Director" && echo "=== MVP実装優先順位 ===" && echo "1. Turborepo最適化 (5.1: build-optimization-engineer)" && echo "2. Vitest + コード品質 (5.2: quality-assurance-engineer)" && echo "3. GitHub Actions CI/CD" && echo "4. ESLint品質ゲート" && echo "MVPシステム設計.md の '10. パフォーマンス最適化' を参照してspecialistsに具体的指示を出してください" ultrathink
```

## 🔄 定期進捗確認指示

### Director Coordinator(0.1) 連携確認
```
echo "=== Directors間連携状況確認 ===" && echo "1. Backend ↔ Trading 認証・データ連携" && echo "2. Trading ↔ Integration MT5通信" && echo "3. Frontend → Backend GraphQL接続" && echo "4. DevOps 品質ゲート状況" && echo "課題があればCEO(0.0)に報告してください" ultrathink
```

### Progress Monitor(0.2) 進捗確認
```
echo "=== MVP進捗確認 ===" && echo "git status && git log --oneline -10" && echo "npm run build 2>/dev/null || echo 'Build確認必要'" && echo "npm run lint 2>/dev/null || echo 'Lint確認必要'" && echo "進捗状況をCEO(0.0)に報告してください" ultrathink
```

## 🚨 緊急時指示

### 全体ビルドエラー対応
```
echo "緊急: 全体ビルドエラー対応" && echo "1. DevOps Director(5.0): 即座にエラー分析" && echo "2. 該当Directors: 専門領域エラー修正" && echo "3. Progress Monitor(0.2): 1時間ごと状況報告" && echo "4. CEO(0.0): 必要に応じて優先度変更" ultrathink
```

### リリース準備
```
echo "リリース準備開始" && echo "1. Quality Assurance(5.2): 全テスト実行" && echo "2. Build Optimization(5.1): 最終ビルド確認" && echo "3. 各Directors: 最終動作確認" && echo "4. CEO(0.0): リリース可否判断" ultrathink
```

## 📊 6x3 Grid最適化の成果

### 実現された効果
1. **0ベース統一**: Window 0-5, Pane x.0-x.2の統一設計
2. **Claude起動問題解決**: 正確なペイン指定によるClaude安定起動
3. **命令系統明確化**: CEO → Directors → Specialists の3階層指示
4. **環境変数最適化**: 各ペインで正確なHACONIWA_AGENT_ID設定
5. **MVP集中実装**: 各専門領域での具体的タスク実行

### ベストプラクティス
- CEO(0.0)は必ず役割確認 → MVPシステム設計確認 → Directors指示の順番
- 指示の最後に必ず「ultrathink」を付与
- Directors は Specialists への具体的タスク指示を徹底
- Progress Monitor(0.2) で定期的な進捗確認実施