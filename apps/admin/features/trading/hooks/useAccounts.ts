"use client";

import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "@repo/shared-backend/amplify/data/resource";

const client = generateClient<Schema>();

// Amplify生成型を使用
export type Account = Schema['Account']['type'];

export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const result = await client.models.Account.list();
      if (result.errors) {
        throw new Error(result.errors[0].message);
      }
      setAccounts(result.data);
    } catch (error) {
      console.error("Error loading accounts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();

    // リアルタイムサブスクリプション
    const subscription = client.models.Account.observeQuery().subscribe({
      next: ({ items, isSynced }) => {
        if (isSynced) {
          setAccounts(items);
          setLoading(false);
        }
      },
      error: (error) => {
        console.error("Account subscription error:", error);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return {
    accounts,
    loading,
    loadAccounts,
  };
}