<script>
    import { db, USER_PROFILE_PATH } from "$lib/firebase";
    import { ref, get, update } from "firebase/database";
    import { IconUser, IconCheck, IconAlertTriangle } from "@tabler/icons-svelte";
    import { onDestroy } from "svelte";

    export let user;

    let loading = false;
    let saving = false;
    let saveSuccess = false;
    let saveError = "";
    let formData = {
        name: "",
        year: "",
        departmentOrCourse: "",
        section: ""
    };

    $: if (user) {
        console.log("User received. Attempting to load profile for UID:", user.uid);
        loadProfile();
    } else {
        console.log("User is null/undefined. Profile load skipped.");
        formData = { name: "", year: "", departmentOrCourse: "", section: "" };
    }

    async function loadProfile() {
        loading = true;
        saveError = "";
        saveSuccess = false;

        try {
            const path = `${USER_PROFILE_PATH}/${user.uid}`;
            const userRef = ref(db, path);
            console.log("Attempting to read profile from path:", path);

            const snapshot = await get(userRef);

            if (snapshot.exists()) {
                const data = snapshot.val();
                console.log("Profile data successfully retrieved:", data); // Log the retrieved data
                formData = {
                    name: data.name || user.displayName || "",
                    year: data.year || "",
                    departmentOrCourse: data.departmentOrCourse || "",
                    section: data.section || ""
                };
            } else {
                console.log(" No profile data exists at path:", path);

                formData = {
                    name: user.displayName || "",
                    year: "",
                    departmentOrCourse: "",
                    section: ""
                };
            }
        } catch (e) {
            console.error(" Error loading profile (Check Firebase connection/rules):", e);
            saveError = "Failed to load profile.";
        }

        loading = false;
    }

    async function updateProfile() {
        if (!user || saving) return;

        saveError = "";
        saveSuccess = false;
        saving = true;

        try {
            if (!formData.name || !formData.year || !formData.departmentOrCourse || !formData.section) {
                throw new Error("All fields are required.");
            }

            const userRef = ref(db, `${USER_PROFILE_PATH}/${user.uid}`);
            await update(userRef, formData);

            saveSuccess = true;
            setTimeout(() => saveSuccess = false, 3000);
        } catch (e) {
            console.error(e);
            saveError = e.message;
        }

        saving = false;
    }
</script>

<div class="w-full max-w-xl mx-auto bg-white p-8 rounded-xl shadow-xl border border-indigo-200">
    <div class="flex items-center gap-3 mb-6">
        <IconUser class="w-10 h-10 text-indigo-600" />
        <h1 class="text-3xl font-bold">Edit Profile</h1>
    </div>

    {#if loading}
        <p class="text-center text-gray-600">Loading user details...</p>
    {:else}
        {#if saveSuccess}
            <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                Profile updated successfully!
            </div>
        {/if}

        {#if saveError}
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 flex items-center gap-2">
                <IconAlertTriangle class="w-5 h-5" /> {saveError}
            </div>
        {/if}

        <form on:submit|preventDefault={updateProfile} class="space-y-4">
            <div>
                <label for="name" class="font-medium text-gray-700">Full Name</label>
                <input id="name" class="w-full mt-1 p-2 border rounded"
                    type="text"
                    bind:value={formData.name}
                    required />
            </div>

            <div>
                <label for="year" class="font-medium text-gray-700">Year / Level</label>
                <input id="year" class="w-full mt-1 p-2 border rounded"
                    type="text"
                    bind:value={formData.year}
                    required />
            </div>

            <div>
                <label for="course" class="font-medium text-gray-700">Department or Course</label>
                <input id="course" class="w-full mt-1 p-2 border rounded"
                    type="text"
                    bind:value={formData.departmentOrCourse}
                    required />
            </div>

            <div>
                <label for="section" class="font-medium text-gray-700">Section</label>
                <input id="section" class="w-full mt-1 p-2 border rounded"
                    type="text"
                    bind:value={formData.section}
                    required />
            </div>

            <button type="submit" disabled={saving}
                    class="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-lg font-medium transition disabled:opacity-50 flex items-center justify-center gap-2">
                {#if saving}
                    Saving...
                {:else}
                    <IconCheck class="w-5 h-5" /> Update Profile
                {/if}
            </button>
        </form>

    {/if}
</div>