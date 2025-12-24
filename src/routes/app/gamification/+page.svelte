<script>
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { subscribeToAuth } from '$lib/firebase';
    import { IconFlame, IconTrophy, IconMedal, IconChartBar, IconStar, IconCrown, IconChevronDown, IconChevronUp, IconRefresh } from '@tabler/icons-svelte';
    import { BadgeTypes, BadgeCategories, BadgeTiers, getAllBadgesGrouped } from '$lib/stores/gamification.js';

    function getDefaultData() {
        return {
            currentStreak: 0, longestStreak: 0, totalCheckIns: 0, earlyCheckIns: 0,
            perfectMonths: 0, badges: [], lastCheckInDate: null, points: 0
        };
    }

    let userId = null;
    let pageLoading = true;
    let dataLoading = false;
    let syncing = false;
    let gamificationData = getDefaultData();
    let leaderboard = [];
    let userRank = null;
    let badgeProgress = {};
    let activeTab = 'overview';
    let expandedCategories = {};
    let selectedCategory = 'all';
    let lastSyncTime = null;
    let unsubscribers = [];

    // Initialize all categories as expanded
    Object.keys(BadgeCategories).forEach(key => {
        expandedCategories[BadgeCategories[key].id] = true;
    });

    onMount(() => {
        if (!browser) { pageLoading = false; return; }
        const unsubscribe = subscribeToAuth(async (user) => {
            if (user) { 
                userId = user.uid; 
                await loadData(); 
            }
            pageLoading = false;
        });
        unsubscribers.push(unsubscribe);
        return () => unsubscribers.forEach(u => u && u());
    });

    onDestroy(() => {
        unsubscribers.forEach(u => u && u());
    });

    async function loadData() {
        if (!userId) return;
        dataLoading = true;
        try {
            // Fetch from MongoDB API
            const [gamifRes, leaderboardRes] = await Promise.all([
                fetch(`/api/gamification?userId=${userId}`),
                fetch(`/api/gamification/leaderboard?limit=10&userId=${userId}`)
            ]);

            if (gamifRes.ok) {
                const result = await gamifRes.json();
                gamificationData = result.data || getDefaultData();
                console.log('[Gamification] Loaded data from:', result.source);
            }

            if (leaderboardRes.ok) {
                const result = await leaderboardRes.json();
                leaderboard = result.leaderboard || [];
                userRank = result.userRank;
            }
        } catch (error) {
            console.error('Error loading gamification data:', error);
            gamificationData = getDefaultData();
        }
        dataLoading = false;
    }

    async function refreshData() {
        syncing = true;
        await loadData();
        lastSyncTime = new Date();
        syncing = false;
    }

    function getStreakMessage(streak) {
        if (streak >= 30) return "Incredible! You're on fire! 🔥";
        if (streak >= 14) return "Amazing consistency! Keep it up!";
        if (streak >= 7) return "Great week! You're building momentum!";
        if (streak >= 3) return "Nice start! Keep the streak going!";
        if (streak >= 1) return "Good job! Come back tomorrow!";
        return "Start your streak today!";
    }

    function toggleCategory(categoryId) {
        expandedCategories[categoryId] = !expandedCategories[categoryId];
    }

    function getTierGradient(tier) {
        return BadgeTiers[tier.toUpperCase()]?.gradient || BadgeTiers.BRONZE.gradient;
    }

    $: groupedBadges = getAllBadgesGrouped();
    $: filteredCategories = selectedCategory === 'all' 
        ? Object.values(groupedBadges) 
        : Object.values(groupedBadges).filter(cat => cat.id === selectedCategory);
    $: totalBadges = Object.values(BadgeTypes).length;
    $: earnedBadgesCount = gamificationData?.badges?.length || 0;
</script>

<svelte:head>
    <title>Achievements | Student Attendance</title>
</svelte:head>

