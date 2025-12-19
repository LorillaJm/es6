<script>
    import { IconServer, IconDatabase, IconStack2, IconDevices, IconCheck, IconX, IconAlertTriangle, IconRefresh, IconBattery2 } from '@tabler/icons-svelte';
    import { createEventDispatcher } from 'svelte';

    export let health = {
        server: { status: 'online', responseTime: 45, uptime: null },
        database: { status: 'online', queryPerformance: 'good', responseTime: 0 },
        redis: { queueLength: 0, failedJobs: 0, delayedJobs: 0 },
        scanners: []
    };

    export let compact = false;

    const dispatch = createEventDispatcher();
    let isRefreshing = false;

    function getStatusColor(status) {
        switch (status) {
            case 'online': case 'good': case 'excellent': return 'green';
            case 'degraded': case 'slow': case 'maintenance': return 'orange';
            case 'offline': case 'error': return 'red';
            default: return 'gray';
        }
    }

    function getStatusIcon(status) {
        switch (status) {
            case 'online': case 'good': case 'excellent': return IconCheck;
            case 'degraded': case 'slow': case 'maintenance': return IconAlertTriangle;
            case 'offline': case 'error': return IconX;
            default: return IconAlertTriangle;
        }
    }

    function getBatteryColor(level) {
        if (level >= 50) return 'green';
        if (level >= 20) return 'orange';
        return 'red';
    }

    function formatUptime(seconds) {
        if (!seconds) return null;
        const days = Math.floor(seconds / 86400);
        const hours = Math.floor((seconds % 86400) / 3600);
        if (days > 0) return `${days}d ${hours}h`;
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) return `${hours}h ${minutes}m`;
        return `${minutes}m`;
    }

    function getPerformanceLabel(perf) {
        switch (perf) {
            case 'excellent': return 'Excellent';
            case 'good': return 'Good';
            case 'slow': return 'Slow';
            case 'degraded': return 'Degraded';
            case 'error': return 'Error';
            default: return perf;
        }
    }

    async function handleRefresh() {
        isRefreshing = true;
        dispatch('refresh');
        // Reset after animation
        setTimeout(() => { isRefreshing = false; }, 1000);
    }

    $: onlineScanners = health.scanners.filter(s => s.status === 'online').length;
    $: showScannerDetails = !compact && health.scanners.length > 0 && health.scanners.length <= 3;
    $: hasNoScanners = health.scanners.length === 0;
</script>

