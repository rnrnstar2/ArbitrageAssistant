import {
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
  ActionStatus,
  PositionFilter,
  ActionFilter
} from '@repo/shared-types';

// =============================================================================
// Mock Data Generators
// =============================================================================

const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

const getRandomChoice = <T>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

const getRandomNumber = (min: number, max: number, decimals: number = 0): number => {
  const value = Math.random() * (max - min) + min;
  return Number(value.toFixed(decimals));
};

const getRandomDate = (daysBack: number = 30): string => {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(Math.random() * daysBack));
  return date.toISOString();
};

// =============================================================================
// User Mock Data
// =============================================================================

export const generateMockUsers = (count: number = 5): User[] => {
  const users: User[] = [];
  
  for (let i = 0; i < count; i++) {
    const userId = generateId();
    const now = new Date().toISOString();
    
    users.push({
      id: userId,
      email: `user${i + 1}@example.com`,
      name: `テストユーザー${i + 1}`,
      role: getRandomChoice([UserRole.CLIENT, UserRole.ADMIN]),
      pcStatus: getRandomChoice([PCStatus.ONLINE, PCStatus.OFFLINE]),
      isActive: Math.random() > 0.2, // 80% active
      createdAt: getRandomDate(60),
      updatedAt: now
    });
  }
  
  return users;
};

// =============================================================================
// Account Mock Data
// =============================================================================

export const generateMockAccounts = (userIds: string[], count: number = 10): Account[] => {
  const accounts: Account[] = [];
  const brokerTypes = ['MetaTrader4', 'MetaTrader5', 'cTrader'];
  const serverNames = ['LiveServer-1', 'LiveServer-2', 'DemoServer-1'];
  
  for (let i = 0; i < count; i++) {
    const accountId = generateId();
    const userId = getRandomChoice(userIds);
    const brokerType = getRandomChoice(brokerTypes);
    const accountNumber = `${Math.floor(Math.random() * 9000000) + 1000000}`;
    const now = new Date().toISOString();
    
    accounts.push({
      id: accountId,
      userId,
      brokerType,
      accountNumber,
      serverName: getRandomChoice(serverNames),
      displayName: `${brokerType} - ${accountNumber}`,
      balance: getRandomNumber(10000, 100000, 2),
      credit: getRandomNumber(0, 50000, 2),
      equity: getRandomNumber(10000, 120000, 2),
      isActive: Math.random() > 0.1, // 90% active
      lastUpdated: getRandomDate(7),
      createdAt: getRandomDate(90),
      updatedAt: now
    });
  }
  
  return accounts;
};

// =============================================================================
// Position Mock Data
// =============================================================================

export const generateMockPositions = (
  userIds: string[], 
  accountIds: string[], 
  count: number = 50,
  filters?: PositionFilter
): Position[] => {
  const positions: Position[] = [];
  const symbols = Object.values(Symbol);
  const statuses = Object.values(PositionStatus);
  const executionTypes = Object.values(ExecutionType);
  
  for (let i = 0; i < count; i++) {
    const positionId = generateId();
    const userId = filters?.userId || getRandomChoice(userIds);
    const accountId = filters?.accountId || getRandomChoice(accountIds);
    const symbol = filters?.symbol || getRandomChoice(symbols);
    const status = filters?.status || getRandomChoice(statuses);
    const executionType = filters?.executionType || getRandomChoice(executionTypes);
    const volume = getRandomNumber(0.01, 10, 2);
    const entryPrice = getRandomNumber(1.0, 200, 5);
    const isOpen = status === PositionStatus.OPEN;
    const isClosed = status === PositionStatus.CLOSED || status === PositionStatus.STOPPED;
    const now = new Date().toISOString();
    
    positions.push({
      id: positionId,
      userId,
      accountId,
      executionType,
      status,
      symbol,
      volume,
      entryPrice: (status !== PositionStatus.PENDING) ? entryPrice : null,
      entryTime: (status !== PositionStatus.PENDING) ? getRandomDate(30) : null,
      exitPrice: isClosed ? getRandomNumber(entryPrice * 0.9, entryPrice * 1.1, 5) : null,
      exitTime: isClosed ? getRandomDate(7) : null,
      exitReason: isClosed ? getRandomChoice(['STOP_LOSS', 'TAKE_PROFIT', 'MANUAL', 'TRAIL_STOP']) : null,
      trailWidth: (Math.random() > 0.5) ? getRandomNumber(10, 100, 0) : null,
      triggerActionIds: (Math.random() > 0.7) ? generateId() : null,
      mtTicket: (status !== PositionStatus.PENDING) ? `${Math.floor(Math.random() * 90000000) + 10000000}` : null,
      memo: (Math.random() > 0.6) ? `テストメモ${i + 1}` : null,
      createdAt: getRandomDate(60),
      updatedAt: now
    });
  }
  
  return positions;
};

// =============================================================================
// Action Mock Data
// =============================================================================

export const generateMockActions = (
  userIds: string[], 
  accountIds: string[], 
  positionIds: string[], 
  count: number = 30,
  filters?: ActionFilter
): Action[] => {
  const actions: Action[] = [];
  const actionTypes = Object.values(ActionType);
  const actionStatuses = Object.values(ActionStatus);
  
  for (let i = 0; i < count; i++) {
    const actionId = generateId();
    const userId = filters?.userId || getRandomChoice(userIds);
    const accountId = filters?.accountId || getRandomChoice(accountIds);
    const positionId = filters?.positionId || getRandomChoice(positionIds);
    const type = filters?.type || getRandomChoice(actionTypes);
    const status = filters?.status || getRandomChoice(actionStatuses);
    const now = new Date().toISOString();
    
    actions.push({
      id: actionId,
      userId,
      accountId,
      positionId,
      triggerPositionId: (Math.random() > 0.7) ? getRandomChoice(positionIds) : null,
      type,
      status,
      createdAt: getRandomDate(30),
      updatedAt: now
    });
  }
  
  return actions;
};

// =============================================================================
// Comprehensive Mock Data Set
// =============================================================================

export interface MockDataSet {
  users: User[];
  accounts: Account[];
  positions: Position[];
  actions: Action[];
}

export const generateCompleteMockDataSet = (): MockDataSet => {
  const users = generateMockUsers(3);
  const userIds = users.map(u => u.id);
  
  const accounts = generateMockAccounts(userIds, 6);
  const accountIds = accounts.map(a => a.id);
  
  const positions = generateMockPositions(userIds, accountIds, 20);
  const positionIds = positions.map(p => p.id);
  
  const actions = generateMockActions(userIds, accountIds, positionIds, 15);
  
  return {
    users,
    accounts,
    positions,
    actions
  };
};

// =============================================================================
// Dashboard Mock Data
// =============================================================================

export interface MockDashboardStats {
  connectedAccounts: number;
  totalAccounts: number;
  openPositions: number;
  pendingActions: number;
  totalVolume: number;
  totalPnL: number;
}

export const generateMockDashboardStats = (): MockDashboardStats => {
  return {
    connectedAccounts: getRandomNumber(3, 8, 0),
    totalAccounts: getRandomNumber(4, 10, 0),
    openPositions: getRandomNumber(5, 25, 0),
    pendingActions: getRandomNumber(0, 15, 0),
    totalVolume: getRandomNumber(10, 100, 2),
    totalPnL: getRandomNumber(-5000, 15000, 2)
  };
};