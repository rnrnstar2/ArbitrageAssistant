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

  const pendingCount = actions.filter(a => a.status === ActionStatus.PENDING).length;
  const executingCount = actions.filter(a => a.status === ActionStatus.EXECUTING).length;
  const executedCount = actions.filter(a => a.status === ActionStatus.EXECUTED).length;
  const failedCount = actions.filter(a => a.status === ActionStatus.FAILED).length;

  return (
    <div className="space-y-4">
      {/* Quick Stats */}
      <div className="flex gap-4 text-sm">
        <span>待機中: <strong className="text-blue-600">{pendingCount}</strong></span>
        <span>実行中: <strong className="text-orange-600">{executingCount}</strong></span>
        <span>完了: <strong className="text-green-600">{executedCount}</strong></span>
        <span>失敗: <strong className="text-red-600">{failedCount}</strong></span>
      </div>

      {/* Batch Actions */}
      {selectedActions.length > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <span className="text-sm">{selectedActions.length}個選択中</span>
          <Button 
            onClick={() => onTriggerActions(selectedActions)}
            size="sm"
          >
            一括実行
          </Button>
        </div>
      )}

      {/* Action List */}
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