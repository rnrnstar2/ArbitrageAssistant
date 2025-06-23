"use client";

import { type AuthUser, getCurrentUser, signIn, signOut, fetchAuthSession } from "aws-amplify/auth";
import { AuthContextType, WebSocketConnectionOptions, AuthProviderOptions } from "./types";

export class AuthService {
  private user: AuthUser | null = null;
  private isLoading = true;
  private authToken: string | null = null;
  private options: AuthProviderOptions;
  private listeners: Set<() => void> = new Set();

  constructor(options: AuthProviderOptions = {}) {
    this.options = options;
    
    // 設定チェックを遅延実行（Amplify.configure()が完了するまで待機）
    setTimeout(() => {
      this.checkAuthState();
    }, 100);
  }

  private notify() {
    this.listeners.forEach(listener => listener());
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async checkAuthState(): Promise<void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Authentication check timeout')), 10000);
    });

    try {
      const getCurrentUserPromise = getCurrentUser();
      const currentUser = await Promise.race([getCurrentUserPromise, timeoutPromise]);
      this.user = currentUser;
      
      if (this.options.enableWebSocket) {
        const sessionPromise = fetchAuthSession();
        const session = await Promise.race([sessionPromise, timeoutPromise]);
        const token = session.tokens?.idToken?.toString();
        this.authToken = token || null;
      }
      
      // Debug: Auth check completed
    } catch {
      // Debug: Auth check failed
      this.user = null;
      this.authToken = null;
    } finally {
      this.isLoading = false;
      this.notify();
      // Debug: Auth state updated
    }
  }

  async signIn(email: string, password: string): Promise<unknown> {
    const result = await signIn({ 
      username: email, 
      password,
      options: {
        authFlowType: 'USER_SRP_AUTH',
      },
    });

    if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
      throw new Error('メールアドレスの確認が必要です');
    }

    await this.checkAuthState();
    return result;
  }

  async signOut(): Promise<void> {
    try {
      await signOut();
      this.user = null;
      this.authToken = null;
      this.notify();
    } catch {
      // Error occurred during sign out
    }
  }

  getWebSocketConnectionOptions(): WebSocketConnectionOptions | null {
    if (!this.options.enableWebSocket || !this.user || !this.authToken) {
      return null;
    }

    const clientId = `client-${this.user.userId}`;
    const url = this.options.websocketUrl || process.env.NEXT_PUBLIC_WEBSOCKET_URL || "";
    
    return {
      authToken: this.authToken,
      clientId,
      userId: this.user.userId,
      url,
    };
  }

  getState(): Pick<AuthContextType, 'user' | 'isAuthenticated' | 'isLoading' | 'authToken'> {
    return {
      user: this.user,
      isAuthenticated: !!this.user,
      isLoading: this.isLoading,
      authToken: this.authToken,
    };
  }
}