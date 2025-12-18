// src/routes/api/test-fcm/+server.js
// Test endpoint to verify FCM background notifications are working
import { json } from '@sveltejs/kit';
import { adminDb, sendFCMNotification } from '$lib/server/firebase-admin.js';

export async function POST({ request }) {
    try {
        const { userId, title, body, priority } = await request.json();

        if (!userId) {
            return json({ error: 'userId is required' }, { status: 400 });
        }

        console.log(`[Test FCM] Sending test notification to user: ${userId}`);

        // Check if user has FCM tokens
        if (adminDb) {
            const tokensSnapshot = await adminDb.ref(`users/${userId}/fcmTokens`).once('value');
            const tokens = tokensSnapshot.val();
            console.log(`[Test FCM] User has ${tokens ? Object.keys(tokens).length : 0} FCM tokens`);
            
            if (!tokens || Object.keys(tokens).length === 0) {
                return json({ 
                    error: 'No FCM tokens found for user',
                    hint: 'Make sure the user has logged in and allowed notifications'
                }, { status: 400 });
            }
        }

        const result = await sendFCMNotification(userId, {
            title: title || '🔔 Test Background Notification',
            body: body || 'This is a test notification sent while app is closed!',
            data: {
                type: 'test',
                url: '/app/announcements',
                priority: priority || 'normal'
            }
        });

        console.log(`[Test FCM] Result:`, result);

        return json({
            success: result.success,
            message: result.success 
                ? `Notification sent to ${result.sent} device(s)` 
                : result.error,
            details: result
        });
    } catch (error) {
        console.error('[Test FCM] Error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}

// GET endpoint to check user's FCM tokens
export async function GET({ url }) {
    try {
        const userId = url.searchParams.get('userId');

        if (!userId) {
            return json({ error: 'userId query param is required' }, { status: 400 });
        }

        if (!adminDb) {
            return json({ error: 'Database not available' }, { status: 500 });
        }

        const tokensSnapshot = await adminDb.ref(`users/${userId}/fcmTokens`).once('value');
        const tokens = tokensSnapshot.val();

        if (!tokens) {
            return json({ 
                hasTokens: false, 
                count: 0,
                message: 'No FCM tokens registered for this user'
            });
        }

        const tokenList = Object.values(tokens).map(t => ({
            createdAt: t.createdAt,
            platform: t.platform,
            browser: t.browser || 'Unknown',
            tokenPreview: t.token ? t.token.substring(0, 20) + '...' : 'N/A'
        }));

        return json({
            hasTokens: true,
            count: tokenList.length,
            tokens: tokenList
        });
    } catch (error) {
        console.error('[Test FCM] Error:', error);
        return json({ error: error.message }, { status: 500 });
    }
}
