'use client'

import React, { ComponentType, forwardRef, memo, useEffect, useRef, useState } from 'react'
import { usePerformanceOptimization } from '../services/PerformanceOptimizationService'

// パフォーマンス最適化HOC
export interface PerformanceOptimizedProps {
  performanceKey?: string
  enableCaching?: boolean
  throttleDelay?: number
  enableRenderOptimization?: boolean
}

export function withPerformanceOptimization<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: {
    componentName?: string
    enableCaching?: boolean
    throttleDelay?: number
    enableRenderOptimization?: boolean
  } = {}
) {
  const {
    componentName = WrappedComponent.displayName || WrappedComponent.name || 'Component',
    enableCaching = true,
    throttleDelay = 100,
    enableRenderOptimization = true
  } = options

  const PerformanceOptimizedComponent = memo(
    forwardRef<any, P & PerformanceOptimizedProps>((props, ref) => {
      const {
        performanceKey = componentName,
        enableCaching: propEnableCaching = enableCaching,
        throttleDelay: propThrottleDelay = throttleDelay,
        enableRenderOptimization: propEnableRenderOptimization = enableRenderOptimization,
        ...componentProps
      } = props

      const {
        optimizeRender,
        throttleUpdate,
        cacheData,
        getCachedData
      } = usePerformanceOptimization()

      const renderCountRef = useRef(0)
      const lastPropsRef = useRef<any>(null)
      const [renderedComponent, setRenderedComponent] = React.useState<JSX.Element | null>(null)

      // キャッシュキー生成
      const cacheKey = React.useMemo(() => {
        if (!propEnableCaching) return null
        return `${performanceKey}:${JSON.stringify(componentProps)}`
      }, [performanceKey, componentProps, propEnableCaching])

      // レンダリング最適化
      const renderComponent = React.useCallback(() => {
        if (propEnableRenderOptimization) {
          optimizeRender(componentName, () => {
            renderCountRef.current++
            const component = <WrappedComponent {...(componentProps as P)} ref={ref} />
            setRenderedComponent(component)
          })
        } else {
          renderCountRef.current++
          const component = <WrappedComponent {...(componentProps as P)} ref={ref} />
          setRenderedComponent(component)
        }
      }, [componentProps, ref, componentName, optimizeRender, propEnableRenderOptimization])

      // スロットル付きレンダリング更新
      const throttledRender = React.useCallback(() => {
        throttleUpdate(`${performanceKey}:render`, renderComponent, propThrottleDelay)
      }, [performanceKey, renderComponent, throttleUpdate, propThrottleDelay])

      // キャッシュからの復元またはレンダリング
      useEffect(() => {
        if (cacheKey && propEnableCaching) {
          const cached = getCachedData(cacheKey)
          if (cached) {
            setRenderedComponent(cached)
            return
          }
        }

        // Propsが変更された場合のみレンダリング
        if (JSON.stringify(componentProps) !== JSON.stringify(lastPropsRef.current)) {
          lastPropsRef.current = componentProps
          throttledRender()
        }
      }, [componentProps, cacheKey, propEnableCaching, getCachedData, throttledRender])

      // レンダリング結果をキャッシュ
      useEffect(() => {
        if (renderedComponent && cacheKey && propEnableCaching) {
          cacheData(cacheKey, renderedComponent, 10000) // 10秒キャッシュ
        }
      }, [renderedComponent, cacheKey, propEnableCaching, cacheData])

      // 初回レンダリング
      useEffect(() => {
        if (!renderedComponent) {
          renderComponent()
        }
      }, [renderedComponent, renderComponent])

      return renderedComponent || <div>Loading...</div>
    })
  )

  PerformanceOptimizedComponent.displayName = `PerformanceOptimized(${componentName})`

  return PerformanceOptimizedComponent
}

// メモリ効率的なリストコンポーネント
export interface VirtualizedListProps<T> {
  items: T[]
  itemHeight: number
  containerHeight: number
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T, index: number) => string
  onScroll?: (scrollTop: number) => void
  overscan?: number
}

