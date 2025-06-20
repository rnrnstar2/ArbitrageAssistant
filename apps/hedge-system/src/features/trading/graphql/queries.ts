import { GraphQLResult } from '@aws-amplify/api-graphql';

// Position related queries
export const listPositions = /* GraphQL */ `
  query ListPositions(
    $filter: ModelPositionFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listPositions(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
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
      nextToken
    }
  }
`;

export const getPosition = /* GraphQL */ `
  query GetPosition($id: ID!) {
    getPosition(id: $id) {
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

// Account related queries
export const listAccounts = /* GraphQL */ `
  query ListAccounts(
    $filter: ModelAccountFilterInput
    $limit: Int
    $nextToken: String
  ) {
    listAccounts(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items {
        id
        clientPCId
        broker
        accountNumber
        balance
        bonusAmount
        equity
        marginLevel
        positions {
          items {
            id
            symbol
            type
            lots
            openPrice
            currentPrice
            profit
            status
            openedAt
          }
        }
        createdAt
        updatedAt
      }
      nextToken
    }
  }
`;

// Type definitions for API responses
export interface Position {
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
}

export interface Account {
  id: string;
  clientPCId: string;
  broker: string;
  accountNumber: string;
  balance: number;
  bonusAmount: number;
  equity: number;
  marginLevel?: number;
  positions?: {
    items: Position[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ListPositionsResponse {
  listPositions: {
    items: Position[];
    nextToken?: string;
  };
}

export interface ListAccountsResponse {
  listAccounts: {
    items: Account[];
    nextToken?: string;
  };
}

export interface GetPositionResponse {
  getPosition: Position;
}