export interface CacheConfig {
  maxSize: number;
  ttl: number;  // default TTL in seconds
  strategy: 'lru' | 'lfu' | 'fifo';
  compressionEnabled: boolean;
  compressionThreshold: number; // bytes
  persistToDisk: boolean;
  diskCachePath?: string;
}

export interface CacheEntry {
  value: any;
  timestamp: number;
  ttl: number; // milliseconds
  accessCount: number;
  lastAccessed: number;
  size: number;
  compressed: boolean;
}

export interface CacheStats {
  hitRate: number;
  missRate: number;
  evictionRate: number;
  memoryUsage: number;
  entryCount: number;
  averageAccessTime: number;
  compressionSavings: number;
}

export interface CachePerformanceMetrics {
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
  totalMemory: number;
  compressionRatio: number;
  averageEntrySize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

interface AccessPattern {
  key: string;
  frequency: number;
  lastAccess: number;
  accessTimes: number[];
}

export class CacheManager {
  private cache: Map<string, CacheEntry> = new Map();
  private config: CacheConfig;
  private stats: CacheStats;
  private metrics: CachePerformanceMetrics;
  private accessOrder: string[] = []; // for LRU
  private accessPatterns: Map<string, AccessPattern> = new Map();
  private compressionManager?: any; // Will be injected
  private cleanupInterval?: NodeJS.Timeout;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,
      ttl: 3600, // 1 hour
      strategy: 'lru',
      compressionEnabled: false,
      compressionThreshold: 1024,
      persistToDisk: false,
      ...config,
    };

    this.stats = {
      hitRate: 0,
      missRate: 0,
      evictionRate: 0,
      memoryUsage: 0,
      entryCount: 0,
      averageAccessTime: 0,
      compressionSavings: 0,
    };

