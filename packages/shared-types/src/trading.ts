// Account interface (core MVP table)
export interface Account {
  id: string;
  userId: string;
  brokerType: string;  // MT4/MT5
  accountNumber: string;
  serverName?: string;
  displayName: string;
  balance: number;
  credit: number;
  equity: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number;
  isActive?: boolean;
  lastUpdated?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Account update input
export interface UpdateAccountInput {
  id: string;
  balance?: number;
  credit?: number;
  equity?: number;
  margin?: number;
  freeMargin?: number;
  marginLevel?: number;
  lastUpdated?: string;
}