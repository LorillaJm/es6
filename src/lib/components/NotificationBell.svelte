<!-- src/lib/components/NotificationBell.svelte -->
<!-- Professional 3D animated notification bell with unread count, sound, and notification panel -->
<script>
    import { onMount, onDestroy } from 'svelte';
    import { fly, fade, scale } from 'svelte/transition';
    import { browser } from '$app/environment';
    import { db, ref, onValue, off, update } from '$lib/firebase';
    import { IconBell, IconCheck, IconX, IconChevronRight, IconTrash } from '@tabler/icons-svelte';
    import { format, formatDistanceToNow } from 'date-fns';
    
    export let userId = null;
    
    let notifications = [];
    let unreadCount = 0;
    let isOpen = false;
    let isLoading = true;
    let hasNewNotification = false;
    let bellElement;
    let isFirstLoad = true;
    let previousNotificationIds = new Set();
    
    // Real-time listener
    let unsubscribe = null;
    
    onMount(() => {
        if (browser && userId) {
            startListening();
        }
        
        // Close panel when clicking outside
        document.addEventListener('click', handleClickOutside);
        
        // Close on escape key
        document.addEventListener('keydown', handleEscapeKey);
        
        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleEscapeKey);
            if (unsubscribe) unsubscribe();
        };
    });
    
    function startListening() {
        if (!db || !userId) return;
        
        const notifRef = ref(db, `notifications/${userId}`);
        unsubscribe = onValue(notifRef, (snapshot) => {
            const data = snapshot.val();
            
            if (data) {
                const newNotifications = Object.entries(data)
                    .map(([id, notif]) => ({ id, ...notif }))
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                    .slice(0, 50);
                
                // Check for truly new notifications (not just first load)
                if (!isFirstLoad) {
                    const currentIds = new Set(newNotifications.map(n => n.id));
                    const newIds = [...currentIds].filter(id => !previousNotificationIds.has(id));
                    
                    if (newIds.length > 0) {
                        // Find the newest notification to check if it's unread
                        const newestNotif = newNotifications.find(n => newIds.includes(n.id));
                        if (newestNotif && !newestNotif.read) {
                            triggerNewNotificationAnimation(newestNotif);
                        }
                    }
                }
                
                // Update previous IDs for next comparison
                previousNotificationIds = new Set(newNotifications.map(n => n.id));
                notifications = newNotifications;
                unreadCount = notifications.filter(n => !n.read).length;
            } else {
                notifications = [];
                unreadCount = 0;
                previousNotificationIds = new Set();
            }
            
            isFirstLoad = false;
            isLoading = false;
        });
    }
    
    function triggerNewNotificationAnimation(notification = null) {
        hasNewNotification = true;
        
        // Play notification sound
        playNotificationSound(notification?.priority === 'urgent' || notification?.type === 'emergency_alert');
        
        // Vibrate device if supported
        vibrateDevice(notification?.priority === 'urgent');
        
        setTimeout(() => {
            hasNewNotification = false;
        }, 1500);
    }
    
    // Play notification sound using Web Audio API
    function playNotificationSound(isUrgent = false) {
        if (!browser) return;
        
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            
            const audioCtx = new AudioContext();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            
            // Different sound for urgent vs normal
            if (isUrgent) {
                // Urgent: Higher pitch, longer duration
                oscillator.frequency.value = 880;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.3;
                oscillator.start();
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
                oscillator.stop(audioCtx.currentTime + 0.5);
                
                // Second beep for urgent
                setTimeout(() => {
                    const audioCtx2 = new AudioContext();
                    const osc2 = audioCtx2.createOscillator();
                    const gain2 = audioCtx2.createGain();
                    osc2.connect(gain2);
                    gain2.connect(audioCtx2.destination);
                    osc2.frequency.value = 1000;
                    osc2.type = 'sine';
                    gain2.gain.value = 0.3;
                    osc2.start();
                    gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx2.currentTime + 0.3);
                    osc2.stop(audioCtx2.currentTime + 0.3);
                }, 200);
            } else {
                // Normal: Pleasant notification sound
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.25;
                oscillator.start();
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                oscillator.stop(audioCtx.currentTime + 0.3);
            }
        } catch (error) {
            console.warn('Could not play notification sound:', error);
        }
    }
    
    // Vibrate device
    function vibrateDevice(isUrgent = false) {
        if (!browser || !navigator.vibrate) return;
        
        try {
            if (isUrgent) {
                navigator.vibrate([200, 100, 200, 100, 200]);
            } else {
                navigator.vibrate([150, 50, 150]);
            }
        } catch (error) {
            console.warn('Vibration not supported:', error);
        }
    }
    
    function handleEscapeKey(event) {
        if (event.key === 'Escape' && isOpen) {
            isOpen = false;
        }
    }
    
    function handleClickOutside(event) {
        if (bellElement && !bellElement.contains(event.target)) {
            isOpen = false;
        }
    }
    
    function togglePanel() {
        isOpen = !isOpen;
    }
    
    async function markAsRead(notifId) {
        if (!db || !userId) return;
        try {
            const notifRef = ref(db, `notifications/${userId}/${notifId}`);
            await update(notifRef, { read: true });
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    }
    
    async function markAllAsRead() {
        if (!db || !userId || notifications.length === 0) return;
        try {
            const updates = {};
            notifications.forEach(n => {
                if (!n.read) {
                    updates[`notifications/${userId}/${n.id}/read`] = true;
                }
            });
            if (Object.keys(updates).length > 0) {
                await update(ref(db), updates);
            }
        } catch (error) {
            console.error('Error marking all as read:', error);
        }
    }
    
    function getNotificationIcon(type) {
        switch (type) {
            case 'emergency_alert': return '🚨';
            case 'announcement': return '📢';
            case 'feedback_reply': return '💬';
            case 'qr_regenerated': return '🔄';
            case 'schedule': return '📅';
            default: return '🔔';
        }
    }
    
    function getTimeAgo(dateStr) {
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
        } catch {
            return '';
        }
    }
    
    function handleNotificationClick(notif) {
        markAsRead(notif.id);
        if (notif.announcementId) {
            window.location.href = '/app/announcements';
        }
    }
