<script>
    import { auth, getUserProfile } from '$lib/firebase';
    import { onMount } from 'svelte';
    import { 
        IconClockHour4,
        IconCalendarStats,
        IconChartBar
    } from "@tabler/icons-svelte";

    let userProfile = null;

    onMount(async () => {
        const user = auth.currentUser;
        if (user) {
            userProfile = await getUserProfile(user.uid);
        }
    });
</script>

<div class="p-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

    {#if userProfile}
        <!-- Quick Stats -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition duration-200">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-600 mb-1">Current Status</p>
                        <p class="text-2xl font-bold text-gray-900">Ready to Clock In</p>
                    </div>
                    <IconClockHour4 class="w-12 h-12 text-indigo-500" />
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition duration-200">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-600 mb-1">This Week</p>
                        <p class="text-2xl font-bold text-gray-900">0 Hours</p>
                    </div>
                    <IconCalendarStats class="w-12 h-12 text-green-500" />
                </div>
            </div>

            <div class="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition duration-200">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm text-gray-600 mb-1">This Month</p>
                        <p class="text-2xl font-bold text-gray-900">0 Days</p>
                    </div>
                    <IconChartBar class="w-12 h-12 text-purple-500" />
                </div>
            </div>
        </div>

        <div class="bg-white rounded-xl shadow-md p-8">
            <h2 class="text-2xl font-bold text-gray-900 mb-4">Welcome, {userProfile.name}! 👋</h2>
            <p class="text-gray-600 mb-6">
                Ready to start your day? Click on "Attendance Check-in" in the sidebar to record your attendance.
            </p>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div class="p-4 bg-indigo-50 rounded-lg">
                    <p class="text-sm text-gray-600">Year Level</p>
                    <p class="text-lg font-semibold text-gray-900">{userProfile.year}</p>
                </div>
                <div class="p-4 bg-indigo-50 rounded-lg">
                    <p class="text-sm text-gray-600">Section</p>
                    <p class="text-lg font-semibold text-gray-900">{userProfile.section}</p>
                </div>
            </div>
        </div>
    {/if}
</div>