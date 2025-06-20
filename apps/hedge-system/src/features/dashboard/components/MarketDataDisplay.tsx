'use client'

import { useState, useEffect } from 'react'

interface MarketData {
  symbol: string
  bid: number
  ask: number
  spread: number
  change: number
  changePercent: number
  volume: number
  timestamp: Date
  isMarketOpen: boolean
  sessionStatus: 'pre-market' | 'open' | 'close' | 'post-market'
}

interface MarketDataDisplayProps {
  marketData: MarketData[]
  onRefresh?: () => void
  className?: string
}

export function MarketDataDisplay({ marketData, onRefresh, className = '' }: MarketDataDisplayProps) {
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [animatingSymbols, setAnimatingSymbols] = useState<Set<string>>(new Set())
  const [previousPrices, setPreviousPrices] = useState<Map<string, number>>(new Map())

  // 価格変動アニメーション
  useEffect(() => {
    const newPrices = new Map<string, number>()
    const newAnimatingSymbols = new Set<string>()

    marketData.forEach(data => {
      const prevPrice = previousPrices.get(data.symbol)
      const currentPrice = (data.bid + data.ask) / 2

      newPrices.set(data.symbol, currentPrice)

      if (prevPrice !== undefined && prevPrice !== currentPrice) {
        newAnimatingSymbols.add(data.symbol)
      }
    })

    setPreviousPrices(newPrices)
    setAnimatingSymbols(newAnimatingSymbols)

    // アニメーションを1秒後にリセット
    if (newAnimatingSymbols.size > 0) {
      const timer = setTimeout(() => {
        setAnimatingSymbols(new Set())
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [marketData, previousPrices])

  // 自動更新
  useEffect(() => {
    const interval = setInterval(() => {
      setLastUpdate(new Date())
      onRefresh?.()
    }, 1000) // 1秒ごと

    return () => clearInterval(interval)
  }, [onRefresh])

  const formatPrice = (price: number, decimals: number = 5) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(price)
  }

  const formatNumber = (num: number, decimals: number = 0) => {
    return new Intl.NumberFormat('ja-JP', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num)
  }

  const formatPercentage = (percent: number) => {
    const sign = percent >= 0 ? '+' : ''
    return `${sign}${percent.toFixed(2)}%`
  }

  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600 bg-green-50'
    if (change < 0) return 'text-red-600 bg-red-50'
    return 'text-gray-600 bg-gray-50'
  }

  const getChangeArrow = (change: number) => {
    if (change > 0) return '↗'
    if (change < 0) return '↘'
    return '→'
  }

  const getMarketStatusColor = (status: MarketData['sessionStatus']) => {
    switch (status) {
      case 'open': return 'bg-green-500'
      case 'pre-market': return 'bg-yellow-500'
      case 'post-market': return 'bg-blue-500'
      case 'close': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getMarketStatusText = (status: MarketData['sessionStatus']) => {
    switch (status) {
      case 'open': return '市場開放'
      case 'pre-market': return 'プレマーケット'
      case 'post-market': return 'アフターマーケット'
      case 'close': return '市場終了'
      default: return '不明'
    }
  }

  const getSpreadColor = (spread: number) => {
    if (spread <= 2) return 'text-green-600'
    if (spread <= 5) return 'text-yellow-600'
    return 'text-red-600'
  }

  // 統計情報
  const stats = {
    totalSymbols: marketData.length,
    openMarkets: marketData.filter(d => d.isMarketOpen).length,
    avgSpread: marketData.length > 0 ? marketData.reduce((sum, d) => sum + d.spread, 0) / marketData.length : 0,
    upSymbols: marketData.filter(d => d.change > 0).length,
    downSymbols: marketData.filter(d => d.change < 0).length
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* ヘッダー */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-800">市場データ</h3>
          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-600">
              最終更新: {lastUpdate.toLocaleTimeString()}
            </span>
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-600">ライブ</span>
            </div>
            <button
              onClick={onRefresh}
              className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
            >
              更新
            </button>
          </div>
        </div>
      </div>

      {/* 統計サマリー */}
      <div className="p-4 border-b bg-blue-50">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">通貨ペア数</div>
            <div className="text-lg font-bold text-gray-800">{stats.totalSymbols}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">取引可能</div>
            <div className="text-lg font-bold text-green-600">{stats.openMarkets}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">平均スプレッド</div>
            <div className="text-lg font-bold text-gray-800">{formatNumber(stats.avgSpread, 1)}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">上昇</div>
            <div className="text-lg font-bold text-green-600">{stats.upSymbols}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-600 mb-1">下落</div>
            <div className="text-lg font-bold text-red-600">{stats.downSymbols}</div>
          </div>
        </div>
      </div>

      {/* 市場データ一覧 */}
      <div className="p-4">
        <div className="space-y-3">
          {marketData.map((data) => {
            const isAnimating = animatingSymbols.has(data.symbol)
            const midPrice = (data.bid + data.ask) / 2
            
            return (
              <div
                key={data.symbol}
                className={`
                  border rounded-lg p-4 transition-all duration-500
                  ${isAnimating ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'}
                `}
              >
                {/* ヘッダー行 */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="font-bold text-lg text-gray-800">{data.symbol}</div>
                    <div className={`w-3 h-3 rounded-full ${getMarketStatusColor(data.sessionStatus)}`} />
                    <span className="text-sm text-gray-600">{getMarketStatusText(data.sessionStatus)}</span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded text-sm font-medium ${getChangeColor(data.change)}`}>
                      {getChangeArrow(data.change)} {formatPercentage(data.changePercent)}
                    </span>
                    <span className={`text-sm font-medium ${getSpreadColor(data.spread)}`}>
                      {formatNumber(data.spread, 1)}pips
                    </span>
                  </div>
                </div>

                {/* 価格情報 */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Bid</div>
                    <div className={`text-xl font-mono font-bold ${
                      isAnimating ? 'text-blue-600' : 'text-gray-800'
                    } transition-colors duration-500`}>
                      {formatPrice(data.bid)}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">Ask</div>
                    <div className={`text-xl font-mono font-bold ${
                      isAnimating ? 'text-blue-600' : 'text-gray-800'
                    } transition-colors duration-500`}>
                      {formatPrice(data.ask)}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">中値</div>
                    <div className={`text-lg font-mono font-bold ${
                      isAnimating ? 'text-blue-600' : 'text-gray-800'
                    } transition-colors duration-500`}>
                      {formatPrice(midPrice)}
                    </div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xs text-gray-600 mb-1">出来高</div>
                    <div className="text-lg font-bold text-gray-800">
                      {formatNumber(data.volume)}
                    </div>
                  </div>
                </div>

                {/* 価格変動情報 */}
                <div className="mt-3 flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600">変動:</span>
                    <span className={`font-medium ${
                      data.change >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {data.change >= 0 ? '+' : ''}{formatPrice(data.change)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600">スプレッド:</span>
                    <span className={`font-medium ${getSpreadColor(data.spread)}`}>
                      {formatPrice(data.spread)} ({formatNumber(data.spread, 1)}pips)
                    </span>
                  </div>
                  
                  <div className="text-gray-500 text-xs">
                    {data.timestamp.toLocaleTimeString()}
                  </div>
                </div>

                {/* 市場状態バー */}
                <div className="mt-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-600">市場状態</span>
                    <span className={`text-xs font-medium ${
                      data.isMarketOpen ? 'text-green-600' : 'text-gray-600'
                    }`}>
                      {data.isMarketOpen ? '取引可能' : '取引不可'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ${
                        data.isMarketOpen ? 'bg-green-500' : 'bg-gray-500'
                      }`}
                      style={{ 
                        width: data.isMarketOpen ? '100%' : '0%'
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {marketData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <p>市場データがありません</p>
            <p className="text-sm">価格フィード接続を確認してください</p>
          </div>
        )}
      </div>

      {/* フッター */}
      {marketData.length > 0 && (
        <div className="p-4 border-t bg-gray-50">
          <div className="flex items-center justify-between text-sm">
            <div className="text-gray-600">
              市場データ提供: リアルタイム価格フィード
            </div>
            <div className="text-gray-600">
              更新間隔: 1秒 | 遅延: &lt;100ms
            </div>
          </div>
        </div>
      )}
    </div>
  )
}