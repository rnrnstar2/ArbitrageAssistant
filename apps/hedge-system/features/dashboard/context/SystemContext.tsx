"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SystemStatus, EAConnection, SystemContextType } from '../types';

const SystemContext = createContext<SystemContextType | undefined>(undefined);

interface SystemProviderProps {
  children: ReactNode;
}

export function SystemProvider({ children }: SystemProviderProps) {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    totalEAs: 6,
    activeEAs: 4,
    errorCount: 0,
    lastUpdate: new Date(),
    uptime: '2時間 34分',
    webSocketPort: 8080,
    adminConnected: true
  });

  const [eaConnections] = useState<EAConnection[]>([
    {
      id: 'ea1',
      broker: 'XM',
      accountNumber: '12345',
      status: 'connected',
      websocketStatus: 'active',
      lastPing: new Date(),
      responseTime: 45,
      balance: 152000,
      bonusAmount: 3200,
      openPositions: 3
    },
    {
      id: 'ea2',
      broker: 'FXGT',
      accountNumber: '67890',
      status: 'connected',
      websocketStatus: 'active',
      lastPing: new Date(Date.now() - 2000),
      responseTime: 67,
      balance: 87500,
      bonusAmount: 1500,
      openPositions: 2
    },
    {
      id: 'ea3',
      broker: 'EXNESS',
      accountNumber: '99999',
      status: 'reconnecting',
      websocketStatus: 'connecting',
      lastPing: new Date(Date.now() - 30000),
      responseTime: 0,
      balance: 45000,
      bonusAmount: 0,
      openPositions: 1
    },
    {
      id: 'ea4',
      broker: 'TitanFX',
      accountNumber: '11111',
      status: 'error',
      websocketStatus: 'inactive',
      lastPing: new Date(Date.now() - 120000),
      responseTime: 0,
      balance: 0,
      bonusAmount: 0,
      openPositions: 0
    }
  ]);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSystemStatus(prev => ({
        ...prev,
        lastUpdate: new Date(),
        activeEAs: eaConnections.filter(ea => ea.status === 'connected').length,
        errorCount: eaConnections.filter(ea => ea.status === 'error').length
      }));
    }, 5000);

    return () => clearInterval(interval);
  }, [eaConnections]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setSystemStatus(prev => ({ ...prev, lastUpdate: new Date() }));
    }, 1000);
  };

  const value: SystemContextType = {
    systemStatus,
    eaConnections,
    isRefreshing,
    showSettings,
    setShowSettings,
    handleRefresh,
  };

  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (context === undefined) {
    throw new Error('useSystem must be used within a SystemProvider');
  }
  return context;
}