export interface Account {
    id: string;
    userId: string;
    brokerType: string;
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
