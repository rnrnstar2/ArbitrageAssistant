"use client";

import React, { createContext, useContext } from "react";

// Pure UI AuthContext - receives auth state as props, no business logic
export interface AuthContextType {
  user: Record<string, unknown> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  authToken: string | null;
  signIn: (email: string, password: string) => Promise<unknown>;
  signOut: () => Promise<void>;
  checkAuthState: () => Promise<void>;
  getWebSocketConnectionOptions: () => Record<string, unknown> | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: React.ReactNode;
  value: AuthContextType;
}

// Pure UI component - only provides context, no business logic
export function AuthProvider({ children, value }: AuthProviderProps) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}