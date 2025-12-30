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
import { sendEmail, sendBulkEmails } from '$lib/server/emailService.js';

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
                title: a.title,
                content: a.content,
                summary: a.summary,
                category: a.type,
                type: a.type,
                priority: a.priority,
                status: a.status,
                scope: a.targetAudience,
                targetAudience: a.targetAudience,
                department: a.targetDepartments?.[0] || '',
                authorName: a.authorName,
                authorEmail: a.authorEmail,
                publishedAt: a.publishAt?.toISOString(),
                scheduledAt: a.publishAt?.toISOString(),
                expiresAt: a.expiresAt?.toISOString(),
                pinned: a.isPinned,
                isPinned: a.isPinned,
                locked: a.isLocked,
                requireAcknowledgment: a.requiresAcknowledgment,
                views: a.viewCount || 0,
                viewCount: a.viewCount || 0,
                acknowledged: a.acknowledgedBy?.length || 0,
                sendPush: a.sendPushNotification,
                sendEmail: a.sendEmailNotification || false,
                pushSentAt: a.pushSentAt?.toISOString(),
                pushSentCount: a.pushSentCount || 0,
                emailSentAt: a.emailSentAt?.toISOString(),
                emailSentCount: a.emailSentCount || 0,
                attachments: a.attachments || [],
                createdAt: a.createdAt?.toISOString(),
                updatedAt: a.updatedAt?.toISOString()
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
            sendPushNotification: data.sendPush !== false,  // Default true
            sendEmailNotification: data.sendEmail === true,  // Default false
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
        let pushResult = { sent: 0 };
        let emailResult = { sent: 0 };
        
        if (status === 'published') {
            // Emit to Firebase for realtime update (fast, do first)
            await emitAnnouncement(announcement.orgId, {
                id: announcement._id.toString(),
                title: announcement.title,
                summary: announcement.summary,
                type: announcement.type,
                priority: announcement.priority,
                authorName: announcement.authorName
            });

            console.log(`[Announcements] ✅ Firebase: Realtime announcement emitted`);

            // ✅ Run push and email notifications IN PARALLEL (not sequentially)
            const notificationPromises = [];
            
            // Queue push notifications if enabled
            if (data.sendPush !== false) {
                notificationPromises.push(
                    sendPushNotifications(announcement, data.scope, data.department)
                        .then(result => {
                            pushResult = result;
                            console.log(`[Announcements] Push result:`, pushResult);
                            if (result.sent > 0) {
                                return Announcement.findByIdAndUpdate(announcement._id, {
                                    pushSentAt: new Date(),
                                    pushSentCount: result.sent
                                });
                            }
                        })
                        .catch(err => {
                            console.error('[Announcements] Push notification error:', err);
                            pushResult = { sent: 0, error: err.message };
                        })
                );
            } else {
                console.log(`[Announcements] Push notifications disabled for this announcement`);
            }
            
            // Queue email notifications if enabled
            if (data.sendEmail === true) {
                notificationPromises.push(
                    sendEmailNotifications(announcement, data.scope, data.department)
                        .then(result => {
                            emailResult = result;
                            console.log(`[Announcements] Email result:`, emailResult);
                            if (result.sent > 0) {
                                return Announcement.findByIdAndUpdate(announcement._id, {
                                    emailSentAt: new Date(),
                                    emailSentCount: result.sent
                                });
                            }
                        })
                        .catch(err => {
                            console.error('[Announcements] Email notification error:', err);
                            emailResult = { sent: 0, error: err.message };
                        })
                );
            }
            
            // Wait for all notifications to complete in parallel
            if (notificationPromises.length > 0) {
                await Promise.all(notificationPromises);
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
                createdAt: announcement.createdAt.toISOString(),
                sendPush: data.sendPush !== false,
                sendEmail: data.sendEmail === true
            },
            notifications: {
                push: pushResult,
                email: emailResult
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
            return { sent: 0, error: 'Firebase not available' };
        }

        // Get users from Firebase (for FCM tokens)
        const usersSnapshot = await adminDb.ref('users').once('value');
        if (!usersSnapshot.exists()) {
            console.warn('[Announcements] No users found in Firebase');
            return { sent: 0, error: 'No users found' };
        }

        const users = usersSnapshot.val();
        const fcmPromises = [];
        let notificationCount = 0;

        const isUrgent = announcement.priority === 'urgent' || announcement.priority === 'emergency';
        const announcementId = announcement._id?.toString() || announcement.id;

        console.log(`[Announcements] Sending notifications for announcement ${announcementId}, scope: ${scope}, urgent: ${isUrgent}`);

        for (const [userId, user] of Object.entries(users)) {
            // Filter by scope
            if (scope === 'students' && user.role !== 'student') continue;
            if (scope === 'faculty' && user.role !== 'faculty') continue;
            if (scope === 'staff' && user.role !== 'staff') continue;
            if (scope === 'department' && department && user.department !== department) continue;

            // Emit notification to Firebase (for in-app realtime)
            await emitNotification(userId, {
                title: announcement.title,
                message: announcement.summary || announcement.content?.substring(0, 150),
                type: isUrgent ? 'emergency_alert' : 'announcement',
                priority: announcement.priority,
                announcementId: announcementId,
                url: '/app/announcements'
            });

            // Send FCM push notification
            fcmPromises.push(
                sendFCMNotification(userId, {
                    title: isUrgent ? `🚨 ${announcement.title}` : announcement.title,
                    body: announcement.summary || announcement.content?.substring(0, 150) || 'New announcement',
                    data: {
                        type: isUrgent ? 'emergency_alert' : 'announcement',
                        url: '/app/announcements',
                        announcementId: announcementId,
                        priority: announcement.priority,
                        soundType: isUrgent ? 'urgent' : 'default'
                    }
                }).catch(err => {
                    console.warn(`[Announcements] FCM failed for ${userId}:`, err.message);
                    return { success: false, error: err.message };
                })
            );

            notificationCount++;
        }

        const results = await Promise.all(fcmPromises);
        const successCount = results.filter(r => r?.success).length;

        console.log(`[Announcements] ✅ Push notifications: ${successCount}/${notificationCount} sent successfully`);
        return { sent: successCount, total: notificationCount };
    } catch (error) {
        console.error('[Announcements] Push notification error:', error);
        // Don't throw - MongoDB write already succeeded
        return { sent: 0, error: error.message };
    }
}

