# Firebase to MongoDB Atlas Migration Guide

## Overview

This document describes the complete migration of data from Firebase Realtime Database to MongoDB Atlas, establishing MongoDB as the **Single Source of Truth**.

## Migration Rules

| Rule | Description |
|------|-------------|
| Firebase Read-Only | Firebase is treated as read-only during migration |
| No Duplication | Existing MongoDB records are skipped, not overwritten |
| MongoDB Primary | After migration, MongoDB becomes the single source of truth |
| Verification | All migrations are verified and logged |
| Audit Trail | Complete audit logs are maintained |

## Data Mapping

### Users Collection

| Firebase Path | MongoDB Field | Transformation |
|---------------|---------------|----------------|
| `users/{uid}` | `users` collection | Direct mapping |
| `uid` (key) | `firebaseUid` | Preserved as link |
| `email` | `email` | Lowercase, trimmed |
| `name` / `displayName` | `name`, `displayName` | Fallback chain |
| `profilePhoto` / `photoURL` | `profilePhoto` | Either field |
| `phone` / `phoneNumber` | `phone` | Either field |
| `orgId` / `organizationId` | `orgId` | Default: 'default' |
| `role` | `role` | Mapped to enum |
| `status` | `status` | Mapped to enum |
| `fcmTokens` | `devices[]` | Converted to array |
| `createdAt` | `createdAt` | ISO date conversion |

### Attendance Collection

| Firebase Path | MongoDB Field | Transformation |
|---------------|---------------|----------------|
| `attendance/{uid}/{recordId}` | `attendance` collection | Flattened |
| `{uid}` (parent key) | `firebaseUid` | User reference |
| `{recordId}` (key) | `_firebaseRecordId` | Preserved |
| `date` / `checkIn.timestamp` | `date`, `dateString` | Parsed + formatted |
| `checkIn` | `checkIn` | Nested object |
| `checkOut` | `checkOut` | Nested object |
| `currentStatus` | `currentStatus` | Enum mapping |
| `isLate` | `isLate` | Boolean |

### Admins Collection

| Firebase Path | MongoDB Field | Transformation |
|---------------|---------------|----------------|
| `admins/{uid}` | `admins` collection | Direct mapping |
| `{uid}` (key) | `firebaseUid` | Preserved |
| `adminLevel` / `role` | `adminLevel` | Mapped to enum |
| `permissions` | `permissions` | Object with defaults |
| `managedDepartments` | `managedDepartments` | Array |

### Announcements Collection

| Firebase Path | MongoDB Field | Transformation |
|---------------|---------------|----------------|
| `announcements/{key}` | `announcements` collection | Direct mapping |
| `{key}` | `_firebaseKey` | Preserved |
| `title` | `title` | Required |
| `content` / `message` | `content` | Either field |
| `type` | `type` | Enum mapping |
| `priority` | `priority` | Enum mapping |
| `publishAt` / `createdAt` | `publishAt` | Date conversion |

### Gamification Collection

| Firebase Path | MongoDB Field | Transformation |
|---------------|---------------|----------------|
| `gamification/{uid}` | `gamification` collection | Direct mapping |
| `realtime/gamification/leaderboard/{orgId}` | Merged | Alternative path |
| `totalPoints` / `points` | `totalPoints` | Either field |
| `experiencePoints` / `xp` | `experiencePoints` | Either field |
| `currentStreak` / `streak` | `currentStreak` | Either field |
| `badges` | `badges[]` | Array mapping |

### Settings Collection

| Firebase Path | MongoDB Field | Transformation |
|---------------|---------------|----------------|
| `settings` | `settings` collection | Single document |
| All nested data | `settings` (Mixed) | Preserved structure |

## Role Mapping

| Firebase Value | MongoDB Value |
|----------------|---------------|
| `user` | `user` |
| `admin` | `admin` |
| `superadmin` | `superadmin` |
| `super_admin` | `superadmin` |
| `super-admin` | `superadmin` |
| `manager` | `manager` |
| `student` | `student` |
| `teacher` | `teacher` |
| `staff` | `staff` |
| (other) | `user` |

## Status Mapping

| Firebase Value | MongoDB Value |
|----------------|---------------|
| `active` | `active` |
| `inactive` | `inactive` |
| `suspended` | `suspended` |
| `pending` | `pending` |
| `disabled` | `suspended` |
| `blocked` | `suspended` |
| (other) | `active` |

## Running the Migration

### Prerequisites

1. Node.js 18+ installed
2. MongoDB Atlas connection string in `.env`
3. Firebase service account JSON in `.env`

### Commands

```bash
# Dry run (no data written)
node scripts/firebase-to-mongodb-migration.js --dry-run

# Verbose dry run
node scripts/firebase-to-mongodb-migration.js --dry-run --verbose

# Full migration
node scripts/firebase-to-mongodb-migration.js

# Verbose migration
node scripts/firebase-to-mongodb-migration.js --verbose
```

