# Professional Email Verification System

## Overview

This document describes the professional email verification flow implemented for the Attendance System. The system ensures that users verify their email addresses on first-time login, providing enhanced security and user validation.

## How It Works

### Flow Summary

1. **User creates account or signs in for the first time**
   - User enters email + password (or uses Google OAuth)
   - System checks if `emailVerified == false`
   - If not verified → send verification code
   - If verified → allow login directly

2. **Verification Code (OTP) Sent**
   - 6-digit code generated
   - Expires in 5 minutes
   - Stored securely (hashed, not plaintext)
   - Email sent with professional template

3. **User Enters Code**
   - User sees "Enter the Code" screen
   - Inputs 6-digit OTP
   - System validates:
     - Is code correct?
     - Not expired?
     - Not used before?
   - If valid → mark `emailVerified = true`

4. **Auto-redirect to Dashboard**
   - After verification, user is automatically logged in
   - Redirected to dashboard

## Security Features

- ✅ OTP stored hashed (SHA-256), NOT plaintext
- ✅ Expires after 5 minutes
- ✅ One OTP per user, deleted after use
- ✅ Maximum 3 resend attempts
- ✅ 60-second cooldown between resends
- ✅ Maximum 5 verification attempts per code
- ✅ Rate limiting to prevent brute force

## API Endpoints

### User Email Verification

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/verify-email/send` | POST | Send verification OTP |
| `/api/auth/verify-email/verify` | POST | Verify OTP code |
| `/api/auth/verify-email/status` | GET/POST | Check verification status |

### Admin Email Verification

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/auth/verify-email` | POST | Verify admin email / resend code |
| `/api/admin/auth/verify-email` | GET | Check admin verification status |
| `/api/admin/users/verify-email` | POST | Manually verify/unverify user email |
| `/api/admin/users/verify-email` | GET | Get user verification status |

## Configuration

### Email Settings (.env)

```env
# Email Configuration (REQUIRED for verification)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Attendance System <your-email@gmail.com>
```

### Gmail App Password Setup

1. Go to Google Account > Security
2. Enable 2-Step Verification
3. Go to App passwords
4. Generate a new app password for "Mail"
5. Use this password in `EMAIL_PASS`

## File Structure

```
src/
├── lib/
│   └── server/
│       └── emailVerificationService.js  # Core verification logic
├── routes/
│   ├── verify-email/
│   │   └── +page.svelte                 # User verification page
│   └── api/
│       ├── auth/
│       │   └── verify-email/
│       │       ├── send/+server.js      # Send OTP endpoint
│       │       ├── verify/+server.js    # Verify OTP endpoint
│       │       └── status/+server.js    # Status check endpoint
│       └── admin/
│           ├── auth/
│           │   └── verify-email/+server.js  # Admin verification
│           └── users/
│               └── verify-email/+server.js  # Manual verification
```

## Integration Points

### Main Login Page (`src/routes/+page.svelte`)
- Checks email verification status after login
- Shows "Verify Email" button if not verified
- Redirects to `/verify-email` page

### Profile Form (`src/lib/components/ProfileForm.svelte`)
- Sets `emailVerified: false` for new profiles
- Prompts user to verify email after profile creation

### App Layout (`src/routes/app/+layout.svelte`)
- Checks verification status on protected routes
- Redirects unverified users to verification page

### Admin Login (`src/routes/admin/login/+page.svelte`)
- Handles email verification for admin accounts
- Shows OTP input after first login
- Auto-generates tokens after verification

## Database Schema

### User Profile
```json
{
  "users/{userId}": {
    "emailVerified": false,
    "emailVerifiedAt": "2025-12-12T10:00:00.000Z"
  }
}
```

### Email Verifications (Temporary)
```json
{
  "emailVerifications/{userId}": {
    "otpHash": "sha256_hash",
    "sessionToken": "random_token",
    "email": "user@example.com",
    "createdAt": "2025-12-12T10:00:00.000Z",
    "expiresAt": "2025-12-12T10:05:00.000Z",
    "lastSentAt": "2025-12-12T10:00:00.000Z",
    "resendCount": 1,
    "verifyAttempts": 0,
    "verified": false
  }
}
```

## Email Template

The verification email includes:
- Professional Apple-style design
- Clear 6-digit code display
- 5-minute expiration notice
- Security warning about not sharing codes
- Responsive layout for mobile

## Admin Features

### Manual Verification
Admins can manually verify or unverify user emails:

```javascript
// Verify user email
POST /api/admin/users/verify-email
{
  "userId": "user123",
  "action": "verify"
}

// Unverify user email (for testing)
POST /api/admin/users/verify-email
{
  "userId": "user123",
  "action": "unverify"
}
```

## Migration Notes

For existing users who haven't been through the verification flow:
1. They will be prompted to verify on next login
2. Admins can manually mark users as verified via the admin API
3. Users with `emailVerified: undefined` are treated as unverified

## Troubleshooting

### Email Not Sending
1. Check EMAIL_* environment variables are set
2. Verify Gmail App Password is correct
3. Check server logs for SMTP errors

### Code Expired
- Users can request a new code (max 3 times)
- 60-second cooldown between requests

### Too Many Attempts
- After 5 failed attempts, user must request new code
- After 3 resends, user must contact support
