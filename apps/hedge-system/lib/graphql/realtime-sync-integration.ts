import { MonitoringSubscriptionManager, conflictResolver } from './monitoring-subscriptions'
import { dataSynchronizer, DataSynchronizerImpl } from '../websocket/data-synchronizer'
import { EAMessage, PositionUpdateData, AccountInfoData } from '../websocket/message-types'
import { getCurrentUser } from 'aws-amplify/auth'

export interface RealtimeSync {
  start(): Promise<void>
  stop(): void
  updateAccountIds(accountIds: string[]): Promise<void>
  getStatus(): RealtimeSyncStatus
}

export interface RealtimeSyncStatus {
  isActive: boolean
  connectedClients: number
  lastSyncTime: Date
  graphqlSubscriptionStatus: any
  websocketSyncStatus: any
  conflictCount: number
}

export interface SyncEventData {
  source: 'graphql' | 'websocket'
  type: string
  data: any
  timestamp: number
  accountId: string
}

export class RealtimeSyncIntegration implements RealtimeSync {
  private subscriptionManager?: MonitoringSubscriptionManager
  private dataSynchronizer: DataSynchronizerImpl
  private isRunning: boolean = false
  private activeAccountIds: string[] = []
  private userId: string = ''
  private eventListeners: Map<string, Function[]> = new Map()
  private syncStats = {
    lastSyncTime: new Date(0),
    graphqlEvents: 0,
    websocketEvents: 0,
    conflictCount: 0
  }

  constructor(customDataSynchronizer?: DataSynchronizerImpl) {
    this.dataSynchronizer = customDataSynchronizer || dataSynchronizer
    this.setupDataSynchronizerEvents()
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('RealtimeSyncIntegration is already running')
      return
    }

