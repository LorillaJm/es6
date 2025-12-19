// src/lib/security/index.js
// Enterprise Security Module - Central exports

// Device Fingerprinting & Zero-Trust
export {
    generateDeviceFingerprint,
    getDeviceInfo,
    validateDeviceFingerprint,
    storeTrustedDevice,
    isDeviceTrusted,
    getTrustedDevices,
    removeTrustedDevice
} from './deviceFingerprint.js';

// Session Management
export {
    createSecureSession,
    validateSession,
    updateSessionActivity,
    expireSession,
    revokeSession,
    revokeAllSessions,
    getActiveSessions,
    stopActivityMonitor
} from './sessionManager.js';

// Geofence & Location Validation
export {
    calculateDistance,
    getCurrentLocation,
    getCampusZones,
    validateLocationInGeofence,
    logLocationValidation,
    saveCampusZones,
    detectLocationSpoofing
} from './geofence.js';

// Password Policy & Validation
export {
    validatePassword,
    generateSecurePassword,
    PASSWORD_POLICY
} from './passwordPolicy.js';

// QR Code Security
export {
    generateSecureQRPayload,
    validateQRPayload,
    QRRotationManager,
    generateAttendanceQR,
    validateAttendanceQR,
    QR_CONFIG
} from './qrCodeSecurity.js';

// Incident Response & Emergency Controls
export {
    reportIncident,
    handleDetectedAbuse,
    freezeUserAccount,
    unfreezeUserAccount,
    forceLogoutUser,
    resolveIncident,
    getOpenIncidents,
    EmergencyControls,
    SEVERITY,
    INCIDENT_TYPES
} from './incidentResponse.js';
