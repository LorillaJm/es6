<script>
    import { onMount } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { 
        IconDevices, IconLoader2, IconLogout, IconRefresh, IconSearch,
        IconDeviceDesktop, IconDeviceMobile, IconBrandChrome, IconBrandFirefox,
        IconBrandSafari, IconBrandEdge, IconWorld, IconUser, IconClock
    } from "@tabler/icons-svelte";

    let sessions = [];
    let stats = null;
    let isLoading = true;
    let searchQuery = '';
    let selectedUserId = null;

    onMount(async () => {
        await Promise.all([loadSessions(), loadStats()]);
    });

    async function loadSessions() {
        isLoading = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const url = selectedUserId 
                ? `/api/admin/sessions?userId=${selectedUserId}`
                : '/api/admin/sessions';
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                sessions = data.sessions || [];
            }
        } catch (error) {
            console.error('Failed to load sessions:', error);
        } finally {
            isLoading = false;
        }
    }

    async function loadStats() {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/sessions?action=stats', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                stats = data.stats;
            }
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    async function forceLogout(userId, sessionId) {
        if (!confirm('Force logout this session?')) return;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch('/api/admin/sessions', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'forceLogout', userId, sessionId })
            });
            await loadSessions();
            await loadStats();
        } catch (error) {
            console.error('Failed to force logout:', error);
        }
    }

    async function forceLogoutAll(userId) {
        if (!confirm('Force logout ALL sessions for this user?')) return;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch('/api/admin/sessions', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'forceLogoutAll', userId })
            });
            await loadSessions();
            await loadStats();
        } catch (error) {
            console.error('Failed to force logout all:', error);
        }
    }

    function getBrowserIcon(browser) {
        const name = browser?.name?.toLowerCase() || '';
        if (name.includes('chrome')) return IconBrandChrome;
        if (name.includes('firefox')) return IconBrandFirefox;
        if (name.includes('safari')) return IconBrandSafari;
        if (name.includes('edge')) return IconBrandEdge;
        return IconWorld;
    }

    function formatTime(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return date.toLocaleDateString();
    }

    $: filteredSessions = sessions.filter(s => 
        !searchQuery || 
        s.userId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.deviceInfo?.browser?.name?.toLowerCase().includes(searchQuery.toLowerCase())
    );
</script>

<svelte:head>
    <title>Session Control | Admin Panel</title>
</svelte:head>

