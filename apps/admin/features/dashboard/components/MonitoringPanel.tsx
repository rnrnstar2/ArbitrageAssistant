import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Activity, AlertTriangle, TrendingUp } from "lucide-react";

interface MonitoringPanelProps {
  isLoading: boolean;
}

export function MonitoringPanel({ isLoading }: MonitoringPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>全体監視パネル</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <h4 className="font-medium mb-3">戦略実行ログ</h4>
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-gray-200 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="w-3/4 h-3 bg-gray-200 rounded animate-pulse mb-1" />
                      <div className="w-1/2 h-3 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm">EUR/USD戦略: PC-001-A → 0.1lot BUY実行</p>
                      <p className="text-xs text-gray-500">2分前</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-blue-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm">ヘッジ戦略: トレール決済 → 逆方向エントリー</p>
                      <p className="text-xs text-gray-500">5分前</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-orange-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm">戦略一時停止: トレール決済戦略</p>
                      <p className="text-xs text-gray-500">10分前</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="w-2 h-2 bg-purple-500 rounded-full" />
                    <div className="flex-1">
                      <p className="text-sm">新規戦略開始: アービトラージ戦略</p>
                      <p className="text-xs text-gray-500">15分前</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div>
            <h4 className="font-medium mb-3">アラート・通知</h4>
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-2 bg-yellow-50 rounded">
                    <div className="w-4 h-4 bg-gray-200 rounded animate-pulse" />
                    <div className="flex-1">
                      <div className="w-3/4 h-3 bg-gray-200 rounded animate-pulse" />
                    </div>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-center space-x-3 p-2 bg-yellow-50 rounded">
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                    <div className="flex-1">
                      <p className="text-sm text-yellow-800">PC-003-A: 証拠金率80%到達</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-2 bg-blue-50 rounded">
                    <Activity className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm text-blue-800">ヘッジ戦略: 次回アクション待機中</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-2 bg-green-50 rounded">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm text-green-800">EUR/USD戦略: 目標利益達成</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}