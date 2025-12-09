<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { activeHoliday, seasonalPrefs } from '$lib/stores/seasonalTheme.js';
    
    export let userId = '';
    export let onRewardClaimed = (reward) => {};
    
    let showRewardModal = false;
    let currentReward = null;
    let streakDays = 0;
    let canClaim = false;
    let lastClaimDate = null;
    
    const STORAGE_KEY = 'christmas-daily-reward';
    
    // Daily rewards escalate with streak
    const dailyRewards = [
        { day: 1, emoji: '🎁', name: 'Welcome Gift', points: 10, bonus: '' },
        { day: 2, emoji: '🍪', name: 'Christmas Cookie', points: 15, bonus: '' },
        { day: 3, emoji: '⭐', name: 'Golden Star', points: 20, bonus: '' },
        { day: 4, emoji: '🎄', name: 'Mini Tree', points: 25, bonus: '' },
        { day: 5, emoji: '🔔', name: 'Jingle Bell', points: 30, bonus: '1.5x' },
        { day: 6, emoji: '❄️', name: 'Snowflake Badge', points: 40, bonus: '' },
        { day: 7, emoji: '🦌', name: 'Reindeer Friend', points: 50, bonus: '2x' },
        { day: 8, emoji: '🎅', name: 'Santa\'s Blessing', points: 75, bonus: '' },
        { day: 9, emoji: '✨', name: 'Magic Dust', points: 60, bonus: '' },
        { day: 10, emoji: '🏆', name: 'Christmas Champion', points: 100, bonus: '3x' }
    ];
    
    function getStoredData() {
        if (!browser) return null;
        try {
            const data = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }
    
    function saveData(data) {
        if (!browser) return;
        localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify(data));
    }
    
    function checkRewardStatus() {
        const stored = getStoredData();
        const today = new Date().toDateString();
        
        if (!stored) {
            // First time - can claim day 1
            streakDays = 0;
            canClaim = true;
            return;
        }
        
        lastClaimDate = stored.lastClaim;
        streakDays = stored.streak || 0;
        
        const lastClaim = new Date(stored.lastClaim);
        const todayDate = new Date();
        
        // Reset time to compare dates only
        lastClaim.setHours(0, 0, 0, 0);
        todayDate.setHours(0, 0, 0, 0);
        
        const diffDays = Math.floor((todayDate - lastClaim) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) {
            // Already claimed today
            canClaim = false;
        } else if (diffDays === 1) {
            // Consecutive day - continue streak
            canClaim = true;
        } else {
            // Streak broken - reset
            streakDays = 0;
            canClaim = true;
        }
    }
    
    function claimReward() {
        if (!canClaim) return;
        
        const nextDay = Math.min(streakDays + 1, dailyRewards.length);
        currentReward = dailyRewards[nextDay - 1];
        
        // Update storage
        const newStreak = streakDays + 1;
        saveData({
            lastClaim: new Date().toDateString(),
            streak: newStreak,
            totalClaimed: (getStoredData()?.totalClaimed || 0) + 1
        });
        
        streakDays = newStreak;
        canClaim = false;
        showRewardModal = true;
        
        // Callback for parent
        onRewardClaimed({
            ...currentReward,
            streak: newStreak
        });
    }
    
    function closeModal() {
        showRewardModal = false;
        currentReward = null;
    }
    
    onMount(() => {
        if (browser && userId) {
            checkRewardStatus();
        }
    });
    
    $: isChristmas = $activeHoliday?.id === 'christmas' && $seasonalPrefs.enabled;
    $: nextReward = dailyRewards[Math.min(streakDays, dailyRewards.length - 1)];
</script>

