<script>
    import { auth, subscribeToAuth, ref, push, set, update, query, orderByChild, equalTo, get } from "$lib/firebase";
    import { db } from "$lib/firebase";
    import { isAttendanceFrozen } from '$lib/services/holidayService.js';
    import { onMount, onDestroy } from 'svelte';
    import { format } from 'date-fns';
    import {
        IconClockPin, IconClockPause, IconClockPlay, IconClockStop,
        IconActivity, IconClock, IconCamera, IconFlame, IconShield,
        IconMapPin, IconWifi, IconWifiOff, IconAlertTriangle, IconCheck,
        IconDevices, IconRefresh
    } from "@tabler/icons-svelte";
    import { updateStreak, getGamificationData } from '$lib/stores/gamification.js';
    
    // Security Imports
    import { generateDeviceFingerprint, getDeviceInfo, storeTrustedDevice, isDeviceTrusted } from '$lib/security/deviceFingerprint.js';
    import { createSecureSession, validateSession, updateSessionActivity } from '$lib/security/sessionManager.js';
    import { getCurrentLocation, validateLocationInGeofence, logLocationValidation } from '$lib/security/geofence.js';
    import { queueOfflineAction, syncPendingActions, getPendingCount, setupAutoSync, isOffline } from '$lib/offline/offlineQueue.js';
    import { subscribeToTodayAttendance, subscribeToGamification, liveStatus } from '$lib/realtime/liveSyncEngine.js';
    import { analyzeAttendanceBehavior } from '$lib/ai/behaviorAnalysis.js';
    import { securityStatus, geofenceStatus, offlineStatus, behaviorStatus } from '$lib/stores/enterpriseSecurity.js';

    // State variables
    let isProcessing = false;
    let cameraStream = null;
    let capturedImage = null;
    let status = 'none'; 
    let currentShiftId = null;
    let checkInTime = null;
    let currentTime = new Date();
    let timerInterval;
    let userId = null;
    let USER_PATH = '';
    let currentStreak = 0;
    
    // Enterprise state
    let securityChecked = false;
    let locationData = null;
    let deviceData = null;
    let pendingSyncCount = 0;
    let showSecurityPanel = false;
    let securityWarnings = [];
    let unsubscribers = [];

    onMount(async () => {
        timerInterval = setInterval(() => currentTime = new Date(), 1000);
        setupAutoSync();
        
        window.addEventListener('offline-sync-complete', handleSyncComplete);
        window.addEventListener('session-invalid', handleSessionInvalid);
        window.addEventListener('online', () => offlineStatus.update(s => ({ ...s, isOffline: false })));
        window.addEventListener('offline', () => offlineStatus.update(s => ({ ...s, isOffline: true })));
        offlineStatus.update(s => ({ ...s, isOffline: !navigator.onLine }));
        
        const unsubscribe = subscribeToAuth(async (user) => {
            if (user) {
                userId = user.uid;
                USER_PATH = `attendance/${userId}`;
                await initializeEnterpriseSecurity();
                setupRealtimeSubscriptions();
                loadActiveShift();
                const gamifData = await getGamificationData(userId);
                if (gamifData) currentStreak = gamifData.currentStreak || 0;
                pendingSyncCount = await getPendingCount(userId);
                offlineStatus.update(s => ({ ...s, pendingActions: pendingSyncCount }));
            }
        });
        unsubscribers.push(unsubscribe);
        
        return () => {
            clearInterval(timerInterval);
            unsubscribers.forEach(unsub => unsub());
            window.removeEventListener('offline-sync-complete', handleSyncComplete);
            window.removeEventListener('session-invalid', handleSessionInvalid);
        };
    });
    
    onDestroy(() => { unsubscribers.forEach(unsub => unsub()); });
    
    // Phase 8.2: Check if attendance is frozen (holiday/weekend)
    async function checkAttendanceFreeze() {
        try {
            return await isAttendanceFrozen(new Date());
        } catch (error) {
            console.error('Error checking attendance freeze:', error);
            return { frozen: false };
        }
    }
    
    async function initializeEnterpriseSecurity() {
        securityWarnings = [];
        try {
            deviceData = await getDeviceInfo();
            const trusted = isDeviceTrusted(userId, deviceData.fingerprint);
            securityStatus.update(s => ({ ...s, deviceTrusted: trusted }));
            if (!trusted) securityWarnings.push({ type: 'device', message: 'New device detected', severity: 'warning' });
            
            const sessionResult = await validateSession(userId);
            if (!sessionResult.valid) {
                locationData = await getCurrentLocation().catch(() => null);
                await createSecureSession(userId, locationData);
            }
            securityStatus.update(s => ({ ...s, sessionValid: true }));
            
            if (!locationData) locationData = await getCurrentLocation().catch(() => null);
            if (locationData) {
                const geoResult = await validateLocationInGeofence(locationData);
                geofenceStatus.set({ inZone: geoResult.valid, currentZone: geoResult.zone || null, distance: geoResult.distance || null, lastValidation: new Date().toISOString() });
                securityStatus.update(s => ({ ...s, locationValid: geoResult.valid }));
                if (!geoResult.valid) securityWarnings.push({ type: 'location', message: geoResult.message, severity: 'error' });
            }
            securityChecked = true;
            securityStatus.update(s => ({ ...s, lastCheck: new Date().toISOString() }));
        } catch (error) {
            console.error('Security initialization error:', error);
            securityWarnings.push({ type: 'system', message: 'Security check failed', severity: 'error' });
        }
    }
    
    function setupRealtimeSubscriptions() {
        const todayUnsub = subscribeToTodayAttendance(userId, (todayData) => {
            if (todayData) {
                currentShiftId = todayData.id;
                status = todayData.currentStatus;
                if (todayData.checkIn?.timestamp) checkInTime = new Date(todayData.checkIn.timestamp);
                if (todayData.checkIn?.capturedImage) capturedImage = todayData.checkIn.capturedImage;
                // Update break times from real-time data
                if (todayData.breakIn?.timestamp) {
                    const newBreakStart = new Date(todayData.breakIn.timestamp);
                    if (todayData.breakOut?.timestamp) {
                        // Break completed
                        const breakEndTime = new Date(todayData.breakOut.timestamp);
                        accumulatedBreakTime = breakEndTime.getTime() - newBreakStart.getTime();
                        breakStartTime = null;
                    } else if (todayData.currentStatus === 'onBreak') {
                        // Currently on break
                        breakStartTime = newBreakStart;
                    }
                }
            }
        });
        unsubscribers.push(todayUnsub);
        const gamifUnsub = subscribeToGamification(userId, (data) => { if (data) currentStreak = data.currentStreak || 0; });
        unsubscribers.push(gamifUnsub);
    }
    
    function handleSyncComplete(event) {
        const { synced, pending } = event.detail;
        pendingSyncCount = pending;
        offlineStatus.update(s => ({ ...s, pendingActions: pending, lastSync: new Date().toISOString() }));
        if (synced > 0) alert(`Synced ${synced} offline action(s) successfully!`);
    }
    
    function handleSessionInvalid() {
        securityStatus.update(s => ({ ...s, sessionValid: false }));
        securityWarnings.push({ type: 'session', message: 'Session expired', severity: 'error' });
    }

    async function getDeviceInfoLegacy() {
        const ua = navigator.userAgent;
        const platform = navigator.platform;
        const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(ua);
        let name = 'Unknown', version = 'Unknown';
        if (ua.includes('Chrome')) { name='Chrome'; version=(ua.match(/Chrome\/([\d.]+)/)||[])[1]||'Unknown'; }
        else if (ua.includes('Firefox')) { name='Firefox'; version=(ua.match(/Firefox\/([\d.]+)/)||[])[1]||'Unknown'; }
        else if (ua.includes('Safari')) { name='Safari'; version=(ua.match(/Version\/([\d.]+)/)||[])[1]||'Unknown'; }
        const fingerprint = await generateDeviceFingerprint();
        return { browser:`${name} ${version}`, device: platform, deviceType: isMobile ? "Mobile" : "Desktop", userAgent: ua, fingerprint, timestamp: new Date().toISOString() };
    }

    async function getLocation() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(pos => {
                resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: new Date(pos.timestamp).toISOString() });
            }, reject, { enableHighAccuracy: true, timeout: 10000 });
        });
    }

    async function getLocationName(lat, lng) {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
            if (!res.ok) throw new Error('Failed');
            const data = await res.json();
            const city = data.address.city || data.address.town || data.address.village || data.display_name;
            const brgy = data.address.suburb || data.address.neighbourhood || data.address.quarter || '';
            return brgy ? `${city}, ${brgy}` : city;
        } catch { return 'Unknown Location'; }
    }

    async function captureImage() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' } });
            cameraStream = stream;
            const video = document.createElement('video');
            video.srcObject = stream;
            await new Promise(r=>video.onloadedmetadata=()=>{video.play(); r();});
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            const image = canvas.toDataURL('image/jpeg', 0.8);
            cameraStream.getTracks().forEach(t=>t.stop());
            cameraStream = null;
            return image;
        } catch(err) { console.error(err); return null; }
    }

    async function loadActiveShift() {
        if (!USER_PATH) return;
        try {
            const today = new Date().toDateString();
            const attendanceRef = ref(db, USER_PATH);
            const q = query(attendanceRef, orderByChild('date'), equalTo(today));
            const snapshot = await get(q);
            if (snapshot.exists()) {
                let lastShift = null;
                snapshot.forEach(childSnapshot => {
                    const shift = childSnapshot.val();
                    if (shift.currentStatus !== 'checkedOut') lastShift = { key: childSnapshot.key, status: shift.currentStatus, checkIn: shift.checkIn, breakIn: shift.breakIn, breakOut: shift.breakOut };
                });
                if (lastShift) {
                    currentShiftId = lastShift.key;
                    status = lastShift.status;
                    if (lastShift.checkIn?.timestamp) checkInTime = new Date(lastShift.checkIn.timestamp);
                    if (lastShift.checkIn?.capturedImage) capturedImage = lastShift.checkIn.capturedImage;
                    // Load break times for accurate timer calculation
                    if (lastShift.breakIn?.timestamp) {
                        breakStartTime = new Date(lastShift.breakIn.timestamp);
                        if (lastShift.breakOut?.timestamp) {
                            // Break completed - calculate accumulated break time
                            const breakEndTime = new Date(lastShift.breakOut.timestamp);
                            accumulatedBreakTime = breakEndTime.getTime() - breakStartTime.getTime();
                            breakStartTime = null; // Reset since break is over
                        }
                    }
                }
            }
        } catch(err) { console.error("Error loading active shift:", err); }
    }

    async function logAttendance(action) {
        if (isProcessing || !USER_PATH) { if (!USER_PATH) alert("Error: Please log in."); return; }
        isProcessing = true;
        
        try {
            // Phase 8.2: Check holiday attendance freeze
            const freezeCheck = await checkAttendanceFreeze();
            if (freezeCheck.frozen) {
                alert(`🎉 ${freezeCheck.message}\n\nAttendance is not required today.`);
                isProcessing = false;
                return;
            }
            
            await updateSessionActivity(userId);
            const device = await getDeviceInfoLegacy();
            const coords = await getLocation();
            const locationName = await getLocationName(coords.latitude, coords.longitude);
            
            const geoValidation = await validateLocationInGeofence({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy });
            await logLocationValidation(userId, geoValidation, action);
            
            if (!geoValidation.valid) {
                const proceed = confirm(`⚠️ Location Warning:\n${geoValidation.message}\n\nDo you want to proceed anyway? This will be flagged for review.`);
                if (!proceed) { isProcessing = false; return; }
            }
            
            const image = await captureImage();
            if (!image) throw new Error("Could not capture image");
            
            const newActionData = { 
                timestamp: new Date().toISOString(), 
                location: { ...coords, name: locationName, validated: geoValidation.valid, zone: geoValidation.zone?.name || null }, 
                device, capturedImage: image,
                securityMetadata: { deviceTrusted: isDeviceTrusted(userId, device.fingerprint), locationValidated: geoValidation.valid, sessionId: localStorage.getItem(`current_session_${userId}`) }
            };
            
            const behaviorAnalysis = await analyzeAttendanceBehavior(userId, { type: action, timestamp: newActionData.timestamp, location: newActionData.location, device: newActionData.device });
            behaviorStatus.set({ trustScore: 100 - (behaviorAnalysis.riskScore || 0), riskLevel: behaviorAnalysis.risk, anomalies: behaviorAnalysis.anomalies, lastAnalysis: new Date().toISOString() });
            
            if (behaviorAnalysis.blocked) { alert(`🚫 Security Alert:\nYour attendance attempt has been blocked due to suspicious activity.\n\nPlease contact your administrator.`); isProcessing = false; return; }
            if (behaviorAnalysis.requiresReview) securityWarnings.push({ type: 'behavior', message: `Anomaly detected: ${behaviorAnalysis.anomalies.map(a => a.message).join(', ')}`, severity: 'warning' });
            
            if (isOffline()) {
                await queueOfflineAction({ type: action, userId, shiftId: currentShiftId, data: newActionData });
                pendingSyncCount = await getPendingCount(userId);
                offlineStatus.update(s => ({ ...s, pendingActions: pendingSyncCount }));
                if (action === 'checkIn') { status = 'checkedIn'; checkInTime = new Date(); capturedImage = image; accumulatedBreakTime = 0; breakStartTime = null; }
                else if (action === 'checkOut') status = 'checkedOut';
                else if (action === 'breakIn') { status = 'onBreak'; breakStartTime = new Date(); }
                else if (action === 'breakOut') { 
                    status = 'checkedIn'; 
                    if (breakStartTime) {
                        accumulatedBreakTime += new Date().getTime() - breakStartTime.getTime();
                        breakStartTime = null;
                    }
                }
                alert(`📴 Offline Mode:\n${action} saved locally and will sync when online.`);
                isProcessing = false; return;
            }
            
            capturedImage = image;
            let entryRef, shouldReload = false;
            
            if(action === 'checkIn') {
                if (status !== 'none') throw new Error("Already checked in.");
                status = 'checkedIn';
                entryRef = push(ref(db, USER_PATH));
                currentShiftId = entryRef.key;
                checkInTime = new Date();
                accumulatedBreakTime = 0;
                breakStartTime = null;
                await set(entryRef, { checkIn: newActionData, currentStatus: 'checkedIn', date: new Date().toDateString(), behaviorAnalysis: { riskLevel: behaviorAnalysis.risk, anomalyCount: behaviorAnalysis.anomalies.length } });
                storeTrustedDevice(userId, device);
                const streakResult = await updateStreak(userId, new Date().toISOString());
                if (streakResult) currentStreak = streakResult.currentStreak;
            } else {
                if (!currentShiftId) throw new Error("Please Check In first.");
                entryRef = ref(db, `${USER_PATH}/${currentShiftId}`);
                let updateData = {};
                if(action==='breakIn') { 
                    if (status!=='checkedIn') throw new Error("Must be checked in."); 
                    status='onBreak'; 
                    breakStartTime = new Date();
                    updateData={ currentStatus:'onBreak', breakIn:newActionData }; 
                }
                else if(action==='breakOut') { 
                    if (status!=='onBreak') throw new Error("Must be on break."); 
                    status='checkedIn'; 
                    // Calculate break duration and add to accumulated time
                    if (breakStartTime) {
                        accumulatedBreakTime += new Date().getTime() - breakStartTime.getTime();
                        breakStartTime = null;
                    }
                    updateData={ currentStatus:'checkedIn', breakOut:newActionData }; 
                }
                else if(action==='checkOut') { status='checkedOut'; updateData={ currentStatus:'checkedOut', checkOut:newActionData }; shouldReload=true; }
                await update(entryRef, updateData);
            }
            
            alert(`${geoValidation.valid ? '✅' : '⚠️'} ${action} successful!${!geoValidation.valid ? '\n(Location flagged for review)' : ''}`);
            if (shouldReload) window.location.reload();
        } catch(err) { console.error(err); alert(`Error: ${err.message}`); }
        finally { isProcessing = false; }
    }

    const handleCheckIn = () => logAttendance("checkIn");
    const handleBreakIn = () => logAttendance("breakIn");
    const handleBreakOut = () => logAttendance("breakOut");
    const handleCheckOut = () => logAttendance("checkOut");
    
    async function manualSync() {
        offlineStatus.update(s => ({ ...s, syncInProgress: true }));
        const result = await syncPendingActions();
        pendingSyncCount = result.pending;
        offlineStatus.update(s => ({ ...s, syncInProgress: false, pendingActions: result.pending, lastSync: new Date().toISOString() }));
        if (result.synced > 0) alert(`✅ Synced ${result.synced} action(s)!`);
        else if (result.pending === 0) alert('All caught up! No pending actions.');
    }

    // Track break start time for pausing the timer
    let breakStartTime = null;
    let accumulatedBreakTime = 0; // Total break time in ms (for completed breaks)
    
    // Calculate time on shift, pausing during breaks
    $: {
        if (!checkInTime) {
            timeOnShift = 0;
        } else if (status === 'onBreak') {
            // On break - freeze the timer at the moment break started
            if (breakStartTime) {
                timeOnShift = breakStartTime.getTime() - checkInTime.getTime() - accumulatedBreakTime;
            } else {
                // Fallback if breakStartTime not set
                timeOnShift = currentTime.getTime() - checkInTime.getTime() - accumulatedBreakTime;
            }
        } else {
            // Working or checked out - subtract all break time
            timeOnShift = currentTime.getTime() - checkInTime.getTime() - accumulatedBreakTime;
        }
    }
    let timeOnShift = 0;
    function formatDuration(ms) { if (!ms || ms < 0) return '00:00:00'; const s = Math.floor(ms / 1000); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60; return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`; }
    function getStatusText(s) { if (s === 'checkedIn') return 'Checked In'; if (s === 'onBreak') return 'On Break'; if (s === 'checkedOut') return 'Checked Out'; return 'Ready to Clock In'; }
    function getStatusColor(s) { if (s === 'checkedIn') return 'green'; if (s === 'onBreak') return 'yellow'; return 'gray'; }
</script>

<svelte:head><title>Attendance | Student Attendance System</title></svelte:head>

<div class="attendance-page">
    <div class="attendance-content apple-animate-in">
        <header class="page-header">
            <div class="header-main">
                <h1 class="page-title">Attendance</h1>
                <p class="page-subtitle">Track your class attendance</p>
            </div>
            <div class="header-actions">
                <button class="security-toggle" class:active={showSecurityPanel} on:click={() => showSecurityPanel = !showSecurityPanel}>
                    <IconShield size={20} stroke={1.5} /><span>Security</span>
                    {#if securityWarnings.length > 0}<span class="warning-badge">{securityWarnings.length}</span>{/if}
                </button>
            </div>
        </header>

        {#if showSecurityPanel}
        <div class="security-panel">
            <div class="security-header">
                <h3>Security Status</h3>
                <div class="live-indicator" class:online={$liveStatus.connected}>
                    {#if $liveStatus.connected}<IconWifi size={16} stroke={1.5} /><span>Live</span>
                    {:else}<IconWifiOff size={16} stroke={1.5} /><span>Offline</span>{/if}
                </div>
            </div>
            <div class="security-grid">
                <div class="security-item" class:valid={$securityStatus.sessionValid}><IconShield size={18} stroke={1.5} /><span>Session</span><span class="status-dot"></span></div>
                <div class="security-item" class:valid={$securityStatus.deviceTrusted}><IconDevices size={18} stroke={1.5} /><span>Device</span><span class="status-dot"></span></div>
                <div class="security-item" class:valid={$geofenceStatus.inZone}><IconMapPin size={18} stroke={1.5} /><span>Location</span><span class="status-dot"></span></div>
                <div class="security-item" class:valid={$behaviorStatus.riskLevel === 'low'}><IconCheck size={18} stroke={1.5} /><span>Behavior</span><span class="status-dot"></span></div>
            </div>
            {#if $geofenceStatus.currentZone}<div class="zone-info"><IconMapPin size={14} stroke={1.5} /><span>{$geofenceStatus.currentZone.name} ({$geofenceStatus.distance}m)</span></div>{/if}
            {#if securityWarnings.length > 0}<div class="warnings-list">{#each securityWarnings as warning}<div class="warning-item {warning.severity}"><IconAlertTriangle size={14} stroke={1.5} /><span>{warning.message}</span></div>{/each}</div>{/if}
            {#if $offlineStatus.pendingActions > 0}<div class="sync-status"><span>{$offlineStatus.pendingActions} pending action(s)</span><button class="sync-btn" on:click={manualSync} disabled={$offlineStatus.syncInProgress}><IconRefresh size={14} stroke={1.5} />Sync Now</button></div>{/if}
        </div>
        {/if}

        {#if $offlineStatus.isOffline}<div class="offline-banner"><IconWifiOff size={18} stroke={1.5} /><span>You're offline. Actions will be saved and synced when connected.</span></div>{/if}

        <div class="status-grid">
            <div class="status-card">
                <div class="status-card-content">
                    <div class="status-info"><p class="status-label">Current Time</p><p class="status-time">{format(currentTime, 'h:mm:ss a')}</p><p class="status-date">{format(currentTime, 'EEEE, MMM dd')}</p></div>
                    <div class="status-icon status-icon-blue"><IconClock size={24} stroke={1.5} /></div>
                </div>
            </div>
            <div class="status-card status-card-streak">
                <div class="status-card-content">
                    <div class="status-info"><p class="status-label">Current Streak</p><p class="status-streak">{currentStreak} <span class="streak-unit">days</span></p><p class="status-hint">{currentStreak > 0 ? 'Keep it going!' : 'Start your streak!'}</p></div>
                    <div class="status-icon status-icon-orange"><IconFlame size={24} stroke={1.5} /></div>
                </div>
            </div>
            <div class="status-card status-card-{getStatusColor(status)}">
                <div class="status-card-content">
                    <div class="status-info"><p class="status-label">Current Status</p><p class="status-value">{getStatusText(status)}</p>{#if checkInTime}<p class="status-hint">Checked in at {format(checkInTime, 'h:mm a')}</p>{/if}</div>
                    <div class="status-icon status-icon-{getStatusColor(status)}"><IconActivity size={24} stroke={1.5} /></div>
                </div>
            </div>
            <div class="status-card">
                <div class="status-card-content">
                    <div class="status-info"><p class="status-label">Time on Shift</p><p class="status-timer">{formatDuration(timeOnShift)}</p><p class="status-hint">Hours worked today</p></div>
                    <div class="status-icon status-icon-purple"><IconClockPin size={24} stroke={1.5} /></div>
                </div>
            </div>
        </div>

        <div class="action-card">
            <div class="action-grid">
                <div class="image-section">
                    <div class="image-header"><IconCamera size={18} stroke={1.5} /><span>{status === 'none' ? 'Ready for Check-in' : 'Last Captured'}</span></div>
                    <div class="image-preview">
                        {#if capturedImage}<img src={capturedImage} alt="Captured" class="captured-image" />
                        {:else}<div class="image-placeholder"><IconCamera size={32} stroke={1.5} /><p>Click "Check In" to capture</p></div>{/if}
                    </div>
                </div>
                <div class="buttons-section">
                    <h3 class="buttons-title">Actions</h3>
                    <div class="buttons-grid">
                        <button class="action-btn action-btn-checkin" class:action-btn-disabled={isProcessing || status !== 'none'} on:click={handleCheckIn} disabled={isProcessing || status !== 'none'}><IconClockPin size={24} stroke={1.5} /><span class="btn-label">{isProcessing ? 'Processing...' : 'Check In'}</span></button>
                        <button class="action-btn action-btn-break" class:action-btn-disabled={isProcessing || status !== 'checkedIn'} on:click={handleBreakIn} disabled={isProcessing || status !== 'checkedIn'}><IconClockPause size={24} stroke={1.5} /><span class="btn-label">Start Break</span></button>
                        <button class="action-btn action-btn-resume" class:action-btn-disabled={isProcessing || status !== 'onBreak'} on:click={handleBreakOut} disabled={isProcessing || status !== 'onBreak'}><IconClockPlay size={24} stroke={1.5} /><span class="btn-label">End Break</span></button>
                        <button class="action-btn action-btn-checkout" class:action-btn-disabled={isProcessing || (status !== 'checkedIn' && status !== 'onBreak')} on:click={handleCheckOut} disabled={isProcessing || (status !== 'checkedIn' && status !== 'onBreak')}><IconClockStop size={24} stroke={1.5} /><span class="btn-label">Check Out</span></button>
                    </div>
                </div>
            </div>
        </div>
        
        <div class="trust-card">
            <div class="trust-header"><IconShield size={20} stroke={1.5} /><span>Trust Score</span></div>
            <div class="trust-content">
                <div class="trust-score" class:high={$behaviorStatus.trustScore >= 80} class:medium={$behaviorStatus.trustScore >= 50 && $behaviorStatus.trustScore < 80} class:low={$behaviorStatus.trustScore < 50}>{$behaviorStatus.trustScore}</div>
                <div class="trust-details"><p class="trust-level">Risk Level: <span class="risk-{$behaviorStatus.riskLevel}">{$behaviorStatus.riskLevel}</span></p><p class="trust-hint">Based on your attendance patterns</p></div>
            </div>
        </div>
    </div>
</div>


<style>
    .attendance-page { min-height: 100%; padding: clamp(16px, 4vw, 40px); background: var(--apple-light-bg); }
    .attendance-content { max-width: 1200px; margin: 0 auto; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: clamp(20px, 4vw, 32px); flex-wrap: wrap; gap: 16px; }
    .header-main { flex: 1; }
    .page-title { font-size: clamp(28px, 5vw, 36px); font-weight: 700; color: var(--apple-black); letter-spacing: -0.5px; margin-bottom: 6px; }
    .page-subtitle { font-size: clamp(14px, 2vw, 16px); color: var(--apple-gray-1); }
    .header-actions { display: flex; gap: 8px; }
    .security-toggle { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--apple-white); border: 1px solid var(--apple-gray-4); border-radius: var(--apple-radius-md); font-size: 13px; font-weight: 500; color: var(--apple-gray-1); cursor: pointer; transition: var(--apple-transition); position: relative; }
    .security-toggle:hover, .security-toggle.active { background: var(--apple-accent); color: white; border-color: var(--apple-accent); }
    .warning-badge { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; background: var(--apple-red); color: white; border-radius: 50%; font-size: 11px; font-weight: 600; display: flex; align-items: center; justify-content: center; }
    .security-panel { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: 20px; margin-bottom: 20px; box-shadow: var(--apple-shadow-sm); }
    .security-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .security-header h3 { font-size: 16px; font-weight: 600; color: var(--apple-black); }
    .live-indicator { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; padding: 4px 10px; border-radius: 12px; background: var(--apple-gray-6); color: var(--apple-gray-1); }
    .live-indicator.online { background: rgba(52, 199, 89, 0.15); color: var(--apple-green); }
    .security-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px; }
    .security-item { display: flex; align-items: center; gap: 8px; padding: 12px; background: var(--apple-gray-6); border-radius: var(--apple-radius-md); font-size: 13px; color: var(--apple-gray-1); }
    .security-item.valid { background: rgba(52, 199, 89, 0.1); color: var(--apple-green); }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--apple-red); margin-left: auto; }
    .security-item.valid .status-dot { background: var(--apple-green); }
    .zone-info { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--apple-gray-2); padding: 8px 12px; background: var(--apple-gray-6); border-radius: var(--apple-radius-sm); margin-bottom: 12px; }
    .warnings-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; }
    .warning-item { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: var(--apple-radius-md); font-size: 13px; }
    .warning-item.warning { background: rgba(255, 204, 0, 0.15); color: #B38F00; }
    .warning-item.error { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .sync-status { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(0, 122, 255, 0.08); border-radius: var(--apple-radius-md); font-size: 13px; color: var(--apple-accent); }
    .sync-btn { display: flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--apple-accent); color: white; border: none; border-radius: var(--apple-radius-sm); font-size: 12px; font-weight: 500; cursor: pointer; }
    .sync-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .offline-banner { display: flex; align-items: center; gap: 10px; padding: 12px 16px; background: rgba(255, 149, 0, 0.15); border-radius: var(--apple-radius-lg); margin-bottom: 20px; font-size: 13px; color: var(--apple-orange); }
    .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: clamp(12px, 2vw, 20px); margin-bottom: clamp(16px, 3vw, 24px); }
    .status-card { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: clamp(18px, 3vw, 24px); box-shadow: var(--apple-shadow-sm); transition: var(--apple-transition); }
    .status-card:hover { box-shadow: var(--apple-shadow-md); }
    .status-card-green { background: linear-gradient(135deg, rgba(52, 199, 89, 0.08), rgba(52, 199, 89, 0.02)); border: 1px solid rgba(52, 199, 89, 0.2); }
    .status-card-yellow { background: linear-gradient(135deg, rgba(255, 204, 0, 0.08), rgba(255, 204, 0, 0.02)); border: 1px solid rgba(255, 204, 0, 0.2); }
    .status-card-content { display: flex; justify-content: space-between; align-items: flex-start; }
    .status-label { font-size: 13px; font-weight: 500; color: var(--apple-gray-1); margin-bottom: 6px; }
    .status-time { font-size: clamp(24px, 4vw, 32px); font-weight: 700; color: var(--apple-black); letter-spacing: -0.5px; }
    .status-date { font-size: 13px; color: var(--apple-gray-2); margin-top: 4px; }
    .status-value { font-size: clamp(20px, 3vw, 26px); font-weight: 700; color: var(--apple-black); }
    .status-timer { font-size: clamp(26px, 4vw, 34px); font-weight: 700; color: var(--apple-accent); font-variant-numeric: tabular-nums; letter-spacing: -0.5px; }
    .status-hint { font-size: 12px; color: var(--apple-gray-2); margin-top: 4px; }
    .status-icon { width: 48px; height: 48px; border-radius: 14px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .status-icon-blue { background: rgba(0, 122, 255, 0.1); color: var(--apple-accent); }
    .status-icon-green { background: rgba(52, 199, 89, 0.15); color: var(--apple-green); }
    .status-icon-yellow { background: rgba(255, 204, 0, 0.15); color: #B38F00; }
    .status-icon-gray { background: var(--apple-gray-6); color: var(--apple-gray-1); }
    .status-icon-purple { background: rgba(175, 82, 222, 0.1); color: var(--apple-purple); }
    .status-icon-orange { background: rgba(255, 149, 0, 0.15); color: var(--apple-orange); }
    .status-card-streak { background: linear-gradient(135deg, rgba(255, 149, 0, 0.08), rgba(255, 59, 48, 0.02)); border: 1px solid rgba(255, 149, 0, 0.2); }
    .status-streak { font-size: clamp(26px, 4vw, 34px); font-weight: 700; color: var(--apple-orange); }
    .streak-unit { font-size: 14px; font-weight: 500; color: var(--apple-gray-1); }
    .action-card { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: clamp(20px, 4vw, 28px); box-shadow: var(--apple-shadow-sm); margin-bottom: 20px; }
    .action-grid { display: grid; grid-template-columns: 1fr; gap: clamp(20px, 4vw, 32px); }
    .image-section { order: 2; }
    .image-header { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--apple-gray-1); margin-bottom: 12px; }
    .image-preview { border-radius: var(--apple-radius-lg); overflow: hidden; background: var(--apple-gray-6); aspect-ratio: 4/3; max-height: 280px; }
    .captured-image { width: 100%; height: 100%; object-fit: cover; }
    .image-placeholder { width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; color: var(--apple-gray-2); }
    .image-placeholder p { font-size: 14px; }
    .buttons-section { order: 1; }
    .buttons-title { font-size: 17px; font-weight: 600; color: var(--apple-black); margin-bottom: 16px; }
    .buttons-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .action-btn { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; padding: clamp(16px, 3vw, 24px); border-radius: var(--apple-radius-lg); border: none; font-weight: 600; cursor: pointer; transition: var(--apple-transition); min-height: 100px; }
    .btn-label { font-size: 13px; }
    .action-btn-checkin { background: var(--apple-accent); color: white; }
    .action-btn-checkin:hover:not(:disabled) { background: var(--apple-accent-hover); transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0, 122, 255, 0.3); }
    .action-btn-break { background: var(--apple-yellow); color: #1C1C1E; }
    .action-btn-break:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-2px); }
    .action-btn-resume { background: var(--apple-green); color: white; }
    .action-btn-resume:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-2px); }
    .action-btn-checkout { background: var(--apple-red); color: white; }
    .action-btn-checkout:hover:not(:disabled) { filter: brightness(1.05); transform: translateY(-2px); }
    .action-btn-disabled { background: var(--apple-gray-4) !important; color: var(--apple-gray-2) !important; cursor: not-allowed; transform: none !important; box-shadow: none !important; }
    .trust-card { background: var(--apple-white); border-radius: var(--apple-radius-xl); padding: 20px; box-shadow: var(--apple-shadow-sm); }
    .trust-header { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 600; color: var(--apple-black); margin-bottom: 16px; }
    .trust-content { display: flex; align-items: center; gap: 20px; }
    .trust-score { width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; }
    .trust-score.high { background: rgba(52, 199, 89, 0.15); color: var(--apple-green); }
    .trust-score.medium { background: rgba(255, 204, 0, 0.15); color: #B38F00; }
    .trust-score.low { background: rgba(255, 59, 48, 0.1); color: var(--apple-red); }
    .trust-level { font-size: 14px; font-weight: 500; color: var(--apple-black); margin-bottom: 4px; }
    .trust-hint { font-size: 12px; color: var(--apple-gray-2); }
    .risk-low { color: var(--apple-green); }
    .risk-medium { color: #B38F00; }
    .risk-high { color: var(--apple-orange); }
    .risk-critical { color: var(--apple-red); }
    @media (min-width: 768px) { .action-grid { grid-template-columns: 1fr 1fr; } .image-section { order: 1; } .buttons-section { order: 2; } }
    @media (max-width: 768px) { .security-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 480px) { .status-grid { grid-template-columns: 1fr; } .action-btn { min-height: 80px; padding: 14px; } .security-grid { grid-template-columns: 1fr 1fr; } }
</style>
