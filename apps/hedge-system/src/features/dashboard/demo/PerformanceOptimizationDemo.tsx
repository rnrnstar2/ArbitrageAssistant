'use client'

import React, { useState, useEffect } from 'react'
import PerformanceMonitorDashboard from '../components/PerformanceMonitorDashboard'
import MemoryUsageChart from '../components/MemoryUsageChart'
import { 
  PerformanceTestComponent, 
  withPerformanceOptimization,
  VirtualizedList,
  BatchUpdateContainer
} from '../components/PerformanceOptimizedComponent'
import { usePerformanceOptimization } from '../services/PerformanceOptimizationService'

// 最適化されたテストコンポーネント
const OptimizedTestComponent = withPerformanceOptimization(PerformanceTestComponent, {
  componentName: 'OptimizedTest',
  enableCaching: true,
  enableRenderOptimization: true
})

// サンプルデータ生成
const generateSampleData = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: Math.random() * 1000,
    category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)],
    timestamp: Date.now() - Math.random() * 86400000 // 24時間以内のランダムタイムスタンプ
  }))
}

export const PerformanceOptimizationDemo: React.FC = () => {
  const [simulationRunning, setSimulationRunning] = useState(false)
  const [connectionCount, setConnectionCount] = useState(10)
  const [dataComplexity, setDataComplexity] = useState<'low' | 'medium' | 'high'>('medium')
  const [dataSize, setDataSize] = useState(100)
  const [enableOptimization, setEnableOptimization] = useState(true)
  const [sampleData, setSampleData] = useState(() => generateSampleData(1000))

  const {
    setConnectionCount: updateConnectionCount,
    setMessageRate,
    setUpdateRate
  } = usePerformanceOptimization()

  // シミュレーションの開始/停止
  useEffect(() => {
    if (!simulationRunning) return

    const interval = setInterval(() => {
      // 接続数をランダムに変動
      const newConnectionCount = Math.floor(connectionCount + (Math.random() - 0.5) * 10)
      const clampedCount = Math.max(1, Math.min(50, newConnectionCount))
      
      updateConnectionCount(clampedCount)
      setMessageRate(clampedCount * 2 + Math.random() * 10) // メッセージ率
      setUpdateRate(clampedCount * 0.5 + Math.random() * 2) // 更新率

      // データをランダムに更新
      setSampleData(prev => {
        const updated = [...prev]
        for (let i = 0; i < 10; i++) {
          const index = Math.floor(Math.random() * updated.length)
          updated[index] = {
            ...updated[index],
            value: Math.random() * 1000,
            timestamp: Date.now()
          }
        }
        return updated
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [simulationRunning, connectionCount, updateConnectionCount, setMessageRate, setUpdateRate])

  const startSimulation = () => {
    setSimulationRunning(true)
    updateConnectionCount(connectionCount)
  }

  const stopSimulation = () => {
    setSimulationRunning(false)
  }

  const handleOptimizationTriggered = () => {
    console.log('パフォーマンス最適化が実行されました')
  }

  // 仮想リスト用のアイテムレンダラー
  const renderListItem = (item: any, index: number) => (
    <div className="border-b p-2 flex items-center justify-between hover:bg-gray-50">
      <div>
        <span className="font-medium">{item.name}</span>
        <span className="text-sm text-gray-500 ml-2">({item.category})</span>
      </div>
      <div className="text-right">
        <div className="font-mono text-sm">{item.value.toFixed(2)}</div>
        <div className="text-xs text-gray-500">
          {new Date(item.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* ヘッダー */}
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-4">パフォーマンス最適化デモ</h1>
          <p className="text-gray-600 mb-4">
            50台までのクライアント対応を実現するパフォーマンス最適化機能のデモンストレーション
          </p>

          {/* コントロールパネル */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                接続数シミュレーション
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={connectionCount}
                onChange={(e) => setConnectionCount(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                データ複雑度
              </label>
              <select
                value={dataComplexity}
                onChange={(e) => setDataComplexity(e.target.value as any)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                データサイズ
              </label>
              <input
                type="number"
                min="10"
                max="1000"
                step="10"
                value={dataSize}
                onChange={(e) => setDataSize(parseInt(e.target.value) || 10)}
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={enableOptimization}
                  onChange={(e) => setEnableOptimization(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">最適化有効</span>
              </label>
            </div>
          </div>

          {/* シミュレーション制御 */}
          <div className="flex space-x-2">
            <button
              onClick={startSimulation}
              disabled={simulationRunning}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              シミュレーション開始
            </button>
            <button
              onClick={stopSimulation}
              disabled={!simulationRunning}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              シミュレーション停止
            </button>
            <button
              onClick={() => setSampleData(generateSampleData(1000))}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              データ再生成
            </button>
          </div>
        </div>

        {/* メトリクス表示 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PerformanceMonitorDashboard 
            onOptimizationTriggered={handleOptimizationTriggered}
          />
          <MemoryUsageChart
            width={500}
            height={300}
            updateInterval={1000}
            maxDataPoints={60}
          />
        </div>

        {/* パフォーマンステスト */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 最適化なし */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">最適化なしコンポーネント</h3>
            <PerformanceTestComponent
              complexity={dataComplexity}
              dataSize={dataSize}
              enableOptimization={false}
            />
          </div>

          {/* 最適化あり */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">最適化ありコンポーネント</h3>
            <OptimizedTestComponent
              complexity={dataComplexity}
              dataSize={dataSize}
              enableOptimization={enableOptimization}
            />
          </div>
        </div>

        {/* 仮想化リスト */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">
            仮想化リスト（{sampleData.length}件のデータ）
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            大量データを効率的に表示するための仮想化機能。
            表示領域のアイテムのみをレンダリングしてメモリ使用量を削減。
          </p>
          
          <BatchUpdateContainer batchDelay={100} maxBatchSize={10}>
            <VirtualizedList
              items={sampleData}
              itemHeight={60}
              containerHeight={400}
              renderItem={renderListItem}
              keyExtractor={(item) => item.id.toString()}
            />
          </BatchUpdateContainer>
        </div>

        {/* パフォーマンス分析 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">パフォーマンス分析</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-2">最適化の効果</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• メモリ使用量の削減</li>
                <li>• レンダリング時間の短縮</li>
                <li>• キャッシュによる計算回数削減</li>
                <li>• バッチ更新による効率化</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">50台対応戦略</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• データ圧縮による転送量削減</li>
                <li>• 仮想化による大量データ処理</li>
                <li>• 自動的なガベージコレクション</li>
                <li>• スロットルによる負荷制御</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-2">監視項目</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• メモリ使用量とトレンド</li>
                <li>• レンダリング時間</li>
                <li>• キャッシュヒット率</li>
                <li>• 接続数とメッセージ率</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PerformanceOptimizationDemo