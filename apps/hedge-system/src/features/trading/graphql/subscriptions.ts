// Position related subscriptions
export const onPositionCreated = /* GraphQL */ `
  subscription OnPositionCreated(
    $filter: ModelSubscriptionPositionFilterInput
  ) {
    onPositionCreated(filter: $filter) {
      id
      accountId
      symbol
      type
      lots
      openPrice
      currentPrice
      profit
      swapTotal
      status
      openedAt
      closedAt
      account {
        id
        broker
        accountNumber
        balance
        bonusAmount
        equity
        marginLevel
      }
      createdAt
      updatedAt
    }
  }
`;

export const onPositionUpdated = /* GraphQL */ `
  subscription OnPositionUpdated(
    $filter: ModelSubscriptionPositionFilterInput
  ) {
    onPositionUpdated(filter: $filter) {
      id
      accountId
      symbol
      type
      lots
      openPrice
      currentPrice
      profit
      swapTotal
      status
      openedAt
      closedAt
      account {
        id
        broker
        accountNumber
        balance
        bonusAmount
        equity
        marginLevel
      }
      createdAt
      updatedAt
    }
  }
`;

export const onPositionDeleted = /* GraphQL */ `
  subscription OnPositionDeleted(
    $filter: ModelSubscriptionPositionFilterInput
  ) {
    onPositionDeleted(filter: $filter) {
      id
      accountId
      symbol
      type
      lots
      openPrice
      currentPrice
      profit
      swapTotal
      status
      openedAt
      closedAt
      createdAt
      updatedAt
    }
  }
`;

// Account related subscriptions
export const onAccountUpdated = /* GraphQL */ `
  subscription OnAccountUpdated(
    $filter: ModelSubscriptionAccountFilterInput
  ) {
    onAccountUpdated(filter: $filter) {
      id
      clientPCId
      broker
      accountNumber
      balance
      bonusAmount
      equity
      marginLevel
      createdAt
      updatedAt
    }
  }
`;

// Type definitions for subscription responses
export interface OnPositionCreatedSubscription {
  onPositionCreated: {
    id: string;
    accountId: string;
    symbol: string;
    type: 'buy' | 'sell';
    lots: number;
    openPrice: number;
    currentPrice: number;
    profit: number;
    swapTotal?: number;
    status: string;
    openedAt: string;
    closedAt?: string;
    account?: {
      id: string;
      broker: string;
      accountNumber: string;
      balance: number;
      bonusAmount: number;
      equity: number;
      marginLevel?: number;
    };
    createdAt: string;
    updatedAt: string;
  };
}

export interface OnPositionUpdatedSubscription {
  onPositionUpdated: {
    id: string;
    accountId: string;
    symbol: string;
    type: 'buy' | 'sell';
    lots: number;
    openPrice: number;
    currentPrice: number;
    profit: number;
    swapTotal?: number;
    status: string;
    openedAt: string;
    closedAt?: string;
    account?: {
      id: string;
      broker: string;
      accountNumber: string;
      balance: number;
      bonusAmount: number;
      equity: number;
      marginLevel?: number;
    };
    createdAt: string;
    updatedAt: string;
  };
}

export interface OnPositionDeletedSubscription {
  onPositionDeleted: {
    id: string;
    accountId: string;
    symbol: string;
    type: 'buy' | 'sell';
    lots: number;
    openPrice: number;
    currentPrice: number;
    profit: number;
    swapTotal?: number;
    status: string;
    openedAt: string;
    closedAt?: string;
    createdAt: string;
    updatedAt: string;
  };
}

export interface OnAccountUpdatedSubscription {
  onAccountUpdated: {
    id: string;
    clientPCId: string;
    broker: string;
    accountNumber: string;
    balance: number;
    bonusAmount: number;
    equity: number;
    marginLevel?: number;
    createdAt: string;
    updatedAt: string;
  };
}