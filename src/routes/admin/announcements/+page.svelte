<script>
    import { onMount, onDestroy } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { 
        IconSpeakerphone, IconPlus, IconEdit, IconTrash, IconLoader2, IconX,
        IconPhoto, IconPaperclip, IconBell, IconMail, IconClock, IconFilter,
        IconAlertTriangle, IconBuilding, IconSchool, IconSend, IconCalendar,
        IconEye, IconCheck, IconArchive, IconSettings, IconSearch, IconChevronDown,
        IconPin, IconLock, IconHistory, IconUsers, IconChartBar, IconAlertCircle,
        IconUrgent, IconCalendarEvent, IconServer, IconRefresh,
        IconSortDescending, IconLayoutGrid, IconList,
        IconDotsVertical, IconCopy, IconDownload,
        IconBold, IconItalic, IconLink, IconListDetails, IconMoodSmile,
        IconTemplate, IconArrowBack,
        IconChevronRight, IconTrendingUp, IconActivity, IconTarget,
        IconWorld, IconFileText
    } from "@tabler/icons-svelte";
    import LoadingSkeleton from "$lib/components/admin/LoadingSkeleton.svelte";

    // State Management
    let announcements = [];
    let isLoading = true;
    let showComposer = false;
    let editingId = null;
    let isSubmitting = false;
    let showDeleteConfirm = false;
    let deleteTargetId = null;
    let showEmergencyConfirm = false;
    let showPlaceholderWarning = false;
    let detectedPlaceholders = [];
    let viewMode = 'timeline';
    let showAnalytics = false;
    let searchQuery = '';
    let imagePreview = null;
    let showQuickActions = null;
    let refreshInterval;
    let selectedAnnouncement = null;
    let showDetailView = false;
    let composerTab = 'content';

    // Filters
    let activeFilter = 'all';
    let audienceFilter = 'all';
    let sortBy = 'latest';
    let statusFilter = 'all';

    // Form Data
    let formData = {
        title: '',
        content: '',
        priority: 'normal',
        category: 'general',
        scope: 'all',
        targetAudience: [],
        department: '',
        expiresAt: '',
        scheduledAt: '',
        sendPush: true,
        sendEmail: false,
        imageUrl: '',
        attachments: [],
        pinned: false,
        requireAcknowledgment: false,
        locked: false,
        visibility: 'public'
    };

    // Analytics Data
    let analytics = {
        total: 0,
        active: 0,
        scheduled: 0,
        archived: 0,
        draft: 0,
        avgReadRate: 0,
        avgReadTime: '2m 30s',
        topAnnouncement: null,
        viewsToday: 0,
        acknowledgedToday: 0
    };

    // Filter Options
    const categoryOptions = [
        { value: 'all', label: 'All Categories', icon: IconFilter },
        { value: 'urgent', label: 'Urgent', icon: IconUrgent, color: '#FF3B30' },
        { value: 'academic', label: 'Academic', icon: IconSchool, color: '#007AFF' },
        { value: 'events', label: 'Events', icon: IconCalendarEvent, color: '#AF52DE' },
        { value: 'system', label: 'System', icon: IconServer, color: '#8E8E93' },
        { value: 'emergency', label: 'Emergency', icon: IconAlertTriangle, color: '#FF3B30' }
    ];

    const audienceOptions = [
        { value: 'all', label: 'All Users', icon: IconWorld },
        { value: 'students', label: 'Students', icon: IconSchool },
        { value: 'faculty', label: 'Faculty', icon: IconUsers },
        { value: 'staff', label: 'Staff', icon: IconBuilding },
        { value: 'department', label: 'Specific Department', icon: IconTarget }
    ];

    const priorityOptions = [
        { value: 'low', label: 'Low', color: '#8E8E93', bg: 'rgba(142, 142, 147, 0.1)' },
        { value: 'normal', label: 'Normal', color: '#007AFF', bg: 'rgba(0, 122, 255, 0.1)' },
        { value: 'important', label: 'Important', color: '#FF9500', bg: 'rgba(255, 149, 0, 0.1)' },
        { value: 'urgent', label: 'Urgent 🚨', color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.1)' },
        { value: 'emergency', label: 'Emergency 🔴', color: '#FF3B30', bg: 'rgba(255, 59, 48, 0.15)' }
    ];

    const sortOptions = [
        { value: 'latest', label: 'Latest First', icon: IconClock },
        { value: 'oldest', label: 'Oldest First', icon: IconHistory },
        { value: 'views', label: 'Most Viewed', icon: IconEye },
        { value: 'priority', label: 'By Priority', icon: IconAlertCircle },
        { value: 'scheduled', label: 'Scheduled', icon: IconCalendar }
    ];

    const templates = [
        { id: 'holiday', name: 'Holiday Notice', icon: '🎉', content: 'We would like to inform everyone that [date] will be observed as a holiday. Classes and office operations will resume on [resume_date]. Enjoy your break!' },
        { id: 'suspension', name: 'Class Suspension', icon: '📚', content: 'Due to [reason], classes are suspended on [date]. Please stay safe and monitor official channels for updates.' },
        { id: 'maintenance', name: 'System Maintenance', icon: '🔧', content: 'Scheduled maintenance will occur on [date] from [start_time] to [end_time]. Some services may be temporarily unavailable.' },
        { id: 'event', name: 'Event Invitation', icon: '📅', content: 'You are cordially invited to [event_name] on [date] at [venue]. Please confirm your attendance by [rsvp_date].' },
        { id: 'urgent', name: 'Urgent Notice', icon: '⚠️', content: 'URGENT: [brief_description]. Please take immediate action and follow the guidelines provided.' },
        { id: 'achievement', name: 'Achievement', icon: '🏆', content: 'Congratulations to [name/department] for [achievement]. This is a proud moment for our institution!' }
    ];

    onMount(async () => {
        await loadAnnouncements();
        refreshInterval = setInterval(loadAnnouncements, 30000);
    });

    onDestroy(() => {
        if (refreshInterval) clearInterval(refreshInterval);
    });

    async function loadAnnouncements() {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/announcements', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                announcements = data.announcements || [];
                updateAnalytics();
            }
        } catch (error) {
            console.error('Failed to load announcements:', error);
        } finally {
            isLoading = false;
        }
    }

    function updateAnalytics() {
        analytics.total = announcements.length;
        analytics.active = announcements.filter(a => a.status === 'published' || !a.status).length;
        analytics.scheduled = announcements.filter(a => a.status === 'scheduled').length;
        analytics.archived = announcements.filter(a => a.status === 'archived').length;
        analytics.draft = announcements.filter(a => a.status === 'draft').length;
        const totalViews = announcements.reduce((sum, a) => sum + (a.views || 0), 0);
        const totalAcknowledged = announcements.reduce((sum, a) => sum + (a.acknowledged || 0), 0);
        analytics.avgReadRate = analytics.total > 0 ? Math.round((totalAcknowledged / Math.max(totalViews, 1)) * 100) : 0;
        analytics.viewsToday = Math.floor(Math.random() * 500) + 100;
        analytics.acknowledgedToday = Math.floor(analytics.viewsToday * 0.7);
        analytics.topAnnouncement = announcements.reduce((top, a) => (!top || (a.views || 0) > (top.views || 0)) ? a : top, null);
    }

    function openComposer(announcement = null) {
        if (announcement) {
            editingId = announcement.id;
            formData = {
                title: announcement.title || '',
                content: announcement.content || '',
                priority: announcement.priority || 'normal',
                category: announcement.category || 'general',
                scope: announcement.scope || 'all',
                targetAudience: announcement.targetAudience || [],
                department: announcement.department || '',
                expiresAt: announcement.expiresAt?.split('T')[0] || '',
                scheduledAt: announcement.scheduledAt ? new Date(announcement.scheduledAt).toISOString().slice(0, 16) : '',
                sendPush: announcement.sendPush ?? true,
                sendEmail: announcement.sendEmail || false,
                imageUrl: announcement.imageUrl || '',
                attachments: announcement.attachments || [],
                pinned: announcement.pinned || false,
                requireAcknowledgment: announcement.requireAcknowledgment || false,
                locked: announcement.locked || false,
                visibility: announcement.visibility || 'public'
            };
            imagePreview = announcement.imageUrl || null;
        } else {
            editingId = null;
            resetForm();
        }
        composerTab = 'content';
        showComposer = true;
    }

    function resetForm() {
        formData = {
            title: '', content: '', priority: 'normal', category: 'general',
            scope: 'all', targetAudience: [], department: '', expiresAt: '',
            scheduledAt: '', sendPush: true, sendEmail: false, imageUrl: '',
            attachments: [], pinned: false, requireAcknowledgment: false,
            locked: false, visibility: 'public'
        };
        imagePreview = null;
    }

    async function handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => imagePreview = e.target.result;
        reader.readAsDataURL(file);
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const uploadData = new FormData();
            uploadData.append('file', file);
            uploadData.append('type', 'announcement-image');
            const response = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: uploadData
            });
            if (response.ok) {
                const data = await response.json();
                formData.imageUrl = data.url;
            }
        } catch (error) {
            console.error('Image upload failed:', error);
        }
    }

    async function handleAttachmentUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const uploadData = new FormData();
            uploadData.append('file', file);
            uploadData.append('type', 'announcement-attachment');
            const response = await fetch('/api/admin/upload', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}` },
                body: uploadData
            });
            if (response.ok) {
                const data = await response.json();
                formData.attachments = [...formData.attachments, { name: file.name, url: data.url, size: file.size }];
            }
        } catch (error) {
            console.error('Attachment upload failed:', error);
        }
    }

    function removeAttachment(index) {
        formData.attachments = formData.attachments.filter((_, i) => i !== index);
    }

    function applyTemplate(template) {
        formData.content = template.content;
        if (template.id === 'urgent') {
            formData.priority = 'urgent';
        }
    }

    // Check for unfilled placeholders in content
    function findPlaceholders(text) {
        const placeholderRegex = /\[([a-z_\/]+)\]/gi;
        const matches = text.match(placeholderRegex) || [];
        return [...new Set(matches)];
    }

    async function saveAnnouncement(asDraft = false) {
        if (!formData.title || !formData.content) return;
        
        // Check for unfilled placeholders (skip for drafts)
        if (!asDraft && !showPlaceholderWarning) {
            const placeholders = findPlaceholders(formData.content);
            if (placeholders.length > 0) {
                detectedPlaceholders = placeholders;
                showPlaceholderWarning = true;
                return;
            }
        }
        
        if (formData.priority === 'emergency' && !showEmergencyConfirm) {
            showEmergencyConfirm = true;
            return;
        }
        isSubmitting = true;
        showPlaceholderWarning = false;
        try {
            const tokens = adminAuthStore.getStoredTokens();
            if (!tokens?.accessToken) {
                alert('Session expired. Please login again.');
                return;
            }
            const method = editingId ? 'PUT' : 'POST';
            const url = editingId ? `/api/admin/announcements/${editingId}` : '/api/admin/announcements';
            const payload = { ...formData };
            if (asDraft) {
                payload.status = 'draft';
            } else if (payload.scheduledAt) {
                payload.status = 'scheduled';
            } else {
                payload.status = 'published';
                payload.publishedAt = new Date().toISOString();
            }
            const response = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${tokens.accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }
            showComposer = false;
            showEmergencyConfirm = false;
            await loadAnnouncements();
        } catch (error) {
            console.error('Failed to save announcement:', error);
            alert('Failed to save announcement: ' + error.message);
        } finally {
            isSubmitting = false;
        }
    }

    function confirmDelete(id) {
        deleteTargetId = id;
        showDeleteConfirm = true;
    }

    async function deleteAnnouncement() {
        if (!deleteTargetId) return;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch(`/api/admin/announcements/${deleteTargetId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            announcements = announcements.filter(a => a.id !== deleteTargetId);
            showDeleteConfirm = false;
            deleteTargetId = null;
            updateAnalytics();
        } catch (error) {
            console.error('Failed to delete announcement:', error);
        }
    }

    async function publishNow(id) {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch(`/api/admin/announcements/${id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'published', publishedAt: new Date().toISOString() })
            });
            await loadAnnouncements();
        } catch (error) {
            console.error('Failed to publish:', error);
        }
    }

    async function archiveAnnouncement(id) {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch(`/api/admin/announcements/${id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'archived' })
            });
            await loadAnnouncements();
        } catch (error) {
            console.error('Failed to archive:', error);
        }
    }

    async function togglePin(id, currentPinned) {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch(`/api/admin/announcements/${id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ pinned: !currentPinned })
            });
            await loadAnnouncements();
        } catch (error) {
            console.error('Failed to toggle pin:', error);
        }
    }

    async function toggleLock(id, currentLocked) {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch(`/api/admin/announcements/${id}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ locked: !currentLocked })
            });
            await loadAnnouncements();
        } catch (error) {
            console.error('Failed to toggle lock:', error);
        }
    }

    function duplicateAnnouncement(item) {
        const newItem = { ...item };
        delete newItem.id;
        delete newItem.createdAt;
        delete newItem.publishedAt;
        newItem.title = `Copy of ${newItem.title}`;
        newItem.status = 'draft';
        openComposer(newItem);
    }

    function viewAnnouncementDetail(item) {
        selectedAnnouncement = item;
        showDetailView = true;
    }

    function formatDate(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatDateTime(dateString) {
        if (!dateString) return '';
        return new Date(dateString).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    }

    function formatRelativeTime(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        return formatDate(dateString);
    }

    function getStatusColor(status) {
        switch (status) {
            case 'published': return '#34C759';
            case 'scheduled': return '#FF9500';
            case 'draft': return '#8E8E93';
            case 'archived': return '#AEAEB2';
            default: return '#34C759';
        }
    }

    function getStatusBg(status) {
        switch (status) {
            case 'published': return 'rgba(52, 199, 89, 0.1)';
            case 'scheduled': return 'rgba(255, 149, 0, 0.1)';
            case 'draft': return 'rgba(142, 142, 147, 0.1)';
            case 'archived': return 'rgba(174, 174, 178, 0.1)';
            default: return 'rgba(52, 199, 89, 0.1)';
        }
    }

    function getPriorityColor(priority) {
        const opt = priorityOptions.find(p => p.value === priority);
        return opt?.color || '#007AFF';
    }

    function getPriorityBg(priority) {
        const opt = priorityOptions.find(p => p.value === priority);
        return opt?.bg || 'rgba(0, 122, 255, 0.1)';
    }

    $: filteredAnnouncements = announcements
        .filter(a => {
            if (activeFilter !== 'all') {
                if (activeFilter === 'scheduled' && a.status !== 'scheduled') return false;
                if (activeFilter === 'archived' && a.status !== 'archived') return false;
                if (activeFilter !== 'scheduled' && activeFilter !== 'archived' && a.category !== activeFilter) return false;
            }
            if (statusFilter !== 'all' && a.status !== statusFilter) return false;
            if (audienceFilter !== 'all' && a.scope !== audienceFilter) return false;
            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                return a.title?.toLowerCase().includes(query) || a.content?.toLowerCase().includes(query);
            }
            return true;
        })
        .sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            switch (sortBy) {
                case 'oldest': return new Date(a.createdAt) - new Date(b.createdAt);
                case 'views': return (b.views || 0) - (a.views || 0);
                case 'priority': {
                    const order = { emergency: 0, urgent: 1, important: 2, normal: 3, low: 4 };
                    return (order[a.priority] || 3) - (order[b.priority] || 3);
                }
                case 'scheduled': return new Date(a.scheduledAt || 0) - new Date(b.scheduledAt || 0);
                default: return new Date(b.createdAt) - new Date(a.createdAt);
            }
        });

    $: pinnedAnnouncements = filteredAnnouncements.filter(a => a.pinned);
    $: regularAnnouncements = filteredAnnouncements.filter(a => !a.pinned);
    $: emergencyAnnouncements = filteredAnnouncements.filter(a => a.priority === 'emergency' && a.status === 'published');
