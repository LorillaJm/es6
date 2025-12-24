// src/routes/api/gamification/leaderboard/+server.js
// Leaderboard API - Fetches from MongoDB (real users only, not seed data)
import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Gamification } from '$lib/server/mongodb/schemas/Gamification.js';
import { User } from '$lib/server/mongodb/schemas/User.js';

export async function GET({ url }) {
    try {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const orgId = url.searchParams.get('orgId');
        const userId = url.searchParams.get('userId'); // To get user's rank

        await connectMongoDB();

        // Seed data uses these email patterns - exclude them
        const seedEmailPatterns = [
            /@company\.com$/i,
            /^admin@/i,
            /^sarah@/i,
            /^mike@/i,
            /^emily@/i,
            /^david@/i,
            /^lisa@/i,
            /^tom@/i,
            /^anna@/i,
            /^chris@/i,
            /^jessica@/i
        ];

        // Get seed user firebaseUids to exclude
        const seedUsers = await User.find({
            $or: seedEmailPatterns.map(pattern => ({ email: { $regex: pattern } }))
        }).select('firebaseUid');
        
        const seedUserIds = seedUsers.map(u => u.firebaseUid).filter(Boolean);
        
        console.log('[Leaderboard] Excluding', seedUserIds.length, 'seed users');

        // Get gamification excluding seed users
        const query = {
            ...(orgId ? { orgId } : {}),
            ...(seedUserIds.length > 0 ? { firebaseUid: { $nin: seedUserIds } } : {})
        };

        let leaderboard = await Gamification.find(query)
            .sort({ totalPoints: -1 })
            .limit(limit)
            .populate('userId', 'name displayName profilePhoto department email');

        console.log('[Leaderboard] Found', leaderboard.length, 'gamification records (excluding seed)');

        // If no results, it means all data might be seed data or no gamification exists
        // In this case, show empty or the current user only
        if (leaderboard.length === 0 && userId) {
            const userGamification = await Gamification.findOne({ firebaseUid: userId })
                .populate('userId', 'name displayName profilePhoto department email');
            if (userGamification) {
                leaderboard = [userGamification];
            }
        }

        // Build leaderboard data
        const leaderboardData = await Promise.all(leaderboard.map(async (g, index) => {
            let userName = g.userId?.name || g.userId?.displayName;
            let profilePhoto = g.userId?.profilePhoto;
            let department = g.userId?.department || g.department;
            let email = g.userId?.email;

            // If populate didn't work, try to fetch user directly
            if (!userName && g.firebaseUid) {
                const user = await User.findOne({ firebaseUid: g.firebaseUid });
                if (user) {
                    userName = user.name || user.displayName || user.email?.split('@')[0];
                    profilePhoto = user.profilePhoto;
                    department = user.department;
                    email = user.email;
                }
            }

            return {
                id: g.firebaseUid,
                odId: g._id.toString(),
                name: userName || email?.split('@')[0] || 'User',
                profilePhoto,
                department,
                points: g.totalPoints || 0,
                currentStreak: g.currentStreak || 0,
                level: g.level || 1,
                levelName: g.levelName || 'Newcomer',
                badgeCount: g.badges?.length || 0,
                rank: index + 1
            };
        }));

        // Get user's rank if userId provided
        let userRank = null;
        if (userId) {
            const userGamification = await Gamification.findOne({ firebaseUid: userId });
            if (userGamification) {
                const higherCount = await Gamification.countDocuments({
                    ...query,
                    totalPoints: { $gt: userGamification.totalPoints || 0 }
                });
                userRank = higherCount + 1;
            }
        }

        console.log('[Leaderboard] Returning', leaderboardData.length, 'entries');

        return json({ 
            leaderboard: leaderboardData,
            userRank,
            source: 'mongodb'
        });
    } catch (error) {
        console.error('[Leaderboard API] Error:', error);
        return json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
    }
}