{#if isChristmas}
    <!-- Daily Reward Button -->
    {#if canClaim}
        <button class="daily-reward-btn" on:click={claimReward}>
            <div class="reward-glow"></div>
            <span class="reward-icon">🎁</span>
            <div class="reward-info">
                <span class="reward-label">Daily Gift Ready!</span>
                <span class="reward-streak">Day {streakDays + 1} Streak</span>
            </div>
            <span class="reward-arrow">→</span>
        </button>
    {:else}
        <div class="daily-reward-claimed">
            <span class="claimed-icon">✅</span>
            <div class="claimed-info">
                <span class="claimed-label">Today's Gift Claimed</span>
                <span class="claimed-streak">🔥 {streakDays} day streak</span>
            </div>
        </div>
    {/if}
    
    <!-- Reward Modal -->
    {#if showRewardModal && currentReward}
        <div class="reward-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="button" tabindex="0">
            <div class="reward-modal" on:click|stopPropagation>
                <!-- Confetti burst -->
                <div class="confetti-container">
                    {#each Array(20) as _, i}
                        <div 
                            class="confetti-piece" 
                            style="
                                --x: {Math.random() * 100}%;
                                --delay: {Math.random() * 0.5}s;
                                --color: {['#C41E3A', '#228B22', '#FFD700', '#FF9500'][i % 4]};
                            "
                        ></div>
                    {/each}
                </div>
                
                <div class="reward-content">
                    <div class="reward-day">Day {streakDays}</div>
                    <div class="reward-emoji">{currentReward.emoji}</div>
                    <h3 class="reward-title">{currentReward.name}</h3>
                    
                    <div class="reward-points">
                        +{currentReward.points} points
                        {#if currentReward.bonus}
                            <span class="bonus-badge">{currentReward.bonus} Bonus!</span>
                        {/if}
                    </div>
                    
                    {#if streakDays >= 7}
                        <div class="streak-achievement">
                            🏆 Amazing {streakDays}-day streak!
                        </div>
                    {/if}
                    
                    <div class="next-preview">
                        <span class="next-label">Tomorrow:</span>
                        <span class="next-reward">
                            {dailyRewards[Math.min(streakDays, dailyRewards.length - 1)].emoji}
                            {dailyRewards[Math.min(streakDays, dailyRewards.length - 1)].name}
                        </span>
                    </div>
                    
                    <button class="claim-btn" on:click={closeModal}>
                        Awesome! 🎉
                    </button>
                </div>
            </div>
        </div>
    {/if}
{/if}

<style>
    /* Daily Reward Button */
    .daily-reward-btn {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 14px 16px;
        background: linear-gradient(135deg, #C41E3A, #228B22);
        border: none;
        border-radius: var(--apple-radius-lg, 18px);
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: transform 0.2s ease;
    }
    
    .daily-reward-btn:hover {
        transform: scale(1.02);
    }
    
    .reward-glow {
        position: absolute;
        inset: 0;
        background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
        animation: glow-sweep 2s ease-in-out infinite;
    }
    
    @keyframes glow-sweep {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(100%); }
    }
    
    .reward-icon {
        font-size: 28px;
        animation: gift-wiggle 1s ease-in-out infinite;
        position: relative;
        z-index: 1;
    }
    
    @keyframes gift-wiggle {
        0%, 100% { transform: rotate(-5deg); }
        50% { transform: rotate(5deg); }
    }
    
    .reward-info {
        flex: 1;
        text-align: left;
        position: relative;
        z-index: 1;
    }
    
    .reward-label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: white;
    }
    
    .reward-streak {
        display: block;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
    }
    
    .reward-arrow {
        font-size: 18px;
        color: white;
        position: relative;
        z-index: 1;
        animation: arrow-bounce 1s ease-in-out infinite;
    }
    
    @keyframes arrow-bounce {
        0%, 100% { transform: translateX(0); }
        50% { transform: translateX(4px); }
    }
    
    /* Claimed State */
    .daily-reward-claimed {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: var(--theme-border-light, #F2F2F7);
        border-radius: var(--apple-radius-lg, 18px);
    }
    
    .claimed-icon {
        font-size: 24px;
    }
    
    .claimed-info {
        flex: 1;
    }
    
    .claimed-label {
        display: block;
        font-size: 14px;
        font-weight: 500;
        color: var(--theme-text-secondary, #8E8E93);
    }
    
    .claimed-streak {
        display: block;
        font-size: 12px;
        color: var(--apple-orange, #FF9500);
        font-weight: 600;
    }
    
    /* Reward Modal */
    .reward-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10002;
        animation: fade-in 0.3s ease;
    }
    
    @keyframes fade-in {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    
    .reward-modal {
        background: var(--theme-card-bg, white);
        border-radius: 28px;
        padding: 40px;
        text-align: center;
        position: relative;
        overflow: hidden;
        animation: modal-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
        max-width: 340px;
        width: 90%;
    }
    
    @keyframes modal-pop {
        0% { transform: scale(0.5); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }
    
    /* Confetti */
    .confetti-container {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
    }
    
    .confetti-piece {
        position: absolute;
        left: var(--x);
        top: -10px;
        width: 10px;
        height: 10px;
        background: var(--color);
        animation: confetti-fall 2s ease-out var(--delay) forwards;
    }
    
    @keyframes confetti-fall {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
        }
        100% {
            transform: translateY(400px) rotate(720deg);
            opacity: 0;
        }
    }
    
    .reward-content {
        position: relative;
        z-index: 1;
    }
    
    .reward-day {
        display: inline-block;
        padding: 6px 16px;
        background: linear-gradient(135deg, #C41E3A, #228B22);
        color: white;
        font-size: 12px;
        font-weight: 600;
        border-radius: 20px;
        margin-bottom: 16px;
    }
    
    .reward-emoji {
        font-size: 72px;
        margin-bottom: 12px;
        animation: emoji-pop 0.6s ease-out;
    }
    
    @keyframes emoji-pop {
        0% { transform: scale(0) rotate(-180deg); }
        60% { transform: scale(1.2) rotate(10deg); }
        100% { transform: scale(1) rotate(0deg); }
    }
    
    .reward-title {
        font-size: 24px;
        font-weight: 700;
        color: var(--theme-text, #0A0A0A);
        margin: 0 0 12px;
    }
    
    .reward-points {
        font-size: 20px;
        font-weight: 600;
        color: #34C759;
        margin-bottom: 12px;
    }
    
    .bonus-badge {
        display: inline-block;
        padding: 4px 10px;
        background: #FFD700;
        color: #000;
        font-size: 12px;
        font-weight: 700;
        border-radius: 12px;
        margin-left: 8px;
        animation: bonus-pulse 1s ease-in-out infinite;
    }
    
    @keyframes bonus-pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
    }
    
    .streak-achievement {
        padding: 10px 16px;
        background: rgba(255, 215, 0, 0.15);
        border-radius: 12px;
        font-size: 14px;
        font-weight: 600;
        color: #B8860B;
        margin-bottom: 16px;
    }
    
    .next-preview {
        padding: 12px;
        background: var(--theme-border-light, #F2F2F7);
        border-radius: 12px;
        margin-bottom: 20px;
    }
    
    .next-label {
        display: block;
        font-size: 11px;
        color: var(--theme-text-secondary, #8E8E93);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 4px;
    }
    
    .next-reward {
        font-size: 14px;
        font-weight: 500;
        color: var(--theme-text, #0A0A0A);
    }
    
    .claim-btn {
        width: 100%;
        padding: 14px 28px;
        background: linear-gradient(135deg, #C41E3A, #228B22);
        color: white;
        font-size: 16px;
        font-weight: 600;
        border: none;
        border-radius: 14px;
        cursor: pointer;
        transition: transform 0.2s ease;
    }
    
    .claim-btn:hover {
        transform: scale(1.05);
    }
    
    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .reward-glow,
        .reward-icon,
        .reward-arrow,
        .confetti-piece,
        .reward-emoji,
        .bonus-badge {
            animation: none;
        }
    }
</style>
