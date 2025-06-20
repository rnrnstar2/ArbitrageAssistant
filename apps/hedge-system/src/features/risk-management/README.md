# Risk Management System

証拠金維持率監視とロスカット検知を行うリスク管理システム

## 概要

このシステムは、海外FXアービトラージ取引において重要な役割を果たすロスカット監視機能を提供します。リアルタイムで証拠金維持率を監視し、危険な状況を検知してアラートを発信します。

## 主要コンポーネント

### 1. LossCutMonitor
メインの監視エンジン。他のコンポーネントを統合して管理します。

```typescript
import { LossCutMonitor, DEFAULT_LOSSCUT_CONFIG } from '../risk-management'

const monitor = new LossCutMonitor(DEFAULT_LOSSCUT_CONFIG, {
  onRiskLevelChanged: (accountId, riskLevel) => {
    console.log(`Risk level changed: ${accountId} -> ${riskLevel}`)
  },
  onLossCutDetected: (accountId, marginLevel) => {
    console.log(`Loss cut detected: ${accountId} at ${marginLevel}%`)
  }
})

monitor.start()
monitor.addAccount('account-123', 'XM')
```

### 2. RiskStateManager
リスク状態の管理とイベント記録を行います。

### 3. MarginLevelMonitor
証拠金維持率の詳細な監視と傾向分析を行います。

## データ構造

### RiskMonitoringState
```typescript
interface RiskMonitoringState {
  accountId: string
  marginLevel: number
  freeMargin: number
  usedMargin: number
  balance: number
  equity: number
  bonusAmount: number
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical'
  lastUpdate: Date
  lossCutLevel: number
  predictions: {
    timeToCritical?: number
    requiredRecovery: number
  }
}
```

## 使用方法

### 基本的な監視開始
```typescript
// 設定
const config: LossCutMonitorConfig = {
  enabled: true,
  pollingInterval: 1000,
  marginLevelThresholds: {
    warning: 150,
    danger: 100,
    critical: 50
  },
  alertSettings: {
    enableSound: true,
    enableDesktopNotification: true,
    enableEmailAlert: false
  }
}

// 監視開始
const monitor = new LossCutMonitor(config)
monitor.initialize()
monitor.start()
```

### データ処理
```typescript
// EAからのデータを処理
const marginInfo: AccountMarginInfo = {
  accountId: 'XM-12345',
  balance: 10000,
  equity: 9500,
  freeMargin: 8000,
  usedMargin: 1500,
  marginLevel: 633.33,
  bonusAmount: 500,
  lastUpdate: new Date()
}

monitor.processMarginData(marginInfo, 'XM')
```

### 監視結果の取得
```typescript
// 特定アカウントの結果
const result = monitor.getMonitoringResult('XM-12345')
console.log(result?.riskState)

// 全アカウントの結果
const allResults = monitor.getAllMonitoringResults()

// 統計情報
const stats = monitor.getStatistics()
console.log(`監視中アカウント数: ${stats.monitoringCount}`)
```

## イベント

システムは以下のイベントを発行します：

- `riskLevelChanged` - リスクレベル変更
- `lossCutDetected` - ロスカット検知
- `marginLevelUpdate` - 証拠金維持率更新
- `warningThresholdReached` - 警告しきい値到達
- `dangerThresholdReached` - 危険しきい値到達
- `criticalThresholdReached` - クリティカルしきい値到達
- `rapidMarginChange` - 急激な変化検知

## 設定

### リスクレベル設定
```typescript
const riskConfig: RiskLevelConfig = {
  safe: { marginLevel: 200, color: '#10B981' },
  warning: { marginLevel: 150, color: '#F59E0B' },
  danger: { marginLevel: 100, color: '#EF4444' },
  critical: { marginLevel: 50, color: '#DC2626' }
}
```

### ブローカー別しきい値
```typescript
// XM: マージンコール50%, ロスカット20%
// AXIORY: マージンコール100%, ロスカット20%
// TitanFX: マージンコール90%, ロスカット20%
```

## テスト

```bash
npm test apps/hedge-system/src/features/risk-management
```

## 注意事項

1. **リアルタイム性**: 監視の精度は受信データの頻度に依存します
2. **メモリ使用量**: 長時間稼働時は履歴データが蓄積されます
3. **ネットワーク**: EA接続が不安定な場合、誤検知の可能性があります
4. **ボーナス考慮**: ボーナス額を正確に反映した計算が重要です

## 今後の拡張予定

- [ ] 機械学習による予測精度向上
- [ ] より詳細なアラート設定
- [ ] ヒストリカルデータ分析
- [ ] カスタムリスクルール
- [ ] 外部通知システム連携