# Task 02: アラート・通知システムの実装

## 概要
証拠金維持率低下時の段階的警告と緊急通知機能を実装する。osascriptを活用したネイティブ通知も含む。

## 実装対象ファイル
- `apps/hedge-system/src/features/risk-management/RiskAlertManager.ts`
- `apps/hedge-system/src/features/risk-management/NotificationService.ts`
- `apps/hedge-system/src/features/risk-management/AlertConfig.ts`

## 具体的な実装内容

### RiskAlertManager.ts
```typescript
export class RiskAlertManager {
  // アラートレベル判定
  determineAlertLevel(marginLevel: number): AlertLevel
  
  // 段階的アラート送信
  sendStageAlert(accountId: string, alertLevel: AlertLevel): void
  
  // 緊急アラート送信
  sendEmergencyAlert(riskEvent: RiskEvent): void
  
  // アラート設定管理
  updateAlertSettings(settings: AlertSettings): void
}
```

### NotificationService.ts
```typescript
export class NotificationService {
  // macOS通知送信
  sendNativeNotification(title: string, message: string, sound?: string): void
  
  // ブラウザ通知
  sendBrowserNotification(notification: NotificationData): void
  
  // メール/SMS通知（将来拡張用）
  sendExternalNotification(type: 'email' | 'sms', data: any): void
}
```

### AlertConfig.ts
```typescript
export interface AlertSettings {
  marginLevels: {
    warning: number    // デフォルト 50%
    danger: number     // デフォルト 30%
    critical: number   // デフォルト 20%
  }
  notifications: {
    native: boolean
    browser: boolean
    sound: boolean
    email?: boolean
  }
  cooldown: number // 同じアラートの再送間隔（分）
}
```

## アラートレベル定義
```typescript
type AlertLevel = 'info' | 'warning' | 'danger' | 'critical' | 'emergency'

interface AlertData {
  level: AlertLevel
  accountId: string
  marginLevel: number
  message: string
  timestamp: Date
  requiresAction: boolean
}
```

## 完了条件
- [ ] RiskAlertManager クラス実装
- [ ] NotificationService クラス実装
- [ ] AlertConfig 設定システム実装
- [ ] macOS osascript通知連携
- [ ] 段階的アラートロジック実装
- [ ] アラート重複防止機能
- [ ] 単体テスト実装

## 通知例
```bash
# 警告時
osascript -e 'display notification "証拠金維持率 45% - 注意レベル" with title "ArbitrageAssistant Risk Alert" sound name "Ping"'

# 危険時  
osascript -e 'display notification "証拠金維持率 25% - 危険レベル！" with title "ArbitrageAssistant RISK" sound name "Sosumi"'

# 緊急時
osascript -e 'display notification "ロスカット検知！緊急対応が必要です" with title "ArbitrageAssistant EMERGENCY" sound name "Basso"'
```

## 参考ファイル
- `apps/admin/features/monitoring/alerts/`
- CLAUDE.mdの通知システム例

## 注意事項
- アラート spam防止（クールダウン機能）
- 緊急時の確実な通知配信
- 通知音の使い分け（警告レベル別）
- バックグラウンド実行時の通知権限