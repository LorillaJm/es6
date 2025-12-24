// src/routes/api/admin/sessions/+server.js
// Admin Sessions API - Monitor and manage user sessions
// Uses Firebase for session data (realtime presence)

import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { adminDb, adminAuth } from '$lib/server/firebase-admin.js';

export async function GET({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.VIEW_USERS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        if (!adminDb) {
            return json({ error: 'Database not available' }, { status: 500 });
        }

        const action = url.searchParams.get('action');
        const userId = url.searchParams.get('userId');

        // Get stats
        if (action === 'stats') {
            const stats = await getSessionStats();
            return json({ stats });
        }

        // Get sessions
        const sessions = await getActiveSessions(userId);
        return json({ sessions });

    } catch (error) {
        console.error('Sessions API error:', error);
        return json({ error: 'Failed to fetch sessions' }, { status: 500 });
    }
}

export async function POST({ request }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_USERS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const { action, userId, sessionId } = await request.json();

        if (action === 'forceLogout' && userId) {
            await forceLogoutSession(userId, sessionId);
            return json({ success: true, message: 'Session terminated' });
        }

        if (action === 'forceLogoutAll' && userId) {
            await forceLogoutAllSessions(userId);
            return json({ success: true, message: 'All sessions terminated' });
        }

        return json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error('Sessions POST error:', error);
        return json({ error: 'Failed to process request' }, { status: 500 });
    }
}

async function getActiveSessions(filterUserId = null) {
    const sessions = [];

    try {
        // Get users with their session/device info
        const usersSnapshot = await adminDb.ref('users').once('value');
        if (!usersSnapshot.exists()) return sessions;

        const users = usersSnapshot.val();

        for (const [odId, userData] of Object.entries(users)) {
            // Filter by userId if specified
            if (filterUserId && odId !== filterUserId) continue;

            // Check if user has active sessions (FCM tokens indicate active devices)
            const fcmTokens = userData.fcmTokens || {};
            const tokenCount = Object.keys(fcmTokens).length;

            if (tokenCount > 0 || userData.lastLogin) {
                // Create session entry for each device/token
                for (const [tokenKey, tokenData] of Object.entries(fcmTokens)) {
                    sessions.push({
                        sessionId: tokenKey,
                        odId: odId,
                        odId: odId,
                        userId: odId,
                        userName: userData.name || userData.displayName || 'Unknown',
                        userEmail: userData.email,
                        deviceInfo: {
                            browser: {
                                name: tokenData.browser || 'Unknown',
                                version: tokenData.browserVersion || ''
                            },
                            platform: tokenData.platform || tokenData.os || 'Unknown',
                            isMobile: tokenData.isMobile || false,
                            screenResolution: tokenData.screenResolution || ''
                        },
                        lastActivity: tokenData.lastUsed || tokenData.createdAt || userData.lastLogin,
                        createdAt: tokenData.createdAt,
                        ipAddress: tokenData.ipAddress || null
                    });
                }

                // If no FCM tokens but has lastLogin, show as single session
                if (tokenCount === 0 && userData.lastLogin) {
                    sessions.push({
                        sessionId: `session_${odId}`,
                        odId: odId,
                        userId: odId,
                        userName: userData.name || userData.displayName || 'Unknown',
                        userEmail: userData.email,
                        deviceInfo: {
                            browser: { name: 'Unknown', version: '' },
                            platform: 'Unknown',
                            isMobile: false,
                            screenResolution: ''
                        },
                        lastActivity: userData.lastLogin,
                        createdAt: userData.createdAt,
                        ipAddress: null
                    });
                }
            }
        }

        // Sort by last activity (most recent first)
        sessions.sort((a, b) => {
            const dateA = new Date(a.lastActivity || 0);
            const dateB = new Date(b.lastActivity || 0);
            return dateB - dateA;
        });

    } catch (error) {
        console.error('Error fetching sessions:', error);
    }

    return sessions;
}

async function getSessionStats() {
    const stats = {
        totalActive: 0,
        byDevice: {
            desktop: 0,
            mobile: 0,
            tablet: 0
        },
        byBrowser: {},
        recentLogins: 0
    };

    try {
        const sessions = await getActiveSessions();
        stats.totalActive = sessions.length;

        const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

        for (const session of sessions) {
            // Count by device type
            if (session.deviceInfo?.isMobile) {
                stats.byDevice.mobile++;
            } else {
                stats.byDevice.desktop++;
            }

            // Count by browser
            const browserName = session.deviceInfo?.browser?.name || 'Unknown';
            stats.byBrowser[browserName] = (stats.byBrowser[browserName] || 0) + 1;

            // Count recent logins
            if (session.lastActivity && new Date(session.lastActivity).getTime() > oneDayAgo) {
                stats.recentLogins++;
            }
        }

    } catch (error) {
        console.error('Error calculating stats:', error);
    }

    return stats;
}

async function forceLogoutSession(userId, sessionId) {
    try {
        // Remove specific FCM token
        if (sessionId && !sessionId.startsWith('session_')) {
            await adminDb.ref(`users/${userId}/fcmTokens/${sessionId}`).remove();
        }

        // Revoke Firebase refresh tokens for the user
        if (adminAuth) {
            try {
                await adminAuth.revokeRefreshTokens(userId);
            } catch (e) {
                console.warn('Could not revoke refresh tokens:', e.message);
            }
        }

        console.log(`[Sessions] Force logout: ${userId} - ${sessionId}`);
    } catch (error) {
        console.error('Force logout error:', error);
        throw error;
    }
}

async function forceLogoutAllSessions(userId) {
    try {
        // Remove all FCM tokens
        await adminDb.ref(`users/${userId}/fcmTokens`).remove();

        // Revoke all refresh tokens
        if (adminAuth) {
            try {
                await adminAuth.revokeRefreshTokens(userId);
            } catch (e) {
                console.warn('Could not revoke refresh tokens:', e.message);
            }
        }

        console.log(`[Sessions] Force logout all sessions: ${userId}`);
    } catch (error) {
        console.error('Force logout all error:', error);
        throw error;
    }
}
