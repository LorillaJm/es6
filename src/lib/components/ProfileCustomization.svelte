<script>
    import { themeStore, themes, accentColors } from '$lib/stores/theme.js';
    import { db, USER_PROFILE_PATH } from '$lib/firebase';
    import { ref, update } from 'firebase/database';
    import { 
        IconPhoto, IconPalette, IconSun, IconMoon, 
        IconSparkles, IconDeviceDesktop, IconCheck,
        IconCamera, IconUpload
    } from '@tabler/icons-svelte';

    export let user;
    export let userProfile;

    let saving = false;
    let saveSuccess = false;
    let saveError = '';
    let profilePhotoPreview = userProfile?.profilePhoto || user?.photoURL || '';
    let bannerPreview = userProfile?.bannerImage || '';
    
    let currentTheme = 'light';
    let currentAccent = '#007AFF';

    themeStore.subscribe(state => {
        currentTheme = state.mode;
        currentAccent = state.accent;
    });

    const themeOptions = [
        { id: 'light', name: 'Light', icon: IconSun, desc: 'Clean & bright' },
        { id: 'dark', name: 'Dark', icon: IconMoon, desc: 'Easy on the eyes' },
        { id: 'amethyst', name: 'Amethyst', icon: IconSparkles, desc: 'Purple vibes' },
        { id: 'oled', name: 'OLED Black', icon: IconDeviceDesktop, desc: 'Pure black' },
        { id: 'midnight', name: 'Midnight', icon: IconMoon, desc: 'Deep blue' },
        { id: 'forest', name: 'Forest', icon: IconSparkles, desc: 'Nature green' },
        { id: 'sunset', name: 'Sunset', icon: IconSun, desc: 'Warm tones' },
        { id: 'ocean', name: 'Ocean', icon: IconSparkles, desc: 'Cool blue' }
    ];

    function handleThemeChange(themeId) {
        themeStore.setTheme(themeId);
        savePreferences({ theme: themeId });
    }

    function handleAccentChange(color) {
        themeStore.setAccent(color);
        savePreferences({ accentColor: color });
    }

    async function handlePhotoUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        
        if (file.size > 2 * 1024 * 1024) {
            saveError = 'Image must be less than 2MB';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            profilePhotoPreview = e.target.result;
            await savePreferences({ profilePhoto: e.target.result });
        };
        reader.readAsDataURL(file);
    }

    async function handleBannerUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        if (file.size > 3 * 1024 * 1024) {
            saveError = 'Banner must be less than 3MB';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            bannerPreview = e.target.result;
            await savePreferences({ bannerImage: e.target.result });
        };
        reader.readAsDataURL(file);
    }

    async function savePreferences(data) {
        if (!user || saving) return;
        saving = true;
        saveError = '';
        saveSuccess = false;

        try {
            const userRef = ref(db, `${USER_PROFILE_PATH}/${user.uid}`);
            await update(userRef, {
                ...data,
                updatedAt: new Date().toISOString()
            });
            saveSuccess = true;
            setTimeout(() => saveSuccess = false, 2000);
        } catch (e) {
            console.error('Save error:', e);
            saveError = 'Failed to save preferences';
        }
        saving = false;
    }

    function removeBanner() {
        bannerPreview = '';
        savePreferences({ bannerImage: '' });
    }
</script>

