import { conflictResolver } from './monitoring-subscriptions'

export interface ConflictResolutionStrategy {
  name: string
  priority: number
  resolve: (context: ConflictContext) => ConflictResolution
}

export interface ConflictContext {
  key: string
  newData: any
  existingData: any
  source: 'graphql' | 'websocket' | 'local'
  timestamp: number
  metadata?: {
    messageId?: string
    sequenceNumber?: number
    clientId?: string
    version?: string
  }
}

export interface ConflictResolution {
  resolved: any
  strategy: string
  confidence: number // 0-1
  wasConflict: boolean
  reason?: string
  additionalActions?: ConflictAction[]
}

export interface ConflictAction {
  type: 'merge' | 'notify' | 'log' | 'escalate' | 'resync'
  target?: string
  data?: any
}

export interface ConflictMetrics {
  totalConflicts: number
  resolvedConflicts: number
  escalatedConflicts: number
  conflictsByType: Record<string, number>
  conflictsByStrategy: Record<string, number>
  averageResolutionTime: number
  recentConflicts: ConflictHistory[]
}

export interface ConflictHistory {
  timestamp: Date
  key: string
  strategy: string
  resolution: ConflictResolution
  context: ConflictContext
}

export class AdvancedConflictResolver {
  private strategies: Map<string, ConflictResolutionStrategy> = new Map()
  private conflictHistory: ConflictHistory[] = new Map()
  private metrics: ConflictMetrics = {
    totalConflicts: 0,
    resolvedConflicts: 0,
    escalatedConflicts: 0,
    conflictsByType: {},
    conflictsByStrategy: {},
    averageResolutionTime: 0,
    recentConflicts: []
  }
  private readonly maxHistorySize = 1000

  constructor() {
    this.initializeDefaultStrategies()
  }

  // Register a custom conflict resolution strategy
  registerStrategy(strategy: ConflictResolutionStrategy): void {
    this.strategies.set(strategy.name, strategy)
  }

  // Resolve conflict using registered strategies
  resolveConflict(context: ConflictContext): ConflictResolution {
    const startTime = Date.now()
    this.metrics.totalConflicts++

    // Determine conflict type
    const conflictType = this.getConflictType(context)
    this.metrics.conflictsByType[conflictType] = (this.metrics.conflictsByType[conflictType] || 0) + 1

    // Get applicable strategies and sort by priority
    const applicableStrategies = Array.from(this.strategies.values())
      .filter(strategy => this.isStrategyApplicable(strategy, context))
      .sort((a, b) => b.priority - a.priority)

    let bestResolution: ConflictResolution | null = null
    let bestConfidence = 0

    // Try each strategy and pick the one with highest confidence
    for (const strategy of applicableStrategies) {
      try {
        const resolution = strategy.resolve(context)
        
        if (resolution.confidence > bestConfidence) {
          bestResolution = resolution
          bestConfidence = resolution.confidence
        }

        // If we get perfect confidence, stop searching
        if (resolution.confidence >= 1.0) {
          break
        }
      } catch (error) {
        console.error(`Error in conflict resolution strategy ${strategy.name}:`, error)
      }
    }

    // Fallback to simple resolution if no strategy worked
    if (!bestResolution) {
      bestResolution = this.fallbackResolution(context)
    }

    // Update metrics
    this.metrics.resolvedConflicts++
    this.metrics.conflictsByStrategy[bestResolution.strategy] = 
      (this.metrics.conflictsByStrategy[bestResolution.strategy] || 0) + 1

    const resolutionTime = Date.now() - startTime
    this.updateAverageResolutionTime(resolutionTime)

    // Add to history
    this.addToHistory(context, bestResolution)

    // Execute additional actions
    if (bestResolution.additionalActions) {
      this.executeConflictActions(bestResolution.additionalActions, context)
    }

    return bestResolution
  }

  // Get conflict resolution metrics
  getMetrics(): ConflictMetrics {
    return { ...this.metrics }
  }

  // Get recent conflict history
  getHistory(limit: number = 50): ConflictHistory[] {
    return this.conflictHistory.slice(-limit)
  }

