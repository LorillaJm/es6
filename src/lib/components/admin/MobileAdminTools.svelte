<script>
    import { createEventDispatcher } from 'svelte';
    import { 
        IconQrcode, IconSpeakerphone, IconCheck, IconX, IconMessageCircle,
        IconUsers, IconClockHour4, IconAlertTriangle, IconChevronRight,
        IconRefresh, IconLoader2, IconSearch, IconFilter
    } from '@tabler/icons-svelte';

    export let scanLogs = [];
    export let pendingRequests = [];
    export let urgentFeedback = [];
    export let isLoading = false;

    const dispatch = createEventDispatcher();

    let activeTab = 'scans';
    let searchQuery = '';

    const tabs = [
        { id: 'scans', label: 'Scan Logs', icon: IconQrcode, count: scanLogs.length },
        { id: 'requests', label: 'Requests', icon: IconClockHour4, count: pendingRequests.length },
        { id: 'feedback', label: 'Urgent', icon: IconAlertTriangle, count: urgentFeedback.length }
    ];

    function handleApprove(item, type) {
        dispatch('approve', { item, type });
    }

    function handleReject(item, type) {
        dispatch('reject', { item, type });
    }

    function handleAnnouncement() {
        dispatch('announcement');
    }

    function handleRefresh() {
        dispatch('refresh');
    }

    function formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    function formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const today = new Date();
        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    $: filteredScanLogs = scanLogs.filter(log => 
        !searchQuery || 
        log.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.location?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    $: filteredRequests = pendingRequests.filter(req =>
        !searchQuery ||
        req.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        req.type?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    $: filteredFeedback = urgentFeedback.filter(fb =>
        !searchQuery ||
        fb.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fb.message?.toLowerCase().includes(searchQuery.toLowerCase())
    );
</script>

<div class="mobile-admin-tools">
    <!-- Header -->
    <div class="tools-header">
        <h2>Quick Admin</h2>
        <div class="header-actions">
            <button class="action-btn announce" on:click={handleAnnouncement}>
                <IconSpeakerphone size={18} />
                <span>Announce</span>
            </button>
            <button class="action-btn refresh" on:click={handleRefresh} disabled={isLoading}>
                {#if isLoading}
                    <IconLoader2 size={18} class="spin" />
                {:else}
                    <IconRefresh size={18} />
                {/if}
            </button>
        </div>
    </div>

    <!-- Search -->
    <div class="search-bar">
        <IconSearch size={16} />
        <input type="text" placeholder="Search..." bind:value={searchQuery} />
    </div>

    <!-- Tabs -->
    <div class="tabs">
        {#each tabs as tab}
            <button 
                class="tab" 
                class:active={activeTab === tab.id}
                on:click={() => activeTab = tab.id}
            >
                <svelte:component this={tab.icon} size={16} />
                <span>{tab.label}</span>
                {#if tab.count > 0}
                    <span class="badge">{tab.count}</span>
                {/if}
            </button>
        {/each}
    </div>

    <!-- Content -->
    <div class="content">
        {#if activeTab === 'scans'}
            <!-- Scan Logs -->
            <div class="list">
                {#if filteredScanLogs.length === 0}
                    <div class="empty-state">
                        <IconQrcode size={32} />
                        <p>No recent scans</p>
                    </div>
                {:else}
                    {#each filteredScanLogs as log}
                        <div class="list-item scan-item">
                            <div class="item-avatar" class:check-in={log.type === 'check-in'} class:check-out={log.type === 'check-out'}>
                                {(log.userName || 'U').charAt(0)}
                            </div>
                            <div class="item-info">
                                <span class="item-name">{log.userName || 'Unknown'}</span>
                                <span class="item-meta">
                                    {log.type === 'check-in' ? '→ In' : '← Out'} • {log.location || 'Main'}
                                </span>
                            </div>
                            <div class="item-time">
                                <span class="time">{formatTime(log.timestamp)}</span>
                                <span class="date">{formatDate(log.timestamp)}</span>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

        {:else if activeTab === 'requests'}
            <!-- Pending Requests -->
            <div class="list">
                {#if filteredRequests.length === 0}
                    <div class="empty-state">
                        <IconClockHour4 size={32} />
                        <p>No pending requests</p>
                    </div>
                {:else}
                    {#each filteredRequests as request}
                        <div class="list-item request-item">
                            <div class="item-avatar">
                                {(request.userName || 'U').charAt(0)}
                            </div>
                            <div class="item-info">
                                <span class="item-name">{request.userName || 'Unknown'}</span>
                                <span class="item-meta">{request.type} • {request.reason || 'No reason'}</span>
                                {#if request.date}
                                    <span class="item-date">{formatDate(request.date)}</span>
                                {/if}
                            </div>
                            <div class="item-actions">
                                <button class="approve-btn" on:click={() => handleApprove(request, 'request')}>
                                    <IconCheck size={16} />
                                </button>
                                <button class="reject-btn" on:click={() => handleReject(request, 'request')}>
                                    <IconX size={16} />
                                </button>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

        {:else if activeTab === 'feedback'}
            <!-- Urgent Feedback -->
            <div class="list">
                {#if filteredFeedback.length === 0}
                    <div class="empty-state">
                        <IconMessageCircle size={32} />
                        <p>No urgent feedback</p>
                    </div>
                {:else}
                    {#each filteredFeedback as feedback}
                        <div class="list-item feedback-item" class:critical={feedback.priority === 'high'}>
                            <div class="item-avatar">
                                {(feedback.userName || 'U').charAt(0)}
                            </div>
                            <div class="item-info">
                                <div class="feedback-header">
                                    <span class="item-name">{feedback.userName || 'Anonymous'}</span>
                                    {#if feedback.priority === 'high'}
                                        <span class="priority-badge">Urgent</span>
                                    {/if}
                                </div>
                                <span class="item-meta">{feedback.type || 'General'}</span>
                                <p class="feedback-preview">{feedback.message?.substring(0, 80)}...</p>
                            </div>
                            <button class="view-btn" on:click={() => dispatch('viewFeedback', feedback)}>
                                <IconChevronRight size={18} />
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>
        {/if}
    </div>
</div>

<style>
    .mobile-admin-tools {
        background: var(--theme-card-bg, var(--apple-white));
        border-radius: var(--apple-radius-xl);
        overflow: hidden;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    .tools-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid var(--theme-border-light);
    }

    .tools-header h2 {
        font-size: 18px;
        font-weight: 700;
        color: var(--theme-text);
        margin: 0;
    }

    .header-actions {
        display: flex;
        gap: 8px;
    }

    .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .action-btn.announce {
        background: var(--apple-accent);
        color: white;
    }

    .action-btn.announce:hover {
        background: #0066CC;
    }

    .action-btn.refresh {
        background: var(--theme-border-light);
        color: var(--theme-text-secondary);
        padding: 8px;
    }

    .action-btn.refresh:hover {
        background: var(--theme-border);
    }

    .search-bar {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 12px 16px;
        padding: 10px 14px;
        background: var(--theme-border-light);
        border-radius: 10px;
        color: var(--theme-text-secondary);
    }

    .search-bar input {
        flex: 1;
        border: none;
        background: none;
        outline: none;
        font-size: 14px;
        color: var(--theme-text);
    }

    .tabs {
        display: flex;
        padding: 0 12px;
        border-bottom: 1px solid var(--theme-border-light);
    }

    .tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 12px 16px;
        background: none;
        border: none;
        border-bottom: 2px solid transparent;
        font-size: 13px;
        font-weight: 500;
        color: var(--theme-text-secondary);
        cursor: pointer;
        transition: all 0.2s;
    }

    .tab:hover {
        color: var(--theme-text);
    }

    .tab.active {
        color: var(--apple-accent);
        border-bottom-color: var(--apple-accent);
    }

    .badge {
        background: var(--apple-red);
        color: white;
        font-size: 10px;
        font-weight: 700;
        padding: 2px 6px;
        border-radius: 10px;
        min-width: 18px;
        text-align: center;
    }

    .tab.active .badge {
        background: var(--apple-accent);
    }

    .content {
        max-height: 400px;
        overflow-y: auto;
    }

    .list {
        padding: 8px;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: var(--theme-text-secondary);
        gap: 8px;
    }

    .empty-state p {
        font-size: 14px;
        margin: 0;
    }

    .list-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 12px;
        transition: background 0.2s;
    }

    .list-item:hover {
        background: var(--theme-border-light);
    }

    .item-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--apple-accent), var(--apple-purple));
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 16px;
        flex-shrink: 0;
    }

    .item-avatar.check-in {
        background: linear-gradient(135deg, var(--apple-green), #28A745);
    }

    .item-avatar.check-out {
        background: linear-gradient(135deg, var(--apple-orange), #FF6B00);
    }

    .item-info {
        flex: 1;
        min-width: 0;
    }

    .item-name {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text);
    }

    .item-meta {
        display: block;
        font-size: 12px;
        color: var(--theme-text-secondary);
    }

    .item-date {
        display: block;
        font-size: 11px;
        color: var(--apple-accent);
        margin-top: 2px;
    }

    .item-time {
        text-align: right;
    }

    .item-time .time {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text);
    }

    .item-time .date {
        display: block;
        font-size: 11px;
        color: var(--theme-text-secondary);
    }

    .item-actions {
        display: flex;
        gap: 6px;
    }

    .approve-btn, .reject-btn {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
    }

    .approve-btn {
        background: rgba(52, 199, 89, 0.15);
        color: var(--apple-green);
    }

    .approve-btn:hover {
        background: var(--apple-green);
        color: white;
    }

    .reject-btn {
        background: rgba(255, 59, 48, 0.15);
        color: var(--apple-red);
    }

    .reject-btn:hover {
        background: var(--apple-red);
        color: white;
    }

    .feedback-item.critical {
        background: rgba(255, 59, 48, 0.05);
    }

    .feedback-header {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .priority-badge {
        font-size: 10px;
        font-weight: 600;
        color: var(--apple-red);
        background: rgba(255, 59, 48, 0.15);
        padding: 2px 8px;
        border-radius: 8px;
    }

    .feedback-preview {
        font-size: 12px;
        color: var(--theme-text-secondary);
        margin: 4px 0 0;
        line-height: 1.4;
    }

    .view-btn {
        background: none;
        border: none;
        color: var(--theme-text-secondary);
        cursor: pointer;
        padding: 8px;
    }

    .view-btn:hover {
        color: var(--apple-accent);
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
