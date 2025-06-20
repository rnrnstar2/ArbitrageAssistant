import { MonitoringSubscriptionManager } from './monitoring-subscriptions'
import { RealtimeSyncIntegration } from './realtime-sync-integration'
import { getCurrentUser } from 'aws-amplify/auth'
import { client } from './monitoring-subscriptions'

export interface ClientInfo {
  clientId: string
  userId: string
  userRole: 'admin' | 'client'
  accountIds: string[]
  permissions: ClientPermissions
  lastActivity: Date
  subscriptionManager?: MonitoringSubscriptionManager
  syncIntegration?: RealtimeSyncIntegration
}

export interface ClientPermissions {
  canViewAllAccounts: boolean
  canTradeAllAccounts: boolean
  allowedAccountIds: string[]
  canViewSystemMetrics: boolean
}

export interface MultiClientEvent {
  type: string
  clientId: string
  data: any
  timestamp: Date
}

export class MultiClientManager {
  private connectedClients: Map<string, ClientInfo> = new Map()
  private clientEventHandlers: Map<string, Function[]> = new Map()
  private globalEventHandlers: Map<string, Function[]> = new Map()
  private currentUser?: ClientInfo
  private heartbeatInterval?: NodeJS.Timeout

  constructor() {
    this.startHeartbeatCheck()
  }

  // Initialize client connection
  async initializeClient(): Promise<ClientInfo> {
    try {
      const user = await getCurrentUser()
      const clientId = this.generateClientId()
      
      // Get user's account information
      const userAccounts = await this.getUserAccounts(user.userId)
      const userRole = await this.getUserRole(user.userId)
      
      const permissions = this.determinePermissions(userRole, userAccounts)
      
      const clientInfo: ClientInfo = {
        clientId,
        userId: user.userId,
        userRole,
        accountIds: userAccounts.map(acc => acc.id),
        permissions,
        lastActivity: new Date()
      }

      // Create dedicated subscription manager for this client
      clientInfo.subscriptionManager = new MonitoringSubscriptionManager(user.userId)
      
      // Create dedicated sync integration for this client
      clientInfo.syncIntegration = new RealtimeSyncIntegration()

      // Initialize subscriptions for client's accounts
      if (clientInfo.accountIds.length > 0) {
        await clientInfo.subscriptionManager.initializeSubscriptions(clientInfo.accountIds)
        await clientInfo.syncIntegration.start()
        await clientInfo.syncIntegration.updateAccountIds(clientInfo.accountIds)
      }

      // Setup client-specific event listeners
      this.setupClientEventListeners(clientInfo)

      // Register client
      this.connectedClients.set(clientId, clientInfo)
      this.currentUser = clientInfo

      // Emit client connected event
      this.emitGlobalEvent('client-connected', {
        type: 'client-connected',
        clientId,
        data: clientInfo,
        timestamp: new Date()
      })

      console.log(`Client ${clientId} initialized for user ${user.userId}`)
      return clientInfo
    } catch (error) {
      console.error('Failed to initialize client:', error)
      throw error
    }
  }

  // Disconnect client
  async disconnectClient(clientId: string): Promise<void> {
    const client = this.connectedClients.get(clientId)
    if (!client) {
      console.warn(`Client ${clientId} not found for disconnection`)
      return
    }

    // Cleanup subscriptions
    if (client.subscriptionManager) {
      client.subscriptionManager.cleanup()
    }

    if (client.syncIntegration) {
      client.syncIntegration.stop()
    }

    // Remove client from registry
    this.connectedClients.delete(clientId)

    // Clean up event handlers for this client
    this.clientEventHandlers.delete(clientId)

    // Emit client disconnected event
    this.emitGlobalEvent('client-disconnected', {
      type: 'client-disconnected',
      clientId,
      data: client,
      timestamp: new Date()
    })

    console.log(`Client ${clientId} disconnected`)
  }

  // Update client account access
  async updateClientAccounts(clientId: string, newAccountIds: string[]): Promise<void> {
    const client = this.connectedClients.get(clientId)
    if (!client) {
      throw new Error(`Client ${clientId} not found`)
    }

    // Check permissions
    if (!this.canAccessAccounts(client, newAccountIds)) {
      throw new Error('Client does not have permission to access requested accounts')
    }

    // Update account IDs
    client.accountIds = newAccountIds
    client.lastActivity = new Date()

    // Update subscriptions
    if (client.subscriptionManager) {
      await client.subscriptionManager.updateAccountIds(newAccountIds)
    }

    if (client.syncIntegration) {
      await client.syncIntegration.updateAccountIds(newAccountIds)
    }

    // Emit account update event
    this.emitClientEvent(clientId, 'accounts-updated', {
      type: 'accounts-updated',
      clientId,
      data: { accountIds: newAccountIds },
      timestamp: new Date()
    })
  }

