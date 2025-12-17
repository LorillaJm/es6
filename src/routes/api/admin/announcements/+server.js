// src/routes/api/admin/announcements/+server.js
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, logAuditEvent, PERMISSIONS } from '$lib/server/adminAuth.js';
import { adminDb, sendFCMNotification } from '$lib/server/firebase-admin.js';

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
        
        if (!adminDb) return json({ announcements: [] });
        
        const scope = url.searchParams.get('scope');
        const status = url.searchParams.get('status');
        const category = url.searchParams.get('category');
        const priority = url.searchParams.get('priority');
        
        const snapshot = await adminDb.ref('announcements').orderByChild('createdAt').once('value');
        let announcements = [];
        
        if (snapshot.exists()) {
            snapshot.forEach(child => {
                const data = child.val();
                // Filter by scope if specified
                if (scope && data.scope !== scope) return;
                // Filter by status if specified
                if (status && data.status !== status) return;
                // Filter by category if specified
                if (category && data.category !== category) return;
                // Filter by priority if specified
                if (priority && data.priority !== priority) return;
                
                announcements.unshift({ id: child.key, ...data });
            });
        }
        
        // Check for scheduled announcements that should be published
        const now = new Date().toISOString();
        for (const ann of announcements) {
            if (ann.status === 'scheduled' && ann.scheduledAt && ann.scheduledAt <= now) {
                // Auto-publish scheduled announcement
                await adminDb.ref(`announcements/${ann.id}`).update({
                    status: 'published',
                    publishedAt: now
                });
                ann.status = 'published';
                ann.publishedAt = now;
                
                // Send notifications for newly published scheduled announcements
                // Real-time push to all users
                if (ann.sendPush) {
                    await sendPushNotifications(ann, ann.scope, ann.department, ann.id);
                }
                if (ann.sendEmail) {
                    await sendEmailNotifications(ann, ann.scope, ann.department);
                }
            }
            
            // Check for expired announcements
            if (ann.expiresAt && ann.expiresAt <= now && ann.status === 'published') {
                await adminDb.ref(`announcements/${ann.id}`).update({
                    status: 'archived'
                });
                ann.status = 'archived';
            }
        }
        
        return json({ 
            announcements,
            stats: {
                total: announcements.length,
                published: announcements.filter(a => a.status === 'published' || !a.status).length,
                scheduled: announcements.filter(a => a.status === 'scheduled').length,
                draft: announcements.filter(a => a.status === 'draft').length,
                archived: announcements.filter(a => a.status === 'archived').length,
                emergency: announcements.filter(a => a.priority === 'emergency').length,
                pinned: announcements.filter(a => a.pinned).length
            }
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
        
        if (!adminDb) return json({ error: 'Database not available' }, { status: 500 });
        
        const newRef = adminDb.ref('announcements').push();
        const now = new Date().toISOString();
        
        // Determine status
        let status = data.status || 'published';
        if (data.scheduledAt && status !== 'draft') {
            status = 'scheduled';
        }
        
        const announcement = {
            title: data.title,
            content: data.content,
            priority: data.priority || 'normal',
            category: data.category || 'general',
            scope: data.scope || 'all',
            targetAudience: data.targetAudience || [],
            department: data.department || null,
            imageUrl: data.imageUrl || null,
            attachments: data.attachments || [],
            expiresAt: data.expiresAt || null,
            scheduledAt: data.scheduledAt || null,
            sendPush: data.sendPush ?? true,
            sendEmail: data.sendEmail || false,
            pinned: data.pinned || false,
            requireAcknowledgment: data.requireAcknowledgment || false,
            locked: data.locked || false,
            visibility: data.visibility || 'public',
            status,
            publishedAt: status === 'published' ? now : null,
            views: 0,
            acknowledged: 0,
            createdBy: admin.id,
            createdByName: admin.name || 'Admin',
            createdAt: now,
            updatedAt: now
        };
        
        await newRef.set(announcement);
        
        // Send notifications if published immediately (not scheduled or draft)
        // This triggers real-time push notifications to all users instantly
        if (status === 'published') {
            if (data.sendPush) {
                await sendPushNotifications(announcement, data.scope, data.department, newRef.key);
            }
            if (data.sendEmail) {
                await sendEmailNotifications(announcement, data.scope, data.department);
            }
        }
        
        await logAuditEvent({
            action: 'ANNOUNCEMENT_CREATED',
            adminId: admin.id,
            targetId: newRef.key,
            details: { 
                title: data.title, 
                scope: data.scope, 
                priority: data.priority,
                category: data.category,
                status
            }
        });
        
        return json({ announcement: { id: newRef.key, ...announcement } });
    } catch (error) {
        console.error('Create announcement error:', error);
        return json({ error: 'Failed to create announcement' }, { status: 500 });
    }
}