    this.metrics = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalRequests: 0,
      totalMemory: 0,
      compressionRatio: 1.0,
      averageEntrySize: 0,
    };

    this.startPeriodicCleanup();
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const startTime = performance.now();
    this.metrics.totalRequests++;

    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.misses++;
      this.updateStats();
      return null;
    }

    // TTL check
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.metrics.misses++;
      this.updateStats();
      return null;
    }

    // Update access information
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.recordAccess(key);
    this.updateAccessPattern(key);

    this.metrics.hits++;
    
    // Record access time
    const accessTime = performance.now() - startTime;
    this.updateAverageAccessTime(accessTime);

    this.updateStats();

    // Decompress if necessary
    let value = entry.value;
    if (entry.compressed && this.compressionManager) {
      try {
        value = await this.compressionManager.decompress(entry.value);
      } catch (error) {
        console.error('Cache decompression failed:', error);
        return null;
      }
    }

    return value as T;
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    // Check memory limits before adding
    if (this.cache.size >= this.config.maxSize) {
      await this.evictEntries();
    }

    const serializedValue = JSON.stringify(value);
    let finalValue: any = serializedValue;
    let compressed = false;
    let size = Buffer.byteLength(serializedValue, 'utf8');

    // Compress if enabled and value is large enough
    if (this.config.compressionEnabled && 
        size >= this.config.compressionThreshold && 
        this.compressionManager) {
      try {
        const compressedData = await this.compressionManager.compress(value);
        if (compressedData.compressedSize < size) {
          finalValue = compressedData;
          compressed = true;
          size = compressedData.compressedSize;
          this.updateCompressionStats(size, Buffer.byteLength(serializedValue, 'utf8'));
        }
      } catch (error) {
        console.error('Cache compression failed:', error);
      }
    }

    const entry: CacheEntry = {
      value: finalValue,
      timestamp: Date.now(),
      ttl: (ttl || this.config.ttl) * 1000, // convert to milliseconds
      accessCount: 1,
      lastAccessed: Date.now(),
      size,
      compressed,
    };

    this.cache.set(key, entry);
    this.recordAccess(key);
    this.initializeAccessPattern(key);
    this.updateMemoryUsage();
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.accessPatterns.delete(key);
      this.updateMemoryUsage();
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessOrder = [];
    this.accessPatterns.clear();
    this.updateMemoryUsage();
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? !this.isExpired(entry) : false;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get detailed performance metrics
   */
  getMetrics(): CachePerformanceMetrics {
    const entries = Array.from(this.cache.values());
    const timestamps = entries.map(e => e.timestamp);

    return {
      ...this.metrics,
      oldestEntry: timestamps.length > 0 ? new Date(Math.min(...timestamps)) : undefined,
      newestEntry: timestamps.length > 0 ? new Date(Math.max(...timestamps)) : undefined,
    };
  }

  /**
   * Get cache keys matching pattern
   */
  getKeys(pattern?: RegExp): string[] {
    const keys = Array.from(this.cache.keys());
    return pattern ? keys.filter(key => pattern.test(key)) : keys;
  }

  /**
   * Get cache size information
   */
  getSizeInfo(): {
    entryCount: number;
    totalMemory: number;
    averageEntrySize: number;
    memoryUtilization: number;
  } {
    const entryCount = this.cache.size;
    const totalMemory = this.metrics.totalMemory;
    const averageEntrySize = entryCount > 0 ? totalMemory / entryCount : 0;
    const memoryUtilization = this.config.maxSize > 0 ? entryCount / this.config.maxSize : 0;

    return {
      entryCount,
      totalMemory,
      averageEntrySize,
      memoryUtilization,
    };
  }

  /**
   * Optimize cache by removing expired entries and analyzing patterns
   */
  async optimizeCache(): Promise<{
    removedExpired: number;
    optimizationSuggestions: string[];
  }> {
    const beforeCount = this.cache.size;

    // Remove expired entries
    await this.cleanExpiredEntries();
    const removedExpired = beforeCount - this.cache.size;

    // Analyze access patterns and generate suggestions
    const suggestions = this.analyzeAccessPatterns();

    return {
      removedExpired,
      optimizationSuggestions: suggestions,
    };
  }

  /**
   * Preload cache with data
   */
  async preload(data: Map<string, any>, ttl?: number): Promise<void> {
    for (const [key, value] of data) {
      await this.set(key, value, ttl);
    }
  }

  /**
   * Export cache data
   */
  exportData(): Map<string, any> {
    const exported = new Map<string, any>();
    
    for (const [key, entry] of this.cache) {
      if (!this.isExpired(entry)) {
        exported.set(key, entry.compressed ? entry.value : JSON.parse(entry.value));
      }
    }

    return exported;
  }

  /**
   * Set compression manager
   */
  setCompressionManager(compressionManager: any): void {
    this.compressionManager = compressionManager;
  }

  /**
   * Update cache configuration
   */
  updateConfig(newConfig: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
    this.accessOrder = [];
    this.accessPatterns.clear();
  }

  private async evictEntries(): Promise<void> {
    const evictionCount = Math.floor(this.config.maxSize * 0.1); // Remove 10%
    
    switch (this.config.strategy) {
      case 'lru':
        await this.evictLRU(evictionCount);
        break;
      case 'lfu':
        await this.evictLFU(evictionCount);
        break;
      case 'fifo':
        await this.evictFIFO(evictionCount);
        break;
    }

    this.metrics.evictions += evictionCount;
    this.updateMemoryUsage();
  }

  private async evictLRU(count: number): Promise<void> {
    const toRemove = this.accessOrder.slice(0, count);
    for (const key of toRemove) {
      this.cache.delete(key);
      this.accessPatterns.delete(key);
    }
    this.accessOrder = this.accessOrder.slice(count);
  }

  private async evictLFU(count: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].accessCount - b[1].accessCount);
    
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.accessPatterns.delete(key);
    }
  }

  private async evictFIFO(count: number): Promise<void> {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    for (let i = 0; i < Math.min(count, entries.length); i++) {
      const [key] = entries[i];
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.accessPatterns.delete(key);
    }
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  private recordAccess(key: string): void {
    // Update LRU order
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  private updateAccessPattern(key: string): void {
    const pattern = this.accessPatterns.get(key);
    if (pattern) {
      pattern.frequency++;
      pattern.lastAccess = Date.now();
      pattern.accessTimes.push(Date.now());
      
      // Keep only recent access times
      if (pattern.accessTimes.length > 100) {
        pattern.accessTimes.shift();
      }
    }
  }

  private initializeAccessPattern(key: string): void {
    if (!this.accessPatterns.has(key)) {
      this.accessPatterns.set(key, {
        key,
        frequency: 1,
        lastAccess: Date.now(),
        accessTimes: [Date.now()],
      });
    }
  }

  private updateStats(): void {
    const totalRequests = this.metrics.hits + this.metrics.misses;
    
    this.stats.hitRate = totalRequests > 0 ? (this.metrics.hits / totalRequests) * 100 : 0;
    this.stats.missRate = totalRequests > 0 ? (this.metrics.misses / totalRequests) * 100 : 0;
    this.stats.evictionRate = totalRequests > 0 ? (this.metrics.evictions / totalRequests) * 100 : 0;
    this.stats.entryCount = this.cache.size;
    this.stats.memoryUsage = this.metrics.totalMemory;
  }

  private updateMemoryUsage(): void {
    let totalMemory = 0;
    let totalOriginalSize = 0;
    let totalCompressedSize = 0;

    for (const entry of this.cache.values()) {
      totalMemory += entry.size;
      
      if (entry.compressed) {
        totalCompressedSize += entry.size;
        // Estimate original size
        totalOriginalSize += entry.size * 2; // rough estimate
      } else {
        totalOriginalSize += entry.size;
      }
    }

    this.metrics.totalMemory = totalMemory;
    this.metrics.averageEntrySize = this.cache.size > 0 ? totalMemory / this.cache.size : 0;
    
    if (totalOriginalSize > 0) {
      this.metrics.compressionRatio = totalOriginalSize / totalMemory;
      this.stats.compressionSavings = totalOriginalSize - totalMemory;
    }
  }

  private updateCompressionStats(compressedSize: number, originalSize: number): void {
    const savings = originalSize - compressedSize;
    this.stats.compressionSavings += savings;
  }

  private updateAverageAccessTime(accessTime: number): void {
    const alpha = 0.3;
    this.stats.averageAccessTime = this.stats.averageAccessTime === 0
      ? accessTime
      : alpha * accessTime + (1 - alpha) * this.stats.averageAccessTime;
  }

  private async cleanExpiredEntries(): Promise<void> {
    const expiredKeys: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
      this.accessPatterns.delete(key);
    }

    this.updateMemoryUsage();
  }

  private analyzeAccessPatterns(): string[] {
    const suggestions: string[] = [];
    const patterns = Array.from(this.accessPatterns.values());

    // Analyze hit rate
    if (this.stats.hitRate < 50) {
      suggestions.push('キャッシュヒット率が低いです。TTLの延長またはキャッシュサイズの増加を検討してください。');
    }

    // Analyze eviction rate
    if (this.stats.evictionRate > 20) {
      suggestions.push('エビクション率が高いです。キャッシュサイズの増加を検討してください。');
    }

    // Analyze access patterns
    const highFrequencyItems = patterns.filter(p => p.frequency > 10).length;
    const totalItems = patterns.length;

    if (totalItems > 0 && highFrequencyItems / totalItems < 0.2) {
      suggestions.push('頻繁にアクセスされるアイテムが少ないです。キャッシュ戦略の見直しを検討してください。');
    }

    // Memory usage analysis
    if (this.cache.size / this.config.maxSize > 0.9) {
      suggestions.push('キャッシュ使用率が90%を超えています。キャッシュサイズの増加を検討してください。');
    }

    // Compression analysis
    if (this.config.compressionEnabled && this.metrics.compressionRatio < 1.2) {
      suggestions.push('圧縮効果が低いです。圧縮しきい値の調整を検討してください。');
    }

    if (suggestions.length === 0) {
      suggestions.push('キャッシュは適切に動作しています。');
    }

    return suggestions;
  }

  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(async () => {
      await this.cleanExpiredEntries();
    }, 60000); // Clean up every minute
  }
}

// Export singleton instance
export const cacheManager = new CacheManager();