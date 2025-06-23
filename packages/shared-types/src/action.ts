// アクション型定義
export interface Action {
  id: string;
  userId: string;
  accountId: string;
  positionId: string;
  triggerPositionId?: string;
  type: ActionType;
  status: ActionStatus;
  createdAt?: string;
  updatedAt?: string;
}

// アクション作成用型
export interface CreateActionInput {
  userId: string;
  accountId: string;
  positionId?: string;
  triggerPositionId?: string;
  type: ActionType;
  status?: ActionStatus;
}

// アクション更新用型
export interface UpdateActionInput {
  id: string;
  status?: ActionStatus;
  updatedAt?: string;
}

// アクション列挙型
export enum ActionType {
  ENTRY = 'ENTRY',
  CLOSE = 'CLOSE'
}

export enum ActionStatus {
  PENDING = 'PENDING',
  EXECUTING = 'EXECUTING',
  EXECUTED = 'EXECUTED',
  FAILED = 'FAILED'
}


// Action 関連ユーティリティ型
export interface ActionFilter {
  userId?: string;
  accountId?: string;
  positionId?: string;
  status?: ActionStatus;
  type?: ActionType;
}

export interface ActionSubscriptionFilter {
  userId: string;
}