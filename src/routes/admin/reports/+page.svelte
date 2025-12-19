<script>
    import { onMount } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { 
        IconFileAnalytics, IconDownload, IconCalendar, IconLoader2, 
        IconChartBar, IconUsers, IconClockHour4, IconAlertTriangle,
        IconCheck, IconTrendingUp, IconTrendingDown, IconBuilding,
        IconClock, IconRefresh, IconFilter, IconTable, IconChartPie
    } from "@tabler/icons-svelte";

    let isLoading = false;
    let reportType = 'attendance';
    let dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    let dateTo = new Date().toISOString().split('T')[0];
    let selectedDepartment = '';
    let reportData = null;
    let error = null;
    let viewMode = 'summary'; // 'summary' or 'table'
    let departments = [];

    const reportTypes = [
        { id: 'attendance', label: 'Attendance Report', icon: IconClockHour4, description: 'Detailed attendance records with check-in/out times' },
        { id: 'users', label: 'User Activity Report', icon: IconUsers, description: 'Per-user attendance summary and punctuality rates' },
        { id: 'summary', label: 'Summary Report', icon: IconChartBar, description: 'High-level overview with trends and insights' }
    ];

    const quickDateRanges = [
        { label: 'Today', days: 0 },
        { label: 'Last 7 Days', days: 7 },
        { label: 'Last 30 Days', days: 30 },
        { label: 'Last 90 Days', days: 90 },
        { label: 'This Month', days: 'month' },
        { label: 'This Year', days: 'year' }
    ];

    function setQuickRange(range) {
        const today = new Date();
        dateTo = today.toISOString().split('T')[0];
        
        if (range.days === 'month') {
            dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
        } else if (range.days === 'year') {
            dateFrom = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        } else if (range.days === 0) {
            dateFrom = dateTo;
        } else {
            dateFrom = new Date(Date.now() - range.days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }
    }

    async function generateReport() {
        isLoading = true;
        error = null;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            let url = `/api/admin/reports?type=${reportType}&from=${dateFrom}&to=${dateTo}`;
            if (selectedDepartment) url += `&department=${encodeURIComponent(selectedDepartment)}`;
            
            const response = await fetch(url, {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            
            if (response.ok) {
                reportData = await response.json();
                // Extract departments from data
                if (reportData.departmentData) {
                    departments = reportData.departmentData.map(d => d.name);
                }
            } else {
                const err = await response.json();
                error = err.error || 'Failed to generate report';
            }
        } catch (err) {
            console.error('Failed to generate report:', err);
            error = 'Failed to connect to server';
        } finally {
            isLoading = false;
        }
    }

    function downloadReport(format) {
        const { accessToken } = adminAuthStore.getStoredTokens();
        let url = `/api/admin/reports/download?type=${reportType}&from=${dateFrom}&to=${dateTo}&format=${format}&token=${accessToken}`;
        if (selectedDepartment) url += `&department=${encodeURIComponent(selectedDepartment)}`;
        window.open(url, '_blank');
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatTime(timestamp) {
        if (!timestamp) return '-';
        return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    onMount(() => {
        generateReport();
    });
</script>

<svelte:head>
    <title>Reports | Admin Panel</title>
</svelte:head>

<div class="reports-page">
    <header class="page-header">
        <div class="header-content">
            <h1>Reports</h1>
            <p class="header-subtitle">Generate and analyze attendance data with real-time insights</p>
        </div>
        <button class="refresh-btn" on:click={generateReport} disabled={isLoading}>
            <IconRefresh size={18} stroke={2} class={isLoading ? 'spin' : ''} />
            Refresh
        </button>
    </header>

    <div class="reports-layout">
        <!-- Sidebar Configuration -->
        <aside class="config-sidebar apple-card">
            <h2>Report Configuration</h2>
            
            <!-- Report Type Selection -->
            <div class="form-section">
                <label class="section-label">Report Type</label>
                <div class="report-types">
                    {#each reportTypes as type}
                        <button 
                            class="type-btn" 
                            class:active={reportType === type.id} 
                            on:click={() => { reportType = type.id; reportData = null; }}
                        >
                            <svelte:component this={type.icon} size={20} stroke={1.5} />
                            <div class="type-info">
                                <span class="type-label">{type.label}</span>
                                <span class="type-desc">{type.description}</span>
                            </div>
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Quick Date Ranges -->
            <div class="form-section">
                <label class="section-label">Quick Select</label>
                <div class="quick-ranges">
                    {#each quickDateRanges as range}
                        <button class="quick-btn" on:click={() => setQuickRange(range)}>
                            {range.label}
                        </button>
                    {/each}
                </div>
            </div>

            <!-- Date Range -->
            <div class="form-section">
                <label class="section-label">Date Range</label>
                <div class="date-range">
                    <div class="date-input">
                        <IconCalendar size={16} stroke={1.5} />
                        <input type="date" bind:value={dateFrom} />
                    </div>
                    <div class="date-input">
                        <IconCalendar size={16} stroke={1.5} />
                        <input type="date" bind:value={dateTo} />
                    </div>
                </div>
            </div>

            <!-- Department Filter -->
            {#if departments.length > 0}
                <div class="form-section">
                    <label class="section-label">Department</label>
                    <select class="dept-select" bind:value={selectedDepartment}>
                        <option value="">All Departments</option>
                        {#each departments as dept}
                            <option value={dept}>{dept}</option>
                        {/each}
                    </select>
                </div>
            {/if}

            <!-- Generate Button -->
            <button class="generate-btn" on:click={generateReport} disabled={isLoading}>
                {#if isLoading}
                    <IconLoader2 size={18} stroke={2} class="spin" />
                    Generating...
                {:else}
                    <IconFileAnalytics size={18} stroke={2} />
                    Generate Report
                {/if}
            </button>
        </aside>

        <!-- Main Content -->
        <main class="report-content">
            {#if error}
                <div class="error-state apple-card">
                    <IconAlertTriangle size={48} stroke={1.5} />
                    <p>{error}</p>
                    <button class="retry-btn" on:click={generateReport}>Try Again</button>
                </div>
            {:else if !reportData}
                <div class="empty-state apple-card">
                    <IconFileAnalytics size={64} stroke={1} />
                    <h3>Generate a Report</h3>
                    <p>Select your report type and date range, then click Generate Report</p>
                </div>
            {:else}
                <!-- Report Header -->
                <div class="report-header apple-card">
                    <div class="report-title">
                        <h2>
                            {reportTypes.find(t => t.id === reportType)?.label || 'Report'}
                        </h2>
                        <span class="date-badge">
                            {formatDate(dateFrom)} - {formatDate(dateTo)}
                        </span>
                    </div>
                    <div class="report-actions">
                        <div class="view-toggle">
                            <button class:active={viewMode === 'summary'} on:click={() => viewMode = 'summary'}>
                                <IconChartPie size={16} stroke={2} /> Summary
                            </button>
                            <button class:active={viewMode === 'table'} on:click={() => viewMode = 'table'}>
                                <IconTable size={16} stroke={2} /> Table
                            </button>
                        </div>
                        <div class="download-btns">
                            <button class="download-btn" on:click={() => downloadReport('csv')}>
                                <IconDownload size={16} stroke={2} /> CSV
                            </button>
                            <button class="download-btn" on:click={() => downloadReport('pdf')}>
                                <IconDownload size={16} stroke={2} /> PDF
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Summary Stats -->
                <div class="stats-grid">
                    <div class="stat-card apple-card">
                        <div class="stat-icon blue">
                            <IconFileAnalytics size={24} stroke={1.5} />
                        </div>
                        <div class="stat-info">
                            <span class="stat-value">{reportData.totalRecords?.toLocaleString() || 0}</span>
                            <span class="stat-label">Total Records</span>
                        </div>
                    </div>
                    <div class="stat-card apple-card">
                        <div class="stat-icon green">
                            <IconUsers size={24} stroke={1.5} />
                        </div>
                        <div class="stat-info">
                            <span class="stat-value">{reportData.uniqueUsers?.toLocaleString() || 0}</span>
                            <span class="stat-label">Unique Users</span>
                        </div>
                    </div>
                    <div class="stat-card apple-card">
                        <div class="stat-icon" class:green={reportData.averageAttendance >= 80} class:orange={reportData.averageAttendance < 80 && reportData.averageAttendance >= 60} class:red={reportData.averageAttendance < 60}>
                            <IconTrendingUp size={24} stroke={1.5} />
                        </div>
                        <div class="stat-info">
                            <span class="stat-value">{reportData.averageAttendance || 0}%</span>
                            <span class="stat-label">Avg Attendance</span>
                        </div>
                    </div>
                    <div class="stat-card apple-card">
                        <div class="stat-icon orange">
                            <IconClock size={24} stroke={1.5} />
                        </div>
                        <div class="stat-info">
                            <span class="stat-value">{reportData.latePercentage || reportData.totalLate || 0}{reportData.latePercentage !== undefined ? '%' : ''}</span>
                            <span class="stat-label">{reportData.latePercentage !== undefined ? 'Late Rate' : 'Late Arrivals'}</span>
                        </div>
                    </div>
                </div>

                {#if viewMode === 'summary'}
                    <!-- Charts and Insights -->
                    <div class="charts-grid">
                        <!-- Daily Trend Chart -->
                        {#if reportData.dailyData?.length > 0}
                            <div class="chart-card apple-card">
                                <h3>Daily Attendance Trend</h3>
                                <div class="bar-chart">
                                    {#each reportData.dailyData.slice(-14) as day}
                                        <div class="bar-item">
                                            <div class="bar-container">
                                                <div 
                                                    class="bar" 
                                                    style="height: {Math.max(5, (day.present / (reportData.totalUsers || reportData.uniqueUsers || 1)) * 100)}%"
                                                    class:low={day.attendanceRate < 70}
                                                ></div>
                                            </div>
                                            <span class="bar-label">{new Date(day.date).getDate()}</span>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        <!-- Department Breakdown -->
                        {#if reportData.departmentData?.length > 0}
                            <div class="chart-card apple-card">
                                <h3>Department Breakdown</h3>
                                <div class="dept-list">
                                    {#each reportData.departmentData.slice(0, 8) as dept}
                                        <div class="dept-item">
                                            <div class="dept-info">
                                                <IconBuilding size={16} stroke={1.5} />
                                                <span class="dept-name">{dept.name}</span>
                                            </div>
                                            <div class="dept-stats">
                                                <div class="progress-bar">
                                                    <div 
                                                        class="progress" 
                                                        style="width: {dept.attendanceRate || 0}%"
                                                        class:low={dept.attendanceRate < 70}
                                                    ></div>
                                                </div>
                                                <span class="dept-rate">{dept.attendanceRate || 0}%</span>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        <!-- Hourly Distribution -->
                        {#if reportData.hourlyData?.length > 0}
                            <div class="chart-card apple-card">
                                <h3>Check-in Time Distribution</h3>
                                <div class="hourly-chart">
                                    {#each reportData.hourlyData as hour}
                                        {@const maxCount = Math.max(...reportData.hourlyData.map(h => h.count))}
                                        <div class="hour-bar">
                                            <div 
                                                class="hour-fill" 
                                                style="width: {maxCount > 0 ? (hour.count / maxCount) * 100 : 0}%"
                                                class:peak={hour.count === maxCount && maxCount > 0}
                                            ></div>
                                            <span class="hour-label">{hour.label}</span>
                                            <span class="hour-count">{hour.count}</span>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}

                        <!-- Weekday Pattern -->
                        {#if reportData.weekdayData?.length > 0}
                            <div class="chart-card apple-card">
                                <h3>Weekday Pattern</h3>
                                <div class="weekday-chart">
                                    {#each reportData.weekdayData as day}
                                        {@const maxAvg = Math.max(...reportData.weekdayData.map(d => d.avgAttendance))}
                                        <div class="weekday-item">
                                            <span class="weekday-name">{day.day.slice(0, 3)}</span>
                                            <div class="weekday-bar">
                                                <div 
                                                    class="weekday-fill" 
                                                    style="height: {maxAvg > 0 ? (day.avgAttendance / maxAvg) * 100 : 0}%"
                                                ></div>
                                            </div>
                                            <span class="weekday-value">{day.avgAttendance}</span>
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>

                    <!-- Insights -->
                    {#if reportData.insights?.length > 0}
                        <div class="insights-card apple-card">
                            <h3>Insights & Recommendations</h3>
                            <div class="insights-list">
                                {#each reportData.insights as insight}
                                    <div class="insight-item" class:positive={insight.type === 'positive'} class:warning={insight.type === 'warning'} class:info={insight.type === 'info'}>
                                        {#if insight.type === 'positive'}
                                            <IconCheck size={18} stroke={2} />
                                        {:else if insight.type === 'warning'}
                                            <IconAlertTriangle size={18} stroke={2} />
                                        {:else}
                                            <IconTrendingUp size={18} stroke={2} />
                                        {/if}
                                        <span>{insight.message}</span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- User Activity specific stats -->
                    {#if reportType === 'users' && reportData.users}
                        <div class="users-summary apple-card">
                            <h3>User Statistics</h3>
                            <div class="user-stats-grid">
                                <div class="user-stat">
                                    <span class="user-stat-value green">{reportData.usersWithPerfectAttendance || 0}</span>
                                    <span class="user-stat-label">Perfect Attendance</span>
                                </div>
                                <div class="user-stat">
                                    <span class="user-stat-value red">{reportData.usersWithLowAttendance || 0}</span>
                                    <span class="user-stat-label">Low Attendance (&lt;70%)</span>
                                </div>
                                <div class="user-stat">
                                    <span class="user-stat-value blue">{reportData.avgPunctualityRate || 0}%</span>
                                    <span class="user-stat-label">Avg Punctuality</span>
                                </div>
                            </div>
                        </div>
                    {/if}
                {:else}
                    <!-- Table View -->
                    <div class="table-card apple-card">
                        {#if reportType === 'attendance' && reportData.records}
                            <div class="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Name</th>
                                            <th>Department</th>
                                            <th>Check In</th>
                                            <th>Check Out</th>
                                            <th>Status</th>
                                            <th>Duration</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each reportData.records.slice(0, 100) as record}
                                            <tr>
                                                <td>{formatDate(record.date)}</td>
                                                <td>
                                                    <div class="user-cell">
                                                        <span class="user-name">{record.userName}</span>
                                                        <span class="user-email">{record.userEmail}</span>
                                                    </div>
                                                </td>
                                                <td>{record.department}</td>
                                                <td>{formatTime(record.checkIn)}</td>
                                                <td>{formatTime(record.checkOut)}</td>
                                                <td>
                                                    <span class="status-badge" class:late={record.status === 'late'} class:present={record.status === 'present'}>
                                                        {record.status}
                                                    </span>
                                                </td>
                                                <td>{record.duration}</td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                            {#if reportData.records.length > 100}
                                <p class="table-note">Showing first 100 records. Download CSV for complete data.</p>
                            {/if}
                        {:else if reportType === 'users' && reportData.users}
                            <div class="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Department</th>
                                            <th>Present Days</th>
                                            <th>Absent Days</th>
                                            <th>Late Days</th>
                                            <th>Attendance Rate</th>
                                            <th>Avg Check-in</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each reportData.users.slice(0, 100) as user}
                                            <tr>
                                                <td>
                                                    <div class="user-cell">
                                                        <span class="user-name">{user.userName}</span>
                                                        <span class="user-email">{user.userEmail}</span>
                                                    </div>
                                                </td>
                                                <td>{user.department}</td>
                                                <td class="text-green">{user.presentDays}</td>
                                                <td class="text-red">{user.absentDays}</td>
                                                <td class="text-orange">{user.lateDays}</td>
                                                <td>
                                                    <div class="rate-cell">
                                                        <div class="mini-progress">
                                                            <div class="mini-fill" style="width: {user.attendanceRate}%" class:low={user.attendanceRate < 70}></div>
                                                        </div>
                                                        <span>{user.attendanceRate}%</span>
                                                    </div>
                                                </td>
                                                <td>{user.avgCheckInTime || '-'}</td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        {:else}
                            <p class="no-table-data">Switch to Summary view for this report type</p>
                        {/if}
                    </div>
                {/if}
            {/if}
        </main>
    </div>
</div>


<style>
    .reports-page { padding: 24px; max-width: 1600px; margin: 0 auto; }
    
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h1 { font-size: 32px; font-weight: 700; color: var(--theme-text, var(--apple-black)); margin-bottom: 4px; }
    .header-subtitle { font-size: 15px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    
    .refresh-btn { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--theme-border-light, var(--apple-gray-6)); border: none; border-radius: var(--apple-radius-md); font-size: 14px; color: var(--theme-text-secondary, var(--apple-gray-1)); cursor: pointer; transition: var(--apple-transition); }
    .refresh-btn:hover { background: var(--theme-border, var(--apple-gray-5)); }
    .refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    
    .reports-layout { display: grid; grid-template-columns: 320px 1fr; gap: 24px; }
    
    /* Sidebar */
    .config-sidebar { padding: 24px; position: sticky; top: 24px; height: fit-content; }
    .config-sidebar h2 { font-size: 18px; font-weight: 600; margin-bottom: 24px; color: var(--theme-text, var(--apple-black)); }
    
    .form-section { margin-bottom: 24px; }
    .section-label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--theme-text-secondary, var(--apple-gray-1)); margin-bottom: 10px; letter-spacing: 0.5px; }
    
    .report-types { display: flex; flex-direction: column; gap: 8px; }
    .type-btn { display: flex; align-items: flex-start; gap: 12px; padding: 14px; background: var(--theme-border-light, var(--apple-gray-6)); border: 2px solid transparent; border-radius: var(--apple-radius-md); cursor: pointer; transition: var(--apple-transition); text-align: left; }
    .type-btn:hover { background: var(--theme-border, var(--apple-gray-5)); }
    .type-btn.active { background: rgba(0, 122, 255, 0.1); border-color: var(--apple-accent); }
    .type-btn.active :global(svg) { color: var(--apple-accent); }
    .type-info { display: flex; flex-direction: column; gap: 2px; }
    .type-label { font-size: 14px; font-weight: 500; color: var(--theme-text, var(--apple-black)); }
    .type-desc { font-size: 11px; color: var(--theme-text-secondary, var(--apple-gray-1)); line-height: 1.4; }
    
    .quick-ranges { display: flex; flex-wrap: wrap; gap: 6px; }
    .quick-btn { padding: 6px 12px; background: var(--theme-border-light, var(--apple-gray-6)); border: none; border-radius: var(--apple-radius-sm); font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); cursor: pointer; transition: var(--apple-transition); }
    .quick-btn:hover { background: var(--apple-accent); color: white; }
    
    .date-range { display: flex; flex-direction: column; gap: 8px; }
    .date-input { display: flex; align-items: center; gap: 8px; background: var(--theme-card-bg, var(--apple-white)); border: 1px solid var(--theme-border, var(--apple-gray-4)); border-radius: var(--apple-radius-md); padding: 10px 12px; width: 100%; box-sizing: border-box; }
    .date-input :global(svg) { flex-shrink: 0; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .date-input input { border: none; background: none; outline: none; font-size: 14px; color: var(--theme-text, var(--apple-black)); width: 100%; min-width: 0; }
    .date-input input::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
    .date-input input::-webkit-calendar-picker-indicator:hover { opacity: 1; }
    
    .dept-select { width: 100%; padding: 10px 12px; background: var(--theme-card-bg, var(--apple-white)); border: 1px solid var(--theme-border, var(--apple-gray-4)); border-radius: var(--apple-radius-md); font-size: 14px; color: var(--theme-text, var(--apple-black)); }
    
    .generate-btn { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; background: var(--apple-accent); border: none; border-radius: var(--apple-radius-md); font-size: 15px; font-weight: 500; color: white; cursor: pointer; transition: var(--apple-transition); }
    .generate-btn:hover { background: #0066d6; }
    .generate-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    
    /* Main Content */
    .report-content { min-width: 0; }
    
    .empty-state, .error-state { text-align: center; padding: 80px 40px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .empty-state h3 { font-size: 20px; font-weight: 600; color: var(--theme-text, var(--apple-black)); margin: 16px 0 8px; }
    .empty-state p, .error-state p { font-size: 14px; margin-top: 8px; }
    .retry-btn { margin-top: 16px; padding: 10px 20px; background: var(--apple-accent); border: none; border-radius: var(--apple-radius-md); color: white; font-size: 14px; cursor: pointer; }
    
    .report-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; margin-bottom: 20px; }
    .report-title { display: flex; align-items: center; gap: 12px; }
    .report-title h2 { font-size: 20px; font-weight: 600; color: var(--theme-text, var(--apple-black)); }
    .date-badge { padding: 4px 10px; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: var(--apple-radius-sm); font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    
    .report-actions { display: flex; align-items: center; gap: 12px; }
    .view-toggle { display: flex; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: var(--apple-radius-md); padding: 4px; }
    .view-toggle button { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: none; border: none; border-radius: var(--apple-radius-sm); font-size: 13px; color: var(--theme-text-secondary, var(--apple-gray-1)); cursor: pointer; transition: var(--apple-transition); }
    .view-toggle button.active { background: var(--theme-card-bg, var(--apple-white)); color: var(--theme-text, var(--apple-black)); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    
    .download-btns { display: flex; gap: 8px; }
    .download-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--theme-border-light, var(--apple-gray-6)); border: none; border-radius: var(--apple-radius-md); font-size: 13px; color: var(--theme-text-secondary, var(--apple-gray-1)); cursor: pointer; transition: var(--apple-transition); }
    .download-btn:hover { background: var(--theme-border, var(--apple-gray-5)); }
    
    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; }
    .stat-card { display: flex; align-items: center; gap: 16px; padding: 20px; }
    .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .stat-icon.blue { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }
    .stat-icon.green { background: rgba(52, 199, 89, 0.1); color: #34c759; }
    .stat-icon.orange { background: rgba(255, 149, 0, 0.1); color: #ff9500; }
    .stat-icon.red { background: rgba(255, 59, 48, 0.1); color: #ff3b30; }
    .stat-info { display: flex; flex-direction: column; }
    .stat-value { font-size: 28px; font-weight: 700; color: var(--theme-text, var(--apple-black)); }
    .stat-label { font-size: 13px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    
    /* Charts Grid */
    .charts-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 20px; }
    .chart-card { padding: 24px; }
    .chart-card h3 { font-size: 16px; font-weight: 600; color: var(--theme-text, var(--apple-black)); margin-bottom: 20px; }
    
    /* Bar Chart */
    .bar-chart { display: flex; align-items: flex-end; gap: 8px; height: 160px; padding-top: 20px; }
    .bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; }
    .bar-container { flex: 1; width: 100%; display: flex; align-items: flex-end; }
    .bar { width: 100%; background: var(--apple-accent); border-radius: 4px 4px 0 0; transition: height 0.3s ease; min-height: 4px; }
    .bar.low { background: #ff9500; }
    .bar-label { font-size: 10px; color: var(--theme-text-secondary, var(--apple-gray-1)); margin-top: 8px; }
    
    /* Department List */
    .dept-list { display: flex; flex-direction: column; gap: 12px; }
    .dept-item { display: flex; justify-content: space-between; align-items: center; }
    .dept-info { display: flex; align-items: center; gap: 8px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .dept-name { font-size: 14px; color: var(--theme-text, var(--apple-black)); }
    .dept-stats { display: flex; align-items: center; gap: 12px; flex: 1; max-width: 200px; }
    .progress-bar { flex: 1; height: 6px; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: 3px; overflow: hidden; }
    .progress { height: 100%; background: var(--apple-accent); border-radius: 3px; transition: width 0.3s ease; }
    .progress.low { background: #ff9500; }
    .dept-rate { font-size: 13px; font-weight: 600; color: var(--theme-text, var(--apple-black)); min-width: 40px; text-align: right; }
    
    /* Hourly Chart */
    .hourly-chart { display: flex; flex-direction: column; gap: 8px; }
    .hour-bar { display: flex; align-items: center; gap: 12px; }
    .hour-fill { height: 20px; background: var(--apple-accent); border-radius: 4px; transition: width 0.3s ease; min-width: 4px; }
    .hour-fill.peak { background: #34c759; }
    .hour-label { font-size: 11px; color: var(--theme-text-secondary, var(--apple-gray-1)); min-width: 70px; }
    .hour-count { font-size: 12px; font-weight: 500; color: var(--theme-text, var(--apple-black)); margin-left: auto; }
    
    /* Weekday Chart */
    .weekday-chart { display: flex; justify-content: space-between; align-items: flex-end; height: 140px; padding-top: 20px; }
    .weekday-item { display: flex; flex-direction: column; align-items: center; gap: 8px; flex: 1; }
    .weekday-name { font-size: 11px; color: var(--theme-text-secondary, var(--apple-gray-1)); order: 3; }
    .weekday-bar { width: 32px; height: 80px; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: 4px; display: flex; align-items: flex-end; overflow: hidden; }
    .weekday-fill { width: 100%; background: var(--apple-accent); border-radius: 4px; transition: height 0.3s ease; }
    .weekday-value { font-size: 12px; font-weight: 600; color: var(--theme-text, var(--apple-black)); order: 1; }
    
    /* Insights */
    .insights-card { padding: 24px; margin-bottom: 20px; }
    .insights-card h3 { font-size: 16px; font-weight: 600; color: var(--theme-text, var(--apple-black)); margin-bottom: 16px; }
    .insights-list { display: flex; flex-direction: column; gap: 10px; }
    .insight-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-radius: var(--apple-radius-md); font-size: 14px; }
    .insight-item.positive { background: rgba(52, 199, 89, 0.1); color: #34c759; }
    .insight-item.warning { background: rgba(255, 149, 0, 0.1); color: #ff9500; }
    .insight-item.info { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }
    .insight-item span { color: var(--theme-text, var(--apple-black)); }
    
    /* User Stats */
    .users-summary { padding: 24px; }
    .users-summary h3 { font-size: 16px; font-weight: 600; color: var(--theme-text, var(--apple-black)); margin-bottom: 16px; }
    .user-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .user-stat { text-align: center; padding: 20px; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: var(--apple-radius-md); }
    .user-stat-value { display: block; font-size: 32px; font-weight: 700; }
    .user-stat-value.green { color: #34c759; }
    .user-stat-value.red { color: #ff3b30; }
    .user-stat-value.blue { color: var(--apple-accent); }
    .user-stat-label { font-size: 13px; color: var(--theme-text-secondary, var(--apple-gray-1)); margin-top: 4px; }
    
    /* Table */
    .table-card { padding: 0; overflow: hidden; }
    .table-wrapper { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { background: var(--theme-border-light, var(--apple-gray-6)); padding: 14px 16px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--theme-text-secondary, var(--apple-gray-1)); letter-spacing: 0.5px; }
    td { padding: 14px 16px; border-bottom: 1px solid var(--theme-border, var(--apple-gray-5)); font-size: 14px; color: var(--theme-text, var(--apple-black)); }
    tr:hover td { background: var(--theme-border-light, rgba(0,0,0,0.02)); }
    
    .user-cell { display: flex; flex-direction: column; }
    .user-name { font-weight: 500; }
    .user-email { font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    
    .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize; }
    .status-badge.present { background: rgba(52, 199, 89, 0.1); color: #34c759; }
    .status-badge.late { background: rgba(255, 149, 0, 0.1); color: #ff9500; }
    
    .text-green { color: #34c759; }
    .text-red { color: #ff3b30; }
    .text-orange { color: #ff9500; }
    
    .rate-cell { display: flex; align-items: center; gap: 10px; }
    .mini-progress { width: 60px; height: 6px; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: 3px; overflow: hidden; }
    .mini-fill { height: 100%; background: #34c759; border-radius: 3px; }
    .mini-fill.low { background: #ff9500; }
    
    .table-note, .no-table-data { padding: 16px; text-align: center; font-size: 13px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    
    :global(.spin) { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    
    @media (max-width: 1200px) {
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
        .charts-grid { grid-template-columns: 1fr; }
    }
    
    @media (max-width: 900px) {
        .reports-layout { grid-template-columns: 1fr; }
        .config-sidebar { position: static; }
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
        .user-stats-grid { grid-template-columns: 1fr; }
    }
    
    @media (max-width: 600px) {
        .reports-page { padding: 16px; }
        .page-header { flex-direction: column; gap: 16px; }
        .stats-grid { grid-template-columns: 1fr; }
        .report-header { flex-direction: column; gap: 16px; align-items: flex-start; }
        .report-actions { width: 100%; flex-wrap: wrap; }
    }
</style>
