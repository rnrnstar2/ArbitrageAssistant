# Task 06: リスク管理ダッシュボードUIの実装

## 概要
リアルタイムリスク状況の可視化とアクション設定のメインダッシュボードを実装する。管理者が一目でリスク状況を把握できるUI。

## 実装対象ファイル
- `apps/admin/src/features/risk-management/components/RiskDashboard.tsx`
- `apps/admin/src/features/risk-management/components/AccountRiskCard.tsx`
- `apps/admin/src/features/risk-management/components/RiskOverview.tsx`
- `apps/admin/src/features/risk-management/hooks/useRiskMonitoring.ts`

## 具体的な実装内容

### RiskDashboard.tsx
```typescript
export const RiskDashboard: React.FC = () => {
  const { riskData, isLoading, error } = useRiskMonitoring()
  
  return (
    <div className="risk-dashboard">
      <RiskOverview totalRisk={riskData.totalRisk} />
      
      <div className="accounts-grid">
        {riskData.accounts.map(account => (
          <AccountRiskCard 
            key={account.id}
            account={account}
            onActionTrigger={handleActionTrigger}
          />
        ))}
      </div>
      
      <div className="dashboard-controls">
        <EmergencyStopButton />
        <RebalanceButton />
        <SettingsButton />
      </div>
    </div>
  )
}
```

### AccountRiskCard.tsx
```typescript
interface AccountRiskCardProps {
  account: AccountRiskData
  onActionTrigger: (accountId: string, action: string) => void
}

export const AccountRiskCard: React.FC<AccountRiskCardProps> = ({ 
  account, 
  onActionTrigger 
}) => {
  return (
    <Card className={`risk-card risk-${account.riskLevel}`}>
      <CardHeader>
        <h3>{account.name}</h3>
        <RiskLevelBadge level={account.riskLevel} />
      </CardHeader>
      
      <CardContent>
        <MarginLevelGauge 
          value={account.marginLevel}
          dangerLevel={30}
          criticalLevel={20}
        />
        
        <div className="risk-metrics">
          <MetricItem label="証拠金維持率" value="{account.marginLevel}%" />
          <MetricItem label="有効証拠金" value="${account.equity}" />
          <MetricItem label="余剰証拠金" value="${account.freeMargin}" />
          <MetricItem label="含み損益" value="${account.unrealizedPnL}" />
        </div>
        
        <div className="quick-actions">
          <Button 
            variant="danger" 
            size="sm"
            onClick={() => onActionTrigger(account.id, 'emergency_close')}
          >
            緊急決済
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={() => onActionTrigger(account.id, 'rebalance')}
          >
            リバランス
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
```

### RiskOverview.tsx
```typescript
interface RiskOverviewProps {
  totalRisk: RiskSummary
}

export const RiskOverview: React.FC<RiskOverviewProps> = ({ totalRisk }) => {
  return (
    <Card className="risk-overview">
      <CardHeader>
        <h2>リスク概況</h2>
        <div className="last-update">
          最終更新: {formatTime(totalRisk.lastUpdate)}
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overview-metrics">
          <OverviewMetric
            label="総合リスクレベル"
            value={totalRisk.overallRiskLevel}
            type="risk-level"
          />
          <OverviewMetric
            label="危険口座数"
            value={totalRisk.dangerousAccounts}
            type="count"
          />
          <OverviewMetric
            label="総証拠金"
            value={totalRisk.totalMargin}
            type="currency"
          />
          <OverviewMetric
            label="総含み損益"
            value={totalRisk.totalUnrealizedPnL}
            type="pnl"
          />
        </div>
        
        <div className="risk-distribution">
          <RiskDistributionChart data={totalRisk.distribution} />
        </div>
      </CardContent>
    </Card>
  )
}
```

### useRiskMonitoring.ts
```typescript
export const useRiskMonitoring = () => {
  const [riskData, setRiskData] = useState<RiskDashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    // WebSocket接続でリアルタイムデータ受信
    const ws = new WebSocket(WS_RISK_MONITORING_URL)
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      setRiskData(data)
      setIsLoading(false)
    }
    
    ws.onerror = (error) => {
      setError('リスクデータの取得に失敗しました')
      setIsLoading(false)
    }
    
    return () => ws.close()
  }, [])
  
  const triggerEmergencyAction = useCallback(async (
    accountId: string, 
    action: string
  ) => {
    // 緊急アクション実行API呼び出し
    await fetch(`/api/risk/emergency/${accountId}/${action}`, {
      method: 'POST'
    })
  }, [])
  
  return {
    riskData,
    isLoading,
    error,
    triggerEmergencyAction
  }
}
```

## スタイリング (Tailwind CSS)
```css
.risk-dashboard {
  @apply p-6 space-y-6;
}

.accounts-grid {
  @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4;
}

.risk-card {
  @apply border rounded-lg shadow-sm;
}

.risk-safe { @apply border-green-200 bg-green-50; }
.risk-warning { @apply border-yellow-200 bg-yellow-50; }  
.risk-danger { @apply border-orange-200 bg-orange-50; }
.risk-critical { @apply border-red-200 bg-red-50; }

.risk-metrics {
  @apply space-y-2 my-4;
}

.quick-actions {
  @apply flex gap-2 mt-4;
}
```

## データ型定義
```typescript
interface RiskDashboardData {
  totalRisk: RiskSummary
  accounts: AccountRiskData[]
  lastUpdate: Date
}

interface AccountRiskData {
  id: string
  name: string
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical'
  marginLevel: number
  equity: number
  freeMargin: number
  usedMargin: number
  unrealizedPnL: number
  positions: Position[]
  alerts: Alert[]
}

interface RiskSummary {
  overallRiskLevel: RiskLevel
  dangerousAccounts: number
  totalMargin: number
  totalUnrealizedPnL: number
  distribution: RiskDistribution
  lastUpdate: Date
}
```

## 完了条件
- [ ] RiskDashboard コンポーネント実装
- [ ] AccountRiskCard コンポーネント実装  
- [ ] RiskOverview コンポーネント実装
- [ ] useRiskMonitoring hook実装
- [ ] WebSocketリアルタイム接続
- [ ] 緊急アクション実行機能
- [ ] レスポンシブデザイン対応
- [ ] アクセシビリティ対応
- [ ] コンポーネントテスト実装

## UI/UX要件
- リアルタイム更新（1秒間隔）
- 色分けによる直感的なリスクレベル表示
- ワンクリック緊急アクション
- モバイル対応
- 暗モード対応（将来対応）

## 参考ファイル
- `apps/admin/features/monitoring/`
- 既存のダッシュボードコンポーネント
- UI コンポーネントライブラリ

## 注意事項
- パフォーマンス最適化（大量データ表示時）
- WebSocket接続エラー時の再接続処理
- 緊急アクション時の二重実行防止
- アクション実行時の確認ダイアログ