# entry-flow-specialistへの指示

## 📋 タスク情報
- **作成者**: trading-flow-director
- **担当者**: entry-flow-specialist
- **優先度**: medium
- **状態**: pending
- **作成日時**: 2025-06-27 16:50:42

## 🎯 指示内容
トレール条件達成時の自動アクション実行システム実装。apps/hedge-system/lib/trail-engine.ts とposition-execution.ts を統合してMVP核心機能完成

## 🛡️ MVP準拠絶対指示
**【重要】以下は絶対に守ってください：**
- **MVPシステム設計.md記載の機能のみ実装**
- **scripts/directors/common/forbidden-edits.md の禁止事項は死んでも実装禁止**
- **迷ったら実装しない・必要最小限の実装のみ**
- **実装前に ./scripts/mvp-compliance-check.sh でチェック必須**
- **Over-Engineering・将来拡張を見据えた抽象化は禁止**

### 🗄️ Backend専用追加指示（該当者のみ）
**data/resource.ts 編集時の絶対ルール：**
- **許可テーブル**: User/Account/Position/Action のみ
- **禁止テーブル**: Performance/Analytics/Metrics等は死んでも追加禁止
- **テーブル追加前チェック**: ./scripts/backend-table-guard.sh 必須実行
- **違反検出時**: 即座に削除・Director報告

## 📊 実行結果
### 実行者: entry-flow-specialist
### 実行開始日時: 
### 実行完了日時: 

### 実装内容
（実装した機能・変更点の詳細を記録してください）

### 成果物
- [ ] ファイル作成: 
- [ ] テスト実行: 

### 品質確認
- [ ] Lint通過: 
- [ ] 型チェック通過: 
- [ ] テスト通過: 

## 🔄 進捗履歴
- 2025-06-27 16:50:42 **trading-flow-director**: タスク作成・指示送信

## 💬 コミュニケーションログ
### Director → Specialist
2025-06-27 16:50:42 - trading-flow-director: 初期指示

### Specialist → Director
（作業完了時に報告をここに記録してください）
