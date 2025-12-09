# Enterprise-Level Attendance System Features

## Overview

This attendance system includes world-class enterprise security features designed for organizations requiring robust, secure, and intelligent attendance tracking.

---

## 🔐 Zero-Trust Security

### Device Fingerprinting
- Generates unique device fingerprints using multiple browser/device characteristics
- Tracks screen resolution, timezone, language, GPU, canvas fingerprint, and more
- Validates device identity on each attendance action

### Session Management
- Sessions are bound to specific devices and locations
- Automatic session expiration after 8 hours of inactivity
- Ability to revoke sessions remotely
- Activity monitoring with automatic session invalidation

**Files:**
- `src/lib/security/deviceFingerprint.js`
- `src/lib/security/sessionManager.js`

---

## 📍 Smart Location Validation (Geofence)

### Campus Geofence System
- Define multiple campus zones with center coordinates and radius
- Validates user location against allowed zones before attendance
- Configurable accuracy thresholds
- Location spoofing detection

### Features
- Multiple zone support (primary/secondary)
- Real-time distance calculation using Haversine formula
- Reverse geocoding for location names
- Admin configuration panel for zone management

**Files:**
- `src/lib/security/geofence.js`
- `src/lib/components/GeofenceConfig.svelte`

---

## 📡 Offline Mode Support

### IndexedDB Queue System
- Automatically queues attendance actions when offline
- Stores all action data locally with timestamps
- Syncs automatically when connection is restored
- Manual sync option available

### Sync Features
- Automatic retry with exponential backoff
- Failed action tracking (max 5 attempts)
- Periodic sync checks every 30 seconds
- Visual indicators for pending actions

**Files:**
- `src/lib/offline/offlineQueue.js`

---

## 🔄 Live Sync Engine

### Real-Time Updates
- Firebase real-time listeners for instant updates
- Live attendance status synchronization
- Real-time notification delivery
- Leaderboard live updates

### Subscriptions Available
- User attendance history
- Today's attendance status
- Notifications
- Department attendance (admin)
- Gamification data
- Leaderboard

**Files:**
- `src/lib/realtime/liveSyncEngine.js`

---

## 🧠 AI Behavior Analysis

### Anomaly Detection
Detects various suspicious patterns:

1. **Fake Attendance Attempts**
   - Rapid check-ins (less than 4 hours apart)
   - Multiple devices in single day

2. **Location Spoofing**
   - Impossible travel detection
   - Static coordinate detection
   - Speed-based validation

3. **Proxy Scanning**
   - Same device at multiple locations
   - Pattern-based detection

4. **Time Anomalies**
   - Deviation from normal check-in patterns
   - Statistical analysis using standard deviation

### Risk Levels
- **LOW**: Normal behavior
- **MEDIUM**: Minor anomalies detected
- **HIGH**: Requires manual review
- **CRITICAL**: Action blocked, admin notification

### Trust Score
- Calculated based on behavior history
- Decreases with anomalies
- Visible to users for transparency

**Files:**
- `src/lib/ai/behaviorAnalysis.js`
- `src/lib/components/SecurityDashboard.svelte`

---

## 🛡️ Security Dashboard (Admin)

### Features
- View all flagged users
- Review recent anomalies
- Resolve flagged users (clear/warn/suspend)
- Real-time security monitoring

**Files:**
- `src/lib/components/SecurityDashboard.svelte`

---

## Configuration

### Environment Variables

```env
# Enterprise Security Configuration
PUBLIC_GEOFENCE_ENABLED=true
PUBLIC_GEOFENCE_STRICT_MODE=false
PUBLIC_AI_ANALYSIS_ENABLED=true
PUBLIC_AI_BLOCK_CRITICAL=true
PUBLIC_OFFLINE_SYNC_INTERVAL=30000
PUBLIC_SESSION_TIMEOUT_HOURS=8
```

### Geofence Zone Configuration

Zones can be configured via the admin panel or directly in Firebase:

```javascript
{
  "geofence_zones": {
    "default": {
      "main_campus": {
        "id": "main_campus",
        "name": "Main Campus",
        "latitude": 14.5995,
        "longitude": 120.9842,
        "radius": 500,
        "type": "primary"
      }
    }
  }
}
```

---

## Module Imports

```javascript
// Security
import { 
  generateDeviceFingerprint, 
  getDeviceInfo,
  isDeviceTrusted 
} from '$lib/security';

// Geofence
import { 
  validateLocationInGeofence,
  getCurrentLocation 
} from '$lib/security';

// Offline
import { 
  queueOfflineAction,
  syncPendingActions,
  isOffline 
} from '$lib/offline';

// Real-time
import { 
  subscribeToUserAttendance,
  liveStatus 
} from '$lib/realtime';

// AI Analysis
import { 
  analyzeAttendanceBehavior,
  RiskLevel 
} from '$lib/ai';
```

---

## Security Best Practices

1. **Always validate location** before allowing attendance
2. **Monitor trust scores** and investigate low scores
3. **Review flagged users** promptly
4. **Configure geofence zones** accurately
5. **Enable strict mode** for high-security environments
6. **Regular audit** of behavior logs