<div class="page-container">
    <header class="page-header">
        <div class="header-content">
            <h1>Achievements</h1>
            <p class="page-subtitle">Track your progress and earn premium rewards</p>
        </div>
        {#if userId && !pageLoading}
        <button class="refresh-btn" on:click={refreshData} disabled={syncing || dataLoading}>
            <IconRefresh size={18} stroke={1.5} class={syncing ? 'spinning' : ''} />
            <span>{syncing ? 'Syncing...' : 'Refresh'}</span>
        </button>
        {/if}
    </header>

    {#if pageLoading}
        <div class="loading-wrapper"><div class="apple-spinner"></div></div>
    {:else if !userId}
        <div class="error-state"><p>Please sign in to view your achievements</p></div>
    {:else if dataLoading}
        <div class="loading-wrapper"><div class="apple-spinner"></div><p>Loading achievements...</p></div>
    {:else}
        <!-- Tab Navigation -->
        <div class="tab-nav">
            <button class="tab-btn" class:active={activeTab === 'overview'} on:click={() => activeTab = 'overview'}>
                <IconChartBar size={18} stroke={1.5} /><span>Overview</span>
            </button>
            <button class="tab-btn" class:active={activeTab === 'badges'} on:click={() => activeTab = 'badges'}>
                <IconMedal size={18} stroke={1.5} /><span>Badges</span>
            </button>
            <button class="tab-btn" class:active={activeTab === 'leaderboard'} on:click={() => activeTab = 'leaderboard'}>
                <IconTrophy size={18} stroke={1.5} /><span>Leaderboard</span>
            </button>
        </div>

        <!-- Overview Tab -->
        {#if activeTab === 'overview'}
            <div class="overview-section apple-animate-in">
                <!-- Progress Card -->
                <div class="progress-card">
                    <div class="progress-header">
                        <h3>Badge Collection Progress</h3>
                        <span class="progress-count">{earnedBadgesCount} / {totalBadges}</span>
                    </div>
                    <div class="progress-bar-wrapper">
                        <div class="progress-bar" style="width: {(earnedBadgesCount / totalBadges) * 100}%"></div>
                    </div>
                    <p class="progress-text">{Math.round((earnedBadgesCount / totalBadges) * 100)}% Complete</p>
                </div>

                <!-- Streak Card -->
                <div class="streak-card">
                    <div class="streak-icon"><IconFlame size={32} stroke={1.5} /></div>
                    <div class="streak-content">
                        <div class="streak-number">{gamificationData?.currentStreak || 0}</div>
                        <div class="streak-label">Day Streak</div>
                        <p class="streak-message">{getStreakMessage(gamificationData?.currentStreak || 0)}</p>
                    </div>
                    <div class="streak-best">
                        <span class="best-label">Best</span>
                        <span class="best-value">{gamificationData?.longestStreak || 0}</span>
                    </div>
                </div>

                <!-- Stats Grid -->
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-icon points"><IconStar size={20} stroke={1.5} /></div>
                        <div class="stat-value">{gamificationData?.points || 0}</div>
                        <div class="stat-label">Total Points</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon checkins"><IconChartBar size={20} stroke={1.5} /></div>
                        <div class="stat-value">{gamificationData?.totalCheckIns || 0}</div>
                        <div class="stat-label">Check-ins</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon rank"><IconCrown size={20} stroke={1.5} /></div>
                        <div class="stat-value">#{userRank || '-'}</div>
                        <div class="stat-label">Your Rank</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-icon badges"><IconMedal size={20} stroke={1.5} /></div>
                        <div class="stat-value">{earnedBadgesCount}</div>
                        <div class="stat-label">Badges</div>
                    </div>
                </div>

                <!-- Recent Badges -->
                {#if gamificationData?.badges?.length > 0}
                    <div class="recent-badges">
                        <h3>Recently Earned</h3>
                        <div class="recent-badges-list">
                            {#each gamificationData.badges.slice(-4).reverse() as badgeId}
                                {@const badge = Object.values(BadgeTypes).find(b => b.id === badgeId)}
                                {#if badge}
                                    <div class="recent-badge" style="--badge-color: {badge.color}">
                                        <span class="badge-emoji">{badge.icon}</span>
                                        <span class="badge-name">{badge.name}</span>
                                    </div>
                                {/if}
                            {/each}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Badges Tab -->
        {#if activeTab === 'badges'}
            <div class="badges-section apple-animate-in">
                <!-- Category Filter -->
                <div class="category-filter">
                    <button class="filter-btn" class:active={selectedCategory === 'all'} on:click={() => selectedCategory = 'all'}>
                        All Badges
                    </button>
                    {#each Object.values(BadgeCategories) as category}
                        <button class="filter-btn" class:active={selectedCategory === category.id} on:click={() => selectedCategory = category.id}>
                            {category.icon} {category.name}
                        </button>
                    {/each}
                </div>

                <!-- Badges by Category -->
                {#each filteredCategories as category}
                    <div class="badge-category">
                        <button class="category-header" on:click={() => toggleCategory(category.id)}>
                            <div class="category-title">
                                <span class="category-icon">{category.icon}</span>
                                <h3>{category.name}</h3>
                                <span class="category-count">
                                    {gamificationData?.badges?.filter(id => category.badges.some(b => b.id === id)).length || 0} / {category.badges.length}
                                </span>
                            </div>
                            <div class="category-toggle">
                                {#if expandedCategories[category.id]}
                                    <IconChevronUp size={20} stroke={1.5} />
                                {:else}
                                    <IconChevronDown size={20} stroke={1.5} />
                                {/if}
                            </div>
                        </button>
                        <p class="category-desc">{category.description}</p>

                        {#if expandedCategories[category.id]}
                            <div class="badges-grid">
                                {#each category.badges as badge}
                                    {@const earned = gamificationData?.badges?.includes(badge.id)}
                                    <div class="badge-card" class:earned style="--badge-color: {badge.color}; --tier-gradient: {getTierGradient(badge.tier)}">
                                        <div class="badge-tier-indicator" data-tier={badge.tier}></div>
                                        <div class="badge-icon-wrapper" class:earned>
                                            <span class="badge-emoji">{badge.icon}</span>
                                            {#if !earned}
                                                <div class="badge-lock">🔒</div>
                                            {/if}
                                        </div>
                                        <div class="badge-info">
                                            <div class="badge-header">
                                                <h4 class="badge-name">{badge.name}</h4>
                                                <span class="badge-tier {badge.tier}">{badge.tier}</span>
                                            </div>
                                            <p class="badge-desc">{badge.description}</p>
                                            <div class="badge-points">
                                                <IconStar size={12} stroke={1.5} />
                                                <span>{badge.points} pts</span>
                                            </div>
                                        </div>
                                        {#if earned}
                                            <div class="badge-earned-tag">✓ Earned</div>
                                        {/if}
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}

        <!-- Leaderboard Tab -->
        {#if activeTab === 'leaderboard'}
            <div class="leaderboard-section apple-animate-in">
                {#if leaderboard.length === 0}
                    <div class="empty-state">
                        <IconTrophy size={48} stroke={1} />
                        <p>No leaderboard data yet</p>
                    </div>
                {:else}
                    <div class="leaderboard-list">
                        {#each leaderboard as user, index}
                            <div class="leaderboard-item" class:current-user={user.id === userId} class:top-three={index < 3}>
                                <div class="rank-badge" class:gold={index === 0} class:silver={index === 1} class:bronze={index === 2}>
                                    {#if index === 0}
                                        <IconCrown size={16} stroke={2} />
                                    {:else}
                                        {index + 1}
                                    {/if}
                                </div>
                                <div class="user-avatar">
                                    {#if user.profilePhoto}
                                        <img src={user.profilePhoto} alt={user.name} />
                                    {:else}
                                        <div class="avatar-placeholder">{user.name?.charAt(0) || '?'}</div>
                                    {/if}
                                </div>
                                <div class="user-info">
                                    <span class="user-name">{user.name}</span>
                                    <span class="user-stats">
                                        <IconFlame size={12} stroke={1.5} />
                                        {user.currentStreak} streak · {user.badgeCount || 0} badges
                                    </span>
                                </div>
                                <div class="user-points">
                                    <span class="points-value">{user.points}</span>
                                    <span class="points-label">pts</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
        {/if}
    {/if}
</div>


<style>
    .page-container { max-width: 900px; margin: 0 auto; padding: 24px 20px; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
    .header-content { flex: 1; }
    .page-header h1 { font-size: 28px; font-weight: 700; color: var(--theme-text, var(--apple-black)); margin-bottom: 4px; }
    .page-subtitle { font-size: 15px; color: var(--apple-gray-1); }
    .refresh-btn { display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--theme-card-bg, var(--apple-white)); border: 1px solid var(--theme-border-light, var(--apple-gray-5)); border-radius: var(--apple-radius-md); font-size: 14px; font-weight: 500; color: var(--apple-gray-1); cursor: pointer; transition: var(--apple-transition); }
    .refresh-btn:hover:not(:disabled) { border-color: var(--apple-accent); color: var(--apple-accent); }
    .refresh-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .refresh-btn :global(.spinning) { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    .loading-wrapper { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 0; gap: 16px; color: var(--apple-gray-1); }
    .error-state { text-align: center; padding: 60px 20px; color: var(--apple-gray-1); }

    .tab-nav { display: flex; gap: 8px; margin-bottom: 24px; padding: 4px; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: var(--apple-radius-lg); }
    .tab-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px 16px; background: transparent; border: none; border-radius: var(--apple-radius-md); font-size: 14px; font-weight: 500; color: var(--apple-gray-1); cursor: pointer; transition: var(--apple-transition); }
    .tab-btn:hover { color: var(--theme-text, var(--apple-black)); }
    .tab-btn.active { background: var(--theme-card-bg, var(--apple-white)); color: var(--apple-accent); box-shadow: var(--apple-shadow-sm); }

    /* Progress Card */
    .progress-card { background: var(--theme-card-bg, var(--apple-white)); border-radius: var(--apple-radius-lg); padding: 20px; margin-bottom: 16px; border: 1px solid var(--theme-border-light, var(--apple-gray-5)); }
    .progress-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .progress-header h3 { font-size: 16px; font-weight: 600; color: var(--theme-text, var(--apple-black)); }
    .progress-count { font-size: 14px; color: var(--apple-accent); font-weight: 600; }
    .progress-bar-wrapper { height: 8px; background: var(--theme-border-light, var(--apple-gray-5)); border-radius: 4px; overflow: hidden; }
    .progress-bar { height: 100%; background: linear-gradient(90deg, var(--apple-accent), #5856D6); border-radius: 4px; transition: width 0.5s ease; }
    .progress-text { font-size: 12px; color: var(--apple-gray-1); margin-top: 8px; text-align: right; }

    /* Streak Card */
    .streak-card { display: flex; align-items: center; gap: 20px; padding: 24px; background: linear-gradient(135deg, #FF6B35 0%, #FF3B30 100%); border-radius: var(--apple-radius-xl); color: white; margin-bottom: 20px; }
    .streak-icon { width: 64px; height: 64px; background: rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; }
    .streak-content { flex: 1; }
    .streak-number { font-size: 48px; font-weight: 700; line-height: 1; }
    .streak-label { font-size: 14px; font-weight: 600; opacity: 0.9; margin-top: 4px; }
    .streak-message { font-size: 13px; opacity: 0.8; margin-top: 8px; }
    .streak-best { display: flex; flex-direction: column; align-items: center; padding: 12px 16px; background: rgba(255, 255, 255, 0.15); border-radius: var(--apple-radius-md); }
    .best-label { font-size: 11px; opacity: 0.8; }
    .best-value { font-size: 24px; font-weight: 700; }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
    .stat-card { background: var(--theme-card-bg, var(--apple-white)); border-radius: var(--apple-radius-lg); padding: 16px; text-align: center; box-shadow: var(--apple-shadow-sm); border: 1px solid var(--theme-border-light, var(--apple-gray-5)); }
    .stat-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
    .stat-icon.points { background: rgba(255, 204, 0, 0.15); color: #B38F00; }
    .stat-icon.checkins { background: rgba(0, 122, 255, 0.15); color: var(--apple-accent); }
    .stat-icon.rank { background: rgba(175, 82, 222, 0.15); color: var(--apple-purple); }
    .stat-icon.badges { background: rgba(52, 199, 89, 0.15); color: var(--apple-green); }
    .stat-value { font-size: 24px; font-weight: 700; color: var(--theme-text, var(--apple-black)); }
    .stat-label { font-size: 12px; color: var(--apple-gray-1); margin-top: 4px; }

    /* Recent Badges */
    .recent-badges { margin-top: 20px; }
    .recent-badges h3 { font-size: 16px; font-weight: 600; color: var(--theme-text, var(--apple-black)); margin-bottom: 12px; }
    .recent-badges-list { display: flex; gap: 12px; flex-wrap: wrap; }
    .recent-badge { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--theme-card-bg, var(--apple-white)); border-radius: var(--apple-radius-md); border: 1px solid var(--badge-color); box-shadow: var(--apple-shadow-sm); }
    .recent-badge .badge-emoji { font-size: 20px; }
    .recent-badge .badge-name { font-size: 13px; font-weight: 500; color: var(--theme-text, var(--apple-black)); }

    /* Category Filter */
    .category-filter { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5)); }
    .filter-btn { padding: 8px 14px; background: var(--theme-card-bg, var(--apple-white)); border: 1px solid var(--theme-border-light, var(--apple-gray-5)); border-radius: 20px; font-size: 12px; font-weight: 500; color: var(--apple-gray-1); cursor: pointer; transition: var(--apple-transition); white-space: nowrap; }
    .filter-btn:hover { border-color: var(--apple-accent); color: var(--apple-accent); }
    .filter-btn.active { background: var(--apple-accent); border-color: var(--apple-accent); color: white; }

    /* Badge Category */
    .badge-category { margin-bottom: 24px; background: var(--theme-card-bg, var(--apple-white)); border-radius: var(--apple-radius-lg); border: 1px solid var(--theme-border-light, var(--apple-gray-5)); overflow: hidden; }
    .category-header { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 16px 20px; background: transparent; border: none; cursor: pointer; transition: var(--apple-transition); }
    .category-header:hover { background: var(--theme-border-light, rgba(0,0,0,0.02)); }
    .category-title { display: flex; align-items: center; gap: 12px; }
    .category-icon { font-size: 20px; }
    .category-title h3 { font-size: 16px; font-weight: 600; color: var(--theme-text, var(--apple-black)); margin: 0; }
    .category-count { font-size: 12px; color: var(--apple-accent); font-weight: 600; background: rgba(0, 122, 255, 0.1); padding: 4px 10px; border-radius: 12px; }
    .category-toggle { color: var(--apple-gray-1); }
    .category-desc { font-size: 13px; color: var(--apple-gray-1); padding: 0 20px 16px; margin: 0; }

    /* Badges Grid */
    .badges-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; padding: 0 16px 16px; }
    .badge-card { display: flex; align-items: flex-start; gap: 14px; padding: 16px; background: var(--theme-bg, var(--apple-light-bg)); border-radius: var(--apple-radius-md); position: relative; opacity: 0.5; filter: grayscale(0.6); transition: all 0.3s ease; overflow: hidden; }
    .badge-card.earned { opacity: 1; filter: none; background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(255,255,255,0.7)); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .badge-tier-indicator { position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: var(--tier-gradient); }
    .badge-icon-wrapper { position: relative; width: 52px; height: 52px; background: rgba(128, 128, 128, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .badge-icon-wrapper.earned { background: var(--tier-gradient); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .badge-lock { position: absolute; bottom: -2px; right: -2px; font-size: 12px; background: var(--theme-card-bg, white); border-radius: 50%; padding: 2px; }
    .badge-emoji { font-size: 22px; }
    .badge-info { flex: 1; min-width: 0; }
    .badge-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap; }
    .badge-name { font-size: 14px; font-weight: 600; color: var(--theme-text, var(--apple-black)); margin: 0; }
    .badge-tier { font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.5px; }
    .badge-tier.bronze { background: linear-gradient(135deg, #CD7F32, #B87333); color: white; }
    .badge-tier.silver { background: linear-gradient(135deg, #C0C0C0, #A8A8A8); color: white; }
    .badge-tier.gold { background: linear-gradient(135deg, #FFD700, #FFA500); color: white; }
    .badge-tier.platinum { background: linear-gradient(135deg, #E5E4E2, #BCC6CC); color: #333; }
    .badge-tier.diamond { background: linear-gradient(135deg, #B9F2FF, #89CFF0); color: #333; }
    .badge-desc { font-size: 12px; color: var(--apple-gray-1); line-height: 1.4; margin-bottom: 6px; }
    .badge-points { display: flex; align-items: center; gap: 4px; font-size: 11px; color: var(--apple-gray-2); }
    .badge-earned-tag { position: absolute; top: 8px; right: 8px; font-size: 10px; font-weight: 600; padding: 3px 8px; background: var(--apple-green); color: white; border-radius: 12px; }

    /* Leaderboard */
    .leaderboard-list { display: flex; flex-direction: column; gap: 8px; }
    .leaderboard-item { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--theme-card-bg, var(--apple-white)); border-radius: var(--apple-radius-lg); border: 1px solid var(--theme-border-light, var(--apple-gray-5)); transition: var(--apple-transition); }
    .leaderboard-item.current-user { background: rgba(0, 122, 255, 0.08); border-color: var(--apple-accent); }
    .leaderboard-item.top-three { box-shadow: var(--apple-shadow-sm); }
    .rank-badge { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; background: var(--theme-border-light, var(--apple-gray-6)); color: var(--apple-gray-1); }
    .rank-badge.gold { background: linear-gradient(135deg, #FFD700, #FFA500); color: white; }
    .rank-badge.silver { background: linear-gradient(135deg, #C0C0C0, #A8A8A8); color: white; }
    .rank-badge.bronze { background: linear-gradient(135deg, #CD7F32, #B87333); color: white; }
    .user-avatar { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
    .user-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .avatar-placeholder { width: 100%; height: 100%; background: linear-gradient(135deg, var(--apple-accent), #5856D6); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 16px; }
    .user-info { flex: 1; min-width: 0; }
    .user-name { display: block; font-size: 14px; font-weight: 600; color: var(--theme-text, var(--apple-black)); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-stats { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--apple-gray-1); margin-top: 2px; }
    .user-points { text-align: right; }
    .points-value { display: block; font-size: 18px; font-weight: 700; color: var(--apple-accent); }
    .points-label { font-size: 11px; color: var(--apple-gray-1); }
    .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; color: var(--apple-gray-2); }
    .empty-state p { margin-top: 16px; font-size: 14px; }

    /* Responsive */
    @media (max-width: 768px) {
        .category-filter { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 12px; -webkit-overflow-scrolling: touch; }
        .filter-btn { flex-shrink: 0; }
        .badges-grid { grid-template-columns: 1fr; }
    }

    @media (max-width: 640px) {
        .page-container { padding: 16px; }
        .page-header h1 { font-size: 24px; }
        .tab-btn span { display: none; }
        .streak-card { flex-wrap: wrap; }
        .streak-best { width: 100%; flex-direction: row; justify-content: center; gap: 8px; margin-top: 8px; }
        .category-title h3 { font-size: 14px; }
        .badge-card { padding: 12px; }
    }
</style>