  // Clear old history
  cleanupHistory(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = new Date(Date.now() - olderThanMs)
    this.conflictHistory = this.conflictHistory.filter(item => item.timestamp > cutoff)
  }

  private initializeDefaultStrategies(): void {
    // Timestamp-based resolution strategy
    this.registerStrategy({
      name: 'timestamp-priority',
      priority: 100,
      resolve: (context: ConflictContext): ConflictResolution => {
        const newTimestamp = this.extractTimestamp(context.newData)
        const existingTimestamp = this.extractTimestamp(context.existingData)

        if (newTimestamp && existingTimestamp) {
          const isNewer = newTimestamp > existingTimestamp
          return {
            resolved: isNewer ? context.newData : context.existingData,
            strategy: 'timestamp-priority',
            confidence: 0.9,
            wasConflict: true,
            reason: `Selected ${isNewer ? 'newer' : 'existing'} data based on timestamp`
          }
        }

        return {
          resolved: context.newData,
          strategy: 'timestamp-priority',
          confidence: 0.5,
          wasConflict: true,
          reason: 'No timestamp available, defaulting to new data'
        }
      }
    })

    // Version-based resolution strategy
    this.registerStrategy({
      name: 'version-priority',
      priority: 95,
      resolve: (context: ConflictContext): ConflictResolution => {
        const newVersion = this.extractVersion(context.newData)
        const existingVersion = this.extractVersion(context.existingData)

        if (newVersion && existingVersion) {
          const isNewer = this.compareVersions(newVersion, existingVersion) > 0
          return {
            resolved: isNewer ? context.newData : context.existingData,
            strategy: 'version-priority',
            confidence: 0.95,
            wasConflict: true,
            reason: `Selected ${isNewer ? 'newer' : 'existing'} version`
          }
        }

        return {
          resolved: context.newData,
          strategy: 'version-priority',
          confidence: 0.3,
          wasConflict: true,
          reason: 'No version info available'
        }
      }
    })

    // Source priority strategy (GraphQL > WebSocket > Local)
    this.registerStrategy({
      name: 'source-priority',
      priority: 80,
      resolve: (context: ConflictContext): ConflictResolution => {
        const sourcePriority = {
          'graphql': 3,
          'websocket': 2,
          'local': 1
        }

        const currentPriority = sourcePriority[context.source] || 0
        
        return {
          resolved: context.newData,
          strategy: 'source-priority',
          confidence: 0.7,
          wasConflict: true,
          reason: `GraphQL source has priority over others`
        }
      }
    })

    // Data integrity strategy
    this.registerStrategy({
      name: 'data-integrity',
      priority: 90,
      resolve: (context: ConflictContext): ConflictResolution => {
        const newIntegrity = this.checkDataIntegrity(context.newData)
        const existingIntegrity = this.checkDataIntegrity(context.existingData)

        if (newIntegrity.score > existingIntegrity.score) {
          return {
            resolved: context.newData,
            strategy: 'data-integrity',
            confidence: 0.85,
            wasConflict: true,
            reason: 'New data has better integrity score'
          }
        } else if (existingIntegrity.score > newIntegrity.score) {
          return {
            resolved: context.existingData,
            strategy: 'data-integrity',
            confidence: 0.85,
            wasConflict: true,
            reason: 'Existing data has better integrity score'
          }
        }

        return {
          resolved: context.newData,
          strategy: 'data-integrity',
          confidence: 0.5,
          wasConflict: true,
          reason: 'Equal integrity scores, defaulting to new data'
        }
      }
    })

    // Smart merge strategy
    this.registerStrategy({
      name: 'smart-merge',
      priority: 85,
      resolve: (context: ConflictContext): ConflictResolution => {
        const merged = this.smartMerge(context.newData, context.existingData)
        
        return {
          resolved: merged,
          strategy: 'smart-merge',
          confidence: 0.8,
          wasConflict: true,
          reason: 'Merged complementary fields from both sources',
          additionalActions: [{
            type: 'log',
            data: { mergeResult: merged, original: [context.newData, context.existingData] }
          }]
        }
      }
    })
  }

