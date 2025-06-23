import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@repo/shared-backend/amplify/data/resource";

const client = generateClient<Schema>();

// Amplify生成型を使用
export type ClientPC = Schema['ClientPC']['type'];
export type Account = Schema['Account']['type'];

// アカウントグループは独自機能のため型定義を保持
export interface AccountGroup {
  id: string;
  name: string;
  description: string;
  accounts: string[];
  strategy: string;
  totalBalance: number;
  totalPositions: number;
}

export const useClientsData = () => {
  const [clients, setClients] = useState<ClientPC[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // 初期データロード
        const [clientsResult, accountsResult] = await Promise.all([
          client.models.ClientPC.list(),
          client.models.Account.list()
        ]);

        if (clientsResult.errors) {
          throw new Error(clientsResult.errors[0].message);
        }
        if (accountsResult.errors) {
          throw new Error(accountsResult.errors[0].message);
        }

        setClients(clientsResult.data);
        setAccounts(accountsResult.data);

        // グループ機能は将来の拡張として一時的にモックデータ
        setGroups([
          {
            id: "group-main",
            name: "メインアービトラージ群",
            description: "EUR/USD、USD/JPY基本戦略用口座群",
            accounts: [],
            strategy: "アービトラージ戦略",
            totalBalance: 0,
            totalPositions: 0,
          },
          {
            id: "group-hedge",
            name: "ヘッジ戦略群",
            description: "リスクヘッジ・分散投資用口座群",
            accounts: [],
            strategy: "ヘッジ戦略",
            totalBalance: 0,
            totalPositions: 0,
          },
        ]);
      } catch (error) {
        console.error("Data loading failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // リアルタイムサブスクリプション
    const clientsSubscription = client.models.ClientPC.observeQuery().subscribe({
      next: ({ items, isSynced }) => {
        if (isSynced) {
          setClients(items);
        }
      },
      error: (error) => {
        console.error("ClientPC subscription error:", error);
      }
    });

    const accountsSubscription = client.models.Account.observeQuery().subscribe({
      next: ({ items, isSynced }) => {
        if (isSynced) {
          setAccounts(items);
        }
      },
      error: (error) => {
        console.error("Account subscription error:", error);
      }
    });

    return () => {
      clientsSubscription.unsubscribe();
      accountsSubscription.unsubscribe();
    };
  }, []);

  return { clients, accounts, groups, isLoading };
};