'use client';

import React, { useState } from 'react';
import { Card } from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@repo/ui/components/ui/table';
import { Action, ActionStatus, Position } from '@repo/shared-types';
import { StatCard, StatusBadge } from '../../../components/common';

interface ActionManagerProps {
  actions: Action[];
  positions: Position[];
  onCreateAction: (input: any) => Promise<void>;
  onTriggerAction: (actionId: string) => Promise<void>;
  onTriggerActions: (actionIds: string[]) => Promise<void>;
}

interface ActionTableProps {
  actions: Action[];
  positions: Position[];
  selectedActions: string[];
  onSelectionChange: (actionIds: string[]) => void;
  onTriggerAction: (actionId: string) => Promise<void>;
}

const ActionTable: React.FC<ActionTableProps> = ({
  actions,
  positions,
  selectedActions,
  onSelectionChange,
  onTriggerAction
}) => {
  const handleActionSelect = (actionId: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedActions, actionId]);
    } else {
      onSelectionChange(selectedActions.filter(id => id !== actionId));
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const pendingActions = actions
        .filter(a => a.status === ActionStatus.PENDING)
        .map(a => a.id);
      onSelectionChange(pendingActions);
    } else {
      onSelectionChange([]);
    }
  };

  const getPositionInfo = (positionId: string) => {
    const position = positions.find(p => p.id === positionId);
    return position ? `${position.symbol} ${position.volume}` : positionId.slice(-8);
  };

  return (
    <div className="p-6 border-b">
      <h3 className="text-lg font-semibold mb-4">アクション一覧</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedActions.length === actions.filter(a => a.status === ActionStatus.PENDING).length && actions.filter(a => a.status === ActionStatus.PENDING).length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>
              <TableHead>ID</TableHead>
              <TableHead>タイプ</TableHead>
              <TableHead>ポジション</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>作成日時</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {actions.map(action => (
              <TableRow key={action.id}>
                <TableCell>
                  {action.status === ActionStatus.PENDING && (
                    <Checkbox
                      checked={selectedActions.includes(action.id)}
                      onCheckedChange={(checked) => 
                        handleActionSelect(action.id, checked as boolean)
                      }
                    />
                  )}
                </TableCell>
                <TableCell className="text-sm">{action.id.slice(-8)}</TableCell>
                <TableCell>{action.type}</TableCell>
                <TableCell className="text-sm">{getPositionInfo(action.positionId)}</TableCell>
                <TableCell>
                  <StatusBadge status={action.status} />
                </TableCell>
                <TableCell className="text-sm">
                  {action.createdAt ? new Date(action.createdAt).toLocaleString('ja-JP') : '-'}
                </TableCell>
                <TableCell>
                  {action.status === ActionStatus.PENDING && (
                    <Button 
                      size="sm" 
                      onClick={() => onTriggerAction(action.id)}
                    >
                      実行
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export const ActionManager: React.FC<ActionManagerProps> = ({
  actions,
  positions,
  onCreateAction,
  onTriggerAction,
  onTriggerActions
}) => {
  const [selectedActions, setSelectedActions] = useState<string[]>([]);

  return (
    <div className="space-y-6">
      {/* アクション統計 */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard 
          title="待機中" 
          value={actions.filter(a => a.status === ActionStatus.PENDING).length}
          color="blue"
        />
        <StatCard 
          title="実行中" 
          value={actions.filter(a => a.status === ActionStatus.EXECUTING).length}
          color="orange"
        />
        <StatCard 
          title="完了" 
          value={actions.filter(a => a.status === ActionStatus.EXECUTED).length}
          color="green"
        />
        <StatCard 
          title="失敗" 
          value={actions.filter(a => a.status === ActionStatus.FAILED).length}
          color="red"
        />
      </div>

      {/* バッチ操作 */}
      <Card className="p-4">
        <div className="flex justify-between items-center">
          <h4 className="font-medium">バッチ操作</h4>
          <Button 
            onClick={() => onTriggerActions(selectedActions)}
            disabled={selectedActions.length === 0}
            size="sm"
          >
            選択したアクションを実行 ({selectedActions.length})
          </Button>
        </div>
      </Card>

      {/* アクション一覧 */}
      <Card>
        <ActionTable 
          actions={actions}
          positions={positions}
          selectedActions={selectedActions}
          onSelectionChange={setSelectedActions}
          onTriggerAction={onTriggerAction}
        />
      </Card>
    </div>
  );
};