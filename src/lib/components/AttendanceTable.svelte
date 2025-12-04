<script>
    export let data; // { records }
    import { createEventDispatcher } from 'svelte';
    import { IconMapPin, IconDeviceMobile, IconBrowser, IconClock, IconPhoto } from "@tabler/icons-svelte";

    const dispatch = createEventDispatcher();

    let searchQuery = '';
    let startDate = '';
    let endDate = '';

    function handleImageClick(url) {
        dispatch('openImageModal', url);
    }

    function getDeviceIcon(deviceType) {
        if (deviceType?.toLowerCase().includes('mobile')) return IconDeviceMobile;
        return IconBrowser;
    }

    function formatTime(timestamp) {
        if (!timestamp) return 'N/A';
        try {
            const date = new Date(timestamp);
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        } catch (e) {
            return 'Invalid Time';
        }
    }

    function ImageTimeBlock({ statusData }) {
        const time = statusData?.timestamp ? formatTime(statusData.timestamp) : 'N/A';
        const imageUrl = statusData?.capturedImage;
        return { time, imageUrl };
    }

    // Filtered and searched records
    $: filteredRecords = data.records.filter(record => {

        const query = searchQuery.toLowerCase();

        const matchesSearch =
          record.date.toLowerCase().includes(query) ||
          (record.checkIn?.device?.browser?.toLowerCase())

        // Filter by date range
        const recordDate = new Date(record.date);
        const isAfterStart = startDate ? recordDate >= new Date(startDate) : true;
        const isBeforeEnd = endDate ? recordDate <= new Date(endDate) : true;

        return matchesSearch && isAfterStart && isBeforeEnd;
    });
</script>

<!-- Search and Filter with Labels -->
<div class="flex flex-col md:flex-row gap-4 p-4 bg-gray-50 rounded-lg mb-4">
    <div class="flex flex-col w-full md:w-1/6">
        <label for="startDate" class="text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input
            id="startDate"
            type="date"
            bind:value={startDate}
            class="border px-3 py-2 rounded-md w-full"
        />
    </div>

    <div class="flex flex-col w-full md:w-1/6">
        <label for="endDate" class="text-sm font-medium text-gray-700 mb-1">End Date</label>
        <input
            id="endDate"
            type="date"
            bind:value={endDate}
            class="border px-3 py-2 rounded-md w-full"
        />
    </div>
</div>



{#snippet TimeImageDisplay({ statusData })}
    {@const { time, imageUrl } = ImageTimeBlock({ statusData })}

    <div class="flex flex-col items-center">
        <span class="text-xs font-semibold text-gray-700 mb-1">{time}</span>
        <div class="w-16 h-16 bg-gray-100 rounded flex items-center justify-center border border-gray-200 overflow-hidden">
            {#if imageUrl && imageUrl !== 'N/A'}
                <button 
                    type="button" 
                    class="p-0 border-0 bg-transparent cursor-pointer" 
                    on:click={() => handleImageClick(imageUrl)}
                >
                    <img src={imageUrl} alt="Snapshot" class="w-full h-full object-cover" />
                </button>
            {:else}
                <IconPhoto class="w-6 h-6 text-gray-400" />
            {/if}
        </div>
    </div>
{/snippet}


<div class="space-y-4 p-4 md:hidden">
        {#each filteredRecords as record}
        <div class="bg-white rounded-lg shadow-md p-4 border border-gray-200">
            
            <div class="flex justify-between items-start mb-3 border-b pb-2">
                <div class="font-bold text-indigo-700 text-base">
                    {record.date}
                </div>
                <div class="text-xs font-semibold px-3 py-1 rounded-full 
                    {record.currentStatus === 'checkedIn' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700'}">
                    {record.currentStatus === 'checkedIn' ? 'Checked In' : 'Checked Out'}
                </div>
            </div>

            <div class="space-y-4 pt-2">
                
                <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-700 w-1/3">Check In:</span>
                    {@render TimeImageDisplay({ statusData: record.checkIn })}
                </div>
                
                {#if record.breakStart}
                <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-700 w-1/3">Break Start:</span>
                    {@render TimeImageDisplay({ statusData: record.breakStart })}
                </div>
                {/if}

                {#if record.breakEnd}
                <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-700 w-1/3">Break End:</span>
                    {@render TimeImageDisplay({ statusData: record.breakEnd })}
                </div>
                {/if}

                {#if record.checkOut}
                <div class="flex items-center justify-between">
                    <span class="font-medium text-gray-700 w-1/3">Check Out:</span>
                    {@render TimeImageDisplay({ statusData: record.checkOut })}
                </div>
                {/if}
            </div>

            <div class="pt-3 mt-3 border-t border-gray-100 space-y-2 text-sm text-gray-700">
                <div class="flex items-center">
                    <IconMapPin class="w-4 h-4 mr-2 text-red-500 flex-shrink-0" />
                    <span class="font-medium">Location:</span> {record.checkIn?.location?.name || 'N/A'}
                </div>
                <div class="flex items-center">
                    <svelte:component this={getDeviceIcon(record.checkIn?.device?.deviceType)} class="w-4 h-4 mr-2 text-blue-500 flex-shrink-0" />
                    <span class="font-medium">Device:</span> {record.checkIn?.device?.browser || 'N/A'} ({record.checkIn?.device?.deviceType || 'N/A'})
                </div>
            </div>
        </div>
    {/each}
</div>

<div class="hidden md:block overflow-x-auto">
    <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
            <tr>
                <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
                <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Break Start</th>
                <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Break End</th>
                <th class="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                <th class="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
            </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
            {#each filteredRecords as record}
                <tr class="hover:bg-gray-50">
                    <td class="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{record.date}</td>
                    <td class="px-3 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                            {record.currentStatus === 'checkedIn' ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'}">
                            {record.currentStatus === 'checkedIn' ? 'Checked In' : 'Checked Out'}
                        </span>
                    </td>

                    <td class="px-3 py-4 text-center">
                        {@render TimeImageDisplay({ statusData: record.checkIn })}
                    </td>

                    <td class="px-3 py-4 text-center">
                        {#if record.breakStart}
                            {@render TimeImageDisplay({ statusData: record.breakStart })}
                        {:else}
                            <span class="text-gray-400 text-sm">N/A</span>
                        {/if}
                    </td>

                    <td class="px-3 py-4 text-center">
                        {#if record.breakEnd}
                            {@render TimeImageDisplay({ statusData: record.breakEnd })}
                        {:else}
                            <span class="text-gray-400 text-sm">N/A</span>
                        {/if}
                    </td>

                    <td class="px-3 py-4 text-center">
                        {#if record.checkOut}
                            {@render TimeImageDisplay({ statusData: record.checkOut })}
                        {:else}
                            <span class="text-gray-400 text-sm">N/A</span>
                        {/if}
                    </td>

                    <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.checkIn?.location?.name || 'N/A'}
                    </td>
                    <td class="px-3 py-4 whitespace-nowrap text-sm text-gray-500">
                        {record.checkIn?.device?.browser || 'N/A'} ({record.checkIn?.device?.deviceType || 'N/A'})
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
</div>