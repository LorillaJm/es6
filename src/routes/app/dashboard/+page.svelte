<script>
    import { auth, getUserProfile, db } from '$lib/firebase';
    import { ref, get } from 'firebase/database';
    import { onMount } from 'svelte';
    import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, differenceInMinutes } from 'date-fns';
    import { IconCalendarStats, IconChartBar, IconArrowRight, IconClock, IconCalendarEvent, IconUserCheck, IconSun, IconMoon, IconActivity, IconTarget, IconFlame, IconChevronRight, IconMapPin, IconDevices, IconX } from "@tabler/icons-svelte";
    import { getGamificationData, getBadgeById } from '$lib/stores/gamification.js';
    import { activeHoliday, seasonalPrefs } from '$lib/stores/seasonalTheme.js';
    import { ChristmasDailyReward } from '$lib/components/seasonal';

    let userProfile = null;
    let isLoading = true;
    let currentTime = new Date();
    let greeting = '';
    let attendanceStats = { todayStatus: 'not_checked_in', todayCheckIn: null, todayHours: 0, weekHours: 0, monthDays: 0, monthHours: 0, streak: 0, avgCheckIn: null, recentActivity: [] };
    let timeInterval;
    let userBadges = [];
    let showActivityModal = false;
    let allRecentActivity = [];

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
            // Load user badges
            const gamifData = await getGamificationData(user.uid);
            if (gamifData?.badges?.length > 0) {
                userBadges = gamifData.badges.slice(-3).reverse().map(id => getBadgeById(id)).filter(Boolean);
            }
        }
        isLoading = false;
        updateGreeting();
        return () => clearInterval(timeInterval);
    });

    function updateGreeting() {
        const hour = currentTime.getHours();
        if (hour < 12) greeting = 'Good Morning';
        else if (hour < 17) greeting = 'Good Afternoon';
        else greeting = 'Good Evening';
    }

    async function loadAttendanceStats(uid) {
        try {
            const snapshot = await get(ref(db, `attendance/${uid}`));
            if (!snapshot.exists()) return;
            const records = [];
            snapshot.forEach(child => { records.push({ id: child.key, ...child.val() }); });
            const today = new Date().toDateString();
            const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
            const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
            const monthStart = startOfMonth(new Date());
            const monthEnd = endOfMonth(new Date());

            const todayRecord = records.find(r => r.date === today);
            if (todayRecord) {
                attendanceStats.todayStatus = todayRecord.currentStatus;
                attendanceStats.todayCheckIn = todayRecord.checkIn?.timestamp;
                if (todayRecord.checkIn?.timestamp) {
                    const checkIn = new Date(todayRecord.checkIn.timestamp);
                    const checkOut = todayRecord.checkOut?.timestamp ? new Date(todayRecord.checkOut.timestamp) : new Date();
                    attendanceStats.todayHours = differenceInMinutes(checkOut, checkIn) / 60;
                }
            }

            let weekMinutes = 0;
            records.forEach(r => {
                const recordDate = new Date(r.date);
                if (recordDate >= weekStart && recordDate <= weekEnd && r.checkIn?.timestamp) {
                    const checkIn = new Date(r.checkIn.timestamp);
                    const checkOut = r.checkOut?.timestamp ? new Date(r.checkOut.timestamp) : (r.date === today ? new Date() : checkIn);
                    weekMinutes += differenceInMinutes(checkOut, checkIn);
                }
            });
            attendanceStats.weekHours = Math.round(weekMinutes / 60 * 10) / 10;

            let monthMinutes = 0, monthDays = 0;
            records.forEach(r => {
                const recordDate = new Date(r.date);
                if (recordDate >= monthStart && recordDate <= monthEnd && r.checkIn?.timestamp) {
                    monthDays++;
                    const checkIn = new Date(r.checkIn.timestamp);
                    const checkOut = r.checkOut?.timestamp ? new Date(r.checkOut.timestamp) : (r.date === today ? new Date() : checkIn);
                    monthMinutes += differenceInMinutes(checkOut, checkIn);
                }
            });
            attendanceStats.monthDays = monthDays;
            attendanceStats.monthHours = Math.round(monthMinutes / 60 * 10) / 10;

            let streak = 0;
            const sortedRecords = records.sort((a, b) => new Date(b.date) - new Date(a.date));
            for (let i = 0; i < sortedRecords.length; i++) {
                const expectedDate = new Date();
                expectedDate.setDate(expectedDate.getDate() - i);
                if (sortedRecords[i]?.date === expectedDate.toDateString()) streak++;
                else break;
            }
            attendanceStats.streak = streak;
            allRecentActivity = sortedRecords.map(r => ({ date: r.date, status: r.currentStatus, checkIn: r.checkIn?.timestamp, checkOut: r.checkOut?.timestamp, location: r.checkIn?.location?.name }));
            attendanceStats.recentActivity = allRecentActivity.slice(0, 4);

            const checkInTimes = records.filter(r => r.checkIn?.timestamp).map(r => { const d = new Date(r.checkIn.timestamp); return d.getHours() * 60 + d.getMinutes(); });
            if (checkInTimes.length > 0) {
                const avgMinutes = checkInTimes.reduce((a, b) => a + b, 0) / checkInTimes.length;
                attendanceStats.avgCheckIn = `${Math.floor(avgMinutes / 60)}:${Math.round(avgMinutes % 60).toString().padStart(2, '0')}`;
            }
        } catch (error) { console.error('Error loading stats:', error); }
    }

    function formatHours(hours) { const h = Math.floor(hours); const m = Math.round((hours - h) * 60); return `${h}h ${m}m`; }
    function getStatusColor(status) { if (status === 'checkedIn') return 'green'; if (status === 'onBreak') return 'yellow'; return 'gray'; }
    function getStatusText(status) { if (status === 'checkedIn') return 'Working'; if (status === 'onBreak') return 'On Break'; if (status === 'checkedOut') return 'Completed'; return 'Not Started'; }

    $: progressPercent = Math.min((attendanceStats.todayHours / 8) * 100, 100);
    $: weekProgress = Math.min((attendanceStats.weekHours / 40) * 100, 100);
