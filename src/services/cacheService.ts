/**
 * Intelligent Caching Service for AI responses and web search results
 * Provides performance optimization and reduces API calls
 */

interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expiresAt: number;
  metadata?: {
    source: string;
    cost?: number;
    tokens?: number;
    model?: string;
  };
}

interface CacheStats {
  totalEntries: number;
  totalSize: number; // in bytes
  hitRate: number;
  averageResponseTime: number;
  cacheEfficiency: number;
}

class CacheService {
  private cache = new Map<string, CacheEntry>();
  private maxSize = 200; // Maximum number of entries (increased for better performance)
  private defaultTTL = 30 * 60 * 1000; // 30 minutes in milliseconds
  private maxMemoryMB = 50; // Maximum memory usage in MB
  private stats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
    responseTimes: [] as number[],
    evictions: 0,
    memoryOverflows: 0
  };
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly STORAGE_KEY = 'enhancedpipelinedeals_cache';

  constructor() {
    this.loadFromStorage();
  }

  // Load cache from localStorage
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();
        // Only load non-expired entries
        for (const [key, entry] of Object.entries(data)) {
          const cacheEntry = entry as CacheEntry;
          if (now <= cacheEntry.expiresAt) {
            this.cache.set(key, cacheEntry);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error);
    }
  }

  // Save cache to localStorage
  private saveToStorage(): void {
    try {
      const data: Record<string, CacheEntry> = {};
      for (const [key, entry] of this.cache.entries()) {
        data[key] = entry;
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error);
    }
  }

  // Generate cache key from request parameters
  generateKey(service: string, method: string, params: any): string {
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    return `${service}:${method}:${this.hashString(paramString)}`;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Get cached data
  async get<T>(key: string): Promise<T | null> {
    this.stats.totalRequests++;

    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.data as T;
  }

  // Set cached data
  async set(key: string, data: any, ttl?: number, metadata?: CacheEntry['metadata']): Promise<void> {
    const expiresAt = Date.now() + (ttl || this.defaultTTL);

    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      expiresAt,
      metadata
    };

    // Check memory usage before adding
    const currentMemoryMB = this.getMemoryUsageMB();
    if (currentMemoryMB >= this.maxMemoryMB) {
      this.stats.memoryOverflows++;
      this.evictLRU();
    }

    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      this.stats.evictions++;
      this.evictLRU();
    }

    this.cache.set(key, entry);
    this.saveToStorage();
  }

  // Check if key exists and is valid
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  // Delete specific cache entry
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.saveToStorage();
    }
    return deleted;
  }

  // Clear all cache entries
  async clear(): Promise<void> {
    this.cache.clear();
    this.resetStats();
    this.saveToStorage();
  }

  // Clear expired entries
  clearExpired(): number {
    let cleared = 0;
    for (const [key, entry] of this.cache.entries()) {
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  // Get cache statistics
  getStats(): CacheStats {
    const totalRequests = this.stats.totalRequests;
    const hitRate = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    const averageResponseTime = this.stats.responseTimes.length > 0
      ? this.stats.responseTimes.reduce((a, b) => a + b, 0) / this.stats.responseTimes.length
      : 0;

    // Estimate cache size (rough calculation)
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += JSON.stringify(entry).length * 2; // Rough byte estimation
    }

    const cacheEfficiency = totalRequests > 0 ? (this.stats.hits / totalRequests) * 100 : 0;

    return {
      totalEntries: this.cache.size,
      totalSize,
      hitRate,
      averageResponseTime,
      cacheEfficiency
    };
  }

  // Reset statistics
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      totalRequests: 0,
      responseTimes: [],
      evictions: 0,
      memoryOverflows: 0
    };
  }

  // Set maximum cache size
  setMaxSize(size: number): void {
    this.maxSize = size;
    // Evict if current size exceeds new max
    while (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  // Set default TTL
  setDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  // Get all cache keys
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  // Get cache entry details
  getEntry(key: string): CacheEntry | null {
    return this.cache.get(key) || null;
  }

  // LRU eviction - remove least recently used entry
  private evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  // Get current memory usage in MB
  private getMemoryUsageMB(): number {
    let totalBytes = 0;
    for (const entry of this.cache.values()) {
      totalBytes += JSON.stringify(entry).length * 2;
    }
    return totalBytes / (1024 * 1024);
  }

  // Start automatic cleanup interval
  startAutoCleanup(intervalMs: number = 5 * 60 * 1000): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      const cleared = this.clearExpired();
      if (cleared > 0) {
        console.log(`Cache auto-cleanup: removed ${cleared} expired entries`);
      }
    }, intervalMs);
  }

  // Stop automatic cleanup
  stopAutoCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // Set maximum memory limit
  setMaxMemory(maxMemoryMB: number): void {
    this.maxMemoryMB = maxMemoryMB;
    while (this.getMemoryUsageMB() > this.maxMemoryMB) {
      this.evictLRU();
    }
  }

  // Get memory statistics
  getMemoryStats(): {
    currentMemoryMB: number;
    maxMemoryMB: number;
    utilizationPercent: number;
    entriesCount: number;
  } {
    const currentMemoryMB = this.getMemoryUsageMB();
    return {
      currentMemoryMB,
      maxMemoryMB: this.maxMemoryMB,
      utilizationPercent: (currentMemoryMB / this.maxMemoryMB) * 100,
      entriesCount: this.cache.size
    };
  }

  // Specialized caching for AI responses
  async cacheAIResponse(
    service: string,
    method: string,
    params: any,
    response: any,
    metadata?: { model?: string; tokens?: number; cost?: number }
  ): Promise<void> {
    const key = this.generateKey(service, method, params);

    // Different TTL based on content type
    let ttl = this.defaultTTL;
    if (method.includes('research') || method.includes('search')) {
      ttl = 15 * 60 * 1000; // 15 minutes for research/search
    } else if (method.includes('analysis')) {
      ttl = 60 * 60 * 1000; // 1 hour for analysis
    }

    await this.set(key, response, ttl, {
      source: 'ai',
      ...metadata
    });
  }

  // Specialized caching for web search results
  async cacheWebSearch(
    query: string,
    results: any,
    metadata?: { provider?: string; totalResults?: number }
  ): Promise<void> {
    const key = this.generateKey('webSearch', 'search', { query });

    // Web search results are cached for shorter time due to freshness
    const ttl = 10 * 60 * 1000; // 10 minutes

    await this.set(key, results, ttl, {
      source: 'web',
      ...metadata
    });
  }

  // Get cached web search results
  async getCachedWebSearch(query: string): Promise<any | null> {
    const key = this.generateKey('webSearch', 'search', { query });
    return this.get(key);
  }

  // Intelligent cache warming for frequently used queries
  async warmCache(queries: string[]): Promise<void> {
    // This could be implemented to pre-populate cache with common queries
    console.log(`Warming cache with ${queries.length} queries`);
  }

  // Cache invalidation by pattern
  async invalidatePattern(pattern: string): Promise<number> {
    let invalidated = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    return invalidated;
  }

  // Get cache performance metrics
  getPerformanceMetrics(): {
    hitRate: number;
    missRate: number;
    averageAge: number;
    sizeEfficiency: number;
  } {
    const stats = this.getStats();
    const missRate = 100 - stats.hitRate;

    // Calculate average age of cache entries
    let totalAge = 0;
    for (const entry of this.cache.values()) {
      totalAge += Date.now() - entry.timestamp;
    }
    const averageAge = this.cache.size > 0 ? totalAge / this.cache.size : 0;

    // Size efficiency (entries per MB)
    const sizeEfficiency = stats.totalSize > 0 ? (this.cache.size / (stats.totalSize / (1024 * 1024))) : 0;

    return {
      hitRate: stats.hitRate,
      missRate,
      averageAge,
      sizeEfficiency
    };
  }
}

// Singleton instance
let cacheService: CacheService | null = null;

export const getCacheService = (): CacheService => {
  if (!cacheService) {
    cacheService = new CacheService();
  }
  return cacheService;
};

export { CacheService };
export type { CacheEntry, CacheStats };