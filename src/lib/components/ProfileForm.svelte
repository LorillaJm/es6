<script>
    import { db, USER_PROFILE_PATH } from "$lib/firebase";
    import { ref, set } from 'firebase/database';
    import { IconUserPlus, IconCheck } from "@tabler/icons-svelte";

    export let user;
    export let onProfileComplete;

    let formData = {
        name: user.displayName || '',
        email: user.email || '',
        year: '',
        departmentOrCourse: '',
        section: ''
    };
    let isSaving = false;
    let saveError = '';
    let profileSaved = false;

    async function saveProfile() {
        if (isSaving) return;
        isSaving = true;
        saveError = '';

        try {
            if (!formData.name || !formData.year || !formData.departmentOrCourse || !formData.section) {
                throw new Error("Please fill in all required fields.");
            }

            const uid = user.uid;
            const userProfileRef = ref(db, `${USER_PROFILE_PATH}/${uid}`);
            const profileData = {
                name: formData.name,
                year: formData.year,
                departmentOrCourse: formData.departmentOrCourse,
                section: formData.section,
                email: user.email,
                googleName: user.displayName,
                googleId: uid,
                picture: user.photoURL,
                createdAt: new Date().toISOString()
            };

            await set(userProfileRef, profileData);
            profileSaved = true;
            onProfileComplete(profileData);

        } catch (error) {
            console.error("Failed to save profile:", error);
            saveError = error.message;
        } finally {
            isSaving = false;
        }
    }
</script>

<div class="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl border border-indigo-200">
    {#if profileSaved}
        <div class="text-center">
            <IconCheck class="w-16 h-16 mx-auto text-green-600 mb-4" />
            <h2 class="text-2xl font-bold text-gray-800 mb-2">Profile Complete!</h2>
            <p class="text-gray-600 mb-6">Your profile has been saved successfully.</p>
            <a 
                href="/app/dashboard"
                class="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
            >
                Go to Dashboard →
            </a>
        </div>
    {:else}
        <div class="text-center mb-6">
            <IconUserPlus class="w-10 h-10 mx-auto text-indigo-600 mb-2" />
            <h2 class="text-2xl font-bold text-gray-800">Complete Your Profile</h2>
            <p class="text-sm text-gray-500">
                This one-time setup is required to access the system.
            </p>
        </div>

        {#if saveError}
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                <p class="text-sm font-medium">{saveError}</p>
            </div>
        {/if}

        <form on:submit|preventDefault={saveProfile} class="space-y-4">
            <div>
                <label for="name" class="block text-sm font-medium text-gray-700">Full Name</label>
                <input id="name" type="text" bind:value={formData.name} required
                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border" />
            </div>

            <div>
                <label for="year" class="block text-sm font-medium text-gray-700">Year / Level</label>
                <input id="year" type="text" bind:value={formData.year} required
                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border" />
            </div>

            <div>
                <label for="course" class="block text-sm font-medium text-gray-700">Department or Course</label>
                <input id="course" type="text" bind:value={formData.departmentOrCourse} required
                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border" />
            </div>

            <div>
                <label for="section" class="block text-sm font-medium text-gray-700">Section</label>
                <input id="section" type="text" bind:value={formData.section} required
                       class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border" />
            </div>

            <button type="submit" disabled={isSaving}
                    class="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-all duration-200">
                {#if isSaving}
                    Saving Profile...
                {:else}
                    <IconCheck class="w-5 h-5 mr-2" />
                    Save and Continue
                {/if}
            </button>
        </form>
    {/if}
</div>