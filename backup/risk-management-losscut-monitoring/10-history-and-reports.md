# Task 10: 履歴・レポート機能の実装

## 概要
ロスカット履歴、アクション実行履歴、パフォーマンス分析レポートを管理する機能を実装する。事後分析と改善のための重要なデータ管理システム。

## 実装対象ファイル
- `apps/admin/src/features/risk-management/components/LossCutHistory.tsx`
- `apps/admin/src/features/risk-management/components/ActionExecutionHistory.tsx`
- `apps/admin/src/features/risk-management/components/RiskAnalyticsReport.tsx`
- `apps/admin/src/features/risk-management/components/PerformanceMetrics.tsx`
- `apps/admin/src/features/risk-management/services/HistoryService.ts`
- `apps/admin/src/features/risk-management/hooks/useHistoryData.ts`

## 具体的な実装内容

### LossCutHistory.tsx
```typescript
export const LossCutHistory: React.FC = () => {
  const {
    losscuts,
    filters,
    pagination,
    isLoading,
    updateFilters,
    exportData
  } = useHistoryData('losscut')
  
  return (
    <div className="losscut-history">
      <div className="history-header">
        <h2>ロスカット履歴</h2>
        <div className="header-actions">
          <Button
            variant="secondary"
            onClick={() => exportData('csv')}
          >
            CSV出力
          </Button>
          <Button
            variant="secondary"
            onClick={() => exportData('excel')}
          >
            Excel出力
          </Button>
        </div>
      </div>
      
      {/* フィルター */}
      <Card className="filters-card">
        <CardContent>
          <HistoryFilters
            filters={filters}
            onChange={updateFilters}
            availableAccounts={availableAccounts}
          />
        </CardContent>
      </Card>
      
      {/* 統計サマリー */}
      <div className="summary-grid">
        <StatCard
          title="総ロスカット回数"
          value={losscuts.length}
          icon={<AlertTriangleIcon />}
        />
        <StatCard
          title="総損失額"
          value={calculateTotalLoss(losscuts)}
          format="currency"
          icon={<TrendingDownIcon />}
        />
        <StatCard
          title="平均復旧時間"
          value={calculateAverageRecoveryTime(losscuts)}
          format="duration"
          icon={<ClockIcon />}
        />
        <StatCard
          title="成功率"
          value={calculateSuccessRate(losscuts)}
          format="percentage"
          icon={<CheckCircleIcon />}
        />
      </div>
      
      {/* 履歴テーブル */}
      <Card className="history-table-card">
        <CardContent>
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <DataTable
              columns={LOSSCUT_COLUMNS}
              data={losscuts}
              pagination={pagination}
              onRowClick={handleRowClick}
              expandableRows
              renderExpandedRow={renderLossCutDetails}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

### ActionExecutionHistory.tsx
```typescript
export const ActionExecutionHistory: React.FC = () => {
  const { executions, filters, updateFilters } = useHistoryData('actions')
  const [selectedExecution, setSelectedExecution] = useState<ActionExecution | null>(null)
  
  return (
    <div className="action-history">
      <div className="history-layout">
        {/* 左側: 実行履歴リスト */}
        <div className="execution-list">
          <div className="list-header">
            <h3>アクション実行履歴</h3>
            <ActionFilters
              filters={filters}
              onChange={updateFilters}
            />
          </div>
          
          <div className="execution-items">
            {executions.map(execution => (
              <ExecutionItem
                key={execution.id}
                execution={execution}
                isSelected={selectedExecution?.id === execution.id}
                onClick={() => setSelectedExecution(execution)}
              />
            ))}
          </div>
        </div>
        
        {/* 右側: 詳細表示 */}
        <div className="execution-details">
          {selectedExecution ? (
            <ExecutionDetailView execution={selectedExecution} />
          ) : (
            <EmptyState message="実行履歴を選択してください" />
          )}
        </div>
      </div>
    </div>
  )
}

