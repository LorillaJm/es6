// src/routes/api/admin/settings/+server.js
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, logAuditEvent, PERMISSIONS } from '$lib/server/adminAuth.js';
import { adminDb } from '$lib/server/firebase-admin.js';

// Default settings structure
const DEFAULT_SETTINGS = {
    general: {
        siteName: 'Student Attendance',
        timezone: 'Asia/Manila',
        dateFormat: 'MM/DD/YYYY'
    },
    attendance: {
        startTime: '08:00',
        endTime: '17:00',
        autoCheckout: true,
        autoCheckoutTime: '18:00',
        lateThreshold: 15,
        gracePeriod: 15,
        geofenceEnabled: true,
        workDays: [1, 2, 3, 4, 5],
        holidayAutoMark: true,
        weekendAutoMark: true
    },
    epass: {
        qrExpiration: 30,
        animatedHologram: true,
        antiScreenshot: true,
        watermarkEnabled: true
    },
    theme: {
        accentColor: '#007AFF',
        themeMode: 'light',
        logoUrl: '',
        seasonalTheme: 'none',
        welcomeBanner: {
            enabled: false,
            title: '',
            message: '',
            imageUrl: ''
        }
    },
    security: {
        sessionTimeout: 8,
        maxLoginAttempts: 5,
        mfaRequired: false
    },
    departments: [],
    years: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'],
    sections: ['A', 'B', 'C', 'D', 'E', 'F'],
    holidays: []
};

export async function GET({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_SYSTEM_SETTINGS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }
        
        if (!adminDb) return json({ settings: DEFAULT_SETTINGS });
        
        const snapshot = await adminDb.ref('systemSettings').once('value');
        const storedSettings = snapshot.exists() ? snapshot.val() : {};
        
        // Merge with defaults to ensure all fields exist
        const settings = {
            general: { ...DEFAULT_SETTINGS.general, ...storedSettings.general },
            attendance: { ...DEFAULT_SETTINGS.attendance, ...storedSettings.attendance },
            epass: { ...DEFAULT_SETTINGS.epass, ...storedSettings.epass },
            theme: { 
                ...DEFAULT_SETTINGS.theme, 
                ...storedSettings.theme,
                welcomeBanner: { ...DEFAULT_SETTINGS.theme.welcomeBanner, ...storedSettings.theme?.welcomeBanner }
            },
            security: { ...DEFAULT_SETTINGS.security, ...storedSettings.security },
            departments: storedSettings.departments || DEFAULT_SETTINGS.departments,
            years: storedSettings.years || DEFAULT_SETTINGS.years,
            sections: storedSettings.sections || DEFAULT_SETTINGS.sections,
            holidays: storedSettings.holidays || DEFAULT_SETTINGS.holidays
        };
        
        return json({ settings });
    } catch (error) {
        console.error('Get settings error:', error);
        return json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_SYSTEM_SETTINGS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const { settings } = await request.json();
        
        if (!adminDb) return json({ error: 'Database not available' }, { status: 500 });
        
        // Validate critical settings
        if (settings.attendance) {
            if (settings.attendance.gracePeriod < 0 || settings.attendance.gracePeriod > 60) {
                return json({ error: 'Grace period must be between 0-60 minutes' }, { status: 400 });
            }
            if (settings.attendance.lateThreshold < 0 || settings.attendance.lateThreshold > 120) {
                return json({ error: 'Late threshold must be between 0-120 minutes' }, { status: 400 });
            }
        }
        
        if (settings.epass) {
            if (settings.epass.qrExpiration < 10 || settings.epass.qrExpiration > 300) {
                return json({ error: 'QR expiration must be between 10-300 seconds' }, { status: 400 });
            }
        }
        
        await adminDb.ref('systemSettings').set({
            ...settings,
            updatedAt: new Date().toISOString(),
            updatedBy: admin.id
        });
        
        await logAuditEvent({
            action: 'SETTINGS_UPDATED',
            adminId: admin.id,
            details: { sections: Object.keys(settings) }
        });
        
        return json({ success: true });
    } catch (error) {
        console.error('Update settings error:', error);
        return json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
