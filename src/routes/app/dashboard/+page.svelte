<script>
    import { auth, getUserProfile, db } from '$lib/firebase';
    import { ref, get } from 'firebase/database';
    import { onMount } from 'svelte';
    import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInMinutes, subDays, isToday, parseISO, eachDayOfInterval, isSameDay } from 'date-fns';
    import { IconCalendarStats, IconChartBar, IconArrowRight, IconClock, IconCalendarEvent, IconUserCheck, IconSun, IconMoon, IconActivity, IconTarget, IconFlame, IconChevronRight, IconMapPin, IconX, IconTrendingUp, IconTrendingDown, IconMinus, IconChartPie, IconBell, IconCalendar, IconAward, IconBolt, IconCheck, IconAlertCircle } from "@tabler/icons-svelte";
    import NotificationBell from "$lib/components/NotificationBell.svelte";
    import { getGamificationData, getBadgeById } from '$lib/stores/gamification.js';
    import { activeHoliday, seasonalPrefs } from '$lib/stores/seasonalTheme.js';
    import { ChristmasDailyReward } from '$lib/components/seasonal';
    import { subscribeToTodayAttendance } from '$lib/realtime/liveSyncEngine.js';

    let userProfile = null;
    let isLoading = true;
    let currentTime = new Date();
    let greeting = '';
    let attendanceStats = { 
        todayStatus: 'not_checked_in', 
        todayCheckIn: null, 
        todayHours: 0, 
        weekHours: 0, 
        monthDays: 0, 
        monthHours: 0, 
        streak: 0, 
        avgCheckIn: null, 
        recentActivity: [],
        weeklyData: [],
        totalRecords: 0,
        onTimeRate: 0,
        avgDailyHours: 0,
        bestStreak: 0,
        lastWeekHours: 0
    };
    let timeInterval;
    let userBadges = [];
    let showActivityModal = false;
    let allRecentActivity = [];
    let todayRecord = null;
    let unsubscribers = [];
    let insights = [];

    function openActivityModal() {
        showActivityModal = true;
        document.body.style.overflow = 'hidden';
    }

    function closeActivityModal() {
        showActivityModal = false;
        document.body.style.overflow = '';
    }

    function handleModalKeydown(e) {
        if (e.key === 'Escape') closeActivityModal();
    }

    onMount(async () => {
        timeInterval = setInterval(() => { currentTime = new Date(); updateGreeting(); }, 1000);
        const user = auth.currentUser;
        if (user) { 
            userProfile = await getUserProfile(user.uid); 
            await loadAttendanceStats(user.uid);
            const todayUnsub = subscribeToTodayAttendance(user.uid, (todayData) => {
                if (todayData) {
                    todayRecord = { ...todayRecord, ...todayData, currentStatus: todayData.currentStatus };
                    attendanceStats.todayStatus = todayData.currentStatus;
                    if (todayData.checkIn?.timestamp) {
                        attendanceStats.todayCheckIn = todayData.checkIn.timestamp;
                    }
                    if (todayRecord?.checkIn?.timestamp) {
                        attendanceStats.todayHours = getWorkMinutes(todayRecord, true) / 60;
                    }
                }
            });
            unsubscribers.push(todayUnsub);
            const gamifData = await getGamificationData(user.uid);
            if (gamifData?.badges?.length > 0) {
                userBadges = gamifData.badges.slice(-3).reverse().map(id => getBadgeById(id)).filter(Boolean);
            }
        }
        isLoading = false;
        updateGreeting();
        return () => {
            clearInterval(timeInterval);
            unsubscribers.forEach(unsub => unsub());
        };
    });

    function updateGreeting() {
        const hour = currentTime.getHours();
        if (hour < 12) greeting = 'Good Morning';
        else if (hour < 17) greeting = 'Good Afternoon';
        else greeting = 'Good Evening';
    }

    function getBreakMinutes(record, isToday = false) {
        const breakStart = record.breakIn?.timestamp || record.breakStart?.timestamp;
        const breakEnd = record.breakOut?.timestamp || record.breakEnd?.timestamp;
        if (!breakStart) return 0;
        const breakStartTime = new Date(breakStart);
        if (isToday && record.currentStatus === 'onBreak') {
            return differenceInMinutes(new Date(), breakStartTime);
        }
        if (breakEnd) {
            return differenceInMinutes(new Date(breakEnd), breakStartTime);
        }
        return 0;
    }

    function getWorkMinutes(record, isToday = false) {
        if (!record.checkIn?.timestamp) return 0;
        const checkIn = new Date(record.checkIn.timestamp);
        let endTime;
        if (record.checkOut?.timestamp) {
            endTime = new Date(record.checkOut.timestamp);
        } else if (isToday) {
            if (record.currentStatus === 'onBreak') {
                const breakStart = record.breakIn?.timestamp || record.breakStart?.timestamp;
                endTime = breakStart ? new Date(breakStart) : new Date();
            } else {
                endTime = new Date();
            }
        } else {
            return 0;
        }
        const totalMinutes = differenceInMinutes(endTime, checkIn);
        const breakMinutes = getBreakMinutes(record, isToday);
        if (record.currentStatus !== 'onBreak') {
            return Math.max(0, totalMinutes - breakMinutes);
        }
        return Math.max(0, totalMinutes);
    }

    async function loadAttendanceStats(uid) {
        try {
            const snapshot = await get(ref(db, `attendance/${uid}`));
            if (!snapshot.exists()) return;
            const records = [];
            snapshot.forEach(child => { records.push({ id: child.key, ...child.val() }); });
            
            const today = new Date();
            const todayStr = today.toDateString();
            const weekStart = startOfWeek(today, { weekStartsOn: 1 });
            const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
            const monthStart = startOfMonth(today);
            const monthEnd = endOfMonth(today);
            const lastWeekStart = subDays(weekStart, 7);
            const lastWeekEnd = subDays(weekStart, 1);

            todayRecord = records.find(r => r.date === todayStr) || null;
            if (todayRecord) {
                attendanceStats.todayStatus = todayRecord.currentStatus;
                attendanceStats.todayCheckIn = todayRecord.checkIn?.timestamp;
                if (todayRecord.checkIn?.timestamp) {
                    attendanceStats.todayHours = getWorkMinutes(todayRecord, true) / 60;
                }
            }

            // Weekly data for chart
            const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
            attendanceStats.weeklyData = weekDays.map(day => {
                const dayRecord = records.find(r => r.date === day.toDateString());
                const hours = dayRecord ? getWorkMinutes(dayRecord, day.toDateString() === todayStr) / 60 : 0;
                return {
                    day: format(day, 'EEE'),
                    date: format(day, 'MMM d'),
                    hours: Math.round(hours * 10) / 10,
                    isToday: day.toDateString() === todayStr,
                    hasRecord: !!dayRecord
                };
            });

            let weekMinutes = 0;
            let lastWeekMinutes = 0;
            records.forEach(r => {
                const recordDate = new Date(r.date);
                if (recordDate >= weekStart && recordDate <= weekEnd && r.checkIn?.timestamp) {
                    weekMinutes += getWorkMinutes(r, r.date === todayStr);
                }
                if (recordDate >= lastWeekStart && recordDate <= lastWeekEnd && r.checkIn?.timestamp) {
                    lastWeekMinutes += getWorkMinutes(r, false);
                }
            });
            attendanceStats.weekHours = Math.round(weekMinutes / 60 * 10) / 10;
            attendanceStats.lastWeekHours = Math.round(lastWeekMinutes / 60 * 10) / 10;

            let monthMinutes = 0, monthDays = 0;
            records.forEach(r => {
                const recordDate = new Date(r.date);
                if (recordDate >= monthStart && recordDate <= monthEnd && r.checkIn?.timestamp) {
                    monthDays++;
                    monthMinutes += getWorkMinutes(r, r.date === todayStr);
                }
            });
            attendanceStats.monthDays = monthDays;
            attendanceStats.monthHours = Math.round(monthMinutes / 60 * 10) / 10;
            attendanceStats.totalRecords = records.length;
            attendanceStats.avgDailyHours = records.length > 0 ? Math.round((monthMinutes / 60 / Math.max(monthDays, 1)) * 10) / 10 : 0;

            // Calculate on-time rate (check-in before 9 AM)
            const onTimeRecords = records.filter(r => {
                if (!r.checkIn?.timestamp) return false;
                const checkInTime = new Date(r.checkIn.timestamp);
                return checkInTime.getHours() < 9 || (checkInTime.getHours() === 9 && checkInTime.getMinutes() === 0);
            });
            attendanceStats.onTimeRate = records.length > 0 ? Math.round((onTimeRecords.length / records.length) * 100) : 0;

            // Streak calculation
            let streak = 0;
            let bestStreak = 0;
            let currentStreak = 0;
            const sortedRecords = records.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            for (let i = 0; i < sortedRecords.length; i++) {
                const expectedDate = new Date();
                expectedDate.setDate(expectedDate.getDate() - i);
                if (sortedRecords[i]?.date === expectedDate.toDateString()) {
                    streak++;
                } else break;
            }
            
            // Best streak calculation
            const sortedAsc = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
            for (let i = 0; i < sortedAsc.length; i++) {
                if (i === 0) {
                    currentStreak = 1;
                } else {
                    const prevDate = new Date(sortedAsc[i-1].date);
                    const currDate = new Date(sortedAsc[i].date);
                    const diffDays = Math.round((currDate - prevDate) / (1000 * 60 * 60 * 24));
                    if (diffDays === 1) {
                        currentStreak++;
                    } else {
                        currentStreak = 1;
                    }
                }
                bestStreak = Math.max(bestStreak, currentStreak);
            }
            attendanceStats.streak = streak;
            attendanceStats.bestStreak = bestStreak;

            allRecentActivity = sortedRecords.map(r => ({ 
                date: r.date, 
                status: r.currentStatus, 
                checkIn: r.checkIn?.timestamp, 
                checkOut: r.checkOut?.timestamp, 
                location: r.checkIn?.location?.name,
                hours: getWorkMinutes(r, r.date === todayStr) / 60
            }));
            attendanceStats.recentActivity = allRecentActivity.slice(0, 5);

            const checkInTimes = records.filter(r => r.checkIn?.timestamp).map(r => { 
                const d = new Date(r.checkIn.timestamp); 
                return d.getHours() * 60 + d.getMinutes(); 
            });
            if (checkInTimes.length > 0) {
                const avgMinutes = checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length;
                attendanceStats.avgCheckIn = `${Math.floor(avgMinutes / 60)}:${Math.round(avgMinutes % 60).toString().padStart(2, '0')}`;
            }

            // Generate insights
            generateInsights();
        } catch (error) { console.error('Error loading stats:', error); }
    }

    function generateInsights() {
        insights = [];
        const weekDiff = attendanceStats.weekHours - attendanceStats.lastWeekHours;
        if (weekDiff > 0) {
            insights.push({ type: 'positive', icon: IconTrendingUp, text: `${Math.abs(weekDiff).toFixed(1)}h more than last week`, color: 'green' });
        } else if (weekDiff < 0) {
            insights.push({ type: 'warning', icon: IconTrendingDown, text: `${Math.abs(weekDiff).toFixed(1)}h less than last week`, color: 'orange' });
        }
        if (attendanceStats.streak >= 5) {
            insights.push({ type: 'achievement', icon: IconFlame, text: `${attendanceStats.streak} day streak! Keep it up!`, color: 'orange' });
        }
        if (attendanceStats.onTimeRate >= 90) {
            insights.push({ type: 'positive', icon: IconCheck, text: `${attendanceStats.onTimeRate}% on-time rate - Excellent!`, color: 'green' });
        } else if (attendanceStats.onTimeRate < 70 && attendanceStats.totalRecords > 5) {
            insights.push({ type: 'warning', icon: IconAlertCircle, text: `On-time rate is ${attendanceStats.onTimeRate}%`, color: 'orange' });
        }
        if (attendanceStats.avgDailyHours >= 7) {
            insights.push({ type: 'positive', icon: IconBolt, text: `Averaging ${attendanceStats.avgDailyHours}h daily`, color: 'blue' });
        }
    }

    function formatHours(hours) { 
        const h = Math.floor(hours); 
        const m = Math.round((hours - h) * 60); 
        return `${h}h ${m}m`; 
    }
    
    function formatHoursShort(hours) {
        return `${hours.toFixed(1)}h`;
    }
    
    function getStatusColor(status) { 
        if (status === 'checkedIn') return 'green'; 
        if (status === 'onBreak') return 'yellow'; 
        return 'gray'; 
    }
    
    function getStatusText(status) { 
        if (status === 'checkedIn') return 'Working'; 
        if (status === 'onBreak') return 'On Break'; 
        if (status === 'checkedOut') return 'Completed'; 
        return 'Not Started'; 
    }

    function getWeekTrend() {
        const diff = attendanceStats.weekHours - attendanceStats.lastWeekHours;
        if (diff > 2) return { icon: IconTrendingUp, color: 'green', text: '+' + diff.toFixed(1) + 'h' };
        if (diff < -2) return { icon: IconTrendingDown, color: 'red', text: diff.toFixed(1) + 'h' };
        return { icon: IconMinus, color: 'gray', text: 'Same' };
    }

    $: if (currentTime && todayRecord?.checkIn?.timestamp) {
        if (todayRecord.currentStatus === 'checkedIn') {
            attendanceStats.todayHours = getWorkMinutes(todayRecord, true) / 60;
        }
    }

    $: progressPercent = Math.min((attendanceStats.todayHours / 8) * 100, 100);
    $: weekProgress = Math.min((attendanceStats.weekHours / 40) * 100, 100);
    $: maxChartHours = Math.max(...attendanceStats.weeklyData.map(d => d.hours), 8);
    $: weekTrend = getWeekTrend();
