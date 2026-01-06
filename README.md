# Attendance System

A modern, enterprise-grade attendance management system built with SvelteKit 2, Firebase, MongoDB, and AI-powered features. Designed for educational institutions and organizations requiring secure, intelligent attendance tracking.

## 🎯 Overview

This system provides a complete digital attendance solution featuring:
- QR-based Digital ID (E-Pass) verification
- AI-powered hybrid chatbot assistant with 3D avatar
- Real-time attendance tracking with offline support
- Enterprise security with geofencing and behavior analysis
- Gamification and engagement features
- Comprehensive admin dashboard with analytics
- Seasonal themes and celebrations

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | SvelteKit 2 (Svelte 5) |
| Styling | Tailwind CSS 4 |
| Primary Database | MongoDB Atlas |
| Realtime Database | Firebase Realtime Database |
| Authentication | Firebase Auth + Custom Admin Auth |
| AI | Google Gemini API |
| Email | Resend + Nodemailer (Gmail SMTP fallback) |
| Icons | Tabler Icons |
| QR Code | qrcode library |
| Date Handling | date-fns |
| Deployment | Vercel |
| Testing | Vitest + Playwright |

## � Security Features (Latest Update - January 2026)

### Authentication & Authorization
- **CSRF Protection** - Double-submit cookie pattern with timing-safe token validation
- **Strong Password Hashing** - PBKDF2 with 120,000 iterations (OWASP 2023 compliant)
- **JWT Token Management** - Short-lived access tokens (15 min) with refresh token rotation
- **MFA Support** - Time-based OTP for admin accounts
- **Email Verification** - OTP-based email verification for new admins

### Rate Limiting & DDoS Protection
- **Endpoint-specific limits**:
  - Login attempts: 5 per minute
  - Sensitive operations: 20 per minute
  - General API: 100 per minute
- **Sliding window algorithm** for accurate rate tracking
- **IP blocking** - 15-minute block after limit exceeded
- **Automatic cleanup** of expired rate limit entries

### Content Security Policy (CSP)
- Strict CSP headers on all responses
- Allows Firebase and Google services
- Frame protection against clickjacking
- XSS protection headers