// Helper function to send push notifications to all users in real-time
async function sendPushNotifications(announcement, scope, department, announcementId = null) {
    try {
        if (!adminDb) return;
        
        // Get users based on scope
        const usersSnapshot = await adminDb.ref('users').once('value');
        if (!usersSnapshot.exists()) return;
        
        const users = usersSnapshot.val();
        const notifications = [];
        const fcmPromises = [];
        const now = new Date().toISOString();
        
        // Determine notification type based on priority
        const isEmergency = scope === 'emergency' || announcement.priority === 'urgent';
        const notificationType = isEmergency ? 'emergency_alert' : 'announcement';
        
        for (const [userId, user] of Object.entries(users)) {
            // Filter by department if scope is department
            if (scope === 'department' && department && user.department !== department) continue;
            
            // Filter by target audience if specified
            if (announcement.targetAudience?.length > 0) {
                const userRole = user.role || 'student';
                if (!announcement.targetAudience.includes(userRole) && !announcement.targetAudience.includes('all')) {
                    continue;
                }
            }
            
            // Create notification for user - this triggers real-time push via Firebase listeners (in-app)
            const notifRef = adminDb.ref(`notifications/${userId}`).push();
            notifications.push(notifRef.set({
                type: notificationType,
                title: announcement.title,
                body: announcement.content?.substring(0, 150) || '',
                content: announcement.content,
                announcementId: announcementId || announcement.id,
                priority: announcement.priority,
                category: announcement.category,
                imageUrl: announcement.imageUrl || null,
                read: false,
                createdAt: now,
                // Additional metadata for rich notifications
                requireAcknowledgment: announcement.requireAcknowledgment || false,
                expiresAt: announcement.expiresAt || null
            }));
            
            // Send FCM push notification for background/closed app delivery
            fcmPromises.push(
                sendFCMNotification(userId, {
                    title: isEmergency ? `🚨 ${announcement.title}` : announcement.title,
                    body: announcement.content?.substring(0, 150) || 'New announcement',
                    data: {
                        type: notificationType,
                        url: '/app/announcements',
                        announcementId: announcementId || '',
                        priority: announcement.priority || 'normal'
                    }
                }).catch(err => console.warn(`FCM failed for ${userId}:`, err.message))
            );
        }
        
        await Promise.all([...notifications, ...fcmPromises]);
        console.log(`Push notifications sent to ${notifications.length} users for announcement: ${announcement.title}`);
    } catch (error) {
        console.error('Push notification error:', error);
    }
}

// Helper function to send email notifications
async function sendEmailNotifications(announcement, scope, department) {
    try {
        // Queue email job - implement based on your email service
        if (!adminDb) return;
        
        await adminDb.ref('emailQueue').push({
            type: 'announcement',
            announcementId: announcement.id,
            scope,
            department,
            subject: `${scope === 'emergency' ? '🚨 EMERGENCY: ' : ''}${announcement.title}`,
            content: announcement.content,
            priority: announcement.priority,
            createdAt: new Date().toISOString(),
            status: 'pending'
        });
    } catch (error) {
        console.error('Email notification error:', error);
    }
}
