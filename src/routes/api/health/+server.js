// src/routes/api/health/+server.js
// Health Check API - Verify MongoDB and Firebase status
// ✅ MongoDB down → Firebase must not receive events
// ✅ Firebase down → MongoDB must still work

import { json } from '@sveltejs/kit';
import { mongoHealthCheck, isMongoConnected } from '$lib/server/mongodb/connection.js';
import { adminDb } from '$lib/server/firebase-admin.js';

export async function GET() {
    const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
            mongodb: { status: 'unknown', connected: false },
            firebase: { status: 'unknown', connected: false }
        }
    };
    
    // Check MongoDB
    try {
        const mongoStatus = await mongoHealthCheck();
        health.services.mongodb = {
            status: mongoStatus.status,
            connected: mongoStatus.connected,
            ping: mongoStatus.ping
        };
    } catch (error) {
        health.services.mongodb = {
            status: 'unhealthy',
            connected: false,
            error: error.message
        };
    }
    
    // Check Firebase
    try {
        if (adminDb) {
            // Try a simple read operation
            await adminDb.ref('.info/connected').once('value');
            health.services.firebase = {
                status: 'healthy',
                connected: true
            };
        } else {
            health.services.firebase = {
                status: 'unavailable',
                connected: false,
                error: 'Firebase Admin not initialized'
            };
        }
    } catch (error) {
        health.services.firebase = {
            status: 'unhealthy',
            connected: false,
            error: error.message
        };
    }
    
    // Overall status
    if (!health.services.mongodb.connected) {
        health.status = 'degraded';
        health.message = 'MongoDB is down - primary database unavailable';
    } else if (!health.services.firebase.connected) {
        health.status = 'degraded';
        health.message = 'Firebase is down - realtime updates unavailable, but core functionality works';
    }
    
    const statusCode = health.status === 'healthy' ? 200 : 503;
    
    return json(health, { status: statusCode });
}
