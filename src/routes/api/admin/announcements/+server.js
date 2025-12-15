// src/routes/api/admin/announcements/+server.js
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, logAuditEvent, PERMISSIONS } from '$lib/server/adminAuth.js';
import { adminDb } from '$lib/server/firebase-admin.js';

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
                if (ann.sendPush) {
                    await sendPushNotifications(ann, ann.scope, ann.department);
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
        if (status === 'published') {
            if (data.sendPush) {
                await sendPushNotifications(announcement, data.scope, data.department);
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

// Helper function to send push notifications
async function sendPushNotifications(announcement, scope, department) {
    try {
        if (!adminDb) return;
        
        // Get users based on scope
        const usersSnapshot = await adminDb.ref('users').once('value');
        if (!usersSnapshot.exists()) return;
        
        const users = usersSnapshot.val();
        const notifications = [];
        
        for (const [userId, user] of Object.entries(users)) {
            // Filter by department if scope is department
            if (scope === 'department' && department && user.department !== department) continue;
            
            // Create notification for user
            const notifRef = adminDb.ref(`notifications/${userId}`).push();
            notifications.push(notifRef.set({
                type: scope === 'emergency' ? 'emergency_alert' : 'announcement',
                title: announcement.title,
                body: announcement.content.substring(0, 100),
                announcementId: announcement.id,
                priority: announcement.priority,
                read: false,
                createdAt: new Date().toISOString()
            }));
        }
        
        await Promise.all(notifications);
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
