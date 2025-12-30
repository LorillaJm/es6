<script>
    import { onMount } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { 
        IconMessageCircle, IconSearch, IconCheck, IconX, IconLoader2, 
        IconBug, IconBulb, IconPalette, IconRocket, IconStar, IconChevronRight,
        IconDeviceMobile, IconPhoto, IconSend, IconDownload, IconClock,
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

    onMount(async () => { await loadFeedback(); });

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
        } finally { isLoading = false; }
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
                if (selectedFeedback?.id === id) selectedFeedback = feedback.find(f => f.id === id);
            }
        } catch (error) { console.error('Failed to update feedback:', error); }
    }

    async function sendReply() {
        if (!replyText.trim() || !selectedFeedback) return;
        isSubmitting = true;
        try { await updateFeedback(selectedFeedback.id, { reply: replyText }); replyText = ''; }
        finally { isSubmitting = false; }
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
                a.download = `feedback-${new Date().toISOString().split('T')[0]}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (error) { console.error('Export failed:', error); }
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const days = Math.floor((now - date) / (1000 * 60 * 60 * 24));
        if (days === 0) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        if (days < 7) return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function formatFullDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function getTypeInfo(type) { return typeOptions.find(t => t.value === type) || typeOptions[4]; }
    function getPriorityInfo(priority) { return priorityOptions.find(p => p.value === priority) || priorityOptions[1]; }
    function getStatusInfo(status) { return statusOptions.find(s => s.value === status) || statusOptions[0]; }

    $: filteredFeedback = feedback.filter(f => {
        const matchesSearch = !searchQuery || f.message?.toLowerCase().includes(searchQuery.toLowerCase()) || f.userName?.toLowerCase().includes(searchQuery.toLowerCase()) || f.subject?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || f.status === statusFilter;
        const matchesType = typeFilter === 'all' || f.type === typeFilter;
        const matchesPriority = priorityFilter === 'all' || f.priority === priorityFilter;
        return matchesSearch && matchesStatus && matchesType && matchesPriority;
    });
    $: activeFiltersCount = [statusFilter, typeFilter, priorityFilter].filter(f => f !== 'all').length;

</script>

<svelte:head>
    <title>Feedback | Admin</title>
</svelte:head>

<div class="feedback-page">
    <!-- Compact Header -->
    <header class="page-header">
        <div class="header-left">
            <div class="header-icon"><IconMessageCircle size={18} stroke={1.5} /></div>
            <div>
                <h1>Feedback</h1>
                <span class="count">{filteredFeedback.length} items</span>
            </div>
        </div>
        <button class="btn-export" on:click={exportFeedback} title="Export CSV">
            <IconDownload size={16} stroke={1.5} />
        </button>
    </header>

    <!-- Compact Stats Pills -->
    <div class="stats-bar">
        <button class="pill" class:active={statusFilter === 'all'} on:click={() => statusFilter = 'all'}>
            <strong>{stats.total || 0}</strong> All
        </button>
        <button class="pill" class:active={statusFilter === 'pending'} on:click={() => statusFilter = 'pending'}>
            <strong class="orange">{stats.pending || 0}</strong> Pending
        </button>
        <button class="pill" class:active={statusFilter === 'in_progress'} on:click={() => statusFilter = 'in_progress'}>
            <strong class="blue">{stats.inProgress || 0}</strong> In Progress
        </button>
        <button class="pill" class:active={statusFilter === 'resolved'} on:click={() => statusFilter = 'resolved'}>
            <strong class="green">{stats.resolved || 0}</strong> Resolved
        </button>
    </div>

    <!-- Search & Filter Row -->
    <div class="toolbar">
        <div class="search-box">
            <IconSearch size={16} stroke={1.5} />
            <input type="text" placeholder="Search feedback..." bind:value={searchQuery} />
            {#if searchQuery}<button class="clear" on:click={() => searchQuery = ''}><IconX size={14} /></button>{/if}
        </div>
        <button class="filter-btn" class:active={showFilters || activeFiltersCount > 0} on:click={() => showFilters = !showFilters}>
            <IconFilter size={16} stroke={1.5} />
            {#if activeFiltersCount > 0}<span class="badge">{activeFiltersCount}</span>{/if}
        </button>
    </div>

    {#if showFilters}
    <div class="filter-row">
        <select bind:value={typeFilter}><option value="all">All Types</option>{#each typeOptions as o}<option value={o.value}>{o.label}</option>{/each}</select>
        <select bind:value={priorityFilter}><option value="all">All Priority</option>{#each priorityOptions as o}<option value={o.value}>{o.label}</option>{/each}</select>
        {#if activeFiltersCount > 0}<button class="clear-link" on:click={() => { typeFilter = 'all'; priorityFilter = 'all'; statusFilter = 'all'; }}>Clear</button>{/if}
    </div>
    {/if}

    <!-- Main Content Grid -->
    <div class="content-grid" class:has-panel={selectedFeedback}>
        <!-- List -->
        <div class="list-col">
            {#if isLoading}
                <div class="state"><div class="spinner"></div><p>Loading...</p></div>
            {:else if filteredFeedback.length === 0}
                <div class="state"><IconInbox size={40} stroke={1} /><p>No feedback found</p></div>
            {:else}
                {#each filteredFeedback as item}
                    {@const typeInfo = getTypeInfo(item.type)}
                    {@const priorityInfo = getPriorityInfo(item.priority)}
                    {@const statusInfo = getStatusInfo(item.status)}
                    <button class="item" class:selected={selectedFeedback?.id === item.id} on:click={() => selectedFeedback = item}>
                        <div class="avatar">{item.userName?.charAt(0)?.toUpperCase() || 'U'}</div>
                        <div class="item-body">
                            <div class="item-top">
                                <span class="name">{item.userName || 'Anonymous'}</span>
                                <span class="time">{formatDate(item.createdAt)}</span>
                            </div>
                            {#if item.subject}<p class="subject">{item.subject}</p>{/if}
                            <p class="preview">{item.message?.substring(0, 80)}{item.message?.length > 80 ? '...' : ''}</p>
                            <div class="tags">
                                <span class="tag type-{typeInfo.color}"><svelte:component this={typeInfo.icon} size={10} stroke={2} /> {typeInfo.label}</span>
                                <span class="tag pri-{priorityInfo.color}">{priorityInfo.label}</span>
                                <span class="tag st-{statusInfo.color}">{statusInfo.label.replace('_', ' ')}</span>
                                {#if item.screenshotUrl}<span class="tag attach"><IconPhoto size={10} /></span>{/if}
                            </div>
                        </div>
                    </button>
                {/each}
            {/if}
        </div>

        <!-- Detail Panel -->
        {#if selectedFeedback}
        {@const typeInfo = getTypeInfo(selectedFeedback.type)}
        {@const priorityInfo = getPriorityInfo(selectedFeedback.priority)}
        <aside class="panel">
            <div class="panel-head">
                <span>Details</span>
                <button class="close-btn" on:click={() => selectedFeedback = null}><IconX size={16} /></button>
            </div>
            <div class="panel-body">
                <!-- User -->
                <div class="user-row">
                    <div class="avatar-lg">{selectedFeedback.userName?.charAt(0)?.toUpperCase() || 'U'}</div>
                    <div><strong>{selectedFeedback.userName || 'Anonymous'}</strong><br/><small>{selectedFeedback.userEmail || 'No email'}</small></div>
                </div>
                <!-- Badges -->
                <div class="badge-row">
                    <span class="badge-lg type-{typeInfo.color}"><svelte:component this={typeInfo.icon} size={12} /> {typeInfo.label}</span>
                    <span class="badge-lg pri-{priorityInfo.color}"><svelte:component this={priorityInfo.icon} size={12} /> {priorityInfo.label}</span>
                </div>
                <!-- Message -->
                <div class="section">
                    <label>MESSAGE</label>
                    {#if selectedFeedback.subject}<h4>{selectedFeedback.subject}</h4>{/if}
                    <p>{selectedFeedback.message}</p>
                </div>
                <!-- Screenshot -->
                {#if selectedFeedback.screenshotUrl}
                <div class="section">
                    <label>ATTACHMENT</label>
                    <a href={selectedFeedback.screenshotUrl} target="_blank" class="screenshot">
                        <img src={selectedFeedback.screenshotUrl} alt="Screenshot" />
                    </a>
                </div>
                {/if}
                <!-- Device -->
                {#if selectedFeedback.deviceInfo}
                <div class="section">
                    <label><IconDeviceMobile size={12} /> DEVICE</label>
                    <div class="device-info">
                        {#if selectedFeedback.deviceInfo.platform}<span>{selectedFeedback.deviceInfo.platform}</span>{/if}
                        {#if selectedFeedback.deviceInfo.browser}<span>{selectedFeedback.deviceInfo.browser}</span>{/if}
                        {#if selectedFeedback.deviceInfo.screenSize}<span>{selectedFeedback.deviceInfo.screenSize}</span>{/if}
                    </div>
                </div>
                {/if}
                <!-- Actions -->
                <div class="section">
                    <label>ACTIONS</label>
                    <div class="action-row">
                        <select value={selectedFeedback.status} on:change={(e) => updateFeedback(selectedFeedback.id, { status: e.target.value })}>
                            {#each statusOptions as o}<option value={o.value}>{o.label}</option>{/each}
                        </select>
                        <select value={selectedFeedback.priority} on:change={(e) => updateFeedback(selectedFeedback.id, { priority: e.target.value })}>
                            {#each priorityOptions as o}<option value={o.value}>{o.label}</option>{/each}
                        </select>
                    </div>
                    <select class="full" value={selectedFeedback.assignedTo || ''} on:change={(e) => updateFeedback(selectedFeedback.id, { assignedTo: e.target.value || null })}>
                        <option value="">Unassigned</option>
                        {#each admins as a}<option value={a.id}>{a.name}</option>{/each}
                    </select>
                </div>
                <!-- Replies -->
                <div class="section">
                    <label>REPLIES</label>
                    {#if selectedFeedback.replies?.length > 0}
                        <div class="replies">
                            {#each selectedFeedback.replies as r}
                                <div class="reply"><strong>{r.adminName}</strong> <small>{formatFullDate(r.createdAt)}</small><p>{r.message}</p></div>
                            {/each}
                        </div>
                    {:else}<p class="muted">No replies yet</p>{/if}
                    <div class="reply-box">
                        <textarea rows="2" placeholder="Write a reply..." bind:value={replyText}></textarea>
                        <button class="send-btn" on:click={sendReply} disabled={isSubmitting || !replyText.trim()}>
                            {#if isSubmitting}<IconLoader2 size={14} class="spin" />{:else}<IconSend size={14} />{/if} Send
                        </button>
                    </div>
                </div>
                <!-- Timeline -->
                <div class="section">
                    <label><IconClock size={12} /> TIMELINE</label>
                    <div class="timeline">
                        <div class="tl-item"><span class="dot"></span><span>Submitted</span><small>{formatFullDate(selectedFeedback.createdAt)}</small></div>
                        {#if selectedFeedback.assignedAt}<div class="tl-item"><span class="dot blue"></span><span>Assigned</span><small>{formatFullDate(selectedFeedback.assignedAt)}</small></div>{/if}
                        {#if selectedFeedback.resolvedAt}<div class="tl-item"><span class="dot green"></span><span>Resolved</span><small>{formatFullDate(selectedFeedback.resolvedAt)}</small></div>{/if}
                    </div>
                </div>
            </div>
        </aside>
        {/if}
    </div>
</div>

<style>
    /* Page - Compact Apple Style */
    .feedback-page { padding: 20px 24px; max-width: 1400px; margin: 0 auto; }

    /* Header - Minimal */
    .page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .header-left { display: flex; align-items: center; gap: 10px; }
    .header-icon { width: 36px; height: 36px; background: linear-gradient(135deg, var(--apple-accent), #5856D6); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: white; }
    .header-left h1 { font-size: 20px; font-weight: 600; margin: 0; color: var(--theme-text); }
    .header-left .count { font-size: 12px; color: var(--theme-text-secondary); }
    .btn-export { width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--theme-border); background: var(--theme-card-bg); color: var(--theme-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; }
    .btn-export:hover { border-color: var(--apple-accent); color: var(--apple-accent); }

    /* Stats Bar - Compact Pills */
    .stats-bar { display: flex; gap: 8px; margin-bottom: 14px; flex-wrap: wrap; }
    .pill { display: flex; align-items: center; gap: 6px; padding: 6px 14px; background: var(--theme-card-bg); border: 1px solid var(--theme-border); border-radius: 20px; font-size: 12px; color: var(--theme-text-secondary); cursor: pointer; transition: all 0.15s; }
    .pill:hover { border-color: var(--apple-accent); }
    .pill.active { background: var(--apple-accent); border-color: var(--apple-accent); color: white; }
    .pill.active strong { color: white; }
    .pill strong { font-weight: 600; color: var(--theme-text); }
    .pill strong.orange { color: var(--apple-orange); }
    .pill strong.blue { color: var(--apple-accent); }
    .pill strong.green { color: var(--apple-green); }

    /* Toolbar */
    .toolbar { display: flex; gap: 8px; margin-bottom: 12px; }
    .search-box { flex: 1; max-width: 320px; display: flex; align-items: center; gap: 8px; padding: 0 12px; height: 38px; background: var(--theme-card-bg); border: 1px solid var(--theme-border); border-radius: 10px; transition: all 0.15s; }
    .search-box:focus-within { border-color: var(--apple-accent); box-shadow: 0 0 0 2px rgba(0,122,255,0.1); }
    .search-box input { flex: 1; border: none; background: none; outline: none; font-size: 13px; color: var(--theme-text); }
    .search-box input::placeholder { color: var(--apple-gray-2); }
    .search-box .clear { width: 20px; height: 20px; border-radius: 50%; border: none; background: var(--theme-border-light); color: var(--theme-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; }
    .filter-btn { width: 38px; height: 38px; border-radius: 10px; border: 1px solid var(--theme-border); background: var(--theme-card-bg); color: var(--theme-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; position: relative; transition: all 0.15s; }
    .filter-btn:hover, .filter-btn.active { border-color: var(--apple-accent); color: var(--apple-accent); }
    .filter-btn .badge { position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; background: var(--apple-accent); color: white; font-size: 10px; font-weight: 600; border-radius: 50%; display: flex; align-items: center; justify-content: center; }

    /* Filter Row */
    .filter-row { display: flex; gap: 10px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; animation: fadeIn 0.15s; }
    .filter-row select { padding: 8px 12px; background: var(--theme-border-light); border: 1px solid transparent; border-radius: 8px; font-size: 13px; color: var(--theme-text); cursor: pointer; }
    .filter-row select:focus { outline: none; border-color: var(--apple-accent); }
    .clear-link { background: none; border: none; color: var(--apple-accent); font-size: 13px; cursor: pointer; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    /* Content Grid */
    .content-grid { display: grid; grid-template-columns: 1fr; gap: 16px; }
    .content-grid.has-panel { grid-template-columns: 1fr 340px; }

    /* List Column */
    .list-col { display: flex; flex-direction: column; gap: 6px; max-height: calc(100vh - 220px); overflow-y: auto; padding-right: 4px; }
    .state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--theme-text-secondary); }
    .state p { margin: 12px 0 0; font-size: 13px; }
    .spinner { width: 28px; height: 28px; border: 2px solid var(--theme-border-light); border-top-color: var(--apple-accent); border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Feedback Item - Compact */
    .item { display: flex; gap: 10px; padding: 12px 14px; background: var(--theme-card-bg); border: 1px solid var(--theme-border); border-radius: 12px; cursor: pointer; text-align: left; width: 100%; transition: all 0.15s; }
    .item:hover { border-color: var(--apple-accent); }
    .item.selected { border-color: var(--apple-accent); background: rgba(0,122,255,0.03); box-shadow: 0 0 0 2px rgba(0,122,255,0.08); }
    .avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, var(--apple-accent), #5856D6); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; font-weight: 600; flex-shrink: 0; }
    .item-body { flex: 1; min-width: 0; }
    .item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
    .name { font-size: 13px; font-weight: 600; color: var(--theme-text); }
    .time { font-size: 11px; color: var(--theme-text-secondary); }
    .subject { font-size: 13px; font-weight: 500; color: var(--theme-text); margin: 0 0 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .preview { font-size: 12px; color: var(--theme-text-secondary); margin: 0 0 8px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .tag { display: inline-flex; align-items: center; gap: 3px; padding: 2px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; }
    .tag.type-red { background: rgba(255,59,48,0.1); color: var(--apple-red); }
    .tag.type-amber { background: rgba(255,204,0,0.12); color: #B8860B; }
    .tag.type-purple { background: rgba(88,86,214,0.1); color: #5856D6; }
    .tag.type-orange { background: rgba(255,149,0,0.1); color: var(--apple-orange); }
    .tag.type-blue { background: rgba(0,122,255,0.1); color: var(--apple-accent); }
    .tag.pri-red { background: rgba(255,59,48,0.1); color: var(--apple-red); }
    .tag.pri-amber { background: rgba(255,204,0,0.12); color: #B8860B; }
    .tag.pri-neutral { background: var(--theme-border-light); color: var(--theme-text-secondary); }
    .tag.st-orange { background: rgba(255,149,0,0.1); color: var(--apple-orange); }
    .tag.st-blue { background: rgba(0,122,255,0.1); color: var(--apple-accent); }
    .tag.st-green { background: rgba(52,199,89,0.1); color: var(--apple-green); }
    .tag.attach { background: var(--theme-border-light); color: var(--theme-text-secondary); padding: 2px 6px; }

    /* Detail Panel - Compact */
    .panel { background: var(--theme-card-bg); border: 1px solid var(--theme-border); border-radius: 14px; display: flex; flex-direction: column; max-height: calc(100vh - 220px); position: sticky; top: 20px; overflow: hidden; animation: slideIn 0.2s ease; }
    @keyframes slideIn { from { opacity: 0; transform: translateX(12px); } to { opacity: 1; transform: translateX(0); } }
    .panel-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--theme-border-light); font-size: 14px; font-weight: 600; color: var(--theme-text); }
    .close-btn { width: 28px; height: 28px; border-radius: 50%; border: none; background: var(--theme-border-light); color: var(--theme-text-secondary); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.15s; }
    .close-btn:hover { background: var(--theme-border); }
    .panel-body { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 16px; }

    /* User Row */
    .user-row { display: flex; align-items: center; gap: 12px; padding-bottom: 14px; border-bottom: 1px solid var(--theme-border-light); }
    .avatar-lg { width: 44px; height: 44px; border-radius: 50%; background: linear-gradient(135deg, var(--apple-accent), #5856D6); display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; font-weight: 600; }
    .user-row strong { font-size: 14px; color: var(--theme-text); }
    .user-row small { font-size: 12px; color: var(--theme-text-secondary); }

    /* Badge Row */
    .badge-row { display: flex; gap: 8px; flex-wrap: wrap; }
    .badge-lg { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; }
    .badge-lg.type-red { background: rgba(255,59,48,0.1); color: var(--apple-red); }
    .badge-lg.type-amber { background: rgba(255,204,0,0.12); color: #B8860B; }
    .badge-lg.type-purple { background: rgba(88,86,214,0.1); color: #5856D6; }
    .badge-lg.type-orange { background: rgba(255,149,0,0.1); color: var(--apple-orange); }
    .badge-lg.type-blue { background: rgba(0,122,255,0.1); color: var(--apple-accent); }
    .badge-lg.pri-red { background: rgba(255,59,48,0.1); color: var(--apple-red); }
    .badge-lg.pri-amber { background: rgba(255,204,0,0.12); color: #B8860B; }
    .badge-lg.pri-neutral { background: var(--theme-border-light); color: var(--theme-text-secondary); }

    /* Sections */
    .section { display: flex; flex-direction: column; gap: 8px; }
    .section label { font-size: 10px; font-weight: 600; color: var(--theme-text-secondary); text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 4px; }
    .section h4 { font-size: 14px; font-weight: 600; color: var(--theme-text); margin: 0; }
    .section p { font-size: 13px; color: var(--theme-text); line-height: 1.5; margin: 0; }
    .section .muted { color: var(--theme-text-secondary); font-style: italic; font-size: 12px; }

    /* Screenshot */
    .screenshot { display: block; border-radius: 8px; overflow: hidden; border: 1px solid var(--theme-border); }
    .screenshot img { width: 100%; max-height: 140px; object-fit: cover; display: block; }

    /* Device Info */
    .device-info { display: flex; gap: 8px; flex-wrap: wrap; padding: 10px; background: var(--theme-border-light); border-radius: 8px; }
    .device-info span { font-size: 11px; color: var(--theme-text); padding: 3px 8px; background: var(--theme-card-bg); border-radius: 6px; }

    /* Actions */
    .action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .action-row select, .section select.full { padding: 8px 10px; background: var(--theme-border-light); border: 1px solid transparent; border-radius: 8px; font-size: 12px; color: var(--theme-text); cursor: pointer; }
    .action-row select:focus, .section select.full:focus { outline: none; border-color: var(--apple-accent); }
    .section select.full { width: 100%; margin-top: 6px; }

    /* Replies */
    .replies { display: flex; flex-direction: column; gap: 8px; max-height: 120px; overflow-y: auto; }
    .reply { padding: 10px; background: var(--theme-border-light); border-radius: 10px; }
    .reply strong { font-size: 12px; color: var(--apple-accent); }
    .reply small { font-size: 10px; color: var(--theme-text-secondary); margin-left: 6px; }
    .reply p { font-size: 12px; color: var(--theme-text); margin: 6px 0 0; line-height: 1.4; }
    .reply-box { display: flex; flex-direction: column; gap: 8px; margin-top: 6px; }
    .reply-box textarea { width: 100%; padding: 10px; background: var(--theme-border-light); border: 1px solid transparent; border-radius: 10px; font-size: 12px; color: var(--theme-text); resize: none; font-family: inherit; }
    .reply-box textarea:focus { outline: none; border-color: var(--apple-accent); background: var(--theme-card-bg); }
    .send-btn { align-self: flex-end; display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--apple-accent); color: white; border: none; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.15s; }
    .send-btn:hover:not(:disabled) { filter: brightness(1.1); }
    .send-btn:disabled { background: var(--apple-gray-3); cursor: not-allowed; }

    /* Timeline */
    .timeline { display: flex; flex-direction: column; gap: 0; padding-left: 6px; }
    .tl-item { display: flex; align-items: center; gap: 10px; padding: 8px 0; position: relative; font-size: 12px; }
    .tl-item:not(:last-child)::before { content: ''; position: absolute; left: 3px; top: 22px; bottom: -8px; width: 1px; background: var(--theme-border-light); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--theme-border); flex-shrink: 0; }
    .dot.blue { background: var(--apple-accent); }
    .dot.green { background: var(--apple-green); }
    .tl-item span:not(.dot) { color: var(--theme-text); }
    .tl-item small { color: var(--theme-text-secondary); font-size: 10px; margin-left: auto; }

    :global(.spin) { animation: spin 0.8s linear infinite; }

    /* Responsive */
    @media (max-width: 900px) {
        .content-grid.has-panel { grid-template-columns: 1fr; }
        .panel { position: fixed; inset: 0; max-height: none; border-radius: 0; z-index: 100; animation: slideUp 0.25s ease; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    }
    @media (max-width: 640px) {
        .feedback-page { padding: 16px; }
        .stats-bar { overflow-x: auto; flex-wrap: nowrap; margin: 0 -16px 14px; padding: 0 16px; }
        .pill { flex-shrink: 0; }
        .search-box { max-width: none; }
        .list-col { max-height: calc(100vh - 260px); }
    }
</style>
