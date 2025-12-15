<script>
    import { onMount } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { 
        IconDatabase, IconLoader2, IconPlus, IconRefresh, IconDownload,
        IconTrash, IconClock, IconCheck, IconX, IconAlertTriangle
    } from "@tabler/icons-svelte";

    let backups = [];
    let latestBackup = null;
    let isLoading = true;
    let isCreating = false;
    let isRestoring = false;
    let showRestoreModal = false;
    let selectedBackup = null;
    let restoreCollections = [];

    const allCollections = ['users', 'attendance', 'announcements', 'feedback', 'settings', 'admins'];

    onMount(async () => {
        await loadBackups();
    });

    async function loadBackups() {
        isLoading = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const [backupsRes, latestRes] = await Promise.all([
                fetch('/api/admin/backup', { headers: { 'Authorization': `Bearer ${accessToken}` } }),
                fetch('/api/admin/backup?action=latest', { headers: { 'Authorization': `Bearer ${accessToken}` } })
            ]);
            
            if (backupsRes.ok) {
                const data = await backupsRes.json();
                backups = data.backups || [];
            }
            if (latestRes.ok) {
                const data = await latestRes.json();
                latestBackup = data.backup;
            }
        } catch (error) {
            console.error('Failed to load backups:', error);
        } finally {
            isLoading = false;
        }
    }

    async function createBackup() {
        if (isCreating) return;
        isCreating = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/backup', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'create', description: 'Manual backup' })
            });
            
            if (response.ok) {
                await loadBackups();
            } else {
                const data = await response.json();
                alert('Backup failed: ' + data.error);
            }
        } catch (error) {
            console.error('Failed to create backup:', error);
            alert('Backup failed: ' + error.message);
        } finally {
            isCreating = false;
        }
    }

    function openRestoreModal(backup) {
        selectedBackup = backup;
        restoreCollections = [...allCollections];
        showRestoreModal = true;
    }

    async function restoreBackup() {
        if (!selectedBackup || isRestoring) return;
        if (!confirm('Are you sure? This will overwrite current data with the backup.')) return;
        
        isRestoring = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/backup', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    action: 'restore', 
                    backupId: selectedBackup.id,
                    collections: restoreCollections
                })
            });
            
            if (response.ok) {
                alert('Restore completed successfully!');
                showRestoreModal = false;
            } else {
                const data = await response.json();
                alert('Restore failed: ' + data.error);
            }
        } catch (error) {
            console.error('Failed to restore:', error);
            alert('Restore failed: ' + error.message);
        } finally {
            isRestoring = false;
        }
    }

    async function deleteBackup(backupId) {
        if (!confirm('Delete this backup permanently?')) return;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch(`/api/admin/backup?id=${backupId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            await loadBackups();
        } catch (error) {
            console.error('Failed to delete backup:', error);
        }
    }

    function formatDate(dateString) {
        if (!dateString) return 'Unknown';
        return new Date(dateString).toLocaleString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    function formatSize(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
            bytes /= 1024;
            i++;
        }
        return `${bytes.toFixed(1)} ${units[i]}`;
    }

    function getTimeSince(dateString) {
        if (!dateString) return 'Never';
        const diff = Date.now() - new Date(dateString).getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return 'Less than 1 hour ago';
        if (hours < 24) return `${hours} hours ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days > 1 ? 's' : ''} ago`;
    }

    function toggleCollection(col) {
        if (restoreCollections.includes(col)) {
            restoreCollections = restoreCollections.filter(c => c !== col);
        } else {
            restoreCollections = [...restoreCollections, col];
        }
    }
</script>

<svelte:head>
    <title>Backup & Recovery | Admin Panel</title>
</svelte:head>

<div class="backup-page">
    <header class="page-header">
        <div class="header-content">
            <h1>Backup & Recovery</h1>
            <p class="header-subtitle">Create backups and restore system data</p>
        </div>
        <div class="header-actions">
            <button class="apple-btn-secondary" on:click={loadBackups}>
                <IconRefresh size={18} stroke={2} /> Refresh
            </button>
            <button class="apple-btn-primary" on:click={createBackup} disabled={isCreating}>
                {#if isCreating}
                    <IconLoader2 size={18} stroke={2} class="spin" /> Creating...
                {:else}
                    <IconPlus size={18} stroke={2} /> Create Backup
                {/if}
            </button>
        </div>
    </header>

    <!-- Status Card -->
    <div class="status-card apple-card">
        <div class="status-icon" class:warning={!latestBackup}>
            {#if latestBackup}
                <IconCheck size={24} stroke={2} />
            {:else}
                <IconAlertTriangle size={24} stroke={2} />
            {/if}
        </div>
        <div class="status-info">
            <h3>Last Backup</h3>
            <p class="status-time">{getTimeSince(latestBackup?.createdAt)}</p>
            {#if latestBackup}
                <p class="status-detail">Size: {formatSize(latestBackup.size)} • {latestBackup.collections?.length || 0} collections</p>
            {:else}
                <p class="status-detail warning">No backups found. Create one now!</p>
            {/if}
        </div>
    </div>

    <!-- Backups List -->
    <div class="backups-container apple-card">
        <h2>Backup History</h2>
        {#if isLoading}
            <div class="loading-state">
                <IconLoader2 size={32} stroke={1.5} class="spin" />
                <p>Loading backups...</p>
            </div>
        {:else if backups.length === 0}
            <div class="empty-state">
                <IconDatabase size={48} stroke={1.5} />
                <p>No backups yet</p>
                <button class="apple-btn-primary" on:click={createBackup}>Create First Backup</button>
            </div>
        {:else}
            <div class="backups-list">
                {#each backups as backup}
                    <div class="backup-item">
                        <div class="backup-icon" class:success={backup.status === 'completed'} class:error={backup.status === 'failed'}>
                            {#if backup.status === 'completed'}
                                <IconCheck size={18} stroke={2} />
                            {:else if backup.status === 'failed'}
                                <IconX size={18} stroke={2} />
                            {:else}
                                <IconLoader2 size={18} stroke={2} class="spin" />
                            {/if}
                        </div>
                        <div class="backup-info">
                            <div class="backup-header">
                                <span class="backup-type">{backup.type === 'manual' ? 'Manual' : 'Scheduled'} Backup</span>
                                <span class="backup-status {backup.status}">{backup.status}</span>
                            </div>
                            <div class="backup-meta">
                                <span><IconClock size={12} stroke={1.5} /> {formatDate(backup.createdAt)}</span>
                                <span>•</span>
                                <span>{formatSize(backup.size)}</span>
                                <span>•</span>
                                <span>{backup.collections?.length || 0} collections</span>
                            </div>
                            {#if backup.description}
                                <p class="backup-desc">{backup.description}</p>
                            {/if}
                        </div>
                        <div class="backup-actions">
                            {#if backup.status === 'completed'}
                                <button class="action-btn restore" title="Restore" on:click={() => openRestoreModal(backup)}>
                                    <IconDownload size={16} stroke={1.5} /> Restore
                                </button>
                            {/if}
                            <button class="action-btn delete" title="Delete" on:click={() => deleteBackup(backup.id)}>
                                <IconTrash size={16} stroke={1.5} />
                            </button>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<!-- Restore Modal -->
{#if showRestoreModal && selectedBackup}
    <div class="modal-overlay" on:click={() => showRestoreModal = false}>
        <div class="modal apple-card" on:click|stopPropagation>
            <div class="modal-header">
                <h2>Restore Backup</h2>
                <button class="close-btn" on:click={() => showRestoreModal = false}>
                    <IconX size={20} stroke={1.5} />
                </button>
            </div>
            <div class="modal-body">
                <div class="warning-box">
                    <IconAlertTriangle size={20} stroke={1.5} />
                    <p>This will overwrite current data. This action cannot be undone.</p>
                </div>
                <p class="restore-info">Backup from: {formatDate(selectedBackup.createdAt)}</p>
                <h4>Select collections to restore:</h4>
                <div class="collections-grid">
                    {#each allCollections as col}
                        <label class="collection-item">
                            <input type="checkbox" checked={restoreCollections.includes(col)} on:change={() => toggleCollection(col)} />
                            <span>{col}</span>
                        </label>
                    {/each}
                </div>
            </div>
            <div class="modal-footer">
                <button class="apple-btn-secondary" on:click={() => showRestoreModal = false}>Cancel</button>
                <button class="apple-btn-danger" on:click={restoreBackup} disabled={isRestoring || restoreCollections.length === 0}>
                    {#if isRestoring}
                        <IconLoader2 size={16} stroke={2} class="spin" /> Restoring...
                    {:else}
                        Restore Selected
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .backup-page { padding: 24px; max-width: 1000px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
    .page-header h1 { font-size: 32px; font-weight: 700; color: var(--theme-text, var(--apple-black)); margin-bottom: 4px; }
    .header-subtitle { font-size: 15px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .header-actions { display: flex; gap: 12px; }

    .status-card { display: flex; align-items: center; gap: 16px; padding: 24px; margin-bottom: 24px; }
    .status-icon { width: 56px; height: 56px; border-radius: 16px; background: rgba(52, 199, 89, 0.1); color: var(--apple-green); display: flex; align-items: center; justify-content: center; }
    .status-icon.warning { background: rgba(255, 149, 0, 0.1); color: var(--apple-orange); }
    .status-info h3 { font-size: 14px; font-weight: 600; color: var(--theme-text-secondary, var(--apple-gray-1)); margin-bottom: 4px; }
    .status-time { font-size: 24px; font-weight: 700; color: var(--theme-text, var(--apple-black)); margin-bottom: 4px; }
    .status-detail { font-size: 13px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .status-detail.warning { color: var(--apple-orange); }

    .backups-container { padding: 24px; }
    .backups-container h2 { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: var(--theme-text, var(--apple-black)); }

    .loading-state, .empty-state { text-align: center; padding: 60px 20px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .loading-state p, .empty-state p { margin: 12px 0; font-size: 14px; }

    .backups-list { display: flex; flex-direction: column; gap: 12px; }
    .backup-item { display: flex; align-items: center; gap: 14px; padding: 16px; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: var(--apple-radius-md); }

    .backup-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .backup-icon.success { background: rgba(52, 199, 89, 0.1); color: var(--apple-green); }
    .backup-icon.error { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }

    .backup-info { flex: 1; min-width: 0; }
    .backup-header { display: flex; align-items: center; gap: 10px; margin-bottom: 4px; }
    .backup-type { font-size: 14px; font-weight: 600; color: var(--theme-text, var(--apple-black)); }
    .backup-status { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; text-transform: capitalize; }
    .backup-status.completed { background: rgba(52, 199, 89, 0.1); color: var(--apple-green); }
    .backup-status.failed { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .backup-status.in_progress { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }

    .backup-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .backup-desc { font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); margin-top: 4px; }

    .backup-actions { display: flex; gap: 8px; }
    .action-btn { padding: 8px 12px; border-radius: var(--apple-radius-sm); border: none; font-size: 12px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: var(--apple-transition); }
    .action-btn.restore { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }
    .action-btn.restore:hover { background: rgba(0, 122, 255, 0.2); }
    .action-btn.delete { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .action-btn.delete:hover { background: rgba(255, 59, 48, 0.2); }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
    .modal { width: 100%; max-width: 500px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal-header h2 { font-size: 20px; font-weight: 600; }
    .close-btn { background: none; border: none; color: var(--theme-text-secondary); cursor: pointer; }

    .warning-box { display: flex; align-items: center; gap: 12px; padding: 14px; background: rgba(255, 149, 0, 0.1); border-radius: var(--apple-radius-md); color: var(--apple-orange); margin-bottom: 16px; }
    .warning-box p { font-size: 13px; margin: 0; }
    .restore-info { font-size: 14px; color: var(--theme-text-secondary, var(--apple-gray-1)); margin-bottom: 16px; }
    .modal-body h4 { font-size: 14px; font-weight: 600; margin-bottom: 12px; }

    .collections-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
    .collection-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: var(--apple-radius-sm); cursor: pointer; }
    .collection-item input { accent-color: var(--apple-accent); }
    .collection-item span { font-size: 13px; text-transform: capitalize; }

    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--theme-border-light); }
    .apple-btn-danger { background: var(--apple-red); color: white; padding: 10px 20px; border: none; border-radius: var(--apple-radius-md); font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .apple-btn-danger:disabled { opacity: 0.6; cursor: not-allowed; }

    :global(.spin) { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
