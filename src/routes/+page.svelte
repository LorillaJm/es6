<script>
import { ref, push, set, update, query, orderByChild, equalTo, get } from "$lib/firebase";
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

const USER_PATH = 'attendance/anonymous';

// Update time every second
onMount(() => {
    loadActiveShift();
    timerInterval = setInterval(() => currentTime = new Date(), 1000);
    return () => clearInterval(timerInterval);
});

// Device info
async function getDeviceInfo() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    let name = 'Unknown', version = 'Unknown';
    if (ua.includes('Chrome')) name='Chrome', version=(ua.match(/Chrome\/([\d.]+)/)||[])[1]||'Unknown';
    else if (ua.includes('Firefox')) name='Firefox', version=(ua.match(/Firefox\/([\d.]+)/)||[])[1]||'Unknown';
    else if (ua.includes('Safari')) name='Safari', version=(ua.match(/Version\/([\d.]+)/)||[])[1]||'Unknown';
    return { browser:`${name} ${version}`, device: platform, userAgent: ua, timestamp:new Date().toISOString() };
}

// Get coordinates
async function getLocation() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(pos => {
            resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: new Date(pos.timestamp).toISOString() });
        }, reject, { enableHighAccuracy: true, timeout: 10000 });
    });
}

// Reverse geocode to name
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

// Capture camera image
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