<div class="health-monitor" class:compact>
    <div class="monitor-header">
        <h3>
            <IconServer size={16} stroke={1.5} />
            System Health
        </h3>
        <button class="refresh-btn" class:refreshing={isRefreshing} on:click={handleRefresh} title="Refresh">
            <IconRefresh size={14} stroke={1.5} />
        </button>
    </div>

    <div class="health-grid">
        <!-- Server + Database Row -->
        <div class="health-row">
            <div class="health-item">
                <div class="item-icon {getStatusColor(health.server.status)}">
                    <IconServer size={14} stroke={1.5} />
                </div>
                <span class="item-label">API</span>
                <span class="item-value">
                    {health.server.responseTime}ms
                    {#if health.server.uptime}
                        <span class="sub uptime" title="Uptime">{formatUptime(health.server.uptime)}</span>
                    {/if}
                </span>
                <span class="status-dot {getStatusColor(health.server.status)}"></span>
            </div>
            <div class="health-item">
                <div class="item-icon {getStatusColor(health.database.status)}">
                    <IconDatabase size={14} stroke={1.5} />
                </div>
                <span class="item-label">DB</span>
                <span class="item-value perf-{health.database.queryPerformance}">
                    {getPerformanceLabel(health.database.queryPerformance)}
                    {#if health.database.responseTime}
                        <span class="sub">{health.database.responseTime}ms</span>
                    {/if}
                </span>
                <span class="status-dot {getStatusColor(health.database.status)}"></span>
            </div>
        </div>

        <!-- Redis + Scanners Row -->
        <div class="health-row">
            <div class="health-item">
                <div class="item-icon {health.redis.failedJobs > 0 ? 'orange' : 'green'}">
                    <IconStack2 size={14} stroke={1.5} />
                </div>
                <span class="item-label">Queue</span>
                <span class="item-value">{health.redis.queueLength}<span class="sub">q</span> {health.redis.failedJobs}<span class="sub fail">f</span></span>
            </div>
            <div class="health-item">
                <div class="item-icon {hasNoScanners ? 'gray' : 'purple'}">
                    <IconDevices size={14} stroke={1.5} />
                </div>
                <span class="item-label">Scanners</span>
                {#if hasNoScanners}
                    <span class="item-value no-data">Not configured</span>
                {:else}
                    <span class="item-value">{onlineScanners}/{health.scanners.length}</span>
                    <span class="status-dot {onlineScanners === health.scanners.length ? 'green' : onlineScanners > 0 ? 'orange' : 'red'}"></span>
                {/if}
            </div>
        </div>
    </div>

    <!-- Compact Scanner List -->
    {#if showScannerDetails}
        <div class="scanners-compact">
            {#each health.scanners.slice(0, 3) as scanner}
                <div class="scanner-row">
                    <span class="scanner-dot {scanner.status}"></span>
                    <span class="scanner-name">{scanner.name}</span>
                    {#if scanner.battery !== undefined}
                        <span class="scanner-bat {getBatteryColor(scanner.battery)}">{scanner.battery}%</span>
                    {/if}
                </div>
            {/each}
        </div>
    {/if}
</div>

<style>
    .health-monitor {
        background: var(--theme-card-bg, var(--apple-white));
        border-radius: var(--apple-radius-lg);
        box-shadow: var(--apple-shadow-sm);
        overflow: hidden;
    }

    .monitor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5));
    }

    .monitor-header h3 {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
        margin: 0;
    }

    .refresh-btn {
        width: 26px;
        height: 26px;
        border-radius: 50%;
        background: var(--theme-border-light, var(--apple-gray-6));
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .refresh-btn:hover {
        background: var(--apple-accent);
        color: white;
    }

    .refresh-btn.refreshing :global(svg) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .item-value .sub.uptime {
        color: var(--apple-green);
        margin-left: 4px;
    }

    .item-value.no-data {
        font-size: 10px;
        color: var(--theme-text-secondary);
        font-weight: 500;
    }

    .item-icon.gray {
        background: rgba(142, 142, 147, 0.1);
        color: var(--apple-gray-1);
    }

    .health-grid {
        padding: 10px 12px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .health-row {
        display: flex;
        gap: 8px;
    }

    .health-item {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 10px;
        background: var(--theme-border-light, var(--apple-gray-6));
        border-radius: var(--apple-radius-sm);
    }

    .item-icon {
        width: 26px;
        height: 26px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .item-icon.green {
        background: rgba(52, 199, 89, 0.1);
        color: var(--apple-green);
    }

    .item-icon.orange {
        background: rgba(255, 149, 0, 0.1);
        color: var(--apple-orange);
    }

    .item-icon.red {
        background: rgba(255, 59, 48, 0.1);
        color: var(--apple-red);
    }

    .item-icon.purple {
        background: rgba(175, 82, 222, 0.1);
        color: var(--apple-purple);
    }

    .item-label {
        font-size: 11px;
        font-weight: 500;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        min-width: 40px;
    }

    .item-value {
        flex: 1;
        font-size: 12px;
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
        text-align: right;
    }

    .item-value .sub {
        font-size: 9px;
        font-weight: 500;
        color: var(--theme-text-secondary);
        margin-left: 2px;
    }

    .item-value .sub.fail {
        color: var(--apple-red);
    }

    .item-value.perf-good { color: var(--apple-green); }
    .item-value.perf-slow { color: var(--apple-orange); }
    .item-value.perf-error { color: var(--apple-red); }

    .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .status-dot.green {
        background: var(--apple-green);
        box-shadow: 0 0 4px rgba(52, 199, 89, 0.5);
    }

    .status-dot.orange {
        background: var(--apple-orange);
    }

    .status-dot.red {
        background: var(--apple-red);
    }

    .scanners-compact {
        padding: 0 12px 10px;
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .scanner-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: var(--theme-border-light, var(--apple-gray-6));
        border-radius: 6px;
        font-size: 11px;
    }

    .scanner-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .scanner-dot.online {
        background: var(--apple-green);
        box-shadow: 0 0 4px rgba(52, 199, 89, 0.5);
    }

    .scanner-dot.offline {
        background: var(--apple-red);
    }

    .scanner-name {
        flex: 1;
        font-weight: 500;
        color: var(--theme-text, var(--apple-black));
    }

    .scanner-bat {
        font-weight: 600;
        font-size: 10px;
    }

    .scanner-bat.green { color: var(--apple-green); }
    .scanner-bat.orange { color: var(--apple-orange); }
    .scanner-bat.red { color: var(--apple-red); }

    /* Compact mode */
    .health-monitor.compact .monitor-header {
        padding: 8px 12px;
    }

    .health-monitor.compact .health-grid {
        padding: 8px 10px;
        gap: 6px;
    }

    .health-monitor.compact .health-row {
        gap: 6px;
    }

    .health-monitor.compact .health-item {
        padding: 6px 8px;
        gap: 6px;
    }

    .health-monitor.compact .item-icon {
        width: 22px;
        height: 22px;
    }

    @media (max-width: 768px) {
        .health-row {
            flex-direction: column;
            gap: 6px;
        }

        .health-item {
            padding: 8px 10px;
        }
    }

    @media (max-width: 480px) {
        .monitor-header {
            padding: 8px 12px;
        }

        .health-grid {
            padding: 8px 10px;
        }

        .item-label {
            font-size: 10px;
        }

        .item-value {
            font-size: 11px;
        }
    }
</style>
