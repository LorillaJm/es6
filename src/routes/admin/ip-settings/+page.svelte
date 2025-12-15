<script>
    import { onMount } from "svelte";
    import { adminAuthStore } from "$lib/stores/adminAuth.js";
    import { 
        IconShieldLock, IconLoader2, IconPlus, IconTrash, IconCheck,
        IconWifi, IconWorld, IconAlertCircle, IconRefresh
    } from "@tabler/icons-svelte";

    let settings = {
        enabled: false,
        adminLoginRestricted: false,
        attendanceRestricted: false,
        allowedIPs: [],
        allowedRanges: [],
        allowedNetworkNames: []
    };
    let currentIP = '';
    let isLoading = true;
    let isSaving = false;
    let newIP = '';
    let newRange = '';
    let newNetworkName = '';
    let testResult = null;

    onMount(async () => {
        await loadSettings();
    });

    async function loadSettings() {
        isLoading = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/ip-restriction', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            if (response.ok) {
                const data = await response.json();
                settings = data.settings || settings;
                currentIP = data.currentIP || '';
            }
        } catch (error) {
            console.error('Failed to load IP settings:', error);
        } finally {
            isLoading = false;
        }
    }

    async function saveSettings() {
        isSaving = true;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/ip-restriction', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'update', settings })
            });
            if (response.ok) {
                const data = await response.json();
                settings = data.settings;
            }
        } catch (error) {
            console.error('Failed to save settings:', error);
        } finally {
            isSaving = false;
        }
    }

    async function addCurrentIP() {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/ip-restriction', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'addCurrentIP', networkName: 'My Current Location' })
            });
            if (response.ok) {
                const data = await response.json();
                settings = data.settings;
            }
        } catch (error) {
            console.error('Failed to add current IP:', error);
        }
    }

    async function addIP() {
        if (!newIP.trim()) return;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/ip-restriction', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'addIP', ip: newIP.trim(), networkName: newNetworkName.trim() })
            });
            if (response.ok) {
                const data = await response.json();
                settings = data.settings;
                newIP = '';
                newNetworkName = '';
            }
        } catch (error) {
            console.error('Failed to add IP:', error);
        }
    }

    async function removeIP(ip) {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/ip-restriction', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'removeIP', ip })
            });
            if (response.ok) {
                const data = await response.json();
                settings = data.settings;
            }
        } catch (error) {
            console.error('Failed to remove IP:', error);
        }
    }

    async function addRange() {
        if (!newRange.trim()) return;
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/ip-restriction', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'addRange', cidr: newRange.trim(), networkName: newNetworkName.trim() })
            });
            if (response.ok) {
                const data = await response.json();
                settings = data.settings;
                newRange = '';
                newNetworkName = '';
            }
        } catch (error) {
            console.error('Failed to add range:', error);
        }
    }

    async function removeRange(cidr) {
        settings.allowedRanges = settings.allowedRanges.filter(r => r !== cidr);
        settings.allowedNetworkNames = settings.allowedNetworkNames.filter(n => !n.startsWith(cidr));
        await saveSettings();
    }

    async function testAccess() {
        try {
            const { accessToken } = adminAuthStore.getStoredTokens();
            const response = await fetch('/api/admin/ip-restriction', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action: 'validate' })
            });
            if (response.ok) {
                testResult = await response.json();
                setTimeout(() => testResult = null, 5000);
            }
        } catch (error) {
            console.error('Failed to test access:', error);
        }
    }
</script>

<svelte:head>
    <title>IP Restriction | Admin Panel</title>
</svelte:head>

