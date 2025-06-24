export * from './position';
export * from './action';
export * from './trading';
export * from './websocket';
export declare enum UserRole {
    CLIENT = "CLIENT",
    ADMIN = "ADMIN"
}
export declare enum PCStatus {
    ONLINE = "ONLINE",
    OFFLINE = "OFFLINE"
}
export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    pcStatus?: PCStatus;
    isActive?: boolean;
}
