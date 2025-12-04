<script>
    import { onMount } from 'svelte';
    import { auth, db } from '$lib/firebase';
    import { ref, get, query, orderByChild } from 'firebase/database';
    import AttendanceTable from '$lib/components/AttendanceTable.svelte';
    import { IconCalendarStats } from "@tabler/icons-svelte";
    
    let records = [];
    let isLoading = true;

    let selectedImage = null;
    let showImageModal = false;

    function openImageModal(imageUrl) {
        selectedImage = imageUrl;
        showImageModal = true;
    }

    function closeImageModal() {
        selectedImage = null;
        showImageModal = false;
    }

    function processAction(recordData, actionName) {
        if (!recordData || !recordData[actionName]) return null;
        
        const actionData = recordData[actionName];
        
        return {
            timestamp: actionData.timestamp,
            capturedImage: actionData.capturedImage || null, 
            ...(actionName === 'checkIn' ? { device: actionData.device, location: actionData.location } : {})
        };
    }

    onMount(async () => {
        const user = auth.currentUser;
        
        if (user) {
            try {
                const attendanceRef = ref(db, `attendance/${user.uid}`);
                const attendanceQuery = query(attendanceRef, orderByChild('date'));
                const snapshot = await get(attendanceQuery);
                
                if (snapshot.exists()) {
                    const data = [];
                    snapshot.forEach((childSnapshot) => {
                        const recordData = childSnapshot.val();
                        
                        data.push({
                            shiftId: childSnapshot.key,
                            date: recordData.date,
                            currentStatus: recordData.currentStatus,
                            checkIn: processAction(recordData, 'checkIn'),
                            breakStart: processAction(recordData, 'breakStart'),
                            breakEnd: processAction(recordData, 'breakEnd'),
                            checkOut: processAction(recordData, 'checkOut'),
                        });
                    });
                    
                    records = data.sort((a, b) => {
                        const dateA = new Date(a.date || a.checkIn?.timestamp || 0);
                        const dateB = new Date(b.date || b.checkIn?.timestamp || 0);
                        return dateB - dateA;
                    });
                }
            } catch (error) {
                console.error('Error loading attendance history:', error);
            }
        }

        isLoading = false;
    });
</script>

<div class="p-4 sm:p-6 lg:p-8">
    <div class="mb-6 lg:mb-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-2">
            <div>
                <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 mb-1">Attendance History</h1>
                <p class="text-gray-600 text-sm sm:text-base">View your complete attendance records</p>
            </div>
        </div>

        {#if !isLoading}
            <div class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-6">
                </div>
        {/if}
    </div>

    <div class="bg-white rounded-xl shadow-lg overflow-hidden">
    {#if isLoading}
        <div class="p-10 text-center">
            <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p class="text-gray-600">Loading attendance history...</p>
        </div>

    {:else if records.length > 0}
        <div class="px-4 sm:px-6 py-4 border-b border-gray-200">
            <h2 class="text-lg sm:text-xl font-semibold text-gray-900">All Records</h2>
        </div>
        
        <AttendanceTable 
            data={{ records }} 
            on:openImageModal={(e) => openImageModal(e.detail)}
        />

    {:else}
        <div class="p-10 text-center">
            <IconCalendarStats class="w-14 h-14 text-gray-400 mx-auto mb-4" />
            <h3 class="text-lg sm:text-xl font-semibold text-gray-900 mb-2">No Attendance Records Yet</h3>
            <p class="text-gray-600 mb-6">Start recording your attendance to see your history here.</p>
            <a href="/app/attendance"
                class="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-lg transition">
                Go to Attendance Check-in
            </a>
        </div>
    {/if}
    </div>
</div>

{#if showImageModal}
    <div aria-hidden="true" class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" on:click={closeImageModal}>
        <div aria-hidden="true" class="max-w-3xl max-h-full overflow-auto bg-white p-4 rounded-lg" on:click|stopPropagation>
            <img src={selectedImage} alt="Attendance Snapshot Full View" class="w-full h-auto" />
            <button class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded" on:click={closeImageModal}>
                Close
            </button>
        </div>
    </div>
{/if}