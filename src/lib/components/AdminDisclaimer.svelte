<!-- src/lib/components/AdminDisclaimer.svelte -->
<!-- Security disclaimer modal for admin panel access -->
<script>
    import { browser } from '$app/environment';
    import { onMount } from 'svelte';
    import { IconShieldLock, IconAlertTriangle, IconX } from '@tabler/icons-svelte';
    
    export let onAccept = () => {};
    export let onDecline = () => { window.location.href = '/'; };
    
    let showModal = false;
    let isLoading = true;
    
    const STORAGE_KEY = 'admin_disclaimer_accepted';
    const ACCEPTANCE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
    
    onMount(() => {
        if (!browser) return;
        
        const acceptedAt = localStorage.getItem(STORAGE_KEY);
        if (acceptedAt) {
            const acceptedTime = parseInt(acceptedAt, 10);
            // Check if acceptance is still valid (within 24 hours)
            if (Date.now() - acceptedTime < ACCEPTANCE_DURATION) {
                showModal = false;
                isLoading = false;
                return;
            }
        }
        
        showModal = true;
        isLoading = false;
    });
    
    function handleAccept() {
        if (browser) {
            localStorage.setItem(STORAGE_KEY, Date.now().toString());
        }
        showModal = false;
        onAccept();
    }
    
    function handleDecline() {
        showModal = false;
        onDecline();
    }
</script>

{#if !isLoading && showModal}
<div class="disclaimer-overlay" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title">
    <div class="disclaimer-modal">
        <div class="disclaimer-header">
            <div class="icon-wrapper">
                <IconShieldLock size={48} />
            </div>
            <h2 id="disclaimer-title">Administrative Access</h2>
        </div>
        
        <div class="disclaimer-content">
            <div class="warning-box">
                <IconAlertTriangle size={20} />
                <span>This area is restricted to authorized administrators only.</span>
            </div>
            
            <p>By accessing this administrative panel, you acknowledge and agree that:</p>
            
            <ul>
                <li><strong>All actions are logged</strong> - Every action you take is recorded for security and compliance purposes</li>
                <li><strong>Data access is monitored</strong> - Access to user data is tracked and audited</li>
                <li><strong>Responsible use required</strong> - You will only access data necessary for your administrative duties</li>
                <li><strong>Privacy protection</strong> - You will protect user privacy and handle data securely</li>
                <li><strong>Consequences of misuse</strong> - Unauthorized access or misuse may result in access revocation and disciplinary action</li>
            </ul>
            
            <p class="legal-note">
                For complete terms, please review our 
                <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a> and 
                <a href="/terms" target="_blank" rel="noopener">Terms of Service</a>.
            </p>
        </div>
        
        <div class="disclaimer-actions">
            <button class="btn-secondary" on:click={handleDecline} type="button">
                Cancel
            </button>
            <button class="btn-primary" on:click={handleAccept} type="button">
                I Understand and Accept
            </button>
        </div>
    </div>
</div>
{/if}

<style>
    .disclaimer-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        padding: 20px;
        backdrop-filter: blur(4px);
    }
    
    .disclaimer-modal {
        background: var(--theme-card-bg, #ffffff);
        border-radius: 16px;
        padding: 32px;
        max-width: 520px;
        width: 100%;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
        animation: modalSlideIn 0.3s ease-out;
    }
    
    @keyframes modalSlideIn {
        from {
            opacity: 0;
            transform: translateY(-20px) scale(0.95);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }
    
    .disclaimer-header {
        text-align: center;
        margin-bottom: 24px;
    }
    
    .icon-wrapper {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
        color: white;
        margin-bottom: 16px;
    }
    
    .disclaimer-header h2 {
        margin: 0;
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--theme-text, #1a1a1a);
    }
    
    .disclaimer-content {
        color: var(--theme-text, #1a1a1a);
    }
    
    .warning-box {
        background: #FFF3CD;
        border: 1px solid #FFE69C;
        border-radius: 10px;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
        color: #856404;
        font-weight: 500;
    }
    
    .disclaimer-content p {
        margin: 0 0 16px 0;
        line-height: 1.6;
        color: var(--theme-text-secondary, #666);
    }
    
    .disclaimer-content ul {
        margin: 0 0 20px 0;
        padding-left: 0;
        list-style: none;
    }
    
    .disclaimer-content li {
        position: relative;
        padding-left: 24px;
        margin: 12px 0;
        color: var(--theme-text-secondary, #555);
        line-height: 1.5;
    }
    
    .disclaimer-content li::before {
        content: '•';
        position: absolute;
        left: 8px;
        color: var(--apple-accent, #007AFF);
        font-weight: bold;
    }
    
    .disclaimer-content li strong {
        color: var(--theme-text, #1a1a1a);
    }
    
    .legal-note {
        font-size: 0.875rem;
        padding-top: 16px;
        border-top: 1px solid var(--theme-border, #e5e5e5);
    }
    
    .legal-note a {
        color: var(--apple-accent, #007AFF);
        text-decoration: none;
        font-weight: 500;
    }
    
    .legal-note a:hover {
        text-decoration: underline;
    }
    
    .disclaimer-actions {
        display: flex;
        gap: 12px;
        margin-top: 28px;
    }
    
    .btn-primary, .btn-secondary {
        flex: 1;
        padding: 14px 24px;
        border-radius: 10px;
        font-weight: 600;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s ease;
    }
    
    .btn-primary {
        background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
        color: white;
        border: none;
    }
    
    .btn-primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 122, 255, 0.4);
    }
    
    .btn-secondary {
        background: transparent;
        border: 1px solid var(--theme-border, #ddd);
        color: var(--theme-text, #1a1a1a);
    }
    
    .btn-secondary:hover {
        background: var(--theme-bg, #f5f5f7);
    }
    
    @media (max-width: 480px) {
        .disclaimer-modal {
            padding: 24px;
        }
        
        .disclaimer-actions {
            flex-direction: column-reverse;
        }
    }
</style>
