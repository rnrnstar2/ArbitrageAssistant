// Amplifyで自動生成される型（ClientPC、Account）は削除
// 独自機能の型定義のみ保持

export interface AccountGroup {
  id: string;
  name: string;
  description: string;
  accounts: string[];
  strategy: string;
  totalBalance: number;
  totalPositions: number;
}

export type TabType = "clients" | "accounts" | "groups" | "linking";