  // Get client information
  getClient(clientId: string): ClientInfo | undefined {
    return this.connectedClients.get(clientId)
  }

  // Get current user client
  getCurrentClient(): ClientInfo | undefined {
    return this.currentUser
  }

  // Get all connected clients (admin only)
  getAllClients(): ClientInfo[] {
    if (!this.currentUser || this.currentUser.userRole !== 'admin') {
      throw new Error('Only admin users can view all clients')
    }
    return Array.from(this.connectedClients.values())
  }

  // Get clients by account ID (admin only)
  getClientsByAccount(accountId: string): ClientInfo[] {
    if (!this.currentUser || this.currentUser.userRole !== 'admin') {
      throw new Error('Only admin users can query clients by account')
    }
    
    return Array.from(this.connectedClients.values())
      .filter(client => client.accountIds.includes(accountId))
  }

  // Update client activity
  updateClientActivity(clientId: string): void {
    const client = this.connectedClients.get(clientId)
    if (client) {
      client.lastActivity = new Date()
    }
  }

  // Check if client can access specific accounts
  canAccessAccounts(client: ClientInfo, accountIds: string[]): boolean {
    if (client.permissions.canViewAllAccounts) {
      return true
    }
    
    return accountIds.every(accountId => 
      client.permissions.allowedAccountIds.includes(accountId)
    )
  }

  // Broadcast data to all relevant clients
  async broadcastToClients(
    data: any, 
    targetAccountIds?: string[], 
    excludeClientId?: string
  ): Promise<void> {
    const relevantClients = Array.from(this.connectedClients.values())
      .filter(client => {
        if (excludeClientId && client.clientId === excludeClientId) {
          return false
        }
        
        if (!targetAccountIds) {
          return true
        }
        
        return client.accountIds.some(accountId => 
          targetAccountIds.includes(accountId)
        )
      })

    // Send data to each relevant client
    for (const client of relevantClients) {
      try {
        this.emitClientEvent(client.clientId, 'broadcast-data', {
          type: 'broadcast-data',
          clientId: client.clientId,
          data,
          timestamp: new Date()
        })
      } catch (error) {
        console.error(`Failed to broadcast to client ${client.clientId}:`, error)
      }
    }
  }

  // Add event listener for specific client
  addClientEventListener(clientId: string, eventType: string, callback: Function): void {
    const key = `${clientId}:${eventType}`
    if (!this.clientEventHandlers.has(key)) {
      this.clientEventHandlers.set(key, [])
    }
    this.clientEventHandlers.get(key)!.push(callback)
  }

  // Add global event listener (for all clients)
  addGlobalEventListener(eventType: string, callback: Function): void {
    if (!this.globalEventHandlers.has(eventType)) {
      this.globalEventHandlers.set(eventType, [])
    }
    this.globalEventHandlers.get(eventType)!.push(callback)
  }

  // Remove event listener
  removeEventListener(clientId: string, eventType: string, callback: Function): void {
    const key = `${clientId}:${eventType}`
    const handlers = this.clientEventHandlers.get(key)
    if (handlers) {
      const index = handlers.indexOf(callback)
      if (index !== -1) {
        handlers.splice(index, 1)
      }
    }
  }

  // Get connection statistics
  getConnectionStatistics() {
    const clients = Array.from(this.connectedClients.values())
    
    return {
      totalClients: clients.length,
      adminClients: clients.filter(c => c.userRole === 'admin').length,
      regularClients: clients.filter(c => c.userRole === 'client').length,
      accountsInUse: new Set(clients.flatMap(c => c.accountIds)).size,
      clientsByAccount: this.getClientDistributionByAccount(),
      lastActivityTimes: clients.map(c => ({
        clientId: c.clientId,
        lastActivity: c.lastActivity
      }))
    }
  }

  // Cleanup all clients
  async cleanup(): Promise<void> {
    const clientIds = Array.from(this.connectedClients.keys())
    
    for (const clientId of clientIds) {
      await this.disconnectClient(clientId)
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
    }

    this.clientEventHandlers.clear()
    this.globalEventHandlers.clear()
  }

  private async getUserAccounts(userId: string) {
    try {
      // Query user's client PCs and their accounts
      const { data: clientPCs } = await client.models.ClientPC.list({
        filter: { userId: { eq: userId } }
      })

      const accounts = []
      for (const clientPC of clientPCs) {
        const { data: pcAccounts } = await client.models.Account.list({
          filter: { clientPCId: { eq: clientPC.id } }
        })
        accounts.push(...pcAccounts)
      }

      return accounts
    } catch (error) {
      console.error('Failed to get user accounts:', error)
      return []
    }
  }

