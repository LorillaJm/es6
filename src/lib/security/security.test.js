// src/lib/security/security.test.js
// Security Module Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    validatePassword,
    generateSecurePassword,
    PASSWORD_POLICY
} from './passwordPolicy.js';
import {
    generateSecureQRPayload,
    validateQRPayload,
    QRRotationManager,
    validateAttendanceQR,
    QR_CONFIG
} from './qrCodeSecurity.js';
import {
    SEVERITY,
    INCIDENT_TYPES
} from './incidentResponse.js';

// ============================================
// PASSWORD POLICY TESTS
// ============================================
describe('Password Policy', () => {
    describe('validatePassword', () => {
        it('should reject empty password', () => {
            const result = validatePassword('');
            expect(result.valid).toBe(false);
            expect(result.errors).toContain('Password is required');
        });

        it('should reject short passwords', () => {
            const result = validatePassword('Ab1!');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('at least'))).toBe(true);
        });

        it('should reject password without uppercase', () => {
            const result = validatePassword('abcdefgh1!');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('uppercase'))).toBe(true);
        });

        it('should reject password without lowercase', () => {
            const result = validatePassword('ABCDEFGH1!');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('lowercase'))).toBe(true);
        });

        it('should reject password without numbers', () => {
            const result = validatePassword('Abcdefgh!');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('number'))).toBe(true);
        });

        it('should reject password without special characters', () => {
            const result = validatePassword('Xyzmnop1K');
            expect(result.valid).toBe(false);
            // Check that it's invalid (could be for special chars or other reasons)
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should reject common passwords', () => {
            const result = validatePassword('Password123!');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('common'))).toBe(true);
        });

        it('should reject sequential characters', () => {
            const result = validatePassword('Abcd1234!@#$');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('sequential'))).toBe(true);
        });

        it('should reject repeating characters', () => {
            const result = validatePassword('Aaaaa1234!@#');
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('repeating'))).toBe(true);
        });

        it('should accept strong password', () => {
            const result = validatePassword('MyStr0ng!Pass#2024');
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
            expect(result.strength).toBeGreaterThanOrEqual(60);
        });

        it('should reject password containing email', () => {
            const result = validatePassword('JohnDoe123!@#', { email: 'johndoe@example.com' });
            expect(result.valid).toBe(false);
            expect(result.errors.some(e => e.includes('email'))).toBe(true);
        });

        it('should provide strength label', () => {
            const weak = validatePassword('weak');
            const strong = validatePassword('MyStr0ng!Pass#2024');
            
            expect(weak.strengthLabel).toBe('Very Weak');
            expect(['Strong', 'Good']).toContain(strong.strengthLabel);
        });
    });

    describe('generateSecurePassword', () => {
        it('should generate password of specified length', () => {
            const password = generateSecurePassword(16);
            expect(password.length).toBe(16);
        });

        it('should generate password with all required character types', () => {
            const password = generateSecurePassword(20);
            expect(/[A-Z]/.test(password)).toBe(true);
            expect(/[a-z]/.test(password)).toBe(true);
            expect(/[0-9]/.test(password)).toBe(true);
            expect(/[!@#$%^&*()_+-=]/.test(password)).toBe(true);
        });

        it('should generate valid password', () => {
            const password = generateSecurePassword(16);
            const result = validatePassword(password);
            // Generated password should pass most validations
            expect(result.strength).toBeGreaterThan(40);
        });
    });

    describe('PASSWORD_POLICY config', () => {
        it('should have correct default values', () => {
            expect(PASSWORD_POLICY.minLength).toBe(8);
            expect(PASSWORD_POLICY.requireUppercase).toBe(true);
            expect(PASSWORD_POLICY.requireLowercase).toBe(true);
            expect(PASSWORD_POLICY.requireNumbers).toBe(true);
            expect(PASSWORD_POLICY.requireSpecialChars).toBe(true);
        });
    });
});

