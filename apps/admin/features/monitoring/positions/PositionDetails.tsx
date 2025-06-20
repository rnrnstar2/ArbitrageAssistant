'use client'

import { useState } from 'react'
import { Position, Account } from '../types'

interface PositionDetailsProps {
  position: Position
  account?: Account
}

export function PositionDetails({ position, account }: PositionDetailsProps) {
  const [activeTab, setActiveTab] = useState<'info' | 'trail' | 'close' | 'history'>('info')

  const formatNumber = (num: number, decimals: number = 2) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const formatDateTime = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date)
  }

  const calculatePips = () => {
    const priceDiff = position.currentPrice - position.openPrice
    const pipValue = position.symbol.includes('JPY') ? 0.01 : 0.0001
    const pips = priceDiff / pipValue
    return position.type === 'buy' ? pips : -pips
  }

  const calculateSpread = () => {
    // 実際の実装では、bid/ask価格から計算
    return position.symbol.includes('JPY') ? 0.3 : 0.0003
  }

  const getPositionSize = () => {
    return position.lots * 100000 // 1ロット = 100,000通貨
  }

  const tabs = [
    { id: 'info', label: '基本情報' },
    { id: 'trail', label: 'トレール設定' },
    { id: 'close', label: '決済設定' },
    { id: 'history', label: '履歴' }
  ]

  return (
    <div className="h-full flex flex-col">
      {/* ヘッダー */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{position.symbol}</h3>
          <div className="flex items-center space-x-2">
            <span className={`
              inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
              ${position.type === 'buy' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
              }
            `}>
              {position.type === 'buy' ? 'BUY' : 'SELL'}
            </span>
            <span className="text-sm text-gray-600">
              {formatNumber(position.lots, 2)} ロット
            </span>
          </div>
        </div>
        
        {/* 損益情報 */}
        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-600">現在損益</div>
              <div className={`text-xl font-bold ${
                position.profit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatNumber(position.profit, 2)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-gray-600">pips</div>
              <div className={`text-lg font-semibold ${
                calculatePips() >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatNumber(calculatePips(), 1)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="border-b">
        <nav className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`
                flex-1 py-2 px-4 text-sm font-medium border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* コンテンツ */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'info' && (
          <div className="space-y-4">
            {/* 基本情報 */}
            <div>
              <h4 className="font-medium mb-3">ポジション情報</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">ポジションID:</span>
                  <span className="font-mono">{position.id.slice(-8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">通貨ペア:</span>
                  <span className="font-medium">{position.symbol}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">方向:</span>
                  <span className={position.type === 'buy' ? 'text-green-600' : 'text-red-600'}>
                    {position.type.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ロット数:</span>
                  <span>{formatNumber(position.lots, 2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">取引数量:</span>
                  <span>{formatNumber(getPositionSize(), 0)} 通貨</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">約定価格:</span>
                  <span className="font-mono">{formatNumber(position.openPrice, 5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">現在価格:</span>
                  <span className="font-mono">{formatNumber(position.currentPrice, 5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">スプレッド:</span>
                  <span className="font-mono">{formatNumber(calculateSpread(), 5)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">約定時刻:</span>
                  <span>{formatDateTime(position.openTime)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">最終更新:</span>
                  <span>{formatDateTime(position.updateTime)}</span>
                </div>
              </div>
            </div>

            {/* アカウント情報 */}
            {account && (
              <div>
                <h4 className="font-medium mb-3">アカウント情報</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ブローカー:</span>
                    <span>{account.broker}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">口座番号:</span>
                    <span className="font-mono">{account.accountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">残高:</span>
                    <span>{formatNumber(account.balance, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">有効証拠金:</span>
                    <span>{formatNumber(account.equity, 2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">証拠金維持率:</span>
                    <span className={`font-medium ${
                      account.marginLevel > 200 ? 'text-green-600' :
                      account.marginLevel > 100 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {formatNumber(account.marginLevel, 1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ボーナス:</span>
                    <span>{formatNumber(account.bonusAmount, 2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 関連ポジション */}
            {position.relatedPositionId && (
              <div>
                <h4 className="font-medium mb-3">関連ポジション</h4>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="text-sm">
                    <span className="text-gray-600">両建てポジション ID:</span>
                    <span className="font-mono ml-2">{position.relatedPositionId.slice(-8)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trail' && (
          <div className="space-y-4">
            <h4 className="font-medium">トレール設定</h4>
            {position.trailSettings?.enabled ? (
              <div className="space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center mb-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mr-2"></div>
                    <span className="text-sm font-medium text-blue-800">トレール有効</span>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">トレール距離:</span>
                    <span>{position.trailSettings.trailDistance} pips</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ステップサイズ:</span>
                    <span>{position.trailSettings.stepSize} pips</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">開始条件:</span>
                    <span>{position.trailSettings.startTrigger} pips</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <div className="text-3xl mb-2">⚡</div>
                <p>トレール設定されていません</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'close' && (
          <div className="space-y-4">
            <h4 className="font-medium">決済設定</h4>
            {position.closeSettings ? (
              <div className="space-y-3">
                <div className="p-3 bg-yellow-50 rounded-lg">
                  <div className="flex items-center mb-2">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                    <span className="text-sm font-medium text-yellow-800">決済予約中</span>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">目標価格:</span>
                    <span className="font-mono">{formatNumber(position.closeSettings.targetPrice, 5)}</span>
                  </div>
                  
                  {position.closeSettings.linkedCloseAction && (
                    <div className="border-t pt-2 mt-3">
                      <div className="text-gray-600 mb-2">連動決済設定:</div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">連動ポジション:</span>
                        <span className="font-mono">{position.closeSettings.linkedCloseAction.positionId.slice(-8)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">連動アクション:</span>
                        <span>{position.closeSettings.linkedCloseAction.action}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-gray-500">
                <div className="text-3xl mb-2">⏰</div>
                <p>決済設定されていません</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h4 className="font-medium">更新履歴</h4>
            <div className="text-center py-6 text-gray-500">
              <div className="text-3xl mb-2">📋</div>
              <p>履歴データを読み込み中...</p>
              <p className="text-sm">実装予定の機能です</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}