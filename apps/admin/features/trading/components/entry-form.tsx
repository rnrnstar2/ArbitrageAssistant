"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Checkbox } from "@repo/ui/components/ui/checkbox";
import { useToast } from "@repo/ui/hooks/use-toast";
// MVPでは直接API呼び出しに簡略化

interface EntryFormData {
  accountId: string;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  price?: number;
  trailSettings?: {
    enabled: boolean;
    startPips: number;
    trailPips: number;
  };
  hedgeSettings?: {
    enabled: boolean;
    targetAccountId: string;
    delaySeconds: number;
  };
}

interface EntryFormProps {
  accounts: Array<{
    id: string;
    broker: string;
    accountNumber: string;
    balance: number;
  }>;
  onEntrySubmitted?: () => void;
}

const SYMBOLS = [
  "EURUSD",
  "GBPUSD",
  "USDJPY",
  "USDCHF",
  "AUDUSD",
  "USDCAD",
  "NZDUSD",
  "EURGBP",
  "EURJPY",
  "GBPJPY",
];

export function EntryForm({ accounts, onEntrySubmitted }: EntryFormProps) {
  const [formData, setFormData] = useState<EntryFormData>({
    accountId: "",
    symbol: "",
    type: "buy",
    lots: 0.01,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trailEnabled, setTrailEnabled] = useState(false);
  const [hedgeEnabled, setHedgeEnabled] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.accountId || !formData.symbol || formData.lots <= 0) {
      toast({
        title: "エラー",
        description: "必須項目を入力してください",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const entryData = {
        ...formData,
        trailSettings: trailEnabled ? formData.trailSettings : undefined,
        hedgeSettings: hedgeEnabled ? formData.hedgeSettings : undefined,
      };

      // MVPでは簡略化された処理
      const result = { 
        success: true, 
        message: "エントリーが送信されました（モック）",
        entryId: "mock-entry-id",
        error: null
      };
      
      if (result.success) {
        toast({
          title: "エントリー成功",
          description: `エントリーID: ${result.entryId}`,
        });
        
        // フォームリセット
        setFormData({
          accountId: "",
          symbol: "",
          type: "buy",
          lots: 0.01,
        });
        setTrailEnabled(false);
        setHedgeEnabled(false);
        
        onEntrySubmitted?.();
      } else {
        throw new Error(result.error || "エントリーに失敗しました");
      }
    } catch (error) {
      console.error("Entry error:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "エントリーに失敗しました",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>新規エントリー</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* アカウント選択 */}
          <div className="space-y-2">
            <Label htmlFor="account">取引口座</Label>
            <Select
              value={formData.accountId}
              onValueChange={(value: string) => setFormData({ ...formData, accountId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="取引口座を選択" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.broker} - {account.accountNumber} (残高: ${account.balance.toFixed(2)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 通貨ペア選択 */}
          <div className="space-y-2">
            <Label htmlFor="symbol">通貨ペア</Label>
            <Select
              value={formData.symbol}
              onValueChange={(value: string) => setFormData({ ...formData, symbol: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="通貨ペアを選択" />
              </SelectTrigger>
              <SelectContent>
                {SYMBOLS.map((symbol) => (
                  <SelectItem key={symbol} value={symbol}>
                    {symbol}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 売買方向 */}
          <div className="space-y-2">
            <Label htmlFor="type">売買方向</Label>
            <Select
              value={formData.type}
              onValueChange={(value: string) => setFormData({ ...formData, type: value as "buy" | "sell" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="buy">買い (Buy)</SelectItem>
                <SelectItem value="sell">売り (Sell)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ロット数 */}
          <div className="space-y-2">
            <Label htmlFor="lots">ロット数</Label>
            <Input
              id="lots"
              type="number"
              step="0.01"
              min="0.01"
              value={formData.lots}
              onChange={(e) => setFormData({ ...formData, lots: parseFloat(e.target.value) || 0 })}
            />
          </div>

          {/* 指値価格（オプション） */}
          <div className="space-y-2">
            <Label htmlFor="price">指値価格（オプション）</Label>
            <Input
              id="price"
              type="number"
              step="0.00001"
              placeholder="成行の場合は空欄"
              value={formData.price || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  price: e.target.value ? parseFloat(e.target.value) : undefined,
                })
              }
            />
          </div>

          {/* トレール設定 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="trail-enabled"
                checked={trailEnabled}
                onCheckedChange={(checked: boolean) => setTrailEnabled(checked)}
              />
              <Label htmlFor="trail-enabled">トレール設定を有効にする</Label>
            </div>
            
            {trailEnabled && (
              <div className="ml-6 space-y-2">
                <div>
                  <Label htmlFor="trail-start">開始PIPS</Label>
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
                  <Label htmlFor="trail-pips">トレールPIPS</Label>
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

          {/* 両建て設定 */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hedge-enabled"
                checked={hedgeEnabled}
                onCheckedChange={(checked: boolean) => setHedgeEnabled(checked)}
              />
              <Label htmlFor="hedge-enabled">両建て設定を有効にする</Label>
            </div>
            
            {hedgeEnabled && (
              <div className="ml-6 space-y-2">
                <div>
                  <Label htmlFor="hedge-account">対象アカウント</Label>
                  <Select
                    value={formData.hedgeSettings?.targetAccountId || ""}
                    onValueChange={(value: string) =>
                      setFormData({
                        ...formData,
                        hedgeSettings: {
                          ...formData.hedgeSettings,
                          enabled: true,
                          targetAccountId: value,
                          delaySeconds: formData.hedgeSettings?.delaySeconds || 0,
                        },
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="対象アカウントを選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((account) => account.id !== formData.accountId)
                        .map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            {account.broker} - {account.accountNumber}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="hedge-delay">遅延秒数</Label>
                  <Input
                    id="hedge-delay"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.hedgeSettings?.delaySeconds || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        hedgeSettings: {
                          ...formData.hedgeSettings,
                          enabled: true,
                          targetAccountId: formData.hedgeSettings?.targetAccountId || "",
                          delaySeconds: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "エントリー中..." : "エントリー実行"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}