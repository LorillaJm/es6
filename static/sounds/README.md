# Notification Sounds

This folder contains notification sound files used by the push notification system.

## Required Files

- `notification.mp3` - Default notification sound (normal priority)
- `notification-urgent.mp3` - Urgent/emergency notification sound (high priority)

## How It Works

### 1. Foreground Notifications (App Open)
When the app is open, sounds are played directly using the HTML5 Audio API:
- Sounds are preloaded on app start for instant playback
- The `notificationSoundPlayer.js` handles all sound playback
- Falls back to Web Audio API beep if files fail to load

### 2. Background Notifications (App Closed)
When the app is closed or in background:
- Firebase Cloud Messaging (FCM) delivers the notification
- Service Worker (`firebase-messaging-sw.js` and `sw.js`) handles the notification
- Service Worker sends a message to any open windows to play sound
- If no windows are open, the OS default notification sound plays

### 3. Sound Selection
- **Default sound**: Used for normal priority notifications
- **Urgent sound**: Used for high/urgent priority and emergency alerts

## File Requirements

- **Format**: MP3 (best compatibility across browsers)
- **Size**: Keep under 100KB for fast loading
- **Duration**: 0.5 - 2 seconds recommended
- **Volume**: Normalized to prevent jarring sounds

## Free Sound Resources

- https://notificationsounds.com/
- https://freesound.org/
- https://mixkit.co/free-sound-effects/notification/

## Testing

Visit `/test-notifications` in your app to test:
- Sound playback (default and urgent)
- Push notifications with sound
- Vibration patterns

## Architecture

```
Admin creates announcement
        ↓
Backend sends to FCM (firebase-admin.js)
        ↓
FCM delivers to device
        ↓
Service Worker receives (firebase-messaging-sw.js)
        ↓
Shows notification + plays sound
        ↓
User sees notification (even if app closed)
```

## Platform Support

| Platform | Background Notifications | Custom Sound |
|----------|-------------------------|--------------|
| Android App | ✅ YES | ✅ YES |
| iOS App | ✅ YES | ⚠️ Limited |
| Web (Chrome, Edge) | ✅ YES | ✅ YES |
| Web (Safari) | ⚠️ Limited | ⚠️ Limited |
| PWA | ✅ YES | ✅ YES |
