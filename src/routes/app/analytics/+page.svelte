<script>
    import { onMount } from 'svelte';
    import { auth, db } from '$lib/firebase';
    import { ref, get, query, orderByChild } from 'firebase/database';
    import { subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, format, parseISO } from 'date-fns';
    import AnalyticsChart from '$lib/components/AnalyticsChart.svelte';
    import {
        calculateAttendancePercentage,
        calculateLateStats,
        findMostLateDay,
        calculatePeakCheckInTime,
        calculateOvertimeStats,
        generateTrendData,
        generateWeeklySummary,
        getDayOfWeekStats
    } from '$lib/utils/attendanceAnalytics.js';
    import {
        IconChartBar, IconClock, IconCalendarStats, IconTrendingUp, IconAlertCircle,
        IconFlame, IconTarget, IconChevronDown, IconSun, IconMoon, IconX, IconFilter,
        IconCalendar, IconChevronRight
    } from "@tabler/icons-svelte";

    let isLoading = true;
    let records = [];
    let selectedPeriod = '30';

    // Analytics data
    let attendancePercentage = 0;
    let lateStats = { lateCount: 0, latePercentage: 0, avgLateMinutes: 0 };
    let mostLateDay = null;
    let peakCheckIn = null;
    let overtimeStats = { totalHours: 0, overtimeDays: 0, avgOvertimePerDay: 0 };
    let trendData = [];
    let weeklySummary = [];
    let dayOfWeekStats = [];

    // Weekly Summary Modal & Filter
    let showWeeklyModal = false;
    let weeklyFilterWeeks = '8';
    let weeklyStartDate = '';
    let weeklyEndDate = '';
    let filteredWeeklySummary = [];

    // Initialize date filters
    $: {
        if (!weeklyEndDate) {
            const today = new Date();
            weeklyEndDate = format(today, 'yyyy-MM-dd');
            weeklyStartDate = format(subDays(today, 56), 'yyyy-MM-dd'); // 8 weeks default
        }
    }

    // Filter weekly summary based on date range
    $: {
        if (weeklySummary.length > 0) {
            const weeks = parseInt(weeklyFilterWeeks);
            if (weeklyStartDate && weeklyEndDate) {
                const start = new Date(weeklyStartDate);
                const end = new Date(weeklyEndDate);
                filteredWeeklySummary = weeklySummary.filter(week => {
                    // Parse week label to get approximate date
                    const weekDate = week.startDate ? new Date(week.startDate) : null;
                    if (weekDate) {
                        return weekDate >= start && weekDate <= end;
                    }
                    return true;
                }).slice(0, weeks);
            } else {
                filteredWeeklySummary = weeklySummary.slice(0, weeks);
            }
        }
    }

    function openWeeklyModal() {
        showWeeklyModal = true;
        document.body.style.overflow = 'hidden';
    }

    function closeWeeklyModal() {
        showWeeklyModal = false;
        document.body.style.overflow = '';
    }

    function handleModalKeydown(e) {
        if (e.key === 'Escape') closeWeeklyModal();
    }

    function applyWeeklyFilter() {
        const weeks = parseInt(weeklyFilterWeeks);
        weeklySummary = generateWeeklySummary(records, weeks);
    }

    onMount(async () => {
        const user = auth.currentUser;
        if (user) {
            try {
                const attendanceRef = ref(db, `attendance/${user.uid}`);
                const attendanceQuery = query(attendanceRef, orderByChild('date'));
                const snapshot = await get(attendanceQuery);
                if (snapshot.exists()) {
                    snapshot.forEach((child) => {
                        records.push({ id: child.key, ...child.val() });
                    });
                    records.sort((a, b) => new Date(b.date) - new Date(a.date));
                    calculateAnalytics();
                }
            } catch (error) {
                console.error('Error loading attendance data:', error);
            }
        }
        isLoading = false;
    });

    function calculateAnalytics() {
        const days = parseInt(selectedPeriod);
        const endDate = new Date();
        const startDate = subDays(endDate, days);
        const filteredRecords = records.filter(r => new Date(r.date) >= startDate);

        // Calculate all metrics
        attendancePercentage = calculateAttendancePercentage(filteredRecords, startDate, endDate);
        lateStats = calculateLateStats(filteredRecords);
        mostLateDay = findMostLateDay(filteredRecords);
        peakCheckIn = calculatePeakCheckInTime(filteredRecords);
        overtimeStats = calculateOvertimeStats(filteredRecords);
        trendData = generateTrendData(records, days);
        weeklySummary = generateWeeklySummary(records, 8);
        dayOfWeekStats = getDayOfWeekStats(filteredRecords);
    }

    function formatMinutes(minutes) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    }

    $: if (selectedPeriod && records.length > 0) calculateAnalytics();
