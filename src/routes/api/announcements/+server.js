// src/routes/api/announcements/+server.js
// Public Announcements API - READ from MongoDB
// ✅ MongoDB Atlas = PRIMARY DATABASE

import { json } from '@sveltejs/kit';
import { adminAuth } from '$lib/server/firebase-admin.js';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Announcement } from '$lib/server/mongodb/schemas/Announcement.js';

export async function GET({ request, url }) {
    try {
        // Verify authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch (authError) {
            return json({ error: 'Invalid token' }, { status: 401 });
        }

        await connectMongoDB();

        // Parse query params
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const type = url.searchParams.get('type');
        const orgId = url.searchParams.get('orgId') || 'org_default';

        // ✅ Fetch published announcements from MongoDB
        const announcements = await Announcement.findPublished(orgId, { limit });

        // Filter by type if specified
        let filtered = announcements;
        if (type) {
            filtered = announcements.filter(a => a.type === type);
        }

        return json({
            success: true,
            announcements: filtered.map(a => ({
                id: a._id.toString(),
                title: a.title,
                content: a.content,
                summary: a.summary,
                type: a.type,
                priority: a.priority,
                authorName: a.authorName,
                publishAt: a.publishAt?.toISOString(),
                expiresAt: a.expiresAt?.toISOString(),
                isPinned: a.isPinned,
                viewCount: a.viewCount,
                requiresAcknowledgment: a.requiresAcknowledgment,
                attachments: a.attachments
            }))
        });
    } catch (error) {
        console.error('Get announcements error:', error);
        return json({ error: 'Failed to fetch announcements' }, { status: 500 });
    }
}
