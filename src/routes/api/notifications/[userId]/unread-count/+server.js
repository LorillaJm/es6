// src/routes/api/notifications/[userId]/unread-count/+server.js
// Get unread notification count

import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import mongoose from 'mongoose';

/**
 * GET /api/notifications/[userId]/unread-count
 * Get count of unread notifications
 */
export async function GET({ params }) {
    const { userId } = params;
    
    if (!userId) {
        return json({ error: 'User ID required' }, { status: 400 });
    }
    
    try {
        await connectMongoDB();
        
        const Notification = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({}, { collection: 'notifications' }));
        
        const count = await Notification.countDocuments({
            userId,
            read: { $ne: true }
        });
        
        return json({ count });
        
    } catch (error) {
        console.error('Error getting unread count:', error);
        return json({ count: 0 });
    }
}
