// src/routes/api/attendance/check-in/+server.js
// Check-In API Endpoint
// ✅ STRICT DATA FLOW:
// 1. Frontend → Backend API (auth + validation)
// 2. Backend → MongoDB Atlas (save/update)
// 3. Backend → Firebase Realtime (emit signal)
// 4. Firebase → Clients (live update)
// ❌ Frontend must NOT write to MongoDB or Firebase directly

import { json } from '@sveltejs/kit';
import { adminAuth } from '$lib/server/firebase-admin.js';
import { checkIn } from '$lib/server/mongodb/services/attendanceService.js';
import { logAuditEvent } from '$lib/server/mongodb/services/auditService.js';

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
        
        // 2. Parse and validate request body
        const body = await request.json();
        
        const checkInData = {
            location: body.location || null,
            deviceId: body.deviceId || null,
            deviceInfo: body.deviceInfo || null,
            method: body.method || 'manual',
            verificationData: body.verificationData || null,
            ipAddress: getClientAddress(),
            photo: body.photo || null,
            isManualEntry: false
        };
        
        // 3. Validate location if geofencing is enabled
        if (body.requireGeofence && checkInData.location) {
            const isWithinGeofence = validateGeofence(checkInData.location);
            if (!isWithinGeofence) {
                await logAuditEvent({
                    eventType: 'security.geofence_violation',
                    actorId: firebaseUid,
                    actorType: 'user',
                    actorIp: checkInData.ipAddress,
                    action: 'check_in_blocked',
                    description: 'Check-in blocked: Outside geofence',
                    location: checkInData.location,
                    status: 'failure',
                    severity: 'medium'
                });
                
                return json({ 
                    success: false, 
                    error: 'You are outside the allowed check-in area' 
                }, { status: 403 });
            }
        }
        
        // 4. Process check-in (MongoDB + Firebase emit)
        // This follows the MANDATORY LOGIC:
        // - Save to MongoDB FIRST
        // - ONLY IF MongoDB succeeds → emit to Firebase
        const attendance = await checkIn(firebaseUid, checkInData);
        
        // 5. Return success response
        return json({
            success: true,
            data: {
                id: attendance._id.toString(),
                status: attendance.currentStatus,
                checkInTime: attendance.checkIn.timestamp.toISOString(),
                isLate: attendance.isLate,
                lateMinutes: attendance.lateMinutes || 0
            }
        });
        
    } catch (error) {
        console.error('[API] Check-in error:', error);
        
        // Handle specific errors
        if (error.message === 'User not found') {
            return json({ success: false, error: 'User not found' }, { status: 404 });
        }
        
        if (error.message === 'Already checked in today') {
            return json({ success: false, error: 'Already checked in today' }, { status: 409 });
        }
        
        if (error.message === 'User account is not active') {
            return json({ success: false, error: 'Account is not active' }, { status: 403 });
        }
        
        return json({ 
            success: false, 
            error: 'Check-in failed. Please try again.' 
        }, { status: 500 });
    }
}

/**
 * Validate location against geofence
 */
function validateGeofence(location) {
    if (!location?.latitude || !location?.longitude) {
        return false;
    }
    
    // Default geofence center (should come from org settings)
    const geofenceCenter = {
        latitude: 14.5995, // Example: Manila
        longitude: 120.9842
    };
    const geofenceRadius = 500; // meters
    
    const distance = calculateDistance(
        location.latitude,
        location.longitude,
        geofenceCenter.latitude,
        geofenceCenter.longitude
    );
    
    return distance <= geofenceRadius;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    
    return R * c;
}
