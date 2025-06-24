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
export interface CreateActionInput {
    userId: string;
    accountId: string;
    positionId?: string;
    triggerPositionId?: string;
    type: ActionType;
    status?: ActionStatus;
}
export interface UpdateActionInput {
    id: string;
    status?: ActionStatus;
    updatedAt?: string;
}
export declare enum ActionType {
    ENTRY = "ENTRY",
    CLOSE = "CLOSE"
}
export declare enum ActionStatus {
    PENDING = "PENDING",
    EXECUTING = "EXECUTING",
    EXECUTED = "EXECUTED",
    FAILED = "FAILED"
}
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
