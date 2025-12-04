<script>
    import { auth, subscribeToAuth, ref, push, set, update, query, orderByChild, equalTo, get } from "$lib/firebase";
    import { db } from "$lib/firebase";
    import { onMount } from 'svelte';
    import { format } from 'date-fns';
    import {
        IconClockPin, IconClockPause, IconClockPlay, IconClockStop,
        IconAlertTriangle, IconActivity, IconClock
    } from "@tabler/icons-svelte";

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

    onMount(async () => {
        // Start the clock timer
        timerInterval = setInterval(() => currentTime = new Date(), 1000);
        
        const unsubscribe = subscribeToAuth((user) => {
            if (user) {
                userId = user.uid;
                USER_PATH = `attendance/${userId}`;
                console.log(`Using attendance path: ${USER_PATH}`);

                loadActiveShift();
            } else {
                console.error("User not authenticated. Cannot load attendance.");
            }
        });

        return () => {
            clearInterval(timerInterval);
            unsubscribe(); 
        };
    });

    async function getDeviceInfo() {
        const ua = navigator.userAgent;
        const platform = navigator.platform;
        const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|Mobile/i.test(ua);
        const deviceType = isMobile ? "Mobile" : "Desktop";
        let name = 'Unknown', version = 'Unknown';
        if (ua.includes('Chrome')) name='Chrome', version=(ua.match(/Chrome\/([\d.]+)/)||[])[1]||'Unknown';
        else if (ua.includes('Firefox')) name='Firefox', version=(ua.match(/Firefox\/([\d.]+)/)||[])[1]||'Unknown';
        else if (ua.includes('Safari')) name='Safari', version=(ua.match(/Version\/([\d.]+)/)||[])[1]||'Unknown';
        return { browser:`${name} ${version}`, device: platform,deviceType: deviceType, userAgent: ua, timestamp:new Date().toISOString() };
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
            if (!res.ok) throw new Error('Failed to fetch location');
            const data = await res.json();
            const city = data.address.city || data.address.town || data.address.village || data.display_name;
            const brgy = data.address.suburb || data.address.neighbourhood || data.address.quarter || '';
            return brgy ? `${city}, ${brgy}` : city;
        } catch {
            return 'Unknown Location';
        }
    }

    async function captureImage() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' } });
            cameraStream = stream;
            const video = document.createElement('video');
            video.srcObject = stream;
            await new Promise(r=>video.onloadedmetadata=()=>{video.play(); r();});
            const canvas=document.createElement('canvas');
            canvas.width=video.videoWidth; canvas.height=video.videoHeight;
            canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
            const image=canvas.toDataURL('image/jpeg',0.8);
            cameraStream.getTracks().forEach(t=>t.stop());
            cameraStream=null;
            return image;
        } catch(err){ console.error(err); return null; }
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
                    if (shift.currentStatus !== 'checkedOut') {
                        lastShift = { key: childSnapshot.key, status: shift.currentStatus, checkIn: shift.checkIn };
                    }
                });
                if (lastShift) {
                    currentShiftId = lastShift.key;
                    status = lastShift.status;
                    if (lastShift.checkIn?.timestamp) checkInTime = new Date(lastShift.checkIn.timestamp);
                    if (lastShift.checkIn?.capturedImage) capturedImage = lastShift.checkIn.capturedImage;
                }
            }
        } catch(err) { console.error("Error loading active shift:", err); }
    }

    async function logAttendance(action) {
        if (isProcessing || !USER_PATH) {
            if (!USER_PATH) alert("Error: User authentication failed. Please log in.");
            return;
        }
        
        isProcessing = true;
        try {
            const device = await getDeviceInfo();
            const coords = await getLocation();
            const locationName = await getLocationName(coords.latitude, coords.longitude);
            const image = await captureImage();
            if (!image) throw new Error("Could not capture image");

            const newActionData = {
                timestamp: new Date().toISOString(),
                location: { ...coords, name: locationName },
                device,
                capturedImage: image
            };
            capturedImage = image;

            let entryRef, shouldReload = false;

            if(action === 'checkIn') {
                if (status !== 'none') throw new Error("Already checked in or on break.");
                status = 'checkedIn';
                
                entryRef = push(ref(db, USER_PATH));
                
                currentShiftId = entryRef.key;
                checkInTime = new Date();
                await set(entryRef, { checkIn: newActionData, currentStatus: 'checkedIn', date: new Date().toDateString() });
            } else {
                if (!currentShiftId) throw new Error("Cannot perform action. Please Check In first.");
                entryRef = ref(db, `${USER_PATH}/${currentShiftId}`);
                
                let updateData = {};
                if(action==='breakIn') { if (status!=='checkedIn') throw new Error("Must be checked in to start break."); status='onBreak'; updateData={ currentStatus:'onBreak', breakIn:newActionData }; }
                else if(action==='breakOut') { if (status!=='onBreak') throw new Error("Must be on break to end break."); status='checkedIn'; updateData={ currentStatus:'checkedIn', breakOut:newActionData }; }
                else if(action==='checkOut') { status='checkedOut'; updateData={ currentStatus:'checkedOut', checkOut:newActionData }; shouldReload=true; }
                await update(entryRef, updateData);
            }

            alert(`${action} successful!`);
            if (shouldReload) window.location.reload();
        } catch(err){ console.error(err); alert(`Error: ${err.message}`); }
        finally{ isProcessing = false; }
    }

    const handleCheckIn = () => logAttendance("checkIn");
    const handleBreakIn = () => logAttendance("breakIn");
    const handleBreakOut = () => logAttendance("breakOut");
    const handleCheckOut = () => logAttendance("checkOut");

    $: timeOnShift = checkInTime ? currentTime.getTime() - checkInTime.getTime() : 0;
    function formatDuration(ms) {
        if (!ms || ms<0) return '00:00:00';
        const totalSeconds = Math.floor(ms/1000);
        const hours=Math.floor(totalSeconds/3600);
        const minutes=Math.floor((totalSeconds%3600)/60);
        const seconds=totalSeconds%60;
        const pad = n=>n.toString().padStart(2,'0');
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
    }
