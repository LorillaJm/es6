// src/lib/performance/index.js
// Performance System - Main Entry Point

// Cache
export { DataCache, createCache, apiCache, userCache, staticCache } from './cache/dataCache.js';
export { RequestDeduplicator, createDeduplicator, deduplicator } from './cache/requestDeduplicator.js';

// Fetching
export { SmartFetcher, createSmartFetcher, smartFetcher } from './fetch/smartFetcher.js';
export { ApiClient, apiClient } from './api/apiClient.js';
export { createPaginatedStore, createInfiniteStore, createVirtualScroller } from './api/pagination.js';

// Network
export { NetworkMonitor, networkMonitor, networkState, connectionQuality } from './network/networkMonitor.js';

// Metrics
export { PerformanceTracker, performanceTracker, performanceMetrics, PERFORMANCE_BUDGETS } from './metrics/performanceTracker.js';

// Strategy
export { LoadingStrategy, loadingStrategy, loadingConfig, getLoadingStrategy, DATA_PRIORITY } from './strategy/loadingStrategy.js';

// Offline
export { OfflineActionHandler, offlineHandler, offlineQueue, syncStatus, createOfflineAction } from './offline/offlineActions.js';

// Optimistic Updates
export { OptimisticUpdateManager, optimisticManager, createOptimisticStore, attendanceOptimistic } from './optimistic/optimisticUpdates.js';

// Hooks
export { usePerformanceMonitor, useLazyData, useDebounce, useThrottle, useVirtualScroll, usePrefetch } from './hooks/usePerformance.js';

// Initialization
export { initPerformanceSystem, performanceConfig, createOptimizedFetch } from './init.js';
