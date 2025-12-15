// src/lib/utils/performanceMonitor.js
// Phase 9.1 - Performance Monitoring Utility

import { browser } from '$app/environment';
import { writable } from 'svelte/store';

/**
 * Performance metrics store
 */
export const performanceMetrics = writable({
    pageLoadTime: 0,
    firstContentfulPaint: 0,
    largestContentfulPaint: 0,
    timeToInteractive: 0,
    cumulativeLayoutShift: 0,
    apiResponseTimes: [],
    avgApiResponseTime: 0,
    memoryUsage: null
});

/**
 * Initialize performance monitoring
 */
export function initPerformanceMonitor() {
    if (!browser) return;

    // Observe Core Web Vitals
    observeWebVitals();

    // Monitor memory usage
    monitorMemory();

    // Log initial page load
    measurePageLoad();
}

/**
 * Observe Core Web Vitals
 */
function observeWebVitals() {
    if (!browser || !window.PerformanceObserver) return;

    // First Contentful Paint
    try {
        const fcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const fcp = entries.find(e => e.name === 'first-contentful-paint');
            if (fcp) {
                performanceMetrics.update(m => ({
                    ...m,
                    firstContentfulPaint: Math.round(fcp.startTime)
                }));
            }
        });
        fcpObserver.observe({ type: 'paint', buffered: true });
    } catch (e) {
        console.debug('FCP observer not supported');
    }

    // Largest Contentful Paint
    try {
        const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            if (lastEntry) {
                performanceMetrics.update(m => ({
                    ...m,
                    largestContentfulPaint: Math.round(lastEntry.startTime)
                }));
            }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
        console.debug('LCP observer not supported');
    }

    // Cumulative Layout Shift
    try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (!entry.hadRecentInput) {
                    clsValue += entry.value;
                }
            }
            performanceMetrics.update(m => ({
                ...m,
                cumulativeLayoutShift: Math.round(clsValue * 1000) / 1000
            }));
        });
        clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
        console.debug('CLS observer not supported');
    }
}

/**
 * Measure page load time
 */
function measurePageLoad() {
    if (!browser) return;

    window.addEventListener('load', () => {
        setTimeout(() => {
            const timing = performance.timing || {};
            const pageLoadTime = timing.loadEventEnd - timing.navigationStart;
            
            if (pageLoadTime > 0) {
                performanceMetrics.update(m => ({
                    ...m,
                    pageLoadTime
                }));
            }
        }, 0);
    });
}

/**
 * Monitor memory usage
 */
function monitorMemory() {
    if (!browser || !performance.memory) return;

    const updateMemory = () => {
        const memory = performance.memory;
        performanceMetrics.update(m => ({
            ...m,
            memoryUsage: {
                usedJSHeapSize: formatBytes(memory.usedJSHeapSize),
                totalJSHeapSize: formatBytes(memory.totalJSHeapSize),
                jsHeapSizeLimit: formatBytes(memory.jsHeapSizeLimit),
                usagePercent: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
            }
        }));
    };

    updateMemory();
    setInterval(updateMemory, 30000); // Update every 30 seconds
}

/**
 * Track API response time
 * @param {string} endpoint 
 * @param {number} responseTime 
 */
export function trackApiResponse(endpoint, responseTime) {
    performanceMetrics.update(m => {
        const times = [...m.apiResponseTimes, { endpoint, responseTime, timestamp: Date.now() }];
        // Keep last 100 entries
        const recentTimes = times.slice(-100);
        const avgTime = recentTimes.reduce((sum, t) => sum + t.responseTime, 0) / recentTimes.length;
        
        return {
            ...m,
            apiResponseTimes: recentTimes,
            avgApiResponseTime: Math.round(avgTime)
        };
    });
}

/**
 * Create a fetch wrapper that tracks performance
 * @param {string} url 
 * @param {RequestInit} options 
 * @returns {Promise<Response>}
 */
export async function trackedFetch(url, options = {}) {
    const startTime = performance.now();
    
    try {
        const response = await fetch(url, options);
        const responseTime = Math.round(performance.now() - startTime);
        trackApiResponse(url, responseTime);
        return response;
    } catch (error) {
        const responseTime = Math.round(performance.now() - startTime);
        trackApiResponse(url, responseTime);
        throw error;
    }
}

/**
 * Format bytes to human readable
 * @param {number} bytes 
 * @returns {string}
 */
function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Get performance summary
 * @returns {Object}
 */
export function getPerformanceSummary() {
    let summary = {};
    
    performanceMetrics.subscribe(m => {
        summary = {
            pageLoad: `${m.pageLoadTime}ms`,
            fcp: `${m.firstContentfulPaint}ms`,
            lcp: `${m.largestContentfulPaint}ms`,
            cls: m.cumulativeLayoutShift,
            avgApiResponse: `${m.avgApiResponseTime}ms`,
            memory: m.memoryUsage
        };
    })();
    
    return summary;
}

/**
 * Performance grade based on metrics
 * @returns {string}
 */
export function getPerformanceGrade() {
    let grade = 'A';
    
    performanceMetrics.subscribe(m => {
        let score = 100;
        
        // Deduct points based on metrics
        if (m.pageLoadTime > 3000) score -= 20;
        else if (m.pageLoadTime > 2000) score -= 10;
        
        if (m.largestContentfulPaint > 2500) score -= 20;
        else if (m.largestContentfulPaint > 1500) score -= 10;
        
        if (m.cumulativeLayoutShift > 0.25) score -= 20;
        else if (m.cumulativeLayoutShift > 0.1) score -= 10;
        
        if (m.avgApiResponseTime > 500) score -= 15;
        else if (m.avgApiResponseTime > 200) score -= 5;
        
        if (score >= 90) grade = 'A';
        else if (score >= 80) grade = 'B';
        else if (score >= 70) grade = 'C';
        else if (score >= 60) grade = 'D';
        else grade = 'F';
    })();
    
    return grade;
}

export default {
    initPerformanceMonitor,
    trackApiResponse,
    trackedFetch,
    getPerformanceSummary,
    getPerformanceGrade,
    performanceMetrics
};