const ExecutionDetailView: React.FC<{ execution: ActionExecution }> = ({ execution }) => {
  return (
    <div className="execution-detail">
      <div className="detail-header">
        <h3>{execution.chainName}</h3>
        <ExecutionStatusBadge status={execution.status} />
      </div>
      
      <div className="detail-content">
        <ExecutionTimeline steps={execution.steps} />
        <ExecutionMetrics execution={execution} />
        <ExecutionLogs logs={execution.logs} />
      </div>
    </div>
  )
}
```

### RiskAnalyticsReport.tsx
```typescript
export const RiskAnalyticsReport: React.FC = () => {
  const {
    reportData,
    period,
    setPeriod,
    generateReport,
    isGenerating
  } = useAnalyticsReport()
  
  return (
    <div className="analytics-report">
      <div className="report-header">
        <h2>リスク分析レポート</h2>
        <div className="report-controls">
          <Select
            value={period}
            onChange={setPeriod}
            options={[
              { value: '7d', label: '過去7日' },
              { value: '30d', label: '過去30日' },
              { value: '90d', label: '過去90日' },
              { value: 'custom', label: 'カスタム期間' }
            ]}
          />
          <Button
            onClick={generateReport}
            disabled={isGenerating}
          >
            {isGenerating ? '生成中...' : 'レポート生成'}
          </Button>
        </div>
      </div>
      
      {reportData && (
        <div className="report-content">
          {/* エグゼクティブサマリー */}
          <Card className="executive-summary">
            <CardHeader>
              <h3>エグゼクティブサマリー</h3>
            </CardHeader>
            <CardContent>
              <div className="summary-metrics">
                <MetricCard
                  title="リスクスコア"
                  value={reportData.overallRiskScore}
                  change={reportData.riskScoreChange}
                  format="score"
                />
                <MetricCard
                  title="ロスカット率"
                  value={reportData.lossCutRate}
                  change={reportData.lossCutRateChange}
                  format="percentage"
                />
                <MetricCard
                  title="平均復旧時間"
                  value={reportData.averageRecoveryTime}
                  change={reportData.recoveryTimeChange}
                  format="duration"
                />
              </div>
            </CardContent>
          </Card>
          
          {/* リスクトレンド */}
          <Card className="risk-trends">
            <CardHeader>
              <h3>リスクトレンド</h3>
            </CardHeader>
            <CardContent>
              <RiskTrendChart data={reportData.riskTrends} />
            </CardContent>
          </Card>
          
          {/* 口座別分析 */}
          <Card className="account-analysis">
            <CardHeader>
              <h3>口座別リスク分析</h3>
            </CardHeader>
            <CardContent>
              <AccountRiskMatrix data={reportData.accountAnalysis} />
            </CardContent>
          </Card>
          
          {/* 改善提案 */}
          <Card className="recommendations">
            <CardHeader>
              <h3>改善提案</h3>
            </CardHeader>
            <CardContent>
              <RecommendationList recommendations={reportData.recommendations} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
```

### HistoryService.ts
```typescript
export class HistoryService {
  // ロスカット履歴取得
  async getLossCutHistory(filters: HistoryFilters): Promise<LossCutRecord[]> {
    const response = await fetch('/api/risk/history/losscuts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters)
    })
    return response.json()
  }
  
  // アクション実行履歴取得
  async getActionHistory(filters: HistoryFilters): Promise<ActionExecution[]> {
    const response = await fetch('/api/risk/history/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(filters)
    })
    return response.json()
  }
  
  // 分析レポート生成
  async generateAnalyticsReport(period: string): Promise<AnalyticsReport> {
    const response = await fetch(`/api/risk/analytics/report?period=${period}`)
    return response.json()
  }
  
  // データエクスポート
  async exportData(
    type: 'losscut' | 'actions',
    format: 'csv' | 'excel',
    filters: HistoryFilters
  ): Promise<Blob> {
    const response = await fetch(`/api/risk/export/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, filters })
    })
    return response.blob()
  }
  
  // パフォーマンス指標計算
  calculatePerformanceMetrics(data: LossCutRecord[]): PerformanceMetrics {
    return {
      totalLossCuts: data.length,
      totalLoss: data.reduce((sum, record) => sum + record.lossAmount, 0),
      averageRecoveryTime: this.calculateAverageRecoveryTime(data),
      successRate: this.calculateSuccessRate(data),
      riskScore: this.calculateRiskScore(data)
    }
  }
  
  private calculateAverageRecoveryTime(data: LossCutRecord[]): number {
    const recoveredRecords = data.filter(r => r.recoveryTime)
    if (recoveredRecords.length === 0) return 0
    
    const totalTime = recoveredRecords.reduce((sum, r) => sum + r.recoveryTime!, 0)
    return totalTime / recoveredRecords.length
  }
  
  private calculateSuccessRate(data: LossCutRecord[]): number {
    if (data.length === 0) return 0
    const successCount = data.filter(r => r.isRecovered).length
    return (successCount / data.length) * 100
  }
  
  private calculateRiskScore(data: LossCutRecord[]): number {
    // リスクスコア計算ロジック
    const recentData = data.filter(r => 
      Date.now() - r.timestamp.getTime() < 30 * 24 * 60 * 60 * 1000 // 30日以内
    )
    
    const frequency = recentData.length / 30 // 日平均
    const averageLoss = recentData.reduce((sum, r) => sum + r.lossAmount, 0) / recentData.length
    
    // 0-100のスコア（100が最もリスクが高い）
    return Math.min(100, (frequency * 10) + (averageLoss / 1000))
  }
}
```

## データ型定義
```typescript
interface LossCutRecord {
  id: string
  accountId: string
  timestamp: Date
  marginLevelBefore: number
  lossAmount: number
  triggerReason: string
  emergencyActions: ActionExecution[]
  isRecovered: boolean
  recoveryTime?: number // 分
  recoveryActions?: ActionExecution[]
  lessons?: string
}

interface ActionExecution {
  id: string
  chainId: string
  chainName: string
  triggeredBy: string
  startTime: Date
  endTime?: Date
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  steps: ActionStepExecution[]
  logs: ExecutionLog[]
  result?: ExecutionResult
}

interface ActionStepExecution {
  stepId: string
  stepType: string
  startTime: Date
  endTime?: Date
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  result?: any
  error?: string
  retryCount: number
}

interface AnalyticsReport {
  period: string
  generatedAt: Date
  overallRiskScore: number
  riskScoreChange: number
  lossCutRate: number
  lossCutRateChange: number
  averageRecoveryTime: number
  recoveryTimeChange: number
  riskTrends: RiskTrendData[]
  accountAnalysis: AccountAnalysisData[]
  recommendations: Recommendation[]
}

interface Recommendation {
  id: string
  type: 'risk_reduction' | 'process_improvement' | 'monitoring_enhancement'
  priority: 'high' | 'medium' | 'low'
  title: string
  description: string
  actionItems: string[]
  estimatedImpact: string
}
```

## 完了条件
- [ ] LossCutHistory コンポーネント実装
- [ ] ActionExecutionHistory コンポーネント実装
- [ ] RiskAnalyticsReport コンポーネント実装
- [ ] HistoryService クラス実装
- [ ] useHistoryData hook実装
- [ ] データエクスポート機能
- [ ] 統計・分析機能
- [ ] チャート・グラフ表示
- [ ] フィルタリング・検索機能
- [ ] コンポーネントテスト実装

## レポート機能
- **日次レポート**: 当日のリスク状況サマリー
- **週次レポート**: 週間トレンド分析
- **月次レポート**: 月間パフォーマンス評価
- **アドホックレポート**: カスタム期間での詳細分析

## 改善提案システム
- パターン認識による自動提案
- 類似事例からの学習
- ベストプラクティス推奨
- アクション効果の定量評価

## 参考ファイル
- 既存のダッシュボード・レポート機能
- チャート・グラフコンポーネント

## 注意事項
- 大量データの効率的な処理
- レポート生成時間の最適化
- データプライバシーの保護
- 監査ログとの整合性確保