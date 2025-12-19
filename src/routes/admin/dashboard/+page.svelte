<script>
    import { onMount, onDestroy } from "svelte";
    import { browser } from "$app/environment";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { NOTIFICATION_CATEGORIES } from "$lib/stores/adminDashboard.js";
    
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
</script>

<svelte:head>
    <title>Dashboard | Admin Panel</title>
</svelte:head>

<div class="dashboard-page classic">
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
                <SystemHealthMonitor health={systemHealth} />
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
    /* Dashboard Page - Classic Mode */
    .dashboard-page {
        padding: 24px;
        max-width: 1800px;
        margin: 0 auto;
        background: var(--theme-bg);
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
        grid-template-columns: 1fr 1fr 380px;
        gap: 24px;
        margin-top: 20px;
    }

    .col {
        display: flex;
        flex-direction: column;
        gap: 24px;
        min-width: 0;
    }

    .side-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 20px;
    }

    .side-row > :global(*) {
        min-width: 0;
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

    /* Card styling */
    .dashboard-page :global(.apple-card),
    .dashboard-page :global([class*="card"]) {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        border-radius: 16px;
    }

    /* Responsive */
    @media (max-width: 1400px) {
        .main-grid {
            grid-template-columns: 1fr 1fr;
        }

        .col-3 {
            grid-column: span 2;
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
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
            gap: 20px;
        }

        .col-3 {
            grid-column: span 1;
            grid-template-columns: 1fr;
        }

        .side-row {
            grid-column: span 1;
        }
    }

    @media (max-width: 900px) {
        .analytics-row {
            grid-template-columns: 1fr;
        }
    }

    @media (max-width: 768px) {
        .dashboard-page {
            padding: 16px;
        }

        .main-grid {
            gap: 16px;
            margin-top: 16px;
        }

        .col {
            gap: 16px;
        }

        .bottom-section {
            margin-top: 16px;
        }

        .side-row {
            grid-template-columns: 1fr;
            gap: 12px;
        }
    }

    @media (max-width: 480px) {
        .dashboard-page {
            padding: 12px;
        }

        .main-grid {
            gap: 12px;
            margin-top: 12px;
        }

        .col {
            gap: 12px;
        }

        .bottom-section {
            margin-top: 12px;
        }
    }
</style>