</script>

<div class="notification-bell-container" bind:this={bellElement}>
    <!-- 3D Animated Bell Button -->
    <button 
        class="bell-button"
        class:has-unread={unreadCount > 0}
        class:is-ringing={hasNewNotification}
        on:click={togglePanel}
        aria-label="Notifications"
        aria-expanded={isOpen}
    >
        <div class="bell-3d-wrapper">
            <div class="bell-icon-container">
                <IconBell size={24} stroke={1.8} />
                <div class="bell-clapper"></div>
            </div>
            <div class="bell-glow"></div>
            <div class="bell-ring-effect"></div>
        </div>
        
        {#if unreadCount > 0}
            <span class="badge-count" in:scale={{ duration: 300 }}>
                {unreadCount > 99 ? '99+' : unreadCount}
            </span>
        {/if}
    </button>
    
    <!-- Notification Panel -->
    {#if isOpen}
        <div 
            class="notification-panel"
            in:fly={{ y: -10, duration: 200 }}
            out:fade={{ duration: 150 }}
        >
            <div class="panel-header">
                <h3 class="panel-title">Notifications</h3>
                {#if unreadCount > 0}
                    <button class="mark-all-btn" on:click={markAllAsRead}>
                        <IconCheck size={14} stroke={2} />
                        Mark all read
                    </button>
                {/if}
            </div>
            
            <div class="panel-body">
                {#if isLoading}
                    <div class="panel-loading">
                        <div class="spinner"></div>
                        <span>Loading...</span>
                    </div>
                {:else if notifications.length === 0}
                    <div class="panel-empty">
                        <div class="empty-icon">🔔</div>
                        <p>No notifications yet</p>
                        <span>You're all caught up!</span>
                    </div>
                {:else}
                    <div class="notification-list">
                        {#each notifications as notif, i (notif.id)}
                            <div 
                                class="notification-item"
                                class:unread={!notif.read}
                                class:urgent={notif.priority === 'urgent' || notif.type === 'emergency_alert'}
                                on:click={() => handleNotificationClick(notif)}
                                on:keydown={(e) => e.key === 'Enter' && handleNotificationClick(notif)}
                                role="button"
                                tabindex="0"
                                in:fly={{ y: 10, delay: i * 30, duration: 200 }}
                            >
                                <div class="notif-icon">
                                    {getNotificationIcon(notif.type)}
                                </div>
                                <div class="notif-content">
                                    <p class="notif-title">{notif.title}</p>
                                    {#if notif.body}
                                        <p class="notif-body">{notif.body}</p>
                                    {/if}
                                    <span class="notif-time">{getTimeAgo(notif.createdAt)}</span>
                                </div>
                                {#if !notif.read}
                                    <div class="unread-dot"></div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>
            
            {#if notifications.length > 0}
                <div class="panel-footer">
                    <a href="/app/notifications" class="view-all-link">
                        View All Notifications
                        <IconChevronRight size={16} stroke={2} />
                    </a>
                </div>
            {/if}
        </div>
    {/if}
</div>

<style>
    .notification-bell-container {
        position: relative;
        z-index: 100;
    }
    
    /* 3D Bell Button */
    .bell-button {
        position: relative;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.3);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        transform-style: preserve-3d;
        perspective: 1000px;
    }
    
    .bell-button:hover {
        transform: translateY(-2px) scale(1.05);
        background: rgba(255, 255, 255, 0.3);
        box-shadow: 
            0 8px 32px rgba(0, 0, 0, 0.15),
            0 0 0 1px rgba(255, 255, 255, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.4);
    }
    
    .bell-button:active {
        transform: translateY(0) scale(0.98);
    }
    
    .bell-3d-wrapper {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }
    
    .bell-icon-container {
        position: relative;
        transform-origin: top center;
        transition: transform 0.3s ease;
    }
    
    .bell-button:hover .bell-icon-container {
        animation: bell-swing 0.5s ease-in-out;
    }
    
    .bell-button.is-ringing .bell-icon-container {
        animation: bell-ring 0.8s ease-in-out;
    }
    
    @keyframes bell-swing {
        0%, 100% { transform: rotate(0deg); }
        25% { transform: rotate(15deg); }
        75% { transform: rotate(-15deg); }
    }
    
    @keyframes bell-ring {
        0%, 100% { transform: rotate(0deg) scale(1); }
        10% { transform: rotate(20deg) scale(1.1); }
        20% { transform: rotate(-20deg) scale(1.1); }
        30% { transform: rotate(15deg) scale(1.05); }
        40% { transform: rotate(-15deg) scale(1.05); }
        50% { transform: rotate(10deg) scale(1); }
        60% { transform: rotate(-10deg) scale(1); }
        70% { transform: rotate(5deg); }
        80% { transform: rotate(-5deg); }
        90% { transform: rotate(2deg); }
    }
    
    /* Bell Clapper */
    .bell-clapper {
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 4px;
        background: white;
        border-radius: 50%;
        opacity: 0.8;
    }
    
    /* Glow Effect */
    .bell-glow {
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.4) 0%, transparent 70%);
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .bell-button.has-unread .bell-glow {
        opacity: 1;
        animation: glow-pulse 2s infinite;
    }
    
    @keyframes glow-pulse {
        0%, 100% { opacity: 0.5; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.1); }
    }
    
    /* Ring Effect */
    .bell-ring-effect {
        position: absolute;
        inset: 0;
        border-radius: 50%;
        border: 2px solid rgba(255, 255, 255, 0.5);
        opacity: 0;
        transform: scale(1);
    }
    
    .bell-button.is-ringing .bell-ring-effect {
        animation: ring-expand 0.8s ease-out;
    }
    
    @keyframes ring-expand {
        0% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(2); }
    }
    
    /* Badge Count */
    .badge-count {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 20px;
        height: 20px;
        padding: 0 6px;
        background: linear-gradient(135deg, #FF3B30 0%, #FF6B6B 100%);
        color: white;
        font-size: 11px;
        font-weight: 700;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 8px rgba(255, 59, 48, 0.4);
        border: 2px solid rgba(255, 255, 255, 0.9);
        animation: badge-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    
    @keyframes badge-bounce {
        0% { transform: scale(0); }
        50% { transform: scale(1.2); }
        100% { transform: scale(1); }
    }
    
    /* Notification Panel */
    .notification-panel {
        position: absolute;
        top: calc(100% + 12px);
        right: 0;
        width: 360px;
        max-height: 480px;
        background: var(--theme-card-bg, white);
        border-radius: 16px;
        box-shadow: 
            0 20px 60px rgba(0, 0, 0, 0.15),
            0 0 0 1px rgba(0, 0, 0, 0.05);
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }
    
    .panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid var(--theme-border-light, #f0f0f0);
        background: var(--theme-card-bg, white);
    }
    
    .panel-title {
        font-size: 17px;
        font-weight: 600;
        color: var(--theme-text, #1d1d1f);
        margin: 0;
    }
    
    .mark-all-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        background: rgba(0, 122, 255, 0.1);
        color: var(--apple-accent, #007AFF);
        border: none;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .mark-all-btn:hover {
        background: rgba(0, 122, 255, 0.2);
    }
    
    .panel-body {
        flex: 1;
        overflow-y: auto;
        max-height: 360px;
    }
    
    .panel-loading,
    .panel-empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        color: var(--theme-text-secondary, #86868b);
    }
    
    .empty-icon {
        font-size: 48px;
        margin-bottom: 12px;
        opacity: 0.5;
    }
    
    .panel-empty p {
        font-size: 15px;
        font-weight: 500;
        color: var(--theme-text, #1d1d1f);
        margin: 0 0 4px;
    }
    
    .panel-empty span {
        font-size: 13px;
    }
    
    .spinner {
        width: 24px;
        height: 24px;
        border: 2px solid var(--theme-border-light, #f0f0f0);
        border-top-color: var(--apple-accent, #007AFF);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 12px;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    
    /* Notification List */
    .notification-list {
        padding: 8px;
    }
    
    .notification-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 12px;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;
    }
    
    .notification-item:hover {
        background: var(--theme-border-light, #f5f5f7);
    }
    
    .notification-item.unread {
        background: rgba(0, 122, 255, 0.05);
    }
    
    .notification-item.unread:hover {
        background: rgba(0, 122, 255, 0.1);
    }
    
    .notification-item.urgent {
        background: rgba(255, 59, 48, 0.05);
        border-left: 3px solid #FF3B30;
    }
    
    .notification-item.urgent:hover {
        background: rgba(255, 59, 48, 0.1);
    }
    
    .notif-icon {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        background: var(--theme-border-light, #f0f0f0);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
    }
    
    .notification-item.urgent .notif-icon {
        background: rgba(255, 59, 48, 0.1);
    }
    
    .notif-content {
        flex: 1;
        min-width: 0;
    }
    
    .notif-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text, #1d1d1f);
        margin: 0 0 2px;
        line-height: 1.3;
    }
    
    .notif-body {
        font-size: 13px;
        color: var(--theme-text-secondary, #86868b);
        margin: 0 0 4px;
        line-height: 1.4;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    
    .notif-time {
        font-size: 11px;
        color: var(--theme-text-tertiary, #aeaeb2);
    }
    
    .unread-dot {
        width: 8px;
        height: 8px;
        background: var(--apple-accent, #007AFF);
        border-radius: 50%;
        flex-shrink: 0;
        margin-top: 4px;
    }
    
    .panel-footer {
        padding: 12px 16px;
        border-top: 1px solid var(--theme-border-light, #f0f0f0);
        background: var(--theme-card-bg, white);
    }
    
    .view-all-link {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        color: var(--apple-accent, #007AFF);
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        padding: 8px;
        border-radius: 8px;
        transition: background 0.2s ease;
    }
    
    .view-all-link:hover {
        background: rgba(0, 122, 255, 0.1);
    }
    
    /* Tablet Responsive */
    @media (max-width: 768px) {
        .notification-panel {
            width: 320px;
            max-height: 420px;
        }
        
        .panel-body {
            max-height: 300px;
        }
        
        .bell-button {
            width: 44px;
            height: 44px;
        }
    }
    
    /* Mobile Responsive */
    @media (max-width: 480px) {
        .notification-bell-container {
            position: static;
        }
        
        .notification-panel {
            position: fixed;
            top: auto;
            bottom: 0;
            left: 0;
            right: 0;
            width: 100%;
            max-height: 75vh;
            border-radius: 24px 24px 0 0;
            z-index: 1000;
        }
        
        .panel-header {
            padding: 20px;
            border-bottom: none;
            position: relative;
        }
        
        .panel-header::before {
            content: '';
            position: absolute;
            top: 8px;
            left: 50%;
            transform: translateX(-50%);
            width: 36px;
            height: 4px;
            background: var(--theme-border, #d1d1d6);
            border-radius: 2px;
        }
        
        .panel-title {
            font-size: 18px;
            padding-top: 8px;
        }
        
        .panel-body {
            max-height: calc(75vh - 140px);
        }
        
        .notification-item {
            padding: 14px 12px;
        }
        
        .notif-icon {
            width: 40px;
            height: 40px;
            font-size: 20px;
        }
        
        .notif-title {
            font-size: 15px;
        }
        
        .notif-body {
            font-size: 14px;
        }
        
        .bell-button {
            width: 42px;
            height: 42px;
        }
        
        .badge-count {
            min-width: 18px;
            height: 18px;
            font-size: 10px;
            top: -2px;
            right: -2px;
        }
    }
    
    /* Small Mobile */
    @media (max-width: 360px) {
        .bell-button {
            width: 38px;
            height: 38px;
        }
        
        .panel-header {
            padding: 16px;
        }
        
        .mark-all-btn {
            padding: 5px 10px;
            font-size: 11px;
        }
    }
    
    /* Mobile overlay backdrop */
    @media (max-width: 480px) {
        .notification-bell-container::before {
            content: '';
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(4px);
            -webkit-backdrop-filter: blur(4px);
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
            z-index: 999;
            pointer-events: none;
        }
    }
</style>
