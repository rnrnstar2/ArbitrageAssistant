"use client";

import { useState, useEffect } from 'react';
import { SystemStatus, EAConnection } from '../types';

export function useSystemStatus(eaConnections: EAConnection[]) {
  const [systemStatus, setSystemStatus] = useState<SystemStatus>({
    totalEAs: 6,
    activeEAs: 4,
    errorCount: 0,
    lastUpdate: new Date(),
    uptime: '2時間 34分',
    webSocketPort: 8080,
    adminConnected: true
  });

  const [isRefreshing, setIsRefreshing] = useState(false);

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

  return {
    systemStatus,
    isRefreshing,
    handleRefresh
  };
}