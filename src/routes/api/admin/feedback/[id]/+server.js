// src/routes/api/admin/feedback/[id]/+server.js
import { json } from '@sveltejs/kit';
import { verifyAccessToken, checkPermission, logAuditEvent, PERMISSIONS } from '$lib/server/adminAuth.js';
import { adminDb } from '$lib/server/firebase-admin.js';

export async function PATCH({ request, params }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_FEEDBACK)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }
        
        const data = await request.json();
        const { status, reply, assignedTo, priority } = data;
        
        if (!adminDb) return json({ error: 'Database not available' }, { status: 500 });
        
        const feedbackId = params.id;
        const now = new Date().toISOString();
        const updates = { updatedAt: now };
        
        // Update status
        if (status) {
            updates.status = status;
            if (status === 'resolved') {
                updates.resolvedAt = now;
                updates.resolvedBy = admin.id;
            } else if (status === 'in_progress') {
                updates.inProgressAt = now;
            }
        }
        
        // Update priority
        if (priority) {
            updates.priority = priority;
        }
        
        // Assign to developer
        if (assignedTo !== undefined) {
            updates.assignedTo = assignedTo;
            updates.assignedAt = now;
            updates.assignedBy = admin.id;
            if (!updates.status) {
                updates.status = 'in_progress';
            }
        }
        
        // Get reference to feedback
        let feedbackRef;
        let existingData;
        
        if (feedbackId.includes('_')) {
            const [userId, actualId] = feedbackId.split('_');
            feedbackRef = adminDb.ref(`userFeedback/${userId}/${actualId}`);
            const snapshot = await feedbackRef.once('value');
            if (snapshot.exists()) {
                existingData = snapshot.val();
            } else {
                feedbackRef = adminDb.ref(`feedback/${feedbackId}`);
                const fallbackSnapshot = await feedbackRef.once('value');
                existingData = fallbackSnapshot.val();
            }
        } else {
            feedbackRef = adminDb.ref(`feedback/${feedbackId}`);
            const snapshot = await feedbackRef.once('value');
            existingData = snapshot.val();
        }
        
        // Add reply to replies array
        if (reply) {
            const replies = existingData?.replies || [];
            replies.push({
                id: `reply_${Date.now()}`,
                message: reply,
                adminId: admin.id,
                adminName: admin.name || admin.email,
                createdAt: now
            });
            updates.replies = replies;
            
            // Create notification for user
            if (existingData?.userId) {
                await adminDb.ref(`notifications/${existingData.userId}`).push({
                    type: 'feedback_reply',
                    title: 'New reply to your feedback',
                    body: reply.substring(0, 100),
                    feedbackId: feedbackId,
                    read: false,
                    createdAt: now
                });
            }
        }
        
        await feedbackRef.update(updates);
        
        await logAuditEvent({
            action: 'FEEDBACK_UPDATED',
            adminId: admin.id,
            targetId: feedbackId,
            details: { 
                status: status || null, 
                hasReply: !!reply, 
                assignedTo: assignedTo || null,
                priority: priority || null 
            }
        });
        
        return json({ success: true, updates });
    } catch (error) {
        console.error('Update feedback error:', error);
        return json({ error: 'Failed to update feedback', details: error.message }, { status: 500 });
    }
}

export async function GET({ request, params }) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const admin = await verifyAccessToken(authHeader.substring(7));
        if (!admin || !checkPermission(admin, PERMISSIONS.MANAGE_FEEDBACK)) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }
        
        if (!adminDb) return json({ error: 'Database not available' }, { status: 500 });
        
        const feedbackId = params.id;
        let feedback = null;
        
        // Handle compound ID format
        if (feedbackId.includes('_')) {
            const [userId, actualId] = feedbackId.split('_');
            const snapshot = await adminDb.ref(`userFeedback/${userId}/${actualId}`).once('value');
            if (snapshot.exists()) {
                feedback = { id: feedbackId, ...snapshot.val() };
            }
        }
        
        if (!feedback) {
            const snapshot = await adminDb.ref(`feedback/${feedbackId}`).once('value');
            if (snapshot.exists()) {
                feedback = { id: feedbackId, ...snapshot.val() };
            }
        }
        
        if (!feedback) {
            return json({ error: 'Feedback not found' }, { status: 404 });
        }
        
        return json({ feedback });
    } catch (error) {
        console.error('Get feedback error:', error);
        return json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }
}
