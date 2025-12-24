// src/lib/services/attendanceApiService.js
// Client-side Attendance API Service
// ✅ All writes go through Backend API
// ❌ Frontend must NOT write to MongoDB or Firebase directly
// ✅ Frontend reads realtime updates from Firebase

import { auth } from '$lib/firebase';

const API_BASE = '/api/attendance';

/**
 * Get current user's auth token
 */
async function getAuthToken() {
    const user = auth?.currentUser;
    if (!user) {
        throw new Error('Not authenticated');
    }
    return user.getIdToken();
}

/**
 * Make authenticated API request
 */
async function apiRequest(endpoint, options = {}) {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
        }
    });
    
    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    
    return data;
}

/**
 * Check in
 * ✅ Sends request to backend API
 * ✅ Backend saves to MongoDB, then emits to Firebase
 */
export async function checkIn(checkInData = {}) {
    // Get device info
    const deviceInfo = {
        platform: navigator.platform,
        browser: navigator.userAgent.split(' ').pop(),
        userAgent: navigator.userAgent,
        screenSize: `${window.screen.width}x${window.screen.height}`
    };
    
    // Get location if available
    let location = null;
    if (checkInData.includeLocation !== false) {
        try {
            const position = await getCurrentPosition();
            location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
        } catch (error) {
            console.warn('Location not available:', error.message);
        }
    }
    
    return apiRequest('/check-in', {
        method: 'POST',
        body: JSON.stringify({
            location,
            deviceId: getDeviceId(),
            deviceInfo,
            method: checkInData.method || 'manual',
            verificationData: checkInData.verificationData,
            photo: checkInData.photo,
            requireGeofence: checkInData.requireGeofence
        })
    });
}

/**
 * Check out
 * ✅ Sends request to backend API
 */
export async function checkOut(checkOutData = {}) {
    const deviceInfo = {
        platform: navigator.platform,
        browser: navigator.userAgent.split(' ').pop(),
        userAgent: navigator.userAgent
    };
    
    let location = null;
    if (checkOutData.includeLocation !== false) {
        try {
            const position = await getCurrentPosition();
            location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
        } catch (error) {
            console.warn('Location not available:', error.message);
        }
    }
    
    return apiRequest('/check-out', {
        method: 'POST',
        body: JSON.stringify({
            location,
            deviceId: getDeviceId(),
            deviceInfo,
            method: checkOutData.method || 'manual'
        })
    });
}

/**
 * Start break
 */
export async function startBreak(breakType = 'short') {
    return apiRequest('/break', {
        method: 'POST',
        body: JSON.stringify({
            action: 'start',
            breakType
        })
    });
}

/**
 * End break
 */
export async function endBreak() {
    return apiRequest('/break', {
        method: 'POST',
        body: JSON.stringify({
            action: 'end'
        })
    });
}

/**
 * Get current attendance status
 * ✅ Reads from MongoDB via API
 */
export async function getStatus() {
    return apiRequest('/status', {
        method: 'GET'
    });
}

/**
 * Get attendance history
 * ✅ Reads from MongoDB via API
 * ❌ Firebase NEVER stores history
 */
export async function getHistory(options = {}) {
    const params = new URLSearchParams();
    
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.skip) params.set('skip', options.skip.toString());
    
    const queryString = params.toString();
    const endpoint = queryString ? `/history?${queryString}` : '/history';
    
    return apiRequest(endpoint, {
        method: 'GET'
    });
}

/**
 * Get current geolocation
 */
function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported'));
            return;
        }
        
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 60000
        });
    });
}

/**
 * Get or generate device ID
 */
function getDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('deviceId', deviceId);
    }
    
    return deviceId;
}

export default {
    checkIn,
    checkOut,
    startBreak,
    endBreak,
    getStatus,
    getHistory
};
