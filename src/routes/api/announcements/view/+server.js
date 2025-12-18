// src/routes/api/announcements/view/+server.js
import { json } from '@sveltejs/kit';
import { adminDb } from '$lib/server/firebase-admin.js';

export async function POST({ request }) {
    try {
        const data = await request.json();
        const { announcementId, userId } = data;

        if (!announcementId || !userId) {
            return json({ error: 'Missing announcementId or userId' }, { status: 400 });
        }

        if (!adminDb) {
            return json({ error: 'Database not available' }, { status: 500 });
        }

        // Check if user has already viewed this announcement
        const viewRef = adminDb.ref(`announcementViews/${announcementId}/${userId}`);
        const viewSnapshot = await viewRef.once('value');

        if (viewSnapshot.exists()) {
            // User already viewed, don't increment again
            return json({ success: true, alreadyViewed: true });
        }

        // Record the view
        await viewRef.set({
            viewedAt: new Date().toISOString()
        });

        // Increment the view count on the announcement
        const announcementRef = adminDb.ref(`announcements/${announcementId}/views`);
        await announcementRef.transaction((currentViews) => {
            return (currentViews || 0) + 1;
        });

        return json({ success: true, alreadyViewed: false });
    } catch (error) {
        console.error('Track view error:', error);
        return json({ error: 'Failed to track view' }, { status: 500 });
    }
}
