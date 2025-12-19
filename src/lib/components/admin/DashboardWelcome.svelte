<script>
    import { adminAuthStore } from '$lib/stores/adminAuth.js';
    import { getTimeGreeting } from '$lib/stores/adminDashboard.js';
    import { IconClock, IconServer, IconDatabase, IconAlertCircle, IconChevronRight } from '@tabler/icons-svelte';

    export let lastLogin = null;
    export let systemUptime = '99.9%';
    export let lastBackup = null;
    export let pendingApprovals = 0;

    $: greeting = getTimeGreeting();
    $: adminName = $adminAuthStore.admin?.name || 'Admin';
    $: adminRole = $adminAuthStore.admin?.role === 'super_admin' ? 'Super Admin' : 'Admin';
    $: currentDate = new Date().toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric',
        year: 'numeric'
    });

    function formatLastLogin(date) {
        if (!date) return 'First login';
        return new Date(date).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }
</script>

<div class="hero-welcome">
    <!-- Background Pattern -->
    <div class="hero-bg-pattern"></div>
    
    <div class="hero-content">
        <!-- Left: Avatar & Greeting -->
        <div class="hero-main">
            <div class="avatar-wrapper">
                <div class="avatar">{adminName.charAt(0).toUpperCase()}</div>
                <div class="avatar-status"></div>
            </div>
            <div class="hero-text">
                <h1 class="hero-title">{greeting}, <span class="name-highlight">{adminName}</span></h1>
                <p class="hero-subtitle">{currentDate}</p>
                <div class="hero-meta">
                    <span class="role-badge">{adminRole}</span>
                    <span class="meta-divider">•</span>
                    <span class="last-login">
                        <IconClock size={14} stroke={1.5} />
                        Last login: {formatLastLogin(lastLogin)}
                    </span>
                </div>
            </div>
        </div>

        <!-- Right Section: Status Cards -->
        <div class="hero-right">
            <!-- Quick Status Cards -->
            <div class="hero-status-grid">
                <div class="status-card">
                    <div class="status-icon server">
                        <IconServer size={18} stroke={1.5} />
                    </div>
                    <div class="status-info">
                        <span class="status-value">{systemUptime}</span>
                        <span class="status-label">Uptime</span>
                    </div>
                </div>
                
                <div class="status-card">
                    <div class="status-icon database">
                        <IconDatabase size={18} stroke={1.5} />
                    </div>
                    <div class="status-info">
                        <span class="status-value">{lastBackup || '2h ago'}</span>
                        <span class="status-label">Last Backup</span>
                    </div>
                </div>
                
                {#if pendingApprovals > 0}
                    <a href="/admin/feedback" class="status-card alert clickable">
                        <div class="status-icon alert">
                            <IconAlertCircle size={18} stroke={1.5} />
                        </div>
                        <div class="status-info">
                            <span class="status-value">{pendingApprovals}</span>
                            <span class="status-label">Pending</span>
                        </div>
                        <IconChevronRight size={16} stroke={2} class="status-arrow" />
                    </a>
                {/if}
            </div>
        </div>
    </div>
</div>

<style>
    .hero-welcome {
        position: relative;
        background: linear-gradient(135deg, var(--apple-accent) 0%, #5856D6 100%);
        margin-bottom: 20px;
        border-radius: var(--apple-radius-xl);
        padding: clamp(20px, 4vw, 28px);
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 122, 255, 0.2);
    }

    .hero-bg-pattern {
        position: absolute;
        inset: 0;
        background: 
            radial-gradient(circle at 100% 0%, rgba(255, 255, 255, 0.15) 0%, transparent 50%),
            radial-gradient(circle at 0% 100%, rgba(255, 255, 255, 0.1) 0%, transparent 40%);
        pointer-events: none;
    }

    .hero-content {
        position: relative;
        z-index: 1;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
    }

    .hero-main {
        display: flex;
        align-items: center;
        gap: 16px;
        flex: 1;
        min-width: 0;
    }

    .avatar-wrapper {
        position: relative;
        flex-shrink: 0;
    }

    .avatar {
        width: 64px;
        height: 64px;
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(10px);
        border: 3px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 24px;
        font-weight: 700;
    }

    .avatar-status {
        position: absolute;
        bottom: 2px;
        right: 2px;
        width: 14px;
        height: 14px;
        background: var(--apple-green);
        border: 3px solid rgba(255, 255, 255, 0.9);
        border-radius: 50%;
    }

    .hero-text {
        flex: 1;
        min-width: 0;
    }

    .hero-title {
        font-size: clamp(18px, 2.5vw, 26px);
        font-weight: 700;
        color: white;
        margin: 0 0 4px;
        letter-spacing: -0.3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .name-highlight {
        opacity: 0.95;
    }

    .hero-subtitle {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.8);
        margin: 0 0 8px;
    }

    .hero-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
    }

    .role-badge {
        background: rgba(255, 255, 255, 0.2);
        backdrop-filter: blur(8px);
        color: white;
        font-size: 10px;
        font-weight: 600;
        padding: 4px 10px;
        border-radius: 20px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .meta-divider {
        color: rgba(255, 255, 255, 0.4);
        font-size: 10px;
    }

    .last-login {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.75);
    }

    /* Right Section */
    .hero-right {
        display: flex;
        align-items: center;
        flex-shrink: 0;
    }

    /* Status Grid */
    .hero-status-grid {
        display: flex;
        gap: 10px;
    }

    .status-card {
        display: flex;
        align-items: center;
        gap: 10px;
        background: rgba(255, 255, 255, 0.15);
        backdrop-filter: blur(10px);
        padding: 10px 14px;
        border-radius: 12px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        transition: var(--apple-transition);
        text-decoration: none;
    }

    .status-card.clickable {
        cursor: pointer;
    }

    .status-card.clickable:hover {
        background: rgba(255, 255, 255, 0.25);
        transform: translateY(-2px);
    }

    .status-card.alert {
        background: rgba(255, 149, 0, 0.25);
        border-color: rgba(255, 149, 0, 0.3);
    }

    .status-icon {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        flex-shrink: 0;
    }

    .status-icon.server {
        background: rgba(52, 199, 89, 0.3);
    }

    .status-icon.database {
        background: rgba(90, 200, 250, 0.3);
    }

    .status-icon.alert {
        background: rgba(255, 149, 0, 0.4);
    }

    .status-info {
        display: flex;
        flex-direction: column;
    }

    .status-value {
        font-size: 14px;
        font-weight: 600;
        color: white;
        line-height: 1.2;
    }

    .status-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.7);
    }

    .status-card :global(.status-arrow) {
        color: rgba(255, 255, 255, 0.6);
        margin-left: 4px;
    }

    /* Responsive - Tablet */
    @media (max-width: 1100px) {
        .hero-content {
            flex-wrap: wrap;
        }

        .hero-right {
            width: 100%;
            justify-content: flex-end;
            margin-top: 8px;
        }

        .hero-status-grid {
            flex-wrap: wrap;
        }
    }

    /* Responsive - Mobile */
    @media (max-width: 768px) {
        .hero-welcome {
            padding: 16px;
            border-radius: var(--apple-radius-lg);
            margin-bottom: 16px;
        }

        .hero-content {
            flex-direction: column;
            gap: 16px;
        }

        .hero-main {
            width: 100%;
        }

        .avatar {
            width: 52px;
            height: 52px;
            font-size: 20px;
        }

        .hero-title {
            font-size: 18px;
        }

        .hero-subtitle {
            font-size: 13px;
        }

        .hero-right {
            width: 100%;
        }

        .hero-status-grid {
            width: 100%;
            justify-content: space-between;
        }

        .status-card {
            flex: 1;
            min-width: 0;
            padding: 10px 12px;
        }
    }

    /* Responsive - Small Mobile */
    @media (max-width: 480px) {
        .hero-welcome {
            padding: 14px;
            margin-bottom: 12px;
        }

        .hero-main {
            gap: 12px;
        }

        .avatar {
            width: 46px;
            height: 46px;
            font-size: 18px;
        }

        .hero-title {
            font-size: 16px;
        }

        .hero-subtitle {
            font-size: 12px;
            margin-bottom: 6px;
        }

        .hero-meta {
            gap: 8px;
        }

        .role-badge {
            font-size: 9px;
            padding: 3px 8px;
        }

        .last-login {
            font-size: 10px;
        }

        .hero-status-grid {
            gap: 8px;
        }

        .status-card {
            padding: 8px 10px;
            gap: 8px;
        }

        .status-icon {
            width: 28px;
            height: 28px;
        }

        .status-value {
            font-size: 12px;
        }

        .status-label {
            font-size: 9px;
        }
    }

    /* Extra Small */
    @media (max-width: 360px) {
        .status-card {
            flex-direction: column;
            text-align: center;
            padding: 10px 8px;
        }

        .status-info {
            align-items: center;
        }
    }
</style>
