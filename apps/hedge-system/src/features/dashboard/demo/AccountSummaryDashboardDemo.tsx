'use client'

import { AccountSummaryDashboard } from '../components/AccountSummaryDashboard'
import { useRealtimeAccountSummary } from '../hooks/useRealtimeAccountSummary'

interface AccountSummaryDashboardDemoProps {
  className?: string
}

export function AccountSummaryDashboardDemo({ className = '' }: AccountSummaryDashboardDemoProps) {
  const {
    clientPCs,
    loading,
    error,
    lastUpdate,
    refresh,
    updateFrequency,
    connectionStatus
  } = useRealtimeAccountSummary({
    updateInterval: 2000, // 2秒間隔でデモ更新
    enabled: true,
    autoReconnect: true
  })

  if (loading && clientPCs.length === 0) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-8 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">アカウントデータを読み込み中...</p>
          <p className="text-sm text-gray-500 mt-2">接続状態: {connectionStatus}</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border p-8 ${className}`}>
        <div className="text-center text-red-600">
          <div className="text-4xl mb-4">⚠️</div>
          <p className="font-semibold mb-2">データ取得エラー</p>
          <p className="text-sm text-gray-600 mb-4">{error.message}</p>
          <button
            onClick={refresh}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 transition-colors"
          >
            再試行
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={className}>
      {/* デモ情報バナー */}
      <div className="bg-blue-100 border border-blue-300 text-blue-800 px-4 py-3 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="font-semibold">🔄 デモモード</span>
            <span className="text-sm">
              リアルタイムデータ（{updateFrequency} updates/sec）
            </span>
          </div>
          <div className="flex items-center space-x-4 text-sm">
            <span>接続状態: 
              <span className={`ml-1 font-semibold ${
                connectionStatus === 'connected' ? 'text-green-600' :
                connectionStatus === 'connecting' ? 'text-yellow-600' :
                connectionStatus === 'error' ? 'text-red-600' : 'text-gray-600'
              }`}>
                {connectionStatus === 'connected' ? '接続中' :
                 connectionStatus === 'connecting' ? '接続中...' :
                 connectionStatus === 'error' ? 'エラー' : '切断'}
              </span>
            </span>
            {lastUpdate && (
              <span>最終更新: {lastUpdate.toLocaleTimeString()}</span>
            )}
          </div>
        </div>
      </div>

      {/* メインダッシュボード */}
      <AccountSummaryDashboard
        clientPCs={clientPCs}
        onRefresh={refresh}
        updateInterval={2000}
        className="shadow-lg"
      />

      {/* デモ説明 */}
      <div className="mt-6 bg-gray-50 rounded-lg p-4">
        <h3 className="font-semibold text-gray-800 mb-2">📊 デモの特徴</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• リアルタイムでモックデータが更新されます（2秒間隔）</li>
          <li>• 証拠金維持率、損益、ポジション数などが動的に変化します</li>
          <li>• クライアントPCをクリックすると詳細情報が表示されます</li>
          <li>• 自動更新のON/OFF切り替えが可能です</li>
          <li>• 接続状態とデータ更新頻度をリアルタイム監視できます</li>
        </ul>
      </div>
    </div>
  )
}