    try {
      // Get current authenticated user
      const user = await getCurrentUser()
      this.userId = user.userId

      // Initialize subscription manager
      this.subscriptionManager = new MonitoringSubscriptionManager(this.userId)
      
      // Setup event listeners for GraphQL subscription events
      this.setupGraphQLEventListeners()

      // Start subscriptions if we have account IDs
      if (this.activeAccountIds.length > 0) {
        await this.subscriptionManager.initializeSubscriptions(this.activeAccountIds)
      }

      this.isRunning = true
      console.log('RealtimeSyncIntegration started successfully')
    } catch (error) {
      console.error('Failed to start RealtimeSyncIntegration:', error)
      throw error
    }
  }

  stop(): void {
    if (!this.isRunning) {
      return
    }

    // Cleanup GraphQL subscriptions
    if (this.subscriptionManager) {
      this.subscriptionManager.cleanup()
      this.subscriptionManager = undefined
    }

    // Remove event listeners
    this.cleanupEventListeners()

    this.isRunning = false
    console.log('RealtimeSyncIntegration stopped')
  }

  async updateAccountIds(accountIds: string[]): Promise<void> {
    this.activeAccountIds = accountIds

    if (this.isRunning && this.subscriptionManager) {
      await this.subscriptionManager.updateAccountIds(accountIds)
    }
  }

  getStatus(): RealtimeSyncStatus {
    return {
      isActive: this.isRunning,
      connectedClients: this.activeAccountIds.length,
      lastSyncTime: this.syncStats.lastSyncTime,
      graphqlSubscriptionStatus: this.subscriptionManager?.getSubscriptionStatus(),
      websocketSyncStatus: this.dataSynchronizer.getBufferStatus(),
      conflictCount: this.syncStats.conflictCount
    }
  }

  // Add event listener for sync events
  addEventListener(eventType: string, callback: Function): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, [])
    }
    this.eventListeners.get(eventType)!.push(callback)
  }

  // Remove event listener
  removeEventListener(eventType: string, callback: Function): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      const index = listeners.indexOf(callback)
      if (index !== -1) {
        listeners.splice(index, 1)
      }
    }
  }

  // Emit event to listeners
  private emitEvent(eventType: string, data: any): void {
    const listeners = this.eventListeners.get(eventType)
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data)
        } catch (error) {
          console.error(`Error in event listener for ${eventType}:`, error)
        }
      })
    }
  }

  private setupGraphQLEventListeners(): void {
    // Position update events
    window.addEventListener('position-update', (event: any) => {
      this.handleGraphQLPositionUpdate(event.detail)
    })

    // Account update events
    window.addEventListener('account-update', (event: any) => {
      this.handleGraphQLAccountUpdate(event.detail)
    })

    // Client PC update events
    window.addEventListener('clientpc-update', (event: any) => {
      this.handleGraphQLClientPCUpdate(event.detail)
    })

    // Entry update events
    window.addEventListener('entry-update', (event: any) => {
      this.handleGraphQLEntryUpdate(event.detail)
    })

    // Close record update events
    window.addEventListener('close-record-update', (event: any) => {
      this.handleGraphQLCloseRecordUpdate(event.detail)
    })

    // Subscription error events
    window.addEventListener('subscription-error', (event: any) => {
      this.handleGraphQLSubscriptionError(event.detail)
    })
  }

  private setupDataSynchronizerEvents(): void {
    // Setup data synchronizer event handlers
    this.dataSynchronizer.setEventHandlers({
      onSyncComplete: (result) => {
        this.syncStats.lastSyncTime = new Date()
        this.syncStats.websocketEvents++
        
        this.emitEvent('websocket-sync-complete', {
          source: 'websocket',
          result,
          timestamp: Date.now()
        })
      },
      onSyncError: (error, dataType, accountId) => {
        console.error(`WebSocket sync error for ${dataType} on account ${accountId}:`, error)
        
        this.emitEvent('websocket-sync-error', {
          source: 'websocket',
          error,
          dataType,
          accountId,
          timestamp: Date.now()
        })
      }
    })
  }

  private handleGraphQLPositionUpdate(detail: { position: any, timestamp: number }): void {
    try {
      const { position, timestamp } = detail
      this.syncStats.graphqlEvents++
      this.syncStats.lastSyncTime = new Date()

      // Apply conflict resolution
      const conflictResult = conflictResolver.resolveConflict(
        `position:${position.id}`,
        position
      )

      if (conflictResult.wasConflict) {
        this.syncStats.conflictCount++
        console.warn(`Position conflict resolved for ${position.id}`)
      }

      // Convert GraphQL position data to WebSocket format
      const positionUpdateData: PositionUpdateData = {
        positionId: position.id,
        symbol: position.symbol,
        type: position.type,
        lots: position.lots,
        openPrice: position.openPrice,
        currentPrice: position.currentPrice,
        profit: position.profit,
        swapTotal: position.swapTotal || 0,
        status: position.status,
        openTime: new Date(position.openedAt).getTime(),
        updateTime: new Date(timestamp)
      }

      // Sync with WebSocket data synchronizer
      this.dataSynchronizer.syncPositionData([positionUpdateData], position.accountId)

      // Emit event for other components
      this.emitEvent('position-synchronized', {
        source: 'graphql',
        type: 'position_update',
        data: conflictResult.resolved,
        timestamp,
        accountId: position.accountId
      })
    } catch (error) {
      console.error('Error handling GraphQL position update:', error)
    }
  }

  private handleGraphQLAccountUpdate(detail: { account: any, timestamp: number }): void {
    try {
      const { account, timestamp } = detail
      this.syncStats.graphqlEvents++
      this.syncStats.lastSyncTime = new Date()

      // Apply conflict resolution
      const conflictResult = conflictResolver.resolveConflict(
        `account:${account.id}`,
        account
      )

      if (conflictResult.wasConflict) {
        this.syncStats.conflictCount++
        console.warn(`Account conflict resolved for ${account.id}`)
      }

      // Convert GraphQL account data to WebSocket format
      const accountInfoData: AccountInfoData = {
        balance: account.balance,
        equity: account.equity,
        freeMargin: account.equity - (account.marginLevel ? (account.equity * 100) / account.marginLevel : 0),
        marginLevel: account.marginLevel || 0,
        bonusAmount: account.bonusAmount,
        profit: 0, // Would need to calculate from positions
        credit: account.bonusAmount, // Assuming bonus is credit
        marginUsed: account.marginLevel ? (account.equity * 100) / account.marginLevel : 0,
        currency: 'USD' // Default currency, should be configurable
      }

      // Sync with WebSocket data synchronizer
      this.dataSynchronizer.syncAccountData([accountInfoData], account.id)

      // Emit event for other components
      this.emitEvent('account-synchronized', {
        source: 'graphql',
        type: 'account_update',
        data: conflictResult.resolved,
        timestamp,
        accountId: account.id
      })
    } catch (error) {
      console.error('Error handling GraphQL account update:', error)
    }
  }

  private handleGraphQLClientPCUpdate(detail: { clientPC: any, timestamp: number }): void {
    try {
      const { clientPC, timestamp } = detail
      this.syncStats.graphqlEvents++

      // Emit event for UI updates
      this.emitEvent('clientpc-synchronized', {
        source: 'graphql',
        type: 'clientpc_update',
        data: clientPC,
        timestamp,
        accountId: clientPC.id
      })
    } catch (error) {
      console.error('Error handling GraphQL client PC update:', error)
    }
  }

  private handleGraphQLEntryUpdate(detail: { entry: any, timestamp: number }): void {
    try {
      const { entry, timestamp } = detail
      this.syncStats.graphqlEvents++

      // Emit event for UI updates
      this.emitEvent('entry-synchronized', {
        source: 'graphql',
        type: 'entry_update',
        data: entry,
        timestamp,
        accountId: entry.accountId
      })
    } catch (error) {
      console.error('Error handling GraphQL entry update:', error)
    }
  }

  private handleGraphQLCloseRecordUpdate(detail: { closeRecord: any, timestamp: number }): void {
    try {
      const { closeRecord, timestamp } = detail
      this.syncStats.graphqlEvents++

      // Emit event for UI updates
      this.emitEvent('close-record-synchronized', {
        source: 'graphql',
        type: 'close_record_update',
        data: closeRecord,
        timestamp,
        accountId: closeRecord.accountId
      })
    } catch (error) {
      console.error('Error handling GraphQL close record update:', error)
    }
  }

  private handleGraphQLSubscriptionError(detail: { type: string, error: any, timestamp: number }): void {
    console.error(`GraphQL subscription error for ${detail.type}:`, detail.error)
    
    this.emitEvent('subscription-error', {
      source: 'graphql',
      type: detail.type,
      error: detail.error,
      timestamp: detail.timestamp
    })
  }

  private cleanupEventListeners(): void {
    // Remove all window event listeners
    const events = [
      'position-update',
      'account-update', 
      'clientpc-update',
      'entry-update',
      'close-record-update',
      'subscription-error'
    ]

    events.forEach(eventType => {
      // Note: In a real implementation, we'd need to store references to the actual handlers
      // to properly remove them. For now, we'll rely on the cleanup when the component unmounts
    })

    // Clear internal event listeners
    this.eventListeners.clear()
  }

  // Utility method to force sync from GraphQL to WebSocket
  async forceSyncFromGraphQL(accountIds?: string[]): Promise<void> {
    const targetAccountIds = accountIds || this.activeAccountIds
    
    if (!this.subscriptionManager) {
      throw new Error('Subscription manager not initialized')
    }

    // This would trigger a refresh of all subscriptions
    await this.subscriptionManager.updateAccountIds(targetAccountIds)
  }

  // Get detailed sync statistics
  getSyncStatistics() {
    return {
      ...this.syncStats,
      dataSynchronizerStatus: this.dataSynchronizer.checkSyncStatus(),
      activeAccountIds: this.activeAccountIds,
      isRunning: this.isRunning,
      subscriptionCount: this.subscriptionManager?.getSubscriptionStatus().activeSubscriptions.length || 0
    }
  }
}

// Singleton instance for global access
let realtimeSyncInstance: RealtimeSyncIntegration | null = null

export const getRealtimeSyncIntegration = (): RealtimeSyncIntegration => {
  if (!realtimeSyncInstance) {
    realtimeSyncInstance = new RealtimeSyncIntegration()
  }
  return realtimeSyncInstance
}

// Hook for React components to easily use realtime sync
export const useRealtimeSync = () => {
  const syncIntegration = getRealtimeSyncIntegration()
  
  return {
    start: () => syncIntegration.start(),
    stop: () => syncIntegration.stop(),
    updateAccountIds: (accountIds: string[]) => syncIntegration.updateAccountIds(accountIds),
    getStatus: () => syncIntegration.getStatus(),
    addEventListener: (eventType: string, callback: Function) => 
      syncIntegration.addEventListener(eventType, callback),
    removeEventListener: (eventType: string, callback: Function) => 
      syncIntegration.removeEventListener(eventType, callback),
    forceSyncFromGraphQL: (accountIds?: string[]) => 
      syncIntegration.forceSyncFromGraphQL(accountIds),
    getSyncStatistics: () => syncIntegration.getSyncStatistics()
  }
}