  private getConflictType(context: ConflictContext): string {
    if (context.key.includes('position')) return 'position'
    if (context.key.includes('account')) return 'account'
    if (context.key.includes('entry')) return 'entry'
    if (context.key.includes('close')) return 'close'
    return 'unknown'
  }

  private isStrategyApplicable(strategy: ConflictResolutionStrategy, context: ConflictContext): boolean {
    // All strategies are applicable by default
    // Could add more sophisticated logic here based on context
    return true
  }

  private fallbackResolution(context: ConflictContext): ConflictResolution {
    return {
      resolved: context.newData,
      strategy: 'fallback',
      confidence: 0.1,
      wasConflict: true,
      reason: 'All strategies failed, using new data as fallback'
    }
  }

  private extractTimestamp(data: any): number | null {
    if (!data) return null
    
    // Try various timestamp fields
    const timestampFields = ['updatedAt', 'timestamp', 'lastModified', 'createdAt', 'updateTime']
    
    for (const field of timestampFields) {
      if (data[field]) {
        const timestamp = new Date(data[field]).getTime()
        if (!isNaN(timestamp)) {
          return timestamp
        }
      }
    }
    
    return null
  }

  private extractVersion(data: any): string | null {
    if (!data) return null
    
    // Try various version fields
    const versionFields = ['version', '_version', 'v', 'rev', 'revision']
    
    for (const field of versionFields) {
      if (data[field]) {
        return String(data[field])
      }
    }
    
    return null
  }

  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0
      const part2 = parts2[i] || 0
      
      if (part1 > part2) return 1
      if (part1 < part2) return -1
    }
    
    return 0
  }

  private checkDataIntegrity(data: any): { score: number, reasons: string[] } {
    let score = 0
    const reasons: string[] = []
    
    if (!data) {
      return { score: 0, reasons: ['Data is null/undefined'] }
    }
    
    // Check for required fields
    const requiredFields = ['id', 'timestamp']
    const hasRequiredFields = requiredFields.every(field => data[field] !== undefined)
    if (hasRequiredFields) {
      score += 30
      reasons.push('Has required fields')
    }
    
    // Check for data completeness
    const fieldCount = Object.keys(data).length
    if (fieldCount > 5) {
      score += 20
      reasons.push('Good field coverage')
    }
    
    // Check for valid timestamps
    const timestampFields = ['updatedAt', 'createdAt', 'timestamp']
    const hasValidTimestamp = timestampFields.some(field => {
      if (data[field]) {
        const timestamp = new Date(data[field])
        return !isNaN(timestamp.getTime())
      }
      return false
    })
    
    if (hasValidTimestamp) {
      score += 25
      reasons.push('Has valid timestamp')
    }
    
    // Check for numeric consistency
    const numericFields = ['profit', 'balance', 'lots', 'price']
    const hasValidNumbers = numericFields.every(field => {
      if (data[field] !== undefined) {
        return typeof data[field] === 'number' && !isNaN(data[field])
      }
      return true
    })
    
    if (hasValidNumbers) {
      score += 25
      reasons.push('Numeric fields are valid')
    }
    
    return { score, reasons }
  }

  private smartMerge(newData: any, existingData: any): any {
    if (!existingData) return newData
    if (!newData) return existingData
    
    const merged = { ...existingData }
    
    // Merge strategy: prefer newer timestamps, keep non-null values
    Object.keys(newData).forEach(key => {
      const newValue = newData[key]
      const existingValue = existingData[key]
      
      // Always take new value if existing is null/undefined
      if (existingValue === null || existingValue === undefined) {
        merged[key] = newValue
        return
      }
      
      // For timestamp fields, take the newer one
      if (key.includes('Time') || key.includes('At') || key === 'timestamp') {
        const newTime = new Date(newValue).getTime()
        const existingTime = new Date(existingValue).getTime()
        
        if (!isNaN(newTime) && !isNaN(existingTime)) {
          merged[key] = newTime > existingTime ? newValue : existingValue
        } else {
          merged[key] = newValue
        }
        return
      }
      
      // For numeric fields, take the new value if it seems more recent
      if (typeof newValue === 'number' && typeof existingValue === 'number') {
        merged[key] = newValue
        return
      }
      
      // Default: take new value
      merged[key] = newValue
    })
    
    return merged
  }

  private executeConflictActions(actions: ConflictAction[], context: ConflictContext): void {
    actions.forEach(action => {
      try {
        switch (action.type) {
          case 'log':
            console.log(`Conflict resolution action - ${action.type}:`, action.data)
            break
          case 'notify':
            // Could integrate with notification system
            console.warn(`Conflict notification:`, action.data)
            break
          case 'escalate':
            this.metrics.escalatedConflicts++
            console.error(`Conflict escalated:`, action.data)
            break
          case 'resync':
            // Could trigger a resync operation
            console.info(`Resync requested:`, action.data)
            break
          default:
            console.warn(`Unknown conflict action type: ${action.type}`)
        }
      } catch (error) {
        console.error(`Error executing conflict action ${action.type}:`, error)
      }
    })
  }

  private addToHistory(context: ConflictContext, resolution: ConflictResolution): void {
    const historyItem: ConflictHistory = {
      timestamp: new Date(),
      key: context.key,
      strategy: resolution.strategy,
      resolution,
      context
    }
    
    this.conflictHistory.push(historyItem)
    this.metrics.recentConflicts.push(historyItem)
    
    // Keep history size manageable
    if (this.conflictHistory.length > this.maxHistorySize) {
      this.conflictHistory = this.conflictHistory.slice(-this.maxHistorySize)
    }
    
    if (this.metrics.recentConflicts.length > 100) {
      this.metrics.recentConflicts = this.metrics.recentConflicts.slice(-100)
    }
  }

  private updateAverageResolutionTime(newTime: number): void {
    const currentAvg = this.metrics.averageResolutionTime
    const totalResolved = this.metrics.resolvedConflicts
    
    this.metrics.averageResolutionTime = 
      ((currentAvg * (totalResolved - 1)) + newTime) / totalResolved
  }
}

