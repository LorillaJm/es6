---
name: "smart-debugging-guide"
displayName: "Smart Debugging Guide"
description: "Bug detection patterns and fixes for SvelteKit + Firebase + TailwindCSS projects. Covers runtime errors, async issues, state bugs, and Firebase-specific problems."
keywords: ["debug", "sveltekit", "firebase", "error", "bug", "fix"]
author: "Personal"
---

# Smart Debugging Guide

## Overview

This guide helps you find and fix bugs in SvelteKit + Firebase applications. It covers common error patterns, debugging workflows, and proven fixes specific to your tech stack.

## Available Steering Files

- **svelte-bugs** - Svelte 5 reactivity, component lifecycle, and rendering issues
- **firebase-bugs** - Firebase Auth, Realtime Database, and Admin SDK errors
- **async-bugs** - Promise handling, race conditions, and data loading issues

## Quick Diagnosis Workflow

When you encounter a bug, follow this order:

1. **Check the console** - Browser DevTools → Console tab
2. **Check terminal** - Server-side errors appear here
3. **Use getDiagnostics** - Ask Kiro to check the file for type/lint errors
4. **Identify the category** - Use sections below to find the fix

---

## Category 1: Svelte 5 Reactivity Bugs

### Bug: State not updating in UI

**Symptoms:**
- Variable changes but UI doesn't reflect it
- Console shows correct value but component shows old value

**Common Causes & Fixes:**

```javascript
// ❌ WRONG - Direct mutation doesn't trigger reactivity
let items = $state([]);
items.push(newItem); // Won't update UI!

// ✅ CORRECT - Reassign to trigger reactivity
items = [...items, newItem];
```

```javascript
// ❌ WRONG - Mutating object property
let user = $state({ name: 'John' });
user.name = 'Jane'; // May not trigger in some cases

// ✅ CORRECT - Spread to new object
user = { ...user, name: 'Jane' };
```

### Bug: Derived state not recalculating

**Symptoms:**
- `$derived` value is stale
- Computed value doesn't update when dependencies change

**Fix:**
```javascript
// ❌ WRONG - Function call without tracking
let filtered = $derived(getFiltered()); // Won't track!

// ✅ CORRECT - Access reactive values directly
let filtered = $derived(items.filter(i => i.active));
```

### Bug: Effect running too many times

**Symptoms:**
- `$effect` triggers infinite loop
- Performance issues from repeated effect execution

**Fix:**
```javascript
// ❌ WRONG - Effect modifies its own dependency
$effect(() => {
    count = count + 1; // Infinite loop!
});

// ✅ CORRECT - Use untrack for writes
import { untrack } from 'svelte';
$effect(() => {
    const current = count;
    untrack(() => {
        // Safe to modify here
    });
});
```

---

## Category 2: Firebase Errors

### Error: "Firebase: No Firebase App '[DEFAULT]' has been created"

**Cause:** Firebase not initialized before use

**Fix in `$lib/firebase.js`:**
```javascript
import { initializeApp, getApps } from 'firebase/app';

// Check if already initialized
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
```

### Error: "Permission denied" from Realtime Database

**Causes:**
1. User not authenticated
2. Database rules blocking access
3. Wrong path

**Debug Steps:**
```javascript
// 1. Check auth state
import { auth } from '$lib/firebase';
console.log('Current user:', auth.currentUser);

// 2. Check the exact path you're accessing
console.log('Accessing path:', `/users/${uid}/profile`);

// 3. Verify rules in database.rules.json match your path
```

### Error: "auth/invalid-session-cookie" (Admin SDK)

**Cause:** Session cookie expired or invalid

**Fix in hooks.server.js:**
```javascript
try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    userId = decodedClaims.uid;
} catch (error) {
    // Clear invalid cookie
    event.cookies.delete('__session', { path: '/' });
    // Don't throw - let request continue without auth
}
```

### Error: "FIREBASE_SERVICE_ACCOUNT not set"

**Cause:** Environment variable missing

**Fix:**
1. Check `.env` file has `FIREBASE_SERVICE_ACCOUNT`
2. For Vercel: Add to Environment Variables in dashboard
3. Ensure JSON is properly escaped (no line breaks)

---

## Category 3: Async & Data Loading Bugs

### Bug: "Cannot read property of undefined"

**Cause:** Accessing data before it loads

**Fix with optional chaining:**
```javascript
// ❌ WRONG
{user.profile.name}

// ✅ CORRECT
{user?.profile?.name ?? 'Loading...'}
```

