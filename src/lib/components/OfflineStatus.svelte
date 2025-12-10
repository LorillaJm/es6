<script>
    import { onMount, onDestroy } from 'svelte';
    import { browser } from '$app/environment';
    import { getPendingCount, syncPendingActions } from '$lib/offline/offlineQueue.js';

    // Props
    export let showPendingCount = true;
    export let autoHideWhenOnline = false;
    export let position = 'bottom'; // 'top', 'bottom', 'floating'

    // State
    let isOnline = true;
    let pendingCount = 0;
    let isSyncing = false;
    let lastSyncResult = null;
    let showBanner = true;

    // Update online status
    function updateOnlineStatus() {
        if (browser) {
            isOnline = navigator.onLine;
            if (isOnline && autoHideWhenOnline) {
                setTimeout(() => {
                    if (isOnline && pendingCount === 0) {
                        showBanner = false;
                    }
                }, 3000);
            } else {
                showBanner = true;
            }
        }
    }

    // Update pending count
    async function updatePendingCount() {
        if (browser) {
            pendingCount = await getPendingCount();
        }
    }

    // Manual sync trigger
    async function triggerSync() {
        if (!isOnline || isSyncing) return;
        
        isSyncing = true;
        try {
            lastSyncResult = await syncPendingActions();
            await updatePendingCount();
        } catch (error) {
            console.error('Sync failed:', error);
            lastSyncResult = { error: error.message };
        }
        isSyncing = false;

        setTimeout(() => {
            lastSyncResult = null;
        }, 3000);
    }

    function handleSyncComplete(event) {
        lastSyncResult = event.detail;
        updatePendingCount();
        
        setTimeout(() => {
            lastSyncResult = null;
        }, 3000);
    }

    onMount(() => {
        if (browser) {
            updateOnlineStatus();
            updatePendingCount();

            window.addEventListener('online', updateOnlineStatus);
            window.addEventListener('offline', updateOnlineStatus);
            window.addEventListener('offline-sync-complete', handleSyncComplete);

            const interval = setInterval(updatePendingCount, 10000);

            return () => {
                window.removeEventListener('online', updateOnlineStatus);
                window.removeEventListener('offline', updateOnlineStatus);
                window.removeEventListener('offline-sync-complete', handleSyncComplete);
                clearInterval(interval);
            };
        }
    });

    $: shouldShow = showBanner && (!isOnline || pendingCount > 0);
</script>

{#if shouldShow}
    <div 
        class="offline-status {position}" 
        class:offline={!isOnline} 
        class:online={isOnline}
        class:has-pending={pendingCount > 0}
        role="status"
        aria-live="polite"
    >
        <div class="status-content">
            <div class="status-icon">
                {#if !isOnline}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                        <path d="M10.71 5.05A16 16 0 0 1 22.58 9"></path>
                        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                        <line x1="12" y1="20" x2="12.01" y2="20"></line>
                    </svg>
                {:else if isSyncing}
                    <svg class="spinning" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                    </svg>
                {:else}
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                        <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                        <line x1="12" y1="20" x2="12.01" y2="20"></line>
                    </svg>
                {/if}
            </div>

            <div class="status-text">
                {#if !isOnline}
                    <span class="status-title">You're offline</span>
                    <span class="status-subtitle">Changes will sync when connected</span>
                {:else if isSyncing}
                    <span class="status-title">Syncing...</span>
                    <span class="status-subtitle">Uploading pending changes</span>
                {:else if lastSyncResult}
                    {#if lastSyncResult.error}
                        <span class="status-title error">Sync failed</span>
                        <span class="status-subtitle">{lastSyncResult.error}</span>
                    {:else}
                        <span class="status-title success">Synced!</span>
                        <span class="status-subtitle">{lastSyncResult.synced} changes uploaded</span>
                    {/if}
                {:else if pendingCount > 0}
                    <span class="status-title">Back online</span>
                    <span class="status-subtitle">{pendingCount} pending change{pendingCount !== 1 ? 's' : ''}</span>
                {/if}
            </div>

            {#if showPendingCount && pendingCount > 0}
                <div class="status-actions">
                    <span class="pending-badge">{pendingCount}</span>
                    {#if isOnline && !isSyncing}
                        <button class="sync-btn" on:click={triggerSync} title="Sync now">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M21 2v6h-6"></path>
                                <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
                                <path d="M3 22v-6h6"></path>
                                <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
                            </svg>
                        </button>
                    {/if}
                </div>
            {/if}

            {#if isOnline && pendingCount === 0}
                <button class="close-btn" on:click={() => showBanner = false} title="Dismiss">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            {/if}
        </div>
    </div>
{/if}

<style>
    .offline-status {
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0.75rem 1rem;
        font-family: system-ui, -apple-system, sans-serif;
        font-size: 0.875rem;
        transition: all 0.3s ease;
        z-index: 1000;
    }

    .offline-status.top {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
    }

    .offline-status.bottom {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
    }

    .offline-status.floating {
        position: fixed;
        bottom: 1rem;
        left: 50%;
        transform: translateX(-50%);
        border-radius: 50px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        max-width: 400px;
    }

    .offline-status.offline {
        background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
        border-bottom: 2px solid #fca5a5;
        color: #991b1b;
    }

    .offline-status.floating.offline {
        border: 2px solid #fca5a5;
    }

    .offline-status.online.has-pending {
        background: linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);
        border-bottom: 2px solid #fcd34d;
        color: #854d0e;
    }

    .offline-status.floating.online.has-pending {
        border: 2px solid #fcd34d;
    }

    .offline-status.online:not(.has-pending) {
        background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
        border-bottom: 2px solid #6ee7b7;
        color: #065f46;
    }

    .status-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        max-width: 600px;
        width: 100%;
    }

    .status-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .status-icon svg {
        opacity: 0.8;
    }

    .spinning {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }

    .status-text {
        display: flex;
        flex-direction: column;
        flex: 1;
        min-width: 0;
    }

    .status-title {
        font-weight: 600;
        line-height: 1.2;
    }

    .status-title.error {
        color: #dc2626;
    }

    .status-title.success {
        color: #059669;
    }

    .status-subtitle {
        font-size: 0.75rem;
        opacity: 0.8;
        line-height: 1.2;
    }

    .status-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
    }

    .pending-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 1.5rem;
        height: 1.5rem;
        padding: 0 0.4rem;
        background: currentColor;
        color: white;
        border-radius: 50px;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .offline .pending-badge {
        background: #dc2626;
    }

    .online.has-pending .pending-badge {
        background: #d97706;
    }

    .sync-btn,
    .close-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        border: none;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.1);
        color: inherit;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
    }

    .sync-btn:hover,
    .close-btn:hover {
        background: rgba(0, 0, 0, 0.2);
        transform: scale(1.05);
    }

    .sync-btn:active,
    .close-btn:active {
        transform: scale(0.95);
    }

    @media (max-width: 480px) {
        .offline-status {
            padding: 0.625rem 0.875rem;
        }

        .offline-status.floating {
            left: 0.5rem;
            right: 0.5rem;
            transform: none;
            max-width: none;
        }

        .status-subtitle {
            display: none;
        }
    }
</style>
