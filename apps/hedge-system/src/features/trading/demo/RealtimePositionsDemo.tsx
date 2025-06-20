'use client'

import { TradingDashboard } from '../TradingDashboard'

/**
 * リアルタイムポジション表示機能のデモコンポーネント
 * 
 * このコンポーネントは以下の機能を提供します：
 * - GraphQL Subscriptionによるリアルタイムポジション更新
 * - 新規ポジションの即座反映
 * - ポジション状態の自動更新
 * - アカウント情報の同期更新
 * - エラーハンドリングと自動再接続
 * 
 * 使用方法：
 * ```tsx
 * import { RealtimePositionsDemo } from '@/features/trading/demo/RealtimePositionsDemo'
 * 
 * function App() {
 *   return <RealtimePositionsDemo />
 * }
 * ```
 */
export function RealtimePositionsDemo() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-2">
              リアルタイムポジション表示システム - デモ
            </h2>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• GraphQL Subscriptionによるポジションのリアルタイム更新</p>
              <p>• 新規エントリー時の即座反映</p>
              <p>• 価格・損益の自動更新</p>
              <p>• 接続状態の監視と自動復旧</p>
            </div>
            
            <div className="mt-4 p-3 bg-white rounded border">
              <h3 className="font-medium text-blue-900 mb-2">実装済み機能：</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800">
                <div>✅ GraphQL Query & Subscription設定</div>
                <div>✅ リアルタイム更新フック</div>
                <div>✅ ポジション一覧コンポーネント</div>
                <div>✅ 接続状態監視</div>
                <div>✅ エラーハンドリング</div>
                <div>✅ 自動再接続機能</div>
                <div>✅ フィルタリング・ソート</div>
                <div>✅ 統計表示</div>
              </div>
            </div>
          </div>
        </div>
        
        <TradingDashboard />
      </div>
    </div>
  )
}