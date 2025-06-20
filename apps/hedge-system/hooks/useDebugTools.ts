'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DebugTools, ErrorType } from '@/lib/debug/debug-tools';
import { SystemDiagnostics, SystemDiagnosticReport } from '@/lib/debug/system-diagnostics';
import { CommunicationDiagnostics } from '@/lib/debug/communication-diagnostics';
import { WebSocketClient } from '@/lib/websocket/websocket-client';
import { WebSocketDiagnosticManager } from '@/lib/websocket/diagnostic-manager';
import { SystemCommandSender } from '@/lib/websocket/system-command-sender';

interface UseDebugToolsOptions {
  websocketClient?: WebSocketClient;
  autoStart?: boolean;
}

export interface UseDebugToolsReturn {
  debugTools: DebugTools | null;
  systemDiagnostics: SystemDiagnostics | null;
  communicationDiagnostics: CommunicationDiagnostics | null;
  isMonitoring: boolean;
  isInitialized: boolean;
  error: string | null;
  
  // Actions
  startMonitoring: () => void;
  stopMonitoring: () => void;
  simulateMessage: (message: any) => Promise<void>;
  injectError: (errorType: ErrorType) => Promise<void>;
  runDiagnostic: () => Promise<SystemDiagnosticReport>;
  captureNetworkTrace: () => Promise<any>;
  
  // State getters
  getMonitoringState: () => any;
  getLastDiagnosticReport: () => SystemDiagnosticReport | null;
}

export const useDebugTools = (options: UseDebugToolsOptions = {}): UseDebugToolsReturn => {
  const { websocketClient, autoStart = false } = options;
  
  const [debugTools, setDebugTools] = useState<DebugTools | null>(null);
  const [systemDiagnostics, setSystemDiagnostics] = useState<SystemDiagnostics | null>(null);
  const [communicationDiagnostics, setCommunicationDiagnostics] = useState<CommunicationDiagnostics | null>(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDiagnosticReport, setLastDiagnosticReport] = useState<SystemDiagnosticReport | null>(null);

  // Initialize debug tools when websocket client is available
  useEffect(() => {
    if (websocketClient && !debugTools) {
      try {
        // Create system command sender for diagnostic manager
        const systemCommandSender = new SystemCommandSender(websocketClient);
        
        // Create diagnostic manager
        const diagnosticManager = new WebSocketDiagnosticManager(systemCommandSender);
        
        // Create debug tools
        const tools = new DebugTools(websocketClient);
        
        // Create system diagnostics
        const sysDiag = new SystemDiagnostics(
          websocketClient,
          diagnosticManager
        );
        
        // Create communication diagnostics
        const commDiag = new CommunicationDiagnostics(websocketClient);
        
        setDebugTools(tools);
        setSystemDiagnostics(sysDiag);
        setCommunicationDiagnostics(commDiag);
        setIsInitialized(true);
        setError(null);
        
        // Auto-start monitoring if requested
        if (autoStart) {
          tools.startMessageMonitor();
          setIsMonitoring(true);
        }
        
        console.log('🔧 Debug tools initialized successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Failed to initialize debug tools: ${errorMessage}`);
        console.error('Failed to initialize debug tools:', err);
      }
    }
  }, [websocketClient, autoStart, debugTools]);

  // Update monitoring state when debug tools change
  useEffect(() => {
    if (debugTools) {
      const updateMonitoringState = () => {
        const state = debugTools.getMonitoringState();
        setIsMonitoring(state.isMonitoring);
      };

      // Setup event listeners
      debugTools.onDebugEvent('monitor_started', updateMonitoringState);
      debugTools.onDebugEvent('monitor_stopped', updateMonitoringState);

      return () => {
        debugTools.offDebugEvent('monitor_started', updateMonitoringState);
        debugTools.offDebugEvent('monitor_stopped', updateMonitoringState);
      };
    }
  }, [debugTools]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debugTools) {
        debugTools.dispose();
      }
    };
  }, [debugTools]);

  const startMonitoring = useCallback(() => {
    if (debugTools && !isMonitoring) {
      debugTools.startMessageMonitor();
      setIsMonitoring(true);
    }
  }, [debugTools, isMonitoring]);

  const stopMonitoring = useCallback(() => {
    if (debugTools && isMonitoring) {
      debugTools.stopMessageMonitor();
      setIsMonitoring(false);
    }
  }, [debugTools, isMonitoring]);

  const simulateMessage = useCallback(async (message: any) => {
    if (!debugTools) {
      throw new Error('Debug tools not initialized');
    }
    
    try {
      await debugTools.simulateMessage(message);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Message simulation failed: ${errorMessage}`);
      throw err;
    }
  }, [debugTools]);

  const injectError = useCallback(async (errorType: ErrorType) => {
    if (!debugTools) {
      throw new Error('Debug tools not initialized');
    }
    
    try {
      await debugTools.injectError(errorType);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error injection failed: ${errorMessage}`);
      throw err;
    }
  }, [debugTools]);

  const runDiagnostic = useCallback(async (): Promise<SystemDiagnosticReport> => {
    if (!systemDiagnostics) {
      throw new Error('System diagnostics not initialized');
    }
    
    try {
      const report = await systemDiagnostics.performFullDiagnostic();
      setLastDiagnosticReport(report);
      setError(null);
      return report;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Diagnostic failed: ${errorMessage}`);
      throw err;
    }
  }, [systemDiagnostics]);

  const captureNetworkTrace = useCallback(async () => {
    if (!debugTools) {
      throw new Error('Debug tools not initialized');
    }
    
    try {
      const trace = await debugTools.captureNetworkTrace();
      return trace;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Network trace failed: ${errorMessage}`);
      throw err;
    }
  }, [debugTools]);

  const getMonitoringState = useCallback(() => {
    return debugTools?.getMonitoringState() || {
      isMonitoring: false,
      messageCount: 0,
      startTime: undefined
    };
  }, [debugTools]);

  const getLastDiagnosticReport = useCallback(() => {
    return lastDiagnosticReport;
  }, [lastDiagnosticReport]);

  return useMemo(() => ({
    debugTools,
    systemDiagnostics,
    communicationDiagnostics,
    isMonitoring,
    isInitialized,
    error,
    startMonitoring,
    stopMonitoring,
    simulateMessage,
    injectError,
    runDiagnostic,
    captureNetworkTrace,
    getMonitoringState,
    getLastDiagnosticReport
  }), [
    debugTools,
    systemDiagnostics,
    communicationDiagnostics,
    isMonitoring,
    isInitialized,
    error,
    startMonitoring,
    stopMonitoring,
    simulateMessage,
    injectError,
    runDiagnostic,
    captureNetworkTrace,
    getMonitoringState,
    getLastDiagnosticReport
  ]);
};

export default useDebugTools;