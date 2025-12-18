<script>
    import { onMount } from 'svelte';
    import { browser } from '$app/environment';
    
    let permissionStatus = 'checking...';
    let testResults = [];
    let isLoading = false;
    let smartNotifications = [];
    let toastNotifications = [];
    let browserName = 'Unknown';
    
    // Mock attendance data for testing
    const mockAttendanceRecords = [
        // Late days streak (3 consecutive)
        { date: '2025-12-04', checkIn: { timestamp: '2025-12-04T09:45:00' }, checkOut: { timestamp: '2025-12-04T18:00:00' } },
        { date: '2025-12-05', checkIn: { timestamp: '2025-12-05T09:30:00' }, checkOut: { timestamp: '2025-12-05T18:00:00' } },
        { date: '2025-12-06', checkIn: { timestamp: '2025-12-06T09:25:00' }, checkOut: { timestamp: '2025-12-06T18:00:00' } },
        // On-time days
        { date: '2025-12-01', checkIn: { timestamp: '2025-12-01T08:55:00' }, checkOut: { timestamp: '2025-12-01T18:00:00' } },
        { date: '2025-12-02', checkIn: { timestamp: '2025-12-02T08:50:00' }, checkOut: { timestamp: '2025-12-02T18:00:00' } },
        { date: '2025-12-03', checkIn: { timestamp: '2025-12-03T08:58:00' }, checkOut: { timestamp: '2025-12-03T18:00:00' } },
    ];

    const mockWorkConfig = {
        standardStartTime: '09:00',
        standardEndTime: '18:00',
        standardHoursPerDay: 8,
        lateThresholdMinutes: 15,
        overtimeThresholdMinutes: 30
    };

    let swStatus = 'not registered';

    onMount(async () => {
        if (browser) {
            checkPermission();
            checkServiceWorker();
            detectBrowser();
        }
    });

    function detectBrowser() {
        const ua = navigator.userAgent;
        if (ua.includes('Brave')) browserName = 'Brave';
        else if (ua.includes('Edg')) browserName = 'Edge';
        else if (ua.includes('Chrome')) browserName = 'Chrome';
        else if (ua.includes('Firefox')) browserName = 'Firefox';
        else if (ua.includes('Safari')) browserName = 'Safari';
        else browserName = 'Unknown';
    }

    // Play notification sound using Web Audio API
    function playSound(type = 'default') {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;

            const audioCtx = new AudioContext();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            // Different sounds for different types
            if (type === 'urgent') {
                // Urgent: Two-tone alarm
                oscillator.frequency.value = 880;
                oscillator.type = 'square';
                gainNode.gain.value = 0.3;
                oscillator.start();
                
                // Alternate frequency for alarm effect
                setTimeout(() => { oscillator.frequency.value = 660; }, 150);
                setTimeout(() => { oscillator.frequency.value = 880; }, 300);
                setTimeout(() => { oscillator.frequency.value = 660; }, 450);
                
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.6);
                oscillator.stop(audioCtx.currentTime + 0.6);
            } else {
                // Default: Pleasant chime
                oscillator.frequency.value = 800;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.3;
                oscillator.start();
                gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
                oscillator.stop(audioCtx.currentTime + 0.3);
            }
        } catch (e) {
            console.warn('Could not play sound:', e);
        }
    }

    // In-app toast notification (always works) - NOW WITH SOUND!
    function showToast(title, body, type = 'info') {
        const id = Date.now();
        toastNotifications = [...toastNotifications, { id, title, body, type }];
        
        // Play sound with toast
        playSound(type);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toastNotifications = toastNotifications.filter(t => t.id !== id);
        }, 5000);
    }

    function removeToast(id) {
        toastNotifications = toastNotifications.filter(t => t.id !== id);
    }

    function checkPermission() {
        if (!('Notification' in window)) {
            permissionStatus = 'not supported';
            return;
        }
        permissionStatus = Notification.permission;
    }

    async function checkServiceWorker() {
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            if (registrations.length > 0) {
                swStatus = 'registered ✓';
            } else {
                swStatus = 'not registered';
            }
        } else {
            swStatus = 'not supported';
        }
    }

    async function requestPermission() {
        isLoading = true;
        try {
            const { initPushNotifications } = await import('$lib/notifications/pushNotificationService');
            const result = await initPushNotifications();
            
            if (result.success) {
                if (result.swEnabled) {
                    addResult('Init', 'Permission granted + Service Worker ready ✓', true);
                    swStatus = 'registered ✓';
                } else {
                    addResult('Init', 'Permission granted (SW skipped - use http://localhost for full support)', true);
                    swStatus = 'skipped (SSL)';
                }
            } else {
                addResult('Init', result.error, false);
            }
            checkPermission();
        } catch (error) {
            addResult('Init', error.message, false);
        }
        isLoading = false;
    }

    async function testBasicNotification() {
        isLoading = true;
        try {
            const { showPushNotification } = await import('$lib/notifications/pushNotificationService');
            const result = await showPushNotification({
                title: '🔔 Test Notification',
                body: 'This is a basic push notification test!',
                tag: 'test-basic',
                sound: 'default',
                vibrate: 'default'
            });
            addResult('Basic Notification', result ? 'Sent successfully' : 'Failed to send', result);
        } catch (error) {
            addResult('Basic Notification', error.message, false);
        }
        isLoading = false;
    }

    async function testUrgentNotification() {
        isLoading = true;
        try {
            const { showPushNotification } = await import('$lib/notifications/pushNotificationService');
            const result = await showPushNotification({
                title: '🚨 Urgent Alert!',
                body: 'This is an urgent notification with special sound and vibration!',
                tag: 'test-urgent',
                sound: 'urgent',
                vibrate: 'urgent',
                requireInteraction: true
            });
            addResult('Urgent Notification', result ? 'Sent successfully' : 'Failed to send', result);
        } catch (error) {
            addResult('Urgent Notification', error.message, false);
        }
        isLoading = false;
    }

    async function testSoundOnly() {
        try {
            const { playNotificationSound } = await import('$lib/notifications/pushNotificationService');
            playNotificationSound('default');
            addResult('Sound Test (Default)', 'Default notification sound played', true);
        } catch (error) {
            addResult('Sound Test', error.message, false);
        }
    }

    async function testUrgentSound() {
        try {
            const { playNotificationSound } = await import('$lib/notifications/pushNotificationService');
            playNotificationSound('urgent');
            addResult('Sound Test (Urgent)', 'Urgent notification sound played', true);
        } catch (error) {
            addResult('Urgent Sound Test', error.message, false);
        }
    }

    async function testAudioFile() {
        try {
            // Test playing the actual audio file directly
            const audio = new Audio('/sounds/notification.mp3');
            audio.volume = 0.7;
            await audio.play();
            addResult('Audio File Test', 'notification.mp3 played successfully', true);
        } catch (error) {
            addResult('Audio File Test', error.message, false);
        }
    }

    async function testUrgentAudioFile() {
        try {
            const audio = new Audio('/sounds/notification-urgent.mp3');
            audio.volume = 0.9;
            await audio.play();
            addResult('Urgent Audio File', 'notification-urgent.mp3 played successfully', true);
        } catch (error) {
            addResult('Urgent Audio File', error.message, false);
        }
    }

    async function testVibration() {
        try {
            const { vibrateDevice } = await import('$lib/notifications/pushNotificationService');
            vibrateDevice('default');
            addResult('Vibration Test', 'Vibration triggered (if supported)', true);
        } catch (error) {
            addResult('Vibration Test', error.message, false);
        }
    }

    // Direct native notification test (bypasses our service)
    async function testDirectNotification() {
        try {
            if (Notification.permission !== 'granted') {
                const perm = await Notification.requestPermission();
                if (perm !== 'granted') {
                    addResult('Direct Test', 'Permission denied', false);
                    return;
                }
            }
            
            // Create notification directly
            const notif = new Notification('🔔 Direct Native Test', {
                body: 'This popup should appear in your Windows notification area (bottom right)',
                icon: '/logo.png',
                requireInteraction: true,
                tag: 'direct-test-' + Date.now()
            });
            
            notif.onclick = () => {
                window.focus();
                notif.close();
            };
            
            addResult('Direct Test', 'Notification created - check bottom right of screen!', true);
        } catch (error) {
            addResult('Direct Test', error.message, false);
        }
    }

    // In-app toast test (always visible)
    function testInAppToast() {
        showToast('🔔 In-App Notification', 'This toast always works! It appears inside your app.', 'success');
        addResult('In-App Toast', 'Toast shown in top-right corner', true);
    }

    function testUrgentToast() {
        showToast('🚨 Urgent Alert!', 'This is an urgent in-app notification!', 'urgent');
        addResult('Urgent Toast', 'Urgent toast shown', true);
    }

    function openWindowsSettings() {
        addResult('Windows Settings', 'Open: Settings → System → Notifications → Enable for your browser', true);
    }

    async function testSmartEngine() {
        isLoading = true;
        try {
            const { SmartNotificationEngine } = await import('$lib/notifications/smartNotificationEngine');
            const engine = new SmartNotificationEngine('test-user', {
                thresholds: { lateStreakWarning: 2 } // Lower threshold for testing
            });
            
            const notifications = await engine.analyzeAndNotify(mockAttendanceRecords, mockWorkConfig);
            smartNotifications = notifications;
            addResult('Smart Engine', `Generated ${notifications.length} notifications`, notifications.length > 0);
        } catch (error) {
            addResult('Smart Engine', error.message, false);
        }
        isLoading = false;
    }

    async function sendSmartAsPush() {
        if (smartNotifications.length === 0) {
            addResult('Send Smart Notifications', 'No notifications to send. Run Smart Engine first.', false);
            return;
        }
        
        isLoading = true;
        try {
            const { showPushNotification } = await import('$lib/notifications/pushNotificationService');
            
            for (const notif of smartNotifications.slice(0, 3)) { // Send max 3
                await showPushNotification({
                    title: notif.title,
                    body: notif.message,
                    tag: `smart-${notif.category}`,
                    sound: notif.priority === 'urgent' ? 'urgent' : 'default'
                });
                await new Promise(r => setTimeout(r, 1000)); // Delay between notifications
            }
            addResult('Send Smart Notifications', `Sent ${Math.min(3, smartNotifications.length)} push notifications`, true);
        } catch (error) {
            addResult('Send Smart Notifications', error.message, false);
        }
        isLoading = false;
    }

    function addResult(test, message, success) {
        testResults = [{ test, message, success, time: new Date().toLocaleTimeString() }, ...testResults];
    }

    // Test background FCM notification (server-side)
    let testUserId = '';
    let fcmTokenStatus = null;

    async function checkFCMTokens() {
        if (!testUserId) {
            addResult('FCM Check', 'Please enter a user ID', false);
            return;
        }
        isLoading = true;
        try {
            const response = await fetch(`/api/test-fcm?userId=${testUserId}`);
            const data = await response.json();
            fcmTokenStatus = data;
            if (data.hasTokens) {
                addResult('FCM Check', `Found ${data.count} FCM token(s) for user`, true);
            } else {
                addResult('FCM Check', 'No FCM tokens found - user needs to login and allow notifications', false);
            }
        } catch (error) {
            addResult('FCM Check', error.message, false);
        }
        isLoading = false;
    }

    async function testBackgroundFCM() {
        if (!testUserId) {
            addResult('Background FCM', 'Please enter a user ID', false);
            return;
        }
        isLoading = true;
        try {
            const response = await fetch('/api/test-fcm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: testUserId,
                    title: '🔔 Background Test',
                    body: 'This notification was sent via FCM! Close the app and check if it appears.',
                    priority: 'normal'
                })
            });
            const data = await response.json();
            if (data.success) {
                addResult('Background FCM', data.message, true);
            } else {
                addResult('Background FCM', data.error || data.message, false);
            }
        } catch (error) {
            addResult('Background FCM', error.message, false);
        }
        isLoading = false;
    }

    async function testUrgentBackgroundFCM() {
        if (!testUserId) {
            addResult('Urgent Background FCM', 'Please enter a user ID', false);
            return;
        }
        isLoading = true;
        try {
            const response = await fetch('/api/test-fcm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: testUserId,
                    title: '🚨 URGENT Background Test',
                    body: 'This is an URGENT notification! Should appear even when app is closed.',
                    priority: 'urgent'
                })
            });
            const data = await response.json();
            if (data.success) {
                addResult('Urgent Background FCM', data.message, true);
            } else {
                addResult('Urgent Background FCM', data.error || data.message, false);
            }
        } catch (error) {
            addResult('Urgent Background FCM', error.message, false);
        }
        isLoading = false;
    }

    function clearResults() {
        testResults = [];
        smartNotifications = [];
        fcmTokenStatus = null;
    }