<div class="customization-container">
    <!-- Banner Section -->
    <section class="section">
        <div class="section-header">
            <IconPhoto size={20} stroke={1.5} />
            <h3 class="section-title">Profile Banner</h3>
        </div>
        
        <div class="banner-wrapper">
            <div class="banner-preview" style:background-image={bannerPreview ? `url(${bannerPreview})` : 'none'}>
                {#if !bannerPreview}
                    <div class="banner-placeholder">
                        <IconUpload size={24} stroke={1.5} />
                        <span>Upload a banner image</span>
                    </div>
                {/if}
                
                <label class="banner-upload-btn">
                    <IconCamera size={18} stroke={1.5} />
                    <span>Change</span>
                    <input type="file" accept="image/*" on:change={handleBannerUpload} hidden />
                </label>
            </div>
            
            {#if bannerPreview}
                <button class="remove-banner-btn" on:click={removeBanner}>Remove Banner</button>
            {/if}
        </div>
    </section>

    <!-- Profile Photo Section -->
    <section class="section">
        <div class="section-header">
            <IconCamera size={20} stroke={1.5} />
            <h3 class="section-title">Profile Photo</h3>
        </div>
        
        <div class="photo-wrapper">
            <div class="photo-preview">
                {#if profilePhotoPreview}
                    <img src={profilePhotoPreview} alt="Profile" class="photo-img" />
                {:else}
                    <div class="photo-placeholder">
                        {userProfile?.name?.charAt(0) || 'U'}
                    </div>
                {/if}
                
                <label class="photo-upload-btn">
                    <IconCamera size={16} stroke={2} />
                    <input type="file" accept="image/*" on:change={handlePhotoUpload} hidden />
                </label>
            </div>
            <p class="photo-hint">Click the camera icon to change your photo</p>
        </div>
    </section>

    <!-- Theme Section -->
    <section class="section">
        <div class="section-header">
            <IconPalette size={20} stroke={1.5} />
            <h3 class="section-title">Theme Mode</h3>
        </div>
        
        <div class="theme-grid">
            {#each themeOptions as theme}
                <button 
                    class="theme-option"
                    class:theme-active={currentTheme === theme.id}
                    on:click={() => handleThemeChange(theme.id)}
                >
                    <div class="theme-preview theme-preview-{theme.id}">
                        <svelte:component this={theme.icon} size={20} stroke={1.5} />
                    </div>
                    <span class="theme-name">{theme.name}</span>
                    <span class="theme-desc">{theme.desc}</span>
                    {#if currentTheme === theme.id}
                        <div class="theme-check">
                            <IconCheck size={14} stroke={2.5} />
                        </div>
                    {/if}
                </button>
            {/each}
        </div>
    </section>

    <!-- Accent Color Section -->
    <section class="section">
        <div class="section-header">
            <IconSparkles size={20} stroke={1.5} />
            <h3 class="section-title">Accent Color</h3>
        </div>
        
        <div class="accent-grid">
            {#each accentColors as color}
                <button 
                    class="accent-option"
                    class:accent-active={currentAccent === color.value}
                    style:--accent-color={color.value}
                    on:click={() => handleAccentChange(color.value)}
                    title={color.name}
                >
                    {#if currentAccent === color.value}
                        <IconCheck size={16} stroke={2.5} />
                    {/if}
                </button>
            {/each}
        </div>
    </section>

    <!-- Status Messages -->
    {#if saveSuccess}
        <div class="status-msg status-success">
            <IconCheck size={16} stroke={2} />
            <span>Saved!</span>
        </div>
    {/if}

    {#if saveError}
        <div class="status-msg status-error">
            <span>{saveError}</span>
        </div>
    {/if}
</div>

<style>
    .customization-container {
        display: flex;
        flex-direction: column;
        gap: 28px;
    }

    .section {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .section-header {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--theme-text, var(--apple-black));
    }

    .section-title {
        font-size: 16px;
        font-weight: 600;
        margin: 0;
    }

    /* Banner Styles */
    .banner-wrapper {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .banner-preview {
        position: relative;
        width: 100%;
        height: 140px;
        border-radius: var(--apple-radius-lg);
        background: linear-gradient(135deg, var(--apple-accent) 0%, #5856D6 100%);
        background-size: cover;
        background-position: center;
        overflow: hidden;
    }

    .banner-placeholder {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        gap: 8px;
        color: rgba(255, 255, 255, 0.8);
        font-size: 14px;
    }

    .banner-upload-btn {
        position: absolute;
        bottom: 12px;
        right: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 14px;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(10px);
        border-radius: var(--apple-radius-md);
        color: white;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .banner-upload-btn:hover {
        background: rgba(0, 0, 0, 0.7);
    }

    .remove-banner-btn {
        align-self: flex-start;
        padding: 8px 16px;
        background: transparent;
        border: 1px solid var(--theme-border, var(--apple-gray-4));
        border-radius: var(--apple-radius-md);
        color: var(--apple-red);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .remove-banner-btn:hover {
        background: rgba(255, 59, 48, 0.1);
    }

    /* Photo Styles */
    .photo-wrapper {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
    }

    .photo-preview {
        position: relative;
        width: 100px;
        height: 100px;
    }

    .photo-img {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        object-fit: cover;
        border: 3px solid var(--theme-card-bg, var(--apple-white));
        box-shadow: var(--apple-shadow-md);
    }

    .photo-placeholder {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--apple-accent), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 36px;
        font-weight: 600;
    }

    .photo-upload-btn {
        position: absolute;
        bottom: 0;
        right: 0;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--apple-accent);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        cursor: pointer;
        transition: var(--apple-transition);
        box-shadow: var(--apple-shadow-sm);
    }

    .photo-upload-btn:hover {
        transform: scale(1.1);
    }

    .photo-hint {
        font-size: 13px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
    }

    /* Theme Grid */
    .theme-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
    }

    @media (min-width: 600px) {
        .theme-grid {
            grid-template-columns: repeat(4, 1fr);
        }
    }

    @media (max-width: 480px) {
        .theme-grid {
            grid-template-columns: repeat(2, 1fr);
        }
    }

    .theme-option {
        position: relative;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 16px;
        background: var(--theme-card-bg, var(--apple-white));
        border: 2px solid var(--theme-border-light, var(--apple-gray-5));
        border-radius: var(--apple-radius-lg);
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .theme-option:hover {
        border-color: var(--theme-border, var(--apple-gray-4));
    }

    .theme-active {
        border-color: var(--apple-accent);
        background: rgba(0, 122, 255, 0.05);
    }

    .theme-preview {
        width: 48px;
        height: 48px;
        border-radius: var(--apple-radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .theme-preview-light {
        background: #F5F5F7;
        color: #0A0A0A;
    }

    .theme-preview-dark {
        background: #1C1C1E;
        color: #FFFFFF;
    }

    .theme-preview-amethyst {
        background: #1A1625;
        color: #AF52DE;
    }

    .theme-preview-oled {
        background: #000000;
        color: #FFFFFF;
    }
    
    .theme-preview-midnight {
        background: #0D1B2A;
        color: #778DA9;
    }
    
    .theme-preview-forest {
        background: #1A2F1A;
        color: #81C784;
    }
    
    .theme-preview-sunset {
        background: #2D1B1B;
        color: #FFAB91;
    }
    
    .theme-preview-ocean {
        background: #0A1929;
        color: #5090D3;
    }

    .theme-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
    }

    .theme-desc {
        font-size: 12px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
    }

    .theme-check {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: var(--apple-accent);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    /* Accent Grid */
    .accent-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
    }

    .accent-option {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: var(--accent-color);
        border: 3px solid transparent;
        cursor: pointer;
        transition: var(--apple-transition);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .accent-option:hover {
        transform: scale(1.1);
    }

    .accent-active {
        border-color: var(--theme-text, var(--apple-black));
        box-shadow: 0 0 0 2px var(--theme-card-bg, var(--apple-white));
    }

    /* Status Messages */
    .status-msg {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 12px 16px;
        border-radius: var(--apple-radius-md);
        font-size: 14px;
        font-weight: 500;
    }

    .status-success {
        background: rgba(52, 199, 89, 0.15);
        color: var(--apple-green);
    }

    .status-error {
        background: rgba(255, 59, 48, 0.15);
        color: var(--apple-red);
    }
</style>
