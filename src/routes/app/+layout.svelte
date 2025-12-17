<script>
    import { browser } from "$app/environment";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { onMount, onDestroy } from "svelte";
    import { auth, getUserProfile } from "$lib/firebase";
    import { themeStore } from "$lib/stores/theme.js";
    import { seasonalPrefs, activeHoliday } from "$lib/stores/seasonalTheme.js";
    import { isImpersonating, impersonatedUser } from "$lib/stores/impersonation.js";
    import { SeasonalEffects, SeasonalDecorations, SeasonalProfileBadge, SeasonalLoginCelebration, ChristmasExtras, ChristmasNavSnowflakes, SeasonalIntroduction } from "$lib/components/seasonal";
    import { IconMenu2, IconX, IconClockPin, IconListDetails, IconHome, IconUser, IconLogout, IconChevronRight, IconChartBar, IconTrophy, IconId } from "@tabler/icons-svelte";
    import AppInstallPrompt from "$lib/components/AppInstallPrompt.svelte";
    import DeepLinkHandler from "$lib/components/DeepLinkHandler.svelte";
    import ImpersonationBanner from "$lib/components/admin/ImpersonationBanner.svelte";
    import HolidayBanner from "$lib/components/HolidayBanner.svelte";
    import HybridChatbot from "$lib/components/HybridChatbot.svelte";
    import { CHATBOT_ROLES } from "$lib/stores/chatbot";
    import { startNotificationListener, stopNotificationListener } from "$lib/services/realtimeNotificationService";
    import { initPushNotifications } from "$lib/notifications/pushNotificationService";
    import { registerFCMToken } from "$lib/services/fcmService";
    import ToastContainer from "$lib/components/ToastContainer.svelte";

    let user = null;
    let userProfile = null;
    let isCheckingAuth = true;
    let sidebarOpen = false;
    let showLoginCelebration = false;
    let showSeasonalIntro = false;
    let notificationListenerActive = false;

    async function checkEmailVerification(userId) {
        try {
            const response = await fetch(`/api/auth/verify-email/status?userId=${userId}`);
            const data = await response.json();
            return data.verified === true;
        } catch (error) {
            console.error('Error checking email verification:', error);
            return true; // Assume verified on error to not block users
        }
    }

    onMount(() => {
        if (!browser || !auth) {
            isCheckingAuth = false;
            goto('/');
            return;
        }

        // Initialize theme
        themeStore.init();
    
        const unsubscribe = auth.onAuthStateChanged(async (u) => {
            if (!u) {
                goto('/');
                return;
            }

            user = u;

            try {
                userProfile = await getUserProfile(u.uid);
                if (!userProfile) {
                    goto('/');
                    return;
                }
                
                // Check email verification for users who haven't verified yet
                if (!userProfile.emailVerified) {
                    const isVerified = await checkEmailVerification(u.uid);
                    if (!isVerified) {
                        // Redirect to email verification page
                        goto('/verify-email');
                        return;
                    }
                }
                
                // Show seasonal celebration on login if holiday is active
                if ($activeHoliday && $seasonalPrefs.enabled) {
                    showLoginCelebration = true;
                }
                
                // Show seasonal intro for first-time users (if not seen and not enabled)
                if (!$seasonalPrefs.hasSeenIntro && !$seasonalPrefs.enabled) {
                    // Delay showing intro to let the page load first
                    setTimeout(() => {
                        showSeasonalIntro = true;
                    }, 1500);
                }
                
                // Initialize real-time push notifications for announcements
                initPushNotifications().then(result => {
                    if (result.success) {
                        // Start listening for real-time notifications
                        startNotificationListener(u.uid);
                        notificationListenerActive = true;
                        console.log('Real-time announcement notifications enabled');
                        
                        // Register FCM token for background push notifications
                        registerFCMToken(u.uid).then(fcmResult => {
                            if (fcmResult.success) {
                                console.log('FCM token registered for background notifications');
                            } else {
                                console.warn('FCM registration failed:', fcmResult.error);
                            }
                        });
                    }
                });
            } catch (error) {
                console.error("Error loading profile:", error);
            }

            isCheckingAuth = false;
        });

        return unsubscribe;
    });
    
    // Cleanup notification listener on component destroy
    onDestroy(() => {
        if (notificationListenerActive && user?.uid) {
            stopNotificationListener(user.uid);
        }
    });

    async function handleLogout() {
        try {
            await auth.signOut();
            goto('/');
        } catch (err) {
            console.error("Logout error:", err);
        }
    }

    const navLinks = [
        { href: '/app/dashboard', icon: IconHome, label: 'Dashboard' },
        { href: '/app/attendance', icon: IconClockPin, label: 'Attendance' },
        { href: '/app/epass', icon: IconId, label: 'E-Pass' },
        { href: '/app/history', icon: IconListDetails, label: 'History' },
        { href: '/app/analytics', icon: IconChartBar, label: 'Analytics' },
        { href: '/app/gamification', icon: IconTrophy, label: 'Achievements' },
        { href: '/app/profile', icon: IconUser, label: 'Profile' }
    ];

    function isActive(href) {
        return $page.url.pathname === href;
    }

    function closeSidebar() {
        sidebarOpen = false;
    }
