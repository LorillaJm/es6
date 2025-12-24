// src/lib/server/mongodb/schemas/Feedback.js
// Feedback Schema - MongoDB Atlas (PRIMARY)

import mongoose from 'mongoose';

const feedbackSchema = new mongoose.Schema({
    // Submitter
    userId: {
        type: String,
        required: true,
        index: true
    },
    userEmail: String,
    userName: String,
    
    // Organization
    orgId: {
        type: String,
        index: true
    },
    
    // Feedback Content
    type: {
        type: String,
        enum: ['bug', 'feature', 'improvement', 'complaint', 'praise', 'question', 'other'],
        default: 'other',
        index: true
    },
    category: {
        type: String,
        enum: ['attendance', 'ui', 'performance', 'notifications', 'reports', 'admin', 'general'],
        default: 'general'
    },
    subject: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true
    },
    
    // Rating (optional)
    rating: {
        type: Number,
        min: 1,
        max: 5
    },
    
    // Attachments
    attachments: [{
        name: String,
        url: String,
        type: String
    }],
    
    // Device/Context Info
    deviceInfo: {
        platform: String,
        browser: String,
        screenSize: String,
        userAgent: String
    },
    pageUrl: String,
    
    // Status & Resolution
    status: {
        type: String,
        enum: ['new', 'in_review', 'in_progress', 'resolved', 'closed', 'wont_fix'],
        default: 'new',
        index: true
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    
    // Assignment
    assignedTo: String,
    assignedAt: Date,
    
    // Resolution
    resolution: String,
    resolvedAt: Date,
    resolvedBy: String,
    
    // Admin Notes
    adminNotes: [{
        note: String,
        addedBy: String,
        addedAt: { type: Date, default: Date.now }
    }],
    
    // Visibility
    isPublic: {
        type: Boolean,
        default: false
    },
    
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true,
    collection: 'feedback'
});

// Indexes
feedbackSchema.index({ orgId: 1, status: 1, createdAt: -1 });
feedbackSchema.index({ type: 1, status: 1 });
feedbackSchema.index({ assignedTo: 1, status: 1 });

// Pre-save
feedbackSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Statics
feedbackSchema.statics.findPending = function(orgId) {
    return this.find({
        orgId,
        status: { $in: ['new', 'in_review', 'in_progress'] }
    }).sort({ priority: -1, createdAt: 1 });
};

feedbackSchema.statics.getStats = async function(orgId) {
    return this.aggregate([
        { $match: { orgId } },
        {
            $group: {
                _id: '$status',
                count: { $sum: 1 }
            }
        }
    ]);
};

export const Feedback = mongoose.models.Feedback || mongoose.model('Feedback', feedbackSchema);
export default Feedback;
