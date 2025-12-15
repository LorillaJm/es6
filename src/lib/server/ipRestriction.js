// src/lib/server/ipRestriction.js
// IP Restriction Service for Admin & Attendance Access
import { adminDb } from './firebase-admin.js';
import { logAuditEvent } from './adminAuth.js';

const IP_SETTINGS_PATH = 'settings/security/ipRestriction';

/**
 * @typedef {Object} IPRestrictionSettings
 * @property {boolean} enabled
 * @property {boolean} adminLoginRestricted
 * @property {boolean} attendanceRestricted
 * @property {string[]} allowedIPs - List of allowed IP addresses
 * @property {string[]} allowedRanges - CIDR ranges like "192.168.1.0/24"
 * @property {string[]} allowedNetworkNames - Friendly names for reference
 */

/**
 * Get IP restriction settings
 * @returns {Promise<IPRestrictionSettings>}
 */
export async function getIPRestrictionSettings() {
    if (!adminDb) {
        return getDefaultSettings();
    }

    const snapshot = await adminDb.ref(IP_SETTINGS_PATH).once('value');
    if (!snapshot.exists()) {
        return getDefaultSettings();
    }

    return { ...getDefaultSettings(), ...snapshot.val() };
}

/**
 * Get default settings
 */
function getDefaultSettings() {
    return {
        enabled: false,
        adminLoginRestricted: false,
        attendanceRestricted: false,
        allowedIPs: [],
        allowedRanges: [],
        allowedNetworkNames: []
    };
}

/**
 * Update IP restriction settings
 * @param {Partial<IPRestrictionSettings>} settings
 * @param {string} adminId
 */
export async function updateIPRestrictionSettings(settings, adminId) {
    if (!adminDb) throw new Error('Database not available');

    const currentSettings = await getIPRestrictionSettings();
    const updatedSettings = { ...currentSettings, ...settings, updatedAt: new Date().toISOString() };

    await adminDb.ref(IP_SETTINGS_PATH).set(updatedSettings);

    await logAuditEvent({
        action: 'IP_RESTRICTION_UPDATED',
        adminId,
        details: { settings: updatedSettings }
    });

    return updatedSettings;
}

/**
 * Check if IP is in CIDR range
 * @param {string} ip
 * @param {string} cidr
 */
function isIPInRange(ip, cidr) {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits)) - 1);
    
    const ipNum = ipToNumber(ip);
    const rangeNum = ipToNumber(range);
    
    return (ipNum & mask) === (rangeNum & mask);
}

/**
 * Convert IP to number
 * @param {string} ip
 */
function ipToNumber(ip) {
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
}

/**
 * Validate if an IP address is allowed
 * @param {string} clientIP
 * @param {'admin' | 'attendance'} context
 * @returns {Promise<{allowed: boolean, reason?: string}>}
 */
export async function validateIPAccess(clientIP, context) {
    const settings = await getIPRestrictionSettings();

    // If not enabled, allow all
    if (!settings.enabled) {
        return { allowed: true };
    }

    // Check if this context is restricted
    if (context === 'admin' && !settings.adminLoginRestricted) {
        return { allowed: true };
    }
    if (context === 'attendance' && !settings.attendanceRestricted) {
        return { allowed: true };
    }

    // Handle localhost/development
    if (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === 'localhost') {
        return { allowed: true, reason: 'localhost' };
    }

    // Check exact IP match
    if (settings.allowedIPs.includes(clientIP)) {
        return { allowed: true, reason: 'exact_match' };
    }

    // Check CIDR ranges
    for (const range of settings.allowedRanges) {
        try {
            if (isIPInRange(clientIP, range)) {
                return { allowed: true, reason: 'range_match' };
            }
        } catch (e) {
            console.error('Invalid CIDR range:', range);
        }
    }

    return { 
        allowed: false, 
        reason: 'IP address not in allowed list' 
    };
}

/**
 * Add an IP to the allowed list
 * @param {string} ip
 * @param {string} [networkName]
 * @param {string} adminId
 */
export async function addAllowedIP(ip, networkName, adminId) {
    const settings = await getIPRestrictionSettings();
    
    if (!settings.allowedIPs.includes(ip)) {
        settings.allowedIPs.push(ip);
        if (networkName) {
            settings.allowedNetworkNames.push(`${ip}: ${networkName}`);
        }
        await updateIPRestrictionSettings(settings, adminId);
    }

    return settings;
}

/**
 * Remove an IP from the allowed list
 * @param {string} ip
 * @param {string} adminId
 */
export async function removeAllowedIP(ip, adminId) {
    const settings = await getIPRestrictionSettings();
    
    settings.allowedIPs = settings.allowedIPs.filter(i => i !== ip);
    settings.allowedNetworkNames = settings.allowedNetworkNames.filter(n => !n.startsWith(ip));
    
    await updateIPRestrictionSettings(settings, adminId);
    return settings;
}

/**
 * Add a CIDR range
 * @param {string} cidr
 * @param {string} [networkName]
 * @param {string} adminId
 */
export async function addAllowedRange(cidr, networkName, adminId) {
    const settings = await getIPRestrictionSettings();
    
    if (!settings.allowedRanges.includes(cidr)) {
        settings.allowedRanges.push(cidr);
        if (networkName) {
            settings.allowedNetworkNames.push(`${cidr}: ${networkName}`);
        }
        await updateIPRestrictionSettings(settings, adminId);
    }

    return settings;
}

/**
 * Log blocked access attempt
 * @param {string} clientIP
 * @param {string} context
 * @param {string} [userId]
 */
export async function logBlockedAccess(clientIP, context, userId = null) {
    await logAuditEvent({
        action: 'IP_ACCESS_BLOCKED',
        adminId: userId || 'anonymous',
        details: { clientIP, context, timestamp: new Date().toISOString() },
        ipAddress: clientIP
    });
}