// Helper function to send email notifications to verified users only
async function sendEmailNotifications(announcement, scope, department) {
    console.log(`[Announcements] Starting email notifications...`);
    
    try {
        if (!adminDb) {
            console.warn('[Announcements] Firebase not available for email notifications');
            return { sent: 0, error: 'Firebase not available' };
        }

        // Get users from Firebase
        const usersSnapshot = await adminDb.ref('users').once('value');
        if (!usersSnapshot.exists()) {
            console.warn('[Announcements] No users found in Firebase');
            return { sent: 0, error: 'No users found' };
        }

        const users = usersSnapshot.val();
        const emailsToSend = [];
        let skippedUnverified = 0;
        let skippedNoEmail = 0;
        let skippedScope = 0;

        const isUrgent = announcement.priority === 'urgent' || announcement.priority === 'emergency';

        // Build list of emails to send
        for (const [userId, user] of Object.entries(users)) {
            if (!user.email) { skippedNoEmail++; continue; }
            if (!user.emailVerified) { skippedUnverified++; continue; }
            
            // Filter by scope
            if (scope === 'students' && user.role !== 'student') { skippedScope++; continue; }
            if (scope === 'faculty' && user.role !== 'faculty') { skippedScope++; continue; }
            if (scope === 'staff' && user.role !== 'staff') { skippedScope++; continue; }
            if (scope === 'department' && department && user.department !== department) { skippedScope++; continue; }

            const userName = user.name || user.displayName || 'User';
            const emailContent = generateAnnouncementEmailHTML(announcement, userName, isUrgent);
            
            emailsToSend.push({
                to: user.email,
                subject: isUrgent ? `🚨 URGENT: ${announcement.title}` : `📢 ${announcement.title}`,
                html: emailContent
            });
        }

        console.log(`[Announcements] Email stats: ${emailsToSend.length} to send, ${skippedUnverified} unverified, ${skippedNoEmail} no email, ${skippedScope} filtered`);

        if (emailsToSend.length === 0) {
            return { sent: 0, total: 0, skippedUnverified, skippedNoEmail, skippedScope };
        }

        // Use bulk email sending for better performance
        const result = await sendBulkEmails(emailsToSend);
        
        console.log(`[Announcements] ✅ Emails: ${result.sent}/${emailsToSend.length} sent`);
        return { sent: result.sent, total: emailsToSend.length, skippedUnverified, skippedNoEmail, skippedScope };
    } catch (error) {
        console.error('[Announcements] Email notification error:', error);
        return { sent: 0, error: error.message };
    }
}

// Generate announcement email HTML
function generateAnnouncementEmailHTML(announcement, userName, isUrgent) {
    const priorityColors = {
        low: '#8E8E93',
        normal: '#007AFF',
        high: '#FF9500',
        urgent: '#FF3B30',
        emergency: '#FF3B30'
    };

    const priorityLabels = {
        low: 'Low Priority',
        normal: 'Announcement',
        high: 'Important',
        urgent: '🚨 Urgent',
        emergency: '🔴 Emergency'
    };

    const priorityColor = priorityColors[announcement.priority] || '#007AFF';
    const priorityLabel = priorityLabels[announcement.priority] || 'Announcement';

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f7;">
    <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
            <div style="background: linear-gradient(135deg, ${priorityColor} 0%, ${isUrgent ? '#C41E3A' : '#5856D6'} 100%); padding: 32px; text-align: center;">
                <span style="font-size: 28px;">${isUrgent ? '🚨' : '📢'}</span>
                <div style="display: inline-block; padding: 4px 12px; background: rgba(255,255,255,0.2); border-radius: 12px; color: white; font-size: 12px; font-weight: 600; margin: 12px 0;">
                    ${priorityLabel}
                </div>
                <h1 style="margin: 0; color: white; font-size: 22px; font-weight: 600;">${announcement.title}</h1>
            </div>
            <div style="padding: 32px;">
                <p style="margin: 0 0 20px; color: #1d1d1f; font-size: 15px;">Hi <strong>${userName}</strong>,</p>
                <div style="background: #f5f5f7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                    <p style="margin: 0; color: #1d1d1f; font-size: 15px; line-height: 1.7; white-space: pre-wrap;">${announcement.content || announcement.summary || ''}</p>
                </div>
                <div style="color: #86868b; font-size: 13px; margin-bottom: 24px;">
                    📅 ${new Date(announcement.publishAt || announcement.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} · 👤 ${announcement.authorName || 'Admin'}
                </div>
                <div style="text-align: center;">
                    <a href="${process.env.PUBLIC_APP_URL || 'https://your-app.vercel.app'}/app/announcements" style="display: inline-block; padding: 14px 32px; background: ${priorityColor}; color: white; text-decoration: none; border-radius: 12px; font-weight: 600;">View Full Announcement</a>
                </div>
            </div>
            <div style="background: #f5f5f7; padding: 20px 32px; text-align: center;">
                <p style="margin: 0; color: #86868b; font-size: 12px;">You received this because you're subscribed to announcements.</p>
            </div>
        </div>
    </div>
</body>
</html>`;
}
