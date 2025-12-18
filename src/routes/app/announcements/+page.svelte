<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    import { auth, db, ref, onValue, update } from '$lib/firebase';
    import { fly, fade, scale } from 'svelte/transition';
    import { format, formatDistanceToNow } from 'date-fns';
    import {
        IconBell,
        IconBellRinging,
        IconCheck,
        IconChevronLeft,
        IconFilter,
        IconSearch,
        IconX,
        IconAlertTriangle,
        IconSpeakerphone,
        IconCalendar,
        IconClock
    } from '@tabler/icons-svelte';
    import { initPushNotifications, requestNotificationPermission, getNotificationPermission } from '$lib/notifications/pushNotificationService';

    let user = null;
    let notifications = [];
    let isLoading = true;
    let selectedItem = null;
    let showDetailModal = false;
    let filter = 'all'; // all, unread, announcements, alerts
    let searchQuery = '';
    let notificationPermission = 'default';
    let showPermissionBanner = false;

    onMount(async () => {
        if (!browser) return;

        user = auth?.currentUser;
        if (!user) {
            window.location.href = '/';
            return;
        }

        // Check notification permission
        notificationPermission = getNotificationPermission();
        showPermissionBanner = notificationPermission === 'default';

        // Load notifications (which include announcements sent to this user)
        loadNotifications();
    });

    function loadNotifications() {
        if (!db || !user) return;

        const notifRef = ref(db, `notifications/${user.uid}`);
        onValue(
            notifRef,
            (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    notifications = Object.entries(data)
                        .map(([id, notif]) => ({ id, ...notif }))
                        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                } else {
                    notifications = [];
                }
                isLoading = false;
            },
            (error) => {
                console.error('Error loading notifications:', error);
                isLoading = false;
            }
        );
    }

    async function enableNotifications() {
        const result = await requestNotificationPermission();
        notificationPermission = result.permission || 'denied';
        if (result.granted) {
            showPermissionBanner = false;
            await initPushNotifications();
        }
    }

    async function markAsRead(item) {
        if (!db || !user || item.read) return;
        try {
            await update(ref(db, `notifications/${user.uid}/${item.id}`), { read: true });
        } catch (e) {
            console.error('Error marking as read:', e);
        }
    }

    async function trackAnnouncementView(item) {
        // Only track views for announcements that have an announcementId
        if (!user || !item.announcementId) return;
        try {
            await fetch('/api/announcements/view', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    announcementId: item.announcementId,
                    userId: user.uid
                })
            });
        } catch (e) {
            console.error('Error tracking view:', e);
        }
    }

    async function markAllAsRead() {
        if (!db || !user) return;
        try {
            const updates = {};
            notifications.forEach((n) => {
                if (!n.read) {
                    updates[`notifications/${user.uid}/${n.id}/read`] = true;
                }
            });
            if (Object.keys(updates).length) {
                await update(ref(db), updates);
            }
        } catch (e) {
            console.error('Error marking all as read:', e);
        }
    }

    function openDetail(item) {
        selectedItem = item;
        showDetailModal = true;
        markAsRead(item);
        trackAnnouncementView(item);
        document.body.style.overflow = 'hidden';
    }

    function closeDetail() {
        showDetailModal = false;
        selectedItem = null;
        document.body.style.overflow = '';
    }

    function getIcon(type) {
        const icons = {
            emergency_alert: { icon: IconAlertTriangle, color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.1)' },
            announcement: { icon: IconSpeakerphone, color: '#007AFF', bg: 'rgba(0, 122, 255, 0.1)' },
            feedback_reply: { icon: IconBell, color: '#5856D6', bg: 'rgba(88, 86, 214, 0.1)' },
            schedule: { icon: IconCalendar, color: '#FF9500', bg: 'rgba(255, 149, 0, 0.1)' }
        };
        return icons[type] || { icon: IconBell, color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.1)' };
    }

    function getTimeAgo(dateStr) {
        if (!dateStr) return '';
        try {
            return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
        } catch {
            return '';
        }
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        try {
            return format(new Date(dateStr), 'MMMM d, yyyy • h:mm a');
        } catch {
            return '';
        }
    }

    $: filteredItems = [...notifications].filter((item) => {
        if (filter === 'unread' && item.read) return false;
        if (filter === 'announcements' && item.type !== 'announcement') return false;
        if (filter === 'alerts' && item.type !== 'emergency_alert') return false;
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            return item.title?.toLowerCase().includes(query) || item.body?.toLowerCase().includes(query);
        }
        return true;
    });

    $: unreadCount = notifications.filter((n) => !n.read).length;