</script>

<div class="p-4 sm:p-6 bg-gray-50 min-h-screen">

    <h1 class="text-2xl font-extrabold text-gray-800 mb-4 sm:mb-6">
        Attendance Overview
    </h1>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mb-6">

        <div class="bg-white p-4 sm:p-6 rounded-xl shadow-md flex justify-between items-center">
            <div>
                <p class="text-xs text-gray-500">Current Time</p>
                <p class="text-xl sm:text-2xl font-bold text-gray-900">
                    {format(currentTime, 'h:mm:ss a')}
                </p>
                <p class="text-xs text-gray-400">
                    {format(currentTime, 'EEEE, MMM dd')}
                </p>
            </div>
            <IconClock class="w-7 h-7 text-indigo-500"/>
        </div>

        <div 
            class="p-4 sm:p-6 rounded-xl shadow-md"
            class:bg-green-50={status==='checkedIn'}
            class:bg-yellow-50={status==='onBreak'}
            class:bg-gray-100={status==='none'||status==='checkedOut'}
        >
            <div class="flex items-center gap-2 mb-2">
                <svelte:component
                    this={status==='checkedIn'?IconActivity:(status==='onBreak'?IconAlertTriangle:IconClockStop)}
                    class={`w-6 h-6
                        ${status==='checkedIn'?'text-green-600':''}
                        ${status==='onBreak'?'text-yellow-600':''}
                        ${status==='none'||status==='checkedOut'?'text-gray-500':''}`}
                />
                <p class="text-sm font-medium text-gray-700">Current Status</p>
            </div>

            <p class="text-2xl font-extrabold capitalize mb-1
                {status==='checkedIn'?'text-green-800':''}
                {status==='onBreak'?'text-yellow-800':''}
                {status==='none'||status==='checkedOut'?'text-gray-800':''}"
            >
                {status==='none' ? 'Ready to Clock In' : status}
            </p>

            {#if checkInTime}
                <p class="text-xs text-gray-500">Checked in at {format(checkInTime, 'h:mm a')}</p>
            {/if}
        </div>

        <div class="bg-white p-4 sm:p-6 rounded-xl shadow-md">
            <p class="text-xs text-gray-500 mb-1">Time on Shift</p>
            <p class="text-2xl sm:text-3xl font-extrabold text-indigo-700">
                {formatDuration(timeOnShift)}
            </p>
        </div>
    </div>

    <div class="bg-white p-4 sm:p-6 rounded-xl shadow-md">

        <h2 class="text-lg font-bold mb-4 border-b pb-2 flex items-center gap-2">
            Action Center
        </h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

            <div>
                <p class="font-semibold text-gray-700 mb-2">
                    {status==='none' ? 'Ready for Check-in Image' : 'Last Recorded Image'}
                </p>

                {#if capturedImage}
                    <div class="p-3 border rounded-lg bg-green-50 border-green-300 shadow-sm">
                        <img src={capturedImage} alt="Captured" class="w-full h-auto rounded-md"/>
                    </div>
                {:else}
                    <div class="p-6 border rounded-lg text-center text-gray-500 bg-gray-50 h-48 flex items-center justify-center shadow-sm">
                        <p>{status==='none' ? 'Click "Check In" to capture image.' : 'Image loaded.'}</p>
                    </div>
                {/if}
            </div>

            <div class="flex flex-col justify-center">
                <div class="grid grid-cols-2 gap-4">

                    <button
                        class="flex flex-col items-center justify-center rounded-lg p-4 text-white font-semibold shadow-md h-24 transition-all"
                        class:bg-indigo-600={status==='none'}
                        class:hover:bg-indigo-700={status==='none'}
                        class:bg-gray-400={isProcessing || status!=='none'}
                        on:click={handleCheckIn}
                        disabled={isProcessing || status!=='none'}
                    >
                        <IconClockPin class="w-6 h-6 mb-1"/>
                        <span class="text-xs sm:text-sm">
                            {isProcessing ? 'Processing...' : 'Check In'}
                        </span>
                    </button>

                    <button
                        class="flex flex-col items-center justify-center rounded-lg p-4 text-white font-semibold shadow-md h-24 transition-all"
                        class:bg-yellow-500={status==='checkedIn'}
                        class:hover:bg-yellow-600={status==='checkedIn'}
                        class:bg-gray-400={isProcessing || status!=='checkedIn'}
                        on:click={handleBreakIn}
                        disabled={isProcessing || status!=='checkedIn'}
                    >
                        <IconClockPause class="w-6 h-6 mb-1"/>
                        <span class="text-xs sm:text-sm">Start Break</span>
                    </button>

                    <button
                        class="flex flex-col items-center justify-center rounded-lg p-4 text-white font-semibold shadow-md h-24 transition-all"
                        class:bg-green-600={status==='onBreak'}
                        class:hover:bg-green-700={status==='onBreak'}
                        class:bg-gray-400={isProcessing || status!=='onBreak'}
                        on:click={handleBreakOut}
                        disabled={isProcessing || status!=='onBreak'}
                    >
                        <IconClockPlay class="w-6 h-6 mb-1"/>
                        <span class="text-xs sm:text-sm">End Break</span>
                    </button>

                    <button
                        class="flex flex-col items-center justify-center rounded-lg p-4 text-white font-semibold shadow-md h-24 transition-all"
                        class:bg-red-600={status==='checkedIn' || status==='onBreak'}
                        class:hover:bg-red-700={status==='checkedIn' || status==='onBreak'}
                        class:bg-gray-400={isProcessing || (status!=='checkedIn' && status!=='onBreak')}
                        on:click={handleCheckOut}
                        disabled={isProcessing || (status!=='checkedIn' && status!=='onBreak')}
                    >
                        <IconClockStop class="w-6 h-6 mb-1"/>
                        <span class="text-xs sm:text-sm">Check Out</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
