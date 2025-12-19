// src/lib/security/qrCodeSecurity.js
// Enterprise QR Code Security - Time-limited, encrypted, rotating QR codes

import { browser } from '$app/environment';

/**
 * QR Code Security Configuration
 */
export const QR_CONFIG = {
    rotationInterval: 30000, // 30 seconds
    expiryTime: 60000, // 60 seconds validity
    includeLocation: true,
    includeDeviceHash: true,
    signatureAlgorithm: 'SHA-256'
};

/**
 * Generate a secure, time-limited QR code payload
 * @param {object} data - Data to encode
 * @param {string} secretKey - Secret key for signing
 * @returns {Promise<object>} Secure QR payload
 */
export async function generateSecureQRPayload(data, secretKey) {
    const timestamp = Date.now();
    const expiresAt = timestamp + QR_CONFIG.expiryTime;
    const nonce = generateNonce();
    
    const payload = {
        ...data,
        iat: timestamp, // Issued at
        exp: expiresAt, // Expires at
        nonce,
        version: '2.0'
    };
    
    // Generate signature
    const signature = await signPayload(payload, secretKey);
    
    return {
        payload: btoa(JSON.stringify(payload)),
        signature,
        expiresAt,
        rotateAt: timestamp + QR_CONFIG.rotationInterval
    };
}

/**
 * Validate a QR code payload
 * @param {string} encodedPayload - Base64 encoded payload
 * @param {string} signature - Payload signature
 * @param {string} secretKey - Secret key for verification
 * @returns {Promise<object>} Validation result
 */
export async function validateQRPayload(encodedPayload, signature, secretKey) {
    try {
        // Decode payload
        const payload = JSON.parse(atob(encodedPayload));
        
        // Check expiry
        if (Date.now() > payload.exp) {
            return {
                valid: false,
                reason: 'expired',
                message: 'QR code has expired. Please request a new one.'
            };
        }
        
        // Verify signature
        const expectedSignature = await signPayload(payload, secretKey);
        if (signature !== expectedSignature) {
            return {
                valid: false,
                reason: 'invalid_signature',
                message: 'QR code signature is invalid. Possible tampering detected.'
            };
        }
        
        return {
            valid: true,
            payload,
            remainingTime: payload.exp - Date.now()
        };
    } catch (error) {
        return {
            valid: false,
            reason: 'parse_error',
            message: 'Invalid QR code format.'
        };
    }
}

/**
 * Generate cryptographic nonce
 */
function generateNonce() {
    if (browser && window.crypto) {
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Sign payload using HMAC-SHA256
 */
async function signPayload(payload, secretKey) {
    if (!browser) return '';
    
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    const keyData = encoder.encode(secretKey);
    
    try {
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', key, data);
        return Array.from(new Uint8Array(signature))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    } catch (error) {
        console.error('Signing error:', error);
        return '';
    }
}

/**
 * QR Code rotation manager
 */
export class QRRotationManager {
    constructor(options = {}) {
        this.interval = options.interval || QR_CONFIG.rotationInterval;
        this.onRotate = options.onRotate || null;
        this.secretKey = options.secretKey || 'default-secret-key';
        this.timer = null;
        this.currentPayload = null;
    }

    /**
     * Start QR code rotation
     * @param {object} baseData - Base data for QR code
     */
    async start(baseData) {
        await this.rotate(baseData);
        
        this.timer = setInterval(async () => {
            await this.rotate(baseData);
        }, this.interval);
    }

    /**
     * Rotate QR code
     */
    async rotate(baseData) {
        this.currentPayload = await generateSecureQRPayload(baseData, this.secretKey);
        
        if (this.onRotate) {
            this.onRotate(this.currentPayload);
        }
        
        return this.currentPayload;
    }

    /**
     * Stop rotation
     */
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }

    /**
     * Get current payload
     */
    getCurrent() {
        return this.currentPayload;
    }

    /**
     * Get time until next rotation
     */
    getTimeUntilRotation() {
        if (!this.currentPayload) return 0;
        return Math.max(0, this.currentPayload.rotateAt - Date.now());
    }
}

/**
 * Generate attendance QR code data
 * @param {string} sessionId - Attendance session ID
 * @param {string} organizationId - Organization ID
 * @param {object} location - Optional location data
 * @returns {Promise<object>} QR code data
 */
export async function generateAttendanceQR(sessionId, organizationId, location = null) {
    const data = {
        type: 'ATTENDANCE_CHECKIN',
        sessionId,
        organizationId,
        timestamp: Date.now()
    };
    
    if (QR_CONFIG.includeLocation && location) {
        data.locationHash = await hashLocation(location);
    }
    
    return data;
}

/**
 * Hash location for privacy
 */
async function hashLocation(location) {
    if (!browser || !location) return null;
    
    const locationString = `${location.latitude.toFixed(4)},${location.longitude.toFixed(4)}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(locationString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Validate scanned attendance QR
 * @param {string} qrData - Scanned QR data
 * @param {string} expectedSessionId - Expected session ID
 * @returns {object} Validation result
 */
export function validateAttendanceQR(qrData, expectedSessionId) {
    try {
        const data = JSON.parse(qrData);
        
        if (data.type !== 'ATTENDANCE_CHECKIN') {
            return { valid: false, reason: 'Invalid QR type' };
        }
        
        if (data.sessionId !== expectedSessionId) {
            return { valid: false, reason: 'Session mismatch' };
        }
        
        // Check if QR is too old (more than 60 seconds)
        const age = Date.now() - data.timestamp;
        if (age > QR_CONFIG.expiryTime) {
            return { valid: false, reason: 'QR code expired' };
        }
        
        return { valid: true, data };
    } catch (error) {
        return { valid: false, reason: 'Invalid QR format' };
    }
}

export default {
    generateSecureQRPayload,
    validateQRPayload,
    QRRotationManager,
    generateAttendanceQR,
    validateAttendanceQR,
    QR_CONFIG
};
