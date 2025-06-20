# Task 07: システム一括アップデート管理の実装

## 概要
管理画面からの一斉アップデート指示とポジションゼロ確認後の安全なアップデート実行機能を実装する。

## 実装範囲

### 1. アップデート管理機能
- **一括アップデート指示**
  - 管理画面からの一斉アップデート指示
  - アップデート対象クライアントPCの選択
  - アップデート進捗のリアルタイム監視

- **安全性確保**
  - 全ポジションクローズ状態の確認
  - 指定時刻でのスケジュール実行
  - 失敗時の自動リトライ

### 2. アップデート条件管理
- **前提条件チェック**
  - ポジション状態確認
  - EA接続状態確認
  - 必要なファイルの準備確認

- **スケジュール機能**
  - 指定時刻での自動実行
  - 定期アップデートスケジュール
  - メンテナンス時間帯設定

### 3. 進捗監視・制御
- **リアルタイム監視**
  - アップデート進捗の表示
  - エラー状況の把握
  - 各クライアントPCの状態監視

- **制御機能**
  - アップデート開始・停止
  - 緊急中断機能
  - 個別クライアント制御

## 参考ファイル
- `apps/hedge-system/hooks/useAutoUpdater.ts`
- `docs/architecture/AUTO_UPDATE_ARCHITECTURE.md`
- `scripts/release-hedge-system.sh`

## 実装手順

### Phase 1: アップデート管理UI
1. `src/features/system-management/` ディレクトリ作成
2. `UpdateManager.tsx` - アップデート管理画面
3. `ClientUpdateStatus.tsx` - クライアント状態表示
4. `UpdateScheduler.tsx` - スケジュール設定

### Phase 2: アップデート制御ロジック
5. `UpdateController.ts` - アップデート制御エンジン
6. `PreConditionChecker.ts` - 前提条件チェック
7. `UpdateProgressTracker.ts` - 進捗追跡

### Phase 3: 通信・同期機能
8. WebSocket経由でのアップデート指示送信
9. 各クライアントからの状態報告受信
10. 分散アップデートの同期処理

### Phase 4: 安全機能・履歴管理
11. `SafetyManager.ts` - 安全性確保機能
12. `UpdateHistory.tsx` - アップデート履歴
13. ロールバック機能（将来実装用の基盤）

## データ構造

### UpdateTask
```typescript
interface UpdateTask {
  id: string
  version: string
  targetClients: string[]
  status: 'pending' | 'scheduled' | 'running' | 'completed' | 'failed'
  createdAt: Date
  scheduledAt?: Date
  startedAt?: Date
  completedAt?: Date
  preConditions: {
    zeroPositions: boolean
    allClientsOnline: boolean
    backupCompleted: boolean
  }
  progress: ClientUpdateProgress[]
}

interface ClientUpdateProgress {
  clientId: string
  clientName: string
  status: 'waiting' | 'downloading' | 'installing' | 'restarting' | 'completed' | 'failed'
  progress: number // 0-100
  currentStep: string
  error?: string
  lastUpdate: Date
}
```

### UpdateSettings
```typescript
interface UpdateSettings {
  autoUpdateEnabled: boolean
  maintenanceWindow: {
    start: string // "02:00"
    end: string   // "04:00"
    timezone: string
  }
  preConditionTimeout: number // 分
  retryAttempts: number
  notificationSettings: {
    beforeUpdate: boolean
    onCompletion: boolean
    onError: boolean
  }
}
```

## 完了条件
- [ ] 管理画面からの一括アップデート指示
- [ ] ポジションゼロ確認機能
- [ ] アップデート進捗のリアルタイム表示
- [ ] 失敗時の自動リトライ機能
- [ ] スケジュール実行機能
- [ ] 緊急中断・制御機能
- [ ] アップデート履歴管理

## 注意事項
- アップデート中のトレード停止確認
- クライアントPC間の同期処理
- ネットワーク障害時の対応
- 部分失敗時の処理方針
- 既存のTauri自動更新機能との連携
- セキュリティ・認証の確保

## アップデート実行フロー
1. 管理画面でのアップデート設定
2. 前提条件の自動チェック
3. スケジュール時刻または即座実行
4. 各クライアントへの指示送信
5. 進捗監視・エラーハンドリング
6. 完了確認・報告
7. 必要に応じてリトライ・ロールバック