// Load active shift
async function loadActiveShift() {
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

// Log attendance
async function logAttendance(action) {
    if (isProcessing) return;
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

// Handlers
const handleCheckIn = () => logAttendance("checkIn");
const handleBreakIn = () => logAttendance("breakIn");
const handleBreakOut = () => logAttendance("breakOut");
const handleCheckOut = () => logAttendance("checkOut");

// Shift duration
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

<div class="p-8 bg-gray-50 min-h-screen">
    <h1 class="text-3xl font-extrabold text-gray-800 mb-6">Attendance Overview</h1>
    <a href="app/dashboard" class="text-indigo-600 hover:underline mb-4 inline-block">← Back to Dashboard</a>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <!-- Current Time -->
        <div class="bg-white p-6 rounded-xl shadow hover:shadow-lg transition duration-200 flex flex-col justify-between">
            <div class="flex items-center mb-4">
                <IconClock class="w-8 h-8 text-indigo-500 mr-3"/>
                <div>
                    <p class="text-sm text-gray-500">Current Time</p>
                    <p class="text-2xl font-bold text-gray-900">{format(currentTime,'h:mm:ss a')}</p>
                </div>
            </div>
            <p class="text-xs text-gray-400">{format(currentTime,'EEEE, MMM dd')}</p>
        </div>

        <!-- Status Card -->
        <div class="p-6 rounded-xl shadow hover:shadow-lg transition duration-200"
             class:bg-green-50={status==='checkedIn'}
             class:bg-yellow-50={status==='onBreak'}
             class:bg-gray-100={status==='none'||status==='checkedOut'}>
            <div class="flex items-center mb-2">
                <svelte:component
                    this={status==='checkedIn'?IconActivity:(status==='onBreak'?IconAlertTriangle:IconClockStop)}
                    class={`w-6 h-6 mr-2
                        ${status==='checkedIn'?'text-green-600':''}
                        ${status==='onBreak'?'text-yellow-600':''}
                        ${status==='none'||status==='checkedOut'?'text-gray-500':''}`}
                />
                <p class="text-sm font-medium
                    {status==='checkedIn'?'text-green-700':''}
                    {status==='onBreak'?'text-yellow-700':''}
                    {status==='none'||status==='checkedOut'?'text-gray-600':''}">Current Status</p>
            </div>
            <p class="text-3xl font-extrabold capitalize
                {status==='checkedIn'?'text-green-800':''}
                {status==='onBreak'?'text-yellow-800':''}
                {status==='none'||status==='checkedOut'?'text-gray-800':''}">
                {status==='none'?'Ready to Clock In':status}
            </p>
            {#if checkInTime}
                <p class="text-sm text-gray-500 mt-1">Check In: {format(checkInTime,'h:mm a')}</p>
            {/if}
        </div>

        <!-- Time on Shift -->
        <div class="bg-white p-6 rounded-xl shadow hover:shadow-lg transition duration-200">
            <p class="text-sm text-gray-500 mb-2">Time on Shift</p>
            <p class="text-3xl font-extrabold text-indigo-700">{formatDuration(timeOnShift)}</p>
        </div>
    </div>

    <!-- Action Center -->
    <div class="bg-white p-6 rounded-xl shadow hover:shadow-lg transition duration-200">
        <h2 class="text-xl font-bold mb-6 border-b pb-3 flex items-center gap-2">Action Center</h2>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Image Display -->
            <div>
                <p class="font-semibold text-gray-700 mb-3">
                    {status==='none'?'Ready for Check-in Image':'Last Recorded Image'}
                </p>
                {#if capturedImage}
                    <div class="p-4 border rounded-lg bg-green-50 border-green-300">
                        <img src={capturedImage} alt="Captured Attendance" class="w-full h-auto rounded-md"/>
                    </div>
                {:else}
                    <div class="p-8 border rounded-lg text-center text-gray-500 bg-gray-50 h-64 flex items-center justify-center">
                        <p>{status==='none'?'Click "Check In" to capture image.':'Image loaded from active shift.'}</p>
                    </div>
                {/if}
            </div>

            <!-- Buttons -->
            <div class="flex flex-col justify-center">
                <div class="grid grid-cols-2 gap-4">
                    <!-- Check In -->
                    <button class="flex flex-col items-center justify-center rounded p-4 text-white font-semibold shadow-md transition-all duration-200 h-24"
                        class:bg-indigo-600={status==='none'}
                        class:hover:bg-indigo-700={status==='none'}
                        class:bg-gray-400={isProcessing || status!=='none'}
                        on:click={handleCheckIn}
                        disabled={isProcessing || status!=='none'}>
                        <IconClockPin class="w-6 h-6 mb-1"/>
                        <span class="text-sm">{isProcessing?'Processing...':'Check In'}</span>
                    </button>

                    <!-- Start Break -->
                    <button class="flex flex-col items-center justify-center rounded p-4 text-white font-semibold shadow-md transition-all duration-200 h-24"
                        class:bg-yellow-500={status==='checkedIn'}
                        class:hover:bg-yellow-600={status==='checkedIn'}
                        class:bg-gray-400={isProcessing || status!=='checkedIn'}
                        on:click={handleBreakIn}
                        disabled={isProcessing || status!=='checkedIn'}>
                        <IconClockPause class="w-6 h-6 mb-1"/>
                        <span class="text-sm">Start Break</span>
                    </button>

                    <!-- End Break -->
                    <button class="flex flex-col items-center justify-center rounded p-4 text-white font-semibold shadow-md transition-all duration-200 h-24"
                        class:bg-green-600={status==='onBreak'}
                        class:hover:bg-green-700={status==='onBreak'}
                        class:bg-gray-400={isProcessing || status!=='onBreak'}
                        on:click={handleBreakOut}
                        disabled={isProcessing || status!=='onBreak'}>
                        <IconClockPlay class="w-6 h-6 mb-1"/>
                        <span class="text-sm">End Break</span>
                    </button>

                    <!-- Check Out -->
                    <button class="flex flex-col items-center justify-center rounded p-4 text-white font-semibold shadow-md transition-all duration-200 h-24"
                        class:bg-red-600={status==='checkedIn' || status==='onBreak'} 
                        class:hover:bg-red-700={status==='checkedIn' || status==='onBreak'}
                        class:bg-gray-400={isProcessing || (status!=='checkedIn' && status!=='onBreak')}
                        on:click={handleCheckOut}
                        disabled={isProcessing || (status!=='checkedIn' && status!=='onBreak')}>
                        <IconClockStop class="w-6 h-6 mb-1"/>
                        <span class="text-sm">Check Out</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</div>
