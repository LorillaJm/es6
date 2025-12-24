// src/routes/api/attendance/history/+server.js
// Get Attendance History
// ✅ Reads from MongoDB (source of truth)
// ❌ Firebase NEVER stores history

import { json } from '@sveltejs/kit';
import { adminAuth } from '$lib/server/firebase-admin.js';
import { getAttendanceHistory } from '$lib/server/mongodb/services/attendanceService.js';

export async function GET({ request, url }) {
    try {
        // Validate authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch (authError) {
            return json({ success: false, error: 'Invalid token' }, { status: 401 });
        }
        
        const firebaseUid = decodedToken.uid;
        
        // Parse query parameters
        const startDate = url.searchParams.get('startDate');
        const endDate = url.searchParams.get('endDate');
        const limit = parseInt(url.searchParams.get('limit') || '30');
        const skip = parseInt(url.searchParams.get('skip') || '0');
        
        // Get history from MongoDB
        const history = await getAttendanceHistory(firebaseUid, startDate, endDate, { limit, skip });
        
        return json({
            success: true,
            data: history.map(record => ({
                id: record._id.toString(),
                date: record.date,
                dateString: record.dateString,
                currentStatus: record.currentStatus,
                status: record.currentStatus,
                checkIn: record.checkIn ? {
                    timestamp: record.checkIn.timestamp?.toISOString?.() || record.checkIn.timestamp,
                    capturedImage: record.checkIn.photo,
                    location: record.checkIn.location ? {
                        name: record.checkIn.location.name || record.checkIn.location.address || 
                              (record.checkIn.location.latitude ? `${record.checkIn.location.latitude.toFixed(4)}, ${record.checkIn.location.longitude.toFixed(4)}` : null),
                        ...record.checkIn.location
                    } : null,
                    device: record.checkIn.deviceInfo ? {
                        browser: record.checkIn.deviceInfo.browser || record.checkIn.deviceInfo.platform,
                        deviceType: record.checkIn.deviceInfo.platform || 'Unknown',
                        ...record.checkIn.deviceInfo
                    } : null,
                    method: record.checkIn.method
                } : null,
                checkOut: record.checkOut ? {
                    timestamp: record.checkOut.timestamp?.toISOString?.() || record.checkOut.timestamp,
                    capturedImage: record.checkOut.photo,
                    location: record.checkOut.location ? {
                        name: record.checkOut.location.name || record.checkOut.location.address,
                        ...record.checkOut.location
                    } : null,
                    device: record.checkOut.deviceInfo ? {
                        browser: record.checkOut.deviceInfo.browser || record.checkOut.deviceInfo.platform,
                        deviceType: record.checkOut.deviceInfo.platform || 'Unknown',
                        ...record.checkOut.deviceInfo
                    } : null,
                    method: record.checkOut.method
                } : null,
                breaks: record.breaks || [],
                isLate: record.isLate || false,
                lateMinutes: record.lateMinutes || 0,
                actualWorkMinutes: record.actualWorkMinutes || 0,
                breakMinutes: record.breakMinutes || 0,
                isManualEntry: record.isManualEntry || false
            })),
            pagination: {
                limit,
                skip,
                hasMore: history.length === limit
            }
        });
        
    } catch (error) {
        console.error('[API] History error:', error);
        return json({ 
            success: false, 
            error: 'Failed to get history' 
        }, { status: 500 });
    }
}