<div class="ip-page">
    <header class="page-header">
        <div class="header-content">
            <h1>IP Restriction</h1>
            <p class="header-subtitle">Control network access for admin login and attendance</p>
        </div>
        <button class="apple-btn-secondary" on:click={loadSettings}>
            <IconRefresh size={18} stroke={2} /> Refresh
        </button>
    </header>

    {#if isLoading}
        <div class="loading-state apple-card">
            <IconLoader2 size={32} stroke={1.5} class="spin" />
            <p>Loading settings...</p>
        </div>
    {:else}
        <!-- Current IP Info -->
        <div class="info-card apple-card">
            <div class="info-icon"><IconWorld size={24} stroke={1.5} /></div>
            <div class="info-content">
                <span class="info-label">Your Current IP Address</span>
                <span class="info-value">{currentIP || 'Unknown'}</span>
            </div>
            <button class="apple-btn-secondary small" on:click={addCurrentIP}>
                <IconPlus size={16} stroke={2} /> Add to Allowed
            </button>
        </div>

        <!-- Test Result -->
        {#if testResult}
            <div class="test-result" class:allowed={testResult.allowed} class:blocked={!testResult.allowed}>
                {#if testResult.allowed}
                    <IconCheck size={18} stroke={2} /> Access would be ALLOWED from {testResult.testedIP}
                {:else}
                    <IconAlertCircle size={18} stroke={2} /> Access would be BLOCKED from {testResult.testedIP}
                {/if}
            </div>
        {/if}

        <!-- Settings -->
        <div class="settings-card apple-card">
            <h2>Restriction Settings</h2>
            
            <div class="toggle-group">
                <label class="toggle-item">
                    <div class="toggle-info">
                        <span class="toggle-label">Enable IP Restriction</span>
                        <span class="toggle-desc">Master switch for all IP-based access control</span>
                    </div>
                    <input type="checkbox" class="toggle" bind:checked={settings.enabled} on:change={saveSettings} />
                </label>

                <label class="toggle-item" class:disabled={!settings.enabled}>
                    <div class="toggle-info">
                        <span class="toggle-label">Restrict Admin Login</span>
                        <span class="toggle-desc">Only allow admin login from approved IPs</span>
                    </div>
                    <input type="checkbox" class="toggle" bind:checked={settings.adminLoginRestricted} disabled={!settings.enabled} on:change={saveSettings} />
                </label>

                <label class="toggle-item" class:disabled={!settings.enabled}>
                    <div class="toggle-info">
                        <span class="toggle-label">Restrict Attendance Logging</span>
                        <span class="toggle-desc">Only allow attendance from school network</span>
                    </div>
                    <input type="checkbox" class="toggle" bind:checked={settings.attendanceRestricted} disabled={!settings.enabled} on:change={saveSettings} />
                </label>
            </div>

            <button class="apple-btn-secondary" on:click={testAccess}>
                <IconShieldLock size={16} stroke={2} /> Test Current Access
            </button>
        </div>

        <!-- Allowed IPs -->
        <div class="list-card apple-card">
            <h2><IconWifi size={18} stroke={1.5} /> Allowed IP Addresses</h2>
            
            <div class="add-form">
                <input type="text" class="apple-input" placeholder="IP Address (e.g., 192.168.1.100)" bind:value={newIP} />
                <input type="text" class="apple-input" placeholder="Network Name (optional)" bind:value={newNetworkName} />
                <button class="apple-btn-primary" on:click={addIP} disabled={!newIP.trim()}>
                    <IconPlus size={16} stroke={2} /> Add
                </button>
            </div>

            {#if settings.allowedIPs?.length > 0}
                <ul class="ip-list">
                    {#each settings.allowedIPs as ip}
                        <li class="ip-item">
                            <span class="ip-value">{ip}</span>
                            <button class="remove-btn" on:click={() => removeIP(ip)}>
                                <IconTrash size={14} stroke={1.5} />
                            </button>
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="empty-text">No IP addresses added yet</p>
            {/if}
        </div>

        <!-- Allowed Ranges -->
        <div class="list-card apple-card">
            <h2><IconShieldLock size={18} stroke={1.5} /> Allowed IP Ranges (CIDR)</h2>
            
            <div class="add-form">
                <input type="text" class="apple-input" placeholder="CIDR Range (e.g., 192.168.1.0/24)" bind:value={newRange} />
                <input type="text" class="apple-input" placeholder="Network Name (optional)" bind:value={newNetworkName} />
                <button class="apple-btn-primary" on:click={addRange} disabled={!newRange.trim()}>
                    <IconPlus size={16} stroke={2} /> Add
                </button>
            </div>

            {#if settings.allowedRanges?.length > 0}
                <ul class="ip-list">
                    {#each settings.allowedRanges as range}
                        <li class="ip-item">
                            <span class="ip-value">{range}</span>
                            <button class="remove-btn" on:click={() => removeRange(range)}>
                                <IconTrash size={14} stroke={1.5} />
                            </button>
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="empty-text">No IP ranges added yet</p>
            {/if}

            <div class="help-text">
                <p>Use CIDR notation to allow entire network ranges. Examples:</p>
                <ul>
                    <li><code>192.168.1.0/24</code> - All IPs from 192.168.1.0 to 192.168.1.255</li>
                    <li><code>10.0.0.0/8</code> - All IPs starting with 10.x.x.x</li>
                </ul>
            </div>
        </div>
    {/if}
</div>

<style>
    .ip-page { padding: 24px; max-width: 800px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .page-header h1 { font-size: 32px; font-weight: 700; color: var(--theme-text, var(--apple-black)); margin-bottom: 4px; }
    .header-subtitle { font-size: 15px; color: var(--theme-text-secondary, var(--apple-gray-1)); }

    .loading-state { text-align: center; padding: 60px 20px; color: var(--theme-text-secondary, var(--apple-gray-1)); }
    .loading-state p { margin-top: 12px; font-size: 14px; }

    .info-card { display: flex; align-items: center; gap: 16px; padding: 20px; margin-bottom: 20px; }
    .info-icon { width: 48px; height: 48px; border-radius: 12px; background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); display: flex; align-items: center; justify-content: center; }
    .info-content { flex: 1; }
    .info-label { display: block; font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); margin-bottom: 2px; }
    .info-value { font-size: 18px; font-weight: 600; color: var(--theme-text, var(--apple-black)); font-family: monospace; }
    .small { padding: 8px 14px; font-size: 13px; }

    .test-result { display: flex; align-items: center; gap: 10px; padding: 14px 18px; border-radius: var(--apple-radius-md); margin-bottom: 20px; font-weight: 500; }
    .test-result.allowed { background: rgba(52, 199, 89, 0.1); color: var(--apple-green); }
    .test-result.blocked { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }

    .settings-card, .list-card { padding: 24px; margin-bottom: 20px; }
    .settings-card h2, .list-card h2 { font-size: 16px; font-weight: 600; margin-bottom: 20px; color: var(--theme-text, var(--apple-black)); display: flex; align-items: center; gap: 8px; }

    .toggle-group { display: flex; flex-direction: column; gap: 16px; margin-bottom: 20px; }
    .toggle-item { display: flex; justify-content: space-between; align-items: center; padding: 16px; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: var(--apple-radius-md); cursor: pointer; }
    .toggle-item.disabled { opacity: 0.5; cursor: not-allowed; }
    .toggle-label { font-size: 14px; font-weight: 600; color: var(--theme-text, var(--apple-black)); display: block; }
    .toggle-desc { font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); }

    .toggle { width: 50px; height: 28px; appearance: none; background: var(--apple-gray-4); border-radius: 14px; position: relative; cursor: pointer; transition: background 0.2s; }
    .toggle:checked { background: var(--apple-green); }
    .toggle::before { content: ''; position: absolute; width: 24px; height: 24px; background: white; border-radius: 50%; top: 2px; left: 2px; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
    .toggle:checked::before { transform: translateX(22px); }

    .add-form { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
    .add-form .apple-input { flex: 1; min-width: 150px; }

    .ip-list { list-style: none; padding: 0; margin: 0; }
    .ip-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: var(--theme-border-light, var(--apple-gray-6)); border-radius: var(--apple-radius-sm); margin-bottom: 8px; }
    .ip-value { font-family: monospace; font-size: 14px; color: var(--theme-text, var(--apple-black)); }
    .remove-btn { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); border: none; padding: 6px 8px; border-radius: var(--apple-radius-sm); cursor: pointer; }
    .remove-btn:hover { background: rgba(255, 59, 48, 0.2); }

    .empty-text { font-size: 14px; color: var(--theme-text-secondary, var(--apple-gray-1)); text-align: center; padding: 20px; }

    .help-text { margin-top: 16px; padding: 14px; background: rgba(0, 122, 255, 0.05); border-radius: var(--apple-radius-md); }
    .help-text p { font-size: 13px; color: var(--theme-text-secondary, var(--apple-gray-1)); margin-bottom: 8px; }
    .help-text ul { margin: 0; padding-left: 20px; }
    .help-text li { font-size: 12px; color: var(--theme-text-secondary, var(--apple-gray-1)); margin-bottom: 4px; }
    .help-text code { background: var(--theme-border-light, var(--apple-gray-6)); padding: 2px 6px; border-radius: 4px; font-size: 12px; }

    :global(.spin) { animation: spin 1s linear infinite; }
    @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
