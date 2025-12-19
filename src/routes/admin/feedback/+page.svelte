<script>
    import { onMount } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { 
        IconMessageCircle, IconSearch, IconCheck, IconX, IconLoader2, 
        IconBug, IconBulb, IconPalette, IconRocket, IconStar, IconChevronRight,
        IconUser, IconDeviceMobile, IconPhoto, IconSend, IconDownload, IconClock,
        IconArrowUp, IconArrowDown, IconMinus, IconInbox, IconFilter
    } from "@tabler/icons-svelte";

    let feedback = [];
    let admins = [];
    let stats = {};
    let isLoading = true;
    let searchQuery = '';
    let statusFilter = 'all';
    let typeFilter = 'all';
    let priorityFilter = 'all';
    let selectedFeedback = null;
    let replyText = '';
    let isSubmitting = false;
    let showFilters = false;

    const typeOptions = [
        { value: 'bug', label: 'Bug Report', icon: IconBug, color: 'red' },
        { value: 'request', label: 'Feature Request', icon: IconBulb, color: 'amber' },
        { value: 'ui', label: 'UI/UX Issue', icon: IconPalette, color: 'purple' },
        { value: 'performance', label: 'Performance', icon: IconRocket, color: 'orange' },
        { value: 'suggestion', label: 'Suggestion', icon: IconStar, color: 'blue' }
    ];

    const priorityOptions = [
        { value: 'high', label: 'High', icon: IconArrowUp, color: 'red' },
        { value: 'medium', label: 'Medium', icon: IconMinus, color: 'amber' },
        { value: 'low', label: 'Low', icon: IconArrowDown, color: 'neutral' }
    ];

    const statusOptions = [
        { value: 'pending', label: 'Pending', color: 'orange' },
        { value: 'in_progress', label: 'In Progress', color: 'blue' },
        { value: 'resolved', label: 'Resolved', color: 'green' }
    ];

    onMount(async () => {
        await loadFeedback();
    });

    async function loadFeedback() {
        isLoading = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/feedback', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                feedback = data.feedback || [];
                admins = data.admins || [];
                stats = data.stats || {};
            }
        } catch (error) {
            console.error('Failed to load feedback:', error);
        } finally {
            isLoading = false;
        }
    }

    async function updateFeedback(id, updates) {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch(`/api/admin/feedback/${id}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (response.ok) {
                await loadFeedback();
                if (selectedFeedback?.id === id) {
                    selectedFeedback = feedback.find(f => f.id === id);
                }
            }
        } catch (error) {
            console.error('Failed to update feedback:', error);
        }
    }

    async function sendReply() {
        if (!replyText.trim() || !selectedFeedback) return;
        isSubmitting = true;
        try {
            await updateFeedback(selectedFeedback.id, { reply: replyText });
            replyText = '';
        } finally {
            isSubmitting = false;
        }
    }

    async function exportFeedback() {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/feedback?export=csv', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `feedback-export-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Export failed:', error);
        }
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        
        if (days === 0) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } else if (days === 1) {
            return 'Yesterday';
        } else if (days < 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        }
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatFullDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', { 
            month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' 
        });
    }

    function getTypeInfo(type) {
        return typeOptions.find(t => t.value === type) || typeOptions[4];
    }

    function getPriorityInfo(priority) {
        return priorityOptions.find(p => p.value === priority) || priorityOptions[1];
    }

    function getStatusInfo(status) {
        return statusOptions.find(s => s.value === status) || statusOptions[0];
    }

    function closePanel() {
        selectedFeedback = null;
    }

    $: filteredFeedback = feedback.filter(f => {
        const matchesSearch = !searchQuery || 
            f.message?.toLowerCase().includes(searchQuery.toLowerCase()) || 
            f.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            f.subject?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
        const matchesType = typeFilter === 'all' || f.type === typeFilter;
        const matchesPriority = priorityFilter === 'all' || f.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });

    $: activeFiltersCount = [statusFilter, typeFilter, priorityFilter].filter(f => f !== 'all').length;
</script>

<svelte:head>
    <title>Feedback Management | Admin</title>
</svelte:head>

