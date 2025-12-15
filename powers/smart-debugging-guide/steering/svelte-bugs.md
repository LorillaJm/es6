# Svelte 5 Bug Patterns & Fixes

## Reactivity System Deep Dive

### Understanding $state

```javascript
// $state creates reactive state
let count = $state(0);

// Arrays and objects need reassignment for reactivity
let items = $state([]);

// ❌ These won't trigger updates
items.push(item);
items[0] = newItem;
items.length = 0;

// ✅ These will trigger updates
items = [...items, item];
items = items.map((i, idx) => idx === 0 ? newItem : i);
items = [];
```

### Understanding $derived

```javascript
// $derived auto-tracks dependencies
let doubled = $derived(count * 2);

// For complex logic, use $derived.by
let filtered = $derived.by(() => {
    return items.filter(item => {
        return item.active && item.category === selectedCategory;
    });
});
```

### Understanding $effect

```javascript
// Runs after DOM updates
$effect(() => {
    console.log('Count changed:', count);
    // Cleanup function (optional)
    return () => {
        console.log('Cleaning up');
    };
});

// Pre-effect (runs before DOM updates)
$effect.pre(() => {
    // Useful for scroll position preservation
});
```

---

## Component Lifecycle Bugs

### Bug: Code runs on server when it shouldn't

```svelte
<script>
import { browser } from '$app/environment';
import { onMount } from 'svelte';

// ❌ WRONG - Runs on server too
document.title = 'My Page';

// ✅ CORRECT - Only runs in browser
onMount(() => {
    document.title = 'My Page';
});

// ✅ ALSO CORRECT
if (browser) {
    document.title = 'My Page';
}
</script>
```

### Bug: onMount cleanup not working

```svelte
<script>
import { onMount } from 'svelte';

onMount(() => {
    const interval = setInterval(() => {
        console.log('tick');
    }, 1000);
    
    // ❌ WRONG - Forgot to return cleanup
    // Interval keeps running after component unmounts!
    
    // ✅ CORRECT - Return cleanup function
    return () => clearInterval(interval);
});
</script>
```

### Bug: Event listener memory leak

```svelte
<script>
import { onMount } from 'svelte';

onMount(() => {
    const handler = (e) => console.log(e);
    window.addEventListener('resize', handler);
    
    // ✅ Always remove listeners
    return () => window.removeEventListener('resize', handler);
});
</script>
```

---

## Props & Bindings Bugs

### Bug: Props not updating child component

```svelte
<!-- Parent.svelte -->
<script>
let user = $state({ name: 'John' });
</script>
<Child {user} />

<!-- Child.svelte -->
<script>
// ❌ WRONG - Destructuring breaks reactivity
let { user } = $props();
let { name } = user; // name won't update!

// ✅ CORRECT - Keep reference intact
let { user } = $props();
// Use user.name directly in template
</script>
{user.name}
```

### Bug: Two-way binding not working

```svelte
<!-- ❌ WRONG - bind: on non-bindable prop -->
<CustomInput bind:value={text} />

<!-- CustomInput.svelte needs $bindable -->
<script>
let { value = $bindable() } = $props();
</script>
<input bind:value />
```

---

## Snippet & Render Bugs

### Bug: Snippet not rendering

```svelte
<!-- ❌ WRONG - Using snippet like component -->
{#snippet mySnippet()}
    <p>Content</p>
{/snippet}
{mySnippet} <!-- Won't work! -->

<!-- ✅ CORRECT - Use @render -->
{@render mySnippet()}
```

### Bug: Passing snippets to components

```svelte
<!-- Parent.svelte -->
{#snippet header()}
    <h1>Title</h1>
{/snippet}
<Card {header} />

<!-- Card.svelte -->
<script>
let { header } = $props();
</script>
<div class="card">
    {#if header}
        {@render header()}
    {/if}
</div>
```

---

## Store Migration (Svelte 4 → 5)

### Old store pattern → New runes

```javascript
// ❌ OLD (Svelte 4)
import { writable } from 'svelte/store';
export const count = writable(0);

// In component
import { count } from './stores';
$count // Auto-subscribed

// ✅ NEW (Svelte 5) - Option 1: Keep stores
// Stores still work! Just use .subscribe or $

// ✅ NEW (Svelte 5) - Option 2: Use $state in .svelte.js
// stores.svelte.js
export const appState = $state({
    count: 0,
    user: null
});
```

---

## Common Template Errors

### Error: "each block key must be unique"

```svelte
<!-- ❌ WRONG - Using index as key -->
{#each items as item, i (i)}
    <Item {item} />
{/each}

<!-- ✅ CORRECT - Use unique identifier -->
{#each items as item (item.id)}
    <Item {item} />
{/each}
```

### Error: "Cannot use {#await} with non-Promise"

```svelte
<script>
// ❌ WRONG - Not a promise
let data = fetchData(); // Missing await, returns Promise

// ✅ CORRECT - Keep as promise for #await
let dataPromise = fetchData();
</script>

{#await dataPromise}
    <p>Loading...</p>
{:then data}
    <p>{data.name}</p>
{:catch error}
    <p>Error: {error.message}</p>
{/await}
```

### Error: Hydration mismatch

```svelte
<!-- ❌ WRONG - Different output server vs client -->
<script>
import { browser } from '$app/environment';
</script>
{#if browser}
    <ClientOnlyComponent />
{/if}
<!-- Server renders nothing, client renders component = mismatch -->

<!-- ✅ CORRECT - Use onMount or consistent rendering -->
<script>
let mounted = $state(false);
import { onMount } from 'svelte';
onMount(() => mounted = true);
</script>
{#if mounted}
    <ClientOnlyComponent />
{/if}
```
