<script>
    import { impersonationStore, isImpersonating, impersonatedUser, formatDuration } from '$lib/stores/impersonation.js';
    import { IconUserCircle, IconX, IconEye, IconClock } from '@tabler/icons-svelte';
    import { onMount, onDestroy } from 'svelte';

    let duration = 0;
    let interval;

    onMount(() => {
        interval = setInterval(() => {
            duration = impersonationStore.getDuration();
        }, 1000);
    });

    onDestroy(() => {
        if (interval) clearInterval(interval);
    });

    function endImpersonation() {
        if (confirm('End impersonation session and return to admin view?')) {
            impersonationStore.end();
            window.location.href = '/admin/users';
        }
    }
</script>

{#if $isImpersonating && $impersonatedUser}
    <div class="impersonation-banner">
        <div class="banner-content">
            <div class="banner-icon">
                <IconEye size={20} stroke={2} />
            </div>
            <div class="banner-info">
                <span class="banner-label">Viewing as:</span>
                <span class="banner-user">
                    {#if $impersonatedUser.profilePhoto}
                        <img src={$impersonatedUser.profilePhoto} alt="" class="user-avatar" />
                    {:else}
                        <span class="user-avatar-placeholder">
                            {($impersonatedUser.name || 'U').charAt(0)}
                        </span>
                    {/if}
                    <strong>{$impersonatedUser.name}</strong>
                    <span class="user-email">({$impersonatedUser.email})</span>
                </span>
            </div>
            <div class="banner-duration">
                <IconClock size={14} stroke={1.5} />
                <span>{formatDuration(duration)}</span>
            </div>
            <button class="end-btn" on:click={endImpersonation}>
                <IconX size={16} stroke={2} />
                <span>End Session</span>
            </button>
        </div>
    </div>
{/if}

<style>
    .impersonation-banner {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(135deg, #FF9500, #FF6B00);
        color: white;
        z-index: 10000;
        box-shadow: 0 2px 12px rgba(255, 149, 0, 0.4);
    }

    .banner-content {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 10px 20px;
        max-width: 1400px;
        margin: 0 auto;
    }

    .banner-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        height: 36px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 50%;
        flex-shrink: 0;
    }

    .banner-info {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1;
        min-width: 0;
    }

    .banner-label {
        font-size: 13px;
        opacity: 0.9;
        flex-shrink: 0;
    }

    .banner-user {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
    }

    .user-avatar {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        object-fit: cover;
        border: 2px solid rgba(255, 255, 255, 0.5);
    }

    .user-avatar-placeholder {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: 600;
    }

    .user-email {
        font-size: 12px;
        opacity: 0.8;
    }

    .banner-duration {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        background: rgba(255, 255, 255, 0.15);
        padding: 6px 12px;
        border-radius: 20px;
        flex-shrink: 0;
    }

    .end-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        flex-shrink: 0;
    }

    .end-btn:hover {
        background: rgba(255, 255, 255, 0.3);
    }

    @media (max-width: 768px) {
        .banner-content {
            flex-wrap: wrap;
            gap: 10px;
            padding: 12px 16px;
        }

        .banner-info {
            order: 1;
            width: 100%;
        }

        .banner-icon {
            order: 0;
        }

        .banner-duration {
            order: 2;
        }

        .end-btn {
            order: 3;
            margin-left: auto;
        }

        .user-email {
            display: none;
        }
    }
</style>