// Enhanced conflict resolver that extends the basic one
export class EnhancedConflictResolver {
  private basic = conflictResolver
  private advanced = new AdvancedConflictResolver()

  // Main resolution method that tries advanced first, falls back to basic
  resolveConflict(
    key: string,
    newData: any,
    existingData?: any,
    source: 'graphql' | 'websocket' | 'local' = 'graphql',
    metadata?: any
  ): { resolved: any, wasConflict: boolean, strategy?: string } {
    
    // If no existing data, no conflict
    if (!existingData) {
      return { resolved: newData, wasConflict: false }
    }

    // Try advanced resolution first
    try {
      const context: ConflictContext = {
        key,
        newData,
        existingData,
        source,
        timestamp: Date.now(),
        metadata
      }

      const resolution = this.advanced.resolveConflict(context)
      
      return {
        resolved: resolution.resolved,
        wasConflict: resolution.wasConflict,
        strategy: resolution.strategy
      }
    } catch (error) {
      console.error('Advanced conflict resolution failed, falling back to basic:', error)
      
      // Fallback to basic resolution
      const basicResult = this.basic.resolveConflict(key, newData, existingData)
      
      return {
        resolved: basicResult.resolved,
        wasConflict: basicResult.wasConflict,
        strategy: 'basic-fallback'
      }
    }
  }

  // Get resolution metrics
  getMetrics() {
    return this.advanced.getMetrics()
  }

  // Get resolution history
  getHistory(limit?: number) {
    return this.advanced.getHistory(limit)
  }

  // Register custom strategy
  registerStrategy(strategy: ConflictResolutionStrategy) {
    this.advanced.registerStrategy(strategy)
  }

  // Cleanup old data
  cleanup(olderThanMs?: number) {
    this.basic.cleanup(olderThanMs)
    this.advanced.cleanupHistory(olderThanMs)
  }
}

// Export singleton instance
export const enhancedConflictResolver = new EnhancedConflictResolver()