</script>

<svelte:head>
    <title>Announcements | Student Attendance</title>
</svelte:head>

<div class="announcements-page">
    <!-- Header -->
    <header class="page-header">
        <div class="header-left">
            <a href="/app/dashboard" class="back-btn">
                <IconChevronLeft size={20} />
            </a>
            <div class="header-title">
                <h1>Announcements</h1>
                <p>{notifications.length} notifications • {unreadCount} unread</p>
            </div>
        </div>
        <div class="header-actions">
            {#if unreadCount > 0}
                <button class="action-btn" on:click={markAllAsRead}>
                    <IconCheck size={18} />
                    <span>Mark all read</span>
                </button>
            {/if}
        </div>
    </header>

    <!-- Permission Banner -->
    {#if showPermissionBanner}
        <div class="permission-banner" in:fly={{ y: -20, duration: 300 }}>
            <div class="banner-content">
                <IconBellRinging size={24} />
                <div class="banner-text">
                    <strong>Enable Push Notifications</strong>
                    <p>Get instant alerts when new announcements are posted</p>
                </div>
            </div>
            <div class="banner-actions">
                <button class="enable-btn" on:click={enableNotifications}>Enable</button>
                <button class="dismiss-btn" on:click={() => (showPermissionBanner = false)}>
                    <IconX size={18} />
                </button>
            </div>
        </div>
    {/if}

    <!-- Filters -->
    <div class="filters-section">
        <div class="search-box">
            <IconSearch size={18} />
            <input type="text" placeholder="Search announcements..." bind:value={searchQuery} />
        </div>
        <div class="filter-tabs">
            <button class="filter-tab" class:active={filter === 'all'} on:click={() => (filter = 'all')}>All</button>
            <button class="filter-tab" class:active={filter === 'unread'} on:click={() => (filter = 'unread')}>
                Unread
                {#if unreadCount > 0}
                    <span class="tab-badge">{unreadCount}</span>
                {/if}
            </button>
            <button class="filter-tab" class:active={filter === 'announcements'} on:click={() => (filter = 'announcements')}>Announcements</button>
            <button class="filter-tab" class:active={filter === 'alerts'} on:click={() => (filter = 'alerts')}>Alerts</button>
        </div>
    </div>

    <!-- Content -->
    <div class="content-section">
        {#if isLoading}
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Loading announcements...</p>
            </div>
        {:else if filteredItems.length === 0}
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <h3>No announcements</h3>
                <p>{filter === 'unread' ? "You've read all notifications!" : 'No announcements to show'}</p>
            </div>
        {:else}
            <div class="notifications-list">
                {#each filteredItems as item, i (item.id)}
                    {@const iconData = getIcon(item.type)}
                    <button
                        class="notification-card"
                        class:unread={!item.read}
                        class:urgent={item.priority === 'urgent' || item.type === 'emergency_alert'}
                        on:click={() => openDetail(item)}
                        in:fly={{ y: 20, delay: i * 30, duration: 200 }}
                    >
                        <div class="card-icon" style="background: {iconData.bg}; color: {iconData.color}">
                            <svelte:component this={iconData.icon} size={22} />
                        </div>
                        <div class="card-content">
                            <div class="card-header">
                                <h3>{item.title || 'Notification'}</h3>
                                {#if !item.read}
                                    <span class="unread-badge">New</span>
                                {/if}
                            </div>
                            {#if item.body}
                                <p class="card-body">{item.body}</p>
                            {/if}
                            <div class="card-meta">
                                <span class="meta-time">
                                    <IconClock size={14} />
                                    {getTimeAgo(item.createdAt)}
                                </span>
                                {#if item.priority === 'urgent'}
                                    <span class="meta-priority urgent">Urgent</span>
                                {:else if item.priority === 'high'}
                                    <span class="meta-priority high">High Priority</span>
                                {/if}
                            </div>
                        </div>
                        <div class="card-arrow">
                            <IconChevronLeft size={18} style="transform: rotate(180deg)" />
                        </div>
                    </button>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Detail Modal -->
{#if showDetailModal && selectedItem}
    {@const modalIconData = getIcon(selectedItem.type)}
    <div class="modal-overlay" on:click={closeDetail} transition:fade={{ duration: 200 }}>
        <div class="modal-container" on:click|stopPropagation in:fly={{ y: 50, duration: 300 }}>
            <div class="modal-header">
                <div class="modal-icon" style="background: {modalIconData.bg}; color: {modalIconData.color}">
                    <svelte:component this={modalIconData.icon} size={28} />
                </div>
                <button class="modal-close" on:click={closeDetail}>
                    <IconX size={20} />
                </button>
            </div>

            <div class="modal-body">
                <h2>{selectedItem.title || 'Notification'}</h2>
                <div class="modal-meta">
                    <span><IconClock size={16} /> {formatDate(selectedItem.createdAt)}</span>
                    {#if selectedItem.priority}
                        <span class="priority-tag {selectedItem.priority}">{selectedItem.priority}</span>
                    {/if}
                </div>
                <div class="modal-content">
                    {#if selectedItem.body}
                        <p>{selectedItem.body}</p>
                    {/if}
                    {#if selectedItem.content}
                        <p>{selectedItem.content}</p>
                    {/if}
                </div>

                {#if selectedItem.imageUrl}
                    <div class="modal-image">
                        <img src={selectedItem.imageUrl} alt="Announcement" />
                    </div>
                {/if}
            </div>

            <div class="modal-footer">
                <button class="modal-btn secondary" on:click={closeDetail}>Close</button>
                {#if selectedItem.requireAcknowledgment && !selectedItem.acknowledged}
                    <button class="modal-btn primary">
                        <IconCheck size={18} />
                        Acknowledge
                    </button>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style>
    .announcements-page {
        min-height: 100%;
        background: var(--theme-bg, #f5f5f7);
    }

    /* Header */
    .page-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 24px;
        background: white;
        border-bottom: 1px solid #f0f0f0;
        position: sticky;
        top: 0;
        z-index: 10;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .back-btn {
        width: 40px;
        height: 40px;
        border-radius: 12px;
        background: #f5f5f7;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #1d1d1f;
        text-decoration: none;
        transition: all 0.2s;
    }

    .back-btn:hover {
        background: #e5e5e7;
    }

    .header-title h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 700;
        color: #1d1d1f;
    }

    .header-title p {
        margin: 2px 0 0;
        font-size: 13px;
        color: #86868b;
    }

    .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 16px;
        background: rgba(0, 122, 255, 0.1);
        color: #007aff;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
    }

    .action-btn:hover {
        background: rgba(0, 122, 255, 0.2);
    }

    /* Permission Banner */
    .permission-banner {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 24px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
    }

    .banner-content {
        display: flex;
        align-items: center;
        gap: 16px;
    }

    .banner-text strong {
        display: block;
        font-size: 15px;
    }

    .banner-text p {
        margin: 2px 0 0;
        font-size: 13px;
        opacity: 0.9;
    }

    .banner-actions {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .enable-btn {
        padding: 10px 20px;
        background: white;
        color: #667eea;
        border: none;
        border-radius: 10px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
    }

    .dismiss-btn {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /* Filters */
    .filters-section {
        padding: 16px 24px;
        background: white;
        border-bottom: 1px solid #f0f0f0;
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .search-box {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        background: #f5f5f7;
        border-radius: 12px;
        color: #86868b;
    }

    .search-box input {
        flex: 1;
        border: none;
        background: none;
        font-size: 15px;
        color: #1d1d1f;
        outline: none;
    }

    .search-box input::placeholder {
        color: #86868b;
    }

    .filter-tabs {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 4px;
    }

    .filter-tab {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 8px 16px;
        background: #f5f5f7;
        border: none;
        border-radius: 20px;
        font-size: 14px;
        font-weight: 500;
        color: #86868b;
        cursor: pointer;
        white-space: nowrap;
        transition: all 0.2s;
    }

    .filter-tab:hover {
        background: #e5e5e7;
    }

    .filter-tab.active {
        background: #007aff;
        color: white;
    }

    .tab-badge {
        padding: 2px 8px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 10px;
        font-size: 12px;
    }

    .filter-tab:not(.active) .tab-badge {
        background: #ff3b30;
        color: white;
    }

    /* Content */
    .content-section {
        padding: 16px 24px 100px;
    }

    .loading-state,
    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        text-align: center;
    }

    .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #f0f0f0;
        border-top-color: #007aff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
        margin-bottom: 16px;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    .empty-icon {
        font-size: 64px;
        margin-bottom: 16px;
    }

    .empty-state h3 {
        margin: 0 0 8px;
        font-size: 20px;
        color: #1d1d1f;
    }

    .empty-state p {
        margin: 0;
        color: #86868b;
    }

    /* Notification Cards */
    .notifications-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .notification-card {
        display: flex;
        align-items: flex-start;
        gap: 16px;
        padding: 20px;
        background: white;
        border: none;
        border-radius: 16px;
        text-align: left;
        cursor: pointer;
        transition: all 0.2s;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
        width: 100%;
    }

    .notification-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
    }

    .notification-card.unread {
        background: linear-gradient(135deg, rgba(0, 122, 255, 0.03) 0%, rgba(0, 122, 255, 0.08) 100%);
        border-left: 4px solid #007aff;
    }

    .notification-card.urgent {
        background: linear-gradient(135deg, rgba(255, 59, 48, 0.03) 0%, rgba(255, 59, 48, 0.08) 100%);
        border-left: 4px solid #ff3b30;
    }

    .card-icon {
        width: 48px;
        height: 48px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }

    .card-content {
        flex: 1;
        min-width: 0;
    }

    .card-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 6px;
    }

    .card-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1d1d1f;
    }

    .unread-badge {
        padding: 3px 8px;
        background: #007aff;
        color: white;
        font-size: 11px;
        font-weight: 600;
        border-radius: 6px;
    }

    .card-body {
        margin: 0 0 10px;
        font-size: 14px;
        color: #86868b;
        line-height: 1.5;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }

    .card-meta {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .meta-time {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        color: #aeaeb2;
    }

    .meta-priority {
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
    }

    .meta-priority.urgent {
        background: rgba(255, 59, 48, 0.1);
        color: #ff3b30;
    }

    .meta-priority.high {
        background: rgba(255, 149, 0, 0.1);
        color: #ff9500;
    }

    .card-arrow {
        color: #c7c7cc;
        flex-shrink: 0;
    }

    /* Modal */
    .modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        z-index: 1000;
    }

    .modal-container {
        width: 100%;
        max-width: 560px;
        max-height: 90vh;
        background: white;
        border-radius: 24px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 24px;
        border-bottom: 1px solid #f0f0f0;
    }

    .modal-icon {
        width: 56px;
        height: 56px;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .modal-close {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #f5f5f7;
        border: none;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #86868b;
    }

    .modal-body {
        padding: 24px;
        overflow-y: auto;
        flex: 1;
    }

    .modal-body h2 {
        margin: 0 0 12px;
        font-size: 24px;
        font-weight: 700;
        color: #1d1d1f;
    }

    .modal-meta {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        font-size: 14px;
        color: #86868b;
    }

    .modal-meta span {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .priority-tag {
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        text-transform: capitalize;
    }

    .priority-tag.urgent {
        background: rgba(255, 59, 48, 0.1);
        color: #ff3b30;
    }

    .priority-tag.high {
        background: rgba(255, 149, 0, 0.1);
        color: #ff9500;
    }

    .priority-tag.normal {
        background: rgba(0, 122, 255, 0.1);
        color: #007aff;
    }

    .modal-content {
        font-size: 16px;
        line-height: 1.7;
        color: #1d1d1f;
    }

    .modal-content p {
        margin: 0 0 16px;
    }

    .modal-image {
        margin-top: 20px;
        border-radius: 12px;
        overflow: hidden;
    }

    .modal-image img {
        width: 100%;
        display: block;
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 20px 24px;
        border-top: 1px solid #f0f0f0;
    }

    .modal-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 24px;
        border-radius: 12px;
        font-size: 15px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
    }

    .modal-btn.secondary {
        background: #f5f5f7;
        color: #1d1d1f;
        border: none;
    }

    .modal-btn.secondary:hover {
        background: #e5e5e7;
    }

    .modal-btn.primary {
        background: #007aff;
        color: white;
        border: none;
    }

    .modal-btn.primary:hover {
        background: #0066d6;
    }

    /* Mobile Responsive */
    @media (max-width: 768px) {
        .page-header {
            padding: 16px 20px;
        }

        .header-title h1 {
            font-size: 20px;
        }

        .action-btn span {
            display: none;
        }

        .action-btn {
            padding: 10px;
        }

        .filters-section {
            padding: 12px 16px;
        }

        .content-section {
            padding: 12px 16px 100px;
        }

        .notification-card {
            padding: 16px;
        }

        .card-icon {
            width: 44px;
            height: 44px;
        }
    }

    @media (max-width: 480px) {
        .permission-banner {
            flex-direction: column;
            gap: 16px;
            text-align: center;
        }

        .banner-content {
            flex-direction: column;
            gap: 12px;
        }

        .modal-container {
            max-height: 100vh;
            border-radius: 20px 20px 0 0;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
        }

        .modal-overlay {
            align-items: flex-end;
            padding: 0;
        }
    }
</style>
