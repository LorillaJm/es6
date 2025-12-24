// src/lib/server/mongodb/schemas/Gamification.js
// Gamification Schema - MongoDB Atlas (PRIMARY)
// ✅ All gamification data stored in MongoDB
// ❌ Firebase only receives realtime leaderboard updates

import mongoose from 'mongoose';

const badgeSchema = new mongoose.Schema({
    badgeId: {
        type: String,
        required: true
    },
    name: String,
    description: String,
    icon: String,
    earnedAt: {
        type: Date,
        default: Date.now
    },
    category: {
        type: String,
        enum: ['attendance', 'streak', 'punctuality', 'milestone', 'special']
    }
}, { _id: false });

const achievementSchema = new mongoose.Schema({
    achievementId: String,
    name: String,
    description: String,
    progress: Number,
    target: Number,
    completedAt: Date,
    rewardPoints: Number
}, { _id: false });

const gamificationSchema = new mongoose.Schema({
    // User Reference
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    firebaseUid: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    
    // Organization
    orgId: {
        type: String,
        required: true,
        index: true
    },
    department: String,
    
    // Points
    totalPoints: {
        type: Number,
        default: 0,
        index: true
    },
    monthlyPoints: {
        type: Number,
        default: 0
    },
    weeklyPoints: {
        type: Number,
        default: 0
    },
    
    // Level
    level: {
        type: Number,
        default: 1
    },
    levelName: {
        type: String,
        default: 'Newcomer'
    },
    experiencePoints: {
        type: Number,
        default: 0
    },
    nextLevelXP: {
        type: Number,
        default: 100
    },
    
    // Streaks
    currentStreak: {
        type: Number,
        default: 0
    },
    longestStreak: {
        type: Number,
        default: 0
    },
    lastCheckInDate: Date,
    streakStartDate: Date,
    
    // Punctuality
    onTimeCount: {
        type: Number,
        default: 0
    },
    lateCount: {
        type: Number,
        default: 0
    },
    punctualityRate: {
        type: Number,
        default: 100
    },
    
    // Badges
    badges: [badgeSchema],
    
    // Achievements
    achievements: [achievementSchema],
    
    // Stats
    totalCheckIns: {
        type: Number,
        default: 0
    },
    perfectWeeks: {
        type: Number,
        default: 0
    },
    perfectMonths: {
        type: Number,
        default: 0
    },
    
    // Ranking
    rank: Number,
    previousRank: Number,
    rankChange: Number,
    
    // Point History (last 30 entries)
    pointHistory: [{
        points: Number,
        reason: String,
        timestamp: { type: Date, default: Date.now }
    }],
    
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
    collection: 'gamification'
});

// Indexes
gamificationSchema.index({ orgId: 1, totalPoints: -1 });
gamificationSchema.index({ orgId: 1, currentStreak: -1 });
gamificationSchema.index({ orgId: 1, department: 1, totalPoints: -1 });

// Pre-save - using function without next() for Mongoose 8+
gamificationSchema.pre('save', function() {
    // Clean up any malformed badges (string IDs instead of objects, or missing badgeId)
    if (this.badges && this.badges.length > 0) {
        this.badges = this.badges
            .map(badge => {
                // Handle string badges (from Firebase format)
                if (typeof badge === 'string') {
                    return {
                        badgeId: badge,
                        name: badge.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                        icon: '🏅',
                        earnedAt: new Date(),
                        category: 'milestone'
                    };
                }
                // Handle objects missing badgeId
                if (!badge.badgeId && badge.id) {
                    badge.badgeId = badge.id;
                }
                return badge;
            })
            .filter(badge => badge && badge.badgeId); // Remove any still-invalid badges
    }
    
    // Calculate punctuality rate
    const total = this.onTimeCount + this.lateCount;
    if (total > 0) {
        this.punctualityRate = Math.round((this.onTimeCount / total) * 100);
    }
    
    // Limit point history to last 30 entries
    if (this.pointHistory.length > 30) {
        this.pointHistory = this.pointHistory.slice(-30);
    }
    // timestamps: true handles updatedAt automatically
});

// Methods
gamificationSchema.methods.addPoints = function(points, reason) {
    this.totalPoints += points;
    this.monthlyPoints += points;
    this.weeklyPoints += points;
    this.experiencePoints += points;
    
    this.pointHistory.push({ points, reason });
    
    // Check for level up
    while (this.experiencePoints >= this.nextLevelXP) {
        this.experiencePoints -= this.nextLevelXP;
        this.level += 1;
        this.nextLevelXP = Math.floor(this.nextLevelXP * 1.5);
        this.levelName = this.getLevelName();
    }
    
    return this;
};

gamificationSchema.methods.getLevelName = function() {
    const levels = [
        'Newcomer', 'Regular', 'Dedicated', 'Committed', 'Star',
        'Champion', 'Legend', 'Master', 'Grandmaster', 'Elite'
    ];
    return levels[Math.min(this.level - 1, levels.length - 1)];
};

gamificationSchema.methods.updateStreak = function(checkInDate) {
    const today = new Date(checkInDate);
    today.setHours(0, 0, 0, 0);
    
    if (this.lastCheckInDate) {
        const lastDate = new Date(this.lastCheckInDate);
        lastDate.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
            // Consecutive day
            this.currentStreak += 1;
        } else if (diffDays > 1) {
            // Streak broken
            this.currentStreak = 1;
            this.streakStartDate = today;
        }
        // diffDays === 0 means same day, don't change streak
    } else {
        // First check-in
        this.currentStreak = 1;
        this.streakStartDate = today;
    }
    
    this.lastCheckInDate = today;
    
    if (this.currentStreak > this.longestStreak) {
        this.longestStreak = this.currentStreak;
    }
    
    return this;
};

gamificationSchema.methods.awardBadge = function(badge) {
    const exists = this.badges.some(b => b.badgeId === badge.badgeId);
    if (!exists) {
        this.badges.push({
            ...badge,
            earnedAt: new Date()
        });
        return true;
    }
    return false;
};

gamificationSchema.methods.toLeaderboardEntry = function() {
    return {
        id: this._id.toString(),
        odId: this._id.toString(),
        userId: this.firebaseUid,
        totalPoints: this.totalPoints,
        level: this.level,
        levelName: this.levelName,
        currentStreak: this.currentStreak,
        rank: this.rank,
        badgeCount: this.badges.length
    };
};

// Statics
gamificationSchema.statics.getLeaderboard = function(orgId, limit = 10) {
    return this.find({ orgId })
        .sort({ totalPoints: -1 })
        .limit(limit)
        .populate('userId', 'name profilePhoto');
};

gamificationSchema.statics.getDepartmentLeaderboard = function(orgId, department, limit = 10) {
    return this.find({ orgId, department })
        .sort({ totalPoints: -1 })
        .limit(limit);
};

gamificationSchema.statics.findByFirebaseUid = function(uid) {
    return this.findOne({ firebaseUid: uid });
};

gamificationSchema.statics.resetWeeklyPoints = async function(orgId) {
    return this.updateMany({ orgId }, { weeklyPoints: 0 });
};

gamificationSchema.statics.resetMonthlyPoints = async function(orgId) {
    return this.updateMany({ orgId }, { monthlyPoints: 0 });
};

// Clear cached model to pick up schema changes
if (mongoose.models.Gamification) {
    delete mongoose.models.Gamification;
}

export const Gamification = mongoose.model('Gamification', gamificationSchema);
export default Gamification;
