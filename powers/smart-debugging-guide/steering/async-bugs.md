# Async & Data Loading Bug Patterns

## Promise Handling Errors

### Bug: Unhandled Promise Rejection

```javascript
// ❌ WRONG - No error handling
async function loadData() {
    const res = await fetch('/api/data');
    return res.json();
}

// ✅ CORRECT - Proper error handling
async function loadData() {
    try {
        const res = await fetch('/api/data');
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return await res.json();
    } catch (error) {
        console.error('Failed to load data:', error);
        throw error; // Re-throw for caller to handle
    }
}
```

### Bug: Missing await

```javascript
// ❌ WRONG - Forgot await
async function saveAndLoad() {
    saveData(data); // Returns Promise, not awaited!
    const newData = loadData(); // Also not awaited!
    return newData; // Returns Promise, not data
}

// ✅ CORRECT
async function saveAndLoad() {
    await saveData(data);
    const newData = await loadData();
    return newData;
}
```

### Bug: await in forEach (doesn't work!)

```javascript
// ❌ WRONG - forEach doesn't wait for async
items.forEach(async (item) => {
    await processItem(item); // These run in parallel, not sequence!
});
console.log('Done'); // Runs before items are processed!

// ✅ CORRECT - Use for...of for sequential
for (const item of items) {
    await processItem(item);
}
console.log('Done'); // Runs after all items processed

// ✅ CORRECT - Use Promise.all for parallel
await Promise.all(items.map(item => processItem(item)));
console.log('Done');
```

---

## SvelteKit Load Function Errors

### Bug: Load function not async

```javascript
// +page.server.js

// ❌ WRONG - Missing async
export function load({ params }) {
    const data = fetch(`/api/items/${params.id}`); // Returns Promise!
    return { data };
}

// ✅ CORRECT
export async function load({ params, fetch }) {
    const res = await fetch(`/api/items/${params.id}`);
    const data = await res.json();
    return { data };
}
```

### Bug: Using wrong fetch

```javascript
// ❌ WRONG - Using global fetch
export async function load() {
    const res = await fetch('/api/data'); // May fail in SSR!
    return { data: await res.json() };
}

// ✅ CORRECT - Use SvelteKit's fetch
export async function load({ fetch }) {
    const res = await fetch('/api/data'); // Works in SSR and client
    return { data: await res.json() };
}
```

### Bug: Accessing data before load completes

```svelte
<!-- +page.svelte -->
<script>
let { data } = $props();

// ❌ WRONG - data.items might be undefined initially
const firstItem = data.items[0];

// ✅ CORRECT - Safe access
const firstItem = data.items?.[0];
</script>

<!-- ❌ WRONG -->
<p>{data.user.name}</p>

<!-- ✅ CORRECT -->
{#if data.user}
    <p>{data.user.name}</p>
{:else}
    <p>Loading...</p>
{/if}
```

---

## Race Conditions

### Bug: Stale data from slow request

**Scenario:** User clicks fast, old request finishes after new one

```javascript
// ❌ WRONG - No cancellation
let data = $state(null);

async function loadItem(id) {
    const res = await fetch(`/api/items/${id}`);
    data = await res.json(); // Old request might overwrite new data!
}

// ✅ CORRECT - Track current request
let currentId = $state(null);

async function loadItem(id) {
    currentId = id;
    const res = await fetch(`/api/items/${id}`);
    const result = await res.json();
    
    // Only update if this is still the current request
    if (currentId === id) {
        data = result;
    }
}
```

### Bug: AbortController pattern

```javascript
let controller = null;

async function search(query) {
    // Cancel previous request
    controller?.abort();
    controller = new AbortController();
    
    try {
        const res = await fetch(`/api/search?q=${query}`, {
            signal: controller.signal
        });
        return await res.json();
    } catch (error) {
        if (error.name === 'AbortError') {
            // Request was cancelled - this is expected
            return null;
        }
        throw error;
    }
}
```

### Bug: Multiple simultaneous submissions

```javascript
// ❌ WRONG - User can double-submit
let submitting = $state(false);

async function handleSubmit() {
    const res = await fetch('/api/submit', { method: 'POST' });
    // User clicked twice = two submissions!
}

// ✅ CORRECT - Prevent double submission
async function handleSubmit() {
    if (submitting) return;
    submitting = true;
    
    try {
        const res = await fetch('/api/submit', { method: 'POST' });
        // Handle success
    } finally {
        submitting = false;
    }
}
```

```svelte
<button onclick={handleSubmit} disabled={submitting}>
    {submitting ? 'Submitting...' : 'Submit'}
</button>
```

---

## Error Boundaries & Recovery

### Pattern: Graceful error handling in load

```javascript
// +page.server.js
export async function load({ fetch, params }) {
    try {
        const res = await fetch(`/api/items/${params.id}`);
        
        if (res.status === 404) {
            return { item: null, error: 'Item not found' };
        }
        
        if (!res.ok) {
            return { item: null, error: 'Failed to load item' };
        }
        
        return { item: await res.json(), error: null };
    } catch (error) {
        console.error('Load error:', error);
        return { item: null, error: 'Network error' };
    }
}
```

```svelte
<!-- +page.svelte -->
<script>
let { data } = $props();
</script>

{#if data.error}
    <div class="error">
        <p>{data.error}</p>
        <button onclick={() => location.reload()}>Retry</button>
    </div>
{:else if data.item}
    <ItemDisplay item={data.item} />
{:else}
    <p>Loading...</p>
{/if}
```

### Pattern: Retry with backoff

```javascript
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            const res = await fetch(url, options);
            if (res.ok) return res;
            
            // Don't retry client errors (4xx)
            if (res.status >= 400 && res.status < 500) {
                throw new Error(`Client error: ${res.status}`);
            }
            
            lastError = new Error(`Server error: ${res.status}`);
        } catch (error) {
            lastError = error;
        }
        
        // Wait before retry (exponential backoff)
        if (i < maxRetries - 1) {
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
    
    throw lastError;
}
```

---

## Timeout Handling

### Bug: Request hangs forever

```javascript
// ❌ WRONG - No timeout
const res = await fetch('/api/slow-endpoint');

// ✅ CORRECT - Add timeout
async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
        const res = await fetch(url, { signal: controller.signal });
        return res;
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Request timed out');
        }
        throw error;
    } finally {
        clearTimeout(timeoutId);
    }
}
```

---

## Debugging Async Issues

### Console logging pattern

```javascript
async function debugAsync(label, promise) {
    console.log(`[${label}] Starting...`);
    const start = performance.now();
    
    try {
        const result = await promise;
        console.log(`[${label}] Completed in ${performance.now() - start}ms`, result);
        return result;
    } catch (error) {
        console.error(`[${label}] Failed in ${performance.now() - start}ms`, error);
        throw error;
    }
}

// Usage
const data = await debugAsync('loadUser', fetch('/api/user').then(r => r.json()));
```

### Tracking pending requests

```javascript
let pendingRequests = $state(new Set());

async function trackedFetch(url, options) {
    pendingRequests.add(url);
    
    try {
        return await fetch(url, options);
    } finally {
        pendingRequests.delete(url);
    }
}

// Show loading indicator when any request is pending
$: isLoading = pendingRequests.size > 0;
```
