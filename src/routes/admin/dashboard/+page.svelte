<script>
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { dashboardPrefs, DASHBOARD_MODES, NOTIFICATION_CATEGORIES } from "$lib/stores/adminDashboard.js";
    
    // Components
    import DashboardWelcome from "$lib/components/admin/DashboardWelcome.svelte";
    import AttendanceStatsCards from "$lib/components/admin/AttendanceStatsCards.svelte";
    import LiveActivityFeed from "$lib/components/admin/LiveActivityFeed.svelte";
    import DepartmentInsights from "$lib/components/admin/DepartmentInsights.svelte";
    import MonthlyAnalytics from "$lib/components/admin/MonthlyAnalytics.svelte";
    import PendingItemsPanel from "$lib/components/admin/PendingItemsPanel.svelte";
    import QuickActionsLauncher from "$lib/components/admin/QuickActionsLauncher.svelte";
    import SystemHealthMonitor from "$lib/components/admin/SystemHealthMonitor.svelte";
    import SeasonalModePanel from "$lib/components/admin/SeasonalModePanel.svelte";
    import NotificationsHUD from "$lib/components/admin/NotificationsHUD.svelte";
    import AuditTrailSnapshot from "$lib/components/admin/AuditTrailSnapshot.svelte";
    import NotificationCenterPreview from "$lib/components/admin/NotificationCenterPreview.svelte";
    // DashboardModeSwitcher is now integrated into DashboardWelcome
    import AttendancePrediction from "$lib/components/admin/AttendancePrediction.svelte";
    import QuickActionModals from "$lib/components/admin/QuickActionModals.svelte";

    // State
    let isLoading = true;
    let refreshInterval;
    let error = null;

    // Dashboard Data
    let stats = {
        totalPresent: 0, yesterdayPresent: 0, totalAbsent: 0,
        excusedAbsent: 0, unexcusedAbsent: 0, lateArrivals: 0,
        avgLateArrivals: 0, activeScanners: 0, totalScanners: 0, liveCheckIns: 0
    };

    let liveActivities = [];
    let suspiciousAlerts = [];
    let departments = [];
    let hourlyData = [];
    let monthlyAnalytics = {
        totalDaysTracked: 0, avgDailyAttendance: 0,
        mostAbsentDay: '', bestAttendanceDay: '',
        dailyData: [], patterns: []
    };
    let pendingFeedback = [];
    let pendingRequests = [];
    let systemAlerts = [];
    let systemHealth = {
        server: { status: 'checking', responseTime: 0 },
        database: { status: 'checking', queryPerformance: 'checking' },
        redis: { queueLength: 0, failedJobs: 0, delayedJobs: 0 },
        scanners: []
    };
    let notifications = [];
    let auditLogs = [];
    let predictions = { tomorrowAttendance: 0, confidence: 0, insights: [] };

    let lastLogin = null;
    let systemUptime = '99.9%';
    let lastBackup = 'Checking...';
    let pendingApprovals = 0;
    let unreadSystem = 0;
    let unreadFeedback = 0;

    // Modal state
    let showQuickActionModal = false;
    let quickActionModalType = '';

    onMount(async () => {
        if (!browser) return;
        await loadDashboardData();
        refreshInterval = setInterval(loadDashboardData, 30000);
    });

    onDestroy(() => {
        if (refreshInterval) clearInterval(refreshInterval);
    });

    async function loadDashboardData() {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            if (!accessToken) { error = 'Not authenticated'; isLoading = false; return; }

            const response = await fetch('/api/admin/dashboard/stats', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (!response.ok) throw new Error('Failed to load dashboard data');
            const data = await response.json();
            
            if (data.stats) stats = { ...stats, ...data.stats };
            if (data.departments) departments = data.departments;
            if (data.hourlyData) hourlyData = data.hourlyData;
            if (data.liveActivities) liveActivities = data.liveActivities;
            if (data.monthlyAnalytics) monthlyAnalytics = data.monthlyAnalytics;
            if (data.pendingFeedback) { pendingFeedback = data.pendingFeedback; unreadFeedback = pendingFeedback.length; }
            if (data.pendingRequests) pendingRequests = data.pendingRequests;
            if (data.systemAlerts) { systemAlerts = data.systemAlerts; unreadSystem = systemAlerts.filter(a => !a.read).length; }
            if (data.systemHealth) systemHealth = data.systemHealth;
            if (data.auditLogs) auditLogs = data.auditLogs;
            if (data.predictions) predictions = data.predictions;
            if (data.admin) lastLogin = data.admin.lastLogin;

            pendingApprovals = pendingFeedback.length + pendingRequests.length;
            notifications = generateNotifications(systemAlerts, systemHealth);
            error = null;

            // Fetch latest backup info
            await loadBackupInfo();
        } catch (err) {
            console.error('Failed to load dashboard data:', err);
            error = err.message;
        } finally {
            isLoading = false;
        }
    }

    async function loadBackupInfo() {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/backup?action=latest', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.backup?.createdAt) {
                    const backupDate = new Date(data.backup.createdAt);
                    const now = new Date();
                    const diffHours = Math.floor((now - backupDate) / 3600000);
                    if (diffHours < 1) lastBackup = 'Just now';
                    else if (diffHours < 24) lastBackup = `${diffHours}h ago`;
                    else lastBackup = `${Math.floor(diffHours / 24)}d ago`;
                } else {
                    lastBackup = 'Never';
                }
            }
        } catch (err) {
            console.error('Failed to load backup info:', err);
            lastBackup = 'Unknown';
        }
    }

    function generateNotifications(alerts, health) {
        const notifs = [];
        alerts.forEach((alert, i) => {
            notifs.push({
                id: alert.id || i,
                category: alert.severity === 'critical' ? NOTIFICATION_CATEGORIES.CRITICAL : 
                         alert.severity === 'warning' ? NOTIFICATION_CATEGORIES.WARNING : NOTIFICATION_CATEGORIES.INFO,
                title: alert.title || 'System Alert',
                message: alert.message || '',
                timestamp: alert.timestamp || new Date(),
                read: alert.read || false
            });
        });
        if (health.scanners) {
            health.scanners.filter(s => s.status === 'offline').forEach((scanner, i) => {
                notifs.push({
                    id: `scanner-${i}`,
                    category: NOTIFICATION_CATEGORIES.WARNING,
                    title: 'Scanner Offline',
                    message: `${scanner.name} at ${scanner.location} is offline`,
                    timestamp: new Date(),
                    read: false
                });
            });
        }
        return notifs;
    }

    function handleQuickAction(event) {
        const { type, format } = event.detail;
        if (type === 'export') { handleExport(format); return; }
        quickActionModalType = type;
        showQuickActionModal = true;
    }

    async function handleModalSubmit(event) {
        const { type, data } = event.detail;
        const { accessToken } = adminAuthStore.getStoredTokens();
        const endpoints = { announcement: '/api/admin/announcements', addUser: '/api/admin/users', manualScan: '/api/admin/attendance' };
        if (endpoints[type]) {
            await fetch(endpoints[type], {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
                body: JSON.stringify(data)
            });
            await loadDashboardData();
        }
    }

    async function handleExport(format) {
        const { accessToken } = adminAuthStore.getStoredTokens();
        const response = await fetch(`/api/admin/reports?format=${format}&type=attendance&date=today`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `attendance-${new Date().toISOString().split('T')[0]}.${format}`;
            a.click();
        }
    }

    function handleNotificationAction(event) {
        notifications = notifications.filter(n => n.id !== event.detail.id);
    }

    $: viewMode = $dashboardPrefs.viewMode;
    $: isCompact = viewMode === DASHBOARD_MODES.COMPACT;
    $: isApple = viewMode === DASHBOARD_MODES.APPLE;
    $: isClassic = viewMode === DASHBOARD_MODES.CLASSIC;
