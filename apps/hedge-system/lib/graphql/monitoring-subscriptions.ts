import { generateClient } from 'aws-amplify/data'
import type { Schema } from '../../../../../packages/shared-backend/amplify/data/resource'

// GraphQL client for Amplify
export const client = generateClient<Schema>()

// Position update subscription handler
export const subscribeToPositionUpdates = (
  accountIds: string[],
  onUpdate: (position: any) => void,
  onError?: (error: any) => void
) => {
  // Using Amplify's subscription for Position model
  const subscription = client.models.Position.observeQuery({
    filter: {
      accountId: { in: accountIds }
    }
  }).subscribe({
    next: ({ items }) => {
      items.forEach(position => onUpdate(position))
    },
    error: onError || ((error) => console.error('Position subscription error:', error))
  })

  return subscription
}

// Account update subscription handler
export const subscribeToAccountUpdates = (
  accountIds: string[],
  onUpdate: (account: any) => void,
  onError?: (error: any) => void
) => {
  const subscription = client.models.Account.observeQuery({
    filter: {
      id: { in: accountIds }
    }
  }).subscribe({
    next: ({ items }) => {
      items.forEach(account => onUpdate(account))
    },
    error: onError || ((error) => console.error('Account subscription error:', error))
  })

  return subscription
}

// Client PC connection status subscription
export const subscribeToClientPCUpdates = (
  userId: string,
  onUpdate: (clientPC: any) => void,
  onError?: (error: any) => void
) => {
  const subscription = client.models.ClientPC.observeQuery({
    filter: {
      userId: { eq: userId }
    }
  }).subscribe({
    next: ({ items }) => {
      items.forEach(clientPC => onUpdate(clientPC))
    },
    error: onError || ((error) => console.error('ClientPC subscription error:', error))
  })

  return subscription
}

// Entry status subscription
export const subscribeToEntryUpdates = (
  accountIds: string[],
  onUpdate: (entry: any) => void,
  onError?: (error: any) => void
) => {
  const subscription = client.models.Entry.observeQuery({
    filter: {
      accountId: { in: accountIds }
    }
  }).subscribe({
    next: ({ items }) => {
      items.forEach(entry => onUpdate(entry))
    },
    error: onError || ((error) => console.error('Entry subscription error:', error))
  })

  return subscription
}

// Close record subscription
export const subscribeToCloseRecords = (
  accountIds: string[],
  onUpdate: (closeRecord: any) => void,
  onError?: (error: any) => void
) => {
  const subscription = client.models.CloseRecord.observeQuery({
    filter: {
      accountId: { in: accountIds }
    }
  }).subscribe({
    next: ({ items }) => {
      items.forEach(closeRecord => onUpdate(closeRecord))
    },
    error: onError || ((error) => console.error('CloseRecord subscription error:', error))
  })

  return subscription
}

// Subscription manager class for centralized subscription management
export class MonitoringSubscriptionManager {
  private subscriptions: Map<string, any> = new Map()
  private activeAccountIds: string[] = []
  private userId: string = ''

  constructor(userId: string) {
    this.userId = userId
  }

  // Initialize all monitoring subscriptions
  async initializeSubscriptions(accountIds: string[]) {
    this.activeAccountIds = accountIds
    
    // Subscribe to position updates
    const positionSub = subscribeToPositionUpdates(
      accountIds,
      (position) => this.handlePositionUpdate(position),
      (error) => this.handleSubscriptionError('position', error)
    )
    this.subscriptions.set('positions', positionSub)

    // Subscribe to account updates
    const accountSub = subscribeToAccountUpdates(
      accountIds,
      (account) => this.handleAccountUpdate(account),
      (error) => this.handleSubscriptionError('account', error)
    )
    this.subscriptions.set('accounts', accountSub)

    // Subscribe to client PC updates
    const clientPCSub = subscribeToClientPCUpdates(
      this.userId,
      (clientPC) => this.handleClientPCUpdate(clientPC),
      (error) => this.handleSubscriptionError('clientPC', error)
    )
    this.subscriptions.set('clientPCs', clientPCSub)

    // Subscribe to entry updates
    const entrySub = subscribeToEntryUpdates(
      accountIds,
      (entry) => this.handleEntryUpdate(entry),
      (error) => this.handleSubscriptionError('entry', error)
    )
    this.subscriptions.set('entries', entrySub)

    // Subscribe to close records
    const closeRecordSub = subscribeToCloseRecords(
      accountIds,
      (closeRecord) => this.handleCloseRecordUpdate(closeRecord),
      (error) => this.handleSubscriptionError('closeRecord', error)
    )
    this.subscriptions.set('closeRecords', closeRecordSub)
  }

  // Handle position updates with data sync
  private handlePositionUpdate(position: any) {
    // Emit custom event for position updates
    window.dispatchEvent(new CustomEvent('position-update', {
      detail: { position, timestamp: Date.now() }
    }))
  }

  // Handle account updates with data sync
  private handleAccountUpdate(account: any) {
    // Emit custom event for account updates
    window.dispatchEvent(new CustomEvent('account-update', {
      detail: { account, timestamp: Date.now() }
    }))
  }

