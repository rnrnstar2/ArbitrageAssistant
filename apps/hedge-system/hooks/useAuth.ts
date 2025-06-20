"use client";

import { useState, useEffect } from "react";
import { getCurrentUser, signOut, fetchAuthSession, type AuthUser } from "aws-amplify/auth";

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      
      // Get auth token for WebSocket connection
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString();
      setAuthToken(token || null);
    } catch (error) {
      setUser(null);
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
      setAuthToken(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const getWebSocketConnectionOptions = () => {
    if (!user || !authToken) {
      return null;
    }

    // Generate clientId from user attributes or use a default
    const clientId = `hedge-system-${user.userId}`;
    
    return {
      authToken,
      clientId,
      userId: user.userId,
      url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || "wss://api.example.com/websocket",
    };
  };

  return {
    user,
    loading,
    authToken,
    isAuthenticated: !!user,
    signOut: handleSignOut,
    checkAuthState,
    getWebSocketConnectionOptions,
  };
}