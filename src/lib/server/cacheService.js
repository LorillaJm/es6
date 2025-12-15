// src/lib/server/cacheService.js
// Phase 9.1 - Performance Optimization: In-Memory Cache Service

/**
 * Simple in-memory cache with TTL support
 * For production, consider Redis or similar
 */
class CacheService {
    constructor() {
        this.cache = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0
        };
        
        // Cleanup expired entries every 5 minutes
        this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Get cached value
     * @param {string} key 
     * @returns {any|null}
     */
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            return null;
        }
        
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            return null;
        }
        
        this.stats.hits++;
        return entry.value;
    }

    /**
     * Set cached value with optional TTL
     * @param {string} key 
     * @param {any} value 
     * @param {number} ttlSeconds - Time to live in seconds (default: 5 minutes)
     */
    set(key, value, ttlSeconds = 300) {
        this.stats.sets++;
        this.cache.set(key, {
            value,
            expiresAt: Date.now() + (ttlSeconds * 1000),
            createdAt: Date.now()
        });
    }

    /**
     * Delete cached value
     * @param {string} key 
     */
    delete(key) {
        this.stats.deletes++;
        this.cache.delete(key);
    }

    /**
     * Delete all keys matching pattern
     * @param {string} pattern - Prefix pattern to match
     */
    deletePattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(pattern)) {
                this.delete(key);
            }
        }
    }

    /**
     * Clear all cache
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0
            ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
            : 0;
        
        return {
            ...this.stats,
            hitRate: `${hitRate}%`,
            size: this.cache.size,
            memoryUsage: this.estimateMemoryUsage()
        };
    }

    /**
     * Cleanup expired entries
     */
    cleanup() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.expiresAt && now > entry.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            console.log(`[Cache] Cleaned ${cleaned} expired entries`);
        }
    }

    /**
     * Estimate memory usage (rough)
     */
    estimateMemoryUsage() {
        let bytes = 0;
        for (const [key, entry] of this.cache.entries()) {
            bytes += key.length * 2; // UTF-16
            bytes += JSON.stringify(entry.value).length * 2;
        }
        
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }

    /**
     * Get or set with callback
     * @param {string} key 
     * @param {Function} fetchFn - Async function to fetch data if not cached
     * @param {number} ttlSeconds 
     */
    async getOrSet(key, fetchFn, ttlSeconds = 300) {
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }
        
        const value = await fetchFn();
        this.set(key, value, ttlSeconds);
        return value;
    }

    /**
     * Destroy cache service
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.cache.clear();
    }
}

// Singleton instance
export const cacheService = new CacheService();

// Cache key generators
export const CacheKeys = {
    dashboardStats: (adminId) => `dashboard:stats:${adminId}`,
    userList: (page, limit) => `users:list:${page}:${limit}`,
    userProfile: (uid) => `user:profile:${uid}`,
    attendance: (date) => `attendance:${date}`,
    attendanceStats: (date) => `attendance:stats:${date}`,
    departments: () => 'departments:all',
    auditLogs: (page, limit) => `audit:logs:${page}:${limit}`,
    systemHealth: () => 'system:health',
    feedback: (status) => `feedback:${status}`,
    announcements: () => 'announcements:active'
};

// Cache TTL presets (in seconds)
export const CacheTTL = {
    SHORT: 30,        // 30 seconds - for real-time data
    MEDIUM: 300,      // 5 minutes - for dashboard stats
    LONG: 900,        // 15 minutes - for less frequently changing data
    EXTENDED: 3600,   // 1 hour - for static data
    DAY: 86400        // 24 hours - for historical data
};

export default cacheService;
