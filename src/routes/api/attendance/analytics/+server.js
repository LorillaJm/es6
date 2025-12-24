// src/routes/api/attendance/analytics/+server.js
// User Analytics API - Fetches attendance data from MongoDB
import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Attendance } from '$lib/server/mongodb/schemas/Attendance.js';

export async function GET({ url }) {
    try {
        const firebaseUid = url.searchParams.get('userId');
        const days = parseInt(url.searchParams.get('days') || '90');
        
        if (!firebaseUid) {
            return json({ error: 'userId is required' }, { status: 400 });
        }

        await connectMongoDB();

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        // Get attendance records from MongoDB
        const records = await Attendance.find({
            firebaseUid,
            date: { $gte: startDate, $lte: endDate }
        }).sort({ date: -1 });

        console.log(`[Analytics API] Found ${records.length} records for user ${firebaseUid}`);

        // Transform to match frontend expectations
        const transformedRecords = records.map(record => ({
            id: record._id.toString(),
            odId: record._id.toString(),
            date: record.dateString,
            checkIn: record.checkIn?.timestamp ? {
                timestamp: record.checkIn.timestamp.toISOString(),
                location: record.checkIn.location
            } : null,
            checkOut: record.checkOut?.timestamp ? {
                timestamp: record.checkOut.timestamp.toISOString(),
                location: record.checkOut.location
            } : null,
            isLate: record.isLate,
            lateMinutes: record.lateMinutes || 0,
            currentStatus: record.currentStatus,
            actualWorkMinutes: record.actualWorkMinutes || 0,
            overtimeMinutes: record.overtimeMinutes || 0,
            breakMinutes: record.breakMinutes || 0
        }));

        return json({ 
            records: transformedRecords,
            count: transformedRecords.length,
            source: 'mongodb'
        });
    } catch (error) {
        console.error('[Analytics API] Error:', error);
        return json({ error: 'Failed to fetch analytics data' }, { status: 500 });
    }
}
