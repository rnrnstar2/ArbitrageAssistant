export { AuthService } from './auth-service';
export { AuthErrorHandler } from './error-handler';
export { SecurityService } from './security-service';
export { 
  AuthProvider, 
  useAuth, 
  useAuthState, 
  usePermission, 
  useWebSocketAuth, 
  useAuthDetails, 
  useAuthDebug 
} from './auth-context';
export type { 
  AuthContextType, 
  WebSocketConnectionOptions, 
  AuthProviderOptions, 
  AuthError, 
  AuthErrorType 
} from './types';
export type { AuthProviderProps } from './auth-context';