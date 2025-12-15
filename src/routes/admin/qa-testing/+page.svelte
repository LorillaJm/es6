<script>
    // Phase 9.3 - QA Testing Admin Page
    import { onMount } from 'svelte';
    import { adminAuthStore } from '$lib/stores/adminAuth.js';
    import GlassPanel from '$lib/components/admin/GlassPanel.svelte';
    import TransitionWrapper from '$lib/components/admin/TransitionWrapper.svelte';
    import { 
        IconTestPipe, IconShieldCheck, IconDatabase, IconActivity,
        IconCheck, IconX, IconAlertTriangle, IconRefresh, IconChartBar,
        IconClock, IconServer, IconBug
    } from '@tabler/icons-svelte';

    let isLoading = false;
    let stressTestResults = null;
    let dataAccuracyResults = null;
    let securityResults = null;
    let cacheStats = null;
    let activeTest = null;

    async function runTest(testType) {
        isLoading = true;
        activeTest = testType;

        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch(`/api/admin/qa-testing?test=${testType}`, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });

            if (!response.ok) throw new Error('Test failed');
            const data = await response.json();

            switch (testType) {
                case 'stress':
                    stressTestResults = data;
                    break;
                case 'accuracy':
                    dataAccuracyResults = data;
                    break;
                case 'security':
                    securityResults = data;
                    break;
                case 'cache':
                    cacheStats = data;
                    break;
            }
        } catch (error) {
            console.error(`${testType} test failed:`, error);
        } finally {
            isLoading = false;
            activeTest = null;
        }
    }

    async function clearCache() {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch('/api/admin/qa-testing?action=clearCache', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            cacheStats = null;
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
    }

    function getStatusIcon(passed) {
        return passed ? IconCheck : IconX;
    }

    function getStatusColor(passed) {
        return passed ? 'var(--apple-green)' : 'var(--apple-red)';
    }
</script>

<svelte:head>
    <title>QA Testing | Admin Panel</title>
</svelte:head>

<div class="qa-testing-page">
    <TransitionWrapper type="fly" direction="up">
        <header class="page-header">
            <div class="header-content">
                <div class="header-icon">
                    <IconTestPipe size={28} stroke={1.5} />
                </div>
                <div>
                    <h1>QA Testing</h1>
                    <p>Admin panel stress tests, data accuracy, and security validation</p>
                </div>
            </div>
        </header>
    </TransitionWrapper>

    <div class="test-grid">
        <!-- Stress Test Card -->
        <TransitionWrapper type="stagger" index={0}>
            <GlassPanel variant="elevated" padding="lg">
                <div class="test-card">
                    <div class="test-header">
                        <div class="test-icon stress">
                            <IconActivity size={24} stroke={1.5} />
                        </div>
                        <div>
                            <h3>Stress Test</h3>
                            <p>Test admin panel under load</p>
                        </div>
                    </div>

                    <button 
                        class="run-btn"
                        on:click={() => runTest('stress')}
                        disabled={isLoading}
                    >
                        {#if activeTest === 'stress'}
                            <div class="spinner"></div>
                            Running...
                        {:else}
                            <IconRefresh size={18} stroke={2} />
                            Run Test
                        {/if}
                    </button>

                    {#if stressTestResults}
                        <div class="test-results">
                            <div class="result-status" class:passed={stressTestResults.passed}>
                                <svelte:component 
                                    this={getStatusIcon(stressTestResults.passed)} 
                                    size={20} 
                                    stroke={2} 
                                />
                                {stressTestResults.passed ? 'PASSED' : 'FAILED'}
                            </div>

                            <div class="result-metrics">
                                <div class="metric">
                                    <span class="metric-label">Duration</span>
                                    <span class="metric-value">{stressTestResults.duration}ms</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Req/sec</span>
                                    <span class="metric-value">{stressTestResults.requestsPerSecond?.toFixed(1)}</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Avg Response</span>
                                    <span class="metric-value">{stressTestResults.avgResponseTime?.toFixed(0)}ms</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Error Rate</span>
                                    <span class="metric-value" class:error={stressTestResults.errorRate > 0}>
                                        {stressTestResults.errorRate?.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </GlassPanel>
        </TransitionWrapper>

        <!-- Data Accuracy Card -->
        <TransitionWrapper type="stagger" index={1}>
            <GlassPanel variant="elevated" padding="lg">
                <div class="test-card">
                    <div class="test-header">
                        <div class="test-icon accuracy">
                            <IconDatabase size={24} stroke={1.5} />
                        </div>
                        <div>
                            <h3>Data Accuracy</h3>
                            <p>Verify data integrity</p>
                        </div>
                    </div>

                    <button 
                        class="run-btn"
                        on:click={() => runTest('accuracy')}
                        disabled={isLoading}
                    >
                        {#if activeTest === 'accuracy'}
                            <div class="spinner"></div>
                            Running...
                        {:else}
                            <IconRefresh size={18} stroke={2} />
                            Run Test
                        {/if}
                    </button>

                    {#if dataAccuracyResults}
                        <div class="test-results">
                            <div class="result-status" class:passed={dataAccuracyResults.passed}>
                                <svelte:component 
                                    this={getStatusIcon(dataAccuracyResults.passed)} 
                                    size={20} 
                                    stroke={2} 
                                />
                                {dataAccuracyResults.passedCount}/{dataAccuracyResults.passedCount + dataAccuracyResults.failedCount} Tests Passed
                            </div>

                            <div class="test-list">
                                {#each dataAccuracyResults.tests as test}
                                    <div class="test-item" class:passed={test.passed}>
                                        <svelte:component 
                                            this={getStatusIcon(test.passed)} 
                                            size={14} 
                                            stroke={2} 
                                        />
                                        <span class="test-name">{test.name}</span>
                                        <span class="test-detail">{test.details}</span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>
            </GlassPanel>
        </TransitionWrapper>

        <!-- Security Test Card -->
        <TransitionWrapper type="stagger" index={2}>
            <GlassPanel variant="elevated" padding="lg">
                <div class="test-card">
                    <div class="test-header">
                        <div class="test-icon security">
                            <IconShieldCheck size={24} stroke={1.5} />
                        </div>
                        <div>
                            <h3>Security Test</h3>
                            <p>Check for vulnerabilities</p>
                        </div>
                    </div>

                    <button 
                        class="run-btn"
                        on:click={() => runTest('security')}
                        disabled={isLoading}
                    >
                        {#if activeTest === 'security'}
                            <div class="spinner"></div>
                            Running...
                        {:else}
                            <IconRefresh size={18} stroke={2} />
                            Run Test
                        {/if}
                    </button>

                    {#if securityResults}
                        <div class="test-results">
                            <div class="result-status" class:passed={securityResults.passed}>
                                <svelte:component 
                                    this={getStatusIcon(securityResults.passed)} 
                                    size={20} 
                                    stroke={2} 
                                />
                                {securityResults.passed ? 'No Vulnerabilities' : `${securityResults.vulnerabilities.length} Issues Found`}
                            </div>

                            <div class="test-list">
                                {#each securityResults.tests as test}
                                    <div class="test-item" class:passed={test.passed}>
                                        <svelte:component 
                                            this={getStatusIcon(test.passed)} 
                                            size={14} 
                                            stroke={2} 
                                        />
                                        <span class="test-name">{test.name}</span>
                                        <span class="test-detail">{test.details}</span>
                                    </div>
                                {/each}
                            </div>

                            {#if securityResults.vulnerabilities.length > 0}
                                <div class="vulnerabilities">
                                    <h4>
                                        <IconAlertTriangle size={16} stroke={2} />
                                        Vulnerabilities
                                    </h4>
                                    {#each securityResults.vulnerabilities as vuln}
                                        <div class="vuln-item">{vuln}</div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>
            </GlassPanel>
        </TransitionWrapper>

        <!-- Cache Stats Card -->
        <TransitionWrapper type="stagger" index={3}>
            <GlassPanel variant="elevated" padding="lg">
                <div class="test-card">
                    <div class="test-header">
                        <div class="test-icon cache">
                            <IconServer size={24} stroke={1.5} />
                        </div>
                        <div>
                            <h3>Cache Stats</h3>
                            <p>Monitor cache performance</p>
                        </div>
                    </div>

                    <div class="btn-group">
                        <button 
                            class="run-btn"
                            on:click={() => runTest('cache')}
                            disabled={isLoading}
                        >
                            {#if activeTest === 'cache'}
                                <div class="spinner"></div>
                                Loading...
                            {:else}
                                <IconChartBar size={18} stroke={2} />
                                Get Stats
                            {/if}
                        </button>
                        <button 
                            class="clear-btn"
                            on:click={clearCache}
                            disabled={isLoading}
                        >
                            Clear Cache
                        </button>
                    </div>

                    {#if cacheStats}
                        <div class="test-results">
                            <div class="result-metrics cache-metrics">
                                <div class="metric">
                                    <span class="metric-label">Hit Rate</span>
                                    <span class="metric-value accent">{cacheStats.hitRate}</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Hits</span>
                                    <span class="metric-value">{cacheStats.hits}</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Misses</span>
                                    <span class="metric-value">{cacheStats.misses}</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Size</span>
                                    <span class="metric-value">{cacheStats.size} entries</span>
                                </div>
                                <div class="metric">
                                    <span class="metric-label">Memory</span>
                                    <span class="metric-value">{cacheStats.memoryUsage}</span>
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>
            </GlassPanel>
        </TransitionWrapper>
    </div>
</div>

<style>
    .qa-testing-page {
        padding: 24px;
        max-width: 1400px;
        margin: 0 auto;
    }

    .page-header {
        margin-bottom: 32px;
    }

    .header-content {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .header-icon {
        width: 56px;
        height: 56px;
        background: linear-gradient(135deg, var(--apple-accent), var(--apple-purple));
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .page-header h1 {
        font-size: 28px;
        font-weight: 700;
        color: var(--theme-text, var(--apple-black));
        margin: 0;
    }

    .page-header p {
        font-size: 14px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        margin: 4px 0 0;
    }

    .test-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 24px;
    }

    .test-card {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .test-header {
        display: flex;
        align-items: center;
        gap: 14px;
    }

    .test-icon {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .test-icon.stress {
        background: linear-gradient(135deg, #FF9500, #FF6B00);
    }

    .test-icon.accuracy {
        background: linear-gradient(135deg, #34C759, #28A745);
    }

    .test-icon.security {
        background: linear-gradient(135deg, #007AFF, #0056CC);
    }

    .test-icon.cache {
        background: linear-gradient(135deg, #AF52DE, #8B3FC7);
    }

    .test-header h3 {
        font-size: 18px;
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
        margin: 0;
    }

    .test-header p {
        font-size: 13px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        margin: 2px 0 0;
    }

    .btn-group {
        display: flex;
        gap: 10px;
    }

    .run-btn, .clear-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 20px;
        border: none;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .run-btn {
        background: var(--apple-accent);
        color: white;
        flex: 1;
    }

    .run-btn:hover:not(:disabled) {
        background: var(--apple-accent-hover);
        transform: translateY(-1px);
    }

    .run-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .clear-btn {
        background: var(--theme-border-light, var(--apple-gray-5));
        color: var(--apple-red);
    }

    .clear-btn:hover:not(:disabled) {
        background: rgba(255, 59, 48, 0.1);
    }

    .spinner {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .test-results {
        padding-top: 16px;
        border-top: 1px solid var(--theme-border-light, var(--apple-gray-5));
    }

    .result-status {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        background: rgba(255, 59, 48, 0.1);
        color: var(--apple-red);
        margin-bottom: 16px;
    }

    .result-status.passed {
        background: rgba(52, 199, 89, 0.1);
        color: var(--apple-green);
    }

    .result-metrics {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    .cache-metrics {
        grid-template-columns: repeat(3, 1fr);
    }

    .metric {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 12px;
        background: var(--theme-border-light, var(--apple-gray-6));
        border-radius: 10px;
    }

    .metric-label {
        font-size: 11px;
        font-weight: 500;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .metric-value {
        font-size: 18px;
        font-weight: 700;
        color: var(--theme-text, var(--apple-black));
    }

    .metric-value.error {
        color: var(--apple-red);
    }

    .metric-value.accent {
        color: var(--apple-accent);
    }

    .test-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .test-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        background: var(--theme-border-light, var(--apple-gray-6));
        border-radius: 8px;
        font-size: 13px;
        color: var(--apple-red);
    }

    .test-item.passed {
        color: var(--apple-green);
    }

    .test-name {
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
    }

    .test-detail {
        margin-left: auto;
        font-size: 12px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
    }

    .vulnerabilities {
        margin-top: 16px;
        padding: 14px;
        background: rgba(255, 59, 48, 0.08);
        border-radius: 10px;
        border: 1px solid rgba(255, 59, 48, 0.2);
    }

    .vulnerabilities h4 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: var(--apple-red);
        margin: 0 0 10px;
    }

    .vuln-item {
        font-size: 13px;
        color: var(--theme-text, var(--apple-black));
        padding: 6px 0;
        border-bottom: 1px solid rgba(255, 59, 48, 0.1);
    }

    .vuln-item:last-child {
        border-bottom: none;
    }

    @media (max-width: 1024px) {
        .test-grid {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 768px) {
        .qa-testing-page {
            padding: 16px;
        }

        .result-metrics, .cache-metrics {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 480px) {
        .header-content {
            flex-direction: column;
            text-align: center;
        }

        .btn-group {
            flex-direction: column;
        }

        .cache-metrics {
            grid-template-columns: 1fr;
        }
    }
</style>
