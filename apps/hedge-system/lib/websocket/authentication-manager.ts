import { 
  SystemCommandSender,
  CommandResult,
  SessionValidationResult,
  AuthTokenUpdateCommand,
  SessionValidateCommand
} from './system-command-sender';

// ===== AUTHENTICATION INTERFACES =====

export interface AuthenticationManager {
  updateAuthToken(token: string): Promise<CommandResult>;
  validateSession(): Promise<SessionValidationResult>;
  revokeAccess(): Promise<CommandResult>;
  refreshToken(): Promise<string>;
  checkPermissions(requiredPermissions: string[]): Promise<boolean>;
}

export interface AuthConfig {
  tokenRefreshThreshold: number; // minutes before expiry to refresh
  maxTokenAge: number; // maximum token age in minutes
  requiredPermissions: string[];
  autoRefresh: boolean;
}

export interface TokenInfo {
  token: string;
  expiresAt: Date;
  permissions: string[];
  issuedAt: Date;
  lastUsed: Date;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  clientId: string;
  isValid: boolean;
  expiresAt: Date;
  permissions: string[];
  lastActivity: Date;
  ipAddress?: string;
}

// ===== AUTHENTICATION EVENTS =====

export type AuthEventType = 
  | 'token_updated'
  | 'token_expired'
  | 'session_validated'
  | 'session_invalid'
  | 'permission_denied'
  | 'auth_error';

export interface AuthEventHandler {
  (event: AuthEventType, data?: any): void;
}

// ===== AUTHENTICATION MANAGER IMPLEMENTATION =====

export class WebSocketAuthenticationManager implements AuthenticationManager {
  private systemCommandSender: SystemCommandSender;
  private config: AuthConfig;
  private tokenInfo: TokenInfo | null = null;
  private sessionInfo: SessionInfo | null = null;
  private eventHandlers: Map<AuthEventType, AuthEventHandler[]> = new Map();
  private refreshTimer: NodeJS.Timeout | null = null;

  constructor(
    systemCommandSender: SystemCommandSender,
    config: Partial<AuthConfig> = {}
  ) {
    this.systemCommandSender = systemCommandSender;
    this.config = {
      tokenRefreshThreshold: 10, // 10 minutes
      maxTokenAge: 60 * 24, // 24 hours
      requiredPermissions: ['basic_access'],
      autoRefresh: true,
      ...config
    };

    this.initializeEventHandlers();
  }

