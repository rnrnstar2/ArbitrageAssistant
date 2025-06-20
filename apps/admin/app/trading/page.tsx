"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@repo/shared-backend/amplify/data/resource";
import { EntryForm } from "@/features/trading/entry/entry-form";
import { EntryHistoryTable } from "@/features/trading/history/entry-history-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";

const client = generateClient<Schema>();

interface Account {
  id: string;
  broker: string;
  accountNumber: string;
  balance: number;
  bonusAmount: number;
  equity: number;
  marginLevel?: number;
}

export default function TradingPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const result = await client.models.Account.list();
      setAccounts(result.data as Account[]);
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const handleEntrySubmitted = () => {
    // エントリー履歴を更新
    setRefreshTrigger(prev => prev + 1);
    // 必要に応じてアカウント情報も更新
    loadAccounts();
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">トレード管理</h1>
        <p className="text-gray-600">手動エントリーとトレード履歴の管理</p>
      </div>

      <Tabs defaultValue="entry" className="space-y-6">
        <TabsList>
          <TabsTrigger value="entry">新規エントリー</TabsTrigger>
          <TabsTrigger value="history">エントリー履歴</TabsTrigger>
        </TabsList>

        <TabsContent value="entry" className="space-y-6">
          {accounts.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">利用可能なアカウントがありません</p>
              <p className="text-sm text-gray-400 mt-2">
                まずクライアントPCを接続してアカウントを登録してください
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <EntryForm accounts={accounts} onEntrySubmitted={handleEntrySubmitted} />
              </div>
              <div>
                <div className="bg-white rounded-lg p-6 border">
                  <h3 className="text-lg font-semibold mb-4">アカウント一覧</h3>
                  <div className="space-y-3">
                    {accounts.map((account) => (
                      <div
                        key={account.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium">
                            {account.broker} - {account.accountNumber}
                          </div>
                          <div className="text-sm text-gray-600">
                            残高: ${account.balance.toFixed(2)} | 
                            ボーナス: ${account.bonusAmount.toFixed(2)} | 
                            有効証拠金: ${account.equity.toFixed(2)}
                          </div>
                        </div>
                        <div className="text-right">
                          {account.marginLevel && (
                            <div className="text-sm">
                              証拠金維持率: {account.marginLevel.toFixed(1)}%
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          <EntryHistoryTable 
            accounts={accounts} 
            refreshTrigger={refreshTrigger}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}