</script>

<!-- Toast Container -->
<div class="toast-container">
    {#each toastNotifications as toast (toast.id)}
        <div class="toast {toast.type}" role="alert">
            <div class="toast-content">
                <strong>{toast.title}</strong>
                <p>{toast.body}</p>
            </div>
            <button class="toast-close" on:click={() => removeToast(toast.id)}>×</button>
        </div>
    {/each}
</div>

<div class="test-page">
    <h1>🔔 Push Notification Test Page</h1>
    
    <div class="status-card">
        <h2>Status</h2>
        <div class="status-row">
            <div>
                <span class="label">Permission:</span>
                <span class="status {permissionStatus}">{permissionStatus}</span>
            </div>
            <div>
                <span class="label">Service Worker:</span>
                <span class="status {swStatus.includes('✓') ? 'granted' : swStatus.includes('skipped') ? 'default' : 'denied'}">{swStatus}</span>
            </div>
        </div>
        
        {#if swStatus.includes('skipped')}
            <p class="ssl-hint">💡 For native OS popups, use <code>http://localhost:5173</code> instead of https</p>
        {/if}
        
        {#if permissionStatus !== 'granted'}
            <button on:click={requestPermission} disabled={isLoading}>
                🔓 Request Permission
            </button>
        {:else if swStatus === 'not registered'}
            <button on:click={requestPermission} disabled={isLoading}>
                ⚙️ Initialize Notifications
            </button>
        {/if}
    </div>

    <div class="test-section in-app-section">
        <h2>✅ In-App Toast Notifications (Always Works)</h2>
        <p class="hint">These appear inside your app - works on all browsers including Brave!</p>
        <div class="button-grid">
            <button on:click={testInAppToast} class="primary-btn">
                🔔 Show In-App Toast
            </button>
            <button on:click={testUrgentToast} class="urgent-btn">
                🚨 Urgent Toast
            </button>
        </div>
    </div>

    <div class="test-section">
        <h2>🖥️ Native OS Popup Test</h2>
        <p class="hint">Browser: <strong>{browserName}</strong> {browserName === 'Brave' ? '⚠️ Brave blocks most notifications!' : ''}</p>
        <div class="button-grid">
            <button on:click={testDirectNotification} disabled={isLoading}>
                🔔 Test Native Popup
            </button>
            <button on:click={openWindowsSettings} class="secondary-btn">
                ⚙️ Windows Settings Help
            </button>
        </div>
        {#if browserName === 'Brave'}
            <div class="brave-warning">
                <p><strong>⚠️ Brave Browser Detected!</strong></p>
                <p>Brave blocks most notifications by default. Try:</p>
                <ol>
                    <li>Click the <strong>Brave Shields</strong> (lion icon) in address bar</li>
                    <li>Turn shields DOWN for this site</li>
                    <li>Or use <strong>Chrome/Edge</strong> for native OS popups</li>
                    <li>Or use the <strong>In-App Toast</strong> above (always works!)</li>
                </ol>
            </div>
        {:else}
            <div class="windows-help">
                <p><strong>If no popup appears:</strong></p>
                <ol>
                    <li>Press <code>Win + I</code> → System → Notifications</li>
                    <li>Make sure "Notifications" is ON</li>
                    <li>Scroll down, find your browser (Chrome/Edge/Firefox)</li>
                    <li>Make sure it's enabled with "Show notification banners"</li>
                    <li>Turn OFF "Focus Assist" if enabled</li>
                </ol>
            </div>
        {/if}
    </div>

    <div class="test-section">
        <h2>🔊 Sound & Vibration Tests</h2>
        <p class="hint">Test notification sounds from static/sounds folder</p>
        <div class="button-grid">
            <button on:click={testSoundOnly} disabled={isLoading}>
                🔊 Default Sound
            </button>
            <button on:click={testUrgentSound} disabled={isLoading} class="urgent-btn">
                🔊 Urgent Sound
            </button>
            <button on:click={testAudioFile} disabled={isLoading}>
                🎵 notification.mp3
            </button>
            <button on:click={testUrgentAudioFile} disabled={isLoading} class="urgent-btn">
                🎵 notification-urgent.mp3
            </button>
            <button on:click={testVibration} disabled={isLoading}>
                📳 Test Vibration
            </button>
        </div>
    </div>

    <div class="test-section">
        <h2>📬 Push Notification Tests</h2>
        <p class="hint">Test full push notifications with sound and vibration</p>
        <div class="button-grid">
            <button on:click={testBasicNotification} disabled={isLoading || permissionStatus !== 'granted'}>
                📬 Basic Notification
            </button>
            <button on:click={testUrgentNotification} disabled={isLoading || permissionStatus !== 'granted'}>
                🚨 Urgent Notification
            </button>
        </div>
    </div>

    <div class="test-section background-section">
        <h2>🌐 Background FCM Test (Server-Side)</h2>
        <p class="hint">Test real FCM push notifications that work even when app is CLOSED</p>
        
        <div class="user-id-input">
            <label for="userId">User ID:</label>
            <input 
                type="text" 
                id="userId" 
                bind:value={testUserId} 
                placeholder="Enter user ID (from Firebase)"
            />
        </div>

        <div class="button-grid">
            <button on:click={checkFCMTokens} disabled={isLoading || !testUserId}>
                🔍 Check FCM Tokens
            </button>
            <button on:click={testBackgroundFCM} disabled={isLoading || !testUserId}>
                📤 Send Background Notification
            </button>
            <button on:click={testUrgentBackgroundFCM} disabled={isLoading || !testUserId} class="urgent-btn">
                🚨 Send Urgent Background
            </button>
        </div>

        {#if fcmTokenStatus}
            <div class="fcm-status" class:has-tokens={fcmTokenStatus.hasTokens}>
                <h4>{fcmTokenStatus.hasTokens ? '✅ FCM Tokens Found' : '❌ No FCM Tokens'}</h4>
                {#if fcmTokenStatus.hasTokens}
                    <p>Found {fcmTokenStatus.count} registered device(s):</p>
                    <ul>
                        {#each fcmTokenStatus.tokens as token}
                            <li>
                                <strong>{token.browser}</strong> on {token.platform}
                                <br><small>Registered: {new Date(token.createdAt).toLocaleString()}</small>
                            </li>
                        {/each}
                    </ul>
                {:else}
                    <p>{fcmTokenStatus.message}</p>
                    <p class="hint">User needs to:</p>
                    <ol>
                        <li>Login to the app</li>
                        <li>Allow notification permission</li>
                        <li>Wait for FCM token registration</li>
                    </ol>
                {/if}
            </div>
        {/if}

        <div class="background-help">
            <p><strong>📋 How to test background notifications:</strong></p>
            <ol>
                <li>Enter your user ID (find it in Firebase Console → Realtime Database → users)</li>
                <li>Click "Check FCM Tokens" to verify registration</li>
                <li>Click "Send Background Notification"</li>
                <li><strong>Close this browser tab completely</strong></li>
                <li>Wait 5-10 seconds - notification should appear in your OS notification area</li>
            </ol>
        </div>
    </div>

    <div class="test-section">
        <h2>Smart Notification Engine</h2>
        <p class="hint">Tests the engine with mock attendance data (includes late streak)</p>
        <div class="button-grid">
            <button on:click={testSmartEngine} disabled={isLoading}>
                🧠 Analyze Attendance
            </button>
            <button on:click={sendSmartAsPush} disabled={isLoading || smartNotifications.length === 0}>
                📤 Send as Push ({smartNotifications.length})
            </button>
        </div>
        
        {#if smartNotifications.length > 0}
            <div class="smart-results">
                <h3>Generated Notifications:</h3>
                {#each smartNotifications as notif}
                    <div class="smart-notif {notif.priority}">
                        <span class="category">{notif.category}</span>
                        <span class="priority">{notif.priority}</span>
                        <strong>{notif.title}</strong>
                        <p>{notif.message}</p>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <div class="results-section">
        <div class="results-header">
            <h2>Test Results</h2>
            <button class="clear-btn" on:click={clearResults}>Clear</button>
        </div>
        {#if testResults.length === 0}
            <p class="no-results">No tests run yet</p>
        {:else}
            {#each testResults as result}
                <div class="result {result.success ? 'success' : 'error'}">
                    <span class="time">{result.time}</span>
                    <span class="test-name">{result.test}</span>
                    <span class="message">{result.message}</span>
                </div>
            {/each}
        {/if}
    </div>
</div>

<style>
    .test-page {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        font-family: system-ui, -apple-system, sans-serif;
    }

    h1 {
        text-align: center;
        margin-bottom: 2rem;
    }

    h2 {
        margin-bottom: 1rem;
        color: #333;
    }

    .status-card {
        background: #f5f5f5;
        padding: 1.5rem;
        border-radius: 12px;
        margin-bottom: 2rem;
        text-align: center;
    }

    .status-row {
        display: flex;
        justify-content: center;
        gap: 2rem;
        margin-bottom: 1rem;
        flex-wrap: wrap;
    }

    .status-row .label {
        color: #666;
        margin-right: 0.5rem;
    }

    .status {
        display: inline-block;
        padding: 0.3rem 0.75rem;
        border-radius: 20px;
        font-weight: bold;
        font-size: 0.9rem;
    }

    .status.granted { background: #d4edda; color: #155724; }
    .status.denied { background: #f8d7da; color: #721c24; }
    .status.default { background: #fff3cd; color: #856404; }

    .ssl-hint {
        font-size: 0.85rem;
        color: #666;
        margin: 0.5rem 0 1rem;
    }

    .ssl-hint code {
        background: #e5e7eb;
        padding: 0.2rem 0.4rem;
        border-radius: 4px;
        font-size: 0.8rem;
    }

    .windows-help {
        margin-top: 1rem;
        padding: 1rem;
        background: #fef3c7;
        border-radius: 8px;
        font-size: 0.85rem;
    }

    .windows-help ol {
        margin: 0.5rem 0 0 1.2rem;
        padding: 0;
    }

    .windows-help li {
        margin-bottom: 0.3rem;
    }

    .windows-help code {
        background: #fde68a;
        padding: 0.1rem 0.3rem;
        border-radius: 3px;
    }

    .primary-btn {
        background: #059669 !important;
    }

    .primary-btn:hover:not(:disabled) {
        background: #047857 !important;
    }

    .secondary-btn {
        background: #6b7280 !important;
    }

    .urgent-btn {
        background: #dc2626 !important;
    }

    .urgent-btn:hover:not(:disabled) {
        background: #b91c1c !important;
    }

    .in-app-section {
        background: #ecfdf5 !important;
        border-color: #10b981 !important;
    }

    .background-section {
        background: #fef3c7 !important;
        border-color: #f59e0b !important;
    }

    .user-id-input {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 1rem;
        flex-wrap: wrap;
    }

    .user-id-input label {
        font-weight: 600;
        color: #374151;
    }

    .user-id-input input {
        flex: 1;
        min-width: 200px;
        padding: 10px 14px;
        border: 2px solid #d1d5db;
        border-radius: 8px;
        font-size: 14px;
        transition: border-color 0.2s;
    }

    .user-id-input input:focus {
        outline: none;
        border-color: #f59e0b;
    }

    .fcm-status {
        margin-top: 1rem;
        padding: 1rem;
        border-radius: 8px;
        background: #fef2f2;
        border: 1px solid #fecaca;
    }

    .fcm-status.has-tokens {
        background: #ecfdf5;
        border-color: #a7f3d0;
    }

    .fcm-status h4 {
        margin: 0 0 0.5rem 0;
    }

    .fcm-status ul {
        margin: 0.5rem 0;
        padding-left: 1.2rem;
    }

    .fcm-status li {
        margin-bottom: 0.5rem;
    }

    .background-help {
        margin-top: 1rem;
        padding: 1rem;
        background: rgba(255, 255, 255, 0.7);
        border-radius: 8px;
        font-size: 0.9rem;
    }

    .background-help ol {
        margin: 0.5rem 0 0 1.2rem;
        padding: 0;
    }

    .brave-warning {
        margin-top: 1rem;
        padding: 1rem;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        font-size: 0.85rem;
    }

    .brave-warning ol {
        margin: 0.5rem 0 0 1.2rem;
        padding: 0;
    }

    /* Toast Notifications */
    .toast-container {
        position: fixed;
        top: 1rem;
        right: 1rem;
        z-index: 9999;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        max-width: 350px;
    }

    .toast {
        display: flex;
        align-items: flex-start;
        gap: 0.75rem;
        padding: 1rem;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
        background: white;
        border-left: 4px solid #3b82f6;
    }

    .toast.success {
        border-left-color: #10b981;
        background: #ecfdf5;
    }

    .toast.urgent {
        border-left-color: #dc2626;
        background: #fef2f2;
        animation: slideIn 0.3s ease-out, pulse 0.5s ease-in-out 2;
    }

    .toast-content {
        flex: 1;
    }

    .toast-content strong {
        display: block;
        margin-bottom: 0.25rem;
        color: #1f2937;
    }

    .toast-content p {
        margin: 0;
        font-size: 0.875rem;
        color: #6b7280;
    }

    .toast-close {
        background: none;
        border: none;
        font-size: 1.25rem;
        color: #9ca3af;
        cursor: pointer;
        padding: 0;
        line-height: 1;
    }

    .toast-close:hover {
        color: #374151;
    }

    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.02); }
    }

    .test-section {
        background: #fff;
        border: 1px solid #ddd;
        padding: 1.5rem;
        border-radius: 12px;
        margin-bottom: 1.5rem;
    }

    .hint {
        color: #666;
        font-size: 0.9rem;
        margin-bottom: 1rem;
    }

    .button-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 1rem;
    }

    button {
        padding: 0.75rem 1.5rem;
        border: none;
        border-radius: 8px;
        background: #4f46e5;
        color: white;
        font-size: 1rem;
        cursor: pointer;
        transition: all 0.2s;
    }

    button:hover:not(:disabled) {
        background: #4338ca;
        transform: translateY(-1px);
    }

    button:disabled {
        background: #ccc;
        cursor: not-allowed;
    }

    .smart-results {
        margin-top: 1.5rem;
        padding-top: 1rem;
        border-top: 1px solid #eee;
    }

    .smart-notif {
        background: #f9f9f9;
        padding: 1rem;
        border-radius: 8px;
        margin-bottom: 0.75rem;
        border-left: 4px solid #4f46e5;
    }

    .smart-notif.urgent { border-left-color: #dc2626; }
    .smart-notif.high { border-left-color: #f59e0b; }
    .smart-notif.medium { border-left-color: #3b82f6; }
    .smart-notif.low { border-left-color: #10b981; }

    .smart-notif .category, .smart-notif .priority {
        display: inline-block;
        font-size: 0.75rem;
        padding: 0.2rem 0.5rem;
        border-radius: 4px;
        margin-right: 0.5rem;
        margin-bottom: 0.5rem;
    }

    .smart-notif .category { background: #e0e7ff; color: #3730a3; }
    .smart-notif .priority { background: #fef3c7; color: #92400e; }

    .smart-notif strong { display: block; margin-bottom: 0.25rem; }
    .smart-notif p { margin: 0; color: #666; font-size: 0.9rem; }

    .results-section {
        background: #1a1a2e;
        padding: 1.5rem;
        border-radius: 12px;
        color: #fff;
    }

    .results-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
    }

    .results-header h2 { color: #fff; margin: 0; }

    .clear-btn {
        background: #374151;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
    }

    .no-results {
        color: #888;
        text-align: center;
        padding: 2rem;
    }

    .result {
        display: grid;
        grid-template-columns: 80px 150px 1fr;
        gap: 1rem;
        padding: 0.75rem;
        border-radius: 6px;
        margin-bottom: 0.5rem;
        font-size: 0.9rem;
    }

    .result.success { background: rgba(16, 185, 129, 0.2); }
    .result.error { background: rgba(239, 68, 68, 0.2); }

    .time { color: #888; }
    .test-name { font-weight: 500; }
    .message { color: #ccc; }
</style>
