<script>
    import { onMount } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { IconHistory, IconLoader2, IconSearch, IconFilter, IconChevronLeft, IconChevronRight, IconUser, IconShield, IconSettings, IconLogin } from "@tabler/icons-svelte";

    let logs = [];
    let isLoading = true;
    let searchQuery = '';
    let actionFilter = 'all';
    let currentPage = 1;
    let itemsPerPage = 20;

    const actionTypes = [
        { id: 'all', label: 'All Actions' },
        { id: 'LOGIN', label: 'Login Events' },
        { id: 'ADMIN', label: 'Admin Changes' },
        { id: 'USER', label: 'User Changes' },
        { id: 'SETTINGS', label: 'Settings Changes' }
    ];

    onMount(async () => {
        await loadLogs();
    });

    async function loadLogs() {
        isLoading = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/audit-logs', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                logs = data.logs || [];
                console.log('Audit logs loaded:', logs.length, 'entries');
            } else {
                const errorData = await response.json();
                console.error('Audit logs API error:', errorData);
            }
        } catch (error) {
            console.error('Failed to load audit logs:', error);
        } finally {
            isLoading = false;
        }
    }

    function formatDate(dateString) {
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
    }

    function getActionIcon(action) {
        if (action?.includes('LOGIN') || action?.includes('LOGOUT')) return IconLogin;
        if (action?.includes('ADMIN')) return IconShield;
        if (action?.includes('USER')) return IconUser;
        if (action?.includes('SETTINGS')) return IconSettings;
        return IconHistory;
    }

    function getActionColor(action) {
        if (action?.includes('FAILED')) return 'error';
        if (action?.includes('SUCCESS') || action?.includes('CREATED')) return 'success';
        if (action?.includes('DELETED')) return 'warning';
        return 'info';
    }

    $: filteredLogs = logs.filter(log => {
        const matchesSearch = !searchQuery || 
            log.action?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.adminId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            log.ipAddress?.includes(searchQuery);
        const matchesFilter = actionFilter === 'all' || log.action?.includes(actionFilter);
        return matchesSearch && matchesFilter;
    });

    $: totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
    $: paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
</script>

<svelte:head>
    <title>Audit Logs | Admin Panel</title>
</svelte:head>

