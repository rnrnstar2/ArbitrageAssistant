"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { Badge } from "@repo/ui/components/ui/badge";
import { Separator } from "@repo/ui/components/ui/separator";
import { Position } from "../../monitoring/types";
import { CloseRecommendation } from "./types";

interface PositionListForCloseProps {
  positions: Position[];
  recommendations: CloseRecommendation[];
  selectedPositions: string[];
  onSelectionChange: (positionIds: string[]) => void;
  onPositionClick: (position: Position) => void;
}

export function PositionListForClose({
  positions,
  recommendations,
  selectedPositions,
  onSelectionChange,
  onPositionClick,
}: PositionListForCloseProps) {
  const [showOnlyRecommended, setShowOnlyRecommended] = useState(false);

  const getRecommendation = (positionId: string) => {
    return recommendations.find(r => r.positionId === positionId);
  };

  const getHoldingDays = (openTime: Date) => {
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - openTime.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getSwapCost = (position: Position) => {
    // スワップコストの概算計算
    const holdingDays = getHoldingDays(position.openTime);
    return holdingDays * position.lots * 0.5; // 仮の計算式
  };

  const filteredPositions = showOnlyRecommended
    ? positions.filter(p => recommendations.some(r => r.positionId === p.id))
    : positions;

  const groupedPositions = filteredPositions.reduce((groups, position) => {
    if (position.relatedPositionId) {
      const relatedPosition = positions.find(p => p.id === position.relatedPositionId);
      if (relatedPosition) {
        const pairKey = [position.id, position.relatedPositionId].sort().join('-');
        if (!groups[pairKey]) {
          groups[pairKey] = [];
        }
        if (!groups[pairKey].some(p => p.id === position.id)) {
          groups[pairKey].push(position);
        }
        if (!groups[pairKey].some(p => p.id === relatedPosition.id)) {
          groups[pairKey].push(relatedPosition);
        }
      }
    } else {
      groups[position.id] = [position];
    }
    return groups;
  }, {} as Record<string, Position[]>);

  const handleSelectAll = () => {
    const allIds = filteredPositions.map(p => p.id);
    const areAllSelected = allIds.every(id => selectedPositions.includes(id));
    
    if (areAllSelected) {
      onSelectionChange(selectedPositions.filter(id => !allIds.includes(id)));
    } else {
      onSelectionChange([...new Set([...selectedPositions, ...allIds])]);
    }
  };

  const handlePositionToggle = (positionId: string) => {
    if (selectedPositions.includes(positionId)) {
      onSelectionChange(selectedPositions.filter(id => id !== positionId));
    } else {
      onSelectionChange([...selectedPositions, positionId]);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'destructive';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getReasonText = (reason: string) => {
    switch (reason) {
      case 'high_swap': return 'スワップ高';
      case 'long_holding': return '長期保有';
      case 'profit_target': return '利益目標';
      case 'risk_management': return 'リスク管理';
      default: return reason;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>決済対象ポジション</CardTitle>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="show-recommended"
                checked={showOnlyRecommended}
                onCheckedChange={(checked: boolean) => setShowOnlyRecommended(checked)}
              />
              <label htmlFor="show-recommended" className="text-sm">
                推奨のみ表示
              </label>
            </div>
            <Button variant="outline" size="sm" onClick={handleSelectAll}>
              {filteredPositions.every(p => selectedPositions.includes(p.id)) ? '全選択解除' : '全選択'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(groupedPositions).map(([groupKey, groupPositions]) => (
            <div key={groupKey} className="border rounded-lg p-4">
              {groupPositions.length > 1 && (
                <div className="flex items-center mb-2">
                  <Badge variant="secondary" className="text-xs">
                    両建てペア
                  </Badge>
                </div>
              )}
              
              <div className="space-y-2">
                {groupPositions.map((position) => {
                  const recommendation = getRecommendation(position.id);
                  const holdingDays = getHoldingDays(position.openTime);
                  const swapCost = getSwapCost(position);
                  const isSelected = selectedPositions.includes(position.id);

                  return (
                    <div
                      key={position.id}
                      className={`flex items-center space-x-3 p-3 border rounded cursor-pointer transition-colors ${
                        isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50'
                      }`}
                      onClick={() => onPositionClick(position)}
                    >
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handlePositionToggle(position.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      
                      <div className="flex-1 grid grid-cols-8 gap-2 items-center text-sm">
                        <div>
                          <div className="font-medium">{position.symbol}</div>
                          <div className="text-xs text-gray-500">
                            {position.type === 'buy' ? '買い' : '売り'}
                          </div>
                        </div>
                        
                        <div>
                          <div>{position.lots} lot</div>
                          <div className="text-xs text-gray-500">
                            開始: {position.openPrice}
                          </div>
                        </div>
                        
                        <div>
                          <div className="font-medium">{position.currentPrice}</div>
                          <div className="text-xs text-gray-500">現在価格</div>
                        </div>
                        
                        <div>
                          <div className={`font-medium ${position.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${position.profit.toFixed(2)}
                          </div>
                          <div className="text-xs text-gray-500">損益</div>
                        </div>
                        
                        <div>
                          <div>{holdingDays}日</div>
                          <div className="text-xs text-gray-500">保有期間</div>
                        </div>
                        
                        <div>
                          <div className="text-red-600">-${swapCost.toFixed(2)}</div>
                          <div className="text-xs text-gray-500">スワップ累計</div>
                        </div>
                        
                        <div>
                          {recommendation && (
                            <Badge variant={getPriorityColor(recommendation.priority)} className="text-xs">
                              {getReasonText(recommendation.reason)}
                            </Badge>
                          )}
                        </div>
                        
                        <div>
                          {position.trailSettings?.enabled && (
                            <Badge variant="outline" className="text-xs">
                              トレール中
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {groupPositions.length > 1 && (
                <>
                  <Separator className="my-2" />
                  <div className="text-xs text-gray-500 flex justify-between">
                    <span>ペア損益: </span>
                    <span className={`font-medium ${
                      groupPositions.reduce((sum, p) => sum + p.profit, 0) >= 0 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      ${groupPositions.reduce((sum, p) => sum + p.profit, 0).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
          
          {filteredPositions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              {showOnlyRecommended ? '推奨される決済対象ポジションがありません' : '決済対象ポジションがありません'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}