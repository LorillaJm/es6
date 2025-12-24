# PCC Attendance System

A modern, enterprise-grade attendance management system built with SvelteKit 2, Firebase, and AI-powered features. Designed for educational institutions and organizations requiring secure, intelligent attendance tracking.

## 🎯 Overview

This system provides a complete digital attendance solution featuring:
- QR-based Digital ID (E-Pass) verification
- AI-powered hybrid chatbot assistant
- Real-time attendance tracking with offline support
- Enterprise security with geofencing and behavior analysis
- Gamification and engagement features
- Comprehensive admin dashboard

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | SvelteKit 2 (Svelte 5) |
| Styling | Tailwind CSS 4 |
| Database | Firebase Realtime Database |
| Authentication | Firebase Auth |
| AI | Google Gemini API |
| Email | Nodemailer (Gmail SMTP) |
| Deployment | Vercel |
| Testing | Vitest + Playwright |

## 📁 Project Structure

```
src/
├── lib/
│   ├── ai/                    # AI engines
│   │   ├── hybridEngine.js    # Core AI chatbot engine
│   │   ├── behaviorAnalysis.js # Anomaly detection
│   │   ├── predictiveInsights.js
│   │   ├── sentimentAnalyzer.js
│   │   └── smartRecommendations.js
│   ├── components/            # Svelte components
│   │   ├── HybridChatbot.svelte
│   │   ├── AI3DAssistant.svelte
│   │   ├── SecurityDashboard.svelte
│   │   ├── GeofenceConfig.svelte
│   │   └── ...
│   ├── security/              # Security modules
│   │   ├── deviceFingerprint.js
│   │   ├── geofence.js
│   │   ├── sessionManager.js
│   │   └── qrCodeSecurity.js
│   ├── server/                # Server-side services
│   │   ├── firebase-admin.js
│   │   ├── emailService.js
│   │   ├── emailVerificationService.js
│   │   └── faceRecognitionService.js
│   ├── services/              # Client services
│   │   ├── geminiService.js
│   │   ├── chatbotService.js
│   │   └── oauth.js
│   ├── stores/                # Svelte stores
│   ├── offline/               # Offline support
│   ├── realtime/              # Live sync engine
│   └── firebase.js            # Firebase client config
├── routes/
│   ├── app/                   # User application
│   │   ├── dashboard/
│   │   ├── attendance/
│   │   ├── epass/             # Digital ID
│   │   ├── analytics/
│   │   ├── gamification/
│   │   └── profile/
│   ├── admin/                 # Admin panel
│   │   ├── dashboard/
│   │   ├── users/
│   │   ├── attendance/
│   │   ├── security/
│   │   ├── reports/
│   │   └── settings/
│   └── api/                   # API endpoints
│       ├── ai/chat/
│       ├── auth/verify-email/
│       ├── oauth/
│       └── admin/
└── documentation/             # Feature documentation
```

## ✨ Key Features

### 🔐 Digital ID Verification (E-Pass)
- Cryptographically signed QR codes
- Time-limited tokens (auto-expire & regenerate)
- Device fingerprint binding
- Real-time cloud validation
- Anti-fraud protection (screenshot detection)

### 🤖 Hybrid AI Chatbot
- Three-layer intelligence (Intent Detection → Role-Based Access → AI Reasoning)
- 3D animated assistant with state-reactive animations
- Voice input/output support
- Context memory (10 messages)
- Predictive insights and pattern detection
- Role-based responses (User/Admin)

### 🛡️ Enterprise Security
- Zero-trust device fingerprinting
- Smart geofencing with multiple zones
- AI behavior analysis and anomaly detection
- Session management with auto-expiration
- IP restriction capabilities
- Audit logging

### 📴 Offline Support
- IndexedDB queue for offline actions
- Automatic sync when connection restored
- Exponential backoff retry
- Visual indicators for pending actions

### 🎮 Gamification
- Points and achievements system
- Attendance streaks
- Leaderboards
- Badges and rewards

### 📧 Email Verification
- 6-digit OTP verification
- SHA-256 hashed storage
- Rate limiting and cooldowns
- Professional email templates

### 🔗 OAuth Integrations
- Google Calendar
- Microsoft Teams/Calendar
- Slack
- Zoom

### 📊 Reports & Analytics
- Custom report builder
- Work habit analysis
- Attendance trends
- Export to PDF/Excel

### 🎨 Design System
- Apple x Enterprise aesthetic
- Glassmorphism effects
- Dark/Light mode
- Seasonal themes (Christmas, Halloween, etc.)
- Responsive design

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm
- Firebase project
- Google Gemini API key (for AI features)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd es6

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Environment Configuration

Create a `.env` file with the following variables:

```env
# Firebase Client (Public)
PUBLIC_FIREBASE_API_KEY=your-api-key
PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
PUBLIC_FIREBASE_DATABASE_URL=https://your-project.firebasedatabase.app
PUBLIC_FIREBASE_PROJECT_ID=your-project-id
PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
PUBLIC_FIREBASE_APP_ID=your-app-id

# Firebase Admin (Private)
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}

# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=Attendance System <your-email@gmail.com>

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key

# Enterprise Security (Optional)
PUBLIC_GEOFENCE_ENABLED=true
PUBLIC_AI_ANALYSIS_ENABLED=true
PUBLIC_SESSION_TIMEOUT_HOURS=8
```

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

## 📱 User Features

| Feature | Description |
|---------|-------------|
| Dashboard | Overview of attendance status, stats, and quick actions |
| Attendance | Check-in/out with QR scan or manual entry |
| E-Pass | Digital ID with animated QR code |
| History | View attendance records with filters |
| Analytics | Personal attendance insights and trends |
| Gamification | Points, badges, and leaderboard |
| Profile | Account settings and preferences |
| Announcements | View organization announcements |
| Feedback | Submit feedback and suggestions |

## 👨‍💼 Admin Features

| Feature | Description |
|---------|-------------|
| Dashboard | Real-time overview with analytics |
| User Management | Add, edit, deactivate users |
| Attendance | View and manage all attendance records |
| Reports | Generate custom reports |
| Security | Monitor anomalies, manage sessions |
| Audit Logs | Track all system activities |
| Announcements | Create and manage announcements |
| Settings | Configure system settings |
| Backup | Database backup management |
| IP Settings | Configure IP restrictions |

## 🔒 Security Features

- Device fingerprinting for identity verification
- Geofence validation before attendance
- AI-powered anomaly detection
- Session binding to devices
- Rate limiting on all endpoints
- Audit trail for all actions
- Role-based access control

## 📖 Documentation

Detailed documentation available in `/documentation`:
- [Digital ID Verification (E-Pass)](documentation/Digital_ID_Verification_E-Pass_System.md)
- [Hybrid AI Chatbot](documentation/HYBRID_AI_CHATBOT.md)
- [Enterprise Features](documentation/ENTERPRISE_FEATURES.md)
- [Email Verification](documentation/EMAIL_VERIFICATION_SYSTEM.md)
- [OAuth Setup Guide](documentation/OAUTH_SETUP_GUIDE.md)
- [Design System](documentation/Design_System.md)
- [Motion Design System](documentation/MOTION_DESIGN_SYSTEM.md)

## 🌐 Deployment

This project is configured for Vercel deployment:

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

## 📄 License

Private project - All rights reserved.

## 🤝 Contributing

This is a private project. Contact the maintainers for contribution guidelines.
