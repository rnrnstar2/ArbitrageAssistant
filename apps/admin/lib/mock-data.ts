import type { 
  User, 
  Account, 
  Position, 
  Action,
  UserRole,
  PCStatus,
  Symbol,
  PositionStatus,
  ExecutionType,
  ActionType,
  ActionStatus
} from '@repo/shared-types';

// シンプルなダミーデータ生成

const generateId = () => Math.random().toString(36).substring(2, 15);

const randomChoice = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const randomNumber = (min: number, max: number, decimals = 0) => {
  const num = Math.random() * (max - min) + min;
  return Number(num.toFixed(decimals));
};

const randomDate = (daysBack = 30) => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date.toISOString();
};

// ダミーユーザー
export const dummyUsers: User[] = [
  {
    id: 'user-1',
    email: 'user1@example.com',
    name: 'テストユーザー1',
    role: 'CLIENT' as UserRole,
    pcStatus: 'ONLINE' as PCStatus,
    isActive: true,
    createdAt: randomDate(60),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-2',
    email: 'user2@example.com',
    name: 'テストユーザー2',
    role: 'CLIENT' as UserRole,
    pcStatus: 'OFFLINE' as PCStatus,
    isActive: true,
    createdAt: randomDate(60),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'user-3',
    email: 'admin@example.com',
    name: '管理者',
    role: 'ADMIN' as UserRole,
    pcStatus: 'ONLINE' as PCStatus,
    isActive: true,
    createdAt: randomDate(60),
    updatedAt: new Date().toISOString()
  }
];

// ダミー口座
export const dummyAccounts: Account[] = [
  {
    id: 'acc-1',
    userId: 'user-1',
    brokerType: 'MetaTrader4',
    accountNumber: '12345678',
    serverName: 'LiveServer-1',
    displayName: 'MT4 - 12345678',
    balance: 100000.50,
    credit: 25000.00,
    equity: 125000.50,
    isActive: true,
    lastUpdated: randomDate(1),
    createdAt: randomDate(30),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'acc-2',
    userId: 'user-1',
    brokerType: 'MetaTrader5',
    accountNumber: '87654321',
    serverName: 'LiveServer-2',
    displayName: 'MT5 - 87654321',
    balance: 75000.00,
    credit: 10000.00,
    equity: 85000.00,
    isActive: true,
    lastUpdated: randomDate(1),
    createdAt: randomDate(30),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'acc-3',
    userId: 'user-2',
    brokerType: 'cTrader',
    accountNumber: '11223344',
    serverName: 'DemoServer-1',
    displayName: 'cTrader - 11223344',
    balance: 50000.00,
    credit: 0.00,
    equity: 50000.00,
    isActive: false,
    lastUpdated: randomDate(3),
    createdAt: randomDate(30),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'acc-4',
    userId: 'user-2',
    brokerType: 'MetaTrader4',
    accountNumber: '44332211',
    serverName: 'LiveServer-1',
    displayName: 'MT4 - 44332211',
    balance: 200000.00,
    credit: 50000.00,
    equity: 250000.00,
    isActive: true,
    lastUpdated: randomDate(1),
    createdAt: randomDate(30),
    updatedAt: new Date().toISOString()
  }
];

