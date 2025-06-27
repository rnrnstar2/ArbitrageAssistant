import { PositionManager } from '../../features/positions/components/PositionManager';
import { PositionWorkflow } from '../../features/positions/components/PositionWorkflow';

export default function PositionsPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">ポジション管理</h1>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="text-lg font-semibold text-blue-800 mb-2">
            ✨ 統合ワークフロー
          </h2>
          <p className="text-blue-700 text-sm mb-4">
            ポジション作成→トレール設定→実行の完全ワークフローを一つの画面で実行できます
          </p>
          <PositionWorkflow onComplete={() => window.location.reload()} />
        </div>
      </div>
      
      <PositionManager />
    </div>
  );
}