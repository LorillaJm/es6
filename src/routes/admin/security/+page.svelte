<script>
    import { onMount } from "svelte";
    import { adminAuthStore, ADMIN_ROLES } from "$lib/stores/adminAuth.js";
    import { IconShield, IconLoader2, IconPlus, IconEdit, IconTrash, IconKey, IconX, IconCheck, IconDevices, IconDatabase, IconShieldLock, IconChevronRight } from "@tabler/icons-svelte";

    let admins = [];
    let isLoading = true;
    let showModal = false;
    let editingAdmin = null;
    let formData = { name: '', email: '', password: '', role: 'admin' };
    let formError = '';
    let isSubmitting = false;

    const securityFeatures = [
        { href: '/admin/sessions', icon: IconDevices, title: 'Session Control', desc: 'Monitor and manage active user sessions' },
        { href: '/admin/backup', icon: IconDatabase, title: 'Backup & Recovery', desc: 'Create backups and restore system data' },
        { href: '/admin/ip-settings', icon: IconShieldLock, title: 'IP Restriction', desc: 'Control network access for admin and attendance' },
        { href: '/admin/audit-logs', icon: IconShield, title: 'Audit Logs', desc: 'View all administrative actions and events' }
    ];

    onMount(async () => {
        await loadAdmins();
    });

    async function loadAdmins() {
        isLoading = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/admins', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                admins = data.admins || [];
                console.log('Admins loaded:', admins.length, 'accounts');
            } else {
                const errorData = await response.json();
                console.error('Admins API error:', errorData);
                // If forbidden, show current admin at least
                if (response.status === 403 && $adminAuthStore.admin) {
                    admins = [$adminAuthStore.admin];
                }
            }
        } catch (error) {
            console.error('Failed to load admins:', error);
        } finally {
            isLoading = false;
        }
    }

    function openModal(admin = null) {
        editingAdmin = admin;
        formData = admin 
            ? { name: admin.name, email: admin.email, password: '', role: admin.role }
            : { name: '', email: '', password: '', role: 'admin' };
        formError = '';
        showModal = true;
    }

    async function saveAdmin() {
        if (!formData.name || !formData.email || (!editingAdmin && !formData.password)) {
            formError = 'Please fill in all required fields';
            return;
        }
        isSubmitting = true;
        formError = '';
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const method = editingAdmin ? 'PUT' : 'POST';
            const url = editingAdmin ? `/api/admin/admins/${editingAdmin.id}` : '/api/admin/admins';
            
            const response = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save admin');
            }
            
            showModal = false;
            await loadAdmins();
        } catch (error) {
            formError = error.message;
        } finally {
            isSubmitting = false;
        }
    }

    async function deleteAdmin(id) {
        if (!confirm('Are you sure you want to delete this admin?')) return;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            await fetch(`/api/admin/admins/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            admins = admins.filter(a => a.id !== id);
        } catch (error) {
            console.error('Failed to delete admin:', error);
        }
    }

    function formatDate(dateString) {
        if (!dateString) return 'Never';
        return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
</script>

<svelte:head>
    <title>Security | Admin Panel</title>
</svelte:head>

<div class="security-page">
    <header class="page-header">
        <div class="header-content">
            <h1>Security</h1>
            <p class="header-subtitle">Manage admin accounts and security settings</p>
        </div>
        {#if $adminAuthStore.admin?.role === 'super_admin'}
            <button class="apple-btn-primary" on:click={() => openModal()}>
                <IconPlus size={18} stroke={2} /> Add Admin
            </button>
        {/if}
    </header>

    <!-- Security Features Grid -->
    <div class="features-grid">
        {#each securityFeatures as feature}
            <a href={feature.href} class="feature-card apple-card">
                <div class="feature-icon">
                    <svelte:component this={feature.icon} size={24} stroke={1.5} />
                </div>
                <div class="feature-info">
                    <h3>{feature.title}</h3>
                    <p>{feature.desc}</p>
                </div>
                <IconChevronRight size={18} stroke={2} class="feature-arrow" />
            </a>
        {/each}
    </div>

    <div class="admin-list apple-card">
        <h2>Admin Accounts</h2>
        {#if isLoading}
            <div class="loading-state"><IconLoader2 size={32} stroke={1.5} class="spin" /><p>Loading admins...</p></div>
        {:else if admins.length === 0}
            <div class="empty-state"><IconShield size={48} stroke={1.5} /><p>No admin accounts found</p></div>
        {:else}
            <table class="apple-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>MFA</th><th>Last Login</th><th>Actions</th></tr></thead>
                <tbody>
                    {#each admins as admin}
                        <tr>
                            <td><div class="admin-cell"><div class="admin-avatar">{admin.name?.charAt(0) || 'A'}</div><span>{admin.name}</span></div></td>
                            <td>{admin.email}</td>
                            <td><span class="role-badge {admin.role}">{admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}</span></td>
                            <td>
                                {#if admin.mfaEnabled}
                                    <span class="mfa-badge enabled"><IconCheck size={14} stroke={2} /> Enabled</span>
                                {:else}
                                    <span class="mfa-badge disabled">Disabled</span>
                                {/if}
                            </td>
                            <td>{formatDate(admin.lastLogin)}</td>
                            <td>
                                {#if $adminAuthStore.admin?.role === 'super_admin' && admin.id !== $adminAuthStore.admin?.id}
                                    <div class="action-buttons">
                                        <button class="icon-btn" title="Edit" on:click={() => openModal(admin)}><IconEdit size={16} stroke={1.5} /></button>
                                        <button class="icon-btn danger" title="Delete" on:click={() => deleteAdmin(admin.id)}><IconTrash size={16} stroke={1.5} /></button>
                                    </div>
                                {:else}
                                    <span class="text-muted">-</span>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        {/if}
    </div>
</div>

<!-- Modal -->
{#if showModal}
    <div class="modal-overlay" on:click={() => showModal = false}>
        <div class="modal apple-card" on:click|stopPropagation>
            <div class="modal-header">
                <h2>{editingAdmin ? 'Edit' : 'Add'} Admin</h2>
                <button class="close-btn" on:click={() => showModal = false}><IconX size={20} stroke={1.5} /></button>
            </div>
            {#if formError}
                <div class="error-alert">{formError}</div>
            {/if}
            <div class="modal-body">
                <div class="form-group">
                    <label class="apple-label">Name *</label>
                    <input type="text" class="apple-input" bind:value={formData.name} placeholder="Admin name" />
                </div>
                <div class="form-group">
                    <label class="apple-label">Email *</label>
                    <input type="email" class="apple-input" bind:value={formData.email} placeholder="admin@example.com" disabled={!!editingAdmin} />
                </div>
                {#if !editingAdmin}
                    <div class="form-group">
                        <label class="apple-label">Password *</label>
                        <input type="password" class="apple-input" bind:value={formData.password} placeholder="Secure password" />
                    </div>
                {/if}
                <div class="form-group">
                    <label class="apple-label">Role</label>
                    <select class="apple-input" bind:value={formData.role}>
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="apple-btn-secondary" on:click={() => showModal = false}>Cancel</button>
                <button class="apple-btn-primary" on:click={saveAdmin} disabled={isSubmitting}>
                    {isSubmitting ? 'Saving...' : 'Save'}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .security-page { padding: 24px; max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }

    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .feature-card { display: flex; align-items: center; gap: 16px; padding: 20px; text-decoration: none; transition: var(--apple-transition); }
    .feature-card:hover { transform: translateY(-2px); box-shadow: var(--apple-shadow-md); }
    .feature-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .feature-info { flex: 1; min-width: 0; }
    .feature-info h3 { font-size: 15px; font-weight: 600; color: var(--theme-text, var(--apple-black)); margin: 0 0 4px; }
    .feature-info p { font-size: 13px; color: var(--theme-text-secondary, var(--apple-gray-1)); margin: 0; }
    .feature-card :global(.feature-arrow) { color: var(--theme-text-secondary, var(--apple-gray-1)); flex-shrink: 0; }
    .page-header h1 { font-size: 32px; font-weight: 700; color: var(--theme-text, var(--apple-black)); margin-bottom: 4px; }
    .header-subtitle { font-size: 15px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    
    .admin-list { padding: 24px; }
    .admin-list h2 { font-size: 18px; font-weight: 600; margin-bottom: 20px; color: var(--theme-text, var(--apple-black)); }
    
    .loading-state, .empty-state { text-align: center; padding: 60px 20px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .loading-state p, .empty-state p { margin-top: 12px; font-size: 14px; }
    
    .admin-cell { display: flex; align-items: center; gap: 10px; }
    .admin-avatar { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--apple-accent), #5856D6); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 13px; }
    
    .role-badge { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .role-badge.super_admin { background: rgba(175, 82, 222, 0.1); color: var(--apple-purple); }
    .role-badge.admin { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }
    
    .mfa-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .mfa-badge.enabled { background: rgba(52, 199, 89, 0.1); color: var(--apple-green); }
    .mfa-badge.disabled { background: rgba(142, 142, 147, 0.1); color: var(--apple-gray-1); }
    
    .action-buttons { display: flex; gap: 8px; }
    .icon-btn { width: 32px; height: 32px; border-radius: var(--apple-radius-sm); background: var(--theme-border-light, var(--apple-gray-6)); border: none; display: flex; align-items: center; justify-content: center; color: var(--theme-text-secondary, var(--apple-gray-1)); cursor: pointer; }
    .icon-btn:hover { background: var(--theme-border, var(--apple-gray-5)); }
    .icon-btn.danger:hover { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .text-muted { color: var(--theme-text-secondary, var(--apple-gray-1)); }
    
    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; padding: 20px; }
    .modal { width: 100%; max-width: 450px; }
    .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .modal-header h2 { font-size: 20px; font-weight: 600; }
    .close-btn { background: none; border: none; color: var(--theme-text-secondary); cursor: pointer; }
    .error-alert { padding: 12px; background: rgba(255, 59, 48, 0.1); border-radius: var(--apple-radius-md); color: var(--apple-red); font-size: 14px; margin-bottom: 16px; }
    .modal-body { display: flex; flex-direction: column; gap: 16px; }
    .form-group { display: flex; flex-direction: column; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--theme-border-light); }
    
    :global(.spin) { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
