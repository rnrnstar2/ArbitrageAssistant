'use client';

import { ActionManager } from '../../features/actions/components/ActionManager';
import { useActions } from '../../features/actions/hooks/useActions';
import { usePositions } from '../../features/positions/hooks/usePositions';

export default function ActionsPage() {
  const { actions, loading: actionsLoading, executeAction } = useActions();
  const { positions, loading: positionsLoading } = usePositions();

  const isLoading = actionsLoading || positionsLoading;

  const handleCreateAction = async (input: any) => {
    console.log('📝 Creating action:', input);
    // ダミー実装：ログ出力のみ
  };

  const handleTriggerAction = async (actionId: string) => {
    await executeAction(actionId);
  };

  const handleTriggerActions = async (actionIds: string[]) => {
    console.log('📝 Executing multiple actions:', actionIds);
    // ダミー実装：各アクションを順次実行
    for (const actionId of actionIds) {
      await executeAction(actionId);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">アクション管理</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">アクション管理</h1>
      <ActionManager 
        actions={actions}
        positions={positions}
        onCreateAction={handleCreateAction}
        onTriggerAction={handleTriggerAction}
        onTriggerActions={handleTriggerActions}
      />
    </div>
  );
}