  /**
   * Update authentication token
   */
  async updateAuthToken(token: string): Promise<CommandResult> {
    try {
      // Validate token format
      if (!this.validateTokenFormat(token)) {
        throw new Error('Invalid token format');
      }

      // Extract token information
      const tokenData = this.parseToken(token);
      const expiresAt = this.calculateExpiration(token);

      const authUpdate: AuthTokenUpdateCommand = {
        token,
        expiresAt,
        permissions: tokenData.permissions || this.config.requiredPermissions
      };

      const result = await this.systemCommandSender.sendAuthTokenUpdate(authUpdate);

      if (result.success) {
        // Update local token info
        this.tokenInfo = {
          token,
          expiresAt,
          permissions: authUpdate.permissions || [],
          issuedAt: new Date(),
          lastUsed: new Date()
        };

        // Setup auto-refresh if enabled
        if (this.config.autoRefresh) {
          this.setupTokenRefresh();
        }

        this.emit('token_updated', { token: this.maskToken(token), expiresAt });
      } else {
        this.emit('auth_error', { error: result.error });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Token update failed';
      this.emit('auth_error', { error: errorMessage });
      
      return {
        success: false,
        commandId: '',
        timestamp: new Date(),
        error: errorMessage
      };
    }
  }

  /**
   * Validate current session
   */
  async validateSession(): Promise<SessionValidationResult> {
    try {
      const sessionValidate: SessionValidateCommand = {
        sessionId: this.sessionInfo?.sessionId,
        includePermissions: true
      };

      const result = await this.systemCommandSender.sendSessionValidate(sessionValidate);

      if (result.success && result.valid) {
        // Update session info
        this.sessionInfo = {
          sessionId: this.sessionInfo?.sessionId || 'unknown',
          userId: this.sessionInfo?.userId || 'unknown',
          clientId: this.sessionInfo?.clientId || 'unknown',
          isValid: true,
          expiresAt: result.expiresAt || new Date(Date.now() + 60 * 60 * 1000), // 1 hour default
          permissions: result.permissions,
          lastActivity: new Date(),
          ipAddress: this.sessionInfo?.ipAddress
        };

        this.emit('session_validated', { sessionId: this.sessionInfo.sessionId });
      } else {
        this.sessionInfo = null;
        this.emit('session_invalid', { error: result.error });
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Session validation failed';
      this.emit('auth_error', { error: errorMessage });
      
      return {
        success: false,
        commandId: '',
        timestamp: new Date(),
        valid: false,
        permissions: [],
        error: errorMessage
      };
    }
  }

  /**
   * Revoke access and clear session
   */
  async revokeAccess(): Promise<CommandResult> {
    try {
      // Clear local session info
      this.tokenInfo = null;
      this.sessionInfo = null;

      // Stop auto-refresh
      if (this.refreshTimer) {
        clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
      }

      // You could send a revoke command to the server here
      // For now, just return success
      return {
        success: true,
        commandId: '',
        timestamp: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Access revocation failed';
      return {
        success: false,
        commandId: '',
        timestamp: new Date(),
        error: errorMessage
      };
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<string> {
    try {
      if (!this.tokenInfo) {
        throw new Error('No token to refresh');
      }

      // This is a simplified refresh - in practice, you'd call a refresh endpoint
      const newToken = await this.requestTokenRefresh(this.tokenInfo.token);
      const result = await this.updateAuthToken(newToken);

      if (!result.success) {
        throw new Error(result.error || 'Token refresh failed');
      }

      return newToken;
    } catch (error) {
      this.emit('auth_error', { error: error instanceof Error ? error.message : 'Token refresh failed' });
      throw error;
    }
  }

  /**
   * Check if user has required permissions
   */
  async checkPermissions(requiredPermissions: string[]): Promise<boolean> {
    try {
      // First validate session to ensure we have current permissions
      const validation = await this.validateSession();
      
      if (!validation.success || !validation.valid) {
        this.emit('permission_denied', { reason: 'Invalid session' });
        return false;
      }

      const userPermissions = validation.permissions;
      const hasAllPermissions = requiredPermissions.every(permission => 
        userPermissions.includes(permission) || userPermissions.includes('admin')
      );

      if (!hasAllPermissions) {
        this.emit('permission_denied', { 
          required: requiredPermissions,
          available: userPermissions
        });
      }

      return hasAllPermissions;
    } catch (error) {
      this.emit('auth_error', { error: error instanceof Error ? error.message : 'Permission check failed' });
      return false;
    }
  }

  // === EVENT MANAGEMENT ===

  /**
   * Add event listener
   */
  on(event: AuthEventType, handler: AuthEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.push(handler);
    this.eventHandlers.set(event, handlers);
  }

  /**
   * Remove event listener
   */
  off(event: AuthEventType, handler: AuthEventHandler): void {
    const handlers = this.eventHandlers.get(event) || [];
    const index = handlers.indexOf(handler);
    if (index > -1) {
      handlers.splice(index, 1);
      this.eventHandlers.set(event, handlers);
    }
  }

  // === GETTERS ===

  /**
   * Get current token info (without sensitive data)
   */
  getTokenInfo(): Partial<TokenInfo> | null {
    if (!this.tokenInfo) return null;
    
    return {
      expiresAt: this.tokenInfo.expiresAt,
      permissions: this.tokenInfo.permissions,
      issuedAt: this.tokenInfo.issuedAt,
      lastUsed: this.tokenInfo.lastUsed
    };
  }

  /**
   * Get current session info
   */
  getSessionInfo(): Partial<SessionInfo> | null {
    if (!this.sessionInfo) return null;
    
    return {
      sessionId: this.sessionInfo.sessionId,
      userId: this.sessionInfo.userId,
      clientId: this.sessionInfo.clientId,
      isValid: this.sessionInfo.isValid,
      expiresAt: this.sessionInfo.expiresAt,
      permissions: this.sessionInfo.permissions,
      lastActivity: this.sessionInfo.lastActivity
    };
  }

  /**
   * Check if token is valid and not expired
   */
  isTokenValid(): boolean {
    if (!this.tokenInfo) return false;
    return new Date() < this.tokenInfo.expiresAt;
  }

  /**
   * Check if session is valid
   */
  isSessionValid(): boolean {
    if (!this.sessionInfo) return false;
    return this.sessionInfo.isValid && new Date() < this.sessionInfo.expiresAt;
  }

  // === PRIVATE HELPER METHODS ===

  private initializeEventHandlers(): void {
    [
      'token_updated',
      'token_expired',
      'session_validated',
      'session_invalid',
      'permission_denied',
      'auth_error'
    ].forEach(event => {
      this.eventHandlers.set(event as AuthEventType, []);
    });
  }

  private validateTokenFormat(token: string): boolean {
    // Basic JWT-like validation
    const parts = token.split('.');
    return parts.length === 3 && parts.every(part => part.length > 0);
  }

  private parseToken(token: string): { permissions?: string[] } {
    try {
      // Simplified token parsing - in practice, you'd decode JWT payload
      const parts = token.split('.');
      if (parts.length >= 2) {
        const payload = JSON.parse(atob(parts[1]));
        return {
          permissions: payload.permissions || []
        };
      }
    } catch (error) {
      console.warn('Failed to parse token:', error);
    }
    return {};
  }

  private calculateExpiration(token: string): Date {
    try {
      const tokenData = this.parseToken(token);
      // Try to extract expiry from token, otherwise use config default
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp) {
        return new Date(payload.exp * 1000);
      }
    } catch (error) {
      console.warn('Failed to extract expiry from token:', error);
    }
    
    // Default expiration
    return new Date(Date.now() + this.config.maxTokenAge * 60 * 1000);
  }

  private setupTokenRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!this.tokenInfo) return;

    const refreshTime = this.tokenInfo.expiresAt.getTime() - 
                       (this.config.tokenRefreshThreshold * 60 * 1000);
    const now = Date.now();

    if (refreshTime > now) {
      this.refreshTimer = setTimeout(async () => {
        try {
          await this.refreshToken();
        } catch (error) {
          console.error('Auto token refresh failed:', error);
          this.emit('token_expired', { error: error instanceof Error ? error.message : 'Auto refresh failed' });
        }
      }, refreshTime - now);
    }
  }

  private async requestTokenRefresh(currentToken: string): Promise<string> {
    // This is a placeholder - implement according to your auth system
    // For now, simulate a refreshed token
    const parts = currentToken.split('.');
    if (parts.length === 3) {
      // Create a new token with updated timestamp
      const header = parts[0];
      const payload = JSON.parse(atob(parts[1]));
      payload.iat = Math.floor(Date.now() / 1000);
      payload.exp = Math.floor(Date.now() / 1000) + (this.config.maxTokenAge * 60);
      
      const newPayload = btoa(JSON.stringify(payload));
      return `${header}.${newPayload}.${parts[2]}`;
    }
    
    throw new Error('Unable to refresh token');
  }

  private maskToken(token: string): string {
    if (token.length < 20) return '***';
    return token.substring(0, 10) + '...' + token.substring(token.length - 10);
  }

  private emit(event: AuthEventType, data?: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(event, data);
      } catch (error) {
        console.error(`Error in auth event handler for ${event}:`, error);
      }
    });
  }

  // === CLEANUP ===

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    this.eventHandlers.clear();
    this.tokenInfo = null;
    this.sessionInfo = null;
  }
}