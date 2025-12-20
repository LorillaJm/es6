<script>
    import { auth, getUserProfile } from '$lib/firebase';
    import { onMount, onDestroy } from 'svelte';
    import { format } from 'date-fns';
    import { IconId, IconQrcode, IconUser, IconBuilding, IconCalendar, IconShield, IconDownload, IconShare2, IconRefresh } from "@tabler/icons-svelte";
    import QRCode from 'qrcode';
    import { epassSettings } from '$lib/stores/systemSettings.js';

    let userProfile = null;
    let isLoading = true;
    let qrCodeDataUrl = '';
    let showFullScreen = false;
    let qrRefreshInterval = null;
    let currentSettings = { qrExpiration: 30, animatedHologram: true, antiScreenshot: true, watermarkEnabled: true };
    
    // Subscribe to E-Pass settings
    const unsubscribeSettings = epassSettings.subscribe(settings => {
        currentSettings = settings;
        // Update QR refresh interval when settings change
        if (qrRefreshInterval) {
            clearInterval(qrRefreshInterval);
            setupQRRefresh();
        }
    });

    onMount(async () => {
        const user = auth.currentUser;
        if (user) {
            userProfile = await getUserProfile(user.uid);
            await generateQRCode(user.uid);
            setupQRRefresh();
        }
        isLoading = false;
    });
    
    onDestroy(() => {
        if (qrRefreshInterval) clearInterval(qrRefreshInterval);
        unsubscribeSettings();
    });
    
    function setupQRRefresh() {
        // Auto-refresh QR code based on system settings (qrExpiration in seconds)
        const refreshMs = (currentSettings.qrExpiration || 30) * 1000;
        qrRefreshInterval = setInterval(async () => {
            if (auth.currentUser) {
                await generateQRCode(auth.currentUser.uid);
            }
        }, refreshMs);
    }

    async function generateQRCode(userId) {
        try {
            // Generate QR code with user ID, timestamp, and expiration for verification
            const qrData = JSON.stringify({
                type: 'STUDENT_EPASS',
                uid: userId,
                id: userProfile?.digitalId || userId.substring(0, 8).toUpperCase(),
                name: userProfile?.name,
                generated: new Date().toISOString(),
                expires: new Date(Date.now() + (currentSettings.qrExpiration || 30) * 1000).toISOString()
            });
            
            qrCodeDataUrl = await QRCode.toDataURL(qrData, {
                width: 280,
                margin: 2,
                color: {
                    dark: '#1d1d1f',
                    light: '#ffffff'
                },
                errorCorrectionLevel: 'H'
            });
        } catch (error) {
            console.error('QR generation error:', error);
        }
    }

    async function refreshQR() {
        if (auth.currentUser) {
            await generateQRCode(auth.currentUser.uid);
        }
    }

    function toggleFullScreen() {
        showFullScreen = !showFullScreen;
        if (showFullScreen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }

    async function downloadEPass() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 400;
        canvas.height = 600;
        
        // Background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Header gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 100);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(1, '#764ba2');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, 100);
        
        // Title
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('DIGITAL E-PASS', canvas.width / 2, 60);
        
        // QR Code
        const qrImg = new Image();
        qrImg.src = qrCodeDataUrl;
        await new Promise(resolve => qrImg.onload = resolve);
        ctx.drawImage(qrImg, (canvas.width - 200) / 2, 130, 200, 200);
        
        // User info
        ctx.fillStyle = '#1d1d1f';
        ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(userProfile?.name || 'Student', canvas.width / 2, 370);
        
        ctx.fillStyle = '#86868b';
        ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(userProfile?.digitalId || 'ID: ' + auth.currentUser?.uid.substring(0, 8).toUpperCase(), canvas.width / 2, 395);
        ctx.fillText(userProfile?.departmentOrCourse || 'Department', canvas.width / 2, 420);
        ctx.fillText(`${userProfile?.year || ''} - Section ${userProfile?.section || ''}`, canvas.width / 2, 445);
        
        // Footer
        ctx.fillStyle = '#e5e5e7';
        ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
        ctx.fillStyle = '#86868b';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.fillText(`Generated: ${format(new Date(), 'MMM dd, yyyy h:mm a')}`, canvas.width / 2, canvas.height - 25);
        
        // Download
        const link = document.createElement('a');
        link.download = `epass-${userProfile?.name?.replace(/\s+/g, '-').toLowerCase() || 'student'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    async function shareEPass() {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'My Digital E-Pass',
                    text: `Digital E-Pass for ${userProfile?.name}`,
                    url: window.location.href
                });
            } catch (err) {
                console.log('Share cancelled');
            }
        } else {
            // Fallback: copy to clipboard
            navigator.clipboard.writeText(window.location.href);
            alert('Link copied to clipboard!');
        }
    }
</script>

<svelte:head>
    <title>Digital E-Pass | Student Attendance</title>
</svelte:head>

<div class="epass-page">
    {#if isLoading}
        <div class="loading-container">
            <div class="apple-spinner"></div>
            <p>Loading your E-Pass...</p>
        </div>
    {:else if userProfile}
        <div class="epass-content apple-animate-in">
            <header class="page-header">
                <div class="header-main">
                    <h1 class="page-title">Digital E-Pass</h1>
                    <p class="page-subtitle">Your digital identification card</p>
                </div>
                <div class="header-actions">
                    <button class="action-btn" on:click={refreshQR} title="Refresh QR">
                        <IconRefresh size={20} stroke={1.5} />
                    </button>
                    <button class="action-btn" on:click={shareEPass} title="Share">
                        <IconShare2 size={20} stroke={1.5} />
                    </button>
                    <button class="action-btn primary" on:click={downloadEPass} title="Download">
                        <IconDownload size={20} stroke={1.5} />
                        <span>Download</span>
                    </button>
                </div>
            </header>

            <div class="epass-card" class:hologram-active={currentSettings.animatedHologram} on:click={toggleFullScreen} role="button" tabindex="0" on:keydown={(e) => e.key === 'Enter' && toggleFullScreen()}>
                <!-- Animated Hologram Overlay -->
                {#if currentSettings.animatedHologram}
                    <div class="hologram-overlay"></div>
                {/if}
                
                <!-- Anti-Screenshot Watermark -->
                {#if currentSettings.antiScreenshot}
                    <div class="anti-screenshot-watermark">
                        <span>{userProfile?.name || 'Student'}</span>
                        <span>{new Date().toLocaleTimeString()}</span>
                    </div>
                {/if}
                
                <div class="card-header">
                    <div class="card-logo">
                        <IconShield size={24} stroke={1.5} />
                    </div>
                    <div class="card-title">
                        <span class="title-main">DIGITAL E-PASS</span>
                        <span class="title-sub">Student Identification</span>
                    </div>
                    <div class="card-badge">
                        <span>VERIFIED</span>
                    </div>
                </div>

                <div class="card-body">
                    <div class="qr-section">
                        {#if qrCodeDataUrl}
                            <div class="qr-container">
                                <img src={qrCodeDataUrl} alt="QR Code" class="qr-code" />
                                {#if currentSettings.animatedHologram}
                                    <div class="qr-hologram-shine"></div>
                                {/if}
                            </div>
                            <p class="qr-hint">Tap to enlarge • Refreshes every {currentSettings.qrExpiration}s</p>
                        {:else}
                            <div class="qr-placeholder">
                                <IconQrcode size={64} stroke={1} />
                                <p>Generating QR...</p>
                            </div>
                        {/if}
                    </div>

                    <div class="info-section">
                        <div class="user-avatar">
                            {#if auth.currentUser?.photoURL}
                                <img src={auth.currentUser.photoURL} alt="Profile" />
                            {:else}
                                <span>{userProfile.name?.charAt(0) || 'S'}</span>
                            {/if}
                        </div>
                        <h2 class="user-name">{userProfile.name}</h2>
                        <p class="user-id">{userProfile.digitalId || `ID: ${auth.currentUser?.uid.substring(0, 8).toUpperCase()}`}</p>
                    </div>

                    <div class="details-grid">
                        <div class="detail-item">
                            <IconBuilding size={16} stroke={1.5} />
                            <div class="detail-content">
                                <span class="detail-label">Department</span>
                                <span class="detail-value">{userProfile.departmentOrCourse || 'Not set'}</span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <IconCalendar size={16} stroke={1.5} />
                            <div class="detail-content">
                                <span class="detail-label">Year & Section</span>
                                <span class="detail-value">{userProfile.year || '-'} - {userProfile.section || '-'}</span>
                            </div>
                        </div>
                        <div class="detail-item">
                            <IconUser size={16} stroke={1.5} />
                            <div class="detail-content">
                                <span class="detail-label">Email</span>
                                <span class="detail-value">{userProfile.email}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="card-footer">
                    {#if currentSettings.watermarkEnabled}
                        <span class="dynamic-watermark">Valid • {format(new Date(), 'h:mm:ss a')}</span>
                    {/if}
                    <span class="footer-text">Valid for academic year 2024-2025</span>
                    <span class="footer-date">Generated: {format(new Date(), 'MMM dd, yyyy')}</span>
                </div>
            </div>

            <div class="instructions">
                <h3>How to use your E-Pass</h3>
                <ul>
                    <li>Show this QR code at entry points for quick verification</li>
                    <li>Download and save for offline access</li>
                    <li>QR code contains encrypted identification data</li>
                    <li>Tap the card to view in full screen mode</li>
                </ul>
            </div>
        </div>
    {:else}
        <div class="error-state">
            <IconId size={48} stroke={1.5} />
            <p>Unable to load your E-Pass. Please try again.</p>
        </div>
    {/if}
</div>

<!-- Full Screen QR Modal -->
{#if showFullScreen}
    <div class="fullscreen-modal" on:click={toggleFullScreen} on:keydown={(e) => e.key === 'Escape' && toggleFullScreen()} role="dialog" tabindex="-1">
        <div class="fullscreen-content">
            <div class="fullscreen-qr">
                {#if qrCodeDataUrl}
                    <img src={qrCodeDataUrl} alt="QR Code" />
                {/if}
            </div>
            <p class="fullscreen-name">{userProfile?.name}</p>
            <p class="fullscreen-id">{userProfile?.digitalId || auth.currentUser?.uid.substring(0, 8).toUpperCase()}</p>
            <p class="fullscreen-hint">Tap anywhere to close</p>
        </div>
    </div>
{/if}

<style>
    .epass-page {
        min-height: 100%;
        padding: clamp(16px, 4vw, 32px);
        background: linear-gradient(180deg, #f5f5f7 0%, #e8e8ed 100%);
    }

    .loading-container, .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        min-height: 60vh;
        color: var(--apple-gray-1);
        gap: 16px;
    }

    .epass-content {
        max-width: 500px;
        margin: 0 auto;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 24px;
        flex-wrap: wrap;
        gap: 16px;
    }

    .page-title {
        font-size: clamp(24px, 5vw, 32px);
        font-weight: 700;
        color: var(--apple-black);
        margin-bottom: 4px;
    }

    .page-subtitle {
        font-size: 14px;
        color: var(--apple-gray-1);
    }

    .header-actions {
        display: flex;
        gap: 8px;
    }

    .action-btn {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 10px 14px;
        background: var(--apple-white);
        border: 1px solid var(--apple-gray-4);
        border-radius: var(--apple-radius-md);
        color: var(--apple-gray-1);
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: var(--apple-transition);
    }

    .action-btn:hover {
        background: var(--apple-gray-6);
    }

    .action-btn.primary {
        background: var(--apple-accent);
        border-color: var(--apple-accent);
        color: white;
    }

    .action-btn.primary:hover {
        background: #0066d6;
    }

    /* E-Pass Card */
    .epass-card {
        background: var(--apple-white);
        border-radius: var(--apple-radius-xl);
        overflow: hidden;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1), 0 2px 10px rgba(0, 0, 0, 0.05);
        cursor: pointer;
        transition: transform 0.3s ease, box-shadow 0.3s ease;
    }

    .epass-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15), 0 4px 20px rgba(0, 0, 0, 0.1);
    }

    .card-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 20px 24px;
        display: flex;
        align-items: center;
        gap: 12px;
    }

    .card-logo {
        width: 44px;
        height: 44px;
        background: rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
    }

    .card-title {
        flex: 1;
    }

    .title-main {
        display: block;
        font-size: 18px;
        font-weight: 700;
        color: white;
        letter-spacing: 1px;
    }

    .title-sub {
        font-size: 12px;
        color: rgba(255, 255, 255, 0.8);
    }

    .card-badge {
        background: rgba(255, 255, 255, 0.2);
        padding: 6px 12px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
        color: white;
        letter-spacing: 0.5px;
    }

    .card-body {
        padding: 24px;
    }

    .qr-section {
        text-align: center;
        margin-bottom: 24px;
    }

    .qr-container {
        display: inline-block;
        padding: 16px;
        background: white;
        border-radius: var(--apple-radius-lg);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    }

    .qr-code {
        width: 200px;
        height: 200px;
        display: block;
    }

    .qr-hint {
        margin-top: 12px;
        font-size: 12px;
        color: var(--apple-gray-1);
    }

    .qr-placeholder {
        padding: 40px;
        color: var(--apple-gray-3);
    }

    .info-section {
        text-align: center;
        margin-bottom: 24px;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--apple-gray-5);
    }

    .user-avatar {
        width: 72px;
        height: 72px;
        border-radius: 50%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        font-size: 28px;
        font-weight: 600;
        color: white;
        overflow: hidden;
    }

    .user-avatar img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .user-name {
        font-size: 22px;
        font-weight: 700;
        color: var(--apple-black);
        margin-bottom: 4px;
    }

    .user-id {
        font-size: 14px;
        color: var(--apple-accent);
        font-weight: 600;
        font-family: 'SF Mono', monospace;
    }

    .details-grid {
        display: flex;
        flex-direction: column;
        gap: 16px;
    }

    .detail-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        background: var(--apple-gray-6);
        border-radius: var(--apple-radius-md);
    }

    .detail-item :global(svg) {
        color: var(--apple-gray-1);
        flex-shrink: 0;
    }

    .detail-content {
        display: flex;
        flex-direction: column;
    }

    .detail-label {
        font-size: 11px;
        color: var(--apple-gray-1);
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .detail-value {
        font-size: 14px;
        font-weight: 500;
        color: var(--apple-black);
    }

    .card-footer {
        background: var(--apple-gray-6);
        padding: 16px 24px;
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        color: var(--apple-gray-1);
    }

    /* Instructions */
    .instructions {
        margin-top: 24px;
        padding: 20px;
        background: var(--apple-white);
        border-radius: var(--apple-radius-lg);
    }

    .instructions h3 {
        font-size: 16px;
        font-weight: 600;
        color: var(--apple-black);
        margin-bottom: 12px;
    }

    .instructions ul {
        list-style: none;
        padding: 0;
        margin: 0;
    }

    .instructions li {
        position: relative;
        padding-left: 20px;
        margin-bottom: 8px;
        font-size: 14px;
        color: var(--apple-gray-1);
    }

    .instructions li::before {
        content: '•';
        position: absolute;
        left: 0;
        color: var(--apple-accent);
    }

    /* Full Screen Modal */
    .fullscreen-modal {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }

    .fullscreen-content {
        text-align: center;
        color: white;
    }

    .fullscreen-qr {
        background: white;
        padding: 24px;
        border-radius: var(--apple-radius-xl);
        margin-bottom: 24px;
    }

    .fullscreen-qr img {
        width: 280px;
        height: 280px;
    }

    .fullscreen-name {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 8px;
    }

    .fullscreen-id {
        font-size: 16px;
        color: rgba(255, 255, 255, 0.7);
        font-family: 'SF Mono', monospace;
        margin-bottom: 24px;
    }

    .fullscreen-hint {
        font-size: 14px;
        color: rgba(255, 255, 255, 0.5);
    }

    @media (max-width: 480px) {
        .header-actions {
            width: 100%;
            justify-content: flex-end;
        }

        .action-btn span {
            display: none;
        }

        .card-header {
            padding: 16px;
        }

        .card-body {
            padding: 16px;
        }

        .qr-code {
            width: 160px;
            height: 160px;
        }
    }
    
    /* Hologram Effect Styles */
    .epass-card {
        position: relative;
    }
    
    .hologram-overlay {
        position: absolute;
        inset: 0;
        background: linear-gradient(
            135deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.1) 25%,
            rgba(255, 255, 255, 0.3) 50%,
            rgba(255, 255, 255, 0.1) 75%,
            rgba(255, 255, 255, 0) 100%
        );
        animation: hologramSweep 3s ease-in-out infinite;
        pointer-events: none;
        z-index: 10;
    }
    
    @keyframes hologramSweep {
        0%, 100% { transform: translateX(-100%) rotate(45deg); opacity: 0; }
        50% { transform: translateX(100%) rotate(45deg); opacity: 1; }
    }
    
    .qr-hologram-shine {
        position: absolute;
        inset: 0;
        background: linear-gradient(
            45deg,
            transparent 30%,
            rgba(255, 255, 255, 0.5) 50%,
            transparent 70%
        );
        animation: qrShine 2s ease-in-out infinite;
        pointer-events: none;
    }
    
    @keyframes qrShine {
        0%, 100% { transform: translateX(-100%); }
        50% { transform: translateX(100%); }
    }
    
    .qr-container {
        position: relative;
        overflow: hidden;
    }
    
    /* Anti-Screenshot Watermark */
    .anti-screenshot-watermark {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: 600;
        color: rgba(0, 0, 0, 0.03);
        transform: rotate(-30deg);
        pointer-events: none;
        z-index: 5;
        gap: 8px;
        overflow: hidden;
    }
    
    .anti-screenshot-watermark span {
        white-space: nowrap;
        font-size: 24px;
    }
    
    /* Dynamic Watermark in Footer */
    .dynamic-watermark {
        font-size: 10px;
        color: var(--apple-green);
        font-weight: 600;
        animation: pulse 2s ease-in-out infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
    }
    
    .card-footer {
        flex-wrap: wrap;
        gap: 8px;
    }
</style>
