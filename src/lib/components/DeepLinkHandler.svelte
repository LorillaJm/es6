<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import { fade } from 'svelte/transition';
    import { IconExternalLink, IconDeviceMobile } from '@tabler/icons-svelte';
    import { detectDevice, deepLinking, appConfig } from '$lib/stores/appInstall.js';

    export let enabled = true;
    export let showBanner = true;
    
    let device = { isMobile: false, isIOS: false, isAndroid: false, isStandalone: false };
    let isAppInstalled = false;
    let bannerVisible = false;
    let isRedirecting = false;

    const BANNER_DISMISSED_KEY = 'pcc_deeplink_banner_dismissed';

    onMount(async () => {
        if (!browser || !enabled) return;
        
        device = detectDevice();
        
        // Don't show if already in app
        if (device.isStandalone) return;
        
        // Check if app might be installed
        isAppInstalled = await deepLinking.checkAppInstalled();
        
        // Check if banner was dismissed
        const dismissed = sessionStorage.getItem(BANNER_DISMISSED_KEY);
        if (dismissed) return;
        
        // Show banner on mobile if app might be installed
        if (device.isMobile && showBanner && (appConfig.deepLink.scheme || appConfig.playStoreUrl || appConfig.appStoreUrl)) {
            setTimeout(() => {
                bannerVisible = true;
            }, 1500);
        }
    });

    async function openInApp() {
        if (isRedirecting) return;
        isRedirecting = true;
        
        // Get current path for deep linking
        const currentPath = $page.url.pathname.replace('/app/', '');
        
        try {
            await deepLinking.tryOpenApp(currentPath);
        } catch (e) {
            console.warn('Deep link failed:', e);
        }
        
        isRedirecting = false;
    }

    function dismissBanner() {
        bannerVisible = false;
        sessionStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    }
</script>

{#if bannerVisible && device.isMobile && !device.isStandalone}
    <div class="deeplink-banner" transition:fade={{ duration: 200 }}>
        <div class="banner-content">
            <div class="banner-icon">
                <IconDeviceMobile size={20} stroke={1.5} />
            </div>
            <div class="banner-text">
                <span class="banner-title">Open in App</span>
                <span class="banner-subtitle">Better experience in the app</span>
            </div>
        </div>
        <div class="banner-actions">
            <button class="btn-open" on:click={openInApp} disabled={isRedirecting}>
                {#if isRedirecting}
                    <span class="loading-dot"></span>
                {:else}
                    <span>Open</span>
                    <IconExternalLink size={14} stroke={2} />
                {/if}
            </button>
            <button class="btn-dismiss" on:click={dismissBanner} aria-label="Dismiss">
                ✕
            </button>
        </div>
    </div>
{/if}

<style>
    .deeplink-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: var(--theme-card-bg, #fff);
        border-bottom: 1px solid var(--theme-border-light, #e5e5ea);
        padding: 12px 16px;
        padding-top: calc(12px + env(safe-area-inset-top));
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        z-index: 1000;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
    }

    .banner-content {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        min-width: 0;
    }

    .banner-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: linear-gradient(135deg, var(--apple-accent, #007aff), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        flex-shrink: 0;
    }

    .banner-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
        min-width: 0;
    }

    .banner-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text, #000);
    }

    .banner-subtitle {
        font-size: 12px;
        color: var(--theme-text-secondary, #8e8e93);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .banner-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }

    .btn-open {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: var(--apple-accent, #007aff);
        color: white;
        border: none;
        border-radius: 20px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .btn-open:hover:not(:disabled) {
        background: var(--apple-accent-hover, #0056cc);
    }

    .btn-open:disabled {
        opacity: 0.7;
        cursor: wait;
    }

    .loading-dot {
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255, 255, 255, 0.3);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .btn-dismiss {
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--theme-border-light, #f2f2f7);
        border: none;
        color: var(--theme-text-secondary, #8e8e93);
        font-size: 12px;
        cursor: pointer;
        transition: var(--apple-transition);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .btn-dismiss:hover {
        background: var(--theme-border, #e5e5ea);
        color: var(--theme-text, #000);
    }

    /* Dark mode */
    :global([data-theme="dark"]) .deeplink-banner,
    :global([data-theme="oled"]) .deeplink-banner,
    :global([data-theme="amethyst"]) .deeplink-banner {
        background: var(--theme-card-bg, #1c1c1e);
        border-color: var(--theme-border, #38383a);
    }
</style>
