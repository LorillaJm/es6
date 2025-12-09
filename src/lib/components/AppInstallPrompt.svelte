<script>
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { fade, fly } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { IconX, IconDownload, IconBrandGooglePlay, IconBrandApple, IconDeviceMobile, IconExternalLink } from '@tabler/icons-svelte';
    import { appInstallPrefs, detectDevice, showInstallPrompt, appConfig } from '$lib/stores/appInstall.js';

    let visible = false;
    let device = { isMobile: false, isIOS: false, isAndroid: false, isPWA: false, isStandalone: false };
    let deferredPrompt = null;
    let showOptions = false;
    let idleTimer = null;

    // PWA install prompt event
    function handleBeforeInstallPrompt(e) {
        e.preventDefault();
        deferredPrompt = e;
    }

    onMount(() => {
        if (!browser) return;

        device = detectDevice();
        
        // Track page visit
        appInstallPrefs.trackVisit();

        // Listen for PWA install prompt
        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        // Listen for app installed event
        window.addEventListener('appinstalled', () => {
            appInstallPrefs.markInstalled();
            visible = false;
        });

        // Show prompt after idle time (3 seconds of no interaction)
        const showAfterIdle = () => {
            if ($showInstallPrompt && !visible) {
                idleTimer = setTimeout(() => {
                    visible = true;
                }, 3000);
            }
        };

        // Reset idle timer on interaction
        const resetIdleTimer = () => {
            if (idleTimer) clearTimeout(idleTimer);
            showAfterIdle();
        };

        // Start idle detection
        showAfterIdle();
        
        document.addEventListener('touchstart', resetIdleTimer, { passive: true });
        document.addEventListener('scroll', resetIdleTimer, { passive: true });

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
            document.removeEventListener('touchstart', resetIdleTimer);
            document.removeEventListener('scroll', resetIdleTimer);
            if (idleTimer) clearTimeout(idleTimer);
        };
    });

    // Handle native PWA install
    async function handlePWAInstall() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                appInstallPrefs.markInstalled();
            }
            deferredPrompt = null;
        }
        visible = false;
    }

    // Handle Play Store redirect
    function handlePlayStore() {
        if (appConfig.playStoreUrl) {
            window.open(appConfig.playStoreUrl, '_blank');
        }
        appInstallPrefs.dismissTemporarily();
        visible = false;
    }

    // Handle App Store redirect
    function handleAppStore() {
        if (appConfig.appStoreUrl) {
            window.open(appConfig.appStoreUrl, '_blank');
        }
        appInstallPrefs.dismissTemporarily();
        visible = false;
    }

    // Handle APK download
    function handleAPKDownload() {
        if (appConfig.apkUrl) {
            window.open(appConfig.apkUrl, '_blank');
        }
        appInstallPrefs.dismissTemporarily();
        visible = false;
    }

    // Handle "Maybe Later"
    function handleLater() {
        appInstallPrefs.dismissTemporarily();
        visible = false;
    }

    // Handle "Never show again"
    function handleNever() {
        appInstallPrefs.dismissPermanently();
        visible = false;
    }

    // Close prompt
    function closePrompt() {
        appInstallPrefs.dismissTemporarily();
        visible = false;
    }
</script>

