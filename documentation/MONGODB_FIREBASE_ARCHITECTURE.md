# MongoDB Atlas + Firebase Hybrid Architecture

## Overview

This system implements a strict separation between MongoDB Atlas (primary database) and Firebase (realtime messaging only).

## 🧱 Core Rules

### 1️⃣ MongoDB Atlas — PRIMARY DATABASE

MongoDB Atlas is the **single source of truth** for ALL permanent data:

- ✅ Users
- ✅ Attendance records
- ✅ E-Pass verification
- ✅ History & analytics
- ✅ Admin data
- ✅ Security logs
- ✅ Audit logs
- ✅ Announcements
- ✅ Feedback
- ✅ Gamification

### 2️⃣ Firebase — REALTIME ASYNC ONLY

Firebase is used **ONLY** for:

- ✅ Live attendance status
- ✅ Realtime dashboard counters
- ✅ Online/offline presence
- ✅ Push-style UI updates
- ✅ Admin live monitoring

Firebase **MUST**:
- Store temporary/transient data only
- Be cleared automatically or overwritten
- Never be queried for history

### 🚫 Prohibitions

- ❌ Firebase as backup DB
- ❌ Firebase history storage
- ❌ Direct client database access
- ❌ Business logic in frontend
- ❌ Duplicated records between MongoDB & Firebase

## 🔁 Data Flow (STRICT)

```
Frontend
    ↓
Backend API (auth + validation)
    ↓
MongoDB Atlas (save/update)
    ↓
Emit realtime signal
    ↓
Firebase Realtime Database
    ↓
Clients receive live update
```

**Frontend must NOT write to MongoDB or Firebase directly.**

## 📁 File Structure

```
src/lib/server/mongodb/
├── connection.js           # MongoDB Atlas connection manager
├── initDatabase.js         # Database initialization & migration
├── index.js               # Module exports
├── schemas/
│   ├── User.js            # User schema
│   ├── Attendance.js      # Attendance schema
│   ├── Admin.js           # Admin schema
│   ├── AuditLog.js        # Audit log schema
│   ├── Announcement.js    # Announcement schema
│   ├── Feedback.js        # Feedback schema
│   ├── Gamification.js    # Gamification schema
│   ├── EPass.js           # E-Pass schema
│   └── index.js           # Schema exports
└── services/
    ├── userService.js     # User operations
    ├── attendanceService.js # Attendance operations
    ├── auditService.js    # Audit log operations
    └── index.js           # Service exports

src/lib/server/
└── realtimeEmitter.js     # Firebase realtime emitter (backend only)

src/lib/realtime/
└── realtimeClient.js      # Firebase client (READ ONLY)

src/routes/api/attendance/
├── check-in/+server.js    # Check-in API
├── check-out/+server.js   # Check-out API
├── status/+server.js      # Status API
├── history/+server.js     # History API
└── break/+server.js       # Break management API

src/lib/services/
└── attendanceApiService.js # Client-side API service
```

## 🔐 Security

### Firebase Rules

```json
{
  "realtime": {
    "attendance": {
      "live": {
        "$userId": {
          ".read": "auth != null && auth.uid == $userId",
          ".write": "auth != null && auth.token.admin === true"
        }
      }
    }
  }
}
```

- **Read**: Authenticated users only
- **Write**: Backend service account ONLY

### MongoDB Security

- Role-based access control
- No client-side credentials
- Rate limiting on API routes
- All operations logged to audit collection

## 📊 Attendance Example (MANDATORY LOGIC)

1. User clicks "Check In"
2. Frontend calls `POST /api/attendance/check-in`
3. Backend validates:
   - Authentication (Firebase token)
   - Device info
   - Location (if geofencing enabled)
4. Attendance record saved to MongoDB
5. **IF AND ONLY IF** MongoDB write succeeds:
   - Push realtime event to Firebase
6. Frontend updates instantly via Firebase listener

```javascript
// Backend (attendanceService.js)
export async function checkIn(firebaseUid, checkInData) {
    // 1. Save to MongoDB FIRST
    const attendance = new Attendance({ ... });
    await attendance.save();
    
    // 2. ONLY IF MongoDB succeeded → emit to Firebase
    await emitAttendanceStatus(firebaseUid, {
        status: 'checkedIn',
        checkInTime: attendance.checkIn.timestamp
    });
    
    return attendance;
}
```

## 🧪 Testing Conditions

1. **MongoDB down** → Firebase must not receive events
2. **Firebase down** → MongoDB must still work
3. **High concurrency** → No data mismatch
4. **Network issues** → Graceful degradation

## ⚙️ Environment Variables

```env
# MongoDB Atlas (PRIMARY)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db

# Firebase (REALTIME ONLY)
PUBLIC_FIREBASE_API_KEY=...
PUBLIC_FIREBASE_DATABASE_URL=...
FIREBASE_SERVICE_ACCOUNT=...
```

## 🚀 Getting Started

1. Set up MongoDB Atlas cluster
2. Add `MONGODB_URI` to `.env`
3. Run database initialization:
   ```javascript
   import { initializeDatabase } from '$lib/server/mongodb/initDatabase.js';
   await initializeDatabase();
   ```
4. (Optional) Migrate existing Firebase data:
   ```javascript
   import { migrateFromFirebase } from '$lib/server/mongodb/initDatabase.js';
   await migrateFromFirebase(adminDb);
   ```

## 📈 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/attendance/check-in` | POST | Check in |
| `/api/attendance/check-out` | POST | Check out |
| `/api/attendance/status` | GET | Current status |
| `/api/attendance/history` | GET | Attendance history |
| `/api/attendance/break` | POST | Start/end break |
| `/api/health` | GET | System health check |
| `/api/admin/attendance/overview` | GET | Admin dashboard |
| `/api/admin/audit-logs` | GET | Audit logs |

## 🎯 Final Goal

- **MongoDB Atlas** = Truth (permanent data)
- **Firebase** = Realtime Messenger (transient data)
- **Backend** = Controller (all business logic)
- **Frontend** = Consumer (read-only from Firebase)
