<script>
    import { seasonalPrefs, activeHoliday, holidays, intensityLevels, getDaysUntilNextHoliday } from '$lib/stores/seasonalTheme.js';
    import { IconSparkles, IconVolume, IconVolumeOff, IconEye, IconEyeOff, IconCalendar } from '@tabler/icons-svelte';
    
    let nextHoliday = getDaysUntilNextHoliday();
    
    const intensityOptions = [
        { value: 'minimal', label: 'Minimal', description: 'Subtle effects only' },
        { value: 'standard', label: 'Standard', description: 'Balanced decorations' },
        { value: 'full', label: 'Full', description: 'All effects enabled' }
    ];
</script>

<div class="seasonal-settings">
    <div class="settings-header">
        <div class="header-icon">
            <IconSparkles size={24} stroke={1.5} />
        </div>
        <div class="header-text">
            <h3>Seasonal Themes</h3>
            <p>Holiday decorations & effects</p>
        </div>
    </div>
    
    <!-- Current Status -->
    <div class="status-card">
        {#if $activeHoliday}
            <div class="status-active">
                <span class="status-emoji">{$activeHoliday.emoji}</span>
                <div class="status-info">
                    <span class="status-label">Active Theme</span>
                    <span class="status-name">{$activeHoliday.name}</span>
                </div>
            </div>
        {:else}
            <div class="status-inactive">
                <IconCalendar size={20} stroke={1.5} />
                <div class="status-info">
                    <span class="status-label">Next Holiday</span>
                    <span class="status-name">
                        {nextHoliday.holiday?.name} in {nextHoliday.days} days
                    </span>
                </div>
            </div>
        {/if}
    </div>
    
    <!-- Main Toggle -->
    <div class="setting-row">
        <div class="setting-info">
            {#if $seasonalPrefs.enabled}
                <IconEye size={20} stroke={1.5} />
            {:else}
                <IconEyeOff size={20} stroke={1.5} />
            {/if}
            <div>
                <span class="setting-label">Enable Seasonal Themes</span>
                <span class="setting-desc">Show holiday decorations</span>
            </div>
        </div>
        <button 
            class="toggle-btn"
            class:active={$seasonalPrefs.enabled}
            on:click={() => seasonalPrefs.toggle()}
            aria-label="Toggle seasonal themes"
        >
            <span class="toggle-knob"></span>
        </button>
    </div>
    
    {#if $seasonalPrefs.enabled}
        <!-- Intensity Selector -->
        <div class="setting-section">
            <span class="section-label">Decoration Intensity</span>
            <div class="intensity-options">
                {#each intensityOptions as option}
                    <button
                        class="intensity-btn"
                        class:selected={$seasonalPrefs.intensity === option.value}
                        on:click={() => seasonalPrefs.setIntensity(option.value)}
                    >
                        <span class="intensity-label">{option.label}</span>
                        <span class="intensity-desc">{option.description}</span>
                    </button>
                {/each}
            </div>
        </div>
        
        <!-- Sound Toggle -->
        <div class="setting-row">
            <div class="setting-info">
                {#if $seasonalPrefs.soundEnabled}
                    <IconVolume size={20} stroke={1.5} />
                {:else}
                    <IconVolumeOff size={20} stroke={1.5} />
                {/if}
                <div>
                    <span class="setting-label">Festive Sounds</span>
                    <span class="setting-desc">Holiday notification tones</span>
                </div>
            </div>
            <button 
                class="toggle-btn"
                class:active={$seasonalPrefs.soundEnabled}
                on:click={() => seasonalPrefs.toggleSound()}
                aria-label="Toggle festive sounds"
            >
                <span class="toggle-knob"></span>
            </button>
        </div>
        
        <!-- Preview Themes -->
        <div class="setting-section">
            <span class="section-label">Preview Theme</span>
            <div class="preview-grid">
                {#each Object.values(holidays) as holiday}
                    <button
                        class="preview-btn"
                        class:active={$seasonalPrefs.manualOverride === holiday.id}
                        style="--preview-color: {holiday.colors.primary}"
                        on:click={() => {
                            if ($seasonalPrefs.manualOverride === holiday.id) {
                                seasonalPrefs.clearOverride();
                            } else {
                                seasonalPrefs.setManualOverride(holiday.id);
                            }
                        }}
                    >
                        <span class="preview-emoji">{holiday.emoji}</span>
                        <span class="preview-name">{holiday.name}</span>
                    </button>
                {/each}
            </div>
            {#if $seasonalPrefs.manualOverride}
                <button class="reset-btn" on:click={() => seasonalPrefs.clearOverride()}>
                    Reset to Auto
                </button>
            {/if}
        </div>
    {/if}
    
</div>

<style>
    .seasonal-settings {
        background: var(--theme-card-bg, white);
        border-radius: var(--apple-radius-xl, 22px);
        padding: 24px;
        box-shadow: var(--apple-shadow-md);
    }
    
    .settings-header {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 20px;
    }
    
    .header-icon {
        width: 44px;
        height: 44px;
        border-radius: 12px;
        background: linear-gradient(135deg, #FF9500, #FF2D55);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }
    
    .header-text h3 {
        font-size: 17px;
        font-weight: 600;
        color: var(--theme-text, #0A0A0A);
        margin: 0;
    }
    
    .header-text p {
        font-size: 13px;
        color: var(--theme-text-secondary, #8E8E93);
        margin: 2px 0 0;
    }
    
    /* Status Card */
    .status-card {
        background: var(--theme-border-light, #F2F2F7);
        border-radius: var(--apple-radius-md, 12px);
        padding: 14px 16px;
        margin-bottom: 20px;
    }
    
    .status-active, .status-inactive {
        display: flex;
        align-items: center;
        gap: 12px;
    }
    
    .status-emoji {
        font-size: 28px;
    }
    
    .status-info {
        display: flex;
        flex-direction: column;
    }
    
    .status-label {
        font-size: 11px;
        font-weight: 500;
        color: var(--theme-text-secondary, #8E8E93);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }
    
    .status-name {
        font-size: 15px;
        font-weight: 600;
        color: var(--theme-text, #0A0A0A);
    }
    
    /* Setting Row */
    .setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 0;
        border-bottom: 1px solid var(--theme-border-light, #E5E5EA);
    }
    
    .setting-row:last-child {
        border-bottom: none;
    }
    
    .setting-info {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--theme-text-secondary, #8E8E93);
    }
    
    .setting-info > div {
        display: flex;
        flex-direction: column;
    }
    
    .setting-label {
        font-size: 15px;
        font-weight: 500;
        color: var(--theme-text, #0A0A0A);
    }
    
    .setting-desc {
        font-size: 12px;
        color: var(--theme-text-secondary, #8E8E93);
    }
    
    /* Toggle Button */
    .toggle-btn {
        width: 51px;
        height: 31px;
        border-radius: 16px;
        background: var(--theme-border, #D1D1D6);
        border: none;
        cursor: pointer;
        position: relative;
        transition: background 0.2s ease;
    }
    
    .toggle-btn.active {
        background: var(--apple-green, #34C759);
    }
    
    .toggle-knob {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 27px;
        height: 27px;
        border-radius: 50%;
        background: white;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        transition: transform 0.2s ease;
    }
    
    .toggle-btn.active .toggle-knob {
        transform: translateX(20px);
    }
    
    /* Setting Section */
    .setting-section {
        padding: 16px 0;
        border-bottom: 1px solid var(--theme-border-light, #E5E5EA);
    }
    
    .section-label {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: var(--theme-text-secondary, #8E8E93);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 12px;
    }
    
    /* Intensity Options */
    .intensity-options {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }
    
    .intensity-btn {
        padding: 12px 8px;
        border-radius: var(--apple-radius-md, 12px);
        border: 2px solid var(--theme-border-light, #E5E5EA);
        background: transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: center;
    }
    
    .intensity-btn:hover {
        border-color: var(--theme-border, #D1D1D6);
    }
    
    .intensity-btn.selected {
        border-color: var(--apple-accent, #007AFF);
        background: rgba(0, 122, 255, 0.08);
    }
    
    .intensity-label {
        display: block;
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text, #0A0A0A);
    }
    
    .intensity-desc {
        display: block;
        font-size: 10px;
        color: var(--theme-text-secondary, #8E8E93);
        margin-top: 2px;
    }
    
    /* Preview Grid */
    .preview-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
    }
    
    .preview-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        padding: 12px 8px;
        border-radius: var(--apple-radius-md, 12px);
        border: 2px solid var(--theme-border-light, #E5E5EA);
        background: transparent;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .preview-btn:hover {
        border-color: var(--preview-color);
        background: color-mix(in srgb, var(--preview-color) 10%, transparent);
    }
    
    .preview-btn.active {
        border-color: var(--preview-color);
        background: color-mix(in srgb, var(--preview-color) 15%, transparent);
    }
    
    .preview-emoji {
        font-size: 24px;
    }
    
    .preview-name {
        font-size: 10px;
        font-weight: 500;
        color: var(--theme-text-secondary, #8E8E93);
        text-align: center;
    }
    
    .reset-btn {
        width: 100%;
        margin-top: 12px;
        padding: 10px;
        border-radius: var(--apple-radius-md, 12px);
        border: none;
        background: var(--theme-border-light, #F2F2F7);
        color: var(--apple-accent, #007AFF);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s ease;
    }
    
    .reset-btn:hover {
        background: var(--theme-border, #E5E5EA);
    }
    
    /* Responsive */
    @media (max-width: 480px) {
        .seasonal-settings {
            padding: 16px;
        }
        
        .intensity-options,
        .preview-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }
</style>