**Fix with loading state:**
```svelte
{#if loading}
    <p>Loading...</p>
{:else if error}
    <p>Error: {error.message}</p>
{:else if data}
    <p>{data.name}</p>
{/if}
```

### Bug: Race condition in data fetching

**Symptoms:**
- Old data appears after new data
- UI flickers between states

**Fix with abort controller:**
```javascript
let controller;

async function fetchData(id) {
    // Cancel previous request
    controller?.abort();
    controller = new AbortController();
    
    try {
        const res = await fetch(`/api/data/${id}`, {
            signal: controller.signal
        });
        return await res.json();
    } catch (e) {
        if (e.name !== 'AbortError') throw e;
    }
}
```

### Bug: Promise not awaited

**Symptoms:**
- Function returns `[object Promise]`
- Data is undefined when it should exist

**Fix:**
```javascript
// ❌ WRONG - Missing await
export function load({ fetch }) {
    const data = fetch('/api/data'); // Returns Promise!
    return { data };
}

// ✅ CORRECT
export async function load({ fetch }) {
    const res = await fetch('/api/data');
    const data = await res.json();
    return { data };
}
```

---

## Category 4: SvelteKit Routing Bugs

### Error: 404 on valid route

**Causes:**
1. Missing `+page.svelte` file
2. File in wrong directory
3. Dynamic param mismatch

**Debug:**
```bash
# Check file exists
ls src/routes/your/path/+page.svelte

# For dynamic routes, check param name matches
# [id] in folder name must match $page.params.id
```

### Error: "Data not available" in +page.svelte

**Cause:** Data loaded in wrong file

**Fix:**
```javascript
// Load data in +page.server.js (server-side)
// or +page.js (universal)
// NOT in +page.svelte

// +page.server.js
export async function load({ params }) {
    return { item: await getItem(params.id) };
}

// +page.svelte
<script>
    let { data } = $props(); // Access via data prop
</script>
{data.item.name}
```

### Error: Form action not working

**Symptoms:**
- Form submits but nothing happens
- Page refreshes without action running

**Fix:**
```svelte
<!-- ❌ WRONG - Missing method or action -->
<form>
    <button>Submit</button>
</form>

<!-- ✅ CORRECT -->
<form method="POST" action="?/create">
    <button type="submit">Submit</button>
</form>
```

---

## Category 5: TailwindCSS Issues

### Bug: Styles not applying

**Causes:**
1. Class not in safelist
2. Dynamic class not detected
3. CSS not imported

**Fix for dynamic classes:**
```javascript
// ❌ WRONG - Tailwind can't detect dynamic classes
<div class="bg-{color}-500">

// ✅ CORRECT - Use complete class names
const colorClasses = {
    red: 'bg-red-500',
    blue: 'bg-blue-500'
};
<div class={colorClasses[color]}>
```

### Bug: Styles work in dev but not production

**Cause:** PurgeCSS removing unused classes

**Fix:** Add to safelist in tailwind config or use complete class names

---

## Category 6: Build & Deployment Errors

### Error: "500 Internal Server Error" on Vercel

**Debug Steps:**
1. Check Vercel Function Logs
2. Look for missing environment variables
3. Check for server-only code in client files

**Common Fix:**
```javascript
// Move server-only imports to +page.server.js
// NOT +page.js or +page.svelte

// ❌ WRONG in +page.js
import { adminDb } from '$lib/server/firebase-admin';

// ✅ CORRECT in +page.server.js
import { adminDb } from '$lib/server/firebase-admin';
```

### Error: "window is not defined"

**Cause:** Browser API used during SSR

**Fix:**
```javascript
import { browser } from '$app/environment';

if (browser) {
    // Safe to use window, document, localStorage
    localStorage.setItem('key', 'value');
}
```

---

## Debugging Commands

```bash
# Check for TypeScript/lint errors
npm run lint

# Run tests
npm run test

# Build locally to catch production errors
npm run build
npm run preview

# Check Svelte compiler output
npx svelte-check
```

## Quick Reference: Error → Fix

| Error Message | Likely Cause | Quick Fix |
|--------------|--------------|-----------|
| "Cannot read property of undefined" | Data not loaded | Add `?.` optional chaining |
| "Permission denied" | Firebase rules | Check auth state & rules |
| "window is not defined" | SSR issue | Wrap in `if (browser)` |
| "404 Not Found" | Wrong route path | Check file location |
| "Hydration mismatch" | Server/client differ | Ensure same render output |
| "Invalid session cookie" | Expired auth | Clear cookie, re-login |
