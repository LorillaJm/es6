// src/lib/server/mongodb/schemas/AdminToken.js
// Admin Token Schema - MongoDB Atlas (PRIMARY)
// ✅ All admin tokens stored in MongoDB
// ❌ Firebase NEVER stores tokens

import mongoose from 'mongoose';
import crypto from 'crypto';

const adminTokenSchema = new mongoose.Schema({
    // Token value (hashed for security)
    tokenHash: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Token type
    type: {
        type: String,
        enum: ['access', 'refresh', 'mfa_session', 'email_verification', 'password_reset'],
        required: true,
        index: true
    },
    
    // Associated admin
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true,
        index: true
    },
    
    // Expiration
    expiresAt: {
        type: Date,
        required: true,
        index: true
    },
    
    // Usage tracking
    usedAt: Date,
    usedCount: {
        type: Number,
        default: 0
    },
    
    // Device/Session info
    deviceInfo: {
        userAgent: String,
        ipAddress: String,
        platform: String,
        browser: String
    },
    
    // Status
    isRevoked: {
        type: Boolean,
        default: false,
        index: true
    },
    revokedAt: Date,
    revokedReason: String,
    
    // Metadata
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false,
    collection: 'admin_tokens'
});

// Compound indexes
adminTokenSchema.index({ adminId: 1, type: 1 });
adminTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// Static: Hash token for storage
adminTokenSchema.statics.hashToken = function(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
};

// Static: Generate and store token
adminTokenSchema.statics.createToken = async function(adminId, type, expiresInMs, deviceInfo = {}) {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    
    const tokenDoc = new this({
        tokenHash,
        type,
        adminId,
        expiresAt: new Date(Date.now() + expiresInMs),
        deviceInfo
    });
    
    await tokenDoc.save();
    
    return {
        token,
        tokenId: tokenDoc._id,
        expiresAt: tokenDoc.expiresAt
    };
};

// Static: Verify token
adminTokenSchema.statics.verifyToken = async function(token, type) {
    const tokenHash = this.hashToken(token);
    
    const tokenDoc = await this.findOne({
        tokenHash,
        type,
        isRevoked: false,
        expiresAt: { $gt: new Date() }
    }).populate('adminId');
    
    if (!tokenDoc) return null;
    
    // Update usage
    tokenDoc.usedAt = new Date();
    tokenDoc.usedCount += 1;
    await tokenDoc.save();
    
    return tokenDoc;
};

// Static: Revoke token
adminTokenSchema.statics.revokeToken = async function(token, reason = 'manual') {
    const tokenHash = this.hashToken(token);
    
    return this.updateOne(
        { tokenHash },
        { 
            isRevoked: true, 
            revokedAt: new Date(),
            revokedReason: reason
        }
    );
};

// Static: Revoke all tokens for admin
adminTokenSchema.statics.revokeAllForAdmin = async function(adminId, type = null, reason = 'logout_all') {
    const query = { adminId, isRevoked: false };
    if (type) query.type = type;
    
    return this.updateMany(query, {
        isRevoked: true,
        revokedAt: new Date(),
        revokedReason: reason
    });
};

// Static: Clean expired tokens (for manual cleanup if needed)
adminTokenSchema.statics.cleanExpired = async function() {
    return this.deleteMany({
        expiresAt: { $lt: new Date() }
    });
};

// Instance: Check if valid
adminTokenSchema.methods.isValid = function() {
    return !this.isRevoked && this.expiresAt > new Date();
};

// Clear cached model
if (mongoose.models.AdminToken) {
    delete mongoose.models.AdminToken;
}

export const AdminToken = mongoose.model('AdminToken', adminTokenSchema);
export default AdminToken;
