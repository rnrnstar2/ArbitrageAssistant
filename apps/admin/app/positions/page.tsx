import { PositionManager } from '../../features/positions/components/PositionManager';

export default function PositionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ポジション管理</h1>
      <PositionManager />
    </div>
  );
}