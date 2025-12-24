// src/routes/api/announcements/view/+server.js
// ✅ MongoDB Atlas = PRIMARY DATABASE

import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Announcement } from '$lib/server/mongodb/schemas/Announcement.js';

export async function POST({ request }) {
    try {
        const data = await request.json();
        const { announcementId, odId } = data;

        if (!announcementId || !odId) {
            return json({ error: 'Missing announcementId or userId' }, { status: 400 });
        }

        await connectMongoDB();

        // Check if user has already viewed this announcement
        const announcement = await Announcement.findById(announcementId);

        if (!announcement) {
            return json({ error: 'Announcement not found' }, { status: 404 });
        }

        // Check if already acknowledged
        const alreadyViewed = announcement.acknowledgedBy?.some(
            a => a.odId === odId || a.userId === odId
        );

        if (alreadyViewed) {
            return json({ success: true, alreadyViewed: true });
        }

        // ✅ Update in MongoDB (PRIMARY)
        await Announcement.findByIdAndUpdate(announcementId, {
            $inc: { viewCount: 1 },
            $push: {
                acknowledgedBy: {
                    odId: odId,
                    odId: odId,
                    acknowledgedAt: new Date()
                }
            }
        });

        return json({ success: true, alreadyViewed: false });
    } catch (error) {
        console.error('Track view error:', error);
        return json({ error: 'Failed to track view' }, { status: 500 });
    }
}
