<!-- src/lib/components/NotificationBell.svelte -->
<!-- Professional 3D animated notification bell with real-time data, sound alerts, and responsive design -->
<script>
    import { onMount } from 'svelte';
    import { fly, fade, scale } from 'svelte/transition';
    import { browser } from '$app/environment';
    import { db, ref, onValue, update } from '$lib/firebase';
    import { IconBell, IconCheck, IconChevronRight, IconX } from '@tabler/icons-svelte';
    import { formatDistanceToNow } from 'date-fns';

    export let userId = null;

    let notifications = [];
    let unreadCount = 0;
    let isOpen = false;
    let isLoading = true;
    let hasNewNotification = false;
    let bellElement;
    let panelElement;
    let isFirstLoad = true;
    let previousNotificationIds = new Set();
    let unsubscribe = null;
    let showOverlay = false;

    onMount(() => {
        if (browser && userId) {
            console.log('NotificationBell: Starting listener for user:', userId);
            startListening();
        }

        const handleClickOutside = (event) => {
            if (isOpen && bellElement && !bellElement.contains(event.target)) {
                closePanel();
            }
        };

        const handleEscape = (event) => {
            if (event.key === 'Escape' && isOpen) {
                closePanel();
            }
        };

        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
            if (unsubscribe) unsubscribe();
        };
    });

    function startListening() {
        if (!db || !userId) {
            console.log('NotificationBell: No db or userId');
            isLoading = false;
            return;
        }

        try {
            const notifRef = ref(db, `notifications/${userId}`);
            console.log('NotificationBell: Listening to notifications/' + userId);

            unsubscribe = onValue(notifRef, (snapshot) => {
                const data = snapshot.val();
                console.log('NotificationBell: Received data:', data ? Object.keys(data).length + ' notifications' : 'none');

                if (data) {
                    const newNotifications = Object.entries(data)
                        .map(([id, notif]) => ({ id, ...notif }))
                        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
                        .slice(0, 50);

                    // Check for new notifications after first load
                    if (!isFirstLoad) {
                        const currentIds = new Set(newNotifications.map((n) => n.id));
                        const newIds = [...currentIds].filter((id) => !previousNotificationIds.has(id));

                        if (newIds.length > 0) {
                            const newestNotif = newNotifications.find((n) => newIds.includes(n.id));
                            if (newestNotif && !newestNotif.read) {
                                triggerNewNotification(newestNotif);
                            }
                        }
                    }

                    previousNotificationIds = new Set(newNotifications.map((n) => n.id));
                    notifications = newNotifications;
                    unreadCount = notifications.filter((n) => !n.read).length;
                } else {
                    notifications = [];
                    unreadCount = 0;
                    previousNotificationIds = new Set();
                }

                isFirstLoad = false;
                isLoading = false;
            }, (error) => {
                console.error('NotificationBell: Error listening:', error);
                isLoading = false;
            });
        } catch (error) {
            console.error('NotificationBell: Setup error:', error);
            isLoading = false;
        }
    }

    function triggerNewNotification(notification) {
        hasNewNotification = true;
        playSound(notification?.priority === 'urgent' || notification?.type === 'emergency_alert');
        vibrate(notification?.priority === 'urgent');
        setTimeout(() => (hasNewNotification = false), 1500);
    }

    // Sound file paths - place your MP3 files in static/sounds/
    const NOTIFICATION_SOUNDS = {
        default: '/sounds/notification.mp3',
        urgent: '/sounds/notification-urgent.mp3'
    };

    function playSound(isUrgent = false) {
        if (!browser) return;
        try {
            const soundFile = isUrgent ? NOTIFICATION_SOUNDS.urgent : NOTIFICATION_SOUNDS.default;
            const audio = new Audio(soundFile);
            audio.volume = 0.5; // Adjust volume (0.0 to 1.0)
            audio.play().catch(e => {
                // Fallback to Web Audio API if MP3 fails
                console.warn('MP3 playback failed, using fallback:', e);
                playFallbackSound(isUrgent);
            });
        } catch (e) {
            console.warn('Sound error:', e);
            playFallbackSound(isUrgent);
        }
    }

    // Fallback sound using Web Audio API (in case MP3 files are missing)
    function playFallbackSound(isUrgent = false) {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.frequency.value = isUrgent ? 880 : 800;
            osc.type = 'sine';
            gain.gain.value = 0.25;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {
            console.warn('Fallback sound error:', e);
        }
    }

    function vibrate(isUrgent = false) {
        if (!browser || !navigator.vibrate) return;
        try {
            navigator.vibrate(isUrgent ? [200, 100, 200] : [150]);
        } catch (e) {}
    }

    function togglePanel() {
        if (isOpen) {
            closePanel();
        } else {
            openPanel();
        }
    }

    function openPanel() {
        isOpen = true;
        showOverlay = true;
        if (browser && window.innerWidth <= 640) {
            document.body.style.overflow = 'hidden';
        }
    }

    function closePanel() {
        isOpen = false;
        showOverlay = false;
        document.body.style.overflow = '';
    }

    async function markAsRead(notifId, event) {
        event?.stopPropagation();
        if (!db || !userId) return;
        try {
            await update(ref(db, `notifications/${userId}/${notifId}`), { read: true });
        } catch (e) {
            console.error('Mark read error:', e);
        }
    }

    async function markAllAsRead() {
        if (!db || !userId || !notifications.length) return;
        try {
            const updates = {};
            notifications.forEach((n) => {
                if (!n.read) updates[`notifications/${userId}/${n.id}/read`] = true;
            });
            if (Object.keys(updates).length) await update(ref(db), updates);
        } catch (e) {
            console.error('Mark all read error:', e);
        }
    }

    function getIcon(type) {
        const icons = {
            emergency_alert: '🚨',
            announcement: '📢',
            feedback_reply: '💬',
            qr_regenerated: '🔄',
            schedule: '📅'
        };
        return icons[type] || '🔔';
    }

    function getTimeAgo(dateStr) {
        if (!dateStr) return '';
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
        } catch {
            return '';
        }
    }

    function handleNotifClick(notif) {
        markAsRead(notif.id);
        closePanel();
        
        // Determine navigation based on notification type
        let targetUrl = '/app/announcements'; // default
        
        if (notif.type === 'announcement' || notif.announcementId) {
            targetUrl = '/app/announcements';
        } else if (notif.type === 'schedule' || notif.type === 'attendance') {
            targetUrl = '/app/dashboard';
        } else if (notif.type === 'feedback_reply') {
            targetUrl = '/app/feedback';
        } else if (notif.type === 'qr_regenerated' || notif.type === 'epass') {
            targetUrl = '/app/epass';
        } else if (notif.type === 'emergency_alert') {
            targetUrl = '/app/announcements';
        } else if (notif.link || notif.url) {
            targetUrl = notif.link || notif.url;
        }
        
        // Use goto for SvelteKit navigation (smoother on mobile)
        import('$app/navigation').then(({ goto }) => {
            goto(targetUrl);
        }).catch(() => {
            // Fallback to window.location
            window.location.href = targetUrl;
        });
    }
