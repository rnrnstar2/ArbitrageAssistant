'use client'

import { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@repo/ui/components/ui/card'
import { Badge } from '@repo/ui/components/ui/badge'
import { AccountRiskCard } from './AccountRiskCard'
import { Account, LossCutPrediction, Alert } from '../types'
import { 
  AlertTriangle, 
  Shield, 
  Power, 
  Settings,
  Filter,
  RefreshCw,
  Download,
  Bell,
  Users,
  Activity
} from 'lucide-react'

interface RiskDisplayData {
  accountId: string
  accountName: string
  marginLevel: number
  riskLevel: 'safe' | 'warning' | 'danger' | 'critical'
  freeMargin: number
  usedMargin: number
  activePositions: number
  nextAction?: string
  lastUpdate: Date
  predictions?: {
    trend: 'improving' | 'deteriorating' | 'stable'
    timeToLossCut?: number
  }
}

interface RiskDashboardProps {
  accounts: Account[]
  lossCutPredictions: LossCutPrediction[]
  alerts: Alert[]
  isRealTimeEnabled?: boolean
  onEmergencyStop?: () => void
  onManualIntervention?: (accountId: string) => void
  onExportReport?: () => void
  onSettingsOpen?: () => void
}

export function RiskDashboard({
  accounts,
  lossCutPredictions,
  alerts,
  isRealTimeEnabled = true,
  onEmergencyStop,
  onManualIntervention,
  onExportReport,
  onSettingsOpen
}: RiskDashboardProps) {
  const [filterRisk, setFilterRisk] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'risk' | 'margin' | 'name'>('risk')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [showEmergencyPanel, setShowEmergencyPanel] = useState(false)

  // リスクデータの変換
  const riskData = useMemo((): RiskDisplayData[] => {
    return accounts.map(account => {
      const prediction = lossCutPredictions.find(p => p.accountId === account.id)
      
      const getRiskLevel = (marginLevel: number): RiskDisplayData['riskLevel'] => {
        if (marginLevel <= 50) return 'critical'
        if (marginLevel <= 100) return 'danger'  
        if (marginLevel <= 150) return 'warning'
        return 'safe'
      }

      const getPredictionTrend = (): 'improving' | 'deteriorating' | 'stable' => {
        // 実際の実装では過去データと比較して判定
        if (account.marginLevel <= 100) return 'deteriorating'
        if (account.marginLevel >= 200) return 'improving'
        return 'stable'
      }

      return {
        accountId: account.id,
        accountName: `${account.broker} - ${account.accountNumber}`,
        marginLevel: account.marginLevel,
        riskLevel: prediction?.riskLevel || getRiskLevel(account.marginLevel),
        freeMargin: account.equity - account.margin,
        usedMargin: account.margin,
        activePositions: account.positions.length,
        lastUpdate: new Date(),
        predictions: {
          trend: getPredictionTrend(),
          timeToLossCut: prediction?.estimatedTimeToLossCut
        }
      }
    })
  }, [accounts, lossCutPredictions])

  // フィルタリングとソート
  const filteredAndSortedData = useMemo(() => {
    let filtered = riskData

    // リスクレベルフィルタ
    if (filterRisk !== 'all') {
      filtered = filtered.filter(data => data.riskLevel === filterRisk)
    }

    // ソート
    filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'risk':
          const riskOrder = { critical: 0, danger: 1, warning: 2, safe: 3 }
          comparison = riskOrder[a.riskLevel] - riskOrder[b.riskLevel]
          break
        case 'margin':
          comparison = a.marginLevel - b.marginLevel
          break
        case 'name':
          comparison = a.accountName.localeCompare(b.accountName)
          break
      }
      
      return sortDirection === 'asc' ? comparison : -comparison
    })

    return filtered
  }, [riskData, filterRisk, sortBy, sortDirection])

  // リスク統計
  const riskStats = useMemo(() => {
    const stats = { critical: 0, danger: 0, warning: 0, safe: 0 }
    riskData.forEach(data => {
      stats[data.riskLevel]++
    })
    return stats
  }, [riskData])

  // 未対応アラート数
  const unacknowledgedAlerts = useMemo(() => {
    return alerts.filter(alert => !alert.acknowledged).length
  }, [alerts])

  // 緊急アラートの自動表示
  useEffect(() => {
    const criticalAccounts = riskData.filter(data => data.riskLevel === 'critical')
    if (criticalAccounts.length > 0 && !showEmergencyPanel) {
      setShowEmergencyPanel(true)
    }
  }, [riskData, showEmergencyPanel])

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortDirection('asc')
    }
  }

  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  return (
    <div className="space-y-6">
      {/* ヘッダー統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2 text-red-500" />
              緊急アラート
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {riskStats.critical}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              即座に対応が必要
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Shield className="h-4 w-4 mr-2 text-orange-500" />
              警告レベル
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {riskStats.danger + riskStats.warning}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              注意深く監視中
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Users className="h-4 w-4 mr-2 text-blue-500" />
              監視中口座
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-900">
              {accounts.length}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              安全: {riskStats.safe}口座
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center">
              <Bell className="h-4 w-4 mr-2 text-purple-500" />
              未対応アラート
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {unacknowledgedAlerts}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              確認が必要
            </p>
          </CardContent>
        </Card>
      </div>

      {/* コントロールバー */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">リスク管理ダッシュボード</CardTitle>
            <div className="flex items-center space-x-2">
              <Badge variant={isRealTimeEnabled ? "default" : "secondary"} className="flex items-center">
                <Activity className="h-3 w-3 mr-1" />
                {isRealTimeEnabled ? 'リアルタイム' : '停止中'}
              </Badge>
              <span className="text-xs text-gray-500">
                最終更新: {formatTime(new Date())}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            {/* フィルターとソート */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-gray-500" />
                <select
                  value={filterRisk}
                  onChange={(e) => setFilterRisk(e.target.value)}
                  className="border rounded px-3 py-1 text-sm"
                >
                  <option value="all">全リスクレベル</option>
                  <option value="critical">緊急</option>
                  <option value="danger">危険</option>
                  <option value="warning">警告</option>
                  <option value="safe">安全</option>
                </select>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">ソート:</span>
                <button
                  onClick={() => handleSort('risk')}
                  className={`px-2 py-1 rounded text-sm ${
                    sortBy === 'risk' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  リスク順 {sortBy === 'risk' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('margin')}
                  className={`px-2 py-1 rounded text-sm ${
                    sortBy === 'margin' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  証拠金維持率 {sortBy === 'margin' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
                <button
                  onClick={() => handleSort('name')}
                  className={`px-2 py-1 rounded text-sm ${
                    sortBy === 'name' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  口座名 {sortBy === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                </button>
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex items-center space-x-2">
              <button
                onClick={onExportReport}
                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                <Download className="h-4 w-4 mr-1" />
                レポート出力
              </button>
              
              <button
                onClick={onSettingsOpen}
                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                <Settings className="h-4 w-4 mr-1" />
                設定
              </button>

              <button
                onClick={onEmergencyStop}
                className="flex items-center px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                <Power className="h-4 w-4 mr-1" />
                緊急停止
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* アラート表示 */}
      {unacknowledgedAlerts > 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="py-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 text-orange-500 mr-2" />
              <span className="font-medium text-orange-800">
                {unacknowledgedAlerts}件の未対応アラートがあります
              </span>
              <button className="ml-4 text-sm text-orange-600 hover:text-orange-800 underline">
                詳細を確認
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* リスクカードグリッド */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredAndSortedData.map((data) => (
          <AccountRiskCard
            key={data.accountId}
            riskData={data}
            isSelected={selectedAccountId === data.accountId}
            onClick={() => setSelectedAccountId(data.accountId)}
            onManualIntervention={() => onManualIntervention?.(data.accountId)}
          />
        ))}
      </div>

      {filteredAndSortedData.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">フィルター条件に一致する口座がありません</p>
              <p className="text-sm mt-1">
                フィルター設定を変更して再度確認してください
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 緊急対応パネル（条件付き表示） */}
      {showEmergencyPanel && riskStats.critical > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader className="pb-3">
            <CardTitle className="text-red-800 flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              緊急対応が必要
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-red-700">
                {riskStats.critical}個の口座が緊急状態です。即座に対応してください。
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    const criticalAccounts = filteredAndSortedData
                      .filter(data => data.riskLevel === 'critical')
                      .forEach(data => onManualIntervention?.(data.accountId))
                  }}
                  className="bg-red-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-red-700"
                >
                  一括介入
                </button>
                <button
                  onClick={() => setShowEmergencyPanel(false)}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded text-sm hover:bg-gray-300"
                >
                  後で対応
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}