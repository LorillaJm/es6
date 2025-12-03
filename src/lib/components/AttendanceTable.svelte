<script>
  import { format } from 'date-fns';

  export let data;
  let selectedImage = null;

  function openImageModal(shift, actionKey) {
    if (shift[actionKey]?.capturedImage) {
      selectedImage = shift[actionKey].capturedImage;
    } else {
      selectedImage = null;
    }
  }

  function closeImageModal() {
    selectedImage = null;
  }

  function getTimestamp(shift, key) {
    return shift[key]?.timestamp
      ? format(new Date(shift[key].timestamp), 'HH:mm:ss')
      : '-';
  }

  function getStatusClass(status) {
    switch (status) {
      case 'checkedIn': return 'bg-green-100 text-green-800';
      case 'onBreak': return 'bg-yellow-100 text-yellow-800';
      case 'checkedOut': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }
</script>

<div class="overflow-x-auto">
  <table class="min-w-full divide-y divide-gray-200">
    <thead class="bg-gray-50">
      <tr>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check In</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break Start</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Break End</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Check Out</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
        <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Device</th>
      </tr>
    </thead>
    <tbody class="bg-white divide-y divide-gray-200">
      {#each data.records as shift (shift.shiftId)}
        <tr class="hover:bg-gray-50 transition duration-150">
          <td class="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
            {shift.date ? format(new Date(shift.date), 'MMM dd, yyyy') : '-'}
          </td>
          <td class="px-4 py-4 whitespace-nowrap">
            <span class="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full {getStatusClass(shift.currentStatus)}">
              {shift.currentStatus}
            </span>
          </td>

          {#each ['checkIn','breakIn','breakOut','checkOut'] as key}
            <td class="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
              <div class="flex flex-col">
                <span>{getTimestamp(shift, key)}</span>
                {#if shift[key]?.capturedImage}
                  <button
                    class="text-indigo-600 hover:text-indigo-800 text-xs mt-1 text-left"
                    on:click={() => openImageModal(shift, key)}
                  >
                    View Image →
                  </button>
                {/if}
              </div>
            </td>
          {/each}

          <td class="px-4 py-4 text-sm text-gray-500 max-w-xs truncate">
            {shift.checkIn?.location?.name || '-'}
          </td>
          <td class="px-4 py-4 text-sm text-gray-500 max-w-xs">
            {#if shift.checkIn?.device}
              <div class="truncate">{shift.checkIn.device.browser}</div>
              <div class="text-xs text-gray-400 truncate">{shift.checkIn.device.deviceType}</div>
            {:else}
              -
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<!-- Modal -->
{#if selectedImage}
  <div
    role="dialog"
    aria-modal="true"
    tabindex="0"
    class="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
    on:click={closeImageModal}
    on:keydown={(e) => e.key === 'Escape' && closeImageModal()}
  >
    <div
      class="bg-white p-6 rounded-lg shadow-2xl max-w-2xl max-h-full overflow-y-auto"
      on:click|stopPropagation
    >
      <h3 class="text-lg font-bold mb-4">Captured Image</h3>
      <img src={selectedImage} alt="Attendance Snapshot" class="w-full h-auto rounded-md" />
      <button
        class="mt-4 w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700 transition duration-200"
        on:click={closeImageModal}
      >
        Close
      </button>
    </div>
  </div>
{/if}
