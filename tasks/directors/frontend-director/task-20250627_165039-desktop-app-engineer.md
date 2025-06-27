# desktop-app-engineerへの指示

## 📋 タスク情報
- **作成者**: frontend-director
- **担当者**: desktop-app-engineer
- **優先度**: medium
- **状態**: pending
- **作成日時**: 2025-06-27 16:50:39

## 🎯 指示内容
管理画面のポジション作成→トレール設定→実行の完全ワークフロー実装。既存の基盤コンポーネントを活用してMVPシステム設計書準拠の直感的UI完成

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
### 実行者: desktop-app-engineer
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
- 2025-06-27 16:50:39 **frontend-director**: タスク作成・指示送信

## 💬 コミュニケーションログ
### Director → Specialist
2025-06-27 16:50:39 - frontend-director: 初期指示

### Specialist → Director
（作業完了時に報告をここに記録してください）
