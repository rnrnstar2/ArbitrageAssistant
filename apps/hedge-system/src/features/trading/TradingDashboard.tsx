'use client'

import { useState } from 'react'
import { RealtimeActivePositions } from '../monitoring/RealtimeActivePositions'
import { EntryForm } from './EntryForm'
import { Position } from './graphql/queries'
import { useRealtimePositions } from './hooks/useRealtimePositions'

interface TradingDashboardProps {
  className?: string
}

export function TradingDashboard({ className = '' }: TradingDashboardProps) {
  const { accounts } = useRealtimePositions()
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [showEntryForm, setShowEntryForm] = useState(false)

  const handlePositionClick = (position: Position) => {
    setSelectedPosition(position)
    console.log('Selected position:', position)
  }

  const handleEntrySubmitted = (entryData: any) => {
    console.log('Entry submitted:', entryData)
    // エントリー成功後はフォームを閉じる
    setShowEntryForm(false)
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ダッシュボードヘッダー */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">トレーディングダッシュボード</h1>
            <p className="text-gray-600 mt-2">リアルタイムポジション管理とエントリーシステム</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setShowEntryForm(!showEntryForm)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                showEntryForm
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {showEntryForm ? 'フォームを閉じる' : '新規エントリー'}
            </button>
          </div>
        </div>
      </div>

      {/* エントリーフォーム（条件付き表示） */}
      {showEntryForm && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <EntryForm 
            accounts={accounts.map(account => ({
              id: account.id,
              broker: account.broker,
              accountNumber: account.accountNumber,
              balance: account.balance
            }))}
            onEntrySubmitted={handleEntrySubmitted}
          />
        </div>
      )}

      {/* 選択されたポジションの詳細 */}
      {selectedPosition && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">ポジション詳細</h2>
            <button
              onClick={() => setSelectedPosition(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-600">通貨ペア</div>
              <div className="font-semibold">{selectedPosition.symbol}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">方向</div>
              <div className={`font-semibold ${
                selectedPosition.type === 'buy' ? 'text-green-600' : 'text-red-600'
              }`}>
                {selectedPosition.type === 'buy' ? 'BUY' : 'SELL'}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">ロット</div>
              <div className="font-semibold">{selectedPosition.lots}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">損益</div>
              <div className={`font-semibold ${
                selectedPosition.profit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {selectedPosition.profit.toFixed(2)}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">約定価格</div>
              <div className="font-semibold font-mono">{selectedPosition.openPrice.toFixed(5)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">現在価格</div>
              <div className="font-semibold font-mono">{selectedPosition.currentPrice.toFixed(5)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">開始時刻</div>
              <div className="font-semibold text-sm">
                {new Date(selectedPosition.openedAt).toLocaleString('ja-JP')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-600">ステータス</div>
              <div className="font-semibold">{selectedPosition.status}</div>
            </div>
          </div>
        </div>
      )}

      {/* リアルタイムポジション一覧 */}
      <RealtimeActivePositions 
        onPositionClick={handlePositionClick}
        autoRefreshInterval={30000} // 30秒間隔で自動更新
        className=""
      />
    </div>
  )
}