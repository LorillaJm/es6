// src/lib/utils/logger.js
// Production-ready logging utility
// Filters logs based on environment and provides structured logging

import { dev } from '$app/environment';

/**
 * Log levels with numeric priority
 */
const LOG_LEVELS = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    NONE: 4
};

/**
 * Current log level based on environment
 * In production, only WARN and ERROR are logged
 */
const CURRENT_LEVEL = dev ? LOG_LEVELS.DEBUG : LOG_LEVELS.WARN;

/**
 * Format log message with timestamp and context
 * @param {string} level - Log level
 * @param {string} context - Context/module name
 * @param {any[]} args - Log arguments
 * @returns {string[]} Formatted log arguments
 */
function formatLog(level, context, args) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]${context ? ` [${context}]` : ''}`;
    return [prefix, ...args];
}

/**
 * Create a logger instance with optional context
 * @param {string} context - Optional context/module name
 * @returns {Object} Logger instance
 */
export function createLogger(context = '') {
    return {
        /**
         * Debug level - only in development
         */
        debug: (...args) => {
            if (CURRENT_LEVEL <= LOG_LEVELS.DEBUG) {
                console.log(...formatLog('DEBUG', context, args));
            }
        },

        /**
         * Info level - only in development
         */
        info: (...args) => {
            if (CURRENT_LEVEL <= LOG_LEVELS.INFO) {
                console.info(...formatLog('INFO', context, args));
            }
        },

        /**
         * Warning level - always logged
         */
        warn: (...args) => {
            if (CURRENT_LEVEL <= LOG_LEVELS.WARN) {
                console.warn(...formatLog('WARN', context, args));
            }
        },

        /**
         * Error level - always logged
         */
        error: (...args) => {
            if (CURRENT_LEVEL <= LOG_LEVELS.ERROR) {
                console.error(...formatLog('ERROR', context, args));
            }
        },

        /**
         * Log security-related events (always logged, even in production)
         */
        security: (event, details = {}) => {
            const sanitizedDetails = { ...details };
            // Remove sensitive fields from logs
            delete sanitizedDetails.password;
            delete sanitizedDetails.token;
            delete sanitizedDetails.secret;
            
            console.warn(...formatLog('SECURITY', context, [event, JSON.stringify(sanitizedDetails)]));
        },

        /**
         * Log audit events (always logged)
         */
        audit: (action, details = {}) => {
            console.info(...formatLog('AUDIT', context, [action, JSON.stringify(details)]));
        }
    };
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Check if debug logging is enabled
 */
export const isDebugEnabled = () => CURRENT_LEVEL <= LOG_LEVELS.DEBUG;

export default logger;