{#if visible && $showInstallPrompt}
    <!-- Backdrop -->
    <div 
        class="prompt-backdrop"
        on:click={closePrompt}
        on:keydown={(e) => e.key === 'Escape' && closePrompt()}
        role="button"
        tabindex="-1"
        aria-label="Close install prompt"
        transition:fade={{ duration: 200 }}
    ></div>

    <!-- Prompt Card -->
    <div 
        class="prompt-container"
        transition:fly={{ y: 100, duration: 400, easing: cubicOut }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-prompt-title"
    >
        <!-- Close Button -->
        <button class="close-btn" on:click={closePrompt} aria-label="Close">
            <IconX size={20} stroke={1.5} />
        </button>

        <!-- App Info -->
        <div class="app-info">
            <img src={appConfig.icon} alt="{appConfig.name} icon" class="app-icon" />
            <div class="app-details">
                <h3 id="install-prompt-title" class="app-name">{appConfig.name}</h3>
                <p class="app-description">{appConfig.description}</p>
            </div>
        </div>

        <!-- Benefits -->
        <div class="benefits">
            <div class="benefit">
                <span class="benefit-icon">⚡</span>
                <span>Faster performance</span>
            </div>
            <div class="benefit">
                <span class="benefit-icon">📴</span>
                <span>Offline access</span>
            </div>
            <div class="benefit">
                <span class="benefit-icon">🔔</span>
                <span>Push notifications</span>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="actions">
            {#if !showOptions}
                <!-- Primary Install Button -->
                <button class="btn-primary" on:click={() => showOptions = true}>
                    <IconDownload size={20} stroke={2} />
                    <span>Install App</span>
                    <span class="recommended-badge">Recommended</span>
                </button>
            {:else}
                <!-- Install Options -->
                <div class="install-options" transition:fade={{ duration: 150 }}>
                    {#if device.isAndroid}
                        <!-- Android Options -->
                        {#if deferredPrompt}
                            <button class="btn-option btn-pwa" on:click={handlePWAInstall}>
                                <IconDeviceMobile size={20} stroke={1.5} />
                                <span>Add to Home Screen</span>
                            </button>
                        {/if}
                        
                        {#if appConfig.playStoreUrl}
                            <button class="btn-option btn-store" on:click={handlePlayStore}>
                                <IconBrandGooglePlay size={20} stroke={1.5} />
                                <span>Get on Google Play</span>
                                <IconExternalLink size={14} stroke={1.5} />
                            </button>
                        {/if}

                        {#if appConfig.apkUrl}
                            <button class="btn-option btn-apk" on:click={handleAPKDownload}>
                                <IconDownload size={20} stroke={1.5} />
                                <div class="apk-info">
                                    <span>Download APK</span>
                                    {#if appConfig.apkSize}
                                        <span class="apk-size">{appConfig.apkSize}</span>
                                    {/if}
                                </div>
                            </button>
                            <p class="apk-disclaimer">
                                This app is signed and safe. Only install if you trust this source.
                            </p>
                        {/if}

                        {#if !deferredPrompt && !appConfig.playStoreUrl && !appConfig.apkUrl}
                            <p class="no-options">PWA installation available via browser menu.</p>
                        {/if}

                    {:else if device.isIOS}
                        <!-- iOS Options -->
                        {#if appConfig.appStoreUrl}
                            <button class="btn-option btn-store" on:click={handleAppStore}>
                                <IconBrandApple size={20} stroke={1.5} />
                                <span>Get on App Store</span>
                                <IconExternalLink size={14} stroke={1.5} />
                            </button>
                        {/if}

                        <div class="ios-pwa-guide">
                            <p class="guide-title">Add to Home Screen:</p>
                            <ol class="guide-steps">
                                <li>Tap the <strong>Share</strong> button <span class="ios-share-icon">⬆</span></li>
                                <li>Scroll and tap <strong>"Add to Home Screen"</strong></li>
                                <li>Tap <strong>"Add"</strong> to confirm</li>
                            </ol>
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Secondary Actions -->
            <div class="secondary-actions">
                <button class="btn-secondary" on:click={handleLater}>
                    Maybe Later
                </button>
                <button class="btn-text" on:click={handleNever}>
                    Don't show again
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .prompt-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 9998;
    }

    .prompt-container {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--theme-card-bg, #fff);
        border-radius: 22px 22px 0 0;
        padding: 24px;
        padding-bottom: calc(24px + env(safe-area-inset-bottom));
        box-shadow: 0 -12px 40px rgba(0, 0, 0, 0.15);
        z-index: 9999;
        max-height: 85vh;
        overflow-y: auto;
    }

    .close-btn {
        position: absolute;
        top: 16px;
        right: 16px;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: var(--theme-border-light, #f2f2f7);
        border: none;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--theme-text-secondary, #8e8e93);
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .close-btn:hover {
        background: var(--theme-border, #e5e5ea);
        color: var(--theme-text, #000);
    }

    .app-info {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 20px;
    }

    .app-icon {
        width: 64px;
        height: 64px;
        border-radius: 14px;
        object-fit: cover;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    }

    .app-details {
        flex: 1;
    }

    .app-name {
        font-size: 20px;
        font-weight: 700;
        color: var(--theme-text, #000);
        margin: 0 0 4px 0;
    }

    .app-description {
        font-size: 14px;
        color: var(--theme-text-secondary, #8e8e93);
        margin: 0;
        line-height: 1.4;
    }

    .benefits {
        display: flex;
        gap: 12px;
        margin-bottom: 24px;
        flex-wrap: wrap;
    }

    .benefit {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 12px;
        background: var(--theme-border-light, #f2f2f7);
        border-radius: 20px;
        font-size: 12px;
        font-weight: 500;
        color: var(--theme-text, #000);
    }

    .benefit-icon {
        font-size: 14px;
    }

    .actions {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .btn-primary {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        padding: 16px 24px;
        background: var(--apple-accent, #007aff);
        color: white;
        border: none;
        border-radius: 14px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .btn-primary:hover {
        background: var(--apple-accent-hover, #0056cc);
        transform: scale(1.02);
    }

    .btn-primary:active {
        transform: scale(0.98);
    }

    .recommended-badge {
        background: rgba(255, 255, 255, 0.2);
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 500;
    }

    .install-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .btn-option {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 14px 18px;
        background: var(--theme-border-light, #f2f2f7);
        color: var(--theme-text, #000);
        border: 1px solid var(--theme-border, #e5e5ea);
        border-radius: 12px;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--apple-transition);
        text-align: left;
    }

    .btn-option:hover {
        background: var(--theme-border, #e5e5ea);
        border-color: var(--theme-border, #d1d1d6);
    }

    .btn-pwa {
        background: var(--apple-accent, #007aff);
        color: white;
        border-color: var(--apple-accent, #007aff);
    }

    .btn-pwa:hover {
        background: var(--apple-accent-hover, #0056cc);
        border-color: var(--apple-accent-hover, #0056cc);
    }

    .btn-store {
        background: var(--theme-card-bg, #fff);
    }

    .btn-apk {
        background: var(--theme-card-bg, #fff);
    }

    .apk-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .apk-size {
        font-size: 12px;
        color: var(--theme-text-secondary, #8e8e93);
    }

    .apk-disclaimer {
        font-size: 11px;
        color: var(--theme-text-secondary, #8e8e93);
        text-align: center;
        margin: 4px 0 0 0;
        padding: 0 8px;
    }

    .no-options {
        font-size: 13px;
        color: var(--theme-text-secondary, #8e8e93);
        text-align: center;
        padding: 12px;
    }

    .ios-pwa-guide {
        background: var(--theme-border-light, #f2f2f7);
        border-radius: 12px;
        padding: 16px;
    }

    .guide-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text, #000);
        margin: 0 0 12px 0;
    }

    .guide-steps {
        margin: 0;
        padding-left: 20px;
        font-size: 13px;
        color: var(--theme-text-secondary, #8e8e93);
        line-height: 1.8;
    }

    .guide-steps li {
        margin-bottom: 4px;
    }

    .guide-steps strong {
        color: var(--theme-text, #000);
    }

    .ios-share-icon {
        display: inline-block;
        background: var(--apple-accent, #007aff);
        color: white;
        width: 18px;
        height: 18px;
        border-radius: 4px;
        font-size: 12px;
        line-height: 18px;
        text-align: center;
        vertical-align: middle;
    }

    .secondary-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-top: 8px;
    }

    .btn-secondary {
        padding: 12px 24px;
        background: transparent;
        color: var(--apple-accent, #007aff);
        border: none;
        border-radius: 10px;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .btn-secondary:hover {
        background: rgba(0, 122, 255, 0.1);
    }

    .btn-text {
        padding: 12px 16px;
        background: transparent;
        color: var(--theme-text-secondary, #8e8e93);
        border: none;
        font-size: 13px;
        font-weight: 400;
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .btn-text:hover {
        color: var(--theme-text, #000);
    }

    /* Reduced motion */
    @media (prefers-reduced-motion: reduce) {
        .prompt-container {
            transition: none;
        }
    }

    /* Dark mode adjustments */
    :global([data-theme="dark"]) .prompt-container,
    :global([data-theme="oled"]) .prompt-container,
    :global([data-theme="amethyst"]) .prompt-container {
        background: var(--theme-card-bg, #1c1c1e);
    }
</style>
