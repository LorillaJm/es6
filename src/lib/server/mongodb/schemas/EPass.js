// src/lib/server/mongodb/schemas/EPass.js
// E-Pass / Digital ID Schema - MongoDB Atlas (PRIMARY)

import mongoose from 'mongoose';

const verificationLogSchema = new mongoose.Schema({
    verifiedAt: {
        type: Date,
        default: Date.now
    },
    verifiedBy: String,
    verifierType: {
        type: String,
        enum: ['scanner', 'admin', 'system', 'api']
    },
    location: {
        latitude: Number,
        longitude: Number,
        address: String
    },
    scannerId: String,
    scannerName: String,
    result: {
        type: String,
        enum: ['valid', 'invalid', 'expired', 'revoked']
    },
    ipAddress: String
}, { _id: false });

const epassSchema = new mongoose.Schema({
    // User Reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
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
    
    // E-Pass Info
    passId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    passType: {
        type: String,
        enum: ['employee', 'visitor', 'contractor', 'temporary'],
        default: 'employee'
    },
    
    // User Info (denormalized for quick display)
    holderName: String,
    holderEmail: String,
    holderPhoto: String,
    department: String,
    position: String,
    employeeId: String,
    
    // QR Code
    qrCodeData: {
        type: String,
        required: true
    },
    qrCodeUrl: String,
    
    // Validity
    issuedAt: {
        type: Date,
        default: Date.now
    },
    validFrom: {
        type: Date,
        default: Date.now
    },
    validUntil: Date,
    
    // Status
    status: {
        type: String,
        enum: ['active', 'suspended', 'revoked', 'expired'],
        default: 'active',
        index: true
    },
    revokedAt: Date,
    revokedBy: String,
    revokeReason: String,
    
    // Access Control
    accessLevel: {
        type: String,
        enum: ['basic', 'standard', 'elevated', 'full'],
        default: 'standard'
    },
    allowedAreas: [String],
    restrictedAreas: [String],
    
    // Verification
    verificationCount: {
        type: Number,
        default: 0
    },
    lastVerifiedAt: Date,
    verificationLogs: [verificationLogSchema],
    
    // Security
    securityToken: String,
    tokenExpiresAt: Date,
    
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    },
    createdBy: String
}, {
    timestamps: true,
    collection: 'epasses'
});

// Indexes
epassSchema.index({ orgId: 1, status: 1 });
epassSchema.index({ validUntil: 1 }, { sparse: true });
epassSchema.index({ qrCodeData: 1 });

// Pre-save
epassSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Check expiration
    if (this.validUntil && new Date() > this.validUntil && this.status === 'active') {
        this.status = 'expired';
    }
    
    // Limit verification logs to last 100
    if (this.verificationLogs.length > 100) {
        this.verificationLogs = this.verificationLogs.slice(-100);
    }
    
    next();
});

// Methods
epassSchema.methods.isValid = function() {
    if (this.status !== 'active') return false;
    if (this.validUntil && new Date() > this.validUntil) return false;
    if (this.validFrom && new Date() < this.validFrom) return false;
    return true;
};

epassSchema.methods.verify = function(verificationData) {
    this.verificationCount += 1;
    this.lastVerifiedAt = new Date();
    this.verificationLogs.push({
        ...verificationData,
        verifiedAt: new Date(),
        result: this.isValid() ? 'valid' : 'invalid'
    });
    return this.isValid();
};

epassSchema.methods.revoke = function(revokedBy, reason) {
    this.status = 'revoked';
    this.revokedAt = new Date();
    this.revokedBy = revokedBy;
    this.revokeReason = reason;
    return this;
};

epassSchema.methods.toPublicJSON = function() {
    return {
        passId: this.passId,
        passType: this.passType,
        holderName: this.holderName,
        holderPhoto: this.holderPhoto,
        department: this.department,
        position: this.position,
        employeeId: this.employeeId,
        status: this.status,
        validFrom: this.validFrom,
        validUntil: this.validUntil,
        accessLevel: this.accessLevel,
        qrCodeUrl: this.qrCodeUrl
    };
};

// Statics
epassSchema.statics.findByPassId = function(passId) {
    return this.findOne({ passId, status: 'active' });
};

epassSchema.statics.findByFirebaseUid = function(uid) {
    return this.findOne({ firebaseUid: uid, status: 'active' });
};

epassSchema.statics.findByQRCode = function(qrCodeData) {
    return this.findOne({ qrCodeData });
};

epassSchema.statics.getActiveByOrg = function(orgId) {
    return this.find({ orgId, status: 'active' });
};

export const EPass = mongoose.models.EPass || mongoose.model('EPass', epassSchema);
export default EPass;