<div class="sessions-page">
    <header class="page-header">
        <div class="header-content">
            <h1>Session Control</h1>
            <p class="header-subtitle">Monitor and manage active user sessions</p>
        </div>
        <button class="apple-btn-secondary" on:click={() => { loadSessions(); loadStats(); }}>
            <IconRefresh size={18} stroke={2} /> Refresh
        </button>
    </header>

    {#if stats}
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-icon"><IconDevices size={24} stroke={1.5} /></div>
                <div class="stat-info">
                    <span class="stat-value">{stats.totalActive}</span>
                    <span class="stat-label">Active Sessions</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><IconDeviceDesktop size={24} stroke={1.5} /></div>
                <div class="stat-info">
                    <span class="stat-value">{stats.byDevice?.desktop || 0}</span>
                    <span class="stat-label">Desktop</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon"><IconDeviceMobile size={24} stroke={1.5} /></div>
                <div class="stat-info">
                    <span class="stat-value">{stats.byDevice?.mobile || 0}</span>
                    <span class="stat-label">Mobile</span>
                </div>
            </div>
        </div>
    {/if}

    <div class="toolbar">
        <div class="search-box">
            <IconSearch size={18} stroke={1.5} />
            <input type="text" placeholder="Search by user or browser..." bind:value={searchQuery} />
        </div>
    </div>

    <div class="sessions-container apple-card">
        {#if isLoading}
            <div class="loading-state">
                <IconLoader2 size={32} stroke={1.5} class="spin" />
                <p>Loading sessions...</p>
            </div>
        {:else if filteredSessions.length === 0}
            <div class="empty-state">
                <IconDevices size={48} stroke={1.5} />
                <p>No active sessions found</p>
            </div>
        {:else}
            <div class="sessions-list">
                {#each filteredSessions as session}
                    <div class="session-item">
                        <div class="session-device">
                            <div class="device-icon" class:mobile={session.deviceInfo?.isMobile}>
                                {#if session.deviceInfo?.isMobile}
                                    <IconDeviceMobile size={20} stroke={1.5} />
                                {:else}
                                    <IconDeviceDesktop size={20} stroke={1.5} />
                                {/if}
                            </div>
                            <div class="browser-icon">
                                <svelte:component this={getBrowserIcon(session.deviceInfo?.browser)} size={14} stroke={1.5} />
                            </div>
                        </div>
                        <div class="session-info">
                            <div class="session-header">
                                <span class="user-id">
                                    <IconUser size={12} stroke={1.5} />
                                    {session.userId?.substring(0, 12)}...
                                </span>
                                <span class="session-status active">Active</span>
                            </div>
                            <div class="session-details">
                                <span>{session.deviceInfo?.browser?.name || 'Unknown'} {session.deviceInfo?.browser?.version || ''}</span>
                                <span class="separator">•</span>
                                <span>{session.deviceInfo?.platform || 'Unknown'}</span>
                                <span class="separator">•</span>
                                <span>{session.deviceInfo?.screenResolution || ''}</span>
                            </div>
                            <div class="session-meta">
                                <span class="meta-item">
                                    <IconClock size={11} stroke={1.5} />
                                    Last active: {formatTime(session.lastActivity)}
                                </span>
                            </div>
                        </div>
                        <div class="session-actions">
                            <button class="action-btn danger" title="Force Logout" on:click={() => forceLogout(session.userId, session.sessionId)}>
                                <IconLogout size={16} stroke={1.5} />
                            </button>
                            <button class="action-btn danger-outline" title="Logout All Sessions" on:click={() => forceLogoutAll(session.userId)}>
                                Logout All
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .sessions-page { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h1 { font-size: 32px; font-weight: 700; color: var(--theme-text, var(--apple-black)); margin-bottom: 4px; }
    .header-subtitle { font-size: 15px; color: var(--theme-text-secondary, var(--apple-gray-1)); }

    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .stat-card { display: flex; align-items: center; gap: 14px; padding: 20px; background: var(--theme-card-bg, var(--apple-white)); border-radius: var(--apple-radius-lg); box-shadow: var(--apple-shadow-sm); }
    .stat-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); display: flex; align-items: center; justify-content: center; }
    .stat-value { font-size: 28px; font-weight: 700; color: var(--theme-text, var(--apple-black)); display: block; }
    .stat-label { font-size: 13px; color: var(--theme-text-secondary, var(--apple-gray-1)); }

    .toolbar { margin-bottom: 20px; }
    .search-box { display: flex; align-items: center; gap: 10px; background: var(--theme-card-bg, var(--apple-white)); border: 1px solid var(--theme-border, var(--apple-gray-4)); border-radius: var(--apple-radius-md); padding: 10px 14px; max-width: 400px; }
    .search-box input { border: none; background: none; outline: none; flex: 1; font-size: 14px; color: var(--theme-text, var(--apple-black)); }

    .sessions-container { padding: 0; overflow: hidden; }
    .loading-state, .empty-state { text-align: center; padding: 60px 20px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .loading-state p, .empty-state p { margin-top: 12px; font-size: 14px; }

    .sessions-list { display: flex; flex-direction: column; }
    .session-item { display: flex; align-items: center; gap: 16px; padding: 16px 20px; border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5)); }
    .session-item:last-child { border-bottom: none; }
    .session-item:hover { background: var(--theme-border-light, var(--apple-gray-6)); }

    .session-device { position: relative; }
    .device-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--theme-border-light, var(--apple-gray-6)); display: flex; align-items: center; justify-content: center; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .device-icon.mobile { background: rgba(52, 199, 89, 0.1); color: var(--apple-green); }
    .browser-icon { position: absolute; bottom: -4px; right: -4px; width: 20px; height: 20px; border-radius: 50%; background: var(--theme-card-bg, var(--apple-white)); border: 2px solid var(--theme-card-bg, var(--apple-white)); display: flex; align-items: center; justify-content: center; }

    .session-info { flex: 1; min-width: 0; }
    .session-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    .user-id { display: flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 600; color: var(--theme-text, var(--apple-black)); }
    .session-status { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
    .session-status.active { background: rgba(52, 199, 89, 0.1); color: var(--apple-green); }

    .session-details { font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); margin-bottom: 4px; }
    .separator { margin: 0 6px; opacity: 0.5; }

    .session-meta { display: flex; gap: 12px; }
    .meta-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--theme-text-secondary, var(--apple-gray-1)); }

    .session-actions { display: flex; gap: 8px; }
    .action-btn { padding: 8px 12px; border-radius: var(--apple-radius-sm); border: none; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: var(--apple-transition); }
    .action-btn.danger { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .action-btn.danger:hover { background: rgba(255, 59, 48, 0.2); }
    .action-btn.danger-outline { background: transparent; border: 1px solid var(--apple-red); color: var(--apple-red); }
    .action-btn.danger-outline:hover { background: rgba(255, 59, 48, 0.1); }

    :global(.spin) { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

    @media (max-width: 768px) {
        .session-item { flex-wrap: wrap; }
        .session-actions { width: 100%; justify-content: flex-end; margin-top: 12px; }
    }
</style>
