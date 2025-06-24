'use client';

import { ActionManager } from '../../features/actions/components/ActionManager';

export default function ActionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">アクション管理</h1>
      <ActionManager 
        actions={[]}
        positions={[]}
        onCreateAction={async () => {}}
        onTriggerAction={async () => {}}
        onTriggerActions={async () => {}}
      />
    </div>
  );
}