### Security Headers
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` for camera/geolocation

### API Security
- Standardized secure API responses
- Sensitive field sanitization (passwords, tokens, secrets)
- Safe error messages (no internal details exposed)
- Input validation with schema-based validation
- Request body sanitization

## 📁 Project Structure

```
src/
├── lib/
│   ├── ai/                    # AI engines
│   │   ├── hybridEngine.js    # Core AI chatbot engine
│   │   ├── behaviorAnalysis.js # Anomaly detection
│   │   ├── enterprisePromptEngine.js
│   │   ├── predictiveInsights.js
│   │   ├── sentimentAnalyzer.js
│   │   ├── smartLeaveSuggestions.js
│   │   └── smartRecommendations.js
│   ├── components/            # Svelte components
│   │   ├── admin/             # Admin-specific components
│   │   ├── seasonal/          # Seasonal theme components
│   │   ├── skeleton/          # Loading skeletons
│   │   └── ...                # Core components
│   ├── motion/                # Animation system
│   ├── notifications/         # Push & smart notifications
│   ├── offline/               # Offline support
│   ├── performance/           # Performance optimization
│   ├── realtime/              # Live sync engine
│   ├── reports/               # Report generation
│   ├── security/              # Security modules
│   │   ├── deviceFingerprint.js
│   │   ├── geofence.js
│   │   ├── incidentResponse.js
│   │   ├── passwordPolicy.js
│   │   ├── qrCodeSecurity.js
│   │   └── sessionManager.js
│   ├── server/                # Server-side services
│   │   ├── mongodb/           # MongoDB integration
│   │   │   ├── schemas/       # Mongoose schemas
│   │   │   └── services/      # Database services
│   │   ├── adminAuth.js       # Admin authentication
│   │   ├── adminSecurityMiddleware.js
│   │   ├── apiResponse.js     # Standardized responses
│   │   ├── csrfProtection.js  # CSRF utilities
│   │   ├── cookieConfig.js    # Secure cookie config
│   │   ├── emailService.js
│   │   ├── ipRestriction.js
│   │   └── ...
│   ├── services/              # Client services
│   ├── stores/                # Svelte stores
│   └── utils/
│       ├── logger.js          # Production-ready logging
│       ├── serviceWorker.js
│       └── performanceMonitor.js
├── routes/
│   ├── app/                   # User application
│   ├── admin/                 # Admin panel
│   └── api/                   # API endpoints
└── documentation/
```


## ✨ Implemented Features

### 🔐 Digital ID Verification (E-Pass)
- Cryptographically signed QR codes
- Time-limited tokens with auto-expire & regenerate
- Device fingerprint binding
- Real-time cloud validation
- Anti-fraud protection

### 🤖 Hybrid AI Chatbot
- Three-layer intelligence architecture
- 3D animated assistant (AI3DAssistant component)
- Voice input/output support
- Context memory for conversations
- Predictive insights and pattern detection
- Role-based responses (User/Admin)
- Sentiment analysis
- Smart leave suggestions
- Enterprise prompt engine

### 🛡️ Enterprise Security
- Zero-trust device fingerprinting
- Smart geofencing with configurable zones
- AI behavior analysis and anomaly detection
- Session management with auto-expiration
- IP restriction capabilities
- Incident response system
- Password policy enforcement
- QR code security validation
- Comprehensive audit logging

### 📴 Offline Support
- IndexedDB queue for offline actions
- Automatic sync when connection restored
- Exponential backoff retry
- Visual offline status indicators

### 🎮 Gamification
- Points and achievements system
- Attendance streaks tracking
- Leaderboards
- Badges and rewards
- Seasonal rewards (Christmas daily rewards)

### 📧 Email & Notifications
- Email verification with OTP
- Push notifications (FCM)
- Smart notification engine
- Notification sound player
- Real-time notification service

### 📊 Reports & Analytics
- Custom report builder
- Work habit analysis
- Attendance trends and analytics
- Department comparison
- Monthly analytics
- Export capabilities (CSV, PDF)
- Email report delivery

### 🎨 Design System
- Apple x Enterprise aesthetic
- Glassmorphism effects
- Dark/Light mode support
- Motion design system with animations
- Page transitions
- Loading skeletons
- Toast notifications

### 🎄 Seasonal Themes
- Christmas theme with decorations
- Christmas daily rewards
- Snowflake effects
- Seasonal badges and cards
- Login celebrations
- Profile seasonal badges
- Configurable seasonal settings

### 👤 User Features
- Personal dashboard with stats
- Attendance check-in/out (QR, Face, Manual)
- E-Pass digital ID
- Attendance history with filters
- Personal analytics
- Gamification progress
- Profile customization
- Privacy settings
- Feedback submission
- Announcements viewing

### 👨‍💼 Admin Features
- Real-time dashboard with analytics
- User management (CRUD, bulk operations)
- Attendance management
- Security monitoring dashboard
- Custom report builder
- Audit logs viewer
- Session management (force logout)
- Announcement management
- Feedback management
- Database backup
- IP settings configuration
- QA testing tools
- Mobile admin tools
- System health monitoring
- Live activity feed
- Department insights
- Attendance prediction
- Daily time heatmap
- Location heatmap
- Smart recommendations panel
- User impersonation capability
- Quick actions launcher

### 🔗 Integrations
- OAuth support (Google, Microsoft, Slack, Zoom)
- Face verification service
- Leave request management
- Holiday service
- Google Calendar sync

### ⚡ Performance
- Optimized image loading
- Lazy loading components
- Server-side caching
- Query optimizer
- Performance monitoring
- API response optimization

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- Firebase project
- MongoDB Atlas cluster
- Google Gemini API key (for AI features)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd es6

# Install dependencies
npm install

# Sync SvelteKit
npm run prepare
```

