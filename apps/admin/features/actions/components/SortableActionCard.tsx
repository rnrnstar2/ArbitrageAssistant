"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Button } from "@repo/ui/components/ui/button";
import { Badge } from "@repo/ui/components/ui/badge";
import { 
  GripVertical, 
  TrendingUp, 
  X, 
  Percent, 
  DollarSign, 
  Clock, 
  Trash2,
  User,
  Building
} from "lucide-react";
import { cn } from "@repo/ui/lib/utils";

interface Action {
  id: string;
  type: 'ENTRY' | 'CLOSE' | 'PARTIAL_CLOSE' | 'TRAIL_SET' | 'WAIT';
  userId?: string;
  accountId?: string;
  parameters: Record<string, any>;
  status: string;
}

interface SortableActionCardProps {
  action: Action;
  index: number;
  onDelete: (id: string) => void;
}

export function SortableActionCard({ action, index, onDelete }: SortableActionCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: action.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // アクションタイプごとのスタイリング
  const actionConfig = {
    ENTRY: {
      icon: <TrendingUp className="h-4 w-4" />,
      color: "bg-green-100 border-green-300 text-green-800",
      label: "エントリー"
    },
    CLOSE: {
      icon: <X className="h-4 w-4" />,
      color: "bg-red-100 border-red-300 text-red-800",
      label: "決済"
    },
    PARTIAL_CLOSE: {
      icon: <Percent className="h-4 w-4" />,
      color: "bg-orange-100 border-orange-300 text-orange-800",
      label: "部分決済"
    },
    TRAIL_SET: {
      icon: <DollarSign className="h-4 w-4" />,
      color: "bg-blue-100 border-blue-300 text-blue-800",
      label: "トレール設定"
    },
    WAIT: {
      icon: <Clock className="h-4 w-4" />,
      color: "bg-gray-100 border-gray-300 text-gray-800",
      label: "待機"
    },
  };

  const config = actionConfig[action.type];

  // パラメータの表示用文字列を生成
  const getParameterDisplay = () => {
    const { parameters } = action;
    
    switch (action.type) {
      case 'ENTRY':
        return `${parameters.symbol} ${parameters.direction === 'BUY' ? '買い' : '売り'} ${parameters.lots}lot`;
      case 'CLOSE':
        return '全決済';
      case 'PARTIAL_CLOSE':
        return `${(parameters.closeRatio * 100).toFixed(0)}% 部分決済`;
      case 'TRAIL_SET':
        return `トレール幅: ${parameters.trailDistance}pips ステップ: ${parameters.trailStep}pips`;
      case 'WAIT':
        return `${parameters.waitSeconds}秒 待機`;
      default:
        return '';
    }
  };

  // アカウント情報の表示
  const getAccountDisplay = () => {
    if (action.type === 'WAIT') return null;
    
    // ここは実際のデータから取得する
    const userNames: Record<string, string> = {
      'user1': '田中太郎',
      'user2': '山田花子'
    };
    
    const accountNames: Record<string, string> = {
      'acc1': 'XM - 12345678',
      'acc2': 'TitanFX - 87654321'
    };

    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <User className="h-3 w-3" />
        <span>{userNames[action.userId || ''] || action.userId}</span>
        <Building className="h-3 w-3 ml-2" />
        <span>{accountNames[action.accountId || ''] || action.accountId}</span>
      </div>
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative",
        isDragging && "opacity-50 rotate-2 shadow-lg"
      )}
    >
      <Card className={cn(
        "transition-all duration-200",
        isDragging && "shadow-lg scale-105"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            {/* ドラッグハンドル */}
            <div
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors"
            >
              <GripVertical className="h-4 w-4" />
            </div>

            {/* 順序番号 */}
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium">
              {index + 1}
            </div>

            {/* アクションタイプバッジ */}
            <Badge variant="outline" className={cn("px-2 py-1", config.color)}>
              {config.icon}
              <span className="ml-1">{config.label}</span>
            </Badge>

            {/* アクション詳細 */}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm truncate">
                {getParameterDisplay()}
              </div>
              {getAccountDisplay()}
            </div>

            {/* ステータス */}
            <Badge 
              variant={action.status === 'PENDING' ? 'secondary' : 'default'}
              className="text-xs"
            >
              {action.status === 'PENDING' && '待機中'}
              {action.status === 'EXECUTING' && '実行中'}
              {action.status === 'COMPLETED' && '完了'}
              {action.status === 'FAILED' && '失敗'}
            </Badge>

            {/* 削除ボタン */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(action.id)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}