</script>

<svelte:head><title>Analytics | Attendance System</title></svelte:head>

<div class="analytics-page">
    {#if isLoading}
        <div class="loading-container apple-animate-in">
            <div class="apple-spinner"></div>
            <p class="loading-text">Analyzing your attendance...</p>
        </div>
    {:else}
        <div class="analytics-content apple-animate-in">
            <!-- Header -->
            <header class="page-header">
                <div class="header-text">
                    <h1 class="page-title">Analytics</h1>
                    <p class="page-subtitle">Your attendance insights at a glance</p>
                </div>
                <div class="period-selector">
                    <select bind:value={selectedPeriod} class="period-select">
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                    <IconChevronDown size={16} stroke={2} class="select-icon" />
                </div>
            </header>

            <!-- Summary Cards - Apple Health Style -->
            <section class="summary-section">
                <div class="summary-grid">
                    <!-- Attendance Ring -->
                    <div class="summary-card summary-card-large">
                        <div class="card-header">
                            <IconTarget size={20} stroke={1.5} class="card-icon icon-blue" />
                            <span class="card-label">Attendance Rate</span>
                        </div>
                        <div class="ring-container">
                            <AnalyticsChart 
                                type="ring" 
                                ringValue={attendancePercentage} 
                                ringMax={100}
                                ringLabel="{attendancePercentage}%"
                                ringSubLabel="Present"
                                color="blue"
                            />
                        </div>
                        <p class="card-insight">
                            {#if attendancePercentage >= 95}
                                Excellent attendance!
                            {:else if attendancePercentage >= 80}
                                Good consistency
                            {:else}
                                Room for improvement
                            {/if}
                        </p>
                    </div>

                    <!-- Late Frequency - with Ring -->
                    <div class="summary-card summary-card-ring">
                        <div class="card-header">
                            <IconAlertCircle size={18} stroke={1.5} class="card-icon icon-orange" />
                            <span class="card-label">On-Time Rate</span>
                        </div>
                        <div class="ring-container-small">
                            <AnalyticsChart 
                                type="ring" 
                                ringValue={100 - lateStats.latePercentage} 
                                ringMax={100}
                                ringLabel="{(100 - lateStats.latePercentage).toFixed(0)}%"
                                ringSubLabel="On Time"
                                color="orange"
                            />
                        </div>
                        <p class="card-insight-small">
                            {lateStats.lateCount} late ({lateStats.latePercentage}%)
                        </p>
                    </div>

                    <!-- Most Late Day -->
                    <div class="summary-card summary-card-ring">
                        <div class="card-header">
                            <IconCalendarStats size={18} stroke={1.5} class="card-icon icon-purple" />
                            <span class="card-label">Most Late Day</span>
                        </div>
                        <div class="stat-center">
                            <span class="stat-value-large">{mostLateDay?.day || 'None'}</span>
                            <span class="stat-sub">{mostLateDay ? `${mostLateDay.count} times` : 'No late days'}</span>
                        </div>
                    </div>

                    <!-- Peak Check-in - with Ring -->
                    <div class="summary-card summary-card-ring">
                        <div class="card-header">
                            <IconSun size={18} stroke={1.5} class="card-icon icon-green" />
                            <span class="card-label">Peak Check-in</span>
                        </div>
                        <div class="stat-center">
                            <span class="stat-value-large">{peakCheckIn?.time || '--'}</span>
                            <span class="stat-sub">{peakCheckIn ? `${peakCheckIn.count} check-ins` : 'No data'}</span>
                        </div>
                    </div>

                    <!-- Overtime - with Ring -->
                    <div class="summary-card summary-card-ring">
                        <div class="card-header">
                            <IconFlame size={18} stroke={1.5} class="card-icon icon-red" />
                            <span class="card-label">Overtime</span>
                        </div>
                        <div class="ring-container-small">
                            <AnalyticsChart 
                                type="ring" 
                                ringValue={Math.min(overtimeStats.overtimeDays, parseInt(selectedPeriod))} 
                                ringMax={parseInt(selectedPeriod)}
                                ringLabel="{overtimeStats.totalHours}h"
                                ringSubLabel="Total OT"
                                color="red"
                            />
                        </div>
                        <p class="card-insight-small">
                            {overtimeStats.overtimeDays} days • Avg {formatMinutes(overtimeStats.avgOvertimePerDay)}/day
                        </p>
                    </div>
                </div>
            </section>

            <!-- Daily Hours Trend Chart -->
            <section class="chart-section">
                <div class="chart-card">
                    <div class="chart-header">
                        <div>
                            <h3 class="chart-title">Daily Hours</h3>
                            <p class="chart-subtitle">Your work hours over time</p>
                        </div>
                        <IconTrendingUp size={20} stroke={1.5} class="chart-icon" />
                    </div>
                    <div class="chart-container">
                        <AnalyticsChart 
                            data={trendData} 
                            type="bar" 
                            height={140}
                            color="blue"
                            maxValue={12}
                        />
                    </div>
                    <div class="chart-legend">
                        <span class="legend-item"><span class="legend-dot legend-blue"></span> Work days</span>
                        <span class="legend-item"><span class="legend-dot legend-gray"></span> Weekends</span>
                    </div>
                </div>
            </section>

            <!-- Weekly Summary -->
            <section class="chart-section">
                <div class="chart-card">
                    <div class="chart-header">
                        <div>
                            <h3 class="chart-title">Weekly Summary</h3>
                            <p class="chart-subtitle">Hours worked per week</p>
                        </div>
                        <div class="chart-header-actions">
                            <div class="week-filter-inline">
                                <select bind:value={weeklyFilterWeeks} on:change={applyWeeklyFilter} class="week-filter-select">
                                    <option value="4">4 weeks</option>
                                    <option value="8">8 weeks</option>
                                    <option value="12">12 weeks</option>
                                    <option value="16">16 weeks</option>
                                </select>
                                <IconChevronDown size={14} stroke={2} class="filter-select-icon" />
                            </div>
                            <IconChartBar size={20} stroke={1.5} class="chart-icon" />
                        </div>
                    </div>
                    <div class="weekly-bars">
                        {#each weeklySummary.slice(0, 4) as week}
                            {@const percent = Math.min((week.totalHours / week.target) * 100, 100)}
                            <div class="week-bar-item">
                                <div class="week-bar-track">
                                    <div class="week-bar-fill" style="width: {percent}%"></div>
                                </div>
                                <div class="week-bar-info">
                                    <span class="week-label">{week.weekLabel}</span>
                                    <span class="week-hours">{week.totalHours}h</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                    {#if weeklySummary.length > 4}
                        <button class="show-more-btn" on:click={openWeeklyModal}>
                            <span>Show More</span>
                            <IconChevronRight size={16} stroke={2} />
                        </button>
                    {/if}
                </div>
            </section>

            <!-- Weekly Summary Modal -->
            {#if showWeeklyModal}
                <div class="modal-overlay" on:click={closeWeeklyModal} on:keydown={handleModalKeydown} role="dialog" aria-modal="true" aria-labelledby="weekly-modal-title">
                    <div class="modal-container" on:click|stopPropagation role="document">
                        <div class="modal-header">
                            <div class="modal-title-group">
                                <h2 id="weekly-modal-title" class="modal-title">Weekly Summary</h2>
                                <p class="modal-subtitle">Detailed breakdown of hours worked</p>
                            </div>
                            <button class="modal-close-btn" on:click={closeWeeklyModal} aria-label="Close modal">
                                <IconX size={20} stroke={2} />
                            </button>
                        </div>

                        <div class="modal-filters">
                            <div class="filter-group">
                                <label class="filter-label">
                                    <IconCalendar size={14} stroke={2} />
                                    <span>Date Range</span>
                                </label>
                                <div class="date-range-inputs">
                                    <input type="date" bind:value={weeklyStartDate} class="date-input" />
                                    <span class="date-separator">to</span>
                                    <input type="date" bind:value={weeklyEndDate} class="date-input" />
                                </div>
                            </div>
                            <div class="filter-group">
                                <label class="filter-label">
                                    <IconFilter size={14} stroke={2} />
                                    <span>Show Weeks</span>
                                </label>
                                <div class="filter-select-wrapper">
                                    <select bind:value={weeklyFilterWeeks} on:change={applyWeeklyFilter} class="modal-filter-select">
                                        <option value="4">4 weeks</option>
                                        <option value="8">8 weeks</option>
                                        <option value="12">12 weeks</option>
                                        <option value="16">16 weeks</option>
                                        <option value="24">24 weeks</option>
                                    </select>
                                    <IconChevronDown size={14} stroke={2} class="modal-select-icon" />
                                </div>
                            </div>
                        </div>

                        <div class="modal-content">
                            <div class="modal-stats-summary">
                                <div class="stat-pill">
                                    <span class="stat-pill-label">Total Hours</span>
                                    <span class="stat-pill-value">{filteredWeeklySummary.reduce((sum, w) => sum + w.totalHours, 0)}h</span>
                                </div>
                                <div class="stat-pill">
                                    <span class="stat-pill-label">Avg/Week</span>
                                    <span class="stat-pill-value">{filteredWeeklySummary.length > 0 ? Math.round(filteredWeeklySummary.reduce((sum, w) => sum + w.totalHours, 0) / filteredWeeklySummary.length) : 0}h</span>
                                </div>
                                <div class="stat-pill">
                                    <span class="stat-pill-label">Weeks</span>
                                    <span class="stat-pill-value">{filteredWeeklySummary.length}</span>
                                </div>
                            </div>

                            <div class="modal-weekly-list">
                                {#each filteredWeeklySummary as week, i}
                                    {@const percent = Math.min((week.totalHours / week.target) * 100, 100)}
                                    {@const isOverTarget = week.totalHours >= week.target}
                                    <div class="modal-week-item" class:over-target={isOverTarget}>
                                        <div class="week-item-header">
                                            <div class="week-item-info">
                                                <span class="week-item-label">{week.weekLabel}</span>
                                                {#if week.dateRange}
                                                    <span class="week-item-dates">{week.dateRange}</span>
                                                {/if}
                                            </div>
                                            <div class="week-item-stats">
                                                <span class="week-item-hours">{week.totalHours}h</span>
                                                <span class="week-item-target">/ {week.target}h target</span>
                                            </div>
                                        </div>
                                        <div class="week-item-bar-track">
                                            <div class="week-item-bar-fill" class:over-target={isOverTarget} style="width: {percent}%"></div>
                                        </div>
                                        <div class="week-item-details">
                                            <span class="week-detail">{week.daysWorked || 0} days worked</span>
                                            {#if week.avgHoursPerDay}
                                                <span class="week-detail">Avg {week.avgHoursPerDay}h/day</span>
                                            {/if}
                                            <span class="week-detail-percent" class:over-target={isOverTarget}>{Math.round(percent)}%</span>
                                        </div>
                                    </div>
                                {:else}
                                    <div class="modal-empty-state">
                                        <IconCalendarStats size={48} stroke={1} class="empty-icon" />
                                        <p>No data for selected date range</p>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    </div>
                </div>
            {/if}

            <!-- Day of Week Performance -->
            <section class="chart-section">
                <div class="chart-card">
                    <div class="chart-header">
                        <div>
                            <h3 class="chart-title">Day Performance</h3>
                            <p class="chart-subtitle">Average hours by day of week</p>
                        </div>
                        <IconClock size={20} stroke={1.5} class="chart-icon" />
                    </div>
                    <div class="day-stats-grid">
                        {#each dayOfWeekStats.filter(d => d.totalDays > 0) as day}
                            <div class="day-stat-card">
                                <span class="day-name">{day.day}</span>
                                <span class="day-hours">{day.avgHours}h</span>
                                <span class="day-count">{day.totalDays} days</span>
                                {#if day.lateCount > 0}
                                    <span class="day-late">{day.lateCount} late</span>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            </section>
        </div>
    {/if}
</div>


<style>
    .analytics-page {
        min-height: 100%;
        padding: clamp(16px, 4vw, 40px);
        background: linear-gradient(180deg, #f0f2ff 0%, #f5f5f7 50%, #f0fff4 100%);
    }

    .analytics-content { max-width: 1000px; margin: 0 auto; }

    .loading-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
    }
    .loading-text { margin-top: 16px; font-size: 15px; color: var(--apple-gray-1); }

    /* Header */
    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: clamp(20px, 4vw, 32px);
        flex-wrap: wrap;
        gap: 16px;
    }
    .page-title {
        font-size: clamp(28px, 5vw, 36px);
        font-weight: 700;
        color: var(--apple-black);
        letter-spacing: -0.5px;
        margin-bottom: 4px;
    }
    .page-subtitle { font-size: clamp(14px, 2vw, 16px); color: var(--apple-gray-1); }

    .period-selector {
        position: relative;
        display: flex;
        align-items: center;
    }
    .period-select {
        appearance: none;
        background: var(--apple-white);
        border: 1px solid var(--apple-gray-4);
        border-radius: var(--apple-radius-md);
        padding: 10px 36px 10px 14px;
        font-size: 14px;
        font-weight: 500;
        color: var(--apple-black);
        cursor: pointer;
        transition: var(--apple-transition);
    }
    .period-select:focus {
        outline: none;
        border-color: var(--apple-accent);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }
    :global(.select-icon) {
        position: absolute;
        right: 12px;
        pointer-events: none;
        color: var(--apple-gray-2);
    }

    /* Summary Section */
    .summary-section { margin-bottom: 24px; }
    .summary-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
    }

    .summary-card {
        background: var(--apple-white);
        border-radius: var(--apple-radius-lg);
        padding: clamp(14px, 3vw, 20px);
        box-shadow: var(--apple-shadow-sm);
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        display: flex;
        flex-direction: column;
    }
    .summary-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--apple-shadow-md);
    }
    .summary-card-large {
        grid-column: span 1;
        align-items: center;
        text-align: center;
    }
    .summary-card-ring {
        align-items: center;
        text-align: center;
    }

    .card-header {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        margin-bottom: 10px;
        width: 100%;
    }
    .card-label {
        font-size: clamp(9px, 2vw, 11px);
        font-weight: 600;
        color: var(--apple-gray-1);
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
    :global(.card-icon) { flex-shrink: 0; }
    :global(.icon-blue) { color: var(--apple-accent); }
    :global(.icon-green) { color: var(--apple-green); }
    :global(.icon-orange) { color: var(--apple-orange); }
    :global(.icon-purple) { color: var(--apple-purple); }
    :global(.icon-red) { color: #FF3B30; }

    .ring-container { margin: 8px 0 12px; }
    .ring-container-small { 
        margin: 6px 0 10px;
        transform: scale(0.85);
        transform-origin: center;
    }

    .stat-display {
        display: flex;
        align-items: baseline;
        gap: 4px;
        margin-bottom: 8px;
    }
    .stat-value {
        font-size: clamp(24px, 5vw, 32px);
        font-weight: 700;
        color: var(--apple-black);
        line-height: 1;
    }
    .stat-value.stat-text { font-size: clamp(18px, 4vw, 22px); }
    .stat-unit {
        font-size: clamp(12px, 2vw, 14px);
        font-weight: 500;
        color: var(--apple-gray-1);
    }

    /* Centered stat display for cards without rings */
    .stat-center {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 10px 0;
    }
    .stat-value-large {
        font-size: clamp(20px, 4vw, 26px);
        font-weight: 700;
        color: var(--apple-black);
        line-height: 1.2;
    }
    .stat-sub {
        font-size: clamp(10px, 2vw, 12px);
        color: var(--apple-gray-2);
        margin-top: 4px;
    }

    .stat-meta { margin-bottom: 8px; }
    .meta-badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
    }
    .meta-orange { background: rgba(255, 149, 0, 0.12); color: var(--apple-orange); }
    .meta-red { background: rgba(255, 59, 48, 0.12); color: #FF3B30; }

    .card-detail {
        font-size: clamp(10px, 2vw, 12px);
        color: var(--apple-gray-2);
    }
    .card-insight {
        font-size: clamp(11px, 2vw, 13px);
        color: var(--apple-gray-1);
        font-weight: 500;
    }
    .card-insight-small {
        font-size: clamp(9px, 1.8vw, 11px);
        color: var(--apple-gray-2);
        margin-top: auto;
    }

    /* Chart Section */
    .chart-section { margin-bottom: 20px; }
    .chart-card {
        background: var(--apple-white);
        border-radius: var(--apple-radius-xl);
        padding: clamp(16px, 3vw, 24px);
        box-shadow: var(--apple-shadow-sm);
    }
    .chart-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 20px;
    }
    .chart-title {
        font-size: 17px;
        font-weight: 600;
        color: var(--apple-black);
        margin-bottom: 4px;
    }
    .chart-subtitle { font-size: 13px; color: var(--apple-gray-1); }
    :global(.chart-icon) { color: var(--apple-gray-3); }

    .chart-container { margin-bottom: 16px; }
    .chart-legend {
        display: flex;
        gap: 16px;
        justify-content: center;
    }
    .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: var(--apple-gray-1);
    }
    .legend-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }
    .legend-blue { background: var(--apple-accent); }
    .legend-gray { background: var(--apple-gray-4); }

    /* Chart Header Actions */
    .chart-header-actions {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .week-filter-inline {
        position: relative;
        display: flex;
        align-items: center;
    }
    .week-filter-select {
        appearance: none;
        background: var(--apple-gray-6);
        border: none;
        border-radius: 8px;
        padding: 6px 28px 6px 10px;
        font-size: 12px;
        font-weight: 500;
        color: var(--apple-gray-1);
        cursor: pointer;
        transition: var(--apple-transition);
    }
    .week-filter-select:hover { background: var(--apple-gray-5); }
    .week-filter-select:focus { outline: none; background: var(--apple-gray-5); }
    :global(.filter-select-icon) {
        position: absolute;
        right: 8px;
        pointer-events: none;
        color: var(--apple-gray-2);
    }

    /* Show More Button */
    .show-more-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        width: 100%;
        margin-top: 16px;
        padding: 12px;
        background: var(--apple-gray-6);
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        color: var(--apple-accent);
        cursor: pointer;
        transition: var(--apple-transition);
    }
    .show-more-btn:hover {
        background: rgba(0, 122, 255, 0.1);
    }

    /* Weekly Bars */
    .weekly-bars {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .week-bar-item { display: flex; flex-direction: column; gap: 6px; }
    .week-bar-track {
        height: 8px;
        background: var(--apple-gray-5);
        border-radius: 4px;
        overflow: hidden;
    }
    .week-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--apple-accent), #5856D6);
        border-radius: 4px;
        transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .week-bar-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    .week-label { font-size: 12px; color: var(--apple-gray-1); }
    .week-hours { font-size: 13px; font-weight: 600; color: var(--apple-black); }

    /* Modal Styles */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
        animation: fadeIn 0.2s ease;
    }
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    .modal-container {
        background: var(--apple-white);
        border-radius: 20px;
        width: 100%;
        max-width: 600px;
        max-height: 85vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }
    @keyframes slideUp {
        from { opacity: 0; transform: translateY(20px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        padding: 24px 24px 16px;
        border-bottom: 1px solid var(--apple-gray-5);
    }
    .modal-title-group { flex: 1; }
    .modal-title {
        font-size: 22px;
        font-weight: 700;
        color: var(--apple-black);
        margin-bottom: 4px;
    }
    .modal-subtitle {
        font-size: 14px;
        color: var(--apple-gray-1);
    }
    .modal-close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        background: var(--apple-gray-6);
        border: none;
        border-radius: 50%;
        color: var(--apple-gray-1);
        cursor: pointer;
        transition: var(--apple-transition);
    }
    .modal-close-btn:hover {
        background: var(--apple-gray-5);
        color: var(--apple-black);
    }

    /* Modal Filters */
    .modal-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        padding: 16px 24px;
        background: var(--apple-gray-6);
        border-bottom: 1px solid var(--apple-gray-5);
    }
    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    .filter-label {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        font-weight: 600;
        color: var(--apple-gray-1);
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
    .date-range-inputs {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .date-input {
        padding: 8px 12px;
        background: var(--apple-white);
        border: 1px solid var(--apple-gray-4);
        border-radius: 8px;
        font-size: 13px;
        color: var(--apple-black);
        transition: var(--apple-transition);
    }
    .date-input:focus {
        outline: none;
        border-color: var(--apple-accent);
        box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
    }
    .date-separator {
        font-size: 12px;
        color: var(--apple-gray-2);
    }
    .filter-select-wrapper {
        position: relative;
        display: flex;
        align-items: center;
    }
    .modal-filter-select {
        appearance: none;
        padding: 8px 32px 8px 12px;
        background: var(--apple-white);
        border: 1px solid var(--apple-gray-4);
        border-radius: 8px;
        font-size: 13px;
        color: var(--apple-black);
        cursor: pointer;
        transition: var(--apple-transition);
    }
    .modal-filter-select:focus {
        outline: none;
        border-color: var(--apple-accent);
    }
    :global(.modal-select-icon) {
        position: absolute;
        right: 10px;
        pointer-events: none;
        color: var(--apple-gray-2);
    }

    /* Modal Content */
    .modal-content {
        flex: 1;
        overflow-y: auto;
        padding: 20px 24px 24px;
    }
    .modal-stats-summary {
        display: flex;
        gap: 12px;
        margin-bottom: 20px;
    }
    .stat-pill {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 12px;
        background: linear-gradient(135deg, rgba(0, 122, 255, 0.08), rgba(88, 86, 214, 0.08));
        border-radius: 12px;
    }
    .stat-pill-label {
        font-size: 10px;
        font-weight: 600;
        color: var(--apple-gray-1);
        text-transform: uppercase;
        letter-spacing: 0.3px;
        margin-bottom: 4px;
    }
    .stat-pill-value {
        font-size: 20px;
        font-weight: 700;
        color: var(--apple-accent);
    }

    /* Modal Weekly List */
    .modal-weekly-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }
    .modal-week-item {
        padding: 16px;
        background: var(--apple-gray-6);
        border-radius: 14px;
        transition: var(--apple-transition);
    }
    .modal-week-item:hover {
        background: var(--apple-gray-5);
    }
    .modal-week-item.over-target {
        background: linear-gradient(135deg, rgba(52, 199, 89, 0.08), rgba(52, 199, 89, 0.04));
    }
    .week-item-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 10px;
    }
    .week-item-info { display: flex; flex-direction: column; gap: 2px; }
    .week-item-label {
        font-size: 15px;
        font-weight: 600;
        color: var(--apple-black);
    }
    .week-item-dates {
        font-size: 12px;
        color: var(--apple-gray-2);
    }
    .week-item-stats {
        text-align: right;
    }
    .week-item-hours {
        font-size: 18px;
        font-weight: 700;
        color: var(--apple-black);
    }
    .week-item-target {
        font-size: 12px;
        color: var(--apple-gray-2);
    }
    .week-item-bar-track {
        height: 6px;
        background: var(--apple-gray-4);
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 8px;
    }
    .week-item-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, var(--apple-accent), #5856D6);
        border-radius: 3px;
        transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .week-item-bar-fill.over-target {
        background: linear-gradient(90deg, var(--apple-green), #30D158);
    }
    .week-item-details {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
    }
    .week-detail {
        font-size: 11px;
        color: var(--apple-gray-2);
    }
    .week-detail-percent {
        font-size: 11px;
        font-weight: 600;
        color: var(--apple-accent);
        margin-left: auto;
    }
    .week-detail-percent.over-target {
        color: var(--apple-green);
    }

    /* Modal Empty State */
    .modal-empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 24px;
        text-align: center;
    }
    :global(.empty-icon) {
        color: var(--apple-gray-3);
        margin-bottom: 12px;
    }
    .modal-empty-state p {
        font-size: 14px;
        color: var(--apple-gray-2);
    }

    /* Modal Responsive */
    @media (max-width: 480px) {
        .modal-container {
            max-height: 90vh;
            border-radius: 16px 16px 0 0;
            margin-top: auto;
        }
        .modal-header { padding: 20px 16px 12px; }
        .modal-filters {
            padding: 12px 16px;
            flex-direction: column;
        }
        .date-range-inputs {
            flex-direction: column;
            align-items: stretch;
        }
        .date-separator { text-align: center; }
        .modal-content { padding: 16px; }
        .modal-stats-summary { flex-direction: column; }
        .stat-pill { flex-direction: row; justify-content: space-between; }
        .stat-pill-label { margin-bottom: 0; }
    }

    /* Day Stats Grid */
    .day-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(80px, 1fr));
        gap: 10px;
    }
    .day-stat-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 14px 10px;
        background: var(--apple-gray-6);
        border-radius: var(--apple-radius-md);
        text-align: center;
        transition: var(--apple-transition);
    }
    .day-stat-card:hover {
        background: rgba(0, 122, 255, 0.08);
    }
    .day-name {
        font-size: 12px;
        font-weight: 600;
        color: var(--apple-gray-1);
        margin-bottom: 6px;
    }
    .day-hours {
        font-size: 20px;
        font-weight: 700;
        color: var(--apple-black);
        line-height: 1;
    }
    .day-count {
        font-size: 10px;
        color: var(--apple-gray-2);
        margin-top: 4px;
    }
    .day-late {
        font-size: 10px;
        color: var(--apple-orange);
        font-weight: 500;
        margin-top: 4px;
    }

    /* Responsive */
    @media (max-width: 480px) {
        .summary-grid { 
            grid-template-columns: repeat(2, 1fr); 
            gap: 10px;
        }
        .summary-card-large { grid-column: span 2; }
        .ring-container-small { transform: scale(0.75); }
        .card-header { margin-bottom: 6px; }
    }

    @media (min-width: 481px) and (max-width: 639px) {
        .summary-grid { 
            grid-template-columns: repeat(2, 1fr); 
            gap: 12px;
        }
        .summary-card-large { grid-column: span 2; }
    }

    @media (min-width: 640px) and (max-width: 767px) {
        .summary-grid { grid-template-columns: repeat(3, 1fr); }
        .summary-card-large { grid-column: span 1; }
    }

    @media (min-width: 768px) {
        .summary-grid { grid-template-columns: repeat(5, 1fr); }
        .summary-card-large { grid-column: span 1; }
        .ring-container-small { transform: scale(0.9); }
    }

    @media (min-width: 1024px) {
        .ring-container-small { transform: scale(1); }
    }
</style>