export function VirtualizedList<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  keyExtractor,
  onScroll,
  overscan = 5
}: VirtualizedListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0)
  const scrollElementRef = useRef<HTMLDivElement>(null)

  const { optimizeRender } = usePerformanceOptimization()

  const visibleItems = React.useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(items.length - 1, startIndex + visibleCount + overscan * 2)

    return {
      startIndex,
      endIndex,
      visibleItems: items.slice(startIndex, endIndex + 1),
      offsetY: startIndex * itemHeight
    }
  }, [items, itemHeight, containerHeight, scrollTop, overscan])

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop
    setScrollTop(newScrollTop)
    onScroll?.(newScrollTop)
  }, [onScroll])

  return (
    <div
      ref={scrollElementRef}
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={handleScroll}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleItems.offsetY}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.visibleItems.map((item, index) => {
            const actualIndex = visibleItems.startIndex + index
            return (
              <div
                key={keyExtractor(item, actualIndex)}
                style={{ height: itemHeight }}
              >
                {renderItem(item, actualIndex)}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// バッチ更新コンポーネント
export interface BatchUpdateContainerProps {
  children: React.ReactNode
  batchDelay?: number
  maxBatchSize?: number
}

export const BatchUpdateContainer: React.FC<BatchUpdateContainerProps> = ({
  children,
  batchDelay = 100,
  maxBatchSize = 10
}) => {
  const { batchUpdates } = usePerformanceOptimization()
  const [updates, setUpdates] = useState<Array<() => void>>([])
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const executeUpdates = React.useCallback(() => {
    if (updates.length > 0) {
      batchUpdates(updates)
      setUpdates([])
    }
  }, [updates, batchUpdates])

  const addUpdate = React.useCallback((updateFn: () => void) => {
    setUpdates(prev => {
      const newUpdates = [...prev, updateFn]
      
      // 最大バッチサイズに達した場合、即座に実行
      if (newUpdates.length >= maxBatchSize) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
        executeUpdates()
        return []
      }

      // タイマーをリセット
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      timeoutRef.current = setTimeout(() => {
        executeUpdates()
        timeoutRef.current = null
      }, batchDelay)

      return newUpdates
    })
  }, [maxBatchSize, batchDelay, executeUpdates])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const contextValue = React.useMemo(() => ({
    addUpdate
  }), [addUpdate])

  return (
    <BatchUpdateContext.Provider value={contextValue}>
      {children}
    </BatchUpdateContext.Provider>
  )
}

// バッチ更新コンテキスト
const BatchUpdateContext = React.createContext<{
  addUpdate: (updateFn: () => void) => void
} | null>(null)

export const useBatchUpdate = () => {
  const context = React.useContext(BatchUpdateContext)
  if (!context) {
    throw new Error('useBatchUpdate must be used within BatchUpdateContainer')
  }
  return context
}

// パフォーマンステスト用のヘビーコンポーネント
export interface PerformanceTestComponentProps {
  complexity: 'low' | 'medium' | 'high'
  dataSize: number
  enableOptimization?: boolean
}

const HeavyComponent: React.FC<PerformanceTestComponentProps> = ({
  complexity,
  dataSize,
  enableOptimization = false
}) => {
  const { optimizeRender } = usePerformanceOptimization()

  const heavyCalculation = React.useCallback(() => {
    // 負荷の高い計算をシミュレート
    const iterations = complexity === 'high' ? 100000 : complexity === 'medium' ? 10000 : 1000
    let result = 0
    
    for (let i = 0; i < iterations; i++) {
      result += Math.random() * Math.sin(i) * Math.cos(i)
    }
    
    return result
  }, [complexity])

  const data = React.useMemo(() => {
    return Array.from({ length: dataSize }, (_, i) => ({
      id: i,
      value: heavyCalculation(),
      timestamp: Date.now()
    }))
  }, [dataSize, heavyCalculation])

  const renderContent = () => (
    <div className="space-y-2">
      <div className="text-sm text-gray-600">
        複雑度: {complexity} | データサイズ: {dataSize} | 最適化: {enableOptimization ? 'ON' : 'OFF'}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {data.slice(0, 20).map(item => (
          <div key={item.id} className="border p-2 rounded text-xs">
            <div>ID: {item.id}</div>
            <div>値: {item.value.toFixed(2)}</div>
          </div>
        ))}
      </div>
      {data.length > 20 && (
        <div className="text-xs text-gray-500">
          ...他 {data.length - 20} 件のアイテム
        </div>
      )}
    </div>
  )

  if (enableOptimization) {
    optimizeRender('HeavyComponent', renderContent)
    return renderContent()
  }

  return renderContent()
}

export const PerformanceTestComponent = memo(HeavyComponent)

export default PerformanceTestComponent