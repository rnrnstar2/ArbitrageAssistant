# Task 02 サブタスク: ポジション決済システム

## 概要
task-02-position-close-system.md を並列処理可能な6つの細分化されたタスクに分割。

## サブタスク一覧

### 1. task-02-01-close-form-ui.md
**決済フォームUI実装**
- CloseForm.tsx (個別決済)
- BatchCloseForm.tsx (一括決済)
- PositionSelector.tsx (選択UI)

### 2. task-02-02-close-logic-websocket.md
**決済ロジック・WebSocket連携**
- WebSocket決済コマンド送信
- 決済結果受信・処理
- 部分決済計算ロジック

### 3. task-02-03-daily-close-manager.md
**日次ポジション整理機能**
- DailyCloseManager.tsx
- スワップコスト計算
- 自動整理提案

### 4. task-02-04-linked-position-close.md
**関連ポジション連動決済**
- 関連ポジション検出
- 連動決済設定UI
- 両建て整合性チェック

### 5. task-02-05-close-history-display.md
**決済履歴記録・表示**
- 履歴データ構造定義
- AWS Amplify連携
- 履歴表示UI・フィルター

### 6. task-02-06-error-handling-validation.md
**エラーハンドリング・バリデーション**
- 入力値バリデーション
- 決済前チェック
- エラー処理・通知

## 並列実行の利点
- 各タスクが独立して実行可能
- UI、ロジック、データ処理の関心事分離
- 複数の開発者による同時開発が可能
- テスト・デバッグの効率化

## 依存関係
- 01 → 02: UIからロジック呼び出し
- 02 → 05: 決済実行結果を履歴保存
- 03,04 → 06: エラーハンドリング統合
- 全サブタスク → 06: 共通バリデーション