</script>

<svelte:head><title>Dashboard | Attendance System</title></svelte:head>

<div class="dashboard-page">
    {#if isLoading}
        <div class="loading-container apple-animate-in"><div class="apple-spinner"></div><p class="loading-text">Loading your dashboard...</p></div>
    {:else if userProfile}
        <div class="dashboard-content">
            <section class="hero-section apple-animate-in">
                <!-- Animated Background Particles -->
                <div class="particles-container">
                    <div class="particle particle-1"></div>
                    <div class="particle particle-2"></div>
                    <div class="particle particle-3"></div>
                    <div class="particle particle-4"></div>
                    <div class="particle particle-5"></div>
                    <div class="particle particle-6"></div>
                    <div class="particle particle-7"></div>
                    <div class="particle particle-8"></div>
                    <div class="orb orb-1"></div>
                    <div class="orb orb-2"></div>
                    <div class="orb orb-3"></div>
                    <div class="glow-ring glow-ring-1"></div>
                    <div class="glow-ring glow-ring-2"></div>
                </div>
                <div class="hero-content">
                    <div class="hero-text">
                        <div class="greeting-row">
                            {#if currentTime.getHours() < 17}<IconSun size={24} stroke={1.5} class="greeting-icon" />{:else}<IconMoon size={24} stroke={1.5} class="greeting-icon" />{/if}
                            <span class="greeting-label">{greeting}</span>
                        </div>
                        <div class="name-with-badges">
                            <h1 class="hero-title">{userProfile.name.split(' ')[0]}</h1>
                            {#if userBadges.length > 0}
                            <div class="floating-badges">
                                {#each userBadges as badge}
                                <div class="floating-badge" title="{badge.name}: {badge.description}" style="--badge-color: {badge.color}">
                                    <span class="badge-icon">{badge.icon}</span>
                                </div>
                                {/each}
                            </div>
                            {/if}
                        </div>
                        <p class="hero-subtitle">{format(currentTime, 'EEEE, MMMM d, yyyy')}</p>
                    </div>
                    <div class="hero-time">
                        <span class="time-display">{format(currentTime, 'h:mm')}</span>
                        <span class="time-period">{format(currentTime, 'a')}</span>
                    </div>
                </div>
                <div class="quick-status">
                    <div class="status-indicator status-{getStatusColor(attendanceStats.todayStatus)}"><IconActivity size={16} stroke={2} /><span>{getStatusText(attendanceStats.todayStatus)}</span></div>
                    {#if attendanceStats.todayCheckIn}<span class="checkin-time"><IconClock size={14} stroke={1.5} />Checked in at {format(new Date(attendanceStats.todayCheckIn), 'h:mm a')}</span>{/if}
                </div>
            </section>

            <section class="progress-section apple-animate-in">
                <div class="progress-card">
                    <div class="progress-header">
                        <div><h3 class="progress-title">Today's Progress</h3><p class="progress-subtitle">Daily work hours tracking</p></div>
                        <div class="progress-value"><span class="hours-worked">{formatHours(attendanceStats.todayHours)}</span><span class="hours-target">/ 8h goal</span></div>
                    </div>
                    <div class="progress-bar-container"><div class="progress-bar" style="width: {progressPercent}%"></div></div>
                    <div class="progress-footer">
                        <span class="progress-percent">{Math.round(progressPercent)}% complete</span>
                        <a href="/app/attendance" class="view-btn"><span>{attendanceStats.todayStatus === 'not_checked_in' ? 'Start Working' : 'View Details'}</span><IconArrowRight size={16} stroke={2} /></a>
                    </div>
                </div>
            </section>

            <section class="stats-section apple-animate-in">
                <div class="stats-grid">
                    <div class="stat-card"><div class="stat-icon stat-icon-blue"><IconCalendarStats size={22} stroke={1.5} /></div><div class="stat-content"><span class="stat-value">{attendanceStats.weekHours}<span class="stat-unit">h</span></span><span class="stat-label">This Week</span></div><div class="stat-progress"><div class="mini-progress"><div class="mini-progress-bar" style="width: {weekProgress}%"></div></div><span class="stat-target">{Math.round(weekProgress)}% of 40h</span></div></div>
                    <div class="stat-card"><div class="stat-icon stat-icon-green"><IconCalendarEvent size={22} stroke={1.5} /></div><div class="stat-content"><span class="stat-value">{attendanceStats.monthDays}<span class="stat-unit">days</span></span><span class="stat-label">This Month</span></div><div class="stat-meta"><IconClock size={14} stroke={1.5} /><span>{attendanceStats.monthHours}h total</span></div></div>
                    <div class="stat-card"><div class="stat-icon stat-icon-orange"><IconFlame size={22} stroke={1.5} /></div><div class="stat-content"><span class="stat-value">{attendanceStats.streak}<span class="stat-unit">days</span></span><span class="stat-label">Current Streak</span></div><div class="stat-badge">{#if attendanceStats.streak >= 5}<span class="badge badge-gold">🔥 On Fire!</span>{:else if attendanceStats.streak >= 3}<span class="badge badge-silver">⚡ Great!</span>{:else}<span class="badge badge-bronze">Keep going!</span>{/if}</div></div>
                    <div class="stat-card"><div class="stat-icon stat-icon-purple"><IconTarget size={22} stroke={1.5} /></div><div class="stat-content"><span class="stat-value">{attendanceStats.avgCheckIn || '--:--'}</span><span class="stat-label">Avg Check-in</span></div></div>
                </div>
            </section>

            <div class="two-column apple-animate-in">
                <section class="activity-section">
                    <div class="section-header">
                        <h3 class="section-title">Recent Activity</h3>
                        {#if allRecentActivity.length > 4}
                            <button class="see-all-link" on:click={openActivityModal}>See All ({allRecentActivity.length})<IconChevronRight size={16} stroke={2} /></button>
                        {:else}
                            <a href="/app/history" class="see-all-link">See All<IconChevronRight size={16} stroke={2} /></a>
                        {/if}
                    </div>
                    <div class="activity-list">
                        {#if attendanceStats.recentActivity.length > 0}
                            {#each attendanceStats.recentActivity as activity}
                                <div class="activity-item">
                                    <div class="activity-dot activity-dot-{getStatusColor(activity.status)}"></div>
                                    <div class="activity-content">
                                        <div class="activity-main"><span class="activity-date">{activity.date}</span><span class="activity-status status-text-{getStatusColor(activity.status)}">{getStatusText(activity.status)}</span></div>
                                        <div class="activity-details">
                                            {#if activity.checkIn}<span class="activity-time"><IconClock size={12} stroke={1.5} />{format(new Date(activity.checkIn), 'h:mm a')}{#if activity.checkOut} → {format(new Date(activity.checkOut), 'h:mm a')}{/if}</span>{/if}
                                            {#if activity.location}<span class="activity-location"><IconMapPin size={12} stroke={1.5} />{activity.location.split(',')[0]}</span>{/if}
                                        </div>
                                    </div>
                                </div>
                            {/each}
                        {:else}<div class="empty-activity"><IconCalendarStats size={32} stroke={1.5} /><p>No recent activity</p></div>{/if}
                    </div>
                </section>
                <section class="profile-section">
                    <div class="section-header"><h3 class="section-title">Your Profile</h3><a href="/app/profile" class="see-all-link">Edit<IconChevronRight size={16} stroke={2} /></a></div>
                    <div class="profile-card-content">
                        <div class="profile-avatar-large">{#if auth.currentUser?.photoURL}<img src={auth.currentUser.photoURL} alt="Profile" />{:else}<span>{userProfile.name.charAt(0)}</span>{/if}</div>
                        <h4 class="profile-name">{userProfile.name}</h4>
                        <p class="profile-email">{userProfile.email}</p>
                        <div class="profile-info-grid">
                            <div class="profile-info-item"><span class="info-label">Year</span><span class="info-value">{userProfile.year}</span></div>
                            <div class="profile-info-item"><span class="info-label">Department</span><span class="info-value">{userProfile.departmentOrCourse}</span></div>
                            <div class="profile-info-item"><span class="info-label">Section</span><span class="info-value">{userProfile.section}</span></div>
                        </div>
                    </div>
                </section>
            </div>

            <!-- Christmas Daily Reward -->
            {#if $activeHoliday?.id === 'christmas' && $seasonalPrefs.enabled}
                <section class="christmas-reward-section apple-animate-in">
                    <ChristmasDailyReward 
                        userId={auth.currentUser?.uid || ''}
                        onRewardClaimed={(reward) => console.log('Daily reward claimed:', reward)}
                    />
                </section>
            {/if}

            <!-- Recent Activity Modal -->
            {#if showActivityModal}
                <div class="modal-overlay" on:click={closeActivityModal} on:keydown={handleModalKeydown} role="dialog" aria-modal="true" aria-labelledby="modal-title">
                    <div class="modal-container" on:click|stopPropagation role="document">
                        <div class="modal-header">
                            <h2 id="modal-title" class="modal-title">
                                <IconActivity size={22} stroke={1.5} />
                                Recent Activity
                            </h2>
                            <button class="modal-close" on:click={closeActivityModal} aria-label="Close modal">
                                <IconX size={20} stroke={2} />
                            </button>
                        </div>
                        <div class="modal-body">
                            <div class="modal-activity-list">
                                {#each allRecentActivity as activity, i}
                                    <div class="modal-activity-item" style="animation-delay: {i * 30}ms">
                                        <div class="activity-dot activity-dot-{getStatusColor(activity.status)}"></div>
                                        <div class="activity-content">
                                            <div class="activity-main">
                                                <span class="activity-date">{activity.date}</span>
                                                <span class="activity-status status-text-{getStatusColor(activity.status)}">{getStatusText(activity.status)}</span>
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

            <section class="actions-section apple-animate-in">
                <div class="section-header"><h3 class="section-title">Quick Actions</h3></div>
                <div class="actions-grid">
                    <a href="/app/attendance" class="action-card action-primary"><div class="action-icon"><IconUserCheck size={24} stroke={1.5} /></div><div class="action-text"><span class="action-title">Check In/Out</span><span class="action-desc">Record your attendance</span></div><IconArrowRight size={20} stroke={2} class="action-arrow" /></a>
                    <a href="/app/history" class="action-card"><div class="action-icon"><IconChartBar size={24} stroke={1.5} /></div><div class="action-text"><span class="action-title">View History</span><span class="action-desc">See all records</span></div><IconArrowRight size={20} stroke={2} class="action-arrow" /></a>
                    <a href="/app/analytics" class="action-card"><div class="action-icon"><IconActivity size={24} stroke={1.5} /></div><div class="action-text"><span class="action-title">Analytics</span><span class="action-desc">View your insights</span></div><IconArrowRight size={20} stroke={2} class="action-arrow" /></a>
                </div>
            </section>
        </div>
    {/if}
</div>


<style>
.dashboard-page { 
    min-height: 100%; 
    padding: clamp(16px, 4vw, 32px); 
    background: linear-gradient(180deg, #f0f2ff 0%, #f5f5f7 50%, #f0fff4 100%);
    position: relative;
    overflow-x: hidden;
}

/* Visible Background Droplets */
.dashboard-page::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: 
        radial-gradient(ellipse 600px 400px at 10% 15%, rgba(102, 126, 234, 0.12) 0%, transparent 50%),
        radial-gradient(ellipse 500px 350px at 90% 20%, rgba(118, 75, 162, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse 450px 300px at 75% 85%, rgba(52, 199, 89, 0.08) 0%, transparent 50%),
        radial-gradient(ellipse 400px 400px at 20% 80%, rgba(0, 122, 255, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse 350px 350px at 50% 50%, rgba(175, 82, 222, 0.06) 0%, transparent 50%);
    pointer-events: none;
    z-index: 0;
}

/* Floating Soft Blobs */
.dashboard-page::after {
    content: '';
    position: fixed;
    width: 400px;
    height: 400px;
    top: 5%;
    right: -150px;
    background: radial-gradient(circle, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.08) 40%, transparent 70%);
    border-radius: 50%;
    filter: blur(60px);
    animation: float-blob 20s ease-in-out infinite;
    pointer-events: none;
    z-index: 0;
}

@keyframes float-blob {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.8; }
    33% { transform: translate(-60px, 40px) scale(1.15); opacity: 1; }
    66% { transform: translate(40px, -30px) scale(0.9); opacity: 0.7; }
}

.dashboard-content { max-width: 1200px; margin: 0 auto; position: relative; z-index: 1; }
.loading-container { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; position: relative; z-index: 1; }
.loading-text { margin-top: 16px; font-size: 15px; color: var(--apple-gray-1); }
.dashboard-content { max-width: 1200px; margin: 0 auto; }
.hero-section { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: var(--apple-radius-xl); padding: clamp(18px, 3vw, 24px); margin-bottom: 16px; color: white; position: relative; overflow: hidden; }
.hero-section::before { content: ''; position: absolute; top: -50%; right: -20%; width: 60%; height: 200%; background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%); pointer-events: none; }

/* Particles Container */
.particles-container { position: absolute; inset: 0; overflow: hidden; pointer-events: none; }

/* Floating Particles - Small Droplets */
.particle { position: absolute; border-radius: 50%; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(2px); animation: float-particle 15s infinite ease-in-out; }
.particle-1 { width: 8px; height: 8px; top: 20%; left: 10%; animation-delay: 0s; animation-duration: 12s; }
.particle-2 { width: 12px; height: 12px; top: 60%; left: 20%; animation-delay: -2s; animation-duration: 18s; }
.particle-3 { width: 6px; height: 6px; top: 30%; left: 70%; animation-delay: -4s; animation-duration: 14s; }
.particle-4 { width: 10px; height: 10px; top: 70%; left: 80%; animation-delay: -6s; animation-duration: 16s; }
.particle-5 { width: 5px; height: 5px; top: 15%; left: 50%; animation-delay: -8s; animation-duration: 20s; }
.particle-6 { width: 14px; height: 14px; top: 80%; left: 40%; animation-delay: -3s; animation-duration: 22s; }
.particle-7 { width: 7px; height: 7px; top: 45%; left: 90%; animation-delay: -5s; animation-duration: 13s; }
.particle-8 { width: 9px; height: 9px; top: 55%; left: 5%; animation-delay: -7s; animation-duration: 17s; }

@keyframes float-particle {
    0%, 100% { transform: translate(0, 0) scale(1); opacity: 0.3; }
    25% { transform: translate(30px, -40px) scale(1.2); opacity: 0.6; }
    50% { transform: translate(-20px, -80px) scale(0.8); opacity: 0.4; }
    75% { transform: translate(40px, -40px) scale(1.1); opacity: 0.5; }
}

/* Glowing Orbs */
.orb { position: absolute; border-radius: 50%; background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.4), rgba(255, 255, 255, 0.1) 50%, transparent 70%); animation: float-orb 20s infinite ease-in-out; filter: blur(1px); }
.orb-1 { width: 60px; height: 60px; top: 10%; right: 15%; animation-delay: 0s; }
.orb-2 { width: 40px; height: 40px; bottom: 20%; left: 25%; animation-delay: -5s; animation-duration: 25s; }
.orb-3 { width: 30px; height: 30px; top: 50%; right: 30%; animation-delay: -10s; animation-duration: 18s; }

@keyframes float-orb {
    0%, 100% { transform: translate(0, 0) rotate(0deg); opacity: 0.3; }
    33% { transform: translate(50px, -30px) rotate(120deg); opacity: 0.5; }
    66% { transform: translate(-30px, 20px) rotate(240deg); opacity: 0.4; }
}

/* Pulsing Glow Rings */
.glow-ring { position: absolute; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.1); animation: pulse-ring 8s infinite ease-out; }
.glow-ring-1 { width: 150px; height: 150px; top: -30px; right: -30px; animation-delay: 0s; }
.glow-ring-2 { width: 100px; height: 100px; bottom: -20px; left: 10%; animation-delay: -4s; }

@keyframes pulse-ring {
    0% { transform: scale(0.8); opacity: 0; border-width: 3px; }
    50% { opacity: 0.3; }
    100% { transform: scale(1.5); opacity: 0; border-width: 1px; }
}

/* Shimmer Effect on Hero */
.hero-section::after { content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent); animation: shimmer 8s infinite; pointer-events: none; }
@keyframes shimmer { 0% { left: -100%; } 100% { left: 200%; } }
.hero-content { display: flex; justify-content: space-between; align-items: flex-start; position: relative; z-index: 1; }
.greeting-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.greeting-label { font-size: 12px; font-weight: 500; opacity: 0.9; }
:global(.greeting-icon) { color: #FFD93D; }
.greeting-row { margin-bottom: 4px; }
.name-with-badges { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.hero-title { font-size: clamp(26px, 5vw, 34px); font-weight: 700; letter-spacing: -0.5px; margin-bottom: 2px; }
.hero-subtitle { font-size: 13px; opacity: 0.85; }

/* Floating Badges */
.floating-badges { display: flex; gap: 8px; align-items: center; animation: badges-float 3s ease-in-out infinite; }
.floating-badge { 
    width: 36px; 
    height: 36px; 
    border-radius: 50%; 
    background: rgba(255, 255, 255, 0.25); 
    backdrop-filter: blur(10px); 
    -webkit-backdrop-filter: blur(10px);
    border: 2px solid rgba(255, 255, 255, 0.4);
    display: flex; 
    align-items: center; 
    justify-content: center; 
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.3);
    position: relative;
}
.floating-badge:hover { 
    transform: scale(1.2) translateY(-4px); 
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.4);
    background: rgba(255, 255, 255, 0.35);
}
.floating-badge::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(255,255,255,0.4), transparent);
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: -1;
}
.floating-badge:hover::after { opacity: 1; }
.badge-icon { font-size: 18px; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.2)); }
@keyframes badges-float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
}
.hero-time { text-align: right; }
.time-display { font-size: clamp(32px, 6vw, 44px); font-weight: 700; letter-spacing: -1px; line-height: 1; }
.time-period { font-size: 14px; font-weight: 500; opacity: 0.8; margin-left: 2px; }
.quick-status { display: flex; align-items: center; gap: 12px; margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.2); position: relative; z-index: 1; flex-wrap: wrap; }
.status-indicator { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 16px; font-size: 12px; font-weight: 600; }
.checkin-time { font-size: 12px; }
.status-green { background: rgba(52, 199, 89, 0.2); color: #7FFF9B; }
.status-yellow { background: rgba(255, 204, 0, 0.2); color: #FFE066; }
.status-gray { background: rgba(255,255,255,0.15); color: rgba(255,255,255,0.9); }
.checkin-time { display: flex; align-items: center; gap: 6px; font-size: 13px; opacity: 0.85; }
.progress-section { margin-bottom: 20px; }
.progress-card { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: clamp(20px, 4vw, 28px); box-shadow: var(--apple-shadow-sm); }
.progress-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
.progress-title { font-size: 17px; font-weight: 600; color: var(--apple-black); margin-bottom: 4px; }
.progress-subtitle { font-size: 13px; color: var(--apple-gray-1); }
.progress-value { text-align: right; }
.hours-worked { font-size: 24px; font-weight: 700; color: var(--apple-black); }
.hours-target { font-size: 13px; color: var(--apple-gray-1); margin-left: 4px; }
.progress-bar-container { height: 8px; background: var(--apple-gray-5); border-radius: 4px; overflow: hidden; margin-bottom: 16px; }
.progress-bar { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); border-radius: 4px; transition: width 0.5s ease; }
.progress-footer { display: flex; justify-content: space-between; align-items: center; }
.progress-percent { font-size: 13px; color: var(--apple-gray-1); }
.view-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: var(--apple-accent); text-decoration: none; transition: var(--apple-transition); }
.view-btn:hover { gap: 10px; }
.stats-section { margin-bottom: 16px; }
.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }

/* Card 1 - Blue tint */
.stat-card:nth-child(1) { background: linear-gradient(145deg, rgba(240, 245, 255, 0.95) 0%, rgba(230, 240, 255, 0.85) 100%); border: 1px solid rgba(0, 122, 255, 0.12); }
/* Card 2 - Green tint */
.stat-card:nth-child(2) { background: linear-gradient(145deg, rgba(240, 255, 245, 0.95) 0%, rgba(230, 255, 240, 0.85) 100%); border: 1px solid rgba(52, 199, 89, 0.12); }
/* Card 3 - Orange tint */
.stat-card:nth-child(3) { background: linear-gradient(145deg, rgba(255, 248, 240, 0.95) 0%, rgba(255, 243, 230, 0.85) 100%); border: 1px solid rgba(255, 149, 0, 0.12); }
/* Card 4 - Purple tint */
.stat-card:nth-child(4) { background: linear-gradient(145deg, rgba(248, 240, 255, 0.95) 0%, rgba(243, 230, 255, 0.85) 100%); border: 1px solid rgba(175, 82, 222, 0.12); }

.stat-card { 
    backdrop-filter: blur(20px); 
    -webkit-backdrop-filter: blur(20px);
    border-radius: var(--apple-radius-lg); 
    padding: 16px; 
    box-shadow: 0 4px 20px rgba(0,0,0,0.04), 0 8px 32px rgba(102, 126, 234, 0.06); 
    display: flex; 
    flex-direction: column; 
    gap: 10px; 
    transition: all 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); 
    position: relative;
    overflow: hidden;
}
.stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 10%, rgba(102, 126, 234, 0.3) 50%, transparent 90%);
    opacity: 0;
    transition: opacity 0.3s ease;
}
.stat-card:hover::before { opacity: 1; }
.stat-card:hover { 
    transform: translateY(-4px) scale(1.02); 
    box-shadow: 0 12px 40px rgba(102, 126, 234, 0.12), 0 4px 12px rgba(0,0,0,0.06); 
}
.stat-card:active { transform: translateY(-2px) scale(1.01); }
.stat-icon { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: transform 0.3s ease; }
.stat-card:hover .stat-icon { transform: scale(1.1) rotate(5deg); }
.stat-icon-blue { background: linear-gradient(135deg, rgba(0, 122, 255, 0.2), rgba(0, 122, 255, 0.08)); color: var(--apple-accent); box-shadow: 0 3px 10px rgba(0, 122, 255, 0.25); }
.stat-icon-green { background: linear-gradient(135deg, rgba(52, 199, 89, 0.2), rgba(52, 199, 89, 0.08)); color: var(--apple-green); box-shadow: 0 3px 10px rgba(52, 199, 89, 0.25); }
.stat-icon-orange { background: linear-gradient(135deg, rgba(255, 149, 0, 0.2), rgba(255, 149, 0, 0.08)); color: var(--apple-orange); box-shadow: 0 3px 10px rgba(255, 149, 0, 0.25); }
.stat-icon-purple { background: linear-gradient(135deg, rgba(175, 82, 222, 0.2), rgba(175, 82, 222, 0.08)); color: var(--apple-purple); box-shadow: 0 3px 10px rgba(175, 82, 222, 0.25); }
.stat-content { display: flex; flex-direction: column; gap: 2px; }
.stat-value { font-size: 24px; font-weight: 700; color: var(--apple-black); line-height: 1; }
.stat-unit { font-size: 12px; font-weight: 500; color: var(--apple-gray-1); margin-left: 3px; }
.stat-label { font-size: 11px; color: var(--apple-gray-1); font-weight: 500; text-transform: uppercase; letter-spacing: 0.3px; }
.stat-progress { display: flex; flex-direction: column; gap: 4px; margin-top: auto; }
.mini-progress { height: 3px; background: rgba(0,0,0,0.06); border-radius: 2px; overflow: hidden; }
.mini-progress-bar { height: 100%; background: linear-gradient(90deg, var(--apple-accent), #5856D6); border-radius: 2px; transition: width 0.6s cubic-bezier(0.25, 0.1, 0.25, 1); }
.stat-target { font-size: 10px; color: var(--apple-gray-2); }
.stat-meta { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--apple-gray-2); margin-top: auto; padding-top: 6px; border-top: 1px solid rgba(0,0,0,0.04); }
.stat-badge { margin-top: auto; }
.badge { display: inline-block; padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 600; backdrop-filter: blur(4px); }
.badge-gold { background: linear-gradient(135deg, rgba(255, 204, 0, 0.2), rgba(255, 149, 0, 0.1)); color: #B38F00; box-shadow: 0 2px 6px rgba(255, 204, 0, 0.2); }
.badge-silver { background: linear-gradient(135deg, rgba(0, 122, 255, 0.15), rgba(88, 86, 214, 0.1)); color: var(--apple-accent); box-shadow: 0 2px 6px rgba(0, 122, 255, 0.15); }
.badge-bronze { background: rgba(0,0,0,0.04); color: var(--apple-gray-1); }
.two-column { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 20px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-title { font-size: 17px; font-weight: 600; color: var(--apple-black); }
.see-all-link { display: flex; align-items: center; gap: 4px; font-size: 13px; font-weight: 500; color: var(--apple-accent); text-decoration: none; transition: var(--apple-transition); }
.see-all-link:hover { gap: 8px; }
.activity-section { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: 20px; box-shadow: var(--apple-shadow-sm); }
.activity-list { display: flex; flex-direction: column; }
.activity-item { display: flex; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--apple-gray-5); }
.activity-item:last-child { border-bottom: none; }
.activity-dot { width: 10px; height: 10px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
.activity-dot-green { background: var(--apple-green); }
.activity-dot-yellow { background: var(--apple-yellow); }
.activity-dot-gray { background: var(--apple-gray-3); }
.activity-content { flex: 1; }
.activity-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.activity-date { font-size: 14px; font-weight: 600; color: var(--apple-black); }
.activity-status { font-size: 12px; font-weight: 600; }
.status-text-green { color: var(--apple-green); }
.status-text-yellow { color: #B38F00; }
.status-text-gray { color: var(--apple-gray-1); }
.activity-details { display: flex; gap: 16px; flex-wrap: wrap; }
.activity-time, .activity-location { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--apple-gray-1); }
.empty-activity { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; color: var(--apple-gray-2); text-align: center; }
.empty-activity p { margin-top: 12px; font-size: 14px; }
.profile-section { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: 20px; box-shadow: var(--apple-shadow-sm); }
.profile-card-content { text-align: center; }
.profile-avatar-large { width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 16px; overflow: hidden; background: linear-gradient(135deg, #667eea, #764ba2); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 20px rgba(102, 126, 234, 0.3); }
.profile-avatar-large img { width: 100%; height: 100%; object-fit: cover; }
.profile-avatar-large span { font-size: 32px; font-weight: 600; color: white; }
.profile-name { font-size: 18px; font-weight: 600; color: var(--apple-black); margin-bottom: 4px; }
.profile-email { font-size: 13px; color: var(--apple-gray-1); margin-bottom: 20px; }
.profile-info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; text-align: center; }
.profile-info-item { background: var(--apple-gray-6); border-radius: var(--apple-radius-md); padding: 12px 8px; }
.info-label { display: block; font-size: 11px; color: var(--apple-gray-1); margin-bottom: 4px; }
.info-value { font-size: 13px; font-weight: 600; color: var(--apple-black); }
.actions-section { margin-bottom: 20px; }
.actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
.action-card { display: flex; align-items: center; gap: 16px; background: var(--apple-white); border-radius: var(--apple-radius-lg); padding: 18px 20px; text-decoration: none; box-shadow: var(--apple-shadow-sm); transition: var(--apple-transition); }
.action-card:hover { transform: translateY(-2px); box-shadow: var(--apple-shadow-md); }
.action-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
.action-primary .action-icon { background: rgba(255,255,255,0.2); color: white; }
.action-primary .action-desc { opacity: 0.85; }
.action-icon { width: 48px; height: 48px; border-radius: 12px; background: var(--apple-gray-6); display: flex; align-items: center; justify-content: center; color: var(--apple-accent); flex-shrink: 0; }
.action-text { flex: 1; }
.action-title { display: block; font-size: 15px; font-weight: 600; color: var(--apple-black); margin-bottom: 2px; }
.action-primary .action-title { color: white; }
.action-desc { font-size: 12px; color: var(--apple-gray-1); }
:global(.action-arrow) { color: var(--apple-gray-3); transition: var(--apple-transition); }
.action-card:hover :global(.action-arrow) { transform: translateX(4px); color: var(--apple-accent); }
.action-primary :global(.action-arrow) { color: rgba(255,255,255,0.7); }
.action-primary:hover :global(.action-arrow) { color: white; }
@media (min-width: 768px) { .two-column { grid-template-columns: 1.2fr 0.8fr; } }
@media (max-width: 640px) { 
    .hero-content { flex-direction: column; gap: 16px; } 
    .hero-time { text-align: left; } 
    .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } 
    .stat-card { padding: 14px; }
    .stat-icon { width: 34px; height: 34px; }
    .stat-value { font-size: 20px; }
    .profile-info-grid { grid-template-columns: 1fr; } 
    .actions-grid { grid-template-columns: 1fr; } 
}
@media (max-width: 400px) { 
    .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; } 
    .stat-card { padding: 12px; gap: 8px; }
    .stat-icon { width: 30px; height: 30px; border-radius: 8px; }
    .stat-value { font-size: 18px; }
    .stat-label { font-size: 10px; }
}

/* Christmas Daily Reward Section */
.christmas-reward-section {
    margin-bottom: 20px;
}

/* See All Button Style */
button.see-all-link {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    font-family: inherit;
}

/* Recent Activity Modal */
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
    padding: 16px;
    animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

.modal-container {
    background: var(--apple-white);
    border-radius: var(--apple-radius-xl);
    width: 100%;
    max-width: 520px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
    animation: slideUp 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
    overflow: hidden;
}

@keyframes slideUp {
    from { 
        opacity: 0;
        transform: translateY(20px) scale(0.98);
    }
    to { 
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

.modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px;
    border-bottom: 1px solid var(--apple-gray-5);
    background: linear-gradient(180deg, rgba(102, 126, 234, 0.05) 0%, transparent 100%);
}

.modal-title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
    font-weight: 600;
    color: var(--apple-black);
    margin: 0;
}

.modal-title :global(svg) {
    color: var(--apple-accent);
}

.modal-close {
    width: 36px;
    height: 36px;
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

.modal-close:hover {
    background: var(--apple-gray-5);
    color: var(--apple-black);
    transform: scale(1.05);
}

.modal-close:active {
    transform: scale(0.95);
}

.modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 8px 0;
    scrollbar-width: thin;
    scrollbar-color: var(--apple-gray-4) transparent;
}

.modal-body::-webkit-scrollbar {
    width: 6px;
}

.modal-body::-webkit-scrollbar-track {
    background: transparent;
}

.modal-body::-webkit-scrollbar-thumb {
    background: var(--apple-gray-4);
    border-radius: 3px;
}

.modal-activity-list {
    display: flex;
    flex-direction: column;
}

.modal-activity-item {
    display: flex;
    gap: 14px;
    padding: 16px 24px;
    border-bottom: 1px solid var(--apple-gray-5);
    transition: background 0.15s ease;
    animation: itemFadeIn 0.3s ease-out backwards;
}

@keyframes itemFadeIn {
    from {
        opacity: 0;
        transform: translateX(-10px);
    }
    to {
        opacity: 1;
        transform: translateX(0);
    }
}

.modal-activity-item:last-child {
    border-bottom: none;
}

.modal-activity-item:hover {
    background: var(--apple-gray-6);
}

.modal-footer {
    padding: 16px 24px;
    border-top: 1px solid var(--apple-gray-5);
    display: flex;
    justify-content: center;
    background: var(--apple-gray-6);
}

.modal-view-all {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    font-size: 14px;
    font-weight: 600;
    border-radius: 12px;
    text-decoration: none;
    transition: all 0.2s ease;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.modal-view-all:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.modal-view-all:active {
    transform: translateY(0);
}

/* Modal Responsive */
@media (max-width: 640px) {
    .modal-overlay {
        padding: 0;
        align-items: flex-end;
    }
    
    .modal-container {
        max-width: 100%;
        max-height: 90vh;
        border-radius: 24px 24px 0 0;
        animation: slideUpMobile 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
    }
    
    @keyframes slideUpMobile {
        from { 
            opacity: 0;
            transform: translateY(100%);
        }
        to { 
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    .modal-header {
        padding: 16px 20px;
    }
    
    .modal-title {
        font-size: 16px;
    }
    
    .modal-activity-item {
        padding: 14px 20px;
    }
    
    .modal-footer {
        padding: 16px 20px;
        padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
    }
    
    .modal-view-all {
        width: 100%;
        justify-content: center;
    }
}

@media (max-width: 400px) {
    .modal-header {
        padding: 14px 16px;
    }
    
    .modal-activity-item {
        padding: 12px 16px;
        gap: 10px;
    }
    
    .activity-date {
        font-size: 13px;
    }
    
    .activity-details {
        gap: 10px;
    }
}
</style>