</script>

<svelte:head><title>Dashboard | Student Attendance</title></svelte:head>

<div class="dashboard-page">
    {#if isLoading}
        <div class="loading-container apple-animate-in">
            <div class="apple-spinner"></div>
            <p class="loading-text">Loading your dashboard...</p>
        </div>
    {:else if userProfile}
        <div class="dashboard-content">
            <!-- Hero Section -->
            <section class="hero-section apple-animate-in">
                <div class="particles-container">
                    <div class="particle particle-1"></div>
                    <div class="particle particle-2"></div>
                    <div class="particle particle-3"></div>
                    <div class="particle particle-4"></div>
                    <div class="orb orb-1"></div>
                    <div class="orb orb-2"></div>
                </div>
                <div class="hero-content">
                    <div class="hero-text">
                        <div class="greeting-row">
                            {#if currentTime.getHours() < 17}
                                <IconSun size={20} stroke={1.5} class="greeting-icon" />
                            {:else}
                                <IconMoon size={20} stroke={1.5} class="greeting-icon" />
                            {/if}
                            <span class="greeting-label">{greeting}</span>
                        </div>
                        <div class="name-with-badges">
                            <h1 class="hero-title">{userProfile.name.split(' ')[0]}</h1>
                            {#if userBadges.length > 0}
                                <div class="floating-badges">
                                    {#each userBadges as badge}
                                        <div class="floating-badge" title="{badge.name}">
                                            <span class="badge-icon">{badge.icon}</span>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                        <p class="hero-subtitle">{format(currentTime, 'EEEE, MMMM d, yyyy')}</p>
                    </div>
                    <div class="hero-right">
                        <!-- Notification Bell -->
                        <NotificationBell userId={auth.currentUser?.uid} />
                        
                        <div class="hero-time">
                            <span class="time-display">{format(currentTime, 'h:mm')}</span>
                            <span class="time-period">{format(currentTime, 'a')}</span>
                        </div>
                    </div>
                </div>
                <div class="quick-status">
                    <div class="status-indicator status-{getStatusColor(attendanceStats.todayStatus)}">
                        <IconActivity size={14} stroke={2} />
                        <span>{getStatusText(attendanceStats.todayStatus)}</span>
                    </div>
                    {#if attendanceStats.todayCheckIn}
                        <span class="checkin-time">
                            <IconClock size={14} stroke={1.5} />
                            Checked in at {format(new Date(attendanceStats.todayCheckIn), 'h:mm a')}
                        </span>
                    {/if}
                </div>
            </section>

            <!-- Today's Progress Card -->
            <section class="progress-section apple-animate-in">
                <div class="progress-card">
                    <div class="progress-header">
                        <div>
                            <h3 class="progress-title">Today's Progress</h3>
                            <p class="progress-subtitle">Daily attendance tracking</p>
                        </div>
                        <div class="progress-value">
                            <span class="hours-worked">{formatHours(attendanceStats.todayHours)}</span>
                            <span class="hours-target">/ 8h goal</span>
                        </div>
                    </div>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: {progressPercent}%"></div>
                    </div>
                    <div class="progress-footer">
                        <span class="progress-percent">{Math.round(progressPercent)}% complete</span>
                        <a href="/app/attendance" class="view-btn">
                            <span>{attendanceStats.todayStatus === 'not_checked_in' ? 'Start Working' : 'View Details'}</span>
                            <IconArrowRight size={16} stroke={2} />
                        </a>
                    </div>
                </div>
            </section>

            <!-- Stats Grid -->
            <section class="stats-section apple-animate-in">
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon stat-icon-blue">
                            <IconCalendarStats size={20} stroke={1.5} />
                        </div>
                        <div class="stat-content">
                            <span class="stat-value">{attendanceStats.weekHours}<span class="stat-unit">h</span></span>
                            <span class="stat-label">This Week</span>
                        </div>
                        <div class="stat-trend trend-{weekTrend.color}">
                            <svelte:component this={weekTrend.icon} size={14} stroke={2} />
                            <span>{weekTrend.text}</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon stat-icon-green">
                            <IconCalendarEvent size={20} stroke={1.5} />
                        </div>
                        <div class="stat-content">
                            <span class="stat-value">{attendanceStats.monthDays}<span class="stat-unit">days</span></span>
                            <span class="stat-label">This Month</span>
                        </div>
                        <div class="stat-meta">
                            <IconClock size={12} stroke={1.5} />
                            <span>{attendanceStats.monthHours}h total</span>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon stat-icon-orange">
                            <IconFlame size={20} stroke={1.5} />
                        </div>
                        <div class="stat-content">
                            <span class="stat-value">{attendanceStats.streak}<span class="stat-unit">days</span></span>
                            <span class="stat-label">Current Streak</span>
                        </div>
                        <div class="stat-badge">
                            {#if attendanceStats.streak >= 5}
                                <span class="badge badge-gold">🔥 On Fire!</span>
                            {:else if attendanceStats.streak >= 3}
                                <span class="badge badge-silver">⚡ Great!</span>
                            {:else}
                                <span class="badge badge-bronze">Keep going!</span>
                            {/if}
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon stat-icon-purple">
                            <IconTarget size={20} stroke={1.5} />
                        </div>
                        <div class="stat-content">
                            <span class="stat-value">{attendanceStats.onTimeRate}<span class="stat-unit">%</span></span>
                            <span class="stat-label">On-Time Rate</span>
                        </div>
                        <div class="stat-meta">
                            <IconCheck size={12} stroke={1.5} />
                            <span>Avg: {attendanceStats.avgCheckIn || '--:--'}</span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Weekly Chart Section -->
            <section class="chart-section apple-animate-in">
                <div class="chart-card">
                    <div class="section-header">
                        <div>
                            <h3 class="section-title">Weekly Overview</h3>
                            <p class="section-subtitle">Hours worked per day</p>
                        </div>
                        <div class="chart-legend">
                            <span class="legend-item"><span class="legend-dot legend-dot-active"></span>Completed</span>
                            <span class="legend-item"><span class="legend-dot legend-dot-today"></span>Today</span>
                        </div>
                    </div>
                    <div class="chart-container">
                        {#each attendanceStats.weeklyData as day}
                            <div class="chart-bar-wrapper">
                                <div class="chart-bar-value">{day.hours > 0 ? formatHoursShort(day.hours) : '-'}</div>
                                <div class="chart-bar-track">
                                    <div 
                                        class="chart-bar" 
                                        class:chart-bar-today={day.isToday}
                                        class:chart-bar-empty={!day.hasRecord}
                                        style="height: {day.hours > 0 ? (day.hours / maxChartHours) * 100 : 5}%"
                                    ></div>
                                </div>
                                <div class="chart-bar-label" class:label-today={day.isToday}>{day.day}</div>
                            </div>
                        {/each}
                    </div>
                    <div class="chart-footer">
                        <div class="chart-stat">
                            <span class="chart-stat-label">Week Total</span>
                            <span class="chart-stat-value">{attendanceStats.weekHours}h</span>
                        </div>
                        <div class="chart-stat">
                            <span class="chart-stat-label">Daily Avg</span>
                            <span class="chart-stat-value">{attendanceStats.avgDailyHours}h</span>
                        </div>
                        <div class="chart-stat">
                            <span class="chart-stat-label">Best Streak</span>
                            <span class="chart-stat-value">{attendanceStats.bestStreak} days</span>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Insights & Activity Row -->
            <div class="two-column apple-animate-in">
                <!-- Insights Panel -->
                {#if insights.length > 0}
                <section class="insights-section">
                    <div class="section-header">
                        <h3 class="section-title">
                            <IconBolt size={18} stroke={1.5} />
                            Quick Insights
                        </h3>
                    </div>
                    <div class="insights-list">
                        {#each insights as insight}
                            <div class="insight-item insight-{insight.color}">
                                <div class="insight-icon">
                                    <svelte:component this={insight.icon} size={16} stroke={2} />
                                </div>
                                <span class="insight-text">{insight.text}</span>
                            </div>
                        {/each}
                    </div>
                </section>
                {/if}

                <!-- Recent Activity -->
                <section class="activity-section">
                    <div class="section-header">
                        <h3 class="section-title">Recent Activity</h3>
                        {#if allRecentActivity.length > 5}
                            <button class="see-all-link" on:click={openActivityModal}>
                                See All ({allRecentActivity.length})
                                <IconChevronRight size={16} stroke={2} />
                            </button>
                        {:else}
                            <a href="/app/history" class="see-all-link">
                                See All
                                <IconChevronRight size={16} stroke={2} />
                            </a>
                        {/if}
                    </div>
                    <div class="activity-list">
                        {#if attendanceStats.recentActivity.length > 0}
                            {#each attendanceStats.recentActivity as activity}
                                <div class="activity-item">
                                    <div class="activity-dot activity-dot-{getStatusColor(activity.status)}"></div>
                                    <div class="activity-content">
                                        <div class="activity-main">
                                            <span class="activity-date">{activity.date}</span>
                                            <span class="activity-hours">{activity.hours > 0 ? formatHoursShort(activity.hours) : '-'}</span>
                                        </div>
                                        <div class="activity-details">
                                            {#if activity.checkIn}
                                                <span class="activity-time">
                                                    <IconClock size={12} stroke={1.5} />
                                                    {format(new Date(activity.checkIn), 'h:mm a')}
                                                    {#if activity.checkOut} → {format(new Date(activity.checkOut), 'h:mm a')}{/if}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        {:else}
                            <div class="empty-activity">
                                <IconCalendarStats size={32} stroke={1.5} />
                                <p>No recent activity</p>
                            </div>
                        {/if}
                    </div>
                </section>
            </div>

            <!-- Profile Summary -->
            <section class="profile-summary apple-animate-in">
                <div class="profile-card-compact">
                    <div class="profile-left">
                        <div class="profile-avatar-sm">
                            {#if auth.currentUser?.photoURL}
                                <img src={auth.currentUser.photoURL} alt="Profile" />
                            {:else}
                                <span>{userProfile.name.charAt(0)}</span>
                            {/if}
                        </div>
                        <div class="profile-info-compact">
                            <h4 class="profile-name-sm">{userProfile.name}</h4>
                            <p class="profile-meta">{userProfile.departmentOrCourse} • {userProfile.section}</p>
                        </div>
                    </div>
                    <a href="/app/profile" class="profile-edit-btn">
                        <span>View Profile</span>
                        <IconChevronRight size={16} stroke={2} />
                    </a>
                </div>
            </section>

            <!-- Christmas Daily Reward -->
            {#if $activeHoliday?.id === 'christmas' && $seasonalPrefs.enabled}
                <section class="christmas-reward-section apple-animate-in">
                    <ChristmasDailyReward 
                        userId={auth.currentUser?.uid || ''}
                        onRewardClaimed={(reward) => console.log('Daily reward claimed:', reward)}
                    />
                </section>
            {/if}

            <!-- Quick Actions -->
            <section class="actions-section apple-animate-in">
                <div class="section-header">
                    <h3 class="section-title">Quick Actions</h3>
                </div>
                <div class="actions-grid">
                    <a href="/app/attendance" class="action-card action-primary">
                        <div class="action-icon">
                            <IconUserCheck size={22} stroke={1.5} />
                        </div>
                        <div class="action-text">
                            <span class="action-title">Check In/Out</span>
                            <span class="action-desc">Record attendance</span>
                        </div>
                        <IconArrowRight size={18} stroke={2} class="action-arrow" />
                    </a>
                    <a href="/app/history" class="action-card">
                        <div class="action-icon">
                            <IconChartBar size={22} stroke={1.5} />
                        </div>
                        <div class="action-text">
                            <span class="action-title">History</span>
                            <span class="action-desc">View all records</span>
                        </div>
                        <IconArrowRight size={18} stroke={2} class="action-arrow" />
                    </a>
                    <a href="/app/analytics" class="action-card">
                        <div class="action-icon">
                            <IconChartPie size={22} stroke={1.5} />
                        </div>
                        <div class="action-text">
                            <span class="action-title">Analytics</span>
                            <span class="action-desc">View insights</span>
                        </div>
                        <IconArrowRight size={18} stroke={2} class="action-arrow" />
                    </a>
                </div>
            </section>
        </div>
    {/if}

    <!-- Activity Modal -->
    {#if showActivityModal}
        <div class="modal-overlay" on:click={closeActivityModal} on:keydown={handleModalKeydown} role="dialog" aria-modal="true">
            <div class="modal-container" on:click|stopPropagation role="document">
                <div class="modal-header">
                    <h2 class="modal-title">
                        <IconActivity size={20} stroke={1.5} />
                        Recent Activity
                    </h2>
                    <button class="modal-close" on:click={closeActivityModal} aria-label="Close">
                        <IconX size={18} stroke={2} />
                    </button>
                </div>
                <div class="modal-body">
                    <div class="modal-activity-list">
                        {#each allRecentActivity as activity, i}
                            <div class="modal-activity-item" style="animation-delay: {i * 20}ms">
                                <div class="activity-dot activity-dot-{getStatusColor(activity.status)}"></div>
                                <div class="activity-content">
                                    <div class="activity-main">
                                        <span class="activity-date">{activity.date}</span>
                                        <span class="activity-hours">{activity.hours > 0 ? formatHoursShort(activity.hours) : '-'}</span>
                                    </div>
                                    <div class="activity-details">
                                        {#if activity.checkIn}
                                            <span class="activity-time">
                                                <IconClock size={12} stroke={1.5} />
                                                {format(new Date(activity.checkIn), 'h:mm a')}
                                                {#if activity.checkOut} → {format(new Date(activity.checkOut), 'h:mm a')}{/if}
                                            </span>
                                        {/if}
                                        {#if activity.location}
                                            <span class="activity-location">
                                                <IconMapPin size={12} stroke={1.5} />
                                                {activity.location.split(',')[0]}
                                            </span>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
                <div class="modal-footer">
                    <a href="/app/history" class="modal-view-all">
                        View Full History
                        <IconArrowRight size={16} stroke={2} />
                    </a>
                </div>
            </div>
        </div>
    {/if}
</div>


<style>
/* Dashboard Page */
.dashboard-page { 
    min-height: 100%; 
    padding: clamp(16px, 4vw, 32px); 
    background: linear-gradient(180deg, #f0f2ff 0%, #f5f5f7 50%, #f0fff4 100%);
    position: relative;
}

.dashboard-page::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
        radial-gradient(ellipse 600px 400px at 10% 15%, rgba(102, 126, 234, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse 500px 350px at 90% 20%, rgba(118, 75, 162, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse 450px 300px at 75% 85%, rgba(52, 199, 89, 0.06) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
}

.dashboard-content { max-width: 1100px; margin: 0 auto; position: relative; z-index: 1; }
.loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; }
.loading-text { margin-top: 16px; font-size: 15px; color: var(--apple-gray-1); }

/* Hero Section */
.hero-section { 
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
    border-radius: var(--apple-radius-xl); 
    padding: clamp(20px, 4vw, 28px); 
    margin-bottom: 16px; 
    color: white; 
    position: relative; 
    overflow: hidden; 
}

.particles-container { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }
.particle { position: absolute; border-radius: 50%; background: rgba(255, 255, 255, 0.12); animation: float-particle 15s infinite ease-in-out; }
.particle-1 { width: 8px; height: 8px; top: 20%; left: 10%; animation-delay: 0s; }
.particle-2 { width: 12px; height: 12px; top: 60%; left: 20%; animation-delay: -3s; }
.particle-3 { width: 6px; height: 6px; top: 30%; left: 70%; animation-delay: -6s; }
.particle-4 { width: 10px; height: 10px; top: 70%; left: 85%; animation-delay: -9s; }
.orb { position: absolute; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 70%); animation: float-orb 20s infinite ease-in-out; }
.orb-1 { width: 60px; height: 60px; top: 10%; right: 15%; }
.orb-2 { width: 40px; height: 40px; bottom: 20%; left: 25%; animation-delay: -10s; }

@keyframes float-particle {
    0%, 100% { transform: translate(0, 0); opacity: 0.3; }
    50% { transform: translate(20px, -30px); opacity: 0.6; }
}
@keyframes float-orb {
    0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.3; }
    50% { transform: translate(30px, -20px) rotate(180deg); opacity: 0.5; }
}

.hero-content { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
.greeting-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
.greeting-label { font-size: 13px; font-weight: 500; opacity: 0.9; }
:global(.greeting-icon) { color: #FFD93D; }
.name-with-badges { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.hero-title { font-size: clamp(26px, 5vw, 32px); font-weight: 700; letter-spacing: -0.5px; margin-bottom: 2px; }
.hero-subtitle { font-size: 13px; opacity: 0.85; }
.floating-badges { display: flex; gap: 6px; }
.floating-badge { 
    width: 32px; height: 32px; border-radius: 50%; 
    background: rgba(255, 255, 255, 0.2); 
    backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center; 
    transition: transform 0.2s ease;
}
.floating-badge:hover { transform: scale(1.15); }
.badge-icon { font-size: 16px; }
.hero-right { display: flex; align-items: center; gap: 16px; }
.hero-time { text-align: right; }
.time-display { font-size: clamp(32px, 6vw, 42px); font-weight: 700; letter-spacing: -1px; line-height: 1; }
.time-period { font-size: 14px; font-weight: 500; opacity: 0.8; margin-left: 2px; }
.quick-status { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.2); flex-wrap: wrap; }
.status-indicator { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 14px; font-size: 12px; font-weight: 600; }
.status-green { background: rgba(52, 199, 89, 0.25); color: #7FFF9B; }
.status-yellow { background: rgba(255, 204, 0, 0.25); color: #FFE066; }
.status-gray { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }
.checkin-time { display: flex; align-items: center; gap: 5px; font-size: 12px; opacity: 0.85; }

/* Progress Section */
.progress-section { margin-bottom: 16px; }
.progress-card { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: clamp(18px, 4vw, 24px); box-shadow: var(--apple-shadow-sm); }
.progress-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.progress-title { font-size: 16px; font-weight: 600; color: var(--apple-black); margin-bottom: 2px; }
.progress-subtitle { font-size: 12px; color: var(--apple-gray-1); }
.progress-value { text-align: right; }
.hours-worked { font-size: 22px; font-weight: 700; color: var(--apple-black); }
.hours-target { font-size: 12px; color: var(--apple-gray-1); margin-left: 4px; }
.progress-bar-container { height: 8px; background: var(--apple-gray-5); border-radius: 4px; overflow: hidden; margin-bottom: 14px; }
.progress-bar { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; transition: width 0.5s ease; }
.progress-footer { display: flex; justify-content: space-between; align-items: center; }
.progress-percent { font-size: 12px; color: var(--apple-gray-1); }
.view-btn { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; font-weight: 600; color: var(--apple-accent); text-decoration: none; transition: gap 0.2s ease; }
.view-btn:hover { gap: 8px; }

/* Stats Section */
.stats-section { margin-bottom: 16px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.stat-card { 
    background: var(--apple-white); 
    border-radius: var(--apple-radius-lg); 
    padding: 14px; 
    box-shadow: var(--apple-shadow-sm); 
    display: flex; 
    flex-direction: column; 
    gap: 8px; 
    transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: var(--apple-shadow-md); }
.stat-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
.stat-icon-blue { background: rgba(0, 122, 255, 0.12); color: var(--apple-accent); }
.stat-icon-green { background: rgba(52, 199, 89, 0.12); color: var(--apple-green); }
.stat-icon-orange { background: rgba(255, 149, 0, 0.12); color: var(--apple-orange); }
.stat-icon-purple { background: rgba(175, 82, 222, 0.12); color: var(--apple-purple); }
.stat-content { display: flex; flex-direction: column; gap: 2px; }
.stat-value { font-size: 22px; font-weight: 700; color: var(--apple-black); line-height: 1; }
.stat-unit { font-size: 11px; font-weight: 500; color: var(--apple-gray-1); margin-left: 2px; }
.stat-label { font-size: 11px; color: var(--apple-gray-1); font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; }
.stat-trend { display: flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; margin-top: auto; }
.trend-green { color: var(--apple-green); }
.trend-red { color: var(--apple-red); }
.trend-gray { color: var(--apple-gray-2); }
.stat-meta { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--apple-gray-2); margin-top: auto; }
.stat-badge { margin-top: auto; }
.badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; }
.badge-gold { background: rgba(255, 204, 0, 0.15); color: #B38F00; }
.badge-silver { background: rgba(0, 122, 255, 0.12); color: var(--apple-accent); }
.badge-bronze { background: rgba(0,0,0,0.04); color: var(--apple-gray-1); }

/* Chart Section */
.chart-section { margin-bottom: 16px; }
.chart-card { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: clamp(18px, 4vw, 24px); box-shadow: var(--apple-shadow-sm); }
.section-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
.section-title { font-size: 16px; font-weight: 600; color: var(--apple-black); display: flex; align-items: center; gap: 6px; }
.section-subtitle { font-size: 12px; color: var(--apple-gray-1); margin-top: 2px; }
.chart-legend { display: flex; gap: 12px; }
.legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--apple-gray-1); }
.legend-dot { width: 8px; height: 8px; border-radius: 2px; }
.legend-dot-active { background: linear-gradient(135deg, #667eea, #764ba2); }
.legend-dot-today { background: var(--apple-accent); }
.chart-container { display: flex; justify-content: space-between; align-items: flex-end; height: 140px; gap: 8px; padding: 0 4px; }
.chart-bar-wrapper { display: flex; flex-direction: column; align-items: center; flex: 1; gap: 6px; }
.chart-bar-value { font-size: 10px; font-weight: 600; color: var(--apple-gray-1); height: 16px; }
.chart-bar-track { width: 100%; max-width: 40px; height: 100px; background: var(--apple-gray-6); border-radius: 6px; display: flex; align-items: flex-end; overflow: hidden; }
.chart-bar { width: 100%; background: linear-gradient(180deg, #667eea, #764ba2); border-radius: 6px; transition: height 0.5s cubic-bezier(0.25, 0.1, 0.25, 1); min-height: 4px; }
.chart-bar-today { background: linear-gradient(180deg, var(--apple-accent), #5856D6); }
.chart-bar-empty { background: var(--apple-gray-4); opacity: 0.5; }
.chart-bar-label { font-size: 11px; font-weight: 500; color: var(--apple-gray-1); }
.label-today { color: var(--apple-accent); font-weight: 600; }
.chart-footer { display: flex; justify-content: space-around; margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--apple-gray-5); }
.chart-stat { text-align: center; }
.chart-stat-label { display: block; font-size: 11px; color: var(--apple-gray-1); margin-bottom: 2px; }
.chart-stat-value { font-size: 15px; font-weight: 700; color: var(--apple-black); }

/* Two Column Layout */
.two-column { display: grid; grid-template-columns: 1fr 1.5fr; gap: 16px; margin-bottom: 16px; }

/* Insights Section */
.insights-section { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: 18px; box-shadow: var(--apple-shadow-sm); }
.insights-list { display: flex; flex-direction: column; gap: 10px; }
.insight-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: var(--apple-radius-md); transition: transform 0.2s ease; }
.insight-item:hover { transform: translateX(4px); }
.insight-green { background: rgba(52, 199, 89, 0.08); }
.insight-orange { background: rgba(255, 149, 0, 0.08); }
.insight-blue { background: rgba(0, 122, 255, 0.08); }
.insight-icon { width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
.insight-green .insight-icon { background: rgba(52, 199, 89, 0.15); color: var(--apple-green); }
.insight-orange .insight-icon { background: rgba(255, 149, 0, 0.15); color: var(--apple-orange); }
.insight-blue .insight-icon { background: rgba(0, 122, 255, 0.15); color: var(--apple-accent); }
.insight-text { font-size: 13px; font-weight: 500; color: var(--apple-black); }

/* Activity Section */
.activity-section { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: 18px; box-shadow: var(--apple-shadow-sm); }
.see-all-link { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; color: var(--apple-accent); text-decoration: none; background: none; border: none; cursor: pointer; transition: gap 0.2s ease; }
.see-all-link:hover { gap: 6px; }
.activity-list { display: flex; flex-direction: column; }
.activity-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--apple-gray-5); }
.activity-item:last-child { border-bottom: none; }
.activity-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.activity-dot-green { background: var(--apple-green); }
.activity-dot-yellow { background: var(--apple-yellow); }
.activity-dot-gray { background: var(--apple-gray-3); }
.activity-content { flex: 1; min-width: 0; }
.activity-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
.activity-date { font-size: 13px; font-weight: 600; color: var(--apple-black); }
.activity-hours { font-size: 12px; font-weight: 600; color: var(--apple-accent); }
.activity-details { display: flex; gap: 12px; flex-wrap: wrap; }
.activity-time, .activity-location { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--apple-gray-1); }
.empty-activity { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 30px 20px; color: var(--apple-gray-2); text-align: center; }
.empty-activity p { margin-top: 10px; font-size: 13px; }

/* Profile Summary */
.profile-summary { margin-bottom: 16px; }
.profile-card-compact { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: 16px 20px; box-shadow: var(--apple-shadow-sm); display: flex; align-items: center; justify-content: space-between; }
.profile-left { display: flex; align-items: center; gap: 14px; }
.profile-avatar-sm { width: 48px; height: 48px; border-radius: 50%; overflow: hidden; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.profile-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
.profile-avatar-sm span { font-size: 20px; font-weight: 600; color: white; }
.profile-info-compact { min-width: 0; }
.profile-name-sm { font-size: 15px; font-weight: 600; color: var(--apple-black); margin-bottom: 2px; }
.profile-meta { font-size: 12px; color: var(--apple-gray-1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.profile-edit-btn { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; color: var(--apple-accent); text-decoration: none; transition: gap 0.2s ease; }
.profile-edit-btn:hover { gap: 6px; }

/* Actions Section */
.actions-section { margin-bottom: 20px; }
.actions-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.action-card { display: flex; align-items: center; gap: 14px; background: var(--apple-white); border-radius: var(--apple-radius-lg); padding: 16px 18px; text-decoration: none; box-shadow: var(--apple-shadow-sm); transition: transform 0.2s ease, box-shadow 0.2s ease; }
.action-card:hover { transform: translateY(-2px); box-shadow: var(--apple-shadow-md); }
.action-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.action-primary .action-icon { background: rgba(255,255,255,0.2); color: white; }
.action-primary .action-desc { opacity: 0.85; }
.action-icon { width: 44px; height: 44px; border-radius: 12px; background: var(--apple-gray-6); display: flex; align-items: center; justify-content: center; color: var(--apple-accent); flex-shrink: 0; }
.action-text { flex: 1; min-width: 0; }
.action-title { display: block; font-size: 14px; font-weight: 600; color: var(--apple-black); margin-bottom: 2px; }
.action-primary .action-title { color: white; }
.action-desc { font-size: 11px; color: var(--apple-gray-1); }
:global(.action-arrow) { color: var(--apple-gray-3); transition: transform 0.2s ease, color 0.2s ease; flex-shrink: 0; }
.action-card:hover :global(.action-arrow) { transform: translateX(3px); color: var(--apple-accent); }
.action-primary :global(.action-arrow) { color: rgba(255,255,255,0.7); }
.action-primary:hover :global(.action-arrow) { color: white; }

/* Christmas Section */
.christmas-reward-section { margin-bottom: 16px; }

/* Modal Styles */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 16px;
    animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.modal-container {
    background: var(--apple-white);
    border-radius: var(--apple-radius-xl);
    width: 100%;
    max-width: 480px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    animation: slideUp 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
    overflow: hidden;
}
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 20px;
    border-bottom: 1px solid var(--apple-gray-5);
}
.modal-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 17px;
    font-weight: 600;
    color: var(--apple-black);
    margin: 0;
}
.modal-title :global(svg) { color: var(--apple-accent); }
.modal-close {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    border: none;
    background: var(--apple-gray-6);
    color: var(--apple-gray-1);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}
.modal-close:hover { background: var(--apple-gray-5); color: var(--apple-black); }
.modal-body { flex: 1; overflow-y: auto; padding: 8px 0; }
.modal-activity-list { display: flex; flex-direction: column; }
.modal-activity-item {
    display: flex;
    gap: 12px;
    padding: 14px 20px;
    border-bottom: 1px solid var(--apple-gray-5);
    animation: itemFadeIn 0.3s ease-out backwards;
}
@keyframes itemFadeIn { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: translateX(0); } }
.modal-activity-item:last-child { border-bottom: none; }
.modal-activity-item:hover { background: var(--apple-gray-6); }
.modal-footer {
    padding: 14px 20px;
    border-top: 1px solid var(--apple-gray-5);
    display: flex;
    justify-content: center;
    background: var(--apple-gray-6);
}
.modal-view-all {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-size: 13px;
    font-weight: 600;
    border-radius: 10px;
    text-decoration: none;
    transition: all 0.2s ease;
}
.modal-view-all:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3); }

/* Responsive Styles */
@media (max-width: 900px) {
    .stats-grid { grid-template-columns: repeat(2, 1fr); }
    .two-column { grid-template-columns: 1fr; }
    .actions-grid { grid-template-columns: 1fr; }
}

@media (max-width: 640px) {
    .hero-content { flex-direction: column; gap: 14px; }
    .hero-right { width: 100%; justify-content: space-between; }
    .hero-time { text-align: left; }
    .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .stat-card { padding: 12px; }
    .stat-value { font-size: 20px; }
    .chart-container { height: 120px; }
    .chart-bar-track { height: 80px; }
    .profile-card-compact { flex-direction: column; gap: 14px; text-align: center; }
    .profile-left { flex-direction: column; }
    .modal-overlay { padding: 0; align-items: flex-end; }
    .modal-container { max-width: 100%; max-height: 85vh; border-radius: 20px 20px 0 0; }
}

@media (max-width: 400px) {
    .dashboard-page { padding: 12px; }
    .hero-section { padding: 16px; }
    .stat-card { padding: 10px; gap: 6px; }
    .stat-icon { width: 32px; height: 32px; }
    .stat-value { font-size: 18px; }
    .stat-label { font-size: 10px; }
    .chart-bar-value { font-size: 9px; }
    .chart-bar-label { font-size: 10px; }
}
</style>