  // Handle client PC updates
  private handleClientPCUpdate(clientPC: any) {
    // Emit custom event for client PC status updates
    window.dispatchEvent(new CustomEvent('clientpc-update', {
      detail: { clientPC, timestamp: Date.now() }
    }))
  }

  // Handle entry updates
  private handleEntryUpdate(entry: any) {
    // Emit custom event for entry updates
    window.dispatchEvent(new CustomEvent('entry-update', {
      detail: { entry, timestamp: Date.now() }
    }))
  }

  // Handle close record updates
  private handleCloseRecordUpdate(closeRecord: any) {
    // Emit custom event for close record updates
    window.dispatchEvent(new CustomEvent('close-record-update', {
      detail: { closeRecord, timestamp: Date.now() }
    }))
  }

  // Handle subscription errors
  private handleSubscriptionError(type: string, error: any) {
    console.error(`Subscription error for ${type}:`, error)
    
    // Emit error event
    window.dispatchEvent(new CustomEvent('subscription-error', {
      detail: { type, error, timestamp: Date.now() }
    }))

    // Attempt to restart subscription after delay
    setTimeout(() => {
      this.restartSubscription(type)
    }, 5000)
  }

  // Restart specific subscription
  private async restartSubscription(type: string) {
    const existingSub = this.subscriptions.get(type)
    if (existingSub) {
      existingSub.unsubscribe()
      this.subscriptions.delete(type)
    }

    // Re-initialize specific subscription
    switch (type) {
      case 'position':
        const positionSub = subscribeToPositionUpdates(
          this.activeAccountIds,
          (position) => this.handlePositionUpdate(position),
          (error) => this.handleSubscriptionError('position', error)
        )
        this.subscriptions.set('positions', positionSub)
        break
      
      case 'account':
        const accountSub = subscribeToAccountUpdates(
          this.activeAccountIds,
          (account) => this.handleAccountUpdate(account),
          (error) => this.handleSubscriptionError('account', error)
        )
        this.subscriptions.set('accounts', accountSub)
        break
      
      // Add other subscription restart cases as needed
    }
  }

  // Update active account IDs and refresh subscriptions
  async updateAccountIds(newAccountIds: string[]) {
    if (JSON.stringify(this.activeAccountIds) !== JSON.stringify(newAccountIds)) {
      this.activeAccountIds = newAccountIds
      await this.refreshSubscriptions()
    }
  }

  // Refresh all subscriptions
  private async refreshSubscriptions() {
    // Unsubscribe all current subscriptions
    this.subscriptions.forEach((subscription, key) => {
      subscription.unsubscribe()
    })
    this.subscriptions.clear()

    // Re-initialize with new account IDs
    await this.initializeSubscriptions(this.activeAccountIds)
  }

  // Clean up all subscriptions
  cleanup() {
    this.subscriptions.forEach((subscription, key) => {
      subscription.unsubscribe()
    })
    this.subscriptions.clear()
  }

  // Get subscription status
  getSubscriptionStatus() {
    return {
      activeSubscriptions: Array.from(this.subscriptions.keys()),
      activeAccountIds: this.activeAccountIds,
      userId: this.userId
    }
  }
}

// Data conflict resolution utility
export class DataConflictResolver {
  private lastUpdates: Map<string, { data: any, timestamp: number }> = new Map()

  // Resolve conflicts based on timestamp and data integrity
  resolveConflict(
    key: string, 
    newData: any, 
    existingData?: any
  ): { resolved: any, wasConflict: boolean } {
    const now = Date.now()
    const lastUpdate = this.lastUpdates.get(key)

    // If no existing data, accept new data
    if (!existingData && !lastUpdate) {
      this.lastUpdates.set(key, { data: newData, timestamp: now })
      return { resolved: newData, wasConflict: false }
    }

    // Check for data conflicts
    let wasConflict = false
    let resolved = newData

    if (lastUpdate && existingData) {
      // Compare timestamps and data versions
      const timeDiff = now - lastUpdate.timestamp
      
      // If data was updated very recently (< 1000ms), check for conflicts
      if (timeDiff < 1000) {
        // Use newer timestamp or version if available
        if (newData.updatedAt && existingData.updatedAt) {
          const newTimestamp = new Date(newData.updatedAt).getTime()
          const existingTimestamp = new Date(existingData.updatedAt).getTime()
          
          if (existingTimestamp > newTimestamp) {
            resolved = existingData
            wasConflict = true
          }
        } else {
          // Use latest received data if no timestamp comparison possible
          resolved = newData
          wasConflict = true
        }
      }
    }

    // Update last known state
    this.lastUpdates.set(key, { data: resolved, timestamp: now })

    return { resolved, wasConflict }
  }

  // Clear old conflict resolution data
  cleanup(olderThanMs: number = 300000) { // 5 minutes default
    const cutoff = Date.now() - olderThanMs
    
    this.lastUpdates.forEach((update, key) => {
      if (update.timestamp < cutoff) {
        this.lastUpdates.delete(key)
      }
    })
  }
}

// Export singleton instances
export const conflictResolver = new DataConflictResolver()

// Utility function to create monitoring subscription manager
export const createMonitoringSubscriptionManager = (userId: string) => {
  return new MonitoringSubscriptionManager(userId)
}