### Environment Variables Required

```env
MONGODB_URI=mongodb+srv://...
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
PUBLIC_FIREBASE_DATABASE_URL=https://your-project.firebasedatabase.app
```

## Verification Checklist

### Pre-Migration

- [ ] Backup MongoDB Atlas database
- [ ] Verify Firebase read access
- [ ] Test MongoDB connection
- [ ] Run dry-run migration
- [ ] Review dry-run report

### During Migration

- [ ] Monitor migration logs
- [ ] Check for error messages
- [ ] Verify batch processing

### Post-Migration

- [ ] Review migration report in `logs/migration/`
- [ ] Verify user count matches (±5% tolerance)
- [ ] Verify attendance record count
- [ ] Verify admin accounts migrated
- [ ] Verify announcements migrated
- [ ] Check audit log entry created
- [ ] Test application with MongoDB data
- [ ] Update Firebase rules (see below)

## Migration Report

Reports are saved to `logs/migration/migration_YYYY-MM-DDTHH-mm-ss.json`

### Report Structure

```json
{
  "migrationId": "migration_2025-12-21T...",
  "startTime": "2025-12-21T...",
  "endTime": "2025-12-21T...",
  "durationSeconds": 45.2,
  "dryRun": false,
  "stats": {
    "users": { "read": 100, "migrated": 98, "skipped": 2, "errors": 0 },
    "attendance": { "read": 5000, "migrated": 4950, "skipped": 50, "errors": 0 }
  },
  "totalErrors": 0,
  "totalWarnings": 2,
  "errors": [],
  "warnings": [...],
  "logs": [...]
}
```

## Firebase Rules Update

After successful migration, update Firebase rules to disable historical paths:

### Steps

1. Review migration report - ensure all data migrated successfully
2. Test application with MongoDB as primary data source
3. Deploy new Firebase rules from `database.rules.post-migration.json`

### Deploy Rules

```bash
# Using Firebase CLI
firebase deploy --only database

# Or manually in Firebase Console:
# 1. Go to Firebase Console > Realtime Database > Rules
# 2. Copy contents of database.rules.post-migration.json
# 3. Publish rules
```

### Rule Changes Summary

| Path | Before | After |
|------|--------|-------|
| `users/{uid}` | Read/Write | Read-only (transition) |
| `attendance/{uid}` | Read-only | Disabled |
| `admins` | Read/Write | Read-only |
| `announcements` | Read/Write | Read-only |
| `settings` | Read/Write | Read-only |
| `gamification` | Read | Disabled |
| `realtime/*` | Active | Active (unchanged) |

## Rollback Plan

If issues occur after migration:

1. **Immediate**: Revert Firebase rules to original
2. **Data**: MongoDB data is additive (no Firebase data deleted)
3. **Application**: Switch data source back to Firebase in code

### Rollback Commands

```bash
# Restore original Firebase rules
cp database.rules.json database.rules.active.json
firebase deploy --only database
```

## Architecture After Migration

```
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │   SvelteKit     │         │   API Routes    │           │
│  │   Frontend      │◄───────►│   (Server)      │           │
│  └────────┬────────┘         └────────┬────────┘           │
│           │                           │                     │
│           │ Realtime                  │ CRUD                │
│           │ Updates                   │ Operations          │
│           ▼                           ▼                     │
│  ┌─────────────────┐         ┌─────────────────┐           │
│  │    Firebase     │         │    MongoDB      │           │
│  │    Realtime     │◄────────│    Atlas        │           │
│  │    Database     │  Sync   │  (Primary DB)   │           │
│  │                 │         │                 │           │
│  │  • Live status  │         │  • Users        │           │
│  │  • Presence     │         │  • Attendance   │           │
│  │  • Notifications│         │  • Admins       │           │
│  │  • Leaderboard  │         │  • Audit Logs   │           │
│  │    (cached)     │         │  • All Data     │           │
│  └─────────────────┘         └─────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Data Flow:
1. All CRUD operations → MongoDB Atlas (via API)
2. After MongoDB write succeeds → Sync to Firebase Realtime
3. Frontend subscribes to Firebase for live updates
4. Historical queries → MongoDB only
```

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Email conflicts | Duplicate emails | Script auto-prefixes with UID |
| Missing users | No email in Firebase | Uses `{uid}@migrated.local` |
| Date parsing errors | Invalid date format | Falls back to current date |
| Connection timeout | Network issues | Retry migration |

### Debug Mode

```bash
# Run with verbose logging
node scripts/firebase-to-mongodb-migration.js --verbose

# Check specific collection
# Edit script to run only specific migration function
```

## Support

For issues with migration:
1. Check migration report in `logs/migration/`
2. Review error logs
3. Verify environment variables
4. Test database connections independently