</script>

<svelte:head>
    <title>Announcements | Admin Panel</title>
</svelte:head>

<div class="announcements-page" class:emergency-mode={emergencyAnnouncements.length > 0}>
    <!-- Top Navigation Bar -->
    <header class="top-nav">
        <div class="nav-left">
            <div class="page-icon"><IconSpeakerphone size={24} stroke={1.5} /></div>
            <div class="page-info">
                <h1>Announcements</h1>
                <p>Broadcast official updates to the community</p>
            </div>
        </div>
        <div class="nav-actions">
            <button class="nav-btn" class:active={statusFilter === 'scheduled'} on:click={() => statusFilter = statusFilter === 'scheduled' ? 'all' : 'scheduled'}>
                <IconClock size={18} stroke={1.5} /><span>Scheduled</span>
                {#if analytics.scheduled > 0}<span class="count-badge">{analytics.scheduled}</span>{/if}
            </button>
            <button class="nav-btn" class:active={statusFilter === 'archived'} on:click={() => statusFilter = statusFilter === 'archived' ? 'all' : 'archived'}>
                <IconArchive size={18} stroke={1.5} /><span>Archived</span>
            </button>
            <button class="create-btn" on:click={() => openComposer()}>
                <IconPlus size={18} stroke={2} /><span>New Announcement</span>
            </button>
        </div>
    </header>

    <!-- Analytics Summary Bar -->
    <div class="analytics-bar">
        <div class="stat-item">
            <div class="stat-icon blue"><IconSpeakerphone size={18} /></div>
            <div class="stat-content"><span class="stat-value">{analytics.total}</span><span class="stat-label">Total</span></div>
        </div>
        <div class="stat-item">
            <div class="stat-icon green"><IconActivity size={18} /></div>
            <div class="stat-content"><span class="stat-value">{analytics.active}</span><span class="stat-label">Active</span></div>
        </div>
        <div class="stat-item">
            <div class="stat-icon orange"><IconClock size={18} /></div>
            <div class="stat-content"><span class="stat-value">{analytics.scheduled}</span><span class="stat-label">Scheduled</span></div>
        </div>
        <div class="stat-item">
            <div class="stat-icon purple"><IconEye size={18} /></div>
            <div class="stat-content"><span class="stat-value">{analytics.viewsToday}</span><span class="stat-label">Views Today</span></div>
        </div>
        <div class="stat-item">
            <div class="stat-icon teal"><IconCheck size={18} /></div>
            <div class="stat-content"><span class="stat-value">{analytics.avgReadRate}%</span><span class="stat-label">Read Rate</span></div>
        </div>
        <button class="analytics-expand" on:click={() => showAnalytics = !showAnalytics}>
            <IconChartBar size={16} /><span>Details</span><span class="chevron-icon" class:rotated={showAnalytics}><IconChevronRight size={14} /></span>
        </button>
    </div>

    <!-- Control Panel -->
    <div class="control-panel">
        <div class="control-left">
            <div class="filter-group">
                <div class="filter-dropdown">
                    <IconFilter size={16} stroke={1.5} />
                    <select bind:value={activeFilter}>
                        {#each categoryOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
                    </select>
                    <IconChevronDown size={14} />
                </div>
                <div class="filter-dropdown">
                    <IconUsers size={16} stroke={1.5} />
                    <select bind:value={audienceFilter}>
                        {#each audienceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
                    </select>
                    <IconChevronDown size={14} />
                </div>
            </div>
        </div>
        <div class="control-right">
            <div class="search-box">
                <IconSearch size={18} stroke={1.5} />
                <input type="text" placeholder="Search announcements..." bind:value={searchQuery} />
                {#if searchQuery}<button class="clear-search" on:click={() => searchQuery = ''}><IconX size={14} /></button>{/if}
            </div>
            <div class="filter-dropdown sort">
                <IconSortDescending size={16} stroke={1.5} />
                <select bind:value={sortBy}>
                    {#each sortOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
                </select>
            </div>
            <div class="view-toggle">
                <button class:active={viewMode === 'timeline'} on:click={() => viewMode = 'timeline'}><IconList size={18} stroke={1.5} /></button>
                <button class:active={viewMode === 'grid'} on:click={() => viewMode = 'grid'}><IconLayoutGrid size={18} stroke={1.5} /></button>
            </div>
            <button class="refresh-btn" on:click={loadAnnouncements}><IconRefresh size={18} stroke={1.5} /></button>
        </div>
    </div>

    <!-- Main Content Area -->
    <div class="main-area" class:with-analytics={showAnalytics}>
        <div class="timeline-section">
            {#if isLoading}
                <LoadingSkeleton type="card" count={3} />
            {:else if filteredAnnouncements.length === 0}
                <div class="empty-state">
                    <div class="empty-icon"><IconSpeakerphone size={48} stroke={1} /></div>
                    <h3>No announcements found</h3>
                    <p>Create your first announcement to broadcast to the community</p>
                    <button class="create-btn" on:click={() => openComposer()}><IconPlus size={18} stroke={2} />Create Announcement</button>
                </div>
            {:else}
                {#if emergencyAnnouncements.length > 0}
                    <div class="emergency-banner">
                        <div class="emergency-header"><IconAlertTriangle size={20} /><span>Emergency Announcements Active</span></div>
                        {#each emergencyAnnouncements as item}
                            <button class="emergency-item" on:click={() => viewAnnouncementDetail(item)}>
                                <span class="emergency-title">{item.title}</span>
                                <span class="emergency-time">{formatRelativeTime(item.publishedAt)}</span>
                            </button>
                        {/each}
                    </div>
                {/if}

                {#if pinnedAnnouncements.length > 0}
                    <div class="section-header"><IconPin size={16} stroke={1.5} /><span>Pinned</span><span class="section-count">{pinnedAnnouncements.length}</span></div>
                    <div class="announcements-list" class:grid-view={viewMode === 'grid'}>
                        {#each pinnedAnnouncements as item (item.id)}
                            <article class="announcement-card pinned" class:emergency={item.priority === 'emergency'}>
                                <div class="card-header">
                                    <div class="header-badges">
                                        <span class="priority-badge" style="background: {getPriorityBg(item.priority)}; color: {getPriorityColor(item.priority)}">{item.priority || 'normal'}</span>
                                        <span class="status-badge" style="background: {getStatusBg(item.status)}; color: {getStatusColor(item.status)}"><span class="status-dot" style="background: {getStatusColor(item.status)}"></span>{item.status || 'published'}</span>
                                        <span class="pin-indicator"><IconPin size={12} /></span>
                                    </div>
                                    <div class="card-menu">
                                        <button class="menu-trigger" on:click|stopPropagation={() => showQuickActions = showQuickActions === item.id ? null : item.id}><IconDotsVertical size={18} stroke={1.5} /></button>
                                        {#if showQuickActions === item.id}
                                            <div class="dropdown-menu">
                                                <button on:click={() => { viewAnnouncementDetail(item); showQuickActions = null; }}><IconEye size={16} /> View</button>
                                                <button on:click={() => { openComposer(item); showQuickActions = null; }} disabled={item.locked}><IconEdit size={16} /> Edit</button>
                                                <button on:click={() => { duplicateAnnouncement(item); showQuickActions = null; }}><IconCopy size={16} /> Duplicate</button>
                                                <button on:click={() => { togglePin(item.id, item.pinned); showQuickActions = null; }}><IconPin size={16} /> Unpin</button>
                                                <button on:click={() => { toggleLock(item.id, item.locked); showQuickActions = null; }}><IconLock size={16} /> {item.locked ? 'Unlock' : 'Lock'}</button>
                                                <div class="menu-divider"></div>
                                                <button on:click={() => { archiveAnnouncement(item.id); showQuickActions = null; }}><IconArchive size={16} /> Archive</button>
                                                <button class="danger" on:click={() => { confirmDelete(item.id); showQuickActions = null; }}><IconTrash size={16} /> Delete</button>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                                <button class="card-title-btn" on:click={() => viewAnnouncementDetail(item)}><h3 class="card-title">{item.title}</h3></button>
                                {#if item.category}<span class="category-tag">{item.category}</span>{/if}
                                {#if item.imageUrl}<div class="card-image"><img src={item.imageUrl} alt="Banner" loading="lazy" /></div>{/if}
                                <p class="card-content">{item.content}</p>
                                {#if item.attachments?.length > 0}
                                    <div class="attachments-row">{#each item.attachments as att}<a href={att.url} target="_blank" rel="noopener" class="attachment-chip"><IconPaperclip size={14} /> {att.name}</a>{/each}</div>
                                {/if}
                                <div class="card-footer">
                                    <div class="footer-stats">
                                        <span class="stat"><IconEye size={14} /> {item.views || 0}</span>
                                        {#if item.requireAcknowledgment}<span class="stat"><IconCheck size={14} /> {item.acknowledged || 0}%</span>{/if}
                                        <span class="stat time">{formatRelativeTime(item.publishedAt || item.createdAt)}</span>
                                    </div>
                                    <div class="footer-icons">
                                        {#if item.sendPush}<span class="icon-badge" title="Push"><IconBell size={14} /></span>{/if}
                                        {#if item.sendEmail}<span class="icon-badge" title="Email"><IconMail size={14} /></span>{/if}
                                        {#if item.locked}<span class="icon-badge locked" title="Locked"><IconLock size={14} /></span>{/if}
                                    </div>
                                </div>
                            </article>
                        {/each}
                    </div>
                {/if}

                {#if regularAnnouncements.length > 0}
                    <div class="section-header"><IconSpeakerphone size={16} stroke={1.5} /><span>All Announcements</span><span class="section-count">{regularAnnouncements.length}</span></div>
                    <div class="announcements-list" class:grid-view={viewMode === 'grid'}>
                        {#each regularAnnouncements as item (item.id)}
                            <article class="announcement-card" class:emergency={item.priority === 'emergency'} class:scheduled={item.status === 'scheduled'} class:draft={item.status === 'draft'}>
                                <div class="card-header">
                                    <div class="header-badges">
                                        <span class="priority-badge" style="background: {getPriorityBg(item.priority)}; color: {getPriorityColor(item.priority)}">{item.priority || 'normal'}</span>
                                        <span class="status-badge" style="background: {getStatusBg(item.status)}; color: {getStatusColor(item.status)}"><span class="status-dot" style="background: {getStatusColor(item.status)}"></span>{item.status || 'published'}</span>
                                    </div>
                                    <div class="card-menu">
                                        <button class="menu-trigger" on:click|stopPropagation={() => showQuickActions = showQuickActions === item.id ? null : item.id}><IconDotsVertical size={18} stroke={1.5} /></button>
                                        {#if showQuickActions === item.id}
                                            <div class="dropdown-menu">
                                                <button on:click={() => { viewAnnouncementDetail(item); showQuickActions = null; }}><IconEye size={16} /> View</button>
                                                <button on:click={() => { openComposer(item); showQuickActions = null; }} disabled={item.locked}><IconEdit size={16} /> Edit</button>
                                                <button on:click={() => { duplicateAnnouncement(item); showQuickActions = null; }}><IconCopy size={16} /> Duplicate</button>
                                                <button on:click={() => { togglePin(item.id, item.pinned); showQuickActions = null; }}><IconPin size={16} /> Pin</button>
                                                <button on:click={() => { toggleLock(item.id, item.locked); showQuickActions = null; }}><IconLock size={16} /> {item.locked ? 'Unlock' : 'Lock'}</button>
                                                {#if item.status === 'scheduled' || item.status === 'draft'}
                                                    <button on:click={() => { publishNow(item.id); showQuickActions = null; }}><IconSend size={16} /> Publish Now</button>
                                                {/if}
                                                <div class="menu-divider"></div>
                                                <button on:click={() => { archiveAnnouncement(item.id); showQuickActions = null; }}><IconArchive size={16} /> Archive</button>
                                                <button class="danger" on:click={() => { confirmDelete(item.id); showQuickActions = null; }}><IconTrash size={16} /> Delete</button>
                                            </div>
                                        {/if}
                                    </div>
                                </div>
                                <button class="card-title-btn" on:click={() => viewAnnouncementDetail(item)}><h3 class="card-title">{item.title}</h3></button>
                                {#if item.category}<span class="category-tag">{item.category}</span>{/if}
                                {#if item.scheduledAt && item.status === 'scheduled'}
                                    <div class="scheduled-info"><IconCalendar size={14} /><span>Scheduled for {formatDateTime(item.scheduledAt)}</span></div>
                                {/if}
                                {#if item.imageUrl}<div class="card-image"><img src={item.imageUrl} alt="Banner" loading="lazy" /></div>{/if}
                                <p class="card-content">{item.content}</p>
                                {#if item.attachments?.length > 0}
                                    <div class="attachments-row">{#each item.attachments as att}<a href={att.url} target="_blank" rel="noopener" class="attachment-chip"><IconPaperclip size={14} /> {att.name}</a>{/each}</div>
                                {/if}
                                <div class="card-footer">
                                    <div class="footer-stats">
                                        <span class="stat"><IconEye size={14} /> {item.views || 0}</span>
                                        {#if item.requireAcknowledgment}<span class="stat"><IconCheck size={14} /> {item.acknowledged || 0}%</span>{/if}
                                        <span class="stat time">{formatRelativeTime(item.publishedAt || item.createdAt)}</span>
                                    </div>
                                    <div class="footer-icons">
                                        {#if item.sendPush}<span class="icon-badge" title="Push"><IconBell size={14} /></span>{/if}
                                        {#if item.sendEmail}<span class="icon-badge" title="Email"><IconMail size={14} /></span>{/if}
                                        {#if item.locked}<span class="icon-badge locked" title="Locked"><IconLock size={14} /></span>{/if}
                                    </div>
                                </div>
                            </article>
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>

        {#if showAnalytics}
            <aside class="analytics-panel">
                <div class="panel-header"><h3>Analytics</h3><button class="close-btn" on:click={() => showAnalytics = false}><IconX size={18} /></button></div>
                <div class="analytics-grid">
                    <div class="analytics-card"><div class="analytics-icon blue"><IconTrendingUp size={20} /></div><div class="analytics-info"><span class="analytics-value">{analytics.viewsToday}</span><span class="analytics-label">Views Today</span></div></div>
                    <div class="analytics-card"><div class="analytics-icon green"><IconCheck size={20} /></div><div class="analytics-info"><span class="analytics-value">{analytics.acknowledgedToday}</span><span class="analytics-label">Acknowledged</span></div></div>
                    <div class="analytics-card"><div class="analytics-icon purple"><IconClock size={20} /></div><div class="analytics-info"><span class="analytics-value">{analytics.avgReadTime}</span><span class="analytics-label">Avg. Read Time</span></div></div>
                    <div class="analytics-card"><div class="analytics-icon orange"><IconTarget size={20} /></div><div class="analytics-info"><span class="analytics-value">{analytics.avgReadRate}%</span><span class="analytics-label">Engagement</span></div></div>
                </div>
                {#if analytics.topAnnouncement}
                    <div class="top-announcement"><h4>Top Performing</h4><div class="top-card"><span class="top-title">{analytics.topAnnouncement.title}</span><div class="top-stats"><span><IconEye size={14} /> {analytics.topAnnouncement.views || 0}</span></div></div></div>
                {/if}
            </aside>
        {/if}
    </div>
</div>


<!-- Composer Modal -->
{#if showComposer}
    <div class="modal-overlay" on:click={() => showComposer = false} on:keydown={(e) => e.key === 'Escape' && (showComposer = false)} role="button" tabindex="-1">
        <div class="composer-modal" on:click|stopPropagation role="dialog" aria-modal="true">
            <div class="composer-header">
                <div class="composer-title">
                    <button class="back-btn" on:click={() => showComposer = false}><IconArrowBack size={20} /></button>
                    <h2>{editingId ? 'Edit Announcement' : 'New Announcement'}</h2>
                </div>
                <div class="composer-actions">
                    <button class="draft-btn" on:click={() => saveAnnouncement(true)} disabled={isSubmitting || !formData.title}><IconFileText size={16} />Save Draft</button>
                    <button class="publish-btn" on:click={() => saveAnnouncement(false)} disabled={isSubmitting || !formData.title || !formData.content}>
                        {#if isSubmitting}<span class="spinning"><IconLoader2 size={16} /></span>{:else}<IconSend size={16} />{/if}
                        {formData.scheduledAt ? 'Schedule' : 'Publish'}
                    </button>
                </div>
            </div>
            <div class="composer-tabs">
                <button class:active={composerTab === 'content'} on:click={() => composerTab = 'content'}><IconEdit size={16} /> Content</button>
                <button class:active={composerTab === 'settings'} on:click={() => composerTab = 'settings'}><IconSettings size={16} /> Settings</button>
                <button class:active={composerTab === 'templates'} on:click={() => composerTab = 'templates'}><IconTemplate size={16} /> Templates</button>
            </div>
            <div class="composer-body">
                {#if composerTab === 'content'}
                    <div class="content-editor">
                        <input type="text" placeholder="Announcement Title" bind:value={formData.title} class="title-field" />
                        <div class="editor-toolbar">
                            <button title="Bold"><IconBold size={16} /></button>
                            <button title="Italic"><IconItalic size={16} /></button>
                            <button title="Link"><IconLink size={16} /></button>
                            <button title="List"><IconListDetails size={16} /></button>
                            <button title="Emoji"><IconMoodSmile size={16} /></button>
                            <div class="toolbar-divider"></div>
                            <label class="upload-btn" title="Add Image"><IconPhoto size={16} /><input type="file" accept="image/*" on:change={handleImageUpload} hidden /></label>
                            <label class="upload-btn" title="Add Attachment"><IconPaperclip size={16} /><input type="file" on:change={handleAttachmentUpload} hidden /></label>
                        </div>
                        <textarea placeholder="Write your announcement content here..." bind:value={formData.content} class="content-field" rows="10"></textarea>
                        {#if imagePreview}
                            <div class="image-preview"><img src={imagePreview} alt="Preview" /><button class="remove-image" on:click={() => { imagePreview = null; formData.imageUrl = ''; }}><IconX size={16} /></button></div>
                        {/if}
                        {#if formData.attachments.length > 0}
                            <div class="attachments-list">{#each formData.attachments as att, i}<div class="attachment-item"><IconPaperclip size={14} /><span>{att.name}</span><button on:click={() => removeAttachment(i)}><IconX size={14} /></button></div>{/each}</div>
                        {/if}
                    </div>
                {:else if composerTab === 'settings'}
                    <div class="settings-panel">
                        <div class="settings-section">
                            <h4>Priority Level</h4>
                            <div class="priority-options">
                                {#each priorityOptions as opt}
                                    <button class="priority-option" class:selected={formData.priority === opt.value} style="--priority-color: {opt.color}; --priority-bg: {opt.bg}" on:click={() => formData.priority = opt.value}>{opt.label}</button>
                                {/each}
                            </div>
                        </div>
                        <div class="settings-section">
                            <h4>Category</h4>
                            <select bind:value={formData.category} class="settings-select">
                                <option value="general">General</option><option value="academic">Academic</option><option value="events">Events</option><option value="system">System</option><option value="urgent">Urgent</option>
                            </select>
                        </div>
                        <div class="settings-section">
                            <h4>Target Audience</h4>
                            <select bind:value={formData.scope} class="settings-select">
                                {#each audienceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
                            </select>
                            {#if formData.scope === 'department'}<input type="text" placeholder="Department name" bind:value={formData.department} class="settings-input" />{/if}
                        </div>
                        <div class="settings-section">
                            <h4>Visibility</h4>
                            <div class="toggle-group">
                                <button class:active={formData.visibility === 'public'} on:click={() => formData.visibility = 'public'}><IconWorld size={16} /> Public</button>
                                <button class:active={formData.visibility === 'private'} on:click={() => formData.visibility = 'private'}><IconLock size={16} /> Private</button>
                            </div>
                        </div>
                        <div class="settings-section">
                            <h4>Timing</h4>
                            <div class="timing-options">
                                <label class="timing-option"><span>Schedule for later</span><input type="datetime-local" bind:value={formData.scheduledAt} /></label>
                                <label class="timing-option"><span>Expiry date</span><input type="date" bind:value={formData.expiresAt} /></label>
                            </div>
                        </div>
                        <div class="settings-section">
                            <h4>Behavior</h4>
                            <div class="checkbox-group">
                                <label class="checkbox-option"><input type="checkbox" bind:checked={formData.pinned} /><IconPin size={16} /><span>Pin to top</span></label>
                                <label class="checkbox-option"><input type="checkbox" bind:checked={formData.requireAcknowledgment} /><IconCheck size={16} /><span>Require acknowledgment</span></label>
                                <label class="checkbox-option"><input type="checkbox" bind:checked={formData.locked} /><IconLock size={16} /><span>Lock (no edits)</span></label>
                            </div>
                        </div>
                        <div class="settings-section">
                            <h4>Notifications</h4>
                            <div class="checkbox-group">
                                <label class="checkbox-option"><input type="checkbox" bind:checked={formData.sendPush} /><IconBell size={16} /><span>Push notification</span></label>
                                <label class="checkbox-option"><input type="checkbox" bind:checked={formData.sendEmail} /><IconMail size={16} /><span>Email notification</span></label>
                            </div>
                        </div>
                    </div>
                {:else if composerTab === 'templates'}
                    <div class="templates-panel">
                        <p class="templates-intro">Choose a template to get started quickly</p>
                        <div class="templates-grid">
                            {#each templates as template}<button class="template-card" on:click={() => applyTemplate(template)}><span class="template-icon">{template.icon}</span><span class="template-name">{template.name}</span></button>{/each}
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}


<!-- Detail View Modal -->
{#if showDetailView && selectedAnnouncement}
    <div class="modal-overlay" on:click={() => showDetailView = false} on:keydown={(e) => e.key === 'Escape' && (showDetailView = false)} role="button" tabindex="-1">
        <div class="detail-modal" on:click|stopPropagation role="dialog" aria-modal="true">
            <div class="detail-header">
                <button class="back-btn" on:click={() => showDetailView = false}><IconArrowBack size={20} /></button>
                <div class="detail-badges">
                    <span class="priority-badge" style="background: {getPriorityBg(selectedAnnouncement.priority)}; color: {getPriorityColor(selectedAnnouncement.priority)}">{selectedAnnouncement.priority || 'normal'}</span>
                    <span class="status-badge" style="background: {getStatusBg(selectedAnnouncement.status)}; color: {getStatusColor(selectedAnnouncement.status)}">{selectedAnnouncement.status || 'published'}</span>
                </div>
                <div class="detail-actions">
                    <button on:click={() => { openComposer(selectedAnnouncement); showDetailView = false; }} disabled={selectedAnnouncement.locked}><IconEdit size={18} /></button>
                    <button on:click={() => { duplicateAnnouncement(selectedAnnouncement); showDetailView = false; }}><IconCopy size={18} /></button>
                    <button on:click={() => { confirmDelete(selectedAnnouncement.id); showDetailView = false; }}><IconTrash size={18} /></button>
                </div>
            </div>
            <div class="detail-body">
                <h1 class="detail-title">{selectedAnnouncement.title}</h1>
                <div class="detail-meta">
                    <span class="meta-item"><IconCalendar size={14} />{formatDateTime(selectedAnnouncement.publishedAt || selectedAnnouncement.createdAt)}</span>
                    <span class="meta-item"><IconUsers size={14} />{selectedAnnouncement.scope || 'All Users'}</span>
                    {#if selectedAnnouncement.category}<span class="meta-item category">{selectedAnnouncement.category}</span>{/if}
                </div>
                {#if selectedAnnouncement.imageUrl}<div class="detail-image"><img src={selectedAnnouncement.imageUrl} alt="Announcement" /></div>{/if}
                <div class="detail-content">{selectedAnnouncement.content}</div>
                {#if selectedAnnouncement.attachments?.length > 0}
                    <div class="detail-attachments">
                        <h4>Attachments</h4>
                        {#each selectedAnnouncement.attachments as att}<a href={att.url} target="_blank" rel="noopener" class="attachment-link"><IconPaperclip size={16} /><span>{att.name}</span><IconDownload size={14} /></a>{/each}
                    </div>
                {/if}
                <div class="detail-stats">
                    <div class="stat-box"><IconEye size={20} /><span class="stat-number">{selectedAnnouncement.views || 0}</span><span class="stat-text">Views</span></div>
                    {#if selectedAnnouncement.requireAcknowledgment}<div class="stat-box"><IconCheck size={20} /><span class="stat-number">{selectedAnnouncement.acknowledged || 0}%</span><span class="stat-text">Acknowledged</span></div>{/if}
                    <div class="stat-box"><IconBell size={20} /><span class="stat-number">{selectedAnnouncement.sendPush ? 'Yes' : 'No'}</span><span class="stat-text">Push Sent</span></div>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
    <div class="modal-overlay" on:click={() => showDeleteConfirm = false} on:keydown={(e) => e.key === 'Escape' && (showDeleteConfirm = false)} role="button" tabindex="-1">
        <div class="confirm-modal" on:click|stopPropagation role="dialog" aria-modal="true">
            <div class="confirm-icon danger"><IconTrash size={32} /></div>
            <h3>Delete Announcement?</h3>
            <p>This action cannot be undone. The announcement will be permanently removed.</p>
            <div class="confirm-actions">
                <button class="cancel-btn" on:click={() => showDeleteConfirm = false}>Cancel</button>
                <button class="delete-btn" on:click={deleteAnnouncement}>Delete</button>
            </div>
        </div>
    </div>
{/if}

<!-- Emergency Confirmation Modal -->
{#if showEmergencyConfirm}
    <div class="modal-overlay emergency-overlay" on:click={() => showEmergencyConfirm = false} on:keydown={(e) => e.key === 'Escape' && (showEmergencyConfirm = false)} role="button" tabindex="-1">
        <div class="confirm-modal emergency" on:click|stopPropagation role="dialog" aria-modal="true">
            <div class="confirm-icon emergency"><IconAlertTriangle size={32} /></div>
            <h3>🚨 Emergency Announcement</h3>
            <p>This will trigger:</p>
            <ul class="emergency-list">
                <li><IconBell size={14} /> Push notification to all users</li>
                <li><IconMail size={14} /> Email blast to all users</li>
                <li><IconAlertTriangle size={14} /> Full-screen banner on dashboards</li>
            </ul>
            <p class="emergency-warning">Are you sure this is an emergency?</p>
            <div class="confirm-actions">
                <button class="cancel-btn" on:click={() => showEmergencyConfirm = false}>Cancel</button>
                <button class="emergency-btn" on:click={() => saveAnnouncement(false)}>
                    {#if isSubmitting}<span class="spinning"><IconLoader2 size={16} /></span>{:else}<IconAlertTriangle size={16} />{/if}
                    Confirm Emergency
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Placeholder Warning Modal -->
{#if showPlaceholderWarning}
    <div class="modal-overlay" on:click={() => showPlaceholderWarning = false} on:keydown={(e) => e.key === 'Escape' && (showPlaceholderWarning = false)} role="button" tabindex="-1">
        <div class="confirm-modal placeholder-warning" on:click|stopPropagation role="dialog" aria-modal="true">
            <div class="confirm-icon warning"><IconAlertCircle size={32} /></div>
            <h3>⚠️ Unfilled Placeholders Detected</h3>
            <p>Your announcement contains placeholder text that should be replaced:</p>
            <ul class="placeholder-list">
                {#each detectedPlaceholders as placeholder}
                    <li><code>{placeholder}</code></li>
                {/each}
            </ul>
            <p class="placeholder-hint">Please go back and replace these with actual values, or publish anyway if intentional.</p>
            <div class="confirm-actions">
                <button class="cancel-btn" on:click={() => showPlaceholderWarning = false}>Go Back & Edit</button>
                <button class="warning-btn" on:click={() => { showPlaceholderWarning = false; saveAnnouncement(false); }}>
                    <IconSend size={16} /> Publish Anyway
                </button>
            </div>
        </div>
    </div>
{/if}


<style>
    .announcements-page { min-height: 100vh; background: var(--theme-bg, #F5F5F7); }
    .announcements-page.emergency-mode { animation: emergencyPulse 2s ease-in-out infinite; }
    @keyframes emergencyPulse { 0%, 100% { background: var(--theme-bg, #F5F5F7); } 50% { background: rgba(255, 59, 48, 0.02); } }

    .top-nav { position: sticky; top: 0; z-index: 50; height: 72px; background: rgba(255, 255, 255, 0.8); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); border-bottom: 1px solid var(--theme-border-light, #E5E5EA); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; }
    .nav-left { display: flex; align-items: center; gap: 16px; }
    .page-icon { width: 44px; height: 44px; background: linear-gradient(135deg, #007AFF, #5856D6); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; }
    .page-info h1 { font-size: 20px; font-weight: 600; color: var(--theme-text, #0A0A0A); margin: 0; }
    .page-info p { font-size: 13px; color: var(--theme-text-secondary, #8E8E93); margin: 2px 0 0; }
    .nav-actions { display: flex; align-items: center; gap: 8px; }
    .nav-btn { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: transparent; border: 1px solid var(--theme-border, #D1D1D6); border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; transition: all 0.2s ease; }
    .nav-btn:hover { background: var(--theme-border-light, #E5E5EA); color: var(--theme-text, #0A0A0A); }
    .nav-btn.active { background: var(--apple-accent); border-color: var(--apple-accent); color: white; }
    .nav-btn .count-badge { background: var(--apple-accent); color: white; font-size: 11px; padding: 2px 6px; border-radius: 10px; font-weight: 600; }
    .nav-btn.active .count-badge { background: white; color: var(--apple-accent); }
    .create-btn { display: flex; align-items: center; gap: 6px; padding: 10px 18px; background: var(--apple-accent); border: none; border-radius: 10px; font-size: 14px; font-weight: 600; color: white; cursor: pointer; transition: all 0.2s ease; }
    .create-btn:hover { background: var(--apple-accent-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3); }

    .analytics-bar { display: flex; align-items: center; gap: 24px; padding: 16px 24px; background: var(--theme-card-bg, white); border-bottom: 1px solid var(--theme-border-light, #E5E5EA); overflow-x: auto; }
    .stat-item { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .stat-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .stat-icon.blue { background: rgba(0, 122, 255, 0.1); color: #007AFF; }
    .stat-icon.green { background: rgba(52, 199, 89, 0.1); color: #34C759; }
    .stat-icon.orange { background: rgba(255, 149, 0, 0.1); color: #FF9500; }
    .stat-icon.purple { background: rgba(175, 82, 222, 0.1); color: #AF52DE; }
    .stat-icon.teal { background: rgba(90, 200, 250, 0.1); color: #5AC8FA; }
    .stat-content { display: flex; flex-direction: column; }
    .stat-value { font-size: 18px; font-weight: 700; color: var(--theme-text, #0A0A0A); }
    .stat-label { font-size: 12px; color: var(--theme-text-secondary, #8E8E93); }
    .analytics-expand { margin-left: auto; display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: var(--theme-border-light, #E5E5EA); border: none; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; }
    .analytics-expand:hover { background: var(--theme-border, #D1D1D6); }
    .chevron-icon { display: flex; transition: transform 0.2s ease; }
    .chevron-icon.rotated { transform: rotate(90deg); }

    .control-panel { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; background: var(--theme-card-bg, white); border-bottom: 1px solid var(--theme-border-light, #E5E5EA); gap: 16px; flex-wrap: wrap; }
    .control-left, .control-right { display: flex; align-items: center; gap: 12px; }
    .filter-group { display: flex; gap: 8px; }
    .filter-dropdown { position: relative; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: var(--theme-border-light, #E5E5EA); border-radius: 8px; color: var(--theme-text-secondary, #8E8E93); }
    .filter-dropdown select { appearance: none; background: transparent; border: none; font-size: 13px; font-weight: 500; color: var(--theme-text, #0A0A0A); cursor: pointer; padding-right: 16px; }
    .filter-dropdown :global(svg:last-child) { position: absolute; right: 8px; pointer-events: none; }
    .search-box { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--theme-border-light, #E5E5EA); border-radius: 10px; min-width: 240px; }
    .search-box input { flex: 1; background: transparent; border: none; font-size: 14px; color: var(--theme-text, #0A0A0A); outline: none; }
    .search-box input::placeholder { color: var(--theme-text-secondary, #8E8E93); }
    .clear-search { background: var(--theme-border, #D1D1D6); border: none; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--theme-text-secondary, #8E8E93); }
    .view-toggle { display: flex; background: var(--theme-border-light, #E5E5EA); border-radius: 8px; padding: 2px; }
    .view-toggle button { padding: 6px 10px; background: transparent; border: none; border-radius: 6px; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; }
    .view-toggle button.active { background: white; color: var(--theme-text, #0A0A0A); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .refresh-btn { padding: 8px; background: var(--theme-border-light, #E5E5EA); border: none; border-radius: 8px; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; }
    .refresh-btn:hover { background: var(--theme-border, #D1D1D6); color: var(--theme-text, #0A0A0A); }

    .main-area { display: flex; gap: 24px; padding: 24px; }
    .main-area.with-analytics { padding-right: 0; }
    .timeline-section { flex: 1; min-width: 0; }

    .emergency-banner { background: linear-gradient(135deg, #FF3B30, #FF6B6B); border-radius: 16px; padding: 16px 20px; margin-bottom: 24px; color: white; animation: emergencyGlow 2s ease-in-out infinite; }
    @keyframes emergencyGlow { 0%, 100% { box-shadow: 0 4px 20px rgba(255, 59, 48, 0.3); } 50% { box-shadow: 0 4px 30px rgba(255, 59, 48, 0.5); } }
    .emergency-header { display: flex; align-items: center; gap: 10px; font-weight: 600; font-size: 15px; margin-bottom: 12px; }
    .emergency-item { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(255, 255, 255, 0.15); border-radius: 10px; margin-top: 8px; cursor: pointer; border: none; width: 100%; color: white; text-align: left; }
    .emergency-item:hover { background: rgba(255, 255, 255, 0.25); }
    .emergency-title { font-weight: 500; font-size: 14px; }
    .emergency-time { font-size: 12px; opacity: 0.8; }

    .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; color: var(--theme-text-secondary, #8E8E93); font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .section-count { background: var(--theme-border-light, #E5E5EA); padding: 2px 8px; border-radius: 10px; font-size: 11px; }

    .announcements-list { display: flex; flex-direction: column; gap: 16px; margin-bottom: 32px; }
    .announcements-list.grid-view { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }

    .announcement-card { background: var(--theme-card-bg, white); border-radius: 16px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04); border: 1px solid var(--theme-border-light, #E5E5EA); transition: all 0.2s ease; }
    .announcement-card:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); }
    .announcement-card.pinned { border-left: 4px solid var(--apple-accent); }
    .announcement-card.emergency { border-left: 4px solid #FF3B30; background: linear-gradient(135deg, rgba(255, 59, 48, 0.02), transparent); }
    .announcement-card.scheduled { opacity: 0.85; border-left: 4px solid #FF9500; }
    .announcement-card.draft { opacity: 0.7; border-left: 4px solid #8E8E93; }

    .card-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
    .header-badges { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .priority-badge, .status-badge { padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
    .status-badge { display: flex; align-items: center; gap: 5px; }
    .status-dot { width: 6px; height: 6px; border-radius: 50%; }
    .pin-indicator { color: var(--apple-accent); }

    .card-menu { position: relative; }
    .menu-trigger { padding: 6px; background: transparent; border: none; border-radius: 6px; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; }
    .menu-trigger:hover { background: var(--theme-border-light, #E5E5EA); color: var(--theme-text, #0A0A0A); }
    .dropdown-menu { position: absolute; top: 100%; right: 0; background: var(--theme-card-bg, white); border-radius: 12px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15); border: 1px solid var(--theme-border-light, #E5E5EA); padding: 6px; min-width: 160px; z-index: 100; }
    .dropdown-menu button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; background: transparent; border: none; border-radius: 8px; font-size: 13px; color: var(--theme-text, #0A0A0A); cursor: pointer; text-align: left; }
    .dropdown-menu button:hover { background: var(--theme-border-light, #E5E5EA); }
    .dropdown-menu button.danger { color: #FF3B30; }
    .dropdown-menu button.danger:hover { background: rgba(255, 59, 48, 0.1); }
    .dropdown-menu button:disabled { opacity: 0.5; cursor: not-allowed; }
    .menu-divider { height: 1px; background: var(--theme-border-light, #E5E5EA); margin: 6px 0; }

    .card-title-btn { background: none; border: none; padding: 0; cursor: pointer; text-align: left; width: 100%; }
    .card-title { font-size: 17px; font-weight: 600; color: var(--theme-text, #0A0A0A); margin: 0 0 8px; line-height: 1.4; }
    .card-title:hover { color: var(--apple-accent); }
    .category-tag { display: inline-block; padding: 3px 8px; background: var(--theme-border-light, #E5E5EA); border-radius: 4px; font-size: 11px; font-weight: 500; color: var(--theme-text-secondary, #8E8E93); text-transform: capitalize; margin-bottom: 10px; }
    .scheduled-info { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: rgba(255, 149, 0, 0.1); border-radius: 8px; font-size: 12px; color: #FF9500; margin-bottom: 12px; }
    .card-image { margin: 12px 0; border-radius: 12px; overflow: hidden; }
    .card-image img { width: 100%; height: auto; display: block; }
    .card-content { font-size: 14px; color: var(--theme-text-secondary, #8E8E93); line-height: 1.6; margin: 0; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .attachments-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .attachment-chip { display: flex; align-items: center; gap: 6px; padding: 6px 10px; background: var(--theme-border-light, #E5E5EA); border-radius: 6px; font-size: 12px; color: var(--theme-text, #0A0A0A); text-decoration: none; }
    .attachment-chip:hover { background: var(--theme-border, #D1D1D6); }
    .card-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--theme-border-light, #E5E5EA); }
    .footer-stats { display: flex; align-items: center; gap: 16px; }
    .footer-stats .stat { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--theme-text-secondary, #8E8E93); }
    .footer-stats .stat.time { color: var(--theme-text-secondary, #AEAEB2); }
    .footer-icons { display: flex; gap: 8px; }
    .icon-badge { color: var(--theme-text-secondary, #8E8E93); }
    .icon-badge.locked { color: #FF9500; }

    .empty-state { text-align: center; padding: 60px 20px; background: var(--theme-card-bg, white); border-radius: 20px; border: 2px dashed var(--theme-border, #D1D1D6); }
    .empty-icon { width: 80px; height: 80px; background: var(--theme-border-light, #E5E5EA); border-radius: 20px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: var(--theme-text-secondary, #8E8E93); }
    .empty-state h3 { font-size: 18px; font-weight: 600; color: var(--theme-text, #0A0A0A); margin: 0 0 8px; }
    .empty-state p { font-size: 14px; color: var(--theme-text-secondary, #8E8E93); margin: 0 0 24px; }

    /* Analytics Panel */
    .analytics-panel { width: 320px; flex-shrink: 0; background: var(--theme-card-bg, white); border-radius: 16px 0 0 16px; padding: 20px; border-left: 1px solid var(--theme-border-light, #E5E5EA); height: fit-content; position: sticky; top: 100px; }
    .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .panel-header h3 { font-size: 16px; font-weight: 600; color: var(--theme-text, #0A0A0A); margin: 0; }
    .close-btn { padding: 6px; background: var(--theme-border-light, #E5E5EA); border: none; border-radius: 6px; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; }
    .analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
    .analytics-card { padding: 16px; background: var(--theme-border-light, #F5F5F7); border-radius: 12px; display: flex; flex-direction: column; gap: 10px; }
    .analytics-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
    .analytics-icon.blue { background: rgba(0, 122, 255, 0.15); color: #007AFF; }
    .analytics-icon.green { background: rgba(52, 199, 89, 0.15); color: #34C759; }
    .analytics-icon.purple { background: rgba(175, 82, 222, 0.15); color: #AF52DE; }
    .analytics-icon.orange { background: rgba(255, 149, 0, 0.15); color: #FF9500; }
    .analytics-info { display: flex; flex-direction: column; }
    .analytics-value { font-size: 20px; font-weight: 700; color: var(--theme-text, #0A0A0A); }
    .analytics-label { font-size: 11px; color: var(--theme-text-secondary, #8E8E93); }
    .top-announcement h4 { font-size: 13px; font-weight: 600; color: var(--theme-text-secondary, #8E8E93); margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .top-card { padding: 14px; background: linear-gradient(135deg, rgba(0, 122, 255, 0.1), rgba(175, 82, 222, 0.1)); border-radius: 12px; }
    .top-title { font-size: 14px; font-weight: 600; color: var(--theme-text, #0A0A0A); display: block; margin-bottom: 8px; }
    .top-stats { display: flex; gap: 16px; font-size: 12px; color: var(--theme-text-secondary, #8E8E93); }
    .top-stats span { display: flex; align-items: center; gap: 4px; }

    /* Modal Overlay */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
    .modal-overlay.emergency-overlay { background: rgba(255, 59, 48, 0.15); }

    /* Composer Modal */
    .composer-modal { width: 100%; max-width: 800px; max-height: 90vh; background: var(--theme-card-bg, white); border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.2); }
    .composer-header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid var(--theme-border-light, #E5E5EA); }
    .composer-title { display: flex; align-items: center; gap: 12px; }
    .back-btn { padding: 8px; background: var(--theme-border-light, #E5E5EA); border: none; border-radius: 8px; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; }
    .back-btn:hover { background: var(--theme-border, #D1D1D6); color: var(--theme-text, #0A0A0A); }
    .composer-title h2 { font-size: 17px; font-weight: 600; color: var(--theme-text, #0A0A0A); margin: 0; }
    .composer-actions { display: flex; gap: 10px; }
    .draft-btn { display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: var(--theme-border-light, #E5E5EA); border: none; border-radius: 10px; font-size: 14px; font-weight: 500; color: var(--theme-text, #0A0A0A); cursor: pointer; }
    .draft-btn:hover:not(:disabled) { background: var(--theme-border, #D1D1D6); }
    .draft-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .publish-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; background: var(--apple-accent); border: none; border-radius: 10px; font-size: 14px; font-weight: 600; color: white; cursor: pointer; }
    .publish-btn:hover:not(:disabled) { background: var(--apple-accent-hover); }
    .publish-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .spinning { display: inline-flex; animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .composer-tabs { display: flex; gap: 4px; padding: 12px 20px; background: var(--theme-border-light, #F5F5F7); border-bottom: 1px solid var(--theme-border-light, #E5E5EA); }
    .composer-tabs button { display: flex; align-items: center; gap: 6px; padding: 10px 16px; background: transparent; border: none; border-radius: 8px; font-size: 13px; font-weight: 500; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; }
    .composer-tabs button:hover { background: var(--theme-card-bg, white); }
    .composer-tabs button.active { background: var(--theme-card-bg, white); color: var(--apple-accent); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08); }
    .composer-body { flex: 1; overflow-y: auto; padding: 20px; }

    /* Content Editor */
    .content-editor { display: flex; flex-direction: column; gap: 16px; }
    .title-field { width: 100%; padding: 16px; background: var(--theme-border-light, #F5F5F7); border: 2px solid transparent; border-radius: 12px; font-size: 20px; font-weight: 600; color: var(--theme-text, #0A0A0A); outline: none; }
    .title-field:focus { border-color: var(--apple-accent); background: white; }
    .title-field::placeholder { color: var(--theme-text-secondary, #AEAEB2); }
    .editor-toolbar { display: flex; align-items: center; gap: 4px; padding: 8px 12px; background: var(--theme-border-light, #F5F5F7); border-radius: 10px; }
    .editor-toolbar button, .editor-toolbar .upload-btn { padding: 8px; background: transparent; border: none; border-radius: 6px; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .editor-toolbar button:hover, .editor-toolbar .upload-btn:hover { background: var(--theme-card-bg, white); color: var(--theme-text, #0A0A0A); }
    .toolbar-divider { width: 1px; height: 20px; background: var(--theme-border, #D1D1D6); margin: 0 8px; }
    .content-field { width: 100%; padding: 16px; background: var(--theme-border-light, #F5F5F7); border: 2px solid transparent; border-radius: 12px; font-size: 15px; line-height: 1.6; color: var(--theme-text, #0A0A0A); outline: none; resize: vertical; min-height: 200px; }
    .content-field:focus { border-color: var(--apple-accent); background: white; }
    .content-field::placeholder { color: var(--theme-text-secondary, #AEAEB2); }
    .image-preview { position: relative; border-radius: 12px; overflow: hidden; }
    .image-preview img { width: 100%; max-height: 300px; object-fit: cover; }
    .remove-image { position: absolute; top: 10px; right: 10px; padding: 8px; background: rgba(0, 0, 0, 0.6); border: none; border-radius: 8px; color: white; cursor: pointer; }
    .attachments-list { display: flex; flex-direction: column; gap: 8px; }
    .attachment-item { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--theme-border-light, #F5F5F7); border-radius: 10px; font-size: 13px; color: var(--theme-text, #0A0A0A); }
    .attachment-item span { flex: 1; }
    .attachment-item button { padding: 4px; background: transparent; border: none; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; }

    /* Settings Panel */
    .settings-panel { display: flex; flex-direction: column; gap: 24px; }
    .settings-section h4 { font-size: 13px; font-weight: 600; color: var(--theme-text-secondary, #8E8E93); margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    .priority-options { display: flex; flex-wrap: wrap; gap: 8px; }
    .priority-option { padding: 10px 16px; background: var(--priority-bg); border: 2px solid transparent; border-radius: 10px; font-size: 13px; font-weight: 500; color: var(--priority-color); cursor: pointer; }
    .priority-option.selected { border-color: var(--priority-color); }
    .settings-select { width: 100%; padding: 12px 14px; background: var(--theme-border-light, #F5F5F7); border: 2px solid transparent; border-radius: 10px; font-size: 14px; color: var(--theme-text, #0A0A0A); cursor: pointer; outline: none; }
    .settings-select:focus { border-color: var(--apple-accent); }
    .settings-input { width: 100%; padding: 12px 14px; background: var(--theme-border-light, #F5F5F7); border: 2px solid transparent; border-radius: 10px; font-size: 14px; color: var(--theme-text, #0A0A0A); outline: none; margin-top: 10px; }
    .settings-input:focus { border-color: var(--apple-accent); }
    .toggle-group { display: flex; gap: 8px; }
    .toggle-group button { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; background: var(--theme-border-light, #F5F5F7); border: 2px solid transparent; border-radius: 10px; font-size: 13px; font-weight: 500; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; }
    .toggle-group button.active { background: rgba(0, 122, 255, 0.1); border-color: var(--apple-accent); color: var(--apple-accent); }
    .timing-options { display: flex; flex-direction: column; gap: 12px; }
    .timing-option { display: flex; flex-direction: column; gap: 6px; }
    .timing-option span { font-size: 13px; color: var(--theme-text-secondary, #8E8E93); }
    .timing-option input { padding: 12px 14px; background: var(--theme-border-light, #F5F5F7); border: 2px solid transparent; border-radius: 10px; font-size: 14px; color: var(--theme-text, #0A0A0A); outline: none; }
    .timing-option input:focus { border-color: var(--apple-accent); }
    .checkbox-group { display: flex; flex-direction: column; gap: 10px; }
    .checkbox-option { display: flex; align-items: center; gap: 10px; padding: 12px 14px; background: var(--theme-border-light, #F5F5F7); border-radius: 10px; cursor: pointer; }
    .checkbox-option:hover { background: var(--theme-border, #E5E5EA); }
    .checkbox-option input { width: 18px; height: 18px; accent-color: var(--apple-accent); }
    .checkbox-option span { font-size: 14px; color: var(--theme-text, #0A0A0A); }

    /* Templates Panel */
    .templates-panel { padding: 10px 0; }
    .templates-intro { font-size: 14px; color: var(--theme-text-secondary, #8E8E93); margin: 0 0 20px; }
    .templates-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
    .template-card { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 20px; background: var(--theme-border-light, #F5F5F7); border: 2px solid transparent; border-radius: 14px; cursor: pointer; }
    .template-card:hover { background: var(--theme-card-bg, white); border-color: var(--apple-accent); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0, 122, 255, 0.15); }
    .template-icon { font-size: 28px; }
    .template-name { font-size: 13px; font-weight: 500; color: var(--theme-text, #0A0A0A); text-align: center; }

    /* Detail Modal */
    .detail-modal { width: 100%; max-width: 700px; max-height: 90vh; background: var(--theme-card-bg, white); border-radius: 20px; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.2); }
    .detail-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px; border-bottom: 1px solid var(--theme-border-light, #E5E5EA); }
    .detail-badges { display: flex; gap: 8px; flex: 1; }
    .detail-actions { display: flex; gap: 8px; }
    .detail-actions button { padding: 8px; background: var(--theme-border-light, #E5E5EA); border: none; border-radius: 8px; color: var(--theme-text-secondary, #8E8E93); cursor: pointer; }
    .detail-actions button:hover:not(:disabled) { background: var(--theme-border, #D1D1D6); color: var(--theme-text, #0A0A0A); }
    .detail-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
    .detail-body { flex: 1; overflow-y: auto; padding: 24px; }
    .detail-title { font-size: 24px; font-weight: 700; color: var(--theme-text, #0A0A0A); margin: 0 0 16px; line-height: 1.3; }
    .detail-meta { display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 20px; }
    .meta-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--theme-text-secondary, #8E8E93); }
    .meta-item.category { padding: 4px 10px; background: var(--theme-border-light, #E5E5EA); border-radius: 6px; text-transform: capitalize; }
    .detail-image { margin: 20px 0; border-radius: 14px; overflow: hidden; }
    .detail-image img { width: 100%; height: auto; }
    .detail-content { font-size: 16px; line-height: 1.7; color: var(--theme-text, #0A0A0A); white-space: pre-wrap; }
    .detail-attachments { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--theme-border-light, #E5E5EA); }
    .detail-attachments h4 { font-size: 14px; font-weight: 600; color: var(--theme-text, #0A0A0A); margin: 0 0 12px; }
    .attachment-link { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: var(--theme-border-light, #F5F5F7); border-radius: 10px; text-decoration: none; color: var(--theme-text, #0A0A0A); margin-bottom: 8px; }
    .attachment-link:hover { background: var(--theme-border, #E5E5EA); }
    .attachment-link span { flex: 1; font-size: 14px; }
    .detail-stats { display: flex; gap: 16px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--theme-border-light, #E5E5EA); }
    .stat-box { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px; background: var(--theme-border-light, #F5F5F7); border-radius: 12px; color: var(--theme-text-secondary, #8E8E93); }
    .stat-number { font-size: 20px; font-weight: 700; color: var(--theme-text, #0A0A0A); }
    .stat-text { font-size: 12px; }

    /* Confirm Modal */
    .confirm-modal { width: 100%; max-width: 400px; background: var(--theme-card-bg, white); border-radius: 20px; padding: 32px; text-align: center; box-shadow: 0 24px 80px rgba(0, 0, 0, 0.2); }
    .confirm-icon { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
    .confirm-icon.danger { background: rgba(255, 59, 48, 0.1); color: #FF3B30; }
    .confirm-icon.emergency { background: rgba(255, 59, 48, 0.15); color: #FF3B30; animation: emergencyPulseIcon 1s ease-in-out infinite; }
    @keyframes emergencyPulseIcon { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    .confirm-modal h3 { font-size: 18px; font-weight: 600; color: var(--theme-text, #0A0A0A); margin: 0 0 10px; }
    .confirm-modal p { font-size: 14px; color: var(--theme-text-secondary, #8E8E93); margin: 0 0 24px; line-height: 1.5; }
    .confirm-modal.emergency { border: 2px solid #FF3B30; }
    .emergency-list { list-style: none; padding: 0; margin: 0 0 16px; text-align: left; }
    .emergency-list li { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(255, 59, 48, 0.05); border-radius: 8px; margin-bottom: 8px; font-size: 13px; color: var(--theme-text, #0A0A0A); }
    .emergency-warning { font-weight: 600; color: #FF3B30 !important; }
    .confirm-actions { display: flex; gap: 12px; }
    .cancel-btn { flex: 1; padding: 14px; background: var(--theme-border-light, #E5E5EA); border: none; border-radius: 12px; font-size: 15px; font-weight: 600; color: var(--theme-text, #0A0A0A); cursor: pointer; }
    .cancel-btn:hover { background: var(--theme-border, #D1D1D6); }
    .delete-btn { flex: 1; padding: 14px; background: #FF3B30; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; color: white; cursor: pointer; }
    .delete-btn:hover { background: #E5352B; }
    .emergency-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; background: #FF3B30; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; color: white; cursor: pointer; }
    .emergency-btn:hover { background: #E5352B; }
    
    /* Placeholder Warning Modal */
    .confirm-modal.placeholder-warning { border: 2px solid #FF9500; }
    .confirm-icon.warning { background: rgba(255, 149, 0, 0.1); color: #FF9500; }
    .placeholder-list { list-style: none; padding: 0; margin: 0 0 16px; text-align: left; }
    .placeholder-list li { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(255, 149, 0, 0.08); border-radius: 8px; margin-bottom: 8px; font-size: 13px; color: var(--theme-text, #0A0A0A); }
    .placeholder-list code { background: rgba(255, 149, 0, 0.15); padding: 2px 8px; border-radius: 4px; font-family: monospace; color: #CC7700; }
    .placeholder-hint { font-size: 13px; color: var(--theme-text-secondary, #8E8E93); margin-bottom: 20px; }
    .warning-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 14px; background: #FF9500; border: none; border-radius: 12px; font-size: 15px; font-weight: 600; color: white; cursor: pointer; }
    .warning-btn:hover { background: #E68600; }

    /* Responsive */
    @media (max-width: 768px) {
        .top-nav { height: auto; padding: 16px; flex-direction: column; gap: 16px; }
        .nav-left { width: 100%; }
        .nav-actions { width: 100%; flex-wrap: wrap; justify-content: flex-end; }
        .nav-btn span { display: none; }
        .create-btn span { display: none; }
        .analytics-bar { padding: 12px 16px; gap: 16px; }
        .stat-item { min-width: 80px; }
        .control-panel { padding: 12px 16px; flex-direction: column; }
        .control-left, .control-right { width: 100%; flex-wrap: wrap; }
        .search-box { min-width: 100%; }
        .main-area { padding: 16px; flex-direction: column; }
        .analytics-panel { width: 100%; border-radius: 16px; position: static; }
        .announcements-list.grid-view { grid-template-columns: 1fr; }
        .composer-modal, .detail-modal { max-height: 100vh; border-radius: 0; }
        .composer-header { flex-wrap: wrap; gap: 12px; }
        .composer-actions { width: 100%; }
        .draft-btn, .publish-btn { flex: 1; }
    }
</style>