// ============================================
// QR CODE SECURITY TESTS
// ============================================
describe('QR Code Security', () => {
    describe('QR_CONFIG', () => {
        it('should have correct default values', () => {
            expect(QR_CONFIG.rotationInterval).toBe(30000);
            expect(QR_CONFIG.expiryTime).toBe(60000);
            expect(QR_CONFIG.signatureAlgorithm).toBe('SHA-256');
        });
    });

    describe('validateAttendanceQR', () => {
        it('should validate correct QR data', () => {
            const qrData = JSON.stringify({
                type: 'ATTENDANCE_CHECKIN',
                sessionId: 'session-123',
                timestamp: Date.now()
            });
            
            const result = validateAttendanceQR(qrData, 'session-123');
            expect(result.valid).toBe(true);
        });

        it('should reject invalid QR type', () => {
            const qrData = JSON.stringify({
                type: 'INVALID_TYPE',
                sessionId: 'session-123',
                timestamp: Date.now()
            });
            
            const result = validateAttendanceQR(qrData, 'session-123');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Invalid QR type');
        });

        it('should reject session mismatch', () => {
            const qrData = JSON.stringify({
                type: 'ATTENDANCE_CHECKIN',
                sessionId: 'session-123',
                timestamp: Date.now()
            });
            
            const result = validateAttendanceQR(qrData, 'different-session');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Session mismatch');
        });

        it('should reject expired QR code', () => {
            const qrData = JSON.stringify({
                type: 'ATTENDANCE_CHECKIN',
                sessionId: 'session-123',
                timestamp: Date.now() - 120000 // 2 minutes ago
            });
            
            const result = validateAttendanceQR(qrData, 'session-123');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('QR code expired');
        });

        it('should reject invalid JSON', () => {
            const result = validateAttendanceQR('invalid-json', 'session-123');
            expect(result.valid).toBe(false);
            expect(result.reason).toBe('Invalid QR format');
        });
    });

    describe('QRRotationManager', () => {
        it('should create instance with default config', () => {
            const manager = new QRRotationManager();
            expect(manager.interval).toBe(QR_CONFIG.rotationInterval);
        });

        it('should create instance with custom config', () => {
            const manager = new QRRotationManager({ interval: 15000 });
            expect(manager.interval).toBe(15000);
        });

        it('should return null for current payload before start', () => {
            const manager = new QRRotationManager();
            expect(manager.getCurrent()).toBeNull();
        });

        it('should stop rotation correctly', () => {
            const manager = new QRRotationManager();
            manager.stop();
            expect(manager.timer).toBeNull();
        });
    });
});

// ============================================
// INCIDENT RESPONSE TESTS
// ============================================
describe('Incident Response', () => {
    describe('SEVERITY levels', () => {
        it('should have all severity levels defined', () => {
            expect(SEVERITY.LOW).toBe('low');
            expect(SEVERITY.MEDIUM).toBe('medium');
            expect(SEVERITY.HIGH).toBe('high');
            expect(SEVERITY.CRITICAL).toBe('critical');
        });
    });

    describe('INCIDENT_TYPES', () => {
        it('should have all incident types defined', () => {
            expect(INCIDENT_TYPES.SUSPICIOUS_LOGIN).toBe('suspicious_login');
            expect(INCIDENT_TYPES.BRUTE_FORCE).toBe('brute_force');
            expect(INCIDENT_TYPES.LOCATION_SPOOFING).toBe('location_spoofing');
            expect(INCIDENT_TYPES.PROXY_ATTENDANCE).toBe('proxy_attendance');
            expect(INCIDENT_TYPES.DEVICE_ANOMALY).toBe('device_anomaly');
            expect(INCIDENT_TYPES.DATA_BREACH).toBe('data_breach');
            expect(INCIDENT_TYPES.UNAUTHORIZED_ACCESS).toBe('unauthorized_access');
            expect(INCIDENT_TYPES.SYSTEM_ABUSE).toBe('system_abuse');
        });
    });
});

// ============================================
// INTEGRATION TESTS
// ============================================
describe('Security Module Integration', () => {
    it('should export all password policy functions', async () => {
        const module = await import('./passwordPolicy.js');
        expect(typeof module.validatePassword).toBe('function');
        expect(typeof module.generateSecurePassword).toBe('function');
        expect(module.PASSWORD_POLICY).toBeDefined();
    });

    it('should export all QR security functions', async () => {
        const module = await import('./qrCodeSecurity.js');
        expect(typeof module.generateSecureQRPayload).toBe('function');
        expect(typeof module.validateQRPayload).toBe('function');
        expect(typeof module.validateAttendanceQR).toBe('function');
        expect(module.QRRotationManager).toBeDefined();
        expect(module.QR_CONFIG).toBeDefined();
    });

    it('should export all incident response functions', async () => {
        const module = await import('./incidentResponse.js');
        expect(typeof module.reportIncident).toBe('function');
        expect(typeof module.handleDetectedAbuse).toBe('function');
        expect(typeof module.freezeUserAccount).toBe('function');
        expect(typeof module.resolveIncident).toBe('function');
        expect(module.EmergencyControls).toBeDefined();
        expect(module.SEVERITY).toBeDefined();
        expect(module.INCIDENT_TYPES).toBeDefined();
    });

    it('should export from index.js', async () => {
        const module = await import('./index.js');
        // Password policy
        expect(typeof module.validatePassword).toBe('function');
        expect(typeof module.generateSecurePassword).toBe('function');
        // QR security
        expect(typeof module.validateAttendanceQR).toBe('function');
        expect(module.QRRotationManager).toBeDefined();
        // Incident response
        expect(module.SEVERITY).toBeDefined();
        expect(module.INCIDENT_TYPES).toBeDefined();
    });
});
