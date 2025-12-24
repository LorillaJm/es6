// src/routes/api/admin/announcements/[id]/+server.js
// ✅ MongoDB Atlas = PRIMARY DATABASE

import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Announcement } from '$lib/server/mongodb/schemas/Announcement.js';
import { AuditLog } from '$lib/server/mongodb/schemas/AuditLog.js';
import { emitAnnouncement } from '$lib/server/realtimeEmitter.js';

export async function GET({ request, params }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_ANNOUNCEMENTS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        await connectMongoDB();

        const announcement = await Announcement.findById(params.id).lean();

        if (!announcement) {
            return json({ error: 'Announcement not found' }, { status: 404 });
        }

        return json({
            announcement: {
                id: announcement._id.toString(),
                ...announcement,
                _id: undefined
            }
        });
    } catch (error) {
        console.error('Get announcement error:', error);
        return json({ error: 'Failed to fetch announcement' }, { status: 500 });
    }
}

export async function PUT({ request, params }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_ANNOUNCEMENTS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        const data = await request.json();

        await connectMongoDB();

        // Get existing announcement
        const existing = await Announcement.findById(params.id);
        if (!existing) {
            return json({ error: 'Announcement not found' }, { status: 404 });
        }

        const previousData = existing.toObject();

        // ✅ Update in MongoDB (PRIMARY)
        const updateData = {
            ...(data.title && { title: data.title }),
            ...(data.content && { content: data.content }),
            ...(data.summary && { summary: data.summary }),
            ...(data.type && { type: data.type }),
            ...(data.category && { type: data.category }),
            ...(data.priority && { priority: data.priority }),
            ...(data.status && { status: data.status }),
            ...(data.isPinned !== undefined && { isPinned: data.isPinned }),
            ...(data.pinned !== undefined && { isPinned: data.pinned }),
            ...(data.expiresAt && { expiresAt: new Date(data.expiresAt) }),
            ...(data.scheduledAt && { publishAt: new Date(data.scheduledAt) }),
            updatedAt: new Date()
        };

        const updated = await Announcement.findByIdAndUpdate(
            params.id,
            updateData,
            { new: true }
        );

        console.log(`[Announcements] ✅ MongoDB: Announcement updated - ${params.id}`);

        // ✅ Log audit event
        await AuditLog.logEvent({
            eventType: 'announcement.updated',
            actorId: admin.id,
            actorType: 'admin',
            actorEmail: admin.email,
            targetId: params.id,
            targetType: 'announcement',
            action: 'update',
            description: `Announcement updated: ${updated.title}`,
            previousData: { title: previousData.title, status: previousData.status },
            newData: { title: updated.title, status: updated.status },
            changedFields: Object.keys(updateData),
            orgId: updated.orgId,
            status: 'success'
        });

        // ✅ Emit to Firebase if published
        if (updated.status === 'published') {
            await emitAnnouncement(updated.orgId, {
                id: updated._id.toString(),
                title: updated.title,
                summary: updated.summary,
                type: updated.type,
                priority: updated.priority,
                authorName: updated.authorName
            });
        }

        return json({
            success: true,
            announcement: {
                id: updated._id.toString(),
                title: updated.title,
                status: updated.status
            }
        });
    } catch (error) {
        console.error('Update announcement error:', error);
        return json({ error: 'Failed to update announcement' }, { status: 500 });
    }
}

export async function DELETE({ request, params }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_ANNOUNCEMENTS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        await connectMongoDB();

        // Get announcement before deleting
        const announcement = await Announcement.findById(params.id);
        if (!announcement) {
            return json({ error: 'Announcement not found' }, { status: 404 });
        }

        const previousData = announcement.toObject();

        // ✅ Delete from MongoDB (PRIMARY)
        await Announcement.findByIdAndDelete(params.id);

        console.log(`[Announcements] ✅ MongoDB: Announcement deleted - ${params.id}`);

        // ✅ Log audit event
        await AuditLog.logEvent({
            eventType: 'announcement.deleted',
            actorId: admin.id,
            actorType: 'admin',
            actorEmail: admin.email,
            targetId: params.id,
            targetType: 'announcement',
            action: 'delete',
            description: `Announcement deleted: ${previousData.title}`,
            previousData: {
                title: previousData.title,
                type: previousData.type,
                status: previousData.status
            },
            orgId: previousData.orgId,
            status: 'success',
            severity: 'medium'
        });

        return json({ success: true });
    } catch (error) {
        console.error('Delete announcement error:', error);
        return json({ error: 'Failed to delete announcement' }, { status: 500 });
    }
}
