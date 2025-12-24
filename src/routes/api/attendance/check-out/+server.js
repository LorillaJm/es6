// src/routes/api/attendance/check-out/+server.js
// Check-Out API Endpoint
// ✅ STRICT DATA FLOW: Frontend → Backend → MongoDB → Firebase → Clients

import { json } from '@sveltejs/kit';
import { adminAuth } from '$lib/server/firebase-admin.js';
import { checkOut } from '$lib/server/mongodb/services/attendanceService.js';

export async function POST({ request, getClientAddress }) {
    try {
        // 1. Validate authentication
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
        
        // 2. Parse request body
        const body = await request.json();
        
        const checkOutData = {
            location: body.location || null,
            deviceId: body.deviceId || null,
            deviceInfo: body.deviceInfo || null,
            method: body.method || 'manual',
            ipAddress: getClientAddress()
        };
        
        // 3. Process check-out (MongoDB + Firebase emit)
        const attendance = await checkOut(firebaseUid, checkOutData);
        
        // 4. Return success response
        return json({
            success: true,
            data: {
                id: attendance._id.toString(),
                status: attendance.currentStatus,
                checkInTime: attendance.checkIn.timestamp.toISOString(),
                checkOutTime: attendance.checkOut.timestamp.toISOString(),
                actualWorkMinutes: attendance.actualWorkMinutes,
                isEarlyOut: attendance.isEarlyOut
            }
        });
        
    } catch (error) {
        console.error('[API] Check-out error:', error);
        
        if (error.message === 'User not found') {
            return json({ success: false, error: 'User not found' }, { status: 404 });
        }
        
        if (error.message === 'No active check-in found') {
            return json({ success: false, error: 'No active check-in found' }, { status: 409 });
        }
        
        return json({ 
            success: false, 
            error: 'Check-out failed. Please try again.' 
        }, { status: 500 });
    }
}
