// src/routes/api/settings/+server.js
// Public endpoint for fetching system settings (non-sensitive data only)

import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin.js';

export async function GET() {
    try {
        if (!adminDb) {
            return json({ settings: getDefaultPublicSettings() });
        }
        
        const snapshot = await adminDb.ref('systemSettings').once('value');
        const storedSettings = snapshot.exists() ? snapshot.val() : {};
        
        // Return only public/non-sensitive settings
        const publicSettings = {
            general: {
                siteName: storedSettings.general?.siteName || 'Student Attendance',
                timezone: storedSettings.general?.timezone || 'Asia/Manila',
                dateFormat: storedSettings.general?.dateFormat || 'MM/DD/YYYY'
            },
            attendance: {
                startTime: storedSettings.attendance?.startTime || '08:00',
                endTime: storedSettings.attendance?.endTime || '17:00',
                gracePeriod: storedSettings.attendance?.gracePeriod || 15,
                lateThreshold: storedSettings.attendance?.lateThreshold || 15,
                workDays: storedSettings.attendance?.workDays || [1, 2, 3, 4, 5],
                holidayAutoMark: storedSettings.attendance?.holidayAutoMark ?? true,
                weekendAutoMark: storedSettings.attendance?.weekendAutoMark ?? true
            },
            epass: {
                qrExpiration: storedSettings.epass?.qrExpiration || 30,
                animatedHologram: storedSettings.epass?.animatedHologram ?? true,
                antiScreenshot: storedSettings.epass?.antiScreenshot ?? true,
                watermarkEnabled: storedSettings.epass?.watermarkEnabled ?? true
            },
            theme: {
                accentColor: storedSettings.theme?.accentColor || '#007AFF',
                themeMode: storedSettings.theme?.themeMode || 'light',
                logoUrl: storedSettings.theme?.logoUrl || '',
                seasonalTheme: storedSettings.theme?.seasonalTheme || 'none',
                welcomeBanner: storedSettings.theme?.welcomeBanner || { enabled: false }
            },
            departments: storedSettings.departments || [],
            years: storedSettings.years || ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'],
            sections: storedSettings.sections || ['A', 'B', 'C', 'D', 'E', 'F'],
            holidays: storedSettings.holidays || []
        };
        
        return json({ settings: publicSettings });
    } catch (error) {
        console.error('Get public settings error:', error);
        return json({ settings: getDefaultPublicSettings() });
    }
}

function getDefaultPublicSettings() {
    return {
        general: { siteName: 'Student Attendance', timezone: 'Asia/Manila', dateFormat: 'MM/DD/YYYY' },
        attendance: { startTime: '08:00', endTime: '17:00', gracePeriod: 15, lateThreshold: 15, workDays: [1, 2, 3, 4, 5] },
        epass: { qrExpiration: 30, animatedHologram: true, antiScreenshot: true, watermarkEnabled: true },
        theme: { accentColor: '#007AFF', themeMode: 'light', logoUrl: '', seasonalTheme: 'none', welcomeBanner: { enabled: false } },
        departments: [], years: ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'], sections: ['A', 'B', 'C', 'D', 'E', 'F'], holidays: []
    };
}