</script>

<!-- Overlay for mobile -->
{#if showOverlay}
    <div class="overlay" on:click={closePanel} transition:fade={{ duration: 200 }}></div>
{/if}

<div class="bell-container" bind:this={bellElement}>
    <button
        class="bell-btn"
        class:has-unread={unreadCount > 0}
        class:ringing={hasNewNotification}
        on:click|stopPropagation={togglePanel}
        aria-label="Notifications ({unreadCount} unread)"
    >
        <div class="bell-wrapper">
            <IconBell size={22} stroke={1.8} />
        </div>
        {#if unreadCount > 0}
            <span class="badge" in:scale={{ duration: 200 }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
        {/if}
    </button>

    {#if isOpen}
        <div class="panel" class:mobile-panel={browser && window.innerWidth <= 640} bind:this={panelElement} in:fly={{ y: browser && window.innerWidth <= 640 ? 300 : -10, duration: 250 }} out:fly={{ y: browser && window.innerWidth <= 640 ? 300 : 10, duration: 200 }}>
            <!-- Mobile drag handle -->
            <div class="drag-handle"></div>

            <div class="panel-header">
                <h3>Notifications</h3>
                <div class="header-actions">
                    {#if unreadCount > 0}
                        <button class="mark-read-btn" on:click={markAllAsRead}>
                            <IconCheck size={14} />
                            <span>Mark all read</span>
                        </button>
                    {/if}
                    <button class="close-btn" on:click={closePanel}>
                        <IconX size={18} />
                    </button>
                </div>
            </div>

            <div class="panel-content">
                {#if isLoading}
                    <div class="empty-state">
                        <div class="spinner"></div>
                        <p>Loading...</p>
                    </div>
                {:else if notifications.length === 0}
                    <div class="empty-state">
                        <span class="empty-icon">🔔</span>
                        <p>No notifications</p>
                        <span class="empty-sub">You're all caught up!</span>
                    </div>
                {:else}
                    <div class="notif-list">
                        {#each notifications as notif (notif.id)}
                            <button
                                class="notif-item"
                                class:unread={!notif.read}
                                class:urgent={notif.priority === 'urgent' || notif.type === 'emergency_alert'}
                                on:click={() => handleNotifClick(notif)}
                            >
                                <div class="notif-icon">{getIcon(notif.type)}</div>
                                <div class="notif-body">
                                    <p class="notif-title">{notif.title || 'Notification'}</p>
                                    {#if notif.body}
                                        <p class="notif-text">{notif.body}</p>
                                    {/if}
                                    <span class="notif-time">{getTimeAgo(notif.createdAt)}</span>
                                </div>
                                {#if !notif.read}
                                    <span class="unread-dot"></span>
                                {/if}
                            </button>
                        {/each}
                    </div>
                {/if}
            </div>

            {#if notifications.length > 5}
                <div class="panel-footer">
                    <a href="/app/announcements" class="view-all" on:click={closePanel}>
                        View All
                        <IconChevronRight size={16} />
                    </a>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    /* Overlay - shows on mobile when panel is open */
    .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 10001;
        display: none;
    }

    @media (max-width: 640px) {
        .overlay {
            display: block;
        }
    }

    /* Bell Container */
    .bell-container {
        position: relative;
        z-index: 10002;
    }

    /* Bell Button */
    .bell-btn {
        position: relative;
        width: 46px;
        height: 46px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        transition: all 0.3s ease;
    }

    .bell-btn:hover {
        background: rgba(255, 255, 255, 0.3);
        transform: scale(1.05);
    }

    .bell-btn:active {
        transform: scale(0.95);
    }

    .bell-wrapper {
        display: flex;
        transform-origin: top center;
    }

    .bell-btn:hover .bell-wrapper {
        animation: swing 0.5s ease;
    }

    .bell-btn.ringing .bell-wrapper {
        animation: ring 0.8s ease;
    }

    .bell-btn.has-unread::after {
        content: '';
        position: absolute;
        inset: -3px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, transparent 70%);
        animation: pulse 2s infinite;
    }

    @keyframes swing {
        0%,
        100% {
            transform: rotate(0);
        }
        25% {
            transform: rotate(12deg);
        }
        75% {
            transform: rotate(-12deg);
        }
    }

    @keyframes ring {
        0%,
        100% {
            transform: rotate(0) scale(1);
        }
        10%,
        30% {
            transform: rotate(15deg) scale(1.1);
        }
        20%,
        40% {
            transform: rotate(-15deg) scale(1.1);
        }
        50% {
            transform: rotate(8deg);
        }
        60% {
            transform: rotate(-8deg);
        }
    }

    @keyframes pulse {
        0%,
        100% {
            opacity: 0.4;
        }
        50% {
            opacity: 0.8;
        }
    }

    /* Badge */
    .badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        background: linear-gradient(135deg, #ff3b30, #ff6b6b);
        color: white;
        font-size: 11px;
        font-weight: 700;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid white;
        box-shadow: 0 2px 8px rgba(255, 59, 48, 0.4);
    }

    /* Panel */
    .panel {
        position: fixed;
        top: 80px;
        right: 24px;
        width: 380px;
        max-height: calc(100vh - 120px);
        background: #ffffff;
        background-color: #ffffff;
        border-radius: 16px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.05);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        z-index: 10002;
        isolation: isolate;
    }

    .drag-handle {
        display: none;
    }

    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #f0f0f0;
    }

    .panel-header h3 {
        margin: 0;
        font-size: 17px;
        font-weight: 600;
        color: #1d1d1f;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .mark-read-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: rgba(0, 122, 255, 0.1);
        color: #007aff;
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
    }

    .mark-read-btn:hover {
        background: rgba(0, 122, 255, 0.2);
    }

    .close-btn {
        display: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: #f5f5f7;
        border: none;
        cursor: pointer;
        align-items: center;
        justify-content: center;
        color: #86868b;
    }

    /* Panel Content */
    .panel-content {
        flex: 1;
        overflow-y: auto;
        max-height: 380px;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 48px 20px;
        color: #86868b;
    }

    .empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
    }

    .empty-state p {
        margin: 0 0 4px;
        font-size: 15px;
        font-weight: 500;
        color: #1d1d1f;
    }

    .empty-sub {
        font-size: 13px;
    }

    .spinner {
        width: 24px;
        height: 24px;
        border: 2px solid #f0f0f0;
        border-top-color: #007aff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 12px;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Notification List */
    .notif-list {
        padding: 8px;
    }

    .notif-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        width: 100%;
        padding: 12px;
        border: none;
        border-radius: 12px;
        background: transparent;
        cursor: pointer;
        text-align: left;
        transition: background 0.2s;
    }

    .notif-item:hover {
        background: #f5f5f7;
    }

    .notif-item.unread {
        background: rgba(0, 122, 255, 0.05);
    }

    .notif-item.unread:hover {
        background: rgba(0, 122, 255, 0.1);
    }

    .notif-item.urgent {
        background: rgba(255, 59, 48, 0.05);
        border-left: 3px solid #ff3b30;
    }

    .notif-icon {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        background: #f0f0f0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
    }

    .notif-item.urgent .notif-icon {
        background: rgba(255, 59, 48, 0.1);
    }

    .notif-body {
        flex: 1;
        min-width: 0;
    }

    .notif-title {
        margin: 0 0 2px;
        font-size: 14px;
        font-weight: 600;
        color: #1d1d1f;
        line-height: 1.3;
    }

    .notif-text {
        margin: 0 0 4px;
        font-size: 13px;
        color: #86868b;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .notif-time {
        font-size: 11px;
        color: #aeaeb2;
    }

    .unread-dot {
        width: 8px;
        height: 8px;
        background: #007aff;
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 6px;
    }

    /* Panel Footer */
    .panel-footer {
        padding: 12px 16px;
        border-top: 1px solid #f0f0f0;
    }

    .view-all {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        color: #007aff;
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        padding: 8px;
        border-radius: 8px;
    }

    .view-all:hover {
        background: rgba(0, 122, 255, 0.1);
    }

    /* Tablet */
    @media (max-width: 1024px) {
        .panel {
            right: 16px;
            width: 360px;
            max-height: calc(100vh - 100px);
        }
    }

    @media (max-width: 768px) {
        .panel {
            width: 340px;
            right: 12px;
        }

        .bell-btn {
            width: 42px;
            height: 42px;
        }
    }

    /* Mobile */
    @media (max-width: 640px) {
        .bell-container {
            position: static;
        }

        .panel,
        .panel.mobile-panel {
            position: fixed !important;
            top: auto !important;
            bottom: 0 !important;
            left: 0 !important;
            right: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            max-height: 85vh;
            border-radius: 24px 24px 0 0;
            z-index: 10002;
            box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.2);
            background: #ffffff !important;
            background-color: #ffffff !important;
        }

        .drag-handle {
            display: block;
            width: 40px;
            height: 5px;
            background: #d1d1d6;
            border-radius: 3px;
            margin: 12px auto 4px;
        }

        .panel-header {
            padding: 8px 20px 16px;
            background: #ffffff;
        }

        .panel-header h3 {
            font-size: 18px;
        }

        .close-btn {
            display: flex;
        }

        .panel-content {
            max-height: calc(85vh - 140px);
            padding-bottom: env(safe-area-inset-bottom, 20px);
            background: #ffffff;
        }

        .bell-btn {
            width: 40px;
            height: 40px;
        }

        .badge {
            min-width: 18px;
            height: 18px;
            font-size: 10px;
        }

        .notif-list {
            background: #ffffff;
        }

        .notif-item {
            padding: 14px 16px;
            background: #ffffff;
        }

        .notif-item.unread {
            background: rgba(0, 122, 255, 0.05);
        }

        .notif-item.urgent {
            background: rgba(255, 59, 48, 0.05);
        }

        .notif-icon {
            width: 44px;
            height: 44px;
            font-size: 20px;
        }

        .notif-title {
            font-size: 15px;
        }

        .notif-text {
            font-size: 14px;
        }

        .panel-footer {
            padding: 16px 20px;
            padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
            background: #ffffff;
        }

        .view-all {
            padding: 12px;
            font-size: 15px;
            background: rgba(0, 122, 255, 0.1);
            border-radius: 12px;
        }
    }

    /* Small Mobile */
    @media (max-width: 380px) {
        .bell-btn {
            width: 36px;
            height: 36px;
        }

        .mark-read-btn span {
            display: none;
        }

        .mark-read-btn {
            padding: 6px 8px;
        }

        .panel-header {
            padding: 10px 16px 14px;
        }
    }
</style>