---

## Database Structure

```
Firebase Realtime Database:
├── attendance/{userId}/{shiftId}
├── sessions/{userId}/{sessionId}
├── geofence_zones/{organizationId}/{zoneId}
├── behavior_logs/{userId}/{logId}
├── flagged_users/{userId}
├── location_logs/{userId}/{timestamp}
└── admin_notifications/{notificationId}
```

---

## 📱 Smart App Install Prompt

### Overview
A modern, Apple-grade feature that detects mobile users and shows a clean, legal, OS-friendly popup encouraging them to install the official app.

### Benefits
- ⚡ Faster mobile performance
- 📴 Offline access
- 🔔 Push notifications
- 🏢 Enterprise-grade professionalism

### Smart Detection
The system automatically detects:
- Device type (iOS/Android)
- Browser capabilities
- PWA support
- If app is already installed
- If running in standalone mode

### Display Conditions
Prompt appears only when:
- ✔ User is on mobile device
- ✔ User has NOT installed the app
- ✔ User has visited at least 2 pages
- ✔ User hasn't dismissed prompt recently (1 week cooldown)
- ✔ User is idle for 3+ seconds

### Android Options
1. **Add to Home Screen (PWA)** - Native browser install prompt
2. **Google Play Store** - If app is published
3. **Direct APK Download** - With safety disclaimer

### iOS Options
1. **App Store** - If app is published
2. **Add to Home Screen Guide** - Step-by-step PWA instructions

### User Preferences
- **Maybe Later** - Dismisses for 1 week
- **Don't show again** - Permanent dismissal
- Preferences stored in localStorage

### Configuration

```javascript
// src/lib/stores/appInstall.js
export const appConfig = {
    name: 'PCC Attendance',
    icon: '/logo.png',
    description: 'Install the app for faster access and a smoother experience.',
    playStoreUrl: null,  // Set when published
    appStoreUrl: null,   // Set when published
    apkUrl: null,        // Direct APK download URL
    apkSize: null,       // e.g., '12.5 MB'
};
```

### Design Features
- Apple-grade glassmorphism design
- Rounded corners (22px)
- Smooth slide-up animation
- Backdrop blur effect
- Safe area support for notched devices
- Dark mode compatible
- Respects `prefers-reduced-motion`

### Files
- `src/lib/stores/appInstall.js` - State management & device detection
- `src/lib/components/AppInstallPrompt.svelte` - UI component

### Legal Compliance
This feature is 100% legal because:
- ✔ No forced installs
- ✔ Clear dismiss options
- ✔ Respects user preferences
- ✔ Uses official store links
- ✔ APK downloads include safety disclaimer

---

## 🔗 Deep Linking (Premium Feature)

### Overview
Smart deep linking that opens the app directly if installed, or falls back to the website/store if not.

### How It Works
1. Detects if app is installed using Related Apps API
2. Shows "Open in App" banner on mobile
3. Attempts to open via custom URL scheme or universal link
4. Falls back to store/web after 2.5 seconds if app not found

### Configuration

```javascript
// src/lib/stores/appInstall.js
export const appConfig = {
    deepLink: {
        scheme: 'pccattendance',           // Custom URL scheme
        androidPackage: 'com.pcc.attendance',
        iosBundleId: 'com.pcc.attendance',
        universalLinkDomain: 'pccattendance.com',
    }
};
```

### Deep Link Methods
- **Custom URL Scheme**: `pccattendance://dashboard`
- **Universal Links (iOS)**: `https://pccattendance.com/app/dashboard`
- **Android Intent**: Opens app or falls back to Play Store

### Usage

```javascript
import { deepLinking } from '$lib/stores/appInstall.js';

// Try to open app
await deepLinking.tryOpenApp('dashboard');

// Check if app is installed
const installed = await deepLinking.checkAppInstalled();

// Get app link
const link = deepLinking.getAppLink('attendance');
```

### Files
- `src/lib/stores/appInstall.js` - Deep linking utilities
- `src/lib/components/DeepLinkHandler.svelte` - "Open in App" banner

---

## 📲 QR Code Install (Premium Feature)

### Overview
Shows a QR code on desktop that mobile users can scan to download the app.

### Features
- Auto-generates QR code for download URL
- Detects device and shows appropriate store link
- Apple-grade modal design
- Store badges for Play Store & App Store

### Usage

```svelte
<script>
    import DesktopInstallQR from '$lib/components/DesktopInstallQR.svelte';
    let showQR = false;
</script>

<button on:click={() => showQR = true}>
    Get Mobile App
</button>

<DesktopInstallQR bind:show={showQR} />
```

### Configuration

```javascript
// src/lib/stores/appInstall.js
export const appConfig = {
    qrCode: {
        enabled: true,
        size: 180,
        color: '#000000',
        backgroundColor: '#ffffff',
    }
};
```

### Files
- `src/lib/stores/appInstall.js` - QR code generation
- `src/lib/components/DesktopInstallQR.svelte` - QR modal component
