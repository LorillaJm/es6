// src/routes/api/gamification/+server.js
// Gamification API - Fetches data from MongoDB
import { json } from '@sveltejs/kit';
import { connectMongoDB } from '$lib/server/mongodb/connection.js';
import { Gamification } from '$lib/server/mongodb/schemas/Gamification.js';
import { User } from '$lib/server/mongodb/schemas/User.js';

export async function GET({ url }) {
    try {
        const firebaseUid = url.searchParams.get('userId');
        
        if (!firebaseUid) {
            return json({ error: 'userId is required' }, { status: 400 });
        }

        await connectMongoDB();

        // Get gamification data from MongoDB
        let gamification = await Gamification.findOne({ firebaseUid });

        if (!gamification) {
            // Try to create gamification record if user exists
            const user = await User.findOne({ firebaseUid });
            if (user) {
                gamification = new Gamification({
                    userId: user._id,
                    firebaseUid,
                    orgId: user.orgId || 'org_default',
                    department: user.department
                });
                await gamification.save();
            } else {
                // Return default data if no user found
                return json({
                    data: getDefaultGamificationData(),
                    source: 'default'
                });
            }
        }

        // Transform MongoDB data to match frontend expectations
        const data = {
            currentStreak: gamification.currentStreak || 0,
            longestStreak: gamification.longestStreak || 0,
            totalCheckIns: gamification.totalCheckIns || 0,
            earlyCheckIns: gamification.onTimeCount || 0,
            perfectWeeks: gamification.perfectWeeks || 0,
            perfectMonths: gamification.perfectMonths || 0,
            lateCount: gamification.lateCount || 0,
            badges: (gamification.badges || []).map(b => b.badgeId || b),
            lastCheckInDate: gamification.lastCheckInDate,
            points: gamification.totalPoints || 0,
            level: gamification.level || 1,
            levelName: gamification.levelName || 'Newcomer',
            experiencePoints: gamification.experiencePoints || 0,
            nextLevelXP: gamification.nextLevelXP || 100,
            punctualityRate: gamification.punctualityRate || 100,
            rank: gamification.rank,
            monthlyPoints: gamification.monthlyPoints || 0,
            weeklyPoints: gamification.weeklyPoints || 0
        };

        return json({ data, source: 'mongodb' });
    } catch (error) {
        console.error('[Gamification API] Error:', error);
        return json({ error: 'Failed to fetch gamification data' }, { status: 500 });
    }
}

function getDefaultGamificationData() {
    return {
        currentStreak: 0,
        longestStreak: 0,
        totalCheckIns: 0,
        earlyCheckIns: 0,
        perfectWeeks: 0,
        perfectMonths: 0,
        lateCount: 0,
        badges: [],
        lastCheckInDate: null,
        points: 0,
        level: 1,
        levelName: 'Newcomer',
        experiencePoints: 0,
        nextLevelXP: 100,
        punctualityRate: 100,
        rank: null,
        monthlyPoints: 0,
        weeklyPoints: 0
    };
}
