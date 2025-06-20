// GraphQL Subscription Integration Module
// This module provides comprehensive GraphQL subscription integration for real-time monitoring

// Core GraphQL functionality
export {
  client,
  subscribeToPositionUpdates,
  subscribeToAccountUpdates,
  subscribeToClientPCUpdates,
  subscribeToEntryUpdates,
  subscribeToCloseRecords,
  MonitoringSubscriptionManager,
  DataConflictResolver,
  conflictResolver,
  createMonitoringSubscriptionManager
} from './monitoring-subscriptions'

// Real-time sync integration
export {
  RealtimeSyncIntegration,
  getRealtimeSyncIntegration,
  useRealtimeSync,
  type RealtimeSync,
  type RealtimeSyncStatus,
  type SyncEventData
} from './realtime-sync-integration'

// Multi-client management
export {
  MultiClientManager,
  getMultiClientManager,
  useMultiClientManager,
  type ClientInfo,
  type ClientPermissions,
  type MultiClientEvent
} from './multi-client-manager'

// Advanced conflict resolution
export {
  AdvancedConflictResolver,
  EnhancedConflictResolver,
  enhancedConflictResolver,
  type ConflictResolutionStrategy,
  type ConflictContext,
  type ConflictResolution,
  type ConflictAction,
  type ConflictMetrics,
  type ConflictHistory
} from './advanced-conflict-resolver'

// Utility functions for easy setup
export const initializeGraphQLMonitoring = async (userId: string, accountIds: string[]) => {
  const multiClientManager = getMultiClientManager()
  const clientInfo = await multiClientManager.initializeClient()
  
  if (accountIds.length > 0) {
    await multiClientManager.updateClientAccounts(clientInfo.clientId, accountIds)
  }
  
  return {
    clientInfo,
    multiClientManager,
    realtimeSync: getRealtimeSyncIntegration()
  }
}

export const cleanupGraphQLMonitoring = async () => {
  const multiClientManager = getMultiClientManager()
  const realtimeSync = getRealtimeSyncIntegration()
  
  await multiClientManager.cleanup()
  realtimeSync.stop()
  
  // Cleanup conflict resolver
  enhancedConflictResolver.cleanup()
}

// Configuration interface for easy setup
export interface GraphQLMonitoringConfig {
  userId: string
  accountIds: string[]
  conflictResolutionStrategies?: ConflictResolutionStrategy[]
  enableAdvancedConflictResolution?: boolean
  enableMultiClientSupport?: boolean
  autoCleanupInterval?: number
}

export const setupGraphQLMonitoring = async (config: GraphQLMonitoringConfig) => {
  const {
    userId,
    accountIds,
    conflictResolutionStrategies = [],
    enableAdvancedConflictResolution = true,
    enableMultiClientSupport = true,
    autoCleanupInterval = 24 * 60 * 60 * 1000 // 24 hours
  } = config

  // Register custom conflict resolution strategies
  if (enableAdvancedConflictResolution && conflictResolutionStrategies.length > 0) {
    conflictResolutionStrategies.forEach(strategy => {
      enhancedConflictResolver.registerStrategy(strategy)
    })
  }

  // Setup auto cleanup
  if (autoCleanupInterval > 0) {
    setInterval(() => {
      enhancedConflictResolver.cleanup(autoCleanupInterval)
    }, autoCleanupInterval)
  }

  // Initialize monitoring
  if (enableMultiClientSupport) {
    return await initializeGraphQLMonitoring(userId, accountIds)
  } else {
    // Single client mode
    const realtimeSync = getRealtimeSyncIntegration()
    await realtimeSync.start()
    await realtimeSync.updateAccountIds(accountIds)
    
    return {
      realtimeSync,
      singleClientMode: true
    }
  }
}

// Type re-exports for convenience
export type { ConflictResolutionStrategy, ConflictContext, ConflictResolution } from './advanced-conflict-resolver'
export type { ClientInfo, ClientPermissions } from './multi-client-manager'
export type { RealtimeSync, RealtimeSyncStatus } from './realtime-sync-integration'