### Environment Configuration

Create a `.env` file based on `.env.example`:

```env
# MongoDB Atlas (Primary Database)
MONGODB_URI=mongodb+srv://...

# Firebase Client (Public)
PUBLIC_FIREBASE_API_KEY=...
PUBLIC_FIREBASE_AUTH_DOMAIN=...
PUBLIC_FIREBASE_DATABASE_URL=...
PUBLIC_FIREBASE_PROJECT_ID=...
PUBLIC_FIREBASE_STORAGE_BUCKET=...
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
PUBLIC_FIREBASE_APP_ID=...

# Firebase Admin (Private)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Email (Resend recommended)
RESEND_API_KEY=...
RESEND_FROM=...

# AI
GEMINI_API_KEY=...

# OAuth (Optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Development

```bash
# Start development server (HTTPS with self-signed cert)
npm run dev

# Start with HTTP (avoids SSL warnings)
npm run dev:http
```

> **Note:** Service workers are automatically disabled in dev mode with self-signed SSL certificates. They work normally in production.

### Building

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

### Testing

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:unit
```

### Database Management

```bash
# Deploy Firebase database rules
firebase deploy --only database

# Migrate admins to MongoDB
npm run migrate:admins

# Dry run migration
npm run migrate:admins:dry

# Validate data consistency
npm run validate:data

# Validate and fix data issues
npm run validate:data:fix
```

## 📖 Documentation

Detailed documentation available in `/documentation`:

| Document | Description |
|----------|-------------|
| [Digital ID Verification](documentation/Digital_ID_Verification_E-Pass_System.md) | E-Pass system architecture |
| [Hybrid AI Chatbot](documentation/HYBRID_AI_CHATBOT.md) | AI assistant implementation |
| [Enterprise Features](documentation/ENTERPRISE_FEATURES.md) | Security & enterprise capabilities |
| [Email Verification](documentation/EMAIL_VERIFICATION_SYSTEM.md) | OTP email verification flow |
| [OAuth Setup Guide](documentation/OAUTH_SETUP_GUIDE.md) | OAuth provider configuration |
| [Design System](documentation/Design_System.md) | UI/UX design guidelines |
| [Motion Design](documentation/MOTION_DESIGN_SYSTEM.md) | Animation system |
| [MongoDB Architecture](documentation/MONGODB_FIREBASE_ARCHITECTURE.md) | Hybrid database design |
| [Migration Guide](documentation/FIREBASE_TO_MONGODB_MIGRATION.md) | Firebase to MongoDB migration |
| [Architecture Audit](documentation/ARCHITECTURE_AUDIT_REPORT.md) | System architecture review |
| [Security Audit](documentation/SECURITY_AUDIT_REPORT.md) | Security assessment |

## 🌐 Deployment

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables for Production

Ensure all environment variables are set in your deployment platform:
- All `PUBLIC_FIREBASE_*` variables
- `FIREBASE_SERVICE_ACCOUNT` (JSON string)
- `MONGODB_URI`
- `RESEND_API_KEY` or email SMTP credentials
- `GEMINI_API_KEY`
- OAuth credentials (if using)

## 🔄 Recent Updates (January 2026)

### Security Hardening
- ✅ CSRF protection with timing-safe validation
- ✅ PBKDF2 iterations increased to 120,000 (OWASP 2023)
- ✅ Comprehensive CSP headers
- ✅ Endpoint-specific rate limiting
- ✅ Secure cookie configuration
- ✅ Input validation and sanitization
- ✅ Production-ready logging utility

### Bug Fixes
- ✅ Fixed Firebase environment variable loading
- ✅ Fixed CSP blocking Firebase Realtime Database
- ✅ Service worker SSL issues in dev mode resolved
- ✅ Database rules updated with proper indexes

## 📄 License

Private project - All rights reserved.

## 🤝 Contributing

This is a private project. Contact the maintainers for contribution guidelines.
