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
import { checkRateLimit } from '$lib/server/adminSecurityMiddleware.js';

// Valid check-in methods
const VALID_METHODS = ['qr', 'face', 'manual', 'nfc'];

/**
 * Sanitize and validate location data
 */
function validateLocation(location) {
    if (!location) return null;
    
    const lat = parseFloat(location.latitude);
    const lng = parseFloat(location.longitude);
    
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90) return null;
    if (lng < -180 || lng > 180) return null;
    
    return {
        latitude: lat,
        longitude: lng,
        accuracy: location.accuracy ? Math.min(parseFloat(location.accuracy), 10000) : null,
        name: typeof location.name === 'string' ? location.name.substring(0, 200) : null
    };
}

/**
 * Sanitize device info
 */
function sanitizeDeviceInfo(deviceInfo) {
    if (!deviceInfo || typeof deviceInfo !== 'object') return null;
    
    return {
        browser: typeof deviceInfo.browser === 'string' ? deviceInfo.browser.substring(0, 50) : null,
        platform: typeof deviceInfo.platform === 'string' ? deviceInfo.platform.substring(0, 50) : null,
        isMobile: Boolean(deviceInfo.isMobile)
    };
}

export async function POST({ request, getClientAddress }) {
    const ipAddress = getClientAddress();
    
    // Rate limiting for check-in attempts
    const rateLimit = checkRateLimit(ipAddress, 'default');
    if (!rateLimit.allowed) {
        return json({ 
            success: false, 
            error: 'Too many requests. Please try again later.',
            retryAfter: rateLimit.retryAfter
        }, { status: 429 });
    }

    try {
        // 1. Validate authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        
        // Check if Firebase Admin is available
        if (!adminAuth) {
            return json({ success: false, error: 'Authentication service unavailable' }, { status: 503 });
        }
        
        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch (authError) {
            // Log but don't expose specific auth errors
            console.error('[Check-in] Token verification failed:', authError.code);
            return json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
        }
        
        const firebaseUid = decodedToken.uid;
        
        // 2. Parse and validate request body
        let body;
        try {
            body = await request.json();
        } catch {
            return json({ success: false, error: 'Invalid request body' }, { status: 400 });
        }
        
        // Validate method
        const method = VALID_METHODS.includes(body.method) ? body.method : 'manual';
        
        const checkInData = {
            location: validateLocation(body.location),
            deviceId: typeof body.deviceId === 'string' ? body.deviceId.substring(0, 100) : null,
            deviceInfo: sanitizeDeviceInfo(body.deviceInfo),
            method,
            verificationData: body.verificationData || null,
            ipAddress,
            photo: null, // Don't store photos in check-in data for privacy
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
                    actorIp: ipAddress,
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
        // Log error internally
        console.error('[API] Check-in error:', error.message);
        
        // Handle specific errors with user-friendly messages
        const errorMessages = {
            'User not found': { message: 'User account not found', status: 404 },
            'Already checked in today': { message: 'You have already checked in today', status: 409 },
            'User account is not active': { message: 'Your account is not active', status: 403 }
        };
        
        const knownError = errorMessages[error.message];
        if (knownError) {
            return json({ success: false, error: knownError.message }, { status: knownError.status });
        }
        
        // Generic error for unknown issues
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
