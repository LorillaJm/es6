// src/routes/api/attendance/user/[userId]/+server.js
// Get attendance records for a specific user

import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Attendance } from '$lib/server/mongodb/schemas/Attendance.js';

/**
 * GET /api/attendance/user/[userId]
 * Get user's attendance records
 */
export async function GET({ params, url }) {
    const { userId } = params;
    const limit = parseInt(url.searchParams.get('limit') || '100');
    const startDate = url.searchParams.get('startDate');
    const endDate = url.searchParams.get('endDate');
    
    if (!userId) {
        return json({ error: 'User ID required' }, { status: 400 });
    }
    
    try {
        await connectMongoDB();
        
        // Build query - try multiple ID formats
        const query = { 
            $or: [
                { odooUserId: userId },
                { odooUserId: parseInt(userId) || 0 },
                { firebaseUid: userId }
            ]
        };
        
        // Add date filters if provided
        if (startDate || endDate) {
            query.date = {};
            if (startDate) query.date.$gte = startDate;
            if (endDate) query.date.$lte = endDate;
        }
        
        const records = await Attendance.find(query)
            .sort({ date: -1, 'checkIn.timestamp': -1 })
            .limit(limit)
            .lean();
        
        // Transform records to match expected format
        const transformedRecords = records.map(r => ({
            id: r._id.toString(),
            odooUserId: r.odooUserId,
            date: r.date,
            currentStatus: r.currentStatus,
            checkIn: r.checkIn,
            checkOut: r.checkOut,
            breaks: r.breaks || [],
            totalBreakMinutes: r.totalBreakMinutes || 0,
            actualWorkMinutes: r.actualWorkMinutes || 0,
            location: r.location
        }));
        
        return json({ 
            records: transformedRecords,
            count: transformedRecords.length
        });
        
    } catch (error) {
        console.error('Error fetching attendance records:', error);
        return json({ records: [], error: 'Failed to fetch records' }, { status: 500 });
    }
}
