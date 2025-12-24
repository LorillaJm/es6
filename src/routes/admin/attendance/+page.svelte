<script>
    import { onMount } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { 
        IconClockHour4, IconSearch, IconDownload, IconCalendar, IconLoader2, 
        IconChevronLeft, IconChevronRight, IconRefresh, IconMapPin, IconX,
        IconUsers, IconCheck, IconAlertCircle, IconClock, IconFilter
    } from "@tabler/icons-svelte";

    let attendance = [];
    let stats = { total: 0, present: 0, late: 0, absent: 0 };
    let isLoading = true;
    let searchQuery = '';
    let selectedDate = new Date().toISOString().split('T')[0];
    let showAllDates = true;
    let currentPage = 1;
    let itemsPerPage = 20;
    let statusFilter = 'all';
    let showFilters = false;

    const statusOptions = [
        { value: 'all', label: 'All Status' },
        { value: 'present', label: 'Present', color: 'green' },
        { value: 'late', label: 'Late', color: 'orange' },
        { value: 'absent', label: 'Absent', color: 'red' }
    ];

    onMount(async () => {
        await loadAttendance();
    });

    async function loadAttendance() {
        isLoading = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const url = showAllDates 
                ? '/api/admin/attendance' 
                : `/api/admin/attendance?date=${selectedDate}`;
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                attendance = data.attendance || [];
                stats = data.stats || { total: 0, present: 0, late: 0, absent: 0 };
                currentPage = 1;
            }
        } catch (error) {
            console.error('Failed to load attendance:', error);
        } finally {
            isLoading = false;
        }
    }

    function formatTime(timestamp) {
        if (!timestamp) return '—';
        try {
            return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '—';
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '—';
        try {
            // Handle YYYY-MM-DD format by parsing as local date (not UTC)
            let year, month, day;
            if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                // Parse YYYY-MM-DD as local date to avoid timezone shift
                [year, month, day] = dateStr.split('-').map(Number);
            } else {
                const d = new Date(dateStr);
                year = d.getFullYear();
                month = d.getMonth() + 1;
                day = d.getDate();
            }
            
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const recordStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            
            // Compare date strings directly
            if (recordStr === todayStr) return 'Today';
            
            // Calculate yesterday
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
            if (recordStr === yesterdayStr) return 'Yesterday';
            
            // For display, create date in local timezone
            const displayDate = new Date(year, month - 1, day);
            const diffDays = Math.round((now - displayDate) / (1000 * 60 * 60 * 24));
            
            if (diffDays > 0 && diffDays < 7) return displayDate.toLocaleDateString('en-US', { weekday: 'short' });
            return displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        } catch {
            return dateStr;
        }
    }

    function formatFullDate(dateStr) {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('en-US', { 
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' 
        });
    }

    function getStatusClass(status) {
        if (!status) return 'present';
        const s = status.toLowerCase();
        if (s === 'late') return 'late';
        if (s === 'absent') return 'absent';
        if (s === 'onbreak' || s === 'break') return 'break';
        return 'present';
    }

    function getStatusLabel(status) {
        if (!status) return 'Present';
        const s = status.toLowerCase();
        if (s === 'late') return 'Late';
        if (s === 'absent') return 'Absent';
        if (s === 'present') return 'Present';
        if (s === 'onbreak' || s === 'break') return 'On Break';
        if (s === 'checkedin') return 'Working';
        if (s === 'checkedout') return 'Completed';
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    async function exportCSV() {
        const headers = ['Name', 'Email', 'Date', 'Check In', 'Check Out', 'Status', 'Duration', 'Location'];
        const rows = filteredAttendance.map(r => [
            r.userName || '',
            r.userEmail || '',
            r.date || '',
            formatTime(r.checkIn),
            formatTime(r.checkOut),
            getStatusLabel(r.status),
            r.duration || '',
            r.location || ''
        ]);
        
        const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance-${selectedDate}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function clearSearch() {
        searchQuery = '';
    }

    $: filteredAttendance = attendance.filter(a => {
        const matchesSearch = !searchQuery || 
            a.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.userEmail?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    $: totalPages = Math.ceil(filteredAttendance.length / itemsPerPage);
    $: paginatedAttendance = filteredAttendance.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    $: activeFiltersCount = (statusFilter !== 'all' ? 1 : 0) + (!showAllDates ? 1 : 0);
</script>

<svelte:head>
    <title>Attendance | Admin</title>
</svelte:head>

<div class="attendance-page page-transition">
    <!-- Header -->
    <header class="page-header">
        <div class="header-left">
            <div class="header-icon">
                <IconClockHour4 size={24} stroke={1.5} />
            </div>
            <div class="header-text">
                <h1>Attendance</h1>
                <p class="header-subtitle">{filteredAttendance.length} records {showAllDates ? '' : `for ${formatFullDate(selectedDate)}`}</p>
            </div>
        </div>
        <div class="header-actions">
            <button class="btn-icon" on:click={loadAttendance} disabled={isLoading} title="Refresh">
                <IconRefresh size={20} stroke={1.5} class={isLoading ? 'spin' : ''} />
            </button>
            <button class="btn-icon" on:click={exportCSV} title="Export CSV">
                <IconDownload size={20} stroke={1.5} />
            </button>
        </div>
    </header>

    <!-- Stats Overview -->
    <div class="stats-row">
        <button class="stat-pill" class:active={statusFilter === 'all'} on:click={() => statusFilter = 'all'}>
            <div class="stat-icon total">
                <IconUsers size={18} stroke={1.5} />
            </div>
            <div class="stat-content">
                <span class="stat-count">{stats.total}</span>
                <span class="stat-label">Total</span>
            </div>
        </button>
        <button class="stat-pill" class:active={statusFilter === 'present'} on:click={() => statusFilter = 'present'}>
            <div class="stat-icon present">
                <IconCheck size={18} stroke={2} />
            </div>
            <div class="stat-content">
                <span class="stat-count present">{stats.present}</span>
                <span class="stat-label">Present</span>
            </div>
        </button>
        <button class="stat-pill" class:active={statusFilter === 'late'} on:click={() => statusFilter = 'late'}>
            <div class="stat-icon late">
                <IconClock size={18} stroke={1.5} />
            </div>
            <div class="stat-content">
                <span class="stat-count late">{stats.late}</span>
                <span class="stat-label">Late</span>
            </div>
        </button>
        <button class="stat-pill" class:active={statusFilter === 'absent'} on:click={() => statusFilter = 'absent'}>
            <div class="stat-icon absent">
                <IconAlertCircle size={18} stroke={1.5} />
            </div>
            <div class="stat-content">
                <span class="stat-count absent">{stats.absent}</span>
                <span class="stat-label">Absent</span>
            </div>
        </button>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
        <div class="search-container">
            <IconSearch size={18} stroke={1.5} />
            <input 
                type="text" 
                placeholder="Search by name or email..." 
                bind:value={searchQuery}
                class="search-input"
            />
            {#if searchQuery}
                <button class="search-clear" on:click={clearSearch}>
                    <IconX size={16} stroke={2} />
                </button>
            {/if}
        </div>
        <div class="toolbar-right">
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
    </div>

    <!-- Filter Panel -->
    {#if showFilters}
        <div class="filter-panel">
            <div class="filter-group">
                <label class="filter-label">Date Range</label>
                <div class="date-toggle">
                    <button 
                        class="toggle-btn" 
                        class:active={showAllDates}
                        on:click={() => { showAllDates = true; loadAttendance(); }}
                    >
                        All Dates
                    </button>
                    <button 
                        class="toggle-btn" 
                        class:active={!showAllDates}
                        on:click={() => { showAllDates = false; loadAttendance(); }}
                    >
                        Specific Date
                    </button>
                </div>
            </div>
            {#if !showAllDates}
                <div class="filter-group">
                    <label class="filter-label">Select Date</label>
                    <div class="date-picker">
                        <IconCalendar size={18} stroke={1.5} />
                        <input type="date" bind:value={selectedDate} on:change={loadAttendance} />
                    </div>
                </div>
            {/if}
            {#if activeFiltersCount > 0}
                <button class="clear-filters" on:click={() => { statusFilter = 'all'; showAllDates = true; loadAttendance(); }}>
                    Clear all
                </button>
            {/if}
        </div>
    {/if}

    <!-- Table -->
    <div class="table-wrapper">
        {#if isLoading}
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading attendance records...</p>
            </div>
        {:else if paginatedAttendance.length === 0}
            <div class="empty-state">
                <div class="empty-icon">
                    <IconClockHour4 size={48} stroke={1} />
                </div>
                <h3>No records found</h3>
                <p>Try adjusting your filters or selecting a different date</p>
            </div>
        {:else}
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Date</th>
                            <th>Check In</th>
                            <th>Check Out</th>
                            <th>Status</th>
                            <th>Duration</th>
                            <th>Location</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each paginatedAttendance as record, index}
                            <tr class="stagger-item" style="animation-delay: {Math.min(index * 20, 200)}ms">
                                <td>
                                    <div class="user-cell">
                                        <div class="user-avatar">
                                            <span>{record.userName?.charAt(0)?.toUpperCase() || 'U'}</span>
                                        </div>
                                        <div class="user-info">
                                            <span class="user-name">{record.userName || 'Unknown'}</span>
                                            {#if record.department}
                                                <span class="user-dept">{record.department}</span>
                                            {/if}
                                        </div>
                                    </div>
                                </td>
                                <td>
                                    <span class="date-cell">{formatDate(record.date)}</span>
                                </td>
                                <td>
                                    <span class="time-cell">{formatTime(record.checkIn)}</span>
                                </td>
                                <td>
                                    <span class="time-cell">{formatTime(record.checkOut)}</span>
                                </td>
                                <td>
                                    <span class="status-badge {getStatusClass(record.status)}">
                                        {getStatusLabel(record.status)}
                                    </span>
                                </td>
                                <td>
                                    <span class="duration-cell">{record.duration || '—'}</span>
                                </td>
                                <td>
                                    {#if record.location}
                                        <span class="location-cell">
                                            <IconMapPin size={14} stroke={1.5} />
                                            <span>{typeof record.location === 'string' ? record.location.split(',')[0] : (record.location?.name || record.location?.address || '—')}</span>
                                        </span>
                                    {:else}
                                        <span class="no-data">—</span>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            {#if totalPages > 1}
                <div class="pagination">
                    <span class="pagination-info">
                        {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredAttendance.length)} of {filteredAttendance.length}
                    </span>
                    <div class="pagination-controls">
                        <button class="page-btn" disabled={currentPage === 1} on:click={() => currentPage--}>
                            <IconChevronLeft size={18} stroke={2} />
                        </button>
                        <span class="page-indicator">{currentPage} / {totalPages}</span>
                        <button class="page-btn" disabled={currentPage >= totalPages} on:click={() => currentPage++}>
                            <IconChevronRight size={18} stroke={2} />
                        </button>
                    </div>
                </div>
            {/if}
        {/if}
    </div>
</div>


<style>
    /* Page Layout */
    .attendance-page {
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
        background: linear-gradient(135deg, var(--apple-green), #30D158);
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 4px 12px rgba(52, 199, 89, 0.25);
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

    .btn-icon:hover:not(:disabled) {
        background: var(--theme-border-light);
        color: var(--theme-text);
    }

    .btn-icon:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    /* Stats Row */
    .stats-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 12px;
        margin-bottom: 24px;
    }

    .stat-pill {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 16px 20px;
        background: var(--theme-card-bg);
        border: 1px solid var(--theme-border);
        border-radius: 16px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
    }

    .stat-pill:hover {
        border-color: var(--apple-accent);
        box-shadow: 0 2px 12px rgba(0, 122, 255, 0.08);
    }

    .stat-pill.active {
        border-color: var(--apple-accent);
        background: rgba(0, 122, 255, 0.04);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }

    .stat-icon {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .stat-icon.total {
        background: rgba(0, 122, 255, 0.1);
        color: var(--apple-accent);
    }

    .stat-icon.present {
        background: rgba(52, 199, 89, 0.1);
        color: var(--apple-green);
    }

    .stat-icon.late {
        background: rgba(255, 149, 0, 0.1);
        color: var(--apple-orange);
    }

    .stat-icon.absent {
        background: rgba(255, 59, 48, 0.1);
        color: var(--apple-red);
    }

    .stat-content {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .stat-count {
        font-size: 24px;
        font-weight: 700;
        color: var(--theme-text);
        line-height: 1;
    }

    .stat-count.present { color: var(--apple-green); }
    .stat-count.late { color: var(--apple-orange); }
    .stat-count.absent { color: var(--apple-red); }

    .stat-label {
        font-size: 13px;
        color: var(--theme-text-secondary);
    }

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

    .toolbar-right {
        display: flex;
        gap: 8px;
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
        gap: 20px;
        padding: 20px 24px;
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
        gap: 8px;
    }

    .filter-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--theme-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .date-toggle {
        display: flex;
        background: var(--theme-border-light);
        border-radius: 10px;
        padding: 4px;
    }

    .toggle-btn {
        padding: 10px 16px;
        border: none;
        background: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        color: var(--theme-text-secondary);
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .toggle-btn.active {
        background: var(--theme-card-bg);
        color: var(--theme-text);
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .date-picker {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: var(--theme-border-light);
        border: 1px solid transparent;
        border-radius: 10px;
        transition: all 0.2s ease;
    }

    .date-picker:focus-within {
        border-color: var(--apple-accent);
        background: var(--theme-card-bg);
    }

    .date-picker :global(svg) {
        color: var(--theme-text-secondary);
    }

    .date-picker input {
        border: none;
        background: none;
        outline: none;
        font-size: 14px;
        color: var(--theme-text);
    }

    .clear-filters {
        padding: 12px 18px;
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

    /* Table */
    .table-wrapper {
        background: var(--theme-card-bg);
        border: 1px solid var(--theme-border);
        border-radius: 20px;
        overflow: hidden;
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

    .loading-state p {
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

    .empty-state p {
        font-size: 14px;
        color: var(--theme-text-secondary);
        margin: 0;
    }

    .table-container {
        overflow-x: auto;
    }

    .data-table {
        width: 100%;
        border-collapse: collapse;
    }

    .data-table thead {
        background: var(--theme-border-light);
    }

    .data-table th {
        padding: 14px 20px;
        text-align: left;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--theme-text-secondary);
        border-bottom: 1px solid var(--theme-border);
    }

    .data-table td {
        padding: 16px 20px;
        font-size: 14px;
        color: var(--theme-text);
        border-bottom: 1px solid var(--theme-border-light);
        vertical-align: middle;
    }

    .data-table tbody tr {
        transition: background 0.15s ease;
    }

    .data-table tbody tr:hover {
        background: rgba(0, 122, 255, 0.02);
    }

    .data-table tbody tr:last-child td {
        border-bottom: none;
    }

    /* User Cell */
    .user-cell {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--apple-accent), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .user-avatar span {
        color: white;
        font-size: 15px;
        font-weight: 600;
    }

    .user-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .user-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text);
    }

    .user-dept {
        font-size: 12px;
        color: var(--theme-text-secondary);
    }

    /* Cell Styles */
    .date-cell {
        font-weight: 500;
    }

    .time-cell {
        font-family: 'SF Mono', 'Menlo', monospace;
        font-size: 13px;
        color: var(--theme-text-secondary);
    }

    .duration-cell {
        font-family: 'SF Mono', 'Menlo', monospace;
        font-size: 13px;
    }

    .no-data {
        color: var(--theme-text-secondary);
    }

    /* Status Badge */
    .status-badge {
        display: inline-flex;
        align-items: center;
        padding: 6px 12px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
    }

    .status-badge.present {
        background: rgba(52, 199, 89, 0.1);
        color: var(--apple-green);
    }

    .status-badge.late {
        background: rgba(255, 149, 0, 0.1);
        color: var(--apple-orange);
    }

    .status-badge.absent {
        background: rgba(255, 59, 48, 0.1);
        color: var(--apple-red);
    }

    .status-badge.break {
        background: rgba(0, 122, 255, 0.1);
        color: var(--apple-accent);
    }

    /* Location Cell */
    .location-cell {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--theme-text-secondary);
    }

    .location-cell :global(svg) {
        color: var(--apple-accent);
    }

    /* Pagination */
    .pagination {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        border-top: 1px solid var(--theme-border-light);
    }

    .pagination-info {
        font-size: 13px;
        color: var(--theme-text-secondary);
    }

    .pagination-controls {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .page-btn {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--theme-border-light);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--theme-text-secondary);
        cursor: pointer;
        transition: all 0.15s ease;
    }

    .page-btn:hover:not(:disabled) {
        background: var(--theme-border);
        color: var(--theme-text);
    }

    .page-btn:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .page-indicator {
        font-size: 14px;
        font-weight: 500;
        color: var(--theme-text);
        min-width: 60px;
        text-align: center;
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    /* Responsive */
    @media (max-width: 1024px) {
        .stats-row {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    @media (max-width: 768px) {
        .attendance-page {
            padding: 20px 16px;
        }

        .page-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
        }

        .header-actions {
            width: 100%;
            justify-content: flex-end;
        }

        .stats-row {
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        }

        .stat-pill {
            padding: 14px 16px;
            gap: 12px;
        }

        .stat-icon {
            width: 36px;
            height: 36px;
        }

        .stat-count {
            font-size: 20px;
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

        .date-toggle {
            width: 100%;
        }

        .toggle-btn {
            flex: 1;
        }

        .data-table th,
        .data-table td {
            padding: 12px 16px;
        }

        .data-table th:nth-child(6),
        .data-table td:nth-child(6),
        .data-table th:nth-child(7),
        .data-table td:nth-child(7) {
            display: none;
        }
    }
</style>
