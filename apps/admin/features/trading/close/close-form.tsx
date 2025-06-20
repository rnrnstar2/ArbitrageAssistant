"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { useToast } from "@repo/ui/hooks/use-toast";
import { Position } from "../../monitoring/types";
import { CloseFormData } from "./types";

interface CloseFormProps {
  position: Position | null;
  relatedPositions: Position[];
  onClose: (closeData: CloseFormData) => Promise<void>;
  onCancel: () => void;
}

export function CloseForm({ position, relatedPositions, onClose, onCancel }: CloseFormProps) {
  const [formData, setFormData] = useState<CloseFormData>({
    positionId: position?.id || "",
    closePrice: position?.currentPrice || 0,
    closeType: "market",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trailEnabled, setTrailEnabled] = useState(false);
  const [linkedActionEnabled, setLinkedActionEnabled] = useState(false);
  const { toast } = useToast();

  if (!position) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500">
            決済するポジションを選択してください
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.closeType === 'limit' && !formData.closePrice) {
      toast({
        title: "エラー",
        description: "指値決済の場合は決済価格を入力してください",
      });
      return;
    }

    if (trailEnabled && (!formData.trailSettings?.startPips || !formData.trailSettings?.trailPips)) {
      toast({
        title: "エラー",
        description: "トレール設定が不完全です",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const closeData = {
        ...formData,
        positionId: position.id,
        trailSettings: trailEnabled ? formData.trailSettings : undefined,
        linkedAction: linkedActionEnabled ? formData.linkedAction : undefined,
      };

      await onClose(closeData);
      
      toast({
        title: "決済指示送信",
        description: "ポジションの決済指示を送信しました",
      });
    } catch (error) {
      console.error("Close error:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "決済指示の送信に失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedProfit = () => {
    if (formData.closeType === 'market') {
      return position.profit;
    }
    
    const priceDiff = position.type === 'buy' 
      ? formData.closePrice - position.openPrice
      : position.openPrice - formData.closePrice;
    
    return priceDiff * position.lots * 100000; // 仮の計算
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>ポジション決済設定</CardTitle>
        <div className="text-sm text-gray-600">
          {position.symbol} {position.type === 'buy' ? '買い' : '売り'} {position.lots} lot
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 現在の状況 */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">開始価格</div>
                <div className="font-medium">{position.openPrice}</div>
              </div>
              <div>
                <div className="text-gray-500">現在価格</div>
                <div className="font-medium">{position.currentPrice}</div>
              </div>
              <div>
                <div className="text-gray-500">現在損益</div>
                <div className={`font-medium ${position.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${position.profit.toFixed(2)}
                </div>
              </div>
              <div>
                <div className="text-gray-500">予想損益</div>
                <div className={`font-medium ${estimatedProfit() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${estimatedProfit().toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* 決済方法 */}
          <div className="space-y-2">
            <Label htmlFor="closeType">決済方法</Label>
            <Select
              value={formData.closeType}
              onValueChange={(value: string) => setFormData({ ...formData, closeType: value as 'market' | 'limit' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="market">成行決済</SelectItem>
                <SelectItem value="limit">指値決済</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 決済価格（指値の場合） */}
          {formData.closeType === 'limit' && (
            <div className="space-y-2">
              <Label htmlFor="closePrice">決済価格</Label>
              <Input
                id="closePrice"
                type="number"
                step="0.00001"
                value={formData.closePrice}
                onChange={(e) => setFormData({ ...formData, closePrice: parseFloat(e.target.value) || 0 })}
                placeholder="決済価格を入力"
              />
            </div>
          )}

          {/* トレール設定 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="trail-enabled"
                checked={trailEnabled}
                onCheckedChange={(checked: boolean) => setTrailEnabled(checked)}
              />
              <Label htmlFor="trail-enabled">決済時のトレール設定を有効にする</Label>
            </div>
            
            {trailEnabled && (
              <div className="ml-6 space-y-2">
                <div>
                  <Label htmlFor="trail-start">トレール開始PIPS</Label>
                  <Input
                    id="trail-start"
                    type="number"
                    min="1"
                    placeholder="10"
                    value={formData.trailSettings?.startPips || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        trailSettings: {
                          ...formData.trailSettings,
                          enabled: true,
                          startPips: parseInt(e.target.value) || 0,
                          trailPips: formData.trailSettings?.trailPips || 0,
                        },
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="trail-pips">トレール幅PIPS</Label>
                  <Input
                    id="trail-pips"
                    type="number"
                    min="1"
                    placeholder="5"
                    value={formData.trailSettings?.trailPips || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        trailSettings: {
                          ...formData.trailSettings,
                          enabled: true,
                          startPips: formData.trailSettings?.startPips || 0,
                          trailPips: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          {/* 関連ポジション連動設定 */}
          {relatedPositions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="linked-action-enabled"
                  checked={linkedActionEnabled}
                  onCheckedChange={(checked: boolean) => setLinkedActionEnabled(checked)}
                />
                <Label htmlFor="linked-action-enabled">関連ポジションの連動アクションを設定</Label>
              </div>
              
              {linkedActionEnabled && (
                <div className="ml-6 space-y-2">
                  <div>
                    <Label htmlFor="related-position">対象ポジション</Label>
                    <Select
                      value={formData.linkedAction?.relatedPositionId || ""}
                      onValueChange={(value: string) =>
                        setFormData({
                          ...formData,
                          linkedAction: {
                            ...formData.linkedAction,
                            relatedPositionId: value,
                            action: formData.linkedAction?.action || 'close',
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="関連ポジションを選択" />
                      </SelectTrigger>
                      <SelectContent>
                        {relatedPositions.map((relatedPos) => (
                          <SelectItem key={relatedPos.id} value={relatedPos.id}>
                            {relatedPos.symbol} {relatedPos.type === 'buy' ? '買い' : '売り'} {relatedPos.lots}lot
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="linked-action">連動アクション</Label>
                    <Select
                      value={formData.linkedAction?.action || "close"}
                      onValueChange={(value: string) =>
                        setFormData({
                          ...formData,
                          linkedAction: {
                            ...formData.linkedAction,
                            relatedPositionId: formData.linkedAction?.relatedPositionId || "",
                            action: value as 'close' | 'trail' | 'none',
                          },
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="close">同時決済</SelectItem>
                        <SelectItem value="trail">トレール開始</SelectItem>
                        <SelectItem value="none">何もしない</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "決済中..." : "決済実行"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              キャンセル
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}