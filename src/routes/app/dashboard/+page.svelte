<script>
  import { ref, push, set, update, query, orderByChild, equalTo, get } from "$lib/firebase";
  import { db } from "$lib/firebase";
  import { onMount } from 'svelte';
  import { format } from 'date-fns';
  import {
    IconClockPin,
    IconClockPause,
    IconClockPlay,
    IconClockStop,
    IconAlertTriangle,
    IconActivity,
    IconClock
  } from "@tabler/icons-svelte";

  let isProcessing = false;
  let cameraStream = null;
  let capturedImage = null;
  let status = 'none'; // none, checkedIn, onBreak, checkedOut
  let currentShiftId = null;
  let checkInTime = null;
  let currentTime = new Date();
  let timerInterval;

  const USER_PATH = 'attendance/anonymous';

  onMount(() => {
    loadActiveShift();
    timerInterval = setInterval(() => currentTime = new Date(), 1000);
    return () => clearInterval(timerInterval);
  });

  async function getDeviceInfo() {
    const ua = navigator.userAgent;
    const platform = navigator.platform;
    let name = 'Unknown', version = 'Unknown';
    if (ua.includes('Chrome')) name = 'Chrome', version = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || 'Unknown';
    else if (ua.includes('Firefox')) name = 'Firefox', version = (ua.match(/Firefox\/([\d.]+)/) || [])[1] || 'Unknown';
    else if (ua.includes('Safari')) name = 'Safari', version = (ua.match(/Version\/([\d.]+)/) || [])[1] || 'Unknown';
    return { browser: `${name} ${version}`, device: platform, userAgent: ua, timestamp: new Date().toISOString() };
  }

  async function getLocation() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(pos => {
        resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy, timestamp: new Date(pos.timestamp).toISOString() });
      }, reject, { enableHighAccuracy: true, timeout: 10000 });
    });
  }

  async function captureImage() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      cameraStream = stream;
      const video = document.createElement('video');
      video.srcObject = stream;
      await new Promise(r => video.onloadedmetadata = () => { video.play(); r(); });
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = canvas.toDataURL('image/jpeg', 0.8);
      cameraStream.getTracks().forEach(t => t.stop());
      cameraStream = null;
      return image;
    } catch (err) { console.error(err); return null; }
  }

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
          if (shift.currentStatus !== 'checkedOut') lastShift = { key: childSnapshot.key, status: shift.currentStatus, checkIn: shift.checkIn };
        });

        if (lastShift) {
          currentShiftId = lastShift.key;
          status = lastShift.status;
          if (lastShift.checkIn && lastShift.checkIn.timestamp) checkInTime = new Date(lastShift.checkIn.timestamp);
          if (lastShift.checkIn && lastShift.checkIn.capturedImage) capturedImage = lastShift.checkIn.capturedImage;
        }
      }
    } catch (err) { console.error("Error loading active shift:", err); }
  }

  async function logAttendance(action) {
    if (isProcessing) return;
    isProcessing = true;

    try {
      const device = await getDeviceInfo();
      const location = await getLocation();
      let image = null;

      const newActionData = { timestamp: new Date().toISOString(), location, device };

      let entryRef;
      let shouldReload = false;

      if (action === 'checkIn') {
        if (status !== 'none') throw new Error("You are already checked in or on break.");
        image = await captureImage();
        capturedImage = image;
        status = 'checkedIn';
        checkInTime = new Date();
        newActionData.capturedImage = image;

        entryRef = push(ref(db, USER_PATH));
        currentShiftId = entryRef.key;

        await set(entryRef, { checkIn: newActionData, currentStatus: 'checkedIn', date: new Date().toDateString() });
      } else {
        if (!currentShiftId) throw new Error("Cannot perform action. Please Check In first.");
        entryRef = ref(db, `${USER_PATH}/${currentShiftId}`);
        let updateData = {};

        if (action === 'breakIn') {
          if (status !== 'checkedIn') throw new Error("Must be checked in to start break.");
          status = 'onBreak'; updateData = { currentStatus: 'onBreak', breakIn: newActionData };
        } else if (action === 'breakOut') {
          if (status !== 'onBreak') throw new Error("Must be on break to end break.");
          status = 'checkedIn'; updateData = { currentStatus: 'checkedIn', breakOut: newActionData };
        } else if (action === 'checkOut') {
          if (status !== 'checkedIn') {
            if (status === 'onBreak') {
              await update(entryRef, { currentStatus: 'checkedIn', breakOut: newActionData });
              alert("Note: Ending break automatically before checking out.");
            } else throw new Error("Must be checked in to check out.");
          }
          status = 'checkedOut'; updateData = { currentStatus: 'checkedOut', checkOut: newActionData }; shouldReload = true;
        }

        await update(entryRef, updateData);
      }

      alert(`${action} successful!`);
      if (shouldReload) window.location.reload();
    } catch (err) { console.error(err); alert(`Error: ${err.message}`); }
    finally { isProcessing = false; }
  }

  const handleCheckIn = () => logAttendance("checkIn");
  const handleBreakIn = () => logAttendance("breakIn");
  const handleBreakOut = () => logAttendance("breakOut");
  const handleCheckOut = () => logAttendance("checkOut");

  $: timeOnShift = checkInTime ? currentTime.getTime() - checkInTime.getTime() : 0;

  function formatDuration(ms) {
    if (!ms || ms < 0) return '00:00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const pad = num => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
</script>

<div class="p-8">
  <h1 class="text-3xl font-extrabold text-gray-800 mb-6">Attendance Overview</h1>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

    <!-- Current Time Card -->
    <div class="bg-white p-6 rounded-xl shadow-lg flex flex-col justify-between">
      <div class="flex items-center mb-2">
        <IconClock class="w-8 h-8 text-indigo-500 mr-4" />
        <div>
          <p class="text-sm font-medium text-gray-500">Current Time</p>
          <p class="text-2xl font-bold text-gray-900">{format(currentTime, 'h:mm:ss a')}</p>
        </div>
      </div>
      <p class="text-xs text-gray-400">{format(currentTime, 'EEEE, MMM dd')}</p>
    </div>

    <!-- Status Card -->
    <div class="p-6 rounded-xl shadow-lg"
         class:bg-green-50={status === 'checkedIn'}
         class:bg-yellow-50={status === 'onBreak'}
         class:bg-gray-100={status === 'none' || status === 'checkedOut'}>
      <div class="flex items-center mb-2">
        <svelte:component 
          this={status === 'checkedIn' ? IconActivity : status === 'onBreak' ? IconAlertTriangle : IconClockStop} 
          class={`w-6 h-6 mr-3 ${status === 'checkedIn' ? 'text-green-600' : status === 'onBreak' ? 'text-yellow-600' : 'text-gray-500'}`} />
        <p class="text-sm font-medium"
           class:text-green-700={status === 'checkedIn'}
           class:text-yellow-700={status === 'onBreak'}
           class:text-gray-600={status === 'none' || status === 'checkedOut'}>
          Current Status
        </p>
      </div>
      <p class="text-3xl font-extrabold capitalize"
         class:text-green-800={status === 'checkedIn'}
         class:text-yellow-800={status === 'onBreak'}
         class:text-gray-800={status === 'none' || status === 'checkedOut'}>
        {status === 'none' ? 'Ready to Clock In' : status}
      </p>
      {#if checkInTime}
        <p class="text-sm text-gray-500 mt-1">Check In: {format(checkInTime, 'h:mm a')}</p>
      {/if}
    </div>

    <!-- Time on Shift Card -->
    <div class="bg-white p-6 rounded-xl shadow-lg flex flex-col justify-center items-start">
      <p class="text-sm font-medium text-gray-500 mb-2">Time on Shift</p>
      <p class="text-3xl font-extrabold text-indigo-700">{formatDuration(timeOnShift)}</p>
    </div>
  </div>
</div>
