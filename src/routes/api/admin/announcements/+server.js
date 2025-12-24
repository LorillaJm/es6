// src/routes/api/admin/announcements/+server.js
// ✅ MongoDB Atlas = PRIMARY DATABASE
// ✅ Firebase = Realtime notifications only (AFTER MongoDB write succeeds)

import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, PERMISSIONS } from '$lib/server/adminAuth.js';
import { adminDb, sendFCMNotification } from '$lib/server/firebase-admin.js';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Announcement } from '$lib/server/mongodb/schemas/Announcement.js';
import { AuditLog } from '$lib/server/mongodb/schemas/AuditLog.js';
import { emitAnnouncement, emitNotification } from '$lib/server/realtimeEmitter.js';

export async function GET({ request, url }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_ANNOUNCEMENTS)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        // ✅ Connect to MongoDB
        await connectMongoDB();

        // Parse filters
        const status = url.searchParams.get('status');
        const type = url.searchParams.get('type') || url.searchParams.get('category');
        const priority = url.searchParams.get('priority');
        const limit = parseInt(url.searchParams.get('limit') || '50');

        // Build query
        const query = { orgId: admin.orgId || 'org_default' };
        if (status) query.status = status;
        if (type) query.type = type;
        if (priority) query.priority = priority;

        // ✅ Fetch from MongoDB (source of truth)
        const announcements = await Announcement.find(query)
            .sort({ isPinned: -1, createdAt: -1 })
            .limit(limit)
            .lean();

        // Check for scheduled announcements that should be published
        const now = new Date();
        for (const ann of announcements) {
            if (ann.status === 'scheduled' && ann.publishAt && new Date(ann.publishAt) <= now) {
                // Auto-publish
                await Announcement.findByIdAndUpdate(ann._id, {
                    status: 'published',
                    updatedAt: now
                });
                ann.status = 'published';

                // Emit to Firebase for realtime update
                await emitAnnouncement(ann.orgId, {
                    id: ann._id.toString(),
                    title: ann.title,
                    summary: ann.summary || ann.content?.substring(0, 100),
                    type: ann.type,
                    priority: ann.priority,
                    authorName: ann.authorName
                });
            }

            // Check for expired announcements
            if (ann.expiresAt && new Date(ann.expiresAt) <= now && ann.status === 'published') {
                await Announcement.findByIdAndUpdate(ann._id, {
                    status: 'archived',
                    updatedAt: now
                });
                ann.status = 'archived';
            }
        }

        // Calculate stats
        const allAnnouncements = await Announcement.find({ orgId: query.orgId }).lean();
        const stats = {
            total: allAnnouncements.length,
            published: allAnnouncements.filter(a => a.status === 'published').length,
            scheduled: allAnnouncements.filter(a => a.status === 'scheduled').length,
            draft: allAnnouncements.filter(a => a.status === 'draft').length,
            archived: allAnnouncements.filter(a => a.status === 'archived').length,
            urgent: allAnnouncements.filter(a => a.priority === 'urgent').length,
            pinned: allAnnouncements.filter(a => a.isPinned).length
        };

        return json({
            announcements: announcements.map(a => ({
                id: a._id.toString(),
                ...a,
                _id: undefined
            })),
            stats
        });
    } catch (error) {
        console.error('Get announcements error:', error);
        return json({ error: 'Failed to fetch announcements' }, { status: 500 });
    }
}

