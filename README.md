# PCC Attendance System

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
| Database | Firebase Realtime Database + MongoDB |
| Authentication | Firebase Auth |
| AI | Google Gemini API |
| Email | Nodemailer (Gmail SMTP) |
| Icons | Tabler Icons |
| QR Code | qrcode library |
| Date Handling | date-fns |
| Deployment | Vercel |
| Testing | Vitest + Playwright |

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
│   ├── server/                # Server-side services
│   │   ├── mongodb/           # MongoDB integration
│   │   └── ...                # Firebase admin, email, etc.
│   ├── services/              # Client services
│   ├── stores/                # Svelte stores
│   └── utils/                 # Utility functions
├── routes/
│   ├── app/                   # User application
│   │   ├── dashboard/
│   │   ├── attendance/
│   │   ├── epass/
│   │   ├── analytics/
│   │   ├── gamification/
│   │   ├── history/
│   │   ├── announcements/
│   │   ├── feedback/
│   │   └── profile/
│   ├── admin/                 # Admin panel
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── attendance/
│   │   ├── security/
│   │   ├── reports/
│   │   ├── audit-logs/
│   │   ├── sessions/
│   │   ├── announcements/
│   │   ├── feedback/
│   │   ├── backup/
│   │   ├── ip-settings/
│   │   ├── qa-testing/
│   │   ├── mobile/
│   │   └── settings/
│   ├── api/                   # API endpoints
│   │   ├── ai/chat/
│   │   ├── auth/
│   │   ├── attendance/
│   │   ├── admin/
│   │   ├── announcements/
│   │   ├── face-verification/
│   │   ├── gamification/
│   │   ├── leave-requests/
│   │   ├── notifications/
│   │   ├── oauth/
│   │   ├── session/
│   │   └── users/
│   └── verify-email/
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
- Audit logging for all actions

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
- Export capabilities
- Email report delivery

### 🎨 Design System
- Apple x Enterprise aesthetic
- Glassmorphism effects (GlassPanel component)
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
- Attendance check-in/out
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
- User management
- Attendance management
- Security monitoring
- Custom report builder
- Audit logs viewer
- Session management
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
- Impersonation capability
- Quick actions launcher

### 🔗 Integrations
- OAuth support (Google, Microsoft, etc.)
- Face verification service
- Leave request management
- Holiday service

### ⚡ Performance
- Optimized image loading
- Lazy loading components
- Cache service
- Query optimizer
- Performance monitoring
- API optimization strategies

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- Firebase project
- MongoDB instance (optional, for hybrid storage)
- Google Gemini API key (for AI features)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd es6

# Install dependencies
npm install
```

### Environment Configuration

Create a `.env` file with the required configuration variables for:
- Firebase Client (Public keys)
- Firebase Admin (Service account)
- MongoDB connection (if using hybrid storage)
- Email configuration (SMTP settings)
- Gemini AI API key
- Enterprise security settings

### Development

```bash
# Start development server
npm run dev

# Start with HTTPS disabled (for local testing)
npm run dev:http
```

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

### Data Management Scripts

```bash
# Migrate admins to MongoDB
npm run migrate:admins

# Dry run migration with verbose output
npm run migrate:admins:dry

# Validate data consistency
npm run validate:data

# Validate and fix data issues
npm run validate:data:fix
```

## 📖 Documentation

Detailed documentation available in `/documentation`:
- [Digital ID Verification (E-Pass)](documentation/Digital_ID_Verification_E-Pass_System.md)
- [Hybrid AI Chatbot](documentation/HYBRID_AI_CHATBOT.md)
- [Enterprise Features](documentation/ENTERPRISE_FEATURES.md)
- [Email Verification](documentation/EMAIL_VERIFICATION_SYSTEM.md)
- [OAuth Setup Guide](documentation/OAUTH_SETUP_GUIDE.md)
- [Design System](documentation/Design_System.md)
- [Motion Design System](documentation/MOTION_DESIGN_SYSTEM.md)
- [MongoDB Firebase Architecture](documentation/MONGODB_FIREBASE_ARCHITECTURE.md)
- [Firebase to MongoDB Migration](documentation/FIREBASE_TO_MONGODB_MIGRATION.md)
- [Architecture Audit Report](documentation/ARCHITECTURE_AUDIT_REPORT.md)
- [Backend Architecture Audit](documentation/BACKEND_ARCHITECTURE_AUDIT.md)
- [UI Design System Responsive](documentation/UI_Design_System_Responsive.md)
- [Light Mode Design Guide](documentation/LightModeDesignGuide.md)

## 🌐 Deployment

This project is configured for Vercel deployment:

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

## 📄 License

Private project - All rights reserved.

## 🤝 Contributing

This is a private project. Contact the maintainers for contribution guidelines.
