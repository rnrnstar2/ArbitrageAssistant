import { type AuthUser } from "aws-amplify/auth";

export interface User {
  userId: string;
  email: string;
  groups: string[];
  attributes: Record<string, string>;
}

export interface AuthConfig {
  region: string;
  userPoolId: string;
  userPoolClientId: string;
  identityPoolId?: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authToken: string | null;
  groups: string[];
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  checkAuthState: () => Promise<void>;
  getWebSocketConnectionOptions: () => WebSocketConnectionOptions | null;
  hasPermission: (operation: string, resource: string) => boolean;
  refreshSession: () => Promise<void>;
}

export interface WebSocketConnectionOptions {
  authToken: string;
  clientId: string;
  userId: string;
  url: string;
}

export interface WSAuthConfig {
  token: string;
  sessionId: string;
  expiry: number;
}

export interface AuthProviderOptions {
  enableWebSocket?: boolean;
  websocketUrl?: string;
}

export enum AuthErrorType {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

export class AuthError extends Error {
  constructor(
    public type: AuthErrorType,
    public message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AuthError';
  }
}