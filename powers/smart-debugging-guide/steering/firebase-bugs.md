# Firebase Bug Patterns & Fixes

## Authentication Errors

### Error: "auth/network-request-failed"

**Cause:** Network connectivity or CORS issue

**Fixes:**
```javascript
// 1. Check internet connection
if (!navigator.onLine) {
    showError('No internet connection');
    return;
}

// 2. Retry with exponential backoff
async function signInWithRetry(email, password, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            if (error.code === 'auth/network-request-failed' && i < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
                continue;
            }
            throw error;
        }
    }
}
```

### Error: "auth/user-not-found" or "auth/wrong-password"

**Security Note:** Don't reveal which one failed!

```javascript
try {
    await signInWithEmailAndPassword(auth, email, password);
} catch (error) {
    // ❌ WRONG - Reveals if email exists
    if (error.code === 'auth/user-not-found') {
        showError('Email not registered');
    }
    
    // ✅ CORRECT - Generic message
    if (error.code === 'auth/user-not-found' || 
        error.code === 'auth/wrong-password' ||
        error.code === 'auth/invalid-credential') {
        showError('Invalid email or password');
    }
}
```

### Error: "auth/popup-closed-by-user"

**Cause:** User closed OAuth popup

```javascript
try {
    await signInWithPopup(auth, provider);
} catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
        // Don't show error - user intentionally closed
        return;
    }
    if (error.code === 'auth/popup-blocked') {
        // Fallback to redirect
        await signInWithRedirect(auth, provider);
    }
}
```

### Error: "auth/requires-recent-login"

**Cause:** Sensitive operation needs fresh auth

```javascript
import { reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

async function deleteAccount(password) {
    const user = auth.currentUser;
    const credential = EmailAuthProvider.credential(user.email, password);
    
    try {
        // Re-authenticate first
        await reauthenticateWithCredential(user, credential);
        // Now safe to delete
        await user.delete();
    } catch (error) {
        if (error.code === 'auth/wrong-password') {
            showError('Incorrect password');
        }
    }
}
```

---

## Realtime Database Errors

### Error: "PERMISSION_DENIED"

**Debug Checklist:**
1. Is user authenticated?
2. Does path match rules?
3. Is data structure correct?

```javascript
// Debug helper
async function debugPermission(path) {
    const user = auth.currentUser;
    console.log('User:', user?.uid);
    console.log('Path:', path);
    console.log('Auth state:', user ? 'Signed in' : 'Signed out');
    
    // Check your database.rules.json
    // Common rule patterns:
    // ".read": "auth != null" - Must be logged in
    // ".read": "auth.uid === $uid" - Must own the data
    // ".read": "root.child('admins').child(auth.uid).exists()" - Must be admin
}
```

**Common Rules Fixes:**

```json
{
  "rules": {
    "users": {
      "$uid": {
        // User can only read/write their own data
        ".read": "auth != null && auth.uid === $uid",
        ".write": "auth != null && auth.uid === $uid"
      }
    },
    "public": {
      // Anyone can read, only authenticated can write
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

### Error: "Client is offline"

**Cause:** Firebase lost connection

```javascript
import { ref, onValue, onDisconnect } from 'firebase/database';

// Monitor connection state
const connectedRef = ref(db, '.info/connected');
onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
        console.log('Connected to Firebase');
    } else {
        console.log('Disconnected from Firebase');
    }
});

// Handle offline gracefully
import { enableIndexedDbPersistence } from 'firebase/firestore';
// For Realtime DB, offline is automatic
```

### Bug: Data listener not updating

```javascript
// ❌ WRONG - Using once() for real-time data
const snapshot = await get(ref(db, 'messages'));

// ✅ CORRECT - Use onValue for real-time updates
const unsubscribe = onValue(ref(db, 'messages'), (snapshot) => {
    const data = snapshot.val();
    messages = data ? Object.values(data) : [];
});

// Don't forget to unsubscribe!
onMount(() => {
    return () => unsubscribe();
});
```

### Bug: Data structure mismatch

```javascript
// Firebase returns object with keys, not array
// ❌ WRONG assumption
const messages = snapshot.val(); // { "-abc": {...}, "-def": {...} }
messages.forEach(m => ...); // Error! Not an array

// ✅ CORRECT - Convert to array
const messagesObj = snapshot.val() || {};
const messages = Object.entries(messagesObj).map(([key, value]) => ({
    id: key,
    ...value
}));
```

---

## Firebase Admin SDK Errors (Server-Side)

### Error: "The default Firebase app does not exist"

```javascript
// ❌ WRONG - Not checking if already initialized
initializeApp({ credential: cert(serviceAccount) });

// ✅ CORRECT - Check first
import { getApps, initializeApp, cert } from 'firebase-admin/app';

if (!getApps().length) {
    initializeApp({ credential: cert(serviceAccount) });
}
```

### Error: "Invalid service account JSON"

**Common Causes:**
1. JSON not properly escaped in env var
2. Missing private_key newlines

```javascript
// Fix for environment variable JSON
let jsonString = process.env.FIREBASE_SERVICE_ACCOUNT.trim();

// Remove wrapper quotes if present
if (jsonString.startsWith('"') && jsonString.endsWith('"')) {
    jsonString = jsonString.slice(1, -1);
}

const serviceAccount = JSON.parse(jsonString);

// Fix newlines in private key
if (serviceAccount.private_key) {
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
}
```

### Error: "Session cookie verification failed"

```javascript
// In hooks.server.js
try {
    const decodedClaims = await adminAuth.verifySessionCookie(sessionCookie, true);
    event.locals.userId = decodedClaims.uid;
} catch (error) {
    // Handle specific errors
    switch (error.code) {
        case 'auth/session-cookie-expired':
            // Cookie expired - clear and redirect to login
            event.cookies.delete('__session', { path: '/' });
            break;
        case 'auth/session-cookie-revoked':
            // User signed out elsewhere
            event.cookies.delete('__session', { path: '/' });
            break;
        case 'auth/argument-error':
            // Invalid cookie format
            event.cookies.delete('__session', { path: '/' });
            break;
    }
}
```

---

## Performance Issues

### Bug: Too many database reads

```javascript
// ❌ WRONG - Reading in a loop
for (const userId of userIds) {
    const user = await get(ref(db, `users/${userId}`));
    users.push(user.val());
}

// ✅ CORRECT - Single read with query
const snapshot = await get(ref(db, 'users'));
const allUsers = snapshot.val();
const users = userIds.map(id => allUsers[id]).filter(Boolean);

// ✅ ALSO CORRECT - Parallel reads
const users = await Promise.all(
    userIds.map(id => get(ref(db, `users/${id}`)))
);
```

### Bug: Listener memory leak

```javascript
// ❌ WRONG - Never unsubscribing
onValue(ref(db, 'data'), callback);

// ✅ CORRECT - Store and call unsubscribe
let unsubscribe;

onMount(() => {
    unsubscribe = onValue(ref(db, 'data'), callback);
    return () => unsubscribe?.();
});
```

---

## Security Checklist

- [ ] Never expose Firebase Admin credentials to client
- [ ] Use security rules, not just client-side checks
- [ ] Validate data structure in rules
- [ ] Rate limit sensitive operations
- [ ] Use session cookies, not ID tokens for web auth
- [ ] Set appropriate cookie options (httpOnly, secure, sameSite)
