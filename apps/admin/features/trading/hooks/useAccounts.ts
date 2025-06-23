"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@repo/shared-backend/amplify/data/resource";

const client = generateClient<Schema>();

// Note: Account model is not yet implemented in Amplify schema
// Using mock data for MVP

import type { User, AccountWithStatus } from '../types/types';

// 開発用ダミーデータ（簡略化版）
const createMockUsersWithAccounts = (): User[] => [
  {
    id: "user-1",
    email: "trader1@example.com",
    name: "トレーダー田中",
    role: "client",
    accounts: [
      {
        id: "account-1",
        userId: "user-1",
        name: "OANDAメイン口座",
        broker: "OANDA",
        accountNumber: "101-004-1234567-001",
        balance: 1000000,
        credit: 50000,
        leverage: 100,
        status: "online",
      },
      {
        id: "account-2",
        userId: "user-1",
        name: "XMサブ口座",
        broker: "XM",
        accountNumber: "12345678",
        balance: 500000,
        credit: 25000,
        leverage: 888,
        status: "online",
      },
    ],
  },
  {
    id: "user-2",
    email: "trader2@example.com",
    name: "トレーダー佐藤",
    role: "client",
    accounts: [
      {
        id: "account-3",
        userId: "user-2",
        name: "FXGTヘッジ口座",
        broker: "FXGT",
        accountNumber: "987654321",
        balance: 750000,
        credit: 100000,
        leverage: 1000,
        status: "online",
      },
      {
        id: "account-4",
        userId: "user-2",
        name: "TitanFX口座",
        broker: "TitanFX",
        accountNumber: "1122334455",
        balance: 300000,
        credit: 0,
        leverage: 500,
        status: "online",
      },
    ],
  },
];

export function useAccounts() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      
      // 開発用：階層構造ダミーデータを使用
      const mockUsers = createMockUsersWithAccounts();
      setUsers(mockUsers);
      
      // 実際のプロダクションでは以下のAmplifyクエリを使用
      // const result = await client.models.User.list({
      //   include: {
      //     clientPCs: {
      //       include: {
      //         accounts: true
      //       }
      //     }
      //   }
      // });
      // if (result.errors) {
      //   throw new Error(result.errors[0].message);
      // }
      // setUsers(result.data);
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  // 全アカウント取得（後方互換性のため）
  const getAllAccounts = (): AccountWithStatus[] => {
    return users.flatMap(user => user.accounts);
  };

  // ユーザー別アカウント取得
  const getAccountsByUser = (userId: string): AccountWithStatus[] => {
    const user = users.find(u => u.id === userId);
    return user ? user.accounts : [];
  };

  useEffect(() => {
    loadAccounts();

    // 開発用：リアルタイムサブスクリプションを無効化
    // 実際のプロダクションでは以下を有効化
    // const subscription = client.models.Account.observeQuery().subscribe({
    //   next: ({ items, isSynced }) => {
    //     if (isSynced) {
    //       setAccounts(items);
    //       setLoading(false);
    //     }
    //   },
    //   error: (error) => {
    //     console.error("Account subscription error:", error);
    //   }
    // });

    // return () => {
    //   subscription.unsubscribe();
    // };
  }, []);

  return {
    users,
    accounts: getAllAccounts() as any[], // 後方互換性のため
    loading,
    loadAccounts,
    getAllAccounts,
    getAccountsByUser,
  };
}