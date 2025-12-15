<script>
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { impersonationStore } from "$lib/stores/impersonation.js";
    import { IconUsers, IconSearch, IconPlus, IconEdit, IconTrash, IconLoader2, IconChevronLeft, IconChevronRight, IconDownload, IconX, IconQrcode, IconKey, IconUserCheck, IconUserX, IconUpload, IconCheck, IconAlertCircle, IconCopy, IconShield, IconShieldOff, IconEye, IconFilter, IconDotsVertical, IconRefresh, IconUserPlus } from "@tabler/icons-svelte";

    let users = [], departments = [], filteredUsers = [], isLoading = true, searchQuery = '', roleFilter = '', departmentFilter = '', statusFilter = '', currentPage = 1, itemsPerPage = 10;
    let showAddModal = false, showEditModal = false, showDeleteModal = false, showBulkModal = false, showQRModal = false, showPasswordModal = false, showRoleModal = false, showFilters = false;
    let selectedUser = null, selectedUsers = [], selectAll = false, activeDropdown = null;
    let formData = { name: '', email: '', role: 'student', department: '', year: '', section: '', phone: '' };
    let formError = '', isSubmitting = false, tempPassword = '', bulkAction = 'delete', bulkDepartment = '', bulkSection = '', csvFile = null, csvPreview = [];
    const years = ['1st Year', '2nd Year', '3rd Year', '4th Year', '5th Year'];
    const sections = ['A', 'B', 'C', 'D', 'E', 'F'];

    $: totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
    $: paginatedUsers = filteredUsers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    $: activeFiltersCount = [roleFilter, departmentFilter, statusFilter].filter(Boolean).length;
    $: stats = {
        total: users.length,
        active: users.filter(u => u.isActive !== false).length,
        students: users.filter(u => u.role === 'student').length,
        staff: users.filter(u => u.role === 'staff').length
    };

    onMount(async () => { await loadUsers(); });

    async function loadUsers() {
        isLoading = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const params = new URLSearchParams();
            if (roleFilter) params.set('role', roleFilter);
            if (departmentFilter) params.set('department', departmentFilter);
            if (statusFilter) params.set('isActive', statusFilter);
            const response = await fetch(`/api/admin/users?${params}`, { headers: { 'Authorization': `Bearer ${accessToken}` } });
            if (response.ok) { const data = await response.json(); users = data.users || []; departments = data.departments || []; filterUsers(); }
        } catch (error) { console.error('Failed to load users:', error); }
        finally { isLoading = false; }
    }

    function filterUsers() {
        let result = [...users];
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(u => u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query) || u.digitalId?.toLowerCase().includes(query));
        }
        filteredUsers = result; currentPage = 1; selectedUsers = []; selectAll = false;
    }

    function clearFilters() { roleFilter = ''; departmentFilter = ''; statusFilter = ''; loadUsers(); }
    function toggleSelectAll() { selectAll = !selectAll; selectedUsers = selectAll ? paginatedUsers.map(u => u.id) : []; }
    function toggleSelectUser(userId) { selectedUsers = selectedUsers.includes(userId) ? selectedUsers.filter(id => id !== userId) : [...selectedUsers, userId]; }
    function openAddModal() { formData = { name: '', email: '', role: 'student', department: '', year: '', section: '', phone: '' }; formError = ''; showAddModal = true; }
    function openEditModal(user) { selectedUser = user; formData = { name: user.name || '', email: user.email || '', role: user.role || 'student', department: user.department || '', year: user.year || '', section: user.section || '', phone: user.phone || '' }; formError = ''; showEditModal = true; activeDropdown = null; }
    function toggleDropdown(userId) { activeDropdown = activeDropdown === userId ? null : userId; }

    async function saveUser() {
        if (!formData.name || !formData.email) { formError = 'Name and email are required'; return; }
        isSubmitting = true; formError = '';
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const method = showEditModal ? 'PUT' : 'POST';
            const url = showEditModal ? `/api/admin/users/${selectedUser.id}` : '/api/admin/users';
            const response = await fetch(url, { method, headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
            if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Failed'); }
            showAddModal = false; showEditModal = false; await loadUsers();
        } catch (error) { formError = error.message; } finally { isSubmitting = false; }
    }

    async function deleteUser() {
        isSubmitting = true;
        try { const { accessToken } = adminAuthStore.getStoredTokens(); await fetch(`/api/admin/users/${selectedUser.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}` } }); showDeleteModal = false; await loadUsers(); }
        catch (error) { console.error('Delete failed:', error); } finally { isSubmitting = false; }
    }

    async function toggleUserStatus(user) {
        try { const { accessToken } = adminAuthStore.getStoredTokens(); await fetch(`/api/admin/users/${user.id}`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: user.isActive !== false ? 'deactivate' : 'activate' }) }); await loadUsers(); }
        catch (error) { console.error('Status toggle failed:', error); }
        activeDropdown = null;
    }

    async function resetQR(user) {
        selectedUser = user; isSubmitting = true; activeDropdown = null;
        try { const { accessToken } = adminAuthStore.getStoredTokens(); const response = await fetch(`/api/admin/users/${user.id}/reset-qr`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}` } }); if (response.ok) { const data = await response.json(); selectedUser = { ...user, qrCode: data.qrCode }; showQRModal = true; } }
        catch (error) { console.error('QR reset failed:', error); } finally { isSubmitting = false; }
    }

    async function resetPassword(user) {
        selectedUser = user; tempPassword = ''; isSubmitting = true; activeDropdown = null;
        try { const { accessToken } = adminAuthStore.getStoredTokens(); const response = await fetch(`/api/admin/users/${user.id}/reset-password`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({}) }); if (response.ok) { const data = await response.json(); tempPassword = data.temporaryPassword; showPasswordModal = true; } }
        catch (error) { console.error('Password reset failed:', error); } finally { isSubmitting = false; }
    }

    async function changeRole(action) {
        isSubmitting = true;
        try { const { accessToken } = adminAuthStore.getStoredTokens(); await fetch(`/api/admin/users/${selectedUser.id}/role`, { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, adminRole: 'admin' }) }); showRoleModal = false; await loadUsers(); }
        catch (error) { console.error('Role change failed:', error); } finally { isSubmitting = false; }
    }

    async function executeBulkAction() {
        if (selectedUsers.length === 0) return;
        isSubmitting = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            let body = { action: bulkAction, userIds: selectedUsers };
            if (bulkAction === 'update') { body.updates = {}; if (bulkDepartment) body.updates.department = bulkDepartment; if (bulkSection) body.updates.section = bulkSection; }
            await fetch('/api/admin/users/bulk', { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
            showBulkModal = false; selectedUsers = []; selectAll = false; await loadUsers();
        } catch (error) { console.error('Bulk action failed:', error); } finally { isSubmitting = false; }
    }

    function handleCSVUpload(event) {
        const file = event.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const lines = e.target.result.split('\n').filter(l => l.trim());
            const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
            csvPreview = lines.slice(1, 6).map(line => { const values = line.split(',').map(v => v.trim().replace(/"/g, '')); const obj = {}; headers.forEach((h, i) => obj[h] = values[i] || ''); return obj; });
            csvFile = { headers, lines: lines.slice(1) };
        };
        reader.readAsText(file);
    }

    async function uploadCSV() {
        if (!csvFile) return; isSubmitting = true;
        try {
            const users = csvFile.lines.map(line => { const values = line.split(',').map(v => v.trim().replace(/"/g, '')); const obj = {}; csvFile.headers.forEach((h, i) => obj[h] = values[i] || ''); return obj; }).filter(u => u.name && u.email);
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/users/bulk', { method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', users }) });
            if (response.ok) { const data = await response.json(); alert(`Created: ${data.result.success.length}, Failed: ${data.result.failed.length}`); showBulkModal = false; csvFile = null; csvPreview = []; await loadUsers(); }
        } catch (error) { console.error('CSV upload failed:', error); } finally { isSubmitting = false; }
    }

    function exportUsers() { const { accessToken } = adminAuthStore.getStoredTokens(); window.open(`/api/admin/users?export=csv&token=${accessToken}`, '_blank'); }
    function copyToClipboard(text) { navigator.clipboard.writeText(text); }

    async function startImpersonation(user) {
        if (!confirm(`View the app as ${user.name}? This will be logged for security.`)) return;
        activeDropdown = null;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/impersonate', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId: user.id, reason: 'Admin troubleshooting' })
            });
            if (response.ok) {
                const data = await response.json();
                impersonationStore.start(data.admin.id, data.admin.name, data.targetUser, 'Troubleshooting');
                goto('/app');
            }
        } catch (error) { console.error('Impersonation failed:', error); }
    }
</script>

<svelte:head><title>Users | Admin Panel</title></svelte:head>

<div class="users-page">
    <!-- Stats Cards -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-icon blue"><IconUsers size={22} stroke={1.5} /></div>
            <div class="stat-content">
                <span class="stat-value">{stats.total}</span>
                <span class="stat-label">Total Users</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon green"><IconUserCheck size={22} stroke={1.5} /></div>
            <div class="stat-content">
                <span class="stat-value">{stats.active}</span>
                <span class="stat-label">Active</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon purple"><IconUserPlus size={22} stroke={1.5} /></div>
            <div class="stat-content">
                <span class="stat-value">{stats.students}</span>
                <span class="stat-label">Students</span>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon orange"><IconShield size={22} stroke={1.5} /></div>
            <div class="stat-content">
                <span class="stat-value">{stats.staff}</span>
                <span class="stat-label">Staff</span>
            </div>
        </div>
    </div>

    <!-- Header -->
    <header class="page-header">
        <div class="header-title">
            <h1>User Management</h1>
            <p class="subtitle">Manage student and staff accounts</p>
        </div>
        <div class="header-actions">
            {#if selectedUsers.length > 0}
                <button class="action-btn secondary" on:click={() => { bulkAction = 'delete'; showBulkModal = true; }}>
                    <IconTrash size={18} stroke={1.5} />
                    <span class="btn-text">Bulk ({selectedUsers.length})</span>
                </button>
            {/if}
            <button class="action-btn secondary" on:click={() => { bulkAction = 'upload'; showBulkModal = true; }}>
                <IconUpload size={18} stroke={1.5} />
                <span class="btn-text">Import</span>
            </button>
            <button class="action-btn secondary" on:click={exportUsers}>
                <IconDownload size={18} stroke={1.5} />
                <span class="btn-text">Export</span>
            </button>
            <button class="action-btn primary" on:click={openAddModal}>
                <IconPlus size={18} stroke={2} />
                <span class="btn-text">Add User</span>
            </button>
        </div>
    </header>

    <!-- Toolbar -->
    <div class="toolbar">
        <div class="search-wrapper">
            <IconSearch size={18} stroke={1.5} />
            <input type="text" placeholder="Search by name, email, or ID..." bind:value={searchQuery} on:input={filterUsers} />
            {#if searchQuery}
                <button class="clear-search" on:click={() => { searchQuery = ''; filterUsers(); }}><IconX size={16} /></button>
            {/if}
        </div>
        
        <div class="toolbar-actions">
            <button class="filter-toggle" class:active={showFilters || activeFiltersCount > 0} on:click={() => showFilters = !showFilters}>
                <IconFilter size={18} stroke={1.5} />
                <span>Filters</span>
                {#if activeFiltersCount > 0}<span class="filter-badge">{activeFiltersCount}</span>{/if}
            </button>
            <button class="icon-action" on:click={loadUsers} title="Refresh"><IconRefresh size={18} stroke={1.5} /></button>
        </div>
    </div>

    <!-- Filters Panel -->
    {#if showFilters}
    <div class="filters-panel">
        <div class="filter-group">
            <label>Role</label>
            <select bind:value={roleFilter} on:change={loadUsers}>
                <option value="">All Roles</option>
                <option value="student">Students</option>
                <option value="staff">Staff</option>
            </select>
        </div>
        <div class="filter-group">
            <label>Department</label>
            <select bind:value={departmentFilter} on:change={loadUsers}>
                <option value="">All Departments</option>
                {#each departments as dept}<option value={dept.id}>{dept.name}</option>{/each}
            </select>
        </div>
        <div class="filter-group">
            <label>Status</label>
            <select bind:value={statusFilter} on:change={loadUsers}>
                <option value="">All Status</option>
                <option value="true">Active</option>
                <option value="false">Inactive</option>
            </select>
        </div>
        {#if activeFiltersCount > 0}
            <button class="clear-filters" on:click={clearFilters}>Clear All</button>
        {/if}
    </div>
    {/if}

    <!-- Table Container -->
    <div class="table-card">
        {#if isLoading}
            <div class="loading-state">
                <div class="loader"><IconLoader2 size={32} stroke={1.5} /></div>
                <p>Loading users...</p>
            </div>
        {:else if filteredUsers.length === 0}
            <div class="empty-state">
                <div class="empty-icon"><IconUsers size={48} stroke={1} /></div>
                <h3>No users found</h3>
                <p>Try adjusting your search or filters</p>
                <button class="action-btn primary" on:click={openAddModal}><IconPlus size={18} /> Add First User</button>
            </div>
        {:else}
            <!-- Desktop Table -->
            <div class="table-wrapper">
                <table class="users-table">
                    <thead>
                        <tr>
                            <th class="col-check">
                                <input type="checkbox" checked={selectAll} on:change={toggleSelectAll} />
                            </th>
                            <th class="col-user">User</th>
                            <th class="col-id">Digital ID</th>
                            <th class="col-role">Role</th>
                            <th class="col-dept">Department</th>
                            <th class="col-status">Status</th>
                            <th class="col-actions">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each paginatedUsers as user (user.id)}
                            <tr class:selected={selectedUsers.includes(user.id)}>
                                <td class="col-check">
                                    <input type="checkbox" checked={selectedUsers.includes(user.id)} on:change={() => toggleSelectUser(user.id)} />
                                </td>
                                <td class="col-user">
                                    <div class="user-cell">
                                        <div class="avatar" class:staff={user.role === 'staff'}>{user.name?.charAt(0) || 'U'}</div>
                                        <div class="user-info">
                                            <span class="user-name">{user.name}</span>
                                            <span class="user-email">{user.email}</span>
                                        </div>
                                    </div>
                                </td>
                                <td class="col-id"><code class="digital-id">{user.digitalId || '—'}</code></td>
                                <td class="col-role"><span class="role-badge" class:student={user.role === 'student'} class:staff={user.role === 'staff'}>{user.role || 'student'}</span></td>
                                <td class="col-dept">
                                    <div class="dept-info">
                                        <span class="dept-name">{user.department || '—'}</span>
                                        {#if user.year}<span class="dept-sub">{user.year} {user.section || ''}</span>{/if}
                                    </div>
                                </td>
                                <td class="col-status"><span class="status-badge" class:active={user.isActive !== false} class:inactive={user.isActive === false}>{user.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                                <td class="col-actions">
                                    <div class="actions-cell">
                                        <button class="action-icon" title="Edit" on:click={() => openEditModal(user)}><IconEdit size={16} stroke={1.5} /></button>
                                        <button class="action-icon" title="View as User" on:click={() => startImpersonation(user)}><IconEye size={16} stroke={1.5} /></button>
                                        <button class="action-icon" title="Reset QR" on:click={() => resetQR(user)}><IconQrcode size={16} stroke={1.5} /></button>
                                        <button class="action-icon danger-icon" title="Delete" on:click={() => { selectedUser = user; showDeleteModal = true; }}><IconTrash size={16} stroke={1.5} /></button>
                                        <div class="dropdown-wrapper">
                                            <button class="action-icon" title="More actions" on:click|stopPropagation={() => toggleDropdown(user.id)}><IconDotsVertical size={16} stroke={1.5} /></button>
                                            {#if activeDropdown === user.id}
                                                <div class="dropdown-menu" on:click|stopPropagation>
                                                    <button on:click={() => resetPassword(user)}><IconKey size={16} /> Reset Password</button>
                                                    <button on:click={() => toggleUserStatus(user)}>{#if user.isActive !== false}<IconUserX size={16} /> Deactivate{:else}<IconUserCheck size={16} /> Activate{/if}</button>
                                                    {#if $adminAuthStore.admin?.role === 'super_admin'}
                                                        <button on:click={() => { selectedUser = user; showRoleModal = true; activeDropdown = null; }}><IconShield size={16} /> Manage Role</button>
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            <!-- Mobile Cards -->
            <div class="mobile-cards">
                {#each paginatedUsers as user (user.id)}
                    <div class="user-card" class:selected={selectedUsers.includes(user.id)}>
                        <div class="card-header">
                            <input type="checkbox" checked={selectedUsers.includes(user.id)} on:change={() => toggleSelectUser(user.id)} />
                            <div class="user-cell">
                                <div class="avatar" class:staff={user.role === 'staff'}>{user.name?.charAt(0) || 'U'}</div>
                                <div class="user-info">
                                    <span class="user-name">{user.name}</span>
                                    <span class="user-email">{user.email}</span>
                                </div>
                            </div>
                            <span class="status-badge" class:active={user.isActive !== false} class:inactive={user.isActive === false}>{user.isActive !== false ? 'Active' : 'Inactive'}</span>
                        </div>
                        <div class="card-body">
                            <div class="card-row">
                                <span class="card-label">Digital ID</span>
                                <code class="digital-id">{user.digitalId || '—'}</code>
                            </div>
                            <div class="card-row">
                                <span class="card-label">Role</span>
                                <span class="role-badge" class:student={user.role === 'student'} class:staff={user.role === 'staff'}>{user.role || 'student'}</span>
                            </div>
                            <div class="card-row">
                                <span class="card-label">Department</span>
                                <span>{user.department || '—'} {user.year || ''} {user.section || ''}</span>
                            </div>
                        </div>
                        <div class="card-actions">
                            <button class="card-btn" on:click={() => openEditModal(user)}><IconEdit size={16} /> Edit</button>
                            <button class="card-btn" on:click={() => startImpersonation(user)}><IconEye size={16} /> View</button>
                            <button class="card-btn" on:click={() => resetQR(user)}><IconQrcode size={16} /> QR</button>
                            <button class="card-btn danger" on:click={() => { selectedUser = user; showDeleteModal = true; }}><IconTrash size={16} /></button>
                        </div>
                    </div>
                {/each}
            </div>

            <!-- Pagination -->
            <div class="pagination">
                <span class="page-info">Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, filteredUsers.length)} of {filteredUsers.length}</span>
                <div class="page-controls">
                    <button class="page-btn" disabled={currentPage === 1} on:click={() => currentPage--}><IconChevronLeft size={18} /></button>
                    <span class="page-num">{currentPage} / {totalPages}</span>
                    <button class="page-btn" disabled={currentPage === totalPages} on:click={() => currentPage++}><IconChevronRight size={18} /></button>
                </div>
            </div>
        {/if}
    </div>
</div>

<!-- Click outside to close dropdown -->
<svelte:window on:click={() => activeDropdown = null} />


<!-- Add/Edit Modal -->
{#if showAddModal || showEditModal}
<div class="modal-overlay" on:click={() => { showAddModal = false; showEditModal = false; }} on:keydown={(e) => e.key === 'Escape' && (showAddModal = false, showEditModal = false)} role="button" tabindex="-1">
    <div class="modal" on:click|stopPropagation role="dialog">
        <div class="modal-header">
            <h2>{showEditModal ? 'Edit User' : 'Add New User'}</h2>
            <button class="modal-close" on:click={() => { showAddModal = false; showEditModal = false; }}><IconX size={20} /></button>
        </div>
        {#if formError}<div class="alert error"><IconAlertCircle size={18} /><span>{formError}</span></div>{/if}
        <div class="modal-body">
            <div class="form-grid">
                <div class="form-field">
                    <label for="name">Full Name <span class="required">*</span></label>
                    <input id="name" type="text" bind:value={formData.name} placeholder="Enter full name" />
                </div>
                <div class="form-field">
                    <label for="email">Email Address <span class="required">*</span></label>
                    <input id="email" type="email" bind:value={formData.email} placeholder="user@example.com" disabled={showEditModal} />
                </div>
                <div class="form-field">
                    <label for="role">Role</label>
                    <select id="role" bind:value={formData.role}>
                        <option value="student">Student</option>
                        <option value="staff">Staff</option>
                    </select>
                </div>
                <div class="form-field">
                    <label for="phone">Phone Number</label>
                    <input id="phone" type="tel" bind:value={formData.phone} placeholder="+1 234 567 8900" />
                </div>
                <div class="form-field">
                    <label for="dept">Department</label>
                    <select id="dept" bind:value={formData.department}>
                        <option value="">Select Department</option>
                        {#each departments as d}<option value={d.name}>{d.name}</option>{/each}
                    </select>
                </div>
                <div class="form-field">
                    <label for="year">Year</label>
                    <select id="year" bind:value={formData.year}>
                        <option value="">Select Year</option>
                        {#each years as y}<option value={y}>{y}</option>{/each}
                    </select>
                </div>
                <div class="form-field full-width">
                    <label for="section">Section</label>
                    <select id="section" bind:value={formData.section}>
                        <option value="">Select Section</option>
                        {#each sections as s}<option value={s}>Section {s}</option>{/each}
                    </select>
                </div>
            </div>
        </div>
        <div class="modal-footer">
            <button class="modal-btn secondary" on:click={() => { showAddModal = false; showEditModal = false; }}>Cancel</button>
            <button class="modal-btn primary" on:click={saveUser} disabled={isSubmitting}>
                {#if isSubmitting}<IconLoader2 size={18} class="spin" />{/if}
                {isSubmitting ? 'Saving...' : showEditModal ? 'Update User' : 'Create User'}
            </button>
        </div>
    </div>
</div>
{/if}

<!-- Delete Modal -->
{#if showDeleteModal}
<div class="modal-overlay" on:click={() => showDeleteModal = false} on:keydown={(e) => e.key === 'Escape' && (showDeleteModal = false)} role="button" tabindex="-1">
    <div class="modal small" on:click|stopPropagation role="dialog">
        <div class="modal-header">
            <h2>Delete User</h2>
            <button class="modal-close" on:click={() => showDeleteModal = false}><IconX size={20} /></button>
        </div>
        <div class="modal-body center">
            <div class="warning-icon"><IconAlertCircle size={32} /></div>
            <p>Are you sure you want to delete <strong>{selectedUser?.name}</strong>?</p>
            <p class="warning-text">This action cannot be undone. All user data will be permanently removed.</p>
        </div>
        <div class="modal-footer">
            <button class="modal-btn secondary" on:click={() => showDeleteModal = false}>Cancel</button>
            <button class="modal-btn danger" on:click={deleteUser} disabled={isSubmitting}>
                {isSubmitting ? 'Deleting...' : 'Delete User'}
            </button>
        </div>
    </div>
</div>
{/if}

<!-- QR Modal -->
{#if showQRModal}
<div class="modal-overlay" on:click={() => showQRModal = false} on:keydown={(e) => e.key === 'Escape' && (showQRModal = false)} role="button" tabindex="-1">
    <div class="modal small" on:click|stopPropagation role="dialog">
        <div class="modal-header">
            <h2>QR Code Reset</h2>
            <button class="modal-close" on:click={() => showQRModal = false}><IconX size={20} /></button>
        </div>
        <div class="modal-body center">
            <div class="success-icon"><IconCheck size={32} /></div>
            <p>QR code has been reset for <strong>{selectedUser?.name}</strong></p>
            <div class="code-display">
                <code>{selectedUser?.qrCode}</code>
                <button class="copy-btn" on:click={() => copyToClipboard(selectedUser?.qrCode)} title="Copy"><IconCopy size={16} /></button>
            </div>
        </div>
        <div class="modal-footer center">
            <button class="modal-btn primary" on:click={() => showQRModal = false}>Done</button>
        </div>
    </div>
</div>
{/if}

<!-- Password Modal -->
{#if showPasswordModal}
<div class="modal-overlay" on:click={() => showPasswordModal = false} on:keydown={(e) => e.key === 'Escape' && (showPasswordModal = false)} role="button" tabindex="-1">
    <div class="modal small" on:click|stopPropagation role="dialog">
        <div class="modal-header">
            <h2>Password Reset</h2>
            <button class="modal-close" on:click={() => showPasswordModal = false}><IconX size={20} /></button>
        </div>
        <div class="modal-body center">
            <div class="success-icon"><IconCheck size={32} /></div>
            <p>Temporary password for <strong>{selectedUser?.name}</strong></p>
            <div class="code-display">
                <code>{tempPassword}</code>
                <button class="copy-btn" on:click={() => copyToClipboard(tempPassword)} title="Copy"><IconCopy size={16} /></button>
            </div>
            <p class="hint-text">Share this password securely with the user. They will be prompted to change it on first login.</p>
        </div>
        <div class="modal-footer center">
            <button class="modal-btn primary" on:click={() => showPasswordModal = false}>Done</button>
        </div>
    </div>
</div>
{/if}

<!-- Role Modal -->
{#if showRoleModal}
<div class="modal-overlay" on:click={() => showRoleModal = false} on:keydown={(e) => e.key === 'Escape' && (showRoleModal = false)} role="button" tabindex="-1">
    <div class="modal small" on:click|stopPropagation role="dialog">
        <div class="modal-header">
            <h2>Manage Admin Role</h2>
            <button class="modal-close" on:click={() => showRoleModal = false}><IconX size={20} /></button>
        </div>
        <div class="modal-body">
            <p>Manage admin privileges for <strong>{selectedUser?.name}</strong></p>
            <div class="role-options">
                {#if selectedUser?.isAdmin}
                    <button class="role-option demote" on:click={() => changeRole('demote')} disabled={isSubmitting}>
                        <IconShieldOff size={24} />
                        <div class="role-text">
                            <span class="role-title">Remove Admin Access</span>
                            <span class="role-desc">User will lose all admin privileges</span>
                        </div>
                    </button>
                {:else}
                    <button class="role-option promote" on:click={() => changeRole('promote')} disabled={isSubmitting}>
                        <IconShield size={24} />
                        <div class="role-text">
                            <span class="role-title">Promote to Admin</span>
                            <span class="role-desc">User will gain admin panel access</span>
                        </div>
                    </button>
                {/if}
            </div>
        </div>
        <div class="modal-footer">
            <button class="modal-btn secondary" on:click={() => showRoleModal = false}>Cancel</button>
        </div>
    </div>
</div>
{/if}

<!-- Bulk Modal -->
{#if showBulkModal}
<div class="modal-overlay" on:click={() => showBulkModal = false} on:keydown={(e) => e.key === 'Escape' && (showBulkModal = false)} role="button" tabindex="-1">
    <div class="modal" on:click|stopPropagation role="dialog">
        <div class="modal-header">
            <h2>{bulkAction === 'upload' ? 'Import Users from CSV' : 'Bulk Actions'}</h2>
            <button class="modal-close" on:click={() => showBulkModal = false}><IconX size={20} /></button>
        </div>
        <div class="modal-body">
            {#if bulkAction === 'upload'}
                <div class="upload-zone">
                    <input type="file" accept=".csv" on:change={handleCSVUpload} id="csv-upload" />
                    <label for="csv-upload" class="upload-label">
                        <IconUpload size={40} stroke={1} />
                        <span class="upload-title">Drop CSV file here or click to browse</span>
                        <span class="upload-hint">Required columns: name, email, role, department</span>
                    </label>
                </div>
                {#if csvPreview.length > 0}
                    <div class="csv-preview">
                        <h4>Preview ({csvPreview.length} rows)</h4>
                        <div class="preview-scroll">
                            <table class="preview-table">
                                <thead><tr>{#each Object.keys(csvPreview[0]) as k}<th>{k}</th>{/each}</tr></thead>
                                <tbody>{#each csvPreview as row}<tr>{#each Object.values(row) as v}<td>{v}</td>{/each}</tr>{/each}</tbody>
                            </table>
                        </div>
                    </div>
                {/if}
            {:else}
                <p class="bulk-info">Selected <strong>{selectedUsers.length}</strong> users for bulk action</p>
                <div class="bulk-options">
                    <label class="bulk-option" class:active={bulkAction === 'delete'}>
                        <input type="radio" bind:group={bulkAction} value="delete" />
                        <IconTrash size={20} />
                        <span>Delete selected users</span>
                    </label>
                    <label class="bulk-option" class:active={bulkAction === 'update'}>
                        <input type="radio" bind:group={bulkAction} value="update" />
                        <IconEdit size={20} />
                        <span>Update department/section</span>
                    </label>
                </div>
                {#if bulkAction === 'update'}
                    <div class="form-grid" style="margin-top: 16px;">
                        <div class="form-field">
                            <label for="bulk-dept">Department</label>
                            <select id="bulk-dept" bind:value={bulkDepartment}>
                                <option value="">No change</option>
                                {#each departments as d}<option value={d.name}>{d.name}</option>{/each}
                            </select>
                        </div>
                        <div class="form-field">
                            <label for="bulk-section">Section</label>
                            <select id="bulk-section" bind:value={bulkSection}>
                                <option value="">No change</option>
                                {#each sections as s}<option value={s}>Section {s}</option>{/each}
                            </select>
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
        <div class="modal-footer">
            <button class="modal-btn secondary" on:click={() => showBulkModal = false}>Cancel</button>
            {#if bulkAction === 'upload'}
                <button class="modal-btn primary" on:click={uploadCSV} disabled={!csvFile || isSubmitting}>
                    {isSubmitting ? 'Importing...' : 'Import Users'}
                </button>
            {:else}
                <button class="modal-btn {bulkAction === 'delete' ? 'danger' : 'primary'}" on:click={executeBulkAction} disabled={isSubmitting}>
                    {isSubmitting ? 'Processing...' : bulkAction === 'delete' ? 'Delete Users' : 'Update Users'}
                </button>
            {/if}
        </div>
    </div>
</div>
{/if}


<style>
    /* Page Layout */
    .users-page { padding: 24px; max-width: 1600px; margin: 0 auto; }

    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
    .stat-card { display: flex; align-items: center; gap: 16px; padding: 20px; background: var(--theme-card-bg, white); border-radius: 16px; border: 1px solid var(--theme-border-light, #e5e5ea); }
    .stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
    .stat-icon.blue { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent, #007AFF); }
    .stat-icon.green { background: rgba(52, 199, 89, 0.1); color: var(--apple-green, #34C759); }
    .stat-icon.purple { background: rgba(175, 82, 222, 0.1); color: var(--apple-purple, #AF52DE); }
    .stat-icon.orange { background: rgba(255, 149, 0, 0.1); color: var(--apple-orange, #FF9500); }
    .stat-content { display: flex; flex-direction: column; }
    .stat-value { font-size: 28px; font-weight: 700; color: var(--theme-text, #1d1d1f); line-height: 1.2; }
    .stat-label { font-size: 13px; color: var(--theme-text-secondary, #86868b); }

    /* Header */
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 16px; }
    .header-title h1 { font-size: 28px; font-weight: 700; color: var(--theme-text, #1d1d1f); margin: 0 0 4px 0; }
    .subtitle { font-size: 14px; color: var(--theme-text-secondary, #86868b); margin: 0; }
    .header-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    /* Action Buttons */
    .action-btn { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 10px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; }
    .action-btn.primary { background: var(--apple-accent, #007AFF); color: white; }
    .action-btn.primary:hover { background: #0056b3; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3); }
    .action-btn.secondary { background: var(--theme-card-bg, white); color: var(--theme-text, #1d1d1f); border: 1px solid var(--theme-border, #d1d1d6); }
    .action-btn.secondary:hover { background: var(--theme-border-light, #f5f5f7); }

    /* Toolbar */
    .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
    .search-wrapper { display: flex; align-items: center; gap: 12px; flex: 1; max-width: 400px; padding: 10px 16px; background: var(--theme-card-bg, white); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 12px; transition: all 0.2s; }
    .search-wrapper:focus-within { border-color: var(--apple-accent, #007AFF); box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1); }
    .search-wrapper input { flex: 1; border: none; background: none; outline: none; font-size: 14px; color: var(--theme-text, #1d1d1f); }
    .search-wrapper input::placeholder { color: var(--theme-text-secondary, #86868b); }
    .clear-search { background: none; border: none; color: var(--theme-text-secondary); cursor: pointer; padding: 4px; border-radius: 50%; }
    .clear-search:hover { background: var(--theme-border-light); }
    .toolbar-actions { display: flex; gap: 10px; align-items: center; }
    .filter-toggle { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--theme-card-bg, white); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 10px; font-size: 14px; color: var(--theme-text, #1d1d1f); cursor: pointer; transition: all 0.2s; }
    .filter-toggle.active { background: var(--apple-accent, #007AFF); color: white; border-color: var(--apple-accent); }
    .filter-badge { min-width: 18px; height: 18px; background: var(--apple-red, #FF3B30); color: white; font-size: 11px; font-weight: 600; border-radius: 9px; display: flex; align-items: center; justify-content: center; }
    .filter-toggle.active .filter-badge { background: white; color: var(--apple-accent); }
    .icon-action { width: 40px; height: 40px; background: var(--theme-card-bg, white); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: var(--theme-text-secondary); cursor: pointer; transition: all 0.2s; }
    .icon-action:hover { background: var(--theme-border-light); color: var(--theme-text); }

    /* Filters Panel */
    .filters-panel { display: flex; gap: 12px; padding: 16px; background: var(--theme-card-bg, white); border: 1px solid var(--theme-border-light, #e5e5ea); border-radius: 12px; margin-bottom: 16px; flex-wrap: wrap; align-items: flex-end; animation: slideDown 0.2s ease; }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    .filter-group { display: flex; flex-direction: column; gap: 6px; min-width: 160px; }
    .filter-group label { font-size: 12px; font-weight: 500; color: var(--theme-text-secondary, #86868b); }
    .filter-group select { padding: 10px 12px; background: var(--theme-bg, #f5f5f7); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 8px; font-size: 14px; color: var(--theme-text, #1d1d1f); cursor: pointer; }
    .clear-filters { padding: 10px 16px; background: none; border: none; color: var(--apple-accent, #007AFF); font-size: 14px; font-weight: 500; cursor: pointer; }
    .clear-filters:hover { text-decoration: underline; }

    /* Table Card */
    .table-card { background: var(--theme-card-bg, white); border-radius: 16px; border: 1px solid var(--theme-border-light, #e5e5ea); overflow: hidden; }
    .loading-state, .empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center; }
    .loader { animation: spin 1s linear infinite; color: var(--apple-accent, #007AFF); }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-state p, .empty-state p { color: var(--theme-text-secondary, #86868b); margin: 12px 0 0 0; }
    .empty-icon { width: 80px; height: 80px; background: var(--theme-bg, #f5f5f7); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--theme-text-secondary); margin-bottom: 16px; }
    .empty-state h3 { font-size: 18px; font-weight: 600; color: var(--theme-text, #1d1d1f); margin: 0 0 8px 0; }
    .empty-state .action-btn { margin-top: 20px; }

    /* Table */
    .table-wrapper { overflow-x: auto; }
    .users-table { width: 100%; border-collapse: collapse; }
    .users-table th, .users-table td { padding: 14px 16px; text-align: left; border-bottom: 1px solid var(--theme-border-light, #e5e5ea); }
    .users-table th { font-size: 12px; font-weight: 600; color: var(--theme-text-secondary, #86868b); text-transform: uppercase; letter-spacing: 0.5px; background: var(--theme-bg, #f5f5f7); position: sticky; top: 0; }
    .users-table tbody tr { transition: background 0.15s; }
    .users-table tbody tr:hover { background: var(--theme-bg, #f5f5f7); }
    .users-table tbody tr.selected { background: rgba(0, 122, 255, 0.08); }
    .col-check { width: 40px; }
    .col-check input[type="checkbox"] { width: 18px; height: 18px; cursor: pointer; accent-color: var(--apple-accent, #007AFF); }
    .col-user { min-width: 200px; }
    .col-id { min-width: 120px; }
    .col-role { min-width: 100px; }
    .col-dept { min-width: 150px; }
    .col-status { min-width: 100px; }
    .col-actions { width: 180px; }

    /* User Cell */
    .user-cell { display: flex; align-items: center; gap: 12px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--apple-accent, #007AFF), #5856D6); color: white; display: flex; align-items: center; justify-content: center; font-size: 16px; font-weight: 600; flex-shrink: 0; }
    .avatar.staff { background: linear-gradient(135deg, var(--apple-purple, #AF52DE), #5856D6); }
    .user-info { display: flex; flex-direction: column; min-width: 0; }
    .user-name { font-size: 14px; font-weight: 500; color: var(--theme-text, #1d1d1f); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-email { font-size: 12px; color: var(--theme-text-secondary, #86868b); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

    /* Badges */
    .digital-id { font-size: 12px; padding: 4px 8px; background: var(--theme-bg, #f5f5f7); border-radius: 6px; font-family: 'SF Mono', monospace; }
    .role-badge { display: inline-flex; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; text-transform: capitalize; }
    .role-badge.student { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent, #007AFF); }
    .role-badge.staff { background: rgba(175, 82, 222, 0.1); color: var(--apple-purple, #AF52DE); }
    .status-badge { display: inline-flex; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; }
    .status-badge.active { background: rgba(52, 199, 89, 0.1); color: var(--apple-green, #34C759); }
    .status-badge.inactive { background: rgba(255, 59, 48, 0.1); color: var(--apple-red, #FF3B30); }
    .dept-info { display: flex; flex-direction: column; }
    .dept-name { font-size: 14px; color: var(--theme-text, #1d1d1f); }
    .dept-sub { font-size: 12px; color: var(--theme-text-secondary, #86868b); }

    /* Actions */
    .actions-cell { display: flex; align-items: center; gap: 4px; }
    .action-icon { width: 32px; height: 32px; border: none; background: transparent; color: var(--theme-text-secondary, #86868b); border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
    .action-icon:hover { background: var(--theme-bg, #f5f5f7); color: var(--theme-text, #1d1d1f); }
    .action-icon.danger-icon:hover { background: rgba(255, 59, 48, 0.1); color: var(--apple-red, #FF3B30); }
    .dropdown-wrapper { position: relative; }
    .dropdown-menu { position: absolute; top: 100%; right: 0; min-width: 180px; background: var(--theme-card-bg, white); border: 1px solid var(--theme-border-light, #e5e5ea); border-radius: 12px; box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12); z-index: 100; padding: 6px; animation: fadeIn 0.15s ease; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
    .dropdown-menu button { width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: none; background: none; font-size: 14px; color: var(--theme-text, #1d1d1f); border-radius: 8px; cursor: pointer; transition: background 0.15s; }
    .dropdown-menu button:hover { background: var(--theme-bg, #f5f5f7); }
    .dropdown-menu button.danger { color: var(--apple-red, #FF3B30); }
    .dropdown-menu button.danger:hover { background: rgba(255, 59, 48, 0.1); }
    .dropdown-menu hr { border: none; border-top: 1px solid var(--theme-border-light, #e5e5ea); margin: 6px 0; }

    /* Mobile Cards */
    .mobile-cards { display: none; padding: 16px; }
    .user-card { background: var(--theme-card-bg, white); border: 1px solid var(--theme-border-light, #e5e5ea); border-radius: 14px; padding: 16px; margin-bottom: 12px; transition: all 0.2s; }
    .user-card.selected { border-color: var(--apple-accent, #007AFF); background: rgba(0, 122, 255, 0.04); }
    .card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
    .card-header .user-cell { flex: 1; }
    .card-body { display: flex; flex-direction: column; gap: 8px; padding: 12px 0; border-top: 1px solid var(--theme-border-light, #e5e5ea); border-bottom: 1px solid var(--theme-border-light, #e5e5ea); }
    .card-row { display: flex; justify-content: space-between; align-items: center; }
    .card-label { font-size: 12px; color: var(--theme-text-secondary, #86868b); }
    .card-actions { display: flex; gap: 8px; margin-top: 12px; }
    .card-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 10px; background: var(--theme-bg, #f5f5f7); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 10px; font-size: 13px; color: var(--theme-text, #1d1d1f); cursor: pointer; transition: all 0.15s; }
    .card-btn:hover { background: var(--theme-border-light, #e5e5ea); }
    .card-btn.danger { color: var(--apple-red, #FF3B30); border-color: rgba(255, 59, 48, 0.3); }
    .card-btn.danger:hover { background: rgba(255, 59, 48, 0.1); }

    /* Pagination */
    .pagination { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-top: 1px solid var(--theme-border-light, #e5e5ea); }
    .page-info { font-size: 13px; color: var(--theme-text-secondary, #86868b); }
    .page-controls { display: flex; align-items: center; gap: 8px; }
    .page-btn { width: 36px; height: 36px; border: 1px solid var(--theme-border, #d1d1d6); background: var(--theme-card-bg, white); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--theme-text, #1d1d1f); cursor: pointer; transition: all 0.15s; }
    .page-btn:hover:not(:disabled) { background: var(--theme-bg, #f5f5f7); }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-num { font-size: 14px; font-weight: 500; color: var(--theme-text, #1d1d1f); padding: 0 12px; }

    /* Modals */
    .modal-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; animation: fadeIn 0.2s ease; }
    .modal { width: 100%; max-width: 520px; max-height: 90vh; background: var(--theme-card-bg, white); border-radius: 20px; overflow: hidden; display: flex; flex-direction: column; animation: modalSlide 0.3s cubic-bezier(0.25, 0.1, 0.25, 1); }
    .modal.small { max-width: 400px; }
    @keyframes modalSlide { from { opacity: 0; transform: scale(0.95) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--theme-border-light, #e5e5ea); }
    .modal-header h2 { font-size: 18px; font-weight: 600; color: var(--theme-text, #1d1d1f); margin: 0; }
    .modal-close { width: 32px; height: 32px; border: none; background: var(--theme-bg, #f5f5f7); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--theme-text-secondary); cursor: pointer; transition: all 0.15s; }
    .modal-close:hover { background: var(--theme-border-light, #e5e5ea); color: var(--theme-text); }
    .modal-body { padding: 24px; overflow-y: auto; flex: 1; }
    .modal-body.center { text-align: center; }
    .modal-footer { display: flex; justify-content: flex-end; gap: 12px; padding: 16px 24px; border-top: 1px solid var(--theme-border-light, #e5e5ea); }
    .modal-footer.center { justify-content: center; }
    .modal-btn { padding: 12px 24px; border-radius: 12px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; border: none; }
    .modal-btn.primary { background: var(--apple-accent, #007AFF); color: white; }
    .modal-btn.primary:hover { background: #0056b3; }
    .modal-btn.secondary { background: var(--theme-bg, #f5f5f7); color: var(--theme-text, #1d1d1f); }
    .modal-btn.secondary:hover { background: var(--theme-border-light, #e5e5ea); }
    .modal-btn.danger { background: var(--apple-red, #FF3B30); color: white; }
    .modal-btn.danger:hover { background: #d32f2f; }
    .modal-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    /* Form */
    .form-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; }
    .form-field { display: flex; flex-direction: column; gap: 6px; }
    .form-field.full-width { grid-column: span 2; }
    .form-field label { font-size: 13px; font-weight: 500; color: var(--theme-text, #1d1d1f); }
    .form-field .required { color: var(--apple-red, #FF3B30); }
    .form-field input, .form-field select { padding: 12px 14px; background: var(--theme-bg, #f5f5f7); border: 1px solid var(--theme-border, #d1d1d6); border-radius: 10px; font-size: 14px; color: var(--theme-text, #1d1d1f); transition: all 0.2s; }
    .form-field input:focus, .form-field select:focus { outline: none; border-color: var(--apple-accent, #007AFF); box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1); }
    .form-field input:disabled { opacity: 0.6; cursor: not-allowed; }
    .alert { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 10px; margin-bottom: 16px; font-size: 14px; }
    .alert.error { background: rgba(255, 59, 48, 0.1); color: var(--apple-red, #FF3B30); }

    /* Modal Specific */
    .warning-icon { width: 64px; height: 64px; background: rgba(255, 149, 0, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--apple-orange, #FF9500); margin: 0 auto 16px; }
    .success-icon { width: 64px; height: 64px; background: rgba(52, 199, 89, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--apple-green, #34C759); margin: 0 auto 16px; }
    .warning-text { font-size: 13px; color: var(--theme-text-secondary, #86868b); margin-top: 8px; }
    .hint-text { font-size: 12px; color: var(--theme-text-secondary, #86868b); margin-top: 12px; }
    .code-display { display: flex; align-items: center; gap: 8px; padding: 12px 16px; background: var(--theme-bg, #f5f5f7); border-radius: 10px; margin-top: 16px; }
    .code-display code { flex: 1; font-size: 16px; font-weight: 600; font-family: 'SF Mono', monospace; color: var(--theme-text, #1d1d1f); }
    .copy-btn { width: 36px; height: 36px; border: none; background: var(--theme-card-bg, white); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--theme-text-secondary); cursor: pointer; transition: all 0.15s; }
    .copy-btn:hover { background: var(--theme-border-light); color: var(--apple-accent, #007AFF); }

    /* Role Options */
    .role-options { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
    .role-option { display: flex; align-items: center; gap: 16px; padding: 16px; background: var(--theme-bg, #f5f5f7); border: 2px solid transparent; border-radius: 14px; cursor: pointer; transition: all 0.2s; }
    .role-option:hover { border-color: var(--theme-border, #d1d1d6); }
    .role-option.promote { color: var(--apple-green, #34C759); }
    .role-option.demote { color: var(--apple-red, #FF3B30); }
    .role-text { display: flex; flex-direction: column; }
    .role-title { font-size: 15px; font-weight: 600; color: var(--theme-text, #1d1d1f); }
    .role-desc { font-size: 13px; color: var(--theme-text-secondary, #86868b); }

    /* Bulk Options */
    .bulk-info { font-size: 14px; color: var(--theme-text, #1d1d1f); margin-bottom: 16px; }
    .bulk-options { display: flex; flex-direction: column; gap: 10px; }
    .bulk-option { display: flex; align-items: center; gap: 12px; padding: 14px 16px; background: var(--theme-bg, #f5f5f7); border: 2px solid transparent; border-radius: 12px; cursor: pointer; transition: all 0.2s; }
    .bulk-option:hover { border-color: var(--theme-border, #d1d1d6); }
    .bulk-option.active { border-color: var(--apple-accent, #007AFF); background: rgba(0, 122, 255, 0.05); }
    .bulk-option input { display: none; }
    .bulk-option span { font-size: 14px; color: var(--theme-text, #1d1d1f); }

    /* Upload Zone */
    .upload-zone { position: relative; }
    .upload-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .upload-label { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; border: 2px dashed var(--theme-border, #d1d1d6); border-radius: 16px; text-align: center; color: var(--theme-text-secondary, #86868b); transition: all 0.2s; cursor: pointer; }
    .upload-zone:hover .upload-label { border-color: var(--apple-accent, #007AFF); background: rgba(0, 122, 255, 0.02); }
    .upload-title { font-size: 15px; font-weight: 500; color: var(--theme-text, #1d1d1f); margin-top: 12px; }
    .upload-hint { font-size: 12px; margin-top: 4px; }
    .csv-preview { margin-top: 20px; }
    .csv-preview h4 { font-size: 14px; font-weight: 600; color: var(--theme-text, #1d1d1f); margin: 0 0 12px 0; }
    .preview-scroll { overflow-x: auto; border: 1px solid var(--theme-border-light, #e5e5ea); border-radius: 10px; }
    .preview-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .preview-table th, .preview-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--theme-border-light, #e5e5ea); }
    .preview-table th { background: var(--theme-bg, #f5f5f7); font-weight: 600; color: var(--theme-text-secondary); }

    /* Responsive */
    @media (max-width: 1024px) {
        .stats-grid { grid-template-columns: repeat(2, 1fr); }
        .col-dept, .col-id { display: none; }
    }

    @media (max-width: 768px) {
        .users-page { padding: 16px; }
        .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
        .stat-card { padding: 16px; }
        .stat-value { font-size: 24px; }
        .page-header { flex-direction: column; align-items: stretch; }
        .header-actions { justify-content: flex-start; }
        .action-btn .btn-text { display: none; }
        .action-btn { padding: 10px 12px; }
        .toolbar { flex-direction: column; }
        .search-wrapper { max-width: 100%; }
        .filters-panel { flex-direction: column; }
        .filter-group { min-width: 100%; }
        .table-wrapper { display: none; }
        .mobile-cards { display: block; }
        .pagination { flex-direction: column; gap: 12px; }
        .form-grid { grid-template-columns: 1fr; }
        .form-field.full-width { grid-column: span 1; }
        .modal { max-width: 100%; margin: 10px; border-radius: 16px; }
    }

    @media (max-width: 480px) {
        .stats-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
        .stat-card { flex-direction: column; text-align: center; gap: 8px; padding: 14px; }
        .stat-icon { width: 40px; height: 40px; }
        .header-title h1 { font-size: 24px; }
        .card-actions { flex-wrap: wrap; }
        .card-btn { min-width: calc(50% - 4px); }
    }

    /* Dark Mode */
    :global([data-theme="dark"]) .table-card,
    :global([data-theme="dark"]) .modal,
    :global([data-theme="dark"]) .dropdown-menu,
    :global([data-theme="amethyst"]) .table-card,
    :global([data-theme="amethyst"]) .modal,
    :global([data-theme="amethyst"]) .dropdown-menu,
    :global([data-theme="oled"]) .table-card,
    :global([data-theme="oled"]) .modal,
    :global([data-theme="oled"]) .dropdown-menu {
        background: var(--theme-card-bg, #1c1c1e);
        border-color: var(--theme-border, #38383a);
    }

    :global([data-theme="dark"]) .users-table th,
    :global([data-theme="amethyst"]) .users-table th,
    :global([data-theme="oled"]) .users-table th {
        background: var(--theme-bg, #000);
    }

    :global([data-theme="dark"]) .user-card,
    :global([data-theme="amethyst"]) .user-card,
    :global([data-theme="oled"]) .user-card {
        background: var(--theme-card-bg, #1c1c1e);
        border-color: var(--theme-border, #38383a);
    }
</style>
