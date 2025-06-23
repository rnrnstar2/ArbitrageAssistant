'use client';

import { ActionManager } from '../../features/actions/components/ActionManager';

export default function ActionsPage() {
  return (
    <div className="container mx-auto px-4 py-6">
      <h1 className="text-3xl font-bold mb-6">アクション管理</h1>
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