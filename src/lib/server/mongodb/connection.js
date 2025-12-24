// src/lib/server/mongodb/connection.js
// MongoDB Atlas Connection Manager - PRIMARY DATABASE
// ❌ Firebase must NEVER store permanent data
// ✅ MongoDB Atlas = Single Source of Truth

import mongoose from 'mongoose';
import { env } from '$env/dynamic/private';

let isConnected = false;
let connectionPromise = null;

/**
 * MongoDB Connection Configuration
 */
const MONGODB_OPTIONS = {
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    family: 4, // Use IPv4
    retryWrites: true,
    w: 'majority'
};

/**
 * Connect to MongoDB Atlas
 * Uses singleton pattern to prevent multiple connections
 */
export async function connectMongoDB() {
    if (isConnected && mongoose.connection.readyState === 1) {
        return mongoose.connection;
    }

    if (connectionPromise) {
        return connectionPromise;
    }

    const MONGODB_URI = env.MONGODB_URI;

    if (!MONGODB_URI) {
        console.error('[MongoDB] ❌ MONGODB_URI not configured in environment');
        throw new Error('MongoDB connection string not configured');
    }

    connectionPromise = (async () => {
        try {
            console.log('[MongoDB] Connecting to Atlas...');
            
            await mongoose.connect(MONGODB_URI, MONGODB_OPTIONS);
            
            isConnected = true;
            console.log('[MongoDB] ✅ Connected to Atlas successfully');

            // Connection event handlers
            mongoose.connection.on('error', (err) => {
                console.error('[MongoDB] Connection error:', err);
                isConnected = false;
            });

            mongoose.connection.on('disconnected', () => {
                console.warn('[MongoDB] Disconnected from Atlas');
                isConnected = false;
                connectionPromise = null;
            });

            mongoose.connection.on('reconnected', () => {
                console.log('[MongoDB] Reconnected to Atlas');
                isConnected = true;
            });

            return mongoose.connection;
        } catch (error) {
            console.error('[MongoDB] ❌ Connection failed:', error.message);
            connectionPromise = null;
            isConnected = false;
            throw error;
        }
    })();

    return connectionPromise;
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectMongoDB() {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
        isConnected = false;
        connectionPromise = null;
        console.log('[MongoDB] Disconnected');
    }
}

/**
 * Check MongoDB connection status
 */
export function isMongoConnected() {
    return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get MongoDB connection for direct operations
 */
export function getMongoConnection() {
    if (!isConnected) {
        throw new Error('MongoDB not connected. Call connectMongoDB() first.');
    }
    return mongoose.connection;
}

/**
 * Health check for MongoDB
 */
export async function mongoHealthCheck() {
    try {
        if (!isConnected) {
            await connectMongoDB();
        }
        
        const adminDb = mongoose.connection.db.admin();
        const result = await adminDb.ping();
        
        return {
            status: 'healthy',
            connected: true,
            ping: result.ok === 1,
            readyState: mongoose.connection.readyState
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            connected: false,
            error: error.message
        };
    }
}

export default {
    connectMongoDB,
    disconnectMongoDB,
    isMongoConnected,
    getMongoConnection,
    mongoHealthCheck
};