<div class="audit-page">
    <header class="page-header">
        <div class="header-content">
            <h1>Audit Logs</h1>
            <p class="header-subtitle">Track all administrative actions and system events</p>
        </div>
    </header>

    <div class="toolbar">
        <div class="search-box">
            <IconSearch size={18} stroke={1.5} />
            <input type="text" placeholder="Search logs..." bind:value={searchQuery} on:input={() => currentPage = 1} />
        </div>
        <div class="filter-select">
            <IconFilter size={18} stroke={1.5} />
            <select bind:value={actionFilter} on:change={() => currentPage = 1}>
                {#each actionTypes as type}
                    <option value={type.id}>{type.label}</option>
                {/each}
            </select>
        </div>
    </div>

    <div class="logs-container apple-card">
        {#if isLoading}
            <div class="loading-state"><IconLoader2 size={32} stroke={1.5} class="spin" /><p>Loading audit logs...</p></div>
        {:else if paginatedLogs.length === 0}
            <div class="empty-state"><IconHistory size={48} stroke={1.5} /><p>No audit logs found</p></div>
        {:else}
            <div class="logs-list">
                {#each paginatedLogs as log}
                    <div class="log-item">
                        <div class="log-icon {getActionColor(log.action)}">
                            <svelte:component this={getActionIcon(log.action)} size={18} stroke={1.5} />
                        </div>
                        <div class="log-content">
                            <div class="log-header">
                                <span class="log-action">{log.action?.replace(/_/g, ' ') || 'Unknown'}</span>
                                <span class="log-time">{formatDate(log.timestamp)}</span>
                            </div>
                            <div class="log-details">
                                {#if log.adminId}
                                    <span class="detail-item">Admin: {log.adminId.substring(0, 8)}...</span>
                                {/if}
                                {#if log.targetId}
                                    <span class="detail-item">Target: {log.targetId.substring(0, 8)}...</span>
                                {/if}
                                {#if log.ipAddress}
                                    <span class="detail-item">IP: {log.ipAddress}</span>
                                {/if}
                                {#if log.deviceInfo}
                                    <span class="detail-item">{log.deviceInfo.browser || 'Unknown'} / {log.deviceInfo.platform || 'Unknown'}</span>
                                    {#if log.deviceInfo.isMobile}
                                        <span class="detail-item mobile-badge">Mobile</span>
                                    {/if}
                                {/if}
                            </div>
                        </div>
                    </div>
                {/each}
            </div>

            <div class="pagination">
                <span class="pagination-info">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length}
                </span>
                <div class="pagination-controls">
                    <button class="page-btn" disabled={currentPage === 1} on:click={() => currentPage--}>
                        <IconChevronLeft size={18} stroke={2} />
                    </button>
                    <span class="page-number">{currentPage} / {totalPages || 1}</span>
                    <button class="page-btn" disabled={currentPage >= totalPages} on:click={() => currentPage++}>
                        <IconChevronRight size={18} stroke={2} />
                    </button>
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .audit-page { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { margin-bottom: 24px; }
    .page-header h1 { font-size: 32px; font-weight: 700; color: var(--theme-text, var(--apple-black)); margin-bottom: 4px; }
    .header-subtitle { font-size: 15px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    
    .toolbar { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
    .search-box { display: flex; align-items: center; gap: 10px; background: var(--theme-card-bg, var(--apple-white)); border: 1px solid var(--theme-border, var(--apple-gray-4)); border-radius: var(--apple-radius-md); padding: 10px 14px; flex: 1; max-width: 400px; }
    .search-box input { border: none; background: none; outline: none; flex: 1; font-size: 14px; color: var(--theme-text, var(--apple-black)); }
    .filter-select { display: flex; align-items: center; gap: 8px; background: var(--theme-card-bg, var(--apple-white)); border: 1px solid var(--theme-border, var(--apple-gray-4)); border-radius: var(--apple-radius-md); padding: 8px 14px; }
    .filter-select select { border: none; background: none; outline: none; font-size: 14px; color: var(--theme-text, var(--apple-black)); cursor: pointer; }
    
    .logs-container { padding: 0; overflow: hidden; }
    .loading-state, .empty-state { text-align: center; padding: 60px 20px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .loading-state p, .empty-state p { margin-top: 12px; font-size: 14px; }
    
    .logs-list { display: flex; flex-direction: column; }
    .log-item { display: flex; gap: 14px; padding: 16px 20px; border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5)); }
    .log-item:last-child { border-bottom: none; }
    .log-item:hover { background: var(--theme-border-light, var(--apple-gray-6)); }
    
    .log-icon { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .log-icon.success { background: rgba(52, 199, 89, 0.1); color: var(--apple-green); }
    .log-icon.error { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .log-icon.warning { background: rgba(255, 149, 0, 0.1); color: var(--apple-orange); }
    .log-icon.info { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }
    
    .log-content { flex: 1; min-width: 0; }
    .log-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
    .log-action { font-size: 14px; font-weight: 600; color: var(--theme-text, var(--apple-black)); text-transform: capitalize; }
    .log-time { font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    
    .log-details { display: flex; gap: 16px; flex-wrap: wrap; }
    .detail-item { font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .detail-item.mobile-badge { background: rgba(52, 199, 89, 0.1); color: var(--apple-green); padding: 2px 8px; border-radius: 10px; font-weight: 500; }
    
    .pagination { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-top: 1px solid var(--theme-border-light, var(--apple-gray-5)); }
    .pagination-info { font-size: 13px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .pagination-controls { display: flex; align-items: center; gap: 12px; }
    .page-btn { width: 32px; height: 32px; border-radius: var(--apple-radius-sm); background: var(--theme-border-light, var(--apple-gray-6)); border: none; display: flex; align-items: center; justify-content: center; color: var(--theme-text-secondary, var(--apple-gray-1)); cursor: pointer; }
    .page-btn:hover:not(:disabled) { background: var(--theme-border, var(--apple-gray-5)); }
    .page-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .page-number { font-size: 13px; color: var(--theme-text, var(--apple-black)); font-weight: 500; }
    
    :global(.spin) { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