</script>

<svelte:head>
    <title>Dashboard | Admin Panel</title>
</svelte:head>

<div class="dashboard-page" class:compact={isCompact} class:apple={isApple} class:classic={isClassic}>
    {#if isLoading}
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading dashboard...</p>
        </div>
    {:else if error}
        <div class="error-state">
            <p>Failed to load: {error}</p>
            <button on:click={loadDashboardData}>Retry</button>
        </div>
    {:else}
        <!-- Hero Welcome Section with integrated mode switcher -->
        <DashboardWelcome {lastLogin} {systemUptime} {lastBackup} {pendingApprovals} />

        <!-- Stats Cards -->
        <AttendanceStatsCards 
            totalPresent={stats.totalPresent}
            yesterdayPresent={stats.yesterdayPresent}
            totalAbsent={stats.totalAbsent}
            excusedAbsent={stats.excusedAbsent}
            unexcusedAbsent={stats.unexcusedAbsent}
            lateArrivals={stats.lateArrivals}
            avgLateArrivals={stats.avgLateArrivals}
            activeScanners={stats.activeScanners}
            totalScanners={stats.totalScanners}
            liveCheckIns={stats.liveCheckIns}
            compact={isCompact}
        />

        <!-- Main Grid - 3 Column Layout -->
        <div class="main-grid">
            <!-- Column 1: Department Insights -->
            <div class="col col-1">
                <DepartmentInsights {departments} {hourlyData} />
                <AuditTrailSnapshot {auditLogs} maxItems={4} />
            </div>

            <!-- Column 2: Analytics & AI Prediction -->
            <div class="col col-2">
                <QuickActionsLauncher on:action={handleQuickAction} />
                <div class="analytics-row">
                    <MonthlyAnalytics analytics={monthlyAnalytics} />
                    <AttendancePrediction {predictions} />
                </div>
                <PendingItemsPanel feedback={pendingFeedback} requests={pendingRequests} {systemAlerts} />
            </div>

            <!-- Column 3: System & Notifications -->
            <div class="col col-3">
                <SystemHealthMonitor health={systemHealth} compact={isCompact} />
                <NotificationsHUD {notifications} on:snooze={handleNotificationAction} on:dismiss={handleNotificationAction} on:resolve={handleNotificationAction} />
            </div>
        </div>

        <!-- Bottom Section: Live Activity Feed (Full Width) -->
        <div class="bottom-section">
            <LiveActivityFeed activities={liveActivities} {suspiciousAlerts} />
        </div>
    {/if}
</div>

<QuickActionModals 
    showModal={showQuickActionModal}
    modalType={quickActionModalType}
    on:close={() => showQuickActionModal = false}
    on:submit={handleModalSubmit}
/>

<style>
    /* ========================================
       BASE STYLES (Default - Classic Mode)
       ======================================== */
    .dashboard-page {
        padding: 20px;
        max-width: 1800px;
        margin: 0 auto;
    }

    .loading-state, .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 300px;
        gap: 12px;
        color: var(--theme-text-secondary);
    }

    .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--theme-border);
        border-top-color: var(--apple-accent);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .error-state button {
        padding: 8px 16px;
        background: var(--apple-accent);
        color: white;
        border: none;
        border-radius: 8px;
        cursor: pointer;
    }

    .main-grid {
        display: grid;
        grid-template-columns: 1fr 1fr 340px;
        gap: 20px;
        margin-top: 20px;
    }

    .col {
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-width: 0;
    }

    .side-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
    }

    /* Analytics Row - Monthly Analytics + AI Prediction side by side */
    .analytics-row {
        display: grid;
        grid-template-columns: 1.5fr 1fr;
        gap: 16px;
    }

    .analytics-row > :global(*) {
        min-width: 0;
    }

    /* Bottom Section - Full Width Live Activity */
    .bottom-section {
        margin-top: 20px;
    }

    /* Responsive for analytics-row and bottom-section */
    @media (max-width: 900px) {
        .analytics-row {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 768px) {
        .bottom-section {
            margin-top: 16px;
        }
    }

    @media (max-width: 480px) {
        .bottom-section {
            margin-top: 12px;
        }
    }

    .side-row > :global(*) {
        min-width: 0;
    }

    /* ========================================
       CLASSIC MODE - Traditional Dashboard
       Spacious, clear hierarchy, professional
       ======================================== */
    .dashboard-page.classic {
        padding: 24px;
        background: var(--theme-bg);
    }

    .dashboard-page.classic .main-grid {
        grid-template-columns: 1fr 1fr 380px;
        gap: 24px;
    }

    .dashboard-page.classic .col {
        gap: 24px;
    }

    .dashboard-page.classic .side-row {
        gap: 20px;
    }

    /* Classic mode cards get extra shadow and spacing */
    .dashboard-page.classic :global(.apple-card),
    .dashboard-page.classic :global([class*="card"]) {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        border-radius: 16px;
    }

    /* ========================================
       APPLE MODE - Premium, Minimal, Elegant
       Larger cards, more whitespace, refined
       ======================================== */
    .dashboard-page.apple {
        padding: 28px;
        background: linear-gradient(180deg, var(--theme-bg) 0%, rgba(245, 245, 247, 0.5) 100%);
    }

    .dashboard-page.apple .main-grid {
        grid-template-columns: 1.2fr 1fr 360px;
        gap: 28px;
    }

    .dashboard-page.apple .col {
        gap: 28px;
    }

    .dashboard-page.apple .side-row {
        gap: 20px;
    }

    /* Apple mode - premium card styling */
    .dashboard-page.apple :global(.apple-card),
    .dashboard-page.apple :global([class*="card"]) {
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
        border-radius: 20px;
        border: 1px solid rgba(255, 255, 255, 0.8);
    }

    .dashboard-page.apple :global(.apple-card:hover),
    .dashboard-page.apple :global([class*="card"]:hover) {
        transform: translateY(-4px);
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.1);
    }

    /* ========================================
       COMPACT MODE - Dense, Data-focused
       Smaller gaps, tighter layout, more info
       ======================================== */
    .dashboard-page.compact {
        padding: 12px;
        background: var(--theme-bg);
    }

    .dashboard-page.compact .main-grid {
        grid-template-columns: 1fr 1fr 1fr 300px;
        gap: 12px;
        margin-top: 12px;
    }

    .dashboard-page.compact .col {
        gap: 12px;
    }

    .dashboard-page.compact .side-row {
        gap: 10px;
    }

    /* Compact mode - tighter cards */
    .dashboard-page.compact :global(.apple-card),
    .dashboard-page.compact :global([class*="card"]) {
        padding: 14px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    }

    /* Compact mode - smaller text */
    .dashboard-page.compact :global(h2),
    .dashboard-page.compact :global(h3) {
        font-size: 14px;
    }

    .dashboard-page.compact :global(p),
    .dashboard-page.compact :global(span) {
        font-size: 12px;
    }

    /* ========================================
       RESPONSIVE - Classic Mode
       ======================================== */
    @media (max-width: 1400px) {
        .dashboard-page.classic .main-grid {
            grid-template-columns: 1fr 1fr;
        }

        .dashboard-page.classic .col-3 {
            grid-column: span 2;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
        }

        .dashboard-page.classic .side-row {
            grid-column: span 2;
        }
    }

    @media (max-width: 1024px) {
        .dashboard-page.classic .main-grid {
            grid-template-columns: 1fr;
            gap: 20px;
        }

        .dashboard-page.classic .col-3 {
            grid-column: span 1;
            grid-template-columns: 1fr;
        }

        .dashboard-page.classic .side-row {
            grid-column: span 1;
        }
    }

    @media (max-width: 768px) {
        .dashboard-page.classic {
            padding: 16px;
        }

        .dashboard-page.classic .main-grid {
            gap: 16px;
        }

        .dashboard-page.classic .col {
            gap: 16px;
        }
    }

    /* ========================================
       RESPONSIVE - Apple Mode
       ======================================== */
    @media (max-width: 1400px) {
        .dashboard-page.apple .main-grid {
            grid-template-columns: 1fr 1fr;
            gap: 24px;
        }

        .dashboard-page.apple .col-3 {
            grid-column: span 2;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
        }

        .dashboard-page.apple .side-row {
            grid-column: span 2;
        }
    }

    @media (max-width: 1024px) {
        .dashboard-page.apple .main-grid {
            grid-template-columns: 1fr;
            gap: 20px;
        }

        .dashboard-page.apple .col-3 {
            grid-column: span 1;
            grid-template-columns: 1fr;
        }

        .dashboard-page.apple .side-row {
            grid-column: span 1;
        }
    }

    @media (max-width: 768px) {
        .dashboard-page.apple {
            padding: 16px;
        }

        .dashboard-page.apple .main-grid {
            gap: 16px;
        }

        .dashboard-page.apple .col {
            gap: 16px;
        }
    }

    /* ========================================
       RESPONSIVE - Compact Mode
       ======================================== */
    @media (max-width: 1400px) {
        .dashboard-page.compact .main-grid {
            grid-template-columns: 1fr 1fr 1fr;
        }

        .dashboard-page.compact .col-3 {
            grid-column: span 3;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
        }

        .dashboard-page.compact .side-row {
            grid-column: span 3;
            grid-template-columns: repeat(3, 1fr);
        }
    }

    @media (max-width: 1100px) {
        .dashboard-page.compact .main-grid {
            grid-template-columns: 1fr 1fr;
        }

        .dashboard-page.compact .col-3 {
            grid-column: span 2;
            grid-template-columns: repeat(2, 1fr);
        }

        .dashboard-page.compact .side-row {
            grid-column: span 2;
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 768px) {
        .dashboard-page.compact {
            padding: 8px;
        }

        .dashboard-page.compact .main-grid {
            grid-template-columns: 1fr;
            gap: 10px;
        }

        .dashboard-page.compact .col-3 {
            grid-column: span 1;
            grid-template-columns: 1fr;
        }

        .dashboard-page.compact .side-row {
            grid-column: span 1;
            grid-template-columns: 1fr;
        }
    }

    /* ========================================
       DEFAULT RESPONSIVE (Fallback)
       ======================================== */
    @media (max-width: 1400px) {
        .main-grid {
            grid-template-columns: 1fr 1fr;
        }

        .col-3 {
            grid-column: span 2;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
        }

        .col-3 > :global(*) {
            min-width: 0;
        }

        .side-row {
            grid-column: span 2;
        }
    }

    @media (max-width: 1024px) {
        .main-grid {
            grid-template-columns: 1fr;
        }

        .col-3 {
            grid-column: span 1;
            grid-template-columns: 1fr;
        }

        .side-row {
            grid-column: span 1;
        }
    }

    @media (max-width: 768px) {
        .dashboard-page {
            padding: 12px;
        }

        .main-grid {
            gap: 12px;
            margin-top: 16px;
        }

        .col {
            gap: 12px;
        }

        .side-row {
            grid-template-columns: 1fr;
            gap: 10px;
        }
    }

    @media (max-width: 480px) {
        .dashboard-page {
            padding: 8px;
        }

        .main-grid {
            gap: 10px;
            margin-top: 12px;
        }

        .col {
            gap: 10px;
        }
    }
</style>
