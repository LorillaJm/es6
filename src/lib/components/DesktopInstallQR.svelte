<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { fade, scale } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { IconX, IconQrcode, IconDeviceMobile } from '@tabler/icons-svelte';
    import { detectDevice, appConfig, generateQRCodeDataUrl, getDownloadUrl } from '$lib/stores/appInstall.js';

    export let show = false;
    
    let device = { isMobile: false, isIOS: false, isAndroid: false };
    let qrCodeUrl = '';
    let downloadUrl = '';

    onMount(() => {
        if (!browser) return;
        device = detectDevice();
        
        // Generate QR code for mobile download
        downloadUrl = getDownloadUrl() || window.location.origin;
        qrCodeUrl = generateQRCodeDataUrl(downloadUrl, appConfig.qrCode?.size || 180);
    });

    function close() {
        show = false;
    }

    function handleKeydown(e) {
        if (e.key === 'Escape') close();
    }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show && !device.isMobile}
    <!-- Backdrop -->
    <div 
        class="qr-backdrop"
        on:click={close}
        on:keydown={(e) => e.key === 'Enter' && close()}
        role="button"
        tabindex="-1"
        aria-label="Close QR code modal"
        transition:fade={{ duration: 200 }}
    ></div>

    <!-- Modal -->
    <div 
        class="qr-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-modal-title"
        transition:scale={{ duration: 300, easing: cubicOut, start: 0.9 }}
    >
        <!-- Close Button -->
        <button class="close-btn" on:click={close} aria-label="Close">
            <IconX size={20} stroke={1.5} />
        </button>

        <!-- Header -->
        <div class="modal-header">
            <div class="icon-wrapper">
                <IconDeviceMobile size={28} stroke={1.5} />
            </div>
            <h3 id="qr-modal-title" class="modal-title">Get the Mobile App</h3>
            <p class="modal-subtitle">Scan this QR code with your phone to download</p>
        </div>

        <!-- QR Code -->
        <div class="qr-container">
            <div class="qr-frame">
                {#if qrCodeUrl}
                    <img src={qrCodeUrl} alt="QR Code to download app" class="qr-image" />
                {:else}
                    <div class="qr-placeholder">
                        <IconQrcode size={80} stroke={1} />
                    </div>
                {/if}
            </div>
            <p class="qr-hint">Point your camera at the code</p>
        </div>

        <!-- App Info -->
        <div class="app-info">
            <img src={appConfig.icon} alt="{appConfig.name}" class="app-icon" />
            <div class="app-details">
                <span class="app-name">{appConfig.name}</span>
                <span class="app-tagline">Faster • Offline • Notifications</span>
            </div>
        </div>

        <!-- Store Badges -->
        <div class="store-badges">
            {#if appConfig.playStoreUrl}
                <a href={appConfig.playStoreUrl} target="_blank" rel="noopener noreferrer" class="store-badge">
                    <svg viewBox="0 0 135 40" class="badge-svg">
                        <rect width="135" height="40" rx="5" fill="#000"/>
                        <text x="47" y="14" fill="#fff" font-size="7" font-family="Inter, sans-serif">GET IT ON</text>
                        <text x="47" y="28" fill="#fff" font-size="13" font-weight="600" font-family="Inter, sans-serif">Google Play</text>
                        <path d="M15 8l12 12-12 12V8z" fill="#34A853"/>
                        <path d="M15 8l8 8-8 8V8z" fill="#FBBC04"/>
                        <path d="M15 16l8 8H15v-8z" fill="#EA4335"/>
                        <path d="M23 16l4 4-4 4v-8z" fill="#4285F4"/>
                    </svg>
                </a>
            {/if}
            {#if appConfig.appStoreUrl}
                <a href={appConfig.appStoreUrl} target="_blank" rel="noopener noreferrer" class="store-badge">
                    <svg viewBox="0 0 135 40" class="badge-svg">
                        <rect width="135" height="40" rx="5" fill="#000"/>
                        <text x="45" y="14" fill="#fff" font-size="7" font-family="Inter, sans-serif">Download on the</text>
                        <text x="45" y="28" fill="#fff" font-size="13" font-weight="600" font-family="Inter, sans-serif">App Store</text>
                        <path d="M22 8c-1.5 0-2.8.6-3.8 1.6-.9 1-1.4 2.3-1.2 3.7 1.3.1 2.7-.5 3.6-1.4.9-1 1.5-2.3 1.4-3.9zm3.5 19.5c-.8 1.5-1.7 2.9-3.1 2.9-1.3 0-1.8-.8-3.3-.8-1.5 0-2 .8-3.3.8-1.4 0-2.4-1.5-3.2-3-1.7-2.9-3-8.2-1.2-11.8.9-1.8 2.4-2.9 4.1-2.9 1.4 0 2.2.8 3.3.8 1.1 0 1.7-.8 3.3-.8 1.5 0 2.8.8 3.6 2.1-3.2 1.8-2.7 6.4.5 7.6-.6 1.6-1.4 3.2-2.2 4.6-.5.5-1 1-1.5 1.5z" fill="#fff"/>
                    </svg>
                </a>
            {/if}
        </div>
    </div>
{/if}

<style>
    .qr-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        z-index: 9998;
    }

    .qr-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: var(--theme-card-bg, #fff);
        border-radius: 22px;
        padding: 32px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.2);
        z-index: 9999;
        width: 90%;
        max-width: 380px;
        text-align: center;
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

    .modal-header {
        margin-bottom: 24px;
    }

    .icon-wrapper {
        width: 56px;
        height: 56px;
        border-radius: 16px;
        background: linear-gradient(135deg, var(--apple-accent, #007aff), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        color: white;
    }

    .modal-title {
        font-size: 22px;
        font-weight: 700;
        color: var(--theme-text, #000);
        margin: 0 0 8px 0;
    }

    .modal-subtitle {
        font-size: 14px;
        color: var(--theme-text-secondary, #8e8e93);
        margin: 0;
    }

    .qr-container {
        margin-bottom: 24px;
    }

    .qr-frame {
        width: 200px;
        height: 200px;
        margin: 0 auto 12px;
        padding: 12px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .qr-image {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    .qr-placeholder {
        color: var(--theme-border, #d1d1d6);
    }

    .qr-hint {
        font-size: 12px;
        color: var(--theme-text-secondary, #8e8e93);
        margin: 0;
    }

    .app-info {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        padding: 16px;
        background: var(--theme-border-light, #f2f2f7);
        border-radius: 14px;
        margin-bottom: 20px;
    }

    .app-icon {
        width: 44px;
        height: 44px;
        border-radius: 10px;
        object-fit: cover;
    }

    .app-details {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: 2px;
    }

    .app-name {
        font-size: 15px;
        font-weight: 600;
        color: var(--theme-text, #000);
    }

    .app-tagline {
        font-size: 12px;
        color: var(--theme-text-secondary, #8e8e93);
    }

    .store-badges {
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
    }

    .store-badge {
        display: block;
        transition: var(--apple-transition);
    }

    .store-badge:hover {
        transform: scale(1.05);
    }

    .badge-svg {
        height: 40px;
        width: auto;
    }

    /* Dark mode */
    :global([data-theme="dark"]) .qr-modal,
    :global([data-theme="oled"]) .qr-modal,
    :global([data-theme="amethyst"]) .qr-modal {
        background: var(--theme-card-bg, #1c1c1e);
    }

    :global([data-theme="dark"]) .qr-frame,
    :global([data-theme="oled"]) .qr-frame,
    :global([data-theme="amethyst"]) .qr-frame {
        background: white;
    }
</style>
