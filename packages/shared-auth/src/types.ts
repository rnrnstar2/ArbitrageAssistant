import { type AuthUser } from "aws-amplify/auth";

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authToken: string | null;
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  checkAuthState: () => Promise<void>;
  getWebSocketConnectionOptions: () => WebSocketConnectionOptions | null;
}

export interface WebSocketConnectionOptions {
  authToken: string;
  clientId: string;
  userId: string;
  url: string;
}

export interface AuthProviderOptions {
  enableWebSocket?: boolean;
  websocketUrl?: string;
}