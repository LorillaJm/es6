// src/routes/api/admin/qa-testing/+server.js
// Phase 9.3 - QA Testing API Endpoint

import { json } from '@sveltejs/kit';
import { verifyAccessToken } from '$lib/server/adminAuth.js';
import { 
    runStressTest, 
    runDataAccuracyTests, 
    runSecurityTests,
    getCacheStats,
    clearAllCaches
} from '$lib/server/adminTestService.js';

/**
 * GET - Run QA tests
 */
export async function GET({ request, url }) {
    try {
        // Verify admin authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const admin = await verifyAccessToken(token);

        if (!admin) {
            return json({ error: 'Invalid token' }, { status: 401 });
        }

        // Only super_admin can run QA tests
        if (admin.role !== 'super_admin') {
            return json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const testType = url.searchParams.get('test');

        switch (testType) {
            case 'stress':
                const stressResults = await runStressTest({
                    concurrentRequests: 10,
                    totalRequests: 50,
                    timeout: 5000
                });
                return json(stressResults);

            case 'accuracy':
                const accuracyResults = await runDataAccuracyTests();
                return json(accuracyResults);

            case 'security':
                const securityResults = await runSecurityTests();
                return json(securityResults);

            case 'cache':
                const cacheStats = getCacheStats();
                return json(cacheStats);

            default:
                return json({ 
                    error: 'Invalid test type',
                    validTypes: ['stress', 'accuracy', 'security', 'cache']
                }, { status: 400 });
        }
    } catch (error) {
        console.error('QA Testing error:', error);
        return json({ error: 'Test execution failed' }, { status: 500 });
    }
}

/**
 * POST - Execute QA actions
 */
export async function POST({ request, url }) {
    try {
        // Verify admin authentication
        const authHeader = request.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.substring(7);
        const admin = await verifyAccessToken(token);

        if (!admin) {
            return json({ error: 'Invalid token' }, { status: 401 });
        }

        // Only super_admin can execute QA actions
        if (admin.role !== 'super_admin') {
            return json({ error: 'Insufficient permissions' }, { status: 403 });
        }

        const action = url.searchParams.get('action');

        switch (action) {
            case 'clearCache':
                const result = clearAllCaches();
                return json(result);

            default:
                return json({ 
                    error: 'Invalid action',
                    validActions: ['clearCache']
                }, { status: 400 });
        }
    } catch (error) {
        console.error('QA Action error:', error);
        return json({ error: 'Action execution failed' }, { status: 500 });
    }
}
