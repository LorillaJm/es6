---
name: "sveltekit-best-practices"
displayName: "SvelteKit Best Practices"
description: "Best practices and patterns for building SvelteKit applications with proper routing, data loading, and component organization."
keywords: ["sveltekit", "svelte", "routing", "components", "ssr"]
author: "Your Name"
---

# SvelteKit Best Practices

## Overview

This power provides guidance on building well-structured SvelteKit applications. It covers routing patterns, data loading strategies, component organization, and common pitfalls to avoid.

## Onboarding

### Prerequisites
- Node.js 18+
- Basic knowledge of Svelte
- Familiarity with file-based routing

### Quick Start
```bash
npm create svelte@latest my-app
cd my-app
npm install
npm run dev
```

## Common Patterns

### Data Loading with +page.server.js

Always load data on the server when possible:

```javascript
// src/routes/users/+page.server.js
export async function load({ fetch }) {
  const response = await fetch('/api/users');
  return { users: await response.json() };
}
```

### Form Actions

Use form actions for mutations:

```javascript
// src/routes/login/+page.server.js
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    // Handle login
  }
};
```

### Layout Data Sharing

Share data across routes using layouts:

```javascript
// src/routes/+layout.server.js
export async function load({ locals }) {
  return { user: locals.user };
}
```

## Best Practices

- Use `+page.server.js` for sensitive data loading
- Prefer form actions over API endpoints for mutations
- Keep components small and focused
- Use `$lib` alias for shared code
- Implement proper error boundaries with `+error.svelte`

## Troubleshooting

### Error: "500 - Internal Error"
**Cause:** Unhandled exception in load function
**Solution:** Wrap load functions in try/catch and return proper error responses

### Error: "Data not available"
**Cause:** Accessing data before it's loaded
**Solution:** Use `{#await}` blocks or ensure data is loaded in parent layout
