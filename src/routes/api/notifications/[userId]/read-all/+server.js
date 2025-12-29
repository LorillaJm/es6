// src/routes/api/notifications/[userId]/read-all/+server.js
// Mark all notifications as read

import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import mongoose from 'mongoose';

/**
 * POST /api/notifications/[userId]/read-all
 * Mark all notifications as read
 */
export async function POST({ params }) {
    const { userId } = params;
    
    if (!userId) {
        return json({ error: 'User ID required' }, { status: 400 });
    }
    
    try {
        await connectMongoDB();
        
        const Notification = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({}, { collection: 'notifications' }));
        
        const result = await Notification.updateMany(
            { userId, read: { $ne: true } },
            { $set: { read: true, readAt: new Date() } }
        );
        
        return json({ 
            success: true, 
            updated: result.modifiedCount 
        });
        
    } catch (error) {
        console.error('Error marking all as read:', error);
        return json({ error: 'Failed to mark all as read' }, { status: 500 });
    }
}
