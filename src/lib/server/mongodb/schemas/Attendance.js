// src/lib/server/mongodb/schemas/Attendance.js
// Attendance Schema - MongoDB Atlas (PRIMARY)
// ✅ All attendance records stored in MongoDB
// ❌ Firebase only receives realtime status updates AFTER MongoDB write succeeds

import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
    latitude: Number,
    longitude: Number,
    accuracy: Number,
    address: String,
    name: String,  // Location name from reverse geocoding
    validated: Boolean,
    zone: String,
    withinGeofence: Boolean,
    geofenceId: String
}, { _id: false });

const checkEventSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        required: true
    },
    location: locationSchema,
    deviceId: String,
    deviceInfo: {
        platform: String,
        browser: String,
        userAgent: String
    },
    method: {
        type: String,
        enum: ['qr', 'face', 'manual', 'auto', 'api'],
        default: 'manual'
    },
    verificationData: {
        qrCode: String,
        faceMatchScore: Number,
        adminId: String,
        reason: String
    },
    ipAddress: String,
    photo: String // Base64 or URL for face verification
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
    // User Reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    firebaseUid: {
        type: String,
        required: true,
        index: true
    },
    
    // Organization
    orgId: {
        type: String,
        required: true,
        index: true
    },
    department: {
        type: String,
        index: true
    },
    
    // Date (for easy querying)
    date: {
        type: Date,
        required: true,
        index: true
    },
    dateString: {
        type: String, // YYYY-MM-DD format
        required: true,
        index: true
    },
    
    // Shift Info
    shiftNumber: {
        type: Number,
        default: 1
    },
    
    // Check In/Out Events
    checkIn: checkEventSchema,
    checkOut: checkEventSchema,
    
    // Breaks
    breaks: [{
        startTime: Date,
        endTime: Date,
        duration: Number, // minutes
        type: { type: String, enum: ['lunch', 'short', 'other'] }
    }],
    
    // Status
    currentStatus: {
        type: String,
        enum: ['checkedIn', 'onBreak', 'checkedOut', 'absent', 'leave', 'holiday'],
        default: 'checkedIn',
        index: true
    },
    
    // Time Calculations
    scheduledStart: Date,
    scheduledEnd: Date,
    actualWorkMinutes: Number,
    breakMinutes: Number,
    overtimeMinutes: Number,
    
    // Attendance Quality
    isLate: {
        type: Boolean,
        default: false,
        index: true
    },
    lateMinutes: Number,
    isEarlyOut: {
        type: Boolean,
        default: false
    },
    earlyOutMinutes: Number,
    
    // Flags
    isManualEntry: {
        type: Boolean,
        default: false
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    editHistory: [{
        editedAt: Date,
        editedBy: String,
        field: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
        reason: String
    }],
    
    // Notes
    notes: String,
    adminNotes: String,
    
    // Verification Status
    verificationStatus: {
        type: String,
        enum: ['pending', 'verified', 'flagged', 'rejected'],
        default: 'verified'
    },
    flagReason: String,
    
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
    collection: 'attendance'
});

// Compound indexes for common queries
attendanceSchema.index({ userId: 1, dateString: 1 });
attendanceSchema.index({ userId: 1, date: -1 });
attendanceSchema.index({ orgId: 1, dateString: 1 });
attendanceSchema.index({ orgId: 1, department: 1, dateString: 1 });
attendanceSchema.index({ firebaseUid: 1, dateString: 1 }, { unique: true, sparse: true });
attendanceSchema.index({ currentStatus: 1, dateString: 1 });
attendanceSchema.index({ isLate: 1, dateString: 1 });

// Pre-save middleware - using function without next() for Mongoose 8+
attendanceSchema.pre('save', function() {
    // Calculate work minutes if both check in and out exist
    if (this.checkIn?.timestamp && this.checkOut?.timestamp) {
        const workMs = this.checkOut.timestamp - this.checkIn.timestamp;
        this.actualWorkMinutes = Math.round(workMs / 60000) - (this.breakMinutes || 0);
    }
    // timestamps: true handles updatedAt automatically
});

// Instance methods
attendanceSchema.methods.calculateDuration = function() {
    if (!this.checkIn?.timestamp) return 0;
    
    const endTime = this.checkOut?.timestamp || new Date();
    const durationMs = endTime - this.checkIn.timestamp;
    return Math.round(durationMs / 60000); // Return minutes
};

attendanceSchema.methods.toRealtimePayload = function() {
    // Minimal payload for Firebase realtime updates
    return {
        mongoId: this._id.toString(),
        odId: this._id.toString(),
        userId: this.firebaseUid,
        status: this.currentStatus,
        checkInTime: this.checkIn?.timestamp?.toISOString(),
        checkOutTime: this.checkOut?.timestamp?.toISOString(),
        isLate: this.isLate,
        updatedAt: this.updatedAt.toISOString()
    };
};

// Static methods
attendanceSchema.statics.findTodayByUser = function(firebaseUid) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return this.findOne({
        firebaseUid,
        date: { $gte: today, $lt: tomorrow }
    }).sort({ shiftNumber: -1 });
};

attendanceSchema.statics.findByDateRange = function(firebaseUid, startDate, endDate) {
    return this.find({
        firebaseUid,
        date: { $gte: startDate, $lte: endDate }
    }).sort({ date: -1 });
};

attendanceSchema.statics.getOrgDailyStats = async function(orgId, dateString) {
    return this.aggregate([
        { $match: { orgId, dateString } },
        {
            $group: {
                _id: '$currentStatus',
                count: { $sum: 1 }
            }
        }
    ]);
};

// Clear cached model to pick up schema changes
if (mongoose.models.Attendance) {
    delete mongoose.models.Attendance;
}

export const Attendance = mongoose.model('Attendance', attendanceSchema);
export default Attendance;
