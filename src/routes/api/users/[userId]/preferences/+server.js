// src/routes/api/users/[userId]/preferences/+server.js
// API endpoint for saving user preferences (theme, accent color, profile photo, etc.)

import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { User } from '$lib/server/mongodb/schemas/User.js';

/**
 * PATCH /api/users/[userId]/preferences
 * Update user preferences
 */
export async function PATCH({ params, request }) {
    const { userId } = params;
    
    if (!userId) {
        return json({ error: 'User ID required' }, { status: 400 });
    }
    
    try {
        const data = await request.json();
        await connectMongoDB();
        
        // Build update object with only allowed fields
        const allowedFields = [
            'theme', 'accentColor', 'profilePhoto', 'bannerImage',
            'displayName', 'bio', 'updatedAt'
        ];
        
        const updateData = {};
        for (const field of allowedFields) {
            if (data[field] !== undefined) {
                updateData[field] = data[field];
            }
        }
        
        if (Object.keys(updateData).length === 0) {
            return json({ error: 'No valid fields to update' }, { status: 400 });
        }
        
        // Update in MongoDB using Mongoose
        const result = await User.findOneAndUpdate(
            { firebaseUid: userId },
            { $set: updateData },
            { new: true, upsert: true }
        );
        
        return json({ 
            success: true, 
            message: 'Preferences updated',
            updated: Object.keys(updateData)
        });
        
    } catch (error) {
        console.error('Error updating preferences:', error);
        return json({ error: 'Failed to update preferences' }, { status: 500 });
    }
}

/**
 * GET /api/users/[userId]/preferences
 * Get user preferences
 */
export async function GET({ params }) {
    const { userId } = params;
    
    if (!userId) {
        return json({ error: 'User ID required' }, { status: 400 });
    }
    
    try {
        await connectMongoDB();
        
        const user = await User.findOne(
            { firebaseUid: userId },
            'theme accentColor profilePhoto bannerImage displayName bio'
        ).lean();
        
        if (!user) {
            return json({ 
                theme: 'light',
                accentColor: '#007AFF',
                profilePhoto: '',
                bannerImage: ''
            });
        }
        
        return json(user);
        
    } catch (error) {
        console.error('Error fetching preferences:', error);
        return json({ error: 'Failed to fetch preferences' }, { status: 500 });
    }
}
