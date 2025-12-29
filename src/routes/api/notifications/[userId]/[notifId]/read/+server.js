// src/routes/api/notifications/[userId]/[notifId]/read/+server.js
// Mark a single notification as read

import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import mongoose from 'mongoose';

/**
 * POST /api/notifications/[userId]/[notifId]/read
 * Mark notification as read
 */
export async function POST({ params }) {
    const { userId, notifId } = params;
    
    if (!userId || !notifId) {
        return json({ error: 'User ID and notification ID required' }, { status: 400 });
    }
    
    try {
        await connectMongoDB();
        
        const Notification = mongoose.models.Notification || mongoose.model('Notification', new mongoose.Schema({}, { collection: 'notifications' }));
        
        // Try to match by ObjectId or string id
        let query = { userId };
        if (mongoose.Types.ObjectId.isValid(notifId)) {
            query._id = new mongoose.Types.ObjectId(notifId);
        } else {
            query.id = notifId;
        }
        
        await Notification.updateOne(
            query,
            { $set: { read: true, readAt: new Date() } }
        );
        
        return json({ success: true });
        
    } catch (error) {
        console.error('Error marking notification as read:', error);
        return json({ error: 'Failed to mark as read' }, { status: 500 });
    }
}
