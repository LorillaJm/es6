// src/routes/api/announcements/view/+server.js
// ✅ MongoDB Atlas = PRIMARY DATABASE

import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Announcement } from '$lib/server/mongodb/schemas/Announcement.js';

export async function POST({ request }) {
    try {
        const data = await request.json();
        // Accept both userId and odId for compatibility
        const { announcementId, userId, odId } = data;
        const viewerId = userId || odId;

        if (!announcementId || !viewerId) {
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
            a => a.odId === viewerId || a.userId === viewerId
        );

        if (alreadyViewed) {
            return json({ success: true, alreadyViewed: true, viewCount: announcement.viewCount });
        }

        // ✅ Update in MongoDB (PRIMARY)
        const updated = await Announcement.findByIdAndUpdate(
            announcementId, 
            {
                $inc: { viewCount: 1 },
                $push: {
                    acknowledgedBy: {
                        odId: viewerId,
                        userId: viewerId,
                        acknowledgedAt: new Date()
                    }
                }
            },
            { new: true }
        );

        console.log(`[Announcements] View tracked for ${announcementId} by ${viewerId}, total: ${updated.viewCount}`);

        return json({ success: true, alreadyViewed: false, viewCount: updated.viewCount });
    } catch (error) {
        console.error('Track view error:', error);
        return json({ error: 'Failed to track view' }, { status: 500 });
    }
}