// ダミーポジション
export const dummyPositions: Position[] = [
  {
    id: 'pos-1',
    userId: 'user-1',
    accountId: 'acc-1',
    executionType: 'ENTRY' as ExecutionType,
    status: 'OPEN' as PositionStatus,
    symbol: 'USDJPY' as Symbol,
    volume: 1.0,
    entryPrice: 150.123,
    entryTime: randomDate(5),
    exitPrice: null,
    exitTime: null,
    exitReason: null,
    trailWidth: 50,
    triggerActionIds: null,
    mtTicket: '12345',
    memo: 'USD/JPY買いポジション',
    createdAt: randomDate(7),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pos-2',
    userId: 'user-1',
    accountId: 'acc-1',
    executionType: 'EXIT' as ExecutionType,
    status: 'OPEN' as PositionStatus,
    symbol: 'EURUSD' as Symbol,
    volume: 0.5,
    entryPrice: 1.0850,
    entryTime: randomDate(3),
    exitPrice: null,
    exitTime: null,
    exitReason: null,
    trailWidth: 30,
    triggerActionIds: null,
    mtTicket: '12346',
    memo: 'EUR/USD売りポジション',
    createdAt: randomDate(5),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'pos-3',
    userId: 'user-2',
    accountId: 'acc-4',
    executionType: 'ENTRY' as ExecutionType,
    status: 'CLOSED' as PositionStatus,
    symbol: 'XAUUSD' as Symbol,
    volume: 0.1,
    entryPrice: 2000.50,
    entryTime: randomDate(10),
    exitPrice: 2010.30,
    exitTime: randomDate(2),
    exitReason: 'TAKE_PROFIT',
    trailWidth: null,
    triggerActionIds: null,
    mtTicket: '12347',
    memo: 'ゴールド取引完了',
    createdAt: randomDate(12),
    updatedAt: randomDate(2)
  },
  {
    id: 'pos-4',
    userId: 'user-1',
    accountId: 'acc-2',
    executionType: 'ENTRY' as ExecutionType,
    status: 'PENDING' as PositionStatus,
    symbol: 'EURGBP' as Symbol,
    volume: 2.0,
    entryPrice: null,
    entryTime: null,
    exitPrice: null,
    exitTime: null,
    exitReason: null,
    trailWidth: 25,
    triggerActionIds: 'action-1,action-2',
    mtTicket: null,
    memo: '待機中のEUR/GBPポジション',
    createdAt: randomDate(1),
    updatedAt: new Date().toISOString()
  }
];

// ダミーアクション
export const dummyActions: Action[] = [
  {
    id: 'action-1',
    userId: 'user-1',
    accountId: 'acc-1',
    positionId: 'pos-1',
    triggerPositionId: null,
    type: 'ENTRY' as ActionType,
    status: 'EXECUTED' as ActionStatus,
    createdAt: randomDate(7),
    updatedAt: randomDate(6)
  },
  {
    id: 'action-2',
    userId: 'user-1',
    accountId: 'acc-1',
    positionId: 'pos-2',
    triggerPositionId: 'pos-1',
    type: 'CLOSE' as ActionType,
    status: 'PENDING' as ActionStatus,
    createdAt: randomDate(3),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'action-3',
    userId: 'user-2',
    accountId: 'acc-4',
    positionId: 'pos-3',
    triggerPositionId: null,
    type: 'ENTRY' as ActionType,
    status: 'EXECUTED' as ActionStatus,
    createdAt: randomDate(12),
    updatedAt: randomDate(10)
  },
  {
    id: 'action-4',
    userId: 'user-1',
    accountId: 'acc-2',
    positionId: 'pos-4',
    triggerPositionId: null,
    type: 'ENTRY' as ActionType,
    status: 'PENDING' as ActionStatus,
    createdAt: randomDate(1),
    updatedAt: new Date().toISOString()
  }
];

// ダッシュボード統計
export const dummyDashboardStats = {
  connectedAccounts: 3,
  totalAccounts: 4,
  openPositions: 2,
  pendingActions: 2,
  totalVolume: 3.6,
  totalPnL: 1520.45
};

// クライアント状態
export const dummyClientStatus = [
  {
    id: 'user-1',
    name: 'テストユーザー1',
    status: 'online' as const,
    lastSeen: '2分前',
    accountCount: 2
  },
  {
    id: 'user-2',
    name: 'テストユーザー2',
    status: 'offline' as const,
    lastSeen: '30分前',
    accountCount: 2
  },
  {
    id: 'user-3',
    name: '管理者',
    status: 'online' as const,
    lastSeen: '1分前',
    accountCount: 0
  }
];