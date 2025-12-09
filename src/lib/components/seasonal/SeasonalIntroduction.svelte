<script>
    import { seasonalPrefs, activeHoliday, holidays, getDaysUntilNextHoliday } from '$lib/stores/seasonalTheme.js';
    import { IconSparkles, IconX, IconChevronRight, IconCalendar, IconGift } from '@tabler/icons-svelte';
    import { fade, fly } from 'svelte/transition';
    import { onMount } from 'svelte';

    export let show = false;
    
    let nextHoliday = null;
    let currentHoliday = null;
    
    onMount(() => {
        // Check if there's an active holiday right now
        const today = new Date();
        for (const holiday of Object.values(holidays)) {
            const month = today.getMonth() + 1;
            const day = today.getDate();
            if (holiday.startMonth === month && day >= holiday.startDay && day <= holiday.endDay) {
                currentHoliday = holiday;
                break;
            }
        }
        
        // Get next upcoming holiday
        nextHoliday = getDaysUntilNextHoliday();
    });
    
    function enableSeasonalThemes() {
        seasonalPrefs.enableFromIntro();
        show = false;
    }
    
    function dismissIntro() {
        seasonalPrefs.dismissIntro();
        show = false;
    }
    
    function remindLater() {
        seasonalPrefs.markIntroSeen();
        show = false;
    }
</script>

{#if show}
    <div class="intro-overlay" transition:fade={{ duration: 200 }}>
        <div class="intro-modal" transition:fly={{ y: 30, duration: 300 }}>
            <!-- Header with sparkles -->
            <div class="intro-header">
                <div class="sparkle-icon">
                    <IconSparkles size={32} stroke={1.5} />
                </div>
                <button class="close-btn" on:click={dismissIntro} aria-label="Close">
                    <IconX size={20} stroke={2} />
                </button>
            </div>
            
            <!-- Content -->
            <div class="intro-content">
                <h2>✨ Seasonal Themes</h2>
                <p class="intro-desc">
                    Make your experience more festive! Enable seasonal themes to enjoy beautiful holiday decorations, 
                    animations, and special effects throughout the year.
                </p>
                
                <!-- Holiday Preview -->
                <div class="holiday-preview">
                    {#if currentHoliday}
                        <div class="current-holiday">
                            <span class="holiday-emoji">{currentHoliday.emoji}</span>
                            <div class="holiday-info">
                                <span class="holiday-label">Active Now</span>
                                <span class="holiday-name">{currentHoliday.name}</span>
                            </div>
                        </div>
                    {:else if nextHoliday?.holiday}
                        <div class="next-holiday">
                            <span class="holiday-emoji">{nextHoliday.holiday.emoji}</span>
                            <div class="holiday-info">
                                <span class="holiday-label">Coming in {nextHoliday.days} days</span>
                                <span class="holiday-name">{nextHoliday.holiday.name}</span>
                            </div>
                        </div>
                    {/if}
                </div>
                
                <!-- Features List -->
                <div class="features-list">
                    <div class="feature-item">
                        <IconGift size={18} stroke={1.5} />
                        <span>Holiday decorations & effects</span>
                    </div>
                    <div class="feature-item">
                        <IconCalendar size={18} stroke={1.5} />
                        <span>Auto-activates during holidays</span>
                    </div>
                    <div class="feature-item">
                        <IconSparkles size={18} stroke={1.5} />
                        <span>Customizable intensity levels</span>
                    </div>
                </div>
            </div>
            
            <!-- Actions -->
            <div class="intro-actions">
                <button class="enable-btn" on:click={enableSeasonalThemes}>
                    <IconSparkles size={18} stroke={2} />
                    <span>Enable Themes</span>
                </button>
                <button class="later-btn" on:click={remindLater}>
                    Maybe Later
                </button>
            </div>
            
            <p class="settings-hint">
                You can always change this in Profile → Seasonal
            </p>
        </div>
    </div>
{/if}

<style>
    .intro-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1100;
        padding: 20px;
    }
    
    .intro-modal {
        background: var(--apple-white, #fff);
        border-radius: 24px;
        width: 100%;
        max-width: 400px;
        overflow: hidden;
        box-shadow: 0 25px 60px rgba(0, 0, 0, 0.3);
    }
    
    .intro-header {
        position: relative;
        padding: 24px 24px 0;
        display: flex;
        justify-content: center;
    }
    
    .sparkle-icon {
        width: 64px;
        height: 64px;
        background: linear-gradient(135deg, #FFD700, #FFA500);
        border-radius: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        box-shadow: 0 8px 24px rgba(255, 165, 0, 0.3);
    }
    
    .close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--apple-gray-6, #F2F2F7);
        border: none;
        color: var(--apple-gray-1, #8E8E93);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }
    
    .close-btn:hover {
        background: var(--apple-gray-5, #E5E5EA);
        color: var(--apple-black, #0A0A0A);
    }
    
    .intro-content {
        padding: 20px 24px;
        text-align: center;
    }
    
    .intro-content h2 {
        font-size: 22px;
        font-weight: 700;
        color: var(--apple-black, #0A0A0A);
        margin: 0 0 8px;
    }
    
    .intro-desc {
        font-size: 14px;
        color: var(--apple-gray-1, #8E8E93);
        line-height: 1.5;
        margin: 0 0 20px;
    }
    
    .holiday-preview {
        margin-bottom: 20px;
    }
    
    .current-holiday,
    .next-holiday {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.1), rgba(255, 165, 0, 0.1));
        border-radius: 14px;
        border: 1px solid rgba(255, 165, 0, 0.2);
    }
    
    .holiday-emoji {
        font-size: 32px;
    }
    
    .holiday-info {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }
    
    .holiday-label {
        font-size: 11px;
        font-weight: 600;
        color: var(--apple-orange, #FF9500);
        text-transform: uppercase;
        letter-spacing: 0.3px;
    }
    
    .holiday-name {
        font-size: 16px;
        font-weight: 600;
        color: var(--apple-black, #0A0A0A);
    }
    
    .features-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        text-align: left;
    }
    
    .feature-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: var(--apple-gray-1, #8E8E93);
    }
    
    .feature-item :global(svg) {
        color: var(--apple-accent, #007AFF);
        flex-shrink: 0;
    }
    
    .intro-actions {
        padding: 0 24px 16px;
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .enable-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 14px 20px;
        background: linear-gradient(135deg, #FFD700, #FFA500);
        border: none;
        border-radius: 14px;
        font-size: 15px;
        font-weight: 600;
        color: white;
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 12px rgba(255, 165, 0, 0.3);
    }
    
    .enable-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(255, 165, 0, 0.4);
    }
    
    .enable-btn:active {
        transform: scale(0.98);
    }
    
    .later-btn {
        width: 100%;
        padding: 12px 20px;
        background: transparent;
        border: none;
        font-size: 14px;
        font-weight: 500;
        color: var(--apple-gray-1, #8E8E93);
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .later-btn:hover {
        color: var(--apple-black, #0A0A0A);
    }
    
    .settings-hint {
        padding: 0 24px 20px;
        font-size: 12px;
        color: var(--apple-gray-2, #AEAEB2);
        text-align: center;
        margin: 0;
    }
    
    @media (max-width: 480px) {
        .intro-modal {
            max-width: 100%;
            margin: 0 16px;
        }
    }
</style>
