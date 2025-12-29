// src/routes/api/notifications/[userId]/+server.js
// API endpoint for user notifications

import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import mongoose from 'mongoose';

// Simple notification schema if not exists
const notificationSchema = new mongoose.Schema({
    userId: String,
    type: { type: String, default: 'general' },
    title: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
    read: { type: Boolean, default: false },
    readAt: Date
}, { collection: 'notifications' });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

/**
 * GET /api/notifications/[userId]
 * Get user's notifications
 */
export async function GET({ params, url }) {
    const { userId } = params;
    const limit = parseInt(url.searchParams.get('limit') || '20');
    
    if (!userId) {
        return json({ error: 'User ID required' }, { status: 400 });
    }
    
    try {
        await connectMongoDB();
        
        const notifications = await Notification.find({ userId })
            .sort({ timestamp: -1 })
            .limit(limit)
            .lean();
        
        return json({ notifications });
        
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return json({ notifications: [] });
    }
}

/**
 * POST /api/notifications/[userId]
 * Create a new notification
 */
export async function POST({ params, request }) {
    const { userId } = params;
    
    if (!userId) {
        return json({ error: 'User ID required' }, { status: 400 });
    }
    
    try {
        const { type, title, message } = await request.json();
        await connectMongoDB();
        
        const notification = new Notification({
            userId,
            type: type || 'general',
            title,
            message,
            timestamp: new Date(),
            read: false
        });
        
        await notification.save();
        
        return json({ 
            success: true, 
            id: notification._id.toString() 
        });
        
    } catch (error) {
        console.error('Error creating notification:', error);
        return json({ error: 'Failed to create notification' }, { status: 500 });
    }
}
