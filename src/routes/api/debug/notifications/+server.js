// src/routes/api/debug/notifications/+server.js
// Debug endpoint to check Firebase notifications
import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin.js';

export async function GET({ url, setHeaders }) {
    // Prevent caching
    setHeaders({
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
    });

    try {
        const userId = url.searchParams.get('userId');
        
        if (!adminDb) {
            return json({ error: 'Firebase Admin not initialized' }, { status: 500 });
        }

        // Get all realtime notifications
        const realtimeNotifs = await adminDb.ref('realtime/notifications').once('value');
        const realtimeData = realtimeNotifs.val();

        // Get specific user notifications if userId provided
        let userNotifs = null;
        if (userId) {
            const userNotifsSnapshot = await adminDb.ref(`realtime/notifications/${userId}`).once('value');
            userNotifs = userNotifsSnapshot.val();
        }

        // Get all users to see their IDs
        const usersSnapshot = await adminDb.ref('users').once('value');
        const users = usersSnapshot.val();
        const userIds = users ? Object.keys(users) : [];

        return json({
            success: true,
            realtimeNotificationsPath: 'realtime/notifications',
            totalUsersWithNotifications: realtimeData ? Object.keys(realtimeData).length : 0,
            userIdsWithNotifications: realtimeData ? Object.keys(realtimeData) : [],
            allUserIds: userIds,
            requestedUserId: userId,
            userNotifications: userNotifs,
            userNotificationCount: userNotifs ? Object.keys(userNotifs).length : 0
        });
    } catch (error) {
        console.error('Debug notifications error:', error);
        return json({ error: error.message, stack: error.stack }, { status: 500 });
    }
}
