// src/lib/server/mongodb/schemas/Announcement.js
// Announcement Schema - MongoDB Atlas (PRIMARY)
// ✅ All announcements stored in MongoDB

import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
    // Content
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    summary: String,
    
    // Type & Priority
    type: {
        type: String,
        enum: ['general', 'urgent', 'policy', 'event', 'maintenance', 'holiday'],
        default: 'general',
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal',
        index: true
    },
    
    // Organization & Targeting
    orgId: {
        type: String,
        required: true,
        index: true
    },
    targetAudience: {
        type: String,
        enum: ['all', 'admins', 'users', 'department'],
        default: 'all'
    },
    targetDepartments: [String],
    targetRoles: [String],
    
    // Author
    authorId: {
        type: String,
        required: true
    },
    authorName: String,
    authorEmail: String,
    
    // Scheduling
    publishAt: {
        type: Date,
        default: Date.now
    },
    expiresAt: Date,
    
    // Status
    status: {
        type: String,
        enum: ['draft', 'published', 'scheduled', 'archived'],
        default: 'published',
        index: true
    },
    
    // Engagement
    viewCount: {
        type: Number,
        default: 0
    },
    acknowledgedBy: [{
        odId: String,
        userId: String,
        acknowledgedAt: Date
    }],
    requiresAcknowledgment: {
        type: Boolean,
        default: false
    },
    
    // Attachments
    attachments: [{
        name: String,
        url: String,
        type: String,
        size: Number
    }],
    
    // Push Notification
    sendPushNotification: {
        type: Boolean,
        default: false
    },
    pushSentAt: Date,
    
    // Pinned
    isPinned: {
        type: Boolean,
        default: false
    },
    pinnedUntil: Date,
    
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'announcements'
});

// Indexes
announcementSchema.index({ orgId: 1, status: 1, publishAt: -1 });
announcementSchema.index({ orgId: 1, type: 1, status: 1 });
announcementSchema.index({ isPinned: 1, publishAt: -1 });
announcementSchema.index({ expiresAt: 1 }, { sparse: true });

// Note: timestamps:true handles createdAt and updatedAt automatically
// No pre-save hook needed - removed to avoid "next is not a function" error

// Methods
announcementSchema.methods.isExpired = function() {
    if (!this.expiresAt) return false;
    return new Date() > this.expiresAt;
};

announcementSchema.methods.isPublished = function() {
    return this.status === 'published' && new Date() >= this.publishAt;
};

announcementSchema.methods.toRealtimePayload = function() {
    return {
        id: this._id.toString(),
        title: this.title,
        summary: this.summary || this.content.substring(0, 100),
        type: this.type,
        priority: this.priority,
        authorName: this.authorName,
        publishAt: this.publishAt.toISOString(),
        isPinned: this.isPinned
    };
};

// Statics
announcementSchema.statics.findPublished = function(orgId, options = {}) {
    const now = new Date();
    const query = {
        orgId,
        status: 'published',
        publishAt: { $lte: now },
        $or: [
            { expiresAt: null },
            { expiresAt: { $gt: now } }
        ]
    };
    
    return this.find(query)
        .sort({ isPinned: -1, publishAt: -1 })
        .limit(options.limit || 20);
};

announcementSchema.statics.findUrgent = function(orgId) {
    const now = new Date();
    return this.find({
        orgId,
        status: 'published',
        priority: 'urgent',
        publishAt: { $lte: now },
        $or: [
            { expiresAt: null },
            { expiresAt: { $gt: now } }
        ]
    }).sort({ publishAt: -1 });
};

// Clear cached model if it exists (fixes hot-reload issues)
if (mongoose.models.Announcement) {
    delete mongoose.models.Announcement;
}

export const Announcement = mongoose.model('Announcement', announcementSchema);
export default Announcement;
