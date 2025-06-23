import { StrategyList } from '../../features/strategies/components/StrategyList';

export default function StrategiesPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">戦略設定</h1>
      <StrategyList />
    </div>
  );
}