<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { adminAuthStore } from '$lib/stores/adminAuth.js';
    import MobileAdminTools from '$lib/components/admin/MobileAdminTools.svelte';
    import { IconArrowLeft, IconLoader2 } from '@tabler/icons-svelte';

    let scanLogs = [];
    let pendingRequests = [];
    let urgentFeedback = [];
    let isLoading = true;

    onMount(async () => {
        await loadData();
    });

    async function loadData() {
        isLoading = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            
            // Load scan logs (recent attendance)
            const attendanceRes = await fetch('/api/admin/attendance?limit=20&today=true', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (attendanceRes.ok) {
                const data = await attendanceRes.json();
                scanLogs = (data.records || []).map(r => ({
                    id: r.id,
                    userName: r.userName,
                    type: r.checkOut ? 'check-out' : 'check-in',
                    timestamp: r.checkOut?.timestamp || r.checkIn?.timestamp,
                    location: r.checkIn?.location?.name || 'Unknown'
                }));
            }

            // Load pending requests (leave requests, etc.)
            const feedbackRes = await fetch('/api/admin/feedback?status=pending', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (feedbackRes.ok) {
                const data = await feedbackRes.json();
                urgentFeedback = (data.feedback || [])
                    .filter(f => f.priority === 'high')
                    .slice(0, 10);
            }

            // Load pending requests from dashboard
            const dashRes = await fetch('/api/admin/dashboard/stats', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (dashRes.ok) {
                const data = await dashRes.json();
                pendingRequests = data.pendingRequests || [];
            }

        } catch (error) {
            console.error('Failed to load mobile admin data:', error);
        } finally {
            isLoading = false;
        }
    }

    async function handleApprove(event) {
        const { item, type } = event.detail;
        const { accessToken } = adminAuthStore.getStoredTokens();
        
        try {
            if (type === 'request') {
                await fetch(`/api/admin/requests/${item.id}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'approved' })
                });
            }
            await loadData();
        } catch (error) {
            console.error('Approve failed:', error);
        }
    }

    async function handleReject(event) {
        const { item, type } = event.detail;
        const { accessToken } = adminAuthStore.getStoredTokens();
        
        try {
            if (type === 'request') {
                await fetch(`/api/admin/requests/${item.id}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: 'rejected' })
                });
            }
            await loadData();
        } catch (error) {
            console.error('Reject failed:', error);
        }
    }

    function handleAnnouncement() {
        goto('/admin/announcements?action=new');
    }

    function handleViewFeedback(event) {
        const feedback = event.detail;
        goto(`/admin/feedback?id=${feedback.id}`);
    }
</script>

<svelte:head>
    <title>Mobile Admin | Admin Panel</title>
</svelte:head>

<div class="mobile-admin-page">
    <header class="page-header">
        <a href="/admin/dashboard" class="back-btn">
            <IconArrowLeft size={20} />
        </a>
        <h1>Quick Admin</h1>
    </header>

    {#if isLoading}
        <div class="loading-state">
            <IconLoader2 size={32} class="spin" />
            <p>Loading...</p>
        </div>
    {:else}
        <MobileAdminTools
            {scanLogs}
            {pendingRequests}
            {urgentFeedback}
            {isLoading}
            on:approve={handleApprove}
            on:reject={handleReject}
            on:announcement={handleAnnouncement}
            on:refresh={loadData}
            on:viewFeedback={handleViewFeedback}
        />
    {/if}
</div>

<style>
    .mobile-admin-page {
        min-height: 100vh;
        background: var(--theme-bg, var(--apple-gray-6));
        padding: 16px;
        padding-bottom: 100px;
    }

    .page-header {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
    }

    .back-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        background: var(--theme-card-bg, var(--apple-white));
        border-radius: 12px;
        color: var(--theme-text);
        text-decoration: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }

    .page-header h1 {
        font-size: 24px;
        font-weight: 700;
        color: var(--theme-text);
        margin: 0;
    }

    .loading-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        color: var(--theme-text-secondary);
        gap: 12px;
    }

    :global(.spin) {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
</style>
