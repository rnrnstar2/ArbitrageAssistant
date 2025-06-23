import { PositionList } from '../../features/positions/components/PositionList';

export default function PositionsPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">ポジション管理</h1>
      <PositionList />
    </div>
  );
}