  private async getUserRole(userId: string): Promise<'admin' | 'client'> {
    try {
      const { data: user } = await client.models.User.get({ id: userId })
      return user?.role as 'admin' | 'client' || 'client'
    } catch (error) {
      console.error('Failed to get user role:', error)
      return 'client'
    }
  }

  private determinePermissions(userRole: 'admin' | 'client', accounts: any[]): ClientPermissions {
    if (userRole === 'admin') {
      return {
        canViewAllAccounts: true,
        canTradeAllAccounts: true,
        allowedAccountIds: [], // Empty means all accounts
        canViewSystemMetrics: true
      }
    }

    return {
      canViewAllAccounts: false,
      canTradeAllAccounts: false,
      allowedAccountIds: accounts.map(acc => acc.id),
      canViewSystemMetrics: false
    }
  }

  private setupClientEventListeners(clientInfo: ClientInfo): void {
    if (!clientInfo.syncIntegration) return

    // Setup event forwarding from sync integration to multi-client events
    const eventTypes = [
      'position-synchronized',
      'account-synchronized',
      'clientpc-synchronized',
      'entry-synchronized',
      'close-record-synchronized'
    ]

    eventTypes.forEach(eventType => {
      clientInfo.syncIntegration!.addEventListener(eventType, (data: any) => {
        this.emitClientEvent(clientInfo.clientId, eventType, {
          type: eventType,
          clientId: clientInfo.clientId,
          data,
          timestamp: new Date()
        })
      })
    })
  }

  private emitClientEvent(clientId: string, eventType: string, eventData: MultiClientEvent): void {
    const key = `${clientId}:${eventType}`
    const handlers = this.clientEventHandlers.get(key)
    
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(eventData)
        } catch (error) {
          console.error(`Error in client event handler for ${eventType}:`, error)
        }
      })
    }

    // Update client activity
    this.updateClientActivity(clientId)
  }

  private emitGlobalEvent(eventType: string, eventData: MultiClientEvent): void {
    const handlers = this.globalEventHandlers.get(eventType)
    
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler(eventData)
        } catch (error) {
          console.error(`Error in global event handler for ${eventType}:`, error)
        }
      })
    }
  }

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getClientDistributionByAccount(): Record<string, number> {
    const distribution: Record<string, number> = {}
    
    for (const client of this.connectedClients.values()) {
      client.accountIds.forEach(accountId => {
        distribution[accountId] = (distribution[accountId] || 0) + 1
      })
    }
    
    return distribution
  }

  private startHeartbeatCheck(): void {
    this.heartbeatInterval = setInterval(() => {
      this.checkClientHeartbeats()
    }, 30000) // Check every 30 seconds
  }

  private checkClientHeartbeats(): void {
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)
    
    const inactiveClients = Array.from(this.connectedClients.entries())
      .filter(([_, client]) => client.lastActivity < fiveMinutesAgo)
    
    // Disconnect inactive clients
    inactiveClients.forEach(([clientId, client]) => {
      console.warn(`Disconnecting inactive client ${clientId}`)
      this.disconnectClient(clientId)
    })
  }
}

// Singleton instance
let multiClientManagerInstance: MultiClientManager | null = null

export const getMultiClientManager = (): MultiClientManager => {
  if (!multiClientManagerInstance) {
    multiClientManagerInstance = new MultiClientManager()
  }
  return multiClientManagerInstance
}

// React hook for using multi-client manager
export const useMultiClientManager = () => {
  const manager = getMultiClientManager()
  
  return {
    initializeClient: () => manager.initializeClient(),
    disconnectClient: (clientId: string) => manager.disconnectClient(clientId),
    updateClientAccounts: (clientId: string, accountIds: string[]) => 
      manager.updateClientAccounts(clientId, accountIds),
    getClient: (clientId: string) => manager.getClient(clientId),
    getCurrentClient: () => manager.getCurrentClient(),
    getAllClients: () => manager.getAllClients(),
    getClientsByAccount: (accountId: string) => manager.getClientsByAccount(accountId),
    canAccessAccounts: (client: ClientInfo, accountIds: string[]) => 
      manager.canAccessAccounts(client, accountIds),
    broadcastToClients: (data: any, targetAccountIds?: string[], excludeClientId?: string) =>
      manager.broadcastToClients(data, targetAccountIds, excludeClientId),
    addClientEventListener: (clientId: string, eventType: string, callback: Function) =>
      manager.addClientEventListener(clientId, eventType, callback),
    addGlobalEventListener: (eventType: string, callback: Function) =>
      manager.addGlobalEventListener(eventType, callback),
    removeEventListener: (clientId: string, eventType: string, callback: Function) =>
      manager.removeEventListener(clientId, eventType, callback),
    getConnectionStatistics: () => manager.getConnectionStatistics(),
    cleanup: () => manager.cleanup()
  }
}