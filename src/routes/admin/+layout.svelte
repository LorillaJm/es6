<script>
    import { browser } from "$app/environment";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { onMount, onDestroy } from "svelte";
    import { adminAuthStore, adminPermissions, hasPermission, PERMISSIONS } from "$lib/stores/adminAuth.js";
    import { themeStore } from "$lib/stores/theme.js";
    import { IconMenu2, IconX, IconHome, IconUsers, IconClockHour4, IconFileAnalytics, IconMessageCircle, IconSpeakerphone, IconSettings, IconShield, IconHistory, IconLogout, IconChevronRight, IconLock, IconTestPipe } from "@tabler/icons-svelte";
    import HybridChatbot from "$lib/components/HybridChatbot.svelte";
    import { CHATBOT_ROLES } from "$lib/stores/chatbot";

    let sidebarOpen = false;
    let tokenRefreshInterval;

    $: isPublicPage = $page.url.pathname === '/admin/login' || $page.url.pathname === '/admin/setup';

    const navSections = [
        { title: 'Main', items: [
            { href: '/admin/dashboard', icon: IconHome, label: 'Dashboard', permission: null },
            { href: '/admin/mobile', icon: IconMenu2, label: 'Quick Admin', permission: null, mobileOnly: true }
        ]},
        { title: 'Management', items: [
            { href: '/admin/users', icon: IconUsers, label: 'Users', permission: PERMISSIONS.MANAGE_USERS },
            { href: '/admin/attendance', icon: IconClockHour4, label: 'Attendance', permission: PERMISSIONS.VIEW_ATTENDANCE },
            { href: '/admin/reports', icon: IconFileAnalytics, label: 'Reports', permission: PERMISSIONS.ACCESS_REPORTS }
        ]},
        { title: 'Communication', items: [
            { href: '/admin/feedback', icon: IconMessageCircle, label: 'Feedback', permission: PERMISSIONS.MANAGE_FEEDBACK },
            { href: '/admin/announcements', icon: IconSpeakerphone, label: 'Announcements', permission: PERMISSIONS.MANAGE_ANNOUNCEMENTS }
        ]},
        { title: 'System', items: [
            { href: '/admin/settings', icon: IconSettings, label: 'System Settings', permission: PERMISSIONS.MANAGE_SYSTEM_SETTINGS },
            { href: '/admin/security', icon: IconShield, label: 'Security', permission: PERMISSIONS.MANAGE_SECURITY },
            { href: '/admin/audit-logs', icon: IconHistory, label: 'Audit Logs', permission: PERMISSIONS.VIEW_AUDIT_LOGS },
            { href: '/admin/qa-testing', icon: IconTestPipe, label: 'QA Testing', permission: PERMISSIONS.MANAGE_SYSTEM_SETTINGS }
        ]}
    ];

    $: filteredNavSections = navSections.map(section => ({
        ...section,
        items: section.items.filter(item => !item.permission || hasPermission($adminPermissions, item.permission))
    })).filter(section => section.items.length > 0);

    onMount(async () => {
        if (!browser) return;
        themeStore.init();
        if (isPublicPage) { adminAuthStore.setLoading(false); return; }

        const { accessToken, refreshToken } = adminAuthStore.getStoredTokens();
        if (accessToken) {
            try {
                const response = await fetch('/api/admin/auth/verify', { headers: { 'Authorization': `Bearer ${accessToken}` } });
                if (response.ok) {
                    const data = await response.json();
                    adminAuthStore.setAdmin(data.admin, { accessToken, refreshToken });
                } else if (refreshToken) {
                    await refreshTokens(refreshToken);
                } else {
                    adminAuthStore.logout(); goto('/admin/login');
                }
            } catch (error) { adminAuthStore.logout(); goto('/admin/login'); }
        } else { adminAuthStore.setLoading(false); goto('/admin/login'); }

        tokenRefreshInterval = setInterval(async () => {
            const { refreshToken } = adminAuthStore.getStoredTokens();
            if (refreshToken) await refreshTokens(refreshToken);
        }, 10 * 60 * 1000);
    });

    onDestroy(() => { if (tokenRefreshInterval) clearInterval(tokenRefreshInterval); });

    async function refreshTokens(rt) {
        try {
            const response = await fetch('/api/admin/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: rt }) });
            if (response.ok) adminAuthStore.updateTokens(await response.json());
            else { adminAuthStore.logout(); goto('/admin/login'); }
        } catch (e) { console.error('Token refresh failed:', e); }
    }

    async function handleLogout() {
        try {
            const { accessToken, refreshToken } = adminAuthStore.getStoredTokens();
            await fetch('/api/admin/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` }, body: JSON.stringify({ refreshToken }) });
        } catch (e) {}
        adminAuthStore.logout(); goto('/admin/login');
    }

    function isActive(href) { return $page.url.pathname === href || $page.url.pathname.startsWith(href + '/'); }
    function closeSidebar() { sidebarOpen = false; }
</script>

{#if isPublicPage}
    <slot />
{:else if $adminAuthStore.isLoading}
    <div class="loading-screen">
        <div class="loading-spinner"></div>
        <p>Loading admin panel...</p>
    </div>
{:else if !$adminAuthStore.isAuthenticated}
    <div class="access-denied">
        <IconLock size={48} stroke={1.5} />
        <h2>Access Denied</h2>
        <p>Redirecting to login...</p>
    </div>
{:else}
    <div class="admin-layout" class:sidebar-open={sidebarOpen}>
        <!-- Mobile Header -->
        <header class="mobile-header">
            <button class="menu-toggle" on:click={() => sidebarOpen = !sidebarOpen}>
                {#if sidebarOpen}
                    <IconX size={24} stroke={1.5} />
                {:else}
                    <IconMenu2 size={24} stroke={1.5} />
                {/if}
            </button>
            <span class="mobile-title">Admin Panel</span>
        </header>

        <!-- Sidebar Overlay -->
        <div class="sidebar-overlay" on:click={closeSidebar} on:keydown={(e) => e.key === 'Escape' && closeSidebar()} role="button" tabindex="-1"></div>

        <!-- Sidebar -->
        <aside class="sidebar">
            <div class="sidebar-header">
                <div class="logo">
                    <div class="logo-icon">
                        <IconShield size={24} stroke={1.5} />
                    </div>
                    <span class="logo-text">Admin Panel</span>
                </div>
            </div>

            <nav class="sidebar-nav">
                {#each filteredNavSections as section}
                    <div class="nav-section">
                        <p class="nav-section-title">{section.title}</p>
                        {#each section.items as item}
                            <a href={item.href} class="nav-item" class:active={isActive(item.href)} on:click={closeSidebar}>
                                <svelte:component this={item.icon} size={20} stroke={1.5} />
                                <span>{item.label}</span>
                                {#if isActive(item.href)}
                                    <IconChevronRight size={16} stroke={2} />
                                {/if}
                            </a>
                        {/each}
                    </div>
                {/each}
            </nav>

            <div class="sidebar-footer">
                <div class="admin-info">
                    <div class="admin-avatar">
                        {($adminAuthStore.admin?.name || 'A').charAt(0).toUpperCase()}
                    </div>
                    <div class="admin-details">
                        <p class="admin-name">{$adminAuthStore.admin?.name || 'Admin'}</p>
                        <p class="admin-role">{$adminAuthStore.admin?.role === 'super_admin' ? 'Super Admin' : 'Admin'}</p>
                    </div>
                </div>
                <button class="logout-btn" on:click={handleLogout}>
                    <IconLogout size={20} stroke={1.5} />
                    <span>Logout</span>
                </button>
            </div>
        </aside>

        <!-- Main Content -->
        <main class="main-content">
            <slot />
        </main>
    </div>

    <!-- Hybrid AI Admin Assistant -->
    <HybridChatbot 
        role={CHATBOT_ROLES.ADMIN} 
        userId={$adminAuthStore.admin?.id} 
        userProfile={{ name: $adminAuthStore.admin?.name, role: $adminAuthStore.admin?.role }}
    />
{/if}


<style>
    .loading-screen, .access-denied {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        background: var(--theme-bg, var(--apple-gray-6));
        color: var(--theme-text-secondary, var(--apple-gray-1));
    }

    .loading-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--theme-border, var(--apple-gray-4));
        border-top-color: var(--apple-accent);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .admin-layout {
        display: flex;
        min-height: 100vh;
        background: var(--theme-bg, var(--apple-gray-6));
    }

    /* Mobile Header */
    .mobile-header {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 56px;
        background: var(--theme-card-bg, var(--apple-white));
        border-bottom: 1px solid var(--theme-border, var(--apple-gray-4));
        padding: 0 16px;
        align-items: center;
        gap: 12px;
        z-index: 100;
    }

    .menu-toggle {
        background: none;
        border: none;
        padding: 8px;
        cursor: pointer;
        color: var(--theme-text, var(--apple-black));
        border-radius: var(--apple-radius-sm);
    }

    .menu-toggle:hover {
        background: var(--theme-border-light, var(--apple-gray-5));
    }

    .mobile-title {
        font-size: 17px;
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
    }

    /* Sidebar Overlay */
    .sidebar-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 199;
    }

    /* Sidebar */
    .sidebar {
        width: 260px;
        background: var(--theme-card-bg, var(--apple-white));
        border-right: 1px solid var(--theme-border, var(--apple-gray-4));
        display: flex;
        flex-direction: column;
        position: fixed;
        top: 0;
        left: 0;
        bottom: 0;
        z-index: 200;
    }

    .sidebar-header {
        padding: 20px;
        border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5));
    }

    .logo {
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .logo-icon {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, var(--apple-accent), var(--apple-purple));
        border-radius: var(--apple-radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .logo-text {
        font-size: 18px;
        font-weight: 700;
        color: var(--theme-text, var(--apple-black));
    }

    .sidebar-nav {
        flex: 1;
        overflow-y: auto;
        padding: 16px 12px;
    }

    .nav-section {
        margin-bottom: 24px;
    }

    .nav-section-title {
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        padding: 0 12px;
        margin-bottom: 8px;
    }

    .nav-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 12px;
        border-radius: var(--apple-radius-md);
        color: var(--theme-text-secondary, var(--apple-gray-1));
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition: var(--apple-transition);
    }

    .nav-item:hover {
        background: var(--theme-border-light, var(--apple-gray-5));
        color: var(--theme-text, var(--apple-black));
    }

    .nav-item.active {
        background: var(--apple-accent);
        color: white;
    }

    .nav-item.active :global(svg:last-child) {
        margin-left: auto;
    }

    .sidebar-footer {
        padding: 16px;
        border-top: 1px solid var(--theme-border-light, var(--apple-gray-5));
    }

    .admin-info {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
    }

    .admin-avatar {
        width: 40px;
        height: 40px;
        background: linear-gradient(135deg, var(--apple-accent), var(--apple-purple));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 16px;
    }

    .admin-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
    }

    .admin-role {
        font-size: 12px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
    }

    .logout-btn {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px;
        background: var(--theme-border-light, var(--apple-gray-5));
        border: none;
        border-radius: var(--apple-radius-md);
        color: var(--apple-red);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .logout-btn:hover {
        background: rgba(255, 59, 48, 0.1);
    }

    /* Main Content */
    .main-content {
        flex: 1;
        margin-left: 260px;
        min-height: 100vh;
    }

    /* Responsive */
    @media (max-width: 768px) {
        .mobile-header {
            display: flex;
        }

        .sidebar {
            transform: translateX(-100%);
            transition: transform 0.3s ease;
        }

        .admin-layout.sidebar-open .sidebar {
            transform: translateX(0);
        }

        .admin-layout.sidebar-open .sidebar-overlay {
            display: block;
        }

        .main-content {
            margin-left: 0;
            padding-top: 56px;
        }
    }
</style>
