"use client";

import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Label } from "@repo/ui/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { useToast } from "@repo/ui/hooks/use-toast";

interface EntryFormData {
  accountId: string;
  symbol: string;
  type: "buy" | "sell";
  lots: number;
  price?: number;
}

interface Account {
  id: string;
  broker: string;
  accountNumber: string;
  balance: number;
}

interface EntryFormProps {
  accounts: Account[];
  onEntrySubmitted?: (data: EntryFormData) => void;
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
  const { toast } = useToast();

  const validateForm = (): boolean => {
    if (!formData.accountId) {
      toast({
        title: "エラー",
        description: "取引口座を選択してください",
      });
      return false;
    }

    if (!formData.symbol) {
      toast({
        title: "エラー",
        description: "通貨ペアを選択してください",
      });
      return false;
    }

    if (formData.lots <= 0) {
      toast({
        title: "エラー",
        description: "ロット数は0より大きい値を入力してください",
      });
      return false;
    }

    if (formData.price && formData.price <= 0) {
      toast({
        title: "エラー",
        description: "指値価格は0より大きい値を入力してください",
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // TODO: WebSocket経由でEAにエントリーコマンドを送信
      // 現在はモックとしてonEntrySubmittedコールバックのみ呼び出し
      await new Promise(resolve => setTimeout(resolve, 1000)); // 送信シミュレーション

      toast({
        title: "エントリー送信完了",
        description: `${formData.symbol} ${formData.type.toUpperCase()} ${formData.lots}ロットのエントリー指示を送信しました`,
      });

      // フォームリセット
      setFormData({
        accountId: "",
        symbol: "",
        type: "buy",
        lots: 0.01,
      });

      onEntrySubmitted?.(formData);
    } catch (error) {
      console.error("Entry error:", error);
      toast({
        title: "エラー",
        description: error instanceof Error ? error.message : "エントリー送信に失敗しました",
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

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "エントリー送信中..." : "エントリー実行"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}