</script>

{#if isCheckingAuth}
<!-- Loading State -->
<div class="loading-screen">
    <div class="loading-content apple-animate-in">
        <div class="apple-spinner"></div>
        <p class="loading-text">Loading...</p>
        <p class="loading-subtext">Preparing your workspace</p>
    </div>
</div>

{:else if user && userProfile}

<!-- Mobile Header -->
<header class="mobile-header">
    <div class="mobile-header-content">
        <div class="mobile-brand">
            <img src="/logo.png" alt="Logo" class="brand-logo" />
            <span class="brand-text">Student Attendance</span>
        </div>
        <button class="menu-btn" on:click={() => (sidebarOpen = true)} aria-label="Open menu">
            <IconMenu2 size={24} stroke={1.5} />
        </button>
    </div>
</header>

<div class="app-layout">
    <!-- Mobile Overlay -->
    {#if sidebarOpen}
        <div class="sidebar-overlay" on:click={closeSidebar} on:keydown={closeSidebar} role="button" tabindex="0" aria-label="Close sidebar"></div>
    {/if}

    <!-- Sidebar -->
    <aside class="sidebar" class:sidebar-open={sidebarOpen}>
        <!-- Sidebar Header -->
        <div class="sidebar-header">
            <div class="sidebar-brand-wrapper">
                <img src="/logo.png" alt="Logo" class="sidebar-logo" />
                <span class="sidebar-brand">Student Attendance</span>
            </div>
            <button class="close-btn" on:click={closeSidebar} aria-label="Close menu">
                <IconX size={20} stroke={1.5} />
            </button>
        </div>

        <!-- User Profile Section -->
        <div class="sidebar-profile">
            <SeasonalProfileBadge 
                size={44}
                src={userProfile?.profilePhoto || user.photoURL}
                fallback={userProfile.name?.charAt(0) || 'U'}
            />
            <div class="profile-info">
                <p class="profile-name">{userProfile.name}</p>
                <p class="profile-role">{userProfile.departmentOrCourse}</p>
            </div>
        </div>

        <!-- Navigation -->
        <nav class="sidebar-nav">
            <!-- Christmas snowflakes in nav -->
            {#if $activeHoliday?.id === 'christmas'}
                <ChristmasNavSnowflakes />
            {/if}
            
            {#each navLinks as link}
                <a href={link.href}
                   class="nav-link"
                   class:nav-link-active={isActive(link.href)}
                   on:click={closeSidebar}>
                    <svelte:component this={link.icon} size={20} stroke={1.5} />
                    <span class="nav-label">{link.label}</span>
                    {#if isActive(link.href)}
                        <IconChevronRight size={16} stroke={2} class="nav-arrow" />
                    {/if}
                </a>
            {/each}
        </nav>

        <!-- Logout Button -->
        <div class="sidebar-footer">
            <button class="logout-btn" on:click={handleLogout}>
                <IconLogout size={20} stroke={1.5} />
                <span>Sign Out</span>
            </button>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="main-content" class:impersonating={$isImpersonating}>
        <!-- Impersonation Banner (Phase 8.3) -->
        <ImpersonationBanner />
        
        <!-- Holiday Banner (Phase 8.2) -->
        <div class="content-wrapper">
            <HolidayBanner />
            <slot />
        </div>
    </main>
</div>

<!-- Mobile Bottom Navigation -->
<nav class="mobile-nav">
    {#each navLinks as link}
        <a href={link.href} 
           class="mobile-nav-link"
           class:mobile-nav-active={isActive(link.href)}
           aria-label={link.label}>
            <svelte:component this={link.icon} size={24} stroke={isActive(link.href) ? 2 : 1.5} />
        </a>
    {/each}
</nav>

<!-- Seasonal Theme Components -->
<SeasonalEffects />
<SeasonalDecorations />
<SeasonalLoginCelebration 
    bind:show={showLoginCelebration} 
    userName={userProfile?.name || ''} 
/>

<!-- Christmas-specific extras -->
{#if $activeHoliday?.id === 'christmas'}
    <ChristmasExtras 
        onGiftReceived={(gift) => console.log('Gift received:', gift)} 
    />
{/if}

<!-- Seasonal Introduction for first-time users -->
<SeasonalIntroduction bind:show={showSeasonalIntro} />

<!-- Smart App Install Prompt -->
<AppInstallPrompt />

<!-- Deep Link Handler (Open in App banner) -->
<DeepLinkHandler />

<!-- Hybrid AI Chatbot Assistant -->
<HybridChatbot role={CHATBOT_ROLES.USER} userId={user?.uid} {userProfile} />

<!-- Global Toast Notifications for Real-time Announcements -->
<ToastContainer />
{/if}

<style>
    /* Loading Screen */
    .loading-screen {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: var(--theme-bg, var(--apple-light-bg));
    }

    .loading-content {
        text-align: center;
    }

    .loading-text {
        font-size: 17px;
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
        margin-top: 20px;
    }

    .loading-subtext {
        font-size: 14px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        margin-top: 4px;
    }

    /* Mobile Header */
    .mobile-header {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 40;
        background: var(--theme-card-bg, var(--apple-white));
        border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5));
    }

    .mobile-header-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 20px;
        height: 60px;
    }

    .mobile-brand {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .brand-logo {
        width: 36px;
        height: 36px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
    }

    .brand-text {
        font-size: 18px;
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
    }

    .menu-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        border-radius: var(--apple-radius-md);
        background: transparent;
        border: none;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .menu-btn:hover {
        background: var(--theme-border-light, var(--apple-gray-6));
        color: var(--theme-text, var(--apple-black));
    }

    /* App Layout */
    .app-layout {
        display: flex;
        min-height: 100vh;
        background: var(--theme-bg, var(--apple-light-bg));
    }

    /* Sidebar Overlay */
    .sidebar-overlay {
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        z-index: 45;
    }

    /* Sidebar */
    .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        width: 260px;
        background: var(--theme-card-bg, var(--apple-white));
        border-right: 1px solid var(--theme-border-light, var(--apple-gray-5));
        display: flex;
        flex-direction: column;
        z-index: 50;
        transition: transform 0.3s cubic-bezier(0.25, 0.1, 0.25, 1);
    }

    .sidebar-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 20px;
        border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5));
    }

    .sidebar-brand-wrapper {
        display: flex;
        align-items: center;
        gap: 10px;
    }

    .sidebar-logo {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
    }

    .sidebar-brand {
        font-size: 18px;
        font-weight: 700;
        color: var(--theme-text, var(--apple-black));
        letter-spacing: -0.3px;
    }

    .close-btn {
        display: none;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: var(--apple-radius-sm);
        background: var(--theme-border-light, var(--apple-gray-6));
        border: none;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .close-btn:hover {
        background: var(--theme-border, var(--apple-gray-5));
        color: var(--theme-text, var(--apple-black));
    }

    /* Sidebar Profile */
    .sidebar-profile {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px 20px;
        border-bottom: 1px solid var(--theme-border-light, var(--apple-gray-5));
    }

    .profile-avatar-wrapper {
        position: relative;
        flex-shrink: 0;
    }

    .profile-avatar {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        object-fit: cover;
    }

    .profile-avatar-placeholder {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--apple-accent), #5856D6);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
        font-size: 16px;
    }

    .avatar-status-dot {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 12px;
        height: 12px;
        background: var(--apple-green);
        border: 2px solid var(--theme-card-bg, var(--apple-white));
        border-radius: 50%;
    }

    .profile-info {
        flex: 1;
        min-width: 0;
    }

    .profile-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--theme-text, var(--apple-black));
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .profile-role {
        font-size: 12px;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    /* Navigation */
    .sidebar-nav {
        flex: 1;
        padding: 12px;
        overflow-y: auto;
    }

    .nav-link {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 14px;
        border-radius: var(--apple-radius-md);
        color: var(--theme-text-secondary, var(--apple-gray-1));
        font-size: 14px;
        font-weight: 500;
        text-decoration: none;
        transition: var(--apple-transition);
        margin-bottom: 4px;
    }

    .nav-link:hover {
        background: var(--theme-border-light, var(--apple-gray-6));
        color: var(--theme-text, var(--apple-black));
    }

    .nav-link-active {
        background: rgba(0, 122, 255, 0.1);
        color: var(--apple-accent);
    }

    .nav-link-active:hover {
        background: rgba(0, 122, 255, 0.15);
        color: var(--apple-accent);
    }

    .nav-arrow {
        margin-left: auto;
        opacity: 0.6;
    }

    /* Sidebar Footer */
    .sidebar-footer {
        padding: 16px;
        border-top: 1px solid var(--theme-border-light, var(--apple-gray-5));
    }

    .logout-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        width: 100%;
        padding: 12px 16px;
        background: transparent;
        border: 1px solid var(--theme-border, var(--apple-gray-4));
        border-radius: var(--apple-radius-md);
        color: var(--theme-text-secondary, var(--apple-gray-1));
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .logout-btn:hover {
        background: var(--theme-border-light, var(--apple-gray-6));
        color: var(--theme-text, var(--apple-black));
        border-color: var(--theme-border, var(--apple-gray-3));
    }

    /* Main Content */
    .main-content {
        flex: 1;
        margin-left: 260px;
        min-height: 100vh;
        overflow-y: auto;
    }

    .main-content.impersonating {
        padding-top: 56px;
    }

    .content-wrapper {
        padding: 20px;
    }

    @media (max-width: 1024px) {
        .content-wrapper {
            padding: 16px;
        }
    }

    /* Mobile Bottom Navigation */
    .mobile-nav {
        display: none;
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: var(--theme-card-bg, var(--apple-white));
        border-top: 1px solid var(--theme-border-light, var(--apple-gray-5));
        padding: 8px 0;
        padding-bottom: calc(8px + env(safe-area-inset-bottom));
        z-index: 40;
    }

    .mobile-nav-link {
        display: flex;
        align-items: center;
        justify-content: center;
        flex: 1;
        padding: 12px 0;
        color: var(--theme-text-secondary, var(--apple-gray-1));
        text-decoration: none;
        transition: var(--apple-transition);
    }

    .mobile-nav-link:active {
        transform: scale(0.9);
    }

    .mobile-nav-active {
        color: var(--apple-accent);
    }

    /* Responsive - Tablet & Mobile */
    @media (max-width: 1024px) {
        .mobile-header {
            display: block;
        }

        .sidebar {
            transform: translateX(-100%);
        }

        .sidebar-open {
            transform: translateX(0);
            box-shadow: var(--apple-shadow-lg);
        }

        .sidebar-overlay {
            display: block;
        }

        .close-btn {
            display: flex;
        }

        .main-content {
            margin-left: 0;
            padding-top: 60px;
            padding-bottom: 80px;
        }

        .mobile-nav {
            display: flex;
        }
    }

    @media (max-width: 480px) {
        .sidebar {
            width: 100%;
            max-width: 300px;
        }
    }
</style>
