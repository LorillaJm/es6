<script>
    import { auth, loginWithGoogle, subscribeToAuth, getUserProfile } from "$lib/firebase";
    import { onMount } from 'svelte';
    import ProfileForm from '$lib/components/ProfileForm.svelte';
    
    import { IconLock, IconLogin, IconLogout, IconUserCircle } from "@tabler/icons-svelte";

    let user = null;
    let isLoading = true;
    let loginError = '';
    
    let userProfile = null;
    let isCheckingProfile = true;

    async function checkAuthAndProfile(u) {
      
        user = u;
        isCheckingProfile = true;
        userProfile = null;

        if (user) {
            
            try {
                await user.getIdToken();
                
                const profile = await getUserProfile(user.uid);
                
                userProfile = profile;
                
            } catch (error) {
                console.error(" Error checking profile:", error);
                loginError = `Error loading profile: ${error.message}`;
            }
        } else {
        }
        
        isCheckingProfile = false;
        isLoading = false;
    }

    onMount(() => {

        const unsubscribe = subscribeToAuth(checkAuthAndProfile);
        return unsubscribe;
    });

    async function handleGoogleLogin() {
        loginError = '';
        
        try {
            await loginWithGoogle();
        } catch (error) {
            console.error(" Login failed:", error);
            
            if (error.code === 'auth/popup-closed-by-user') {
                loginError = 'The sign-in window was closed.';
            } else if (error.code === 'auth/cancelled-popup-request') {
                loginError = 'Authentication request cancelled (please click once).';
            } else if (error.code === 'auth/configuration-not-found') {
                loginError = 'Configuration error: Google Sign-in provider is not enabled.';
            } else {
                loginError = `Login failed: ${error.message}`;
            }
        }
    }

    async function handleLogout() {
        try {
            await auth.signOut();
            user = null; 
            userProfile = null;
            loginError = '';
            console.log(" Logged out");
        } catch (error) {
            console.error("Logout error:", error);
        }
    }
    
    function handleProfileComplete(profileData) {
        userProfile = profileData;
    }
</script>

<div class="flex items-center justify-center min-h-screen bg-gray-100 p-4">
    {#if isLoading || isCheckingProfile}
        <div class="w-full max-w-md text-center p-8 bg-white rounded-xl shadow-2xl">
            <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p class="text-gray-600 mb-2">Loading authentication state...</p>
            <p class="text-xs text-gray-400">This should only take a moment</p>
        </div>
        
    {:else if user && !userProfile}
        <ProfileForm user={user} onProfileComplete={handleProfileComplete} />

    {:else}
        <div class="w-full max-w-md bg-white p-8 rounded-xl shadow-2xl">
            <div class="text-center mb-8">
                <IconLock class="w-12 h-12 mx-auto text-indigo-600 mb-3" />
                <h1 class="text-3xl font-extrabold text-gray-800">Welcome Back</h1>
                <p class="text-gray-500 mt-2">Sign in to access the Attendance Dashboard</p>
            </div>

            {#if user}
                <div class="text-center p-6 border border-indigo-200 bg-indigo-50 rounded-lg mb-6">
                    <IconUserCircle class="w-16 h-16 mx-auto text-indigo-600 mb-4" />
                    <p class="text-xl font-semibold text-gray-800">Logged in as {user.displayName}</p>
                    <p class="text-sm text-gray-600 mb-4">{user.email}</p>
                    
                    <a 
                        href="/app/dashboard" 
                        class="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
                    >
                        Go to Dashboard →
                    </a>
                </div>

                <button
                    class="w-full flex items-center justify-center bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200"
                    on:click={handleLogout}
                >
                    <IconLogout class="w-5 h-5 mr-2" />
                    Sign Out
                </button>
            {:else}
                {#if loginError}
                    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
                        <strong class="font-bold">Error:</strong>
                        <span class="block sm:inline ml-1">{loginError}</span>
                    </div>
                {/if}

                <button
                    class="w-full flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-md"
                    on:click={handleGoogleLogin}
                >
                    <IconLogin class="w-5 h-5 mr-3" />
                    Sign in with Google
                </button>
            {/if}
        </div>
    {/if}
</div>