export async function POST({ request }) {
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

        if (!data.title || !data.content) {
            return json({ error: 'Title and content are required' }, { status: 400 });
        }

        // ✅ Connect to MongoDB
        await connectMongoDB();

        const now = new Date();

        // Determine status
        let status = data.status || 'published';
        if (data.scheduledAt && status !== 'draft') {
            status = 'scheduled';
        }

        // ✅ STEP 1: Save to MongoDB (PRIMARY)
        const announcement = new Announcement({
            title: data.title,
            content: data.content,
            summary: data.summary || data.content?.substring(0, 150),
            type: data.category || data.type || 'general',
            priority: data.priority || 'normal',
            orgId: admin.orgId || 'org_default',
            targetAudience: data.scope || 'all',
            targetDepartments: data.department ? [data.department] : [],
            authorId: admin.id,
            authorName: admin.name || 'Admin',
            authorEmail: admin.email,
            publishAt: status === 'scheduled' ? new Date(data.scheduledAt) : now,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            status,
            isPinned: data.pinned || false,
            requiresAcknowledgment: data.requireAcknowledgment || false,
            sendPushNotification: data.sendPush ?? true,
            attachments: data.attachments || []
        });

        await announcement.save();

        console.log(`[Announcements] ✅ MongoDB: Announcement saved - ${announcement._id}`);

        // ✅ Log audit event to MongoDB
        await AuditLog.logEvent({
            eventType: 'announcement.created',
            actorId: admin.id,
            actorType: 'admin',
            actorEmail: admin.email,
            actorName: admin.name,
            targetId: announcement._id.toString(),
            targetType: 'announcement',
            action: 'create',
            description: `Announcement created: ${data.title}`,
            newData: {
                title: data.title,
                type: announcement.type,
                priority: announcement.priority,
                status
            },
            orgId: announcement.orgId,
            status: 'success'
        });

        // ✅ STEP 2: ONLY IF MongoDB succeeded → Emit to Firebase & send notifications
        if (status === 'published') {
            // Emit to Firebase for realtime update
            await emitAnnouncement(announcement.orgId, {
                id: announcement._id.toString(),
                title: announcement.title,
                summary: announcement.summary,
                type: announcement.type,
                priority: announcement.priority,
                authorName: announcement.authorName
            });

            console.log(`[Announcements] ✅ Firebase: Realtime announcement emitted`);

            // Send push notifications
            if (data.sendPush !== false) {
                await sendPushNotifications(announcement, data.scope, data.department);
            }
        }

        return json({
            success: true,
            announcement: {
                id: announcement._id.toString(),
                title: announcement.title,
                content: announcement.content,
                type: announcement.type,
                priority: announcement.priority,
                status: announcement.status,
                authorName: announcement.authorName,
                createdAt: announcement.createdAt.toISOString()
            }
        });
    } catch (error) {
        console.error('Create announcement error:', error);
        return json({ error: 'Failed to create announcement' }, { status: 500 });
    }
}

// Helper function to send push notifications
async function sendPushNotifications(announcement, scope, department) {
    try {
        if (!adminDb) {
            console.warn('[Announcements] Firebase not available for push notifications');
            return;
        }

        // Get users from Firebase (for FCM tokens)
        const usersSnapshot = await adminDb.ref('users').once('value');
        if (!usersSnapshot.exists()) return;

        const users = usersSnapshot.val();
        const fcmPromises = [];
        let notificationCount = 0;

        const isUrgent = announcement.priority === 'urgent';

        for (const [userId, user] of Object.entries(users)) {
            // Filter by department if specified
            if (scope === 'department' && department && user.department !== department) continue;

            // Emit notification to Firebase (for in-app realtime)
            await emitNotification(userId, {
                title: announcement.title,
                message: announcement.summary || announcement.content?.substring(0, 150),
                type: isUrgent ? 'emergency_alert' : 'announcement',
                priority: announcement.priority
            });

            // Send FCM push notification
            fcmPromises.push(
                sendFCMNotification(userId, {
                    title: isUrgent ? `🚨 ${announcement.title}` : announcement.title,
                    body: announcement.summary || announcement.content?.substring(0, 150) || 'New announcement',
                    data: {
                        type: isUrgent ? 'emergency_alert' : 'announcement',
                        url: '/app/announcements',
                        announcementId: announcement._id.toString(),
                        priority: announcement.priority
                    }
                }).catch(err => console.warn(`FCM failed for ${userId}:`, err.message))
            );

            notificationCount++;
        }

        await Promise.all(fcmPromises);
        console.log(`[Announcements] ✅ Push notifications sent to ${notificationCount} users`);
    } catch (error) {
        console.error('[Announcements] Push notification error:', error);
        // Don't throw - MongoDB write already succeeded
    }
}