<div class="feedback-page page-transition">
    <!-- Header -->
    <header class="page-header">
        <div class="header-left">
            <div class="header-icon">
                <IconMessageCircle size={24} stroke={1.5} />
            </div>
            <div class="header-text">
                <h1>Feedback</h1>
                <p class="header-subtitle">{filteredFeedback.length} {filteredFeedback.length === 1 ? 'item' : 'items'}</p>
            </div>
        </div>
        <div class="header-actions">
            <button class="btn-icon" on:click={exportFeedback} title="Export CSV">
                <IconDownload size={20} stroke={1.5} />
            </button>
        </div>
    </header>

    <!-- Stats Overview -->
    <div class="stats-row">
        <button class="stat-pill" class:active={statusFilter === 'all'} on:click={() => statusFilter = 'all'}>
            <span class="stat-count">{stats.total || 0}</span>
            <span class="stat-label">All</span>
        </button>
        <button class="stat-pill pending" class:active={statusFilter === 'pending'} on:click={() => statusFilter = 'pending'}>
            <span class="stat-count">{stats.pending || 0}</span>
            <span class="stat-label">Pending</span>
        </button>
        <button class="stat-pill progress" class:active={statusFilter === 'in_progress'} on:click={() => statusFilter = 'in_progress'}>
            <span class="stat-count">{stats.inProgress || 0}</span>
            <span class="stat-label">In Progress</span>
        </button>
        <button class="stat-pill resolved" class:active={statusFilter === 'resolved'} on:click={() => statusFilter = 'resolved'}>
            <span class="stat-count">{stats.resolved || 0}</span>
            <span class="stat-label">Resolved</span>
        </button>
    </div>

    <!-- Search & Filters -->
    <div class="toolbar">
        <div class="search-container">
            <IconSearch size={18} stroke={1.5} />
            <input 
                type="text" 
                placeholder="Search feedback..." 
                bind:value={searchQuery}
                class="search-input"
            />
            {#if searchQuery}
                <button class="search-clear" on:click={() => searchQuery = ''}>
                    <IconX size={16} stroke={2} />
                </button>
            {/if}
        </div>
        <button 
            class="filter-toggle" 
            class:active={showFilters || activeFiltersCount > 0}
            on:click={() => showFilters = !showFilters}
        >
            <IconFilter size={18} stroke={1.5} />
            {#if activeFiltersCount > 0}
                <span class="filter-badge">{activeFiltersCount}</span>
            {/if}
        </button>
    </div>

    <!-- Filter Panel -->
    {#if showFilters}
        <div class="filter-panel">
            <div class="filter-group">
                <label class="filter-label">Type</label>
                <select class="filter-select" bind:value={typeFilter}>
                    <option value="all">All Types</option>
                    {#each typeOptions as opt}
                        <option value={opt.value}>{opt.label}</option>
                    {/each}
                </select>
            </div>
            <div class="filter-group">
                <label class="filter-label">Priority</label>
                <select class="filter-select" bind:value={priorityFilter}>
                    <option value="all">All Priority</option>
                    {#each priorityOptions as opt}
                        <option value={opt.value}>{opt.label}</option>
                    {/each}
                </select>
            </div>
            {#if activeFiltersCount > 0}
                <button class="clear-filters" on:click={() => { typeFilter = 'all'; priorityFilter = 'all'; statusFilter = 'all'; }}>
                    Clear all
                </button>
            {/if}
        </div>
    {/if}

    <!-- Main Content -->
    <div class="content-wrapper" class:panel-open={selectedFeedback}>
        <!-- Feedback List -->
        <div class="feedback-list">
            {#if isLoading}
                <div class="loading-state">
                    <div class="spinner"></div>
                    <p>Loading feedback...</p>
                </div>
            {:else if filteredFeedback.length === 0}
                <div class="empty-state">
                    <div class="empty-icon">
                        <IconInbox size={48} stroke={1} />
                    </div>
                    <h3>No feedback found</h3>
                    <p>Try adjusting your filters or search query</p>
                </div>
            {:else}
                {#each filteredFeedback as item, index}
                    {@const typeInfo = getTypeInfo(item.type)}
                    {@const priorityInfo = getPriorityInfo(item.priority)}
                    {@const statusInfo = getStatusInfo(item.status)}
                    <button 
                        class="feedback-item stagger-item" 
                        class:selected={selectedFeedback?.id === item.id}
                        style="animation-delay: {Math.min(index * 30, 300)}ms"
                        on:click={() => selectedFeedback = item}
                    >
                        <div class="item-avatar">
                            <span>{item.userName?.charAt(0)?.toUpperCase() || 'U'}</span>
                        </div>
                        <div class="item-content">
                            <div class="item-header">
                                <span class="item-name">{item.userName || 'Anonymous'}</span>
                                <span class="item-time">{formatDate(item.createdAt)}</span>
                            </div>
                            {#if item.subject}
                                <p class="item-subject">{item.subject}</p>
                            {/if}
                            <p class="item-preview">{item.message?.substring(0, 100)}{item.message?.length > 100 ? '...' : ''}</p>
                            <div class="item-meta">
                                <span class="meta-badge type-{typeInfo.color}">
                                    <svelte:component this={typeInfo.icon} size={12} stroke={2} />
                                    {typeInfo.label}
                                </span>
                                <span class="meta-badge priority-{priorityInfo.color}">
                                    {priorityInfo.label}
                                </span>
                                <span class="meta-badge status-{statusInfo.color}">
                                    {statusInfo.label.replace('_', ' ')}
                                </span>
                                {#if item.screenshotUrl}
                                    <span class="meta-badge attachment">
                                        <IconPhoto size={12} stroke={2} />
                                    </span>
                                {/if}
                            </div>
                        </div>
                        <div class="item-chevron">
                            <IconChevronRight size={20} stroke={1.5} />
                        </div>
                    </button>
                {/each}
            {/if}
        </div>

        <!-- Detail Panel -->
        {#if selectedFeedback}
            {@const typeInfo = getTypeInfo(selectedFeedback.type)}
            {@const priorityInfo = getPriorityInfo(selectedFeedback.priority)}
            {@const statusInfo = getStatusInfo(selectedFeedback.status)}
            <div class="detail-panel">
                <div class="panel-header">
                    <h2>Details</h2>
                    <button class="btn-close" on:click={closePanel}>
                        <IconX size={20} stroke={1.5} />
                    </button>
                </div>

                <div class="panel-content smooth-scroll">
                    <!-- User Section -->
                    <div class="detail-section user-section">
                        <div class="user-avatar-lg">
                            <span>{selectedFeedback.userName?.charAt(0)?.toUpperCase() || 'U'}</span>
                        </div>
                        <div class="user-info">
                            <h3>{selectedFeedback.userName || 'Anonymous'}</h3>
                            <p>{selectedFeedback.userEmail || 'No email provided'}</p>
                        </div>
                    </div>

                    <!-- Status Badges -->
                    <div class="detail-badges">
                        <span class="badge-lg type-{typeInfo.color}">
                            <svelte:component this={typeInfo.icon} size={14} stroke={2} />
                            {typeInfo.label}
                        </span>
                        <span class="badge-lg priority-{priorityInfo.color}">
                            <svelte:component this={priorityInfo.icon} size={14} stroke={2} />
                            {priorityInfo.label}
                        </span>
                    </div>

                    <!-- Message -->
                    <div class="detail-section">
                        <label class="section-label">Message</label>
                        {#if selectedFeedback.subject}
                            <h4 class="message-subject">{selectedFeedback.subject}</h4>
                        {/if}
                        <p class="message-body">{selectedFeedback.message}</p>
                    </div>

                    <!-- Screenshot -->
                    {#if selectedFeedback.screenshotUrl}
                        <div class="detail-section">
                            <label class="section-label">Attachment</label>
                            <a href={selectedFeedback.screenshotUrl} target="_blank" rel="noopener" class="screenshot-link">
                                <img src={selectedFeedback.screenshotUrl} alt="Screenshot" loading="lazy" />
                                <div class="screenshot-overlay">
                                    <IconPhoto size={24} stroke={1.5} />
                                    <span>View full size</span>
                                </div>
                            </a>
                        </div>
                    {/if}

                    <!-- Device Info -->
                    {#if selectedFeedback.deviceInfo}
                        <div class="detail-section">
                            <label class="section-label">
                                <IconDeviceMobile size={14} stroke={2} />
                                Device Information
                            </label>
                            <div class="device-grid">
                                {#if selectedFeedback.deviceInfo.platform}
                                    <div class="device-item">
                                        <span class="device-label">Platform</span>
                                        <span class="device-value">{selectedFeedback.deviceInfo.platform}</span>
                                    </div>
                                {/if}
                                {#if selectedFeedback.deviceInfo.browser}
                                    <div class="device-item">
                                        <span class="device-label">Browser</span>
                                        <span class="device-value">{selectedFeedback.deviceInfo.browser}</span>
                                    </div>
                                {/if}
                                {#if selectedFeedback.deviceInfo.screenSize}
                                    <div class="device-item">
                                        <span class="device-label">Screen</span>
                                        <span class="device-value">{selectedFeedback.deviceInfo.screenSize}</span>
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}

                    <!-- Actions -->
                    <div class="detail-section">
                        <label class="section-label">Actions</label>
                        <div class="action-grid">
                            <div class="action-item">
                                <span class="action-label">Status</span>
                                <select 
                                    class="action-select" 
                                    value={selectedFeedback.status} 
                                    on:change={(e) => updateFeedback(selectedFeedback.id, { status: e.target.value })}
                                >
                                    {#each statusOptions as opt}
                                        <option value={opt.value}>{opt.label}</option>
                                    {/each}
                                </select>
                            </div>
                            <div class="action-item">
                                <span class="action-label">Priority</span>
                                <select 
                                    class="action-select" 
                                    value={selectedFeedback.priority} 
                                    on:change={(e) => updateFeedback(selectedFeedback.id, { priority: e.target.value })}
                                >
                                    {#each priorityOptions as opt}
                                        <option value={opt.value}>{opt.label}</option>
                                    {/each}
                                </select>
                            </div>
                        </div>
                        <div class="action-item full-width">
                            <span class="action-label">Assign to</span>
                            <select 
                                class="action-select" 
                                value={selectedFeedback.assignedTo || ''} 
                                on:change={(e) => updateFeedback(selectedFeedback.id, { assignedTo: e.target.value || null })}
                            >
                                <option value="">Unassigned</option>
                                {#each admins as admin}
                                    <option value={admin.id}>{admin.name}</option>
                                {/each}
                            </select>
                        </div>
                    </div>

                    <!-- Replies -->
                    <div class="detail-section">
                        <label class="section-label">Replies</label>
                        {#if selectedFeedback.replies?.length > 0}
                            <div class="replies-list">
                                {#each selectedFeedback.replies as reply}
                                    <div class="reply-bubble">
                                        <div class="reply-header">
                                            <span class="reply-author">{reply.adminName}</span>
                                            <span class="reply-time">{formatFullDate(reply.createdAt)}</span>
                                        </div>
                                        <p class="reply-text">{reply.message}</p>
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <p class="no-replies">No replies yet</p>
                        {/if}
                        <div class="reply-composer">
                            <textarea 
                                class="reply-input" 
                                rows="3" 
                                placeholder="Write a reply..." 
                                bind:value={replyText}
                            ></textarea>
                            <button 
                                class="btn-send" 
                                on:click={sendReply} 
                                disabled={isSubmitting || !replyText.trim()}
                            >
                                {#if isSubmitting}
                                    <IconLoader2 size={18} stroke={2} class="spin" />
                                {:else}
                                    <IconSend size={18} stroke={2} />
                                {/if}
                                <span>{isSubmitting ? 'Sending...' : 'Send'}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Timeline -->
                    <div class="detail-section">
                        <label class="section-label">
                            <IconClock size={14} stroke={2} />
                            Timeline
                        </label>
                        <div class="timeline">
                            <div class="timeline-item">
                                <div class="timeline-dot"></div>
                                <div class="timeline-content">
                                    <span class="timeline-action">Submitted</span>
                                    <span class="timeline-date">{formatFullDate(selectedFeedback.createdAt)}</span>
                                </div>
                            </div>
                            {#if selectedFeedback.assignedAt}
                                <div class="timeline-item">
                                    <div class="timeline-dot assigned"></div>
                                    <div class="timeline-content">
                                        <span class="timeline-action">Assigned to {selectedFeedback.assignedToName}</span>
                                        <span class="timeline-date">{formatFullDate(selectedFeedback.assignedAt)}</span>
                                    </div>
                                </div>
                            {/if}
                            {#if selectedFeedback.resolvedAt}
                                <div class="timeline-item">
                                    <div class="timeline-dot resolved"></div>
                                    <div class="timeline-content">
                                        <span class="timeline-action">Resolved</span>
                                        <span class="timeline-date">{formatFullDate(selectedFeedback.resolvedAt)}</span>
                                    </div>
                                </div>
                            {/if}
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>


<style>
    /* Page Layout */
    .feedback-page {
        padding: 32px;
        max-width: 1400px;
        margin: 0 auto;
        min-height: 100vh;
    }

    /* Header */
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 28px;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .header-icon {
        width: 48px;
        height: 48px;
        background: linear-gradient(135deg, var(--apple-accent), #5856D6);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.25);
    }

    .header-text h1 {
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.5px;
        color: var(--theme-text);
        margin: 0;
    }

    .header-subtitle {
        font-size: 14px;
        color: var(--theme-text-secondary);
        margin: 2px 0 0 0;
    }

    .header-actions {
        display: flex;
        gap: 8px;
    }

    .btn-icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        border: 1px solid var(--theme-border);
        background: var(--theme-card-bg);
        color: var(--theme-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-icon:hover {
        background: var(--theme-border-light);
        color: var(--theme-text);
        border-color: var(--theme-border);
    }

    /* Stats Row */
    .stats-row {
        display: flex;
        gap: 10px;
        margin-bottom: 24px;
        flex-wrap: wrap;
    }

    .stat-pill {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 18px;
        background: var(--theme-card-bg);
        border: 1px solid var(--theme-border);
        border-radius: 100px;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .stat-pill:hover {
        border-color: var(--apple-accent);
    }

    .stat-pill.active {
        background: var(--apple-accent);
        border-color: var(--apple-accent);
        color: white;
    }

    .stat-pill.active .stat-count,
    .stat-pill.active .stat-label {
        color: white;
    }

    .stat-count {
        font-size: 16px;
        font-weight: 700;
        color: var(--theme-text);
    }

    .stat-label {
        font-size: 13px;
        color: var(--theme-text-secondary);
    }

    .stat-pill.pending:not(.active) .stat-count { color: var(--apple-orange); }
    .stat-pill.progress:not(.active) .stat-count { color: var(--apple-accent); }
    .stat-pill.resolved:not(.active) .stat-count { color: var(--apple-green); }

    /* Toolbar */
    .toolbar {
        display: flex;
        gap: 12px;
        margin-bottom: 16px;
    }

    .search-container {
        flex: 1;
        max-width: 400px;
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 16px;
        height: 48px;
        background: var(--theme-card-bg);
        border: 1px solid var(--theme-border);
        border-radius: 14px;
        transition: all 0.2s ease;
    }

    .search-container:focus-within {
        border-color: var(--apple-accent);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    .search-container :global(svg) {
        color: var(--theme-text-secondary);
        flex-shrink: 0;
    }

    .search-input {
        flex: 1;
        border: none;
        background: none;
        outline: none;
        font-size: 15px;
        color: var(--theme-text);
    }

    .search-input::placeholder {
        color: var(--apple-gray-2);
    }

    .search-clear {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: none;
        background: var(--theme-border-light);
        color: var(--theme-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .search-clear:hover {
        background: var(--theme-border);
    }

    .filter-toggle {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        border: 1px solid var(--theme-border);
        background: var(--theme-card-bg);
        color: var(--theme-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
    }

    .filter-toggle:hover,
    .filter-toggle.active {
        border-color: var(--apple-accent);
        color: var(--apple-accent);
    }

    .filter-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        width: 18px;
        height: 18px;
        background: var(--apple-accent);
        color: white;
        font-size: 11px;
        font-weight: 600;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Filter Panel */
    .filter-panel {
        display: flex;
        gap: 16px;
        padding: 16px 20px;
        background: var(--theme-card-bg);
        border: 1px solid var(--theme-border);
        border-radius: 16px;
        margin-bottom: 20px;
        align-items: flex-end;
        flex-wrap: wrap;
        animation: slideDown 0.2s ease;
    }

    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-8px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .filter-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--theme-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .filter-select {
        padding: 10px 14px;
        padding-right: 36px;
        background: var(--theme-border-light);
        border: 1px solid transparent;
        border-radius: 10px;
        font-size: 14px;
        color: var(--theme-text);
        cursor: pointer;
        transition: all 0.2s ease;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
    }

    .filter-select:hover {
        border-color: var(--theme-border);
    }

    .filter-select:focus {
        outline: none;
        border-color: var(--apple-accent);
    }

    .clear-filters {
        padding: 10px 16px;
        background: none;
        border: none;
        color: var(--apple-accent);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: opacity 0.2s ease;
    }

    .clear-filters:hover {
        opacity: 0.7;
    }

    /* Content Layout */
    .content-wrapper {
        display: grid;
        grid-template-columns: 1fr;
        gap: 24px;
        transition: all 0.3s ease;
    }

    .content-wrapper.panel-open {
        grid-template-columns: 1fr 420px;
    }

    /* Feedback List */
    .feedback-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
        max-height: calc(100vh - 320px);
        overflow-y: auto;
        padding-right: 4px;
    }

    .loading-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 40px;
        text-align: center;
    }

    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--theme-border-light);
        border-top-color: var(--apple-accent);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 16px;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .loading-state p,
    .empty-state p {
        color: var(--theme-text-secondary);
        font-size: 14px;
        margin: 0;
    }

    .empty-icon {
        width: 80px;
        height: 80px;
        background: var(--theme-border-light);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--theme-text-secondary);
        margin-bottom: 20px;
    }

    .empty-state h3 {
        font-size: 18px;
        font-weight: 600;
        color: var(--theme-text);
        margin: 0 0 8px 0;
    }

    /* Feedback Item */
    .feedback-item {
        display: flex;
        align-items: flex-start;
        gap: 14px;
        padding: 16px 18px;
        background: var(--theme-card-bg);
        border: 1px solid var(--theme-border);
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
        width: 100%;
    }

    .feedback-item:hover {
        border-color: var(--apple-accent);
        box-shadow: 0 2px 12px rgba(0, 122, 255, 0.08);
    }

    .feedback-item.selected {
        border-color: var(--apple-accent);
        background: rgba(0, 122, 255, 0.04);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    .item-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--apple-accent), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .item-avatar span {
        color: white;
        font-size: 16px;
        font-weight: 600;
    }

    .item-content {
        flex: 1;
        min-width: 0;
    }

    .item-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
    }

    .item-name {
        font-size: 15px;
        font-weight: 600;
        color: var(--theme-text);
    }

    .item-time {
        font-size: 12px;
        color: var(--theme-text-secondary);
    }

    .item-subject {
        font-size: 14px;
        font-weight: 500;
        color: var(--theme-text);
        margin: 0 0 4px 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .item-preview {
        font-size: 13px;
        color: var(--theme-text-secondary);
        margin: 0 0 10px 0;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .item-meta {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
    }

    .meta-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 600;
    }

    .meta-badge.type-red { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .meta-badge.type-amber { background: rgba(255, 204, 0, 0.12); color: #B8860B; }
    .meta-badge.type-purple { background: rgba(88, 86, 214, 0.1); color: #5856D6; }
    .meta-badge.type-orange { background: rgba(255, 149, 0, 0.1); color: var(--apple-orange); }
    .meta-badge.type-blue { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }

    .meta-badge.priority-red { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .meta-badge.priority-amber { background: rgba(255, 204, 0, 0.12); color: #B8860B; }
    .meta-badge.priority-neutral { background: var(--theme-border-light); color: var(--theme-text-secondary); }

    .meta-badge.status-orange { background: rgba(255, 149, 0, 0.1); color: var(--apple-orange); }
    .meta-badge.status-blue { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }
    .meta-badge.status-green { background: rgba(52, 199, 89, 0.1); color: var(--apple-green); }

    .meta-badge.attachment {
        background: var(--theme-border-light);
        color: var(--theme-text-secondary);
        padding: 4px 8px;
    }

    .item-chevron {
        color: var(--theme-text-secondary);
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    .feedback-item:hover .item-chevron {
        opacity: 1;
    }

    /* Detail Panel */
    .detail-panel {
        background: var(--theme-card-bg);
        border: 1px solid var(--theme-border);
        border-radius: 20px;
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 320px);
        position: sticky;
        top: 32px;
        overflow: hidden;
        animation: slideIn 0.25s ease;
    }

    @keyframes slideIn {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
    }

    .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px;
        border-bottom: 1px solid var(--theme-border-light);
    }

    .panel-header h2 {
        font-size: 17px;
        font-weight: 600;
        color: var(--theme-text);
        margin: 0;
    }

    .btn-close {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: none;
        background: var(--theme-border-light);
        color: var(--theme-text-secondary);
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .btn-close:hover {
        background: var(--theme-border);
        color: var(--theme-text);
    }

    .panel-content {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 24px;
    }

    .detail-section {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .section-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--theme-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    /* User Section */
    .user-section {
        flex-direction: row;
        align-items: center;
        gap: 16px;
        padding-bottom: 20px;
        border-bottom: 1px solid var(--theme-border-light);
    }

    .user-avatar-lg {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--apple-accent), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.2);
    }

    .user-avatar-lg span {
        color: white;
        font-size: 22px;
        font-weight: 600;
    }

    .user-info h3 {
        font-size: 17px;
        font-weight: 600;
        color: var(--theme-text);
        margin: 0 0 4px 0;
    }

    .user-info p {
        font-size: 14px;
        color: var(--theme-text-secondary);
        margin: 0;
    }

    /* Detail Badges */
    .detail-badges {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
    }

    .badge-lg {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
    }

    .badge-lg.type-red { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .badge-lg.type-amber { background: rgba(255, 204, 0, 0.12); color: #B8860B; }
    .badge-lg.type-purple { background: rgba(88, 86, 214, 0.1); color: #5856D6; }
    .badge-lg.type-orange { background: rgba(255, 149, 0, 0.1); color: var(--apple-orange); }
    .badge-lg.type-blue { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }

    .badge-lg.priority-red { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .badge-lg.priority-amber { background: rgba(255, 204, 0, 0.12); color: #B8860B; }
    .badge-lg.priority-neutral { background: var(--theme-border-light); color: var(--theme-text-secondary); }

    /* Message */
    .message-subject {
        font-size: 16px;
        font-weight: 600;
        color: var(--theme-text);
        margin: 0;
    }

    .message-body {
        font-size: 14px;
        color: var(--theme-text);
        line-height: 1.6;
        margin: 0;
        white-space: pre-wrap;
    }

    /* Screenshot */
    .screenshot-link {
        display: block;
        position: relative;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid var(--theme-border);
    }

    .screenshot-link img {
        width: 100%;
        max-height: 200px;
        object-fit: cover;
        display: block;
    }

    .screenshot-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        color: white;
        opacity: 0;
        transition: opacity 0.2s ease;
    }

    .screenshot-overlay span {
        font-size: 13px;
        font-weight: 500;
    }

    .screenshot-link:hover .screenshot-overlay {
        opacity: 1;
    }

    /* Device Info */
    .device-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
        padding: 16px;
        background: var(--theme-border-light);
        border-radius: 12px;
    }

    .device-item {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .device-label {
        font-size: 11px;
        color: var(--theme-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }

    .device-value {
        font-size: 13px;
        color: var(--theme-text);
        font-weight: 500;
    }

    /* Actions */
    .action-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    .action-item {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .action-item.full-width {
        grid-column: span 2;
    }

    .action-label {
        font-size: 12px;
        color: var(--theme-text-secondary);
    }

    .action-select {
        padding: 12px 14px;
        padding-right: 36px;
        background: var(--theme-border-light);
        border: 1px solid transparent;
        border-radius: 10px;
        font-size: 14px;
        color: var(--theme-text);
        cursor: pointer;
        transition: all 0.2s ease;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%238E8E93' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 10px center;
    }

    .action-select:hover {
        border-color: var(--theme-border);
    }

    .action-select:focus {
        outline: none;
        border-color: var(--apple-accent);
    }

    /* Replies */
    .replies-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-height: 200px;
        overflow-y: auto;
    }

    .reply-bubble {
        padding: 14px 16px;
        background: var(--theme-border-light);
        border-radius: 14px;
    }

    .reply-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }

    .reply-author {
        font-size: 13px;
        font-weight: 600;
        color: var(--apple-accent);
    }

    .reply-time {
        font-size: 11px;
        color: var(--theme-text-secondary);
    }

    .reply-text {
        font-size: 14px;
        color: var(--theme-text);
        line-height: 1.5;
        margin: 0;
    }

    .no-replies {
        font-size: 14px;
        color: var(--theme-text-secondary);
        font-style: italic;
        margin: 0;
    }

    .reply-composer {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-top: 8px;
    }

    .reply-input {
        width: 100%;
        padding: 14px 16px;
        background: var(--theme-border-light);
        border: 1px solid transparent;
        border-radius: 14px;
        font-size: 14px;
        color: var(--theme-text);
        resize: none;
        transition: all 0.2s ease;
        font-family: inherit;
    }

    .reply-input:focus {
        outline: none;
        border-color: var(--apple-accent);
        background: var(--theme-card-bg);
    }

    .reply-input::placeholder {
        color: var(--apple-gray-2);
    }

    .btn-send {
        align-self: flex-end;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 20px;
        background: var(--apple-accent);
        color: white;
        border: none;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .btn-send:hover:not(:disabled) {
        background: var(--apple-accent-hover);
        transform: translateY(-1px);
    }

    .btn-send:active:not(:disabled) {
        transform: scale(0.98);
    }

    .btn-send:disabled {
        background: var(--apple-gray-3);
        cursor: not-allowed;
    }

    /* Timeline */
    .timeline {
        display: flex;
        flex-direction: column;
        gap: 0;
        padding-left: 8px;
    }

    .timeline-item {
        display: flex;
        gap: 16px;
        padding: 12px 0;
        position: relative;
    }

    .timeline-item:not(:last-child)::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 28px;
        bottom: 0;
        width: 2px;
        background: var(--theme-border-light);
    }

    .timeline-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--theme-border);
        flex-shrink: 0;
        margin-top: 4px;
    }

    .timeline-dot.assigned {
        background: var(--apple-accent);
    }

    .timeline-dot.resolved {
        background: var(--apple-green);
    }

    .timeline-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .timeline-action {
        font-size: 14px;
        color: var(--theme-text);
    }

    .timeline-date {
        font-size: 12px;
        color: var(--theme-text-secondary);
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    /* Responsive */
    @media (max-width: 1024px) {
        .content-wrapper.panel-open {
            grid-template-columns: 1fr;
        }

        .detail-panel {
            position: fixed;
            inset: 0;
            max-height: none;
            border-radius: 0;
            z-index: 100;
            animation: slideUp 0.3s ease;
        }

        @keyframes slideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
        }
    }

    @media (max-width: 768px) {
        .feedback-page {
            padding: 20px 16px;
        }

        .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
        }

        .stats-row {
            overflow-x: auto;
            padding-bottom: 8px;
            margin: 0 -16px 24px;
            padding: 0 16px 8px;
            flex-wrap: nowrap;
        }

        .stat-pill {
            flex-shrink: 0;
        }

        .toolbar {
            flex-direction: column;
        }

        .search-container {
            max-width: none;
        }

        .filter-panel {
            flex-direction: column;
            align-items: stretch;
        }

        .filter-group {
            width: 100%;
        }

        .filter-select {
            width: 100%;
        }

        .feedback-list {
            max-height: none;
        }

        .action-grid {
            grid-template-columns: 1fr;
        }

        .action-item.full-width {
            grid-column: span 1;
        }

        .device-grid {
            grid-template-columns: 1fr;
        }
    }
</style>
