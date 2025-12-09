# Apple x Enterprise UI Modern Design System (Complete Guide)

## 1️⃣ Color Palette (Premium & Minimal – Apple Style)
Use a soft, cool-neutral palette + one accent color for actions.

### Primary Colors
- **#0A0A0A** – Pure Black (Apple-style text + titles)
- **#1C1C1E** – Charcoal (Sidebars, headers)
- **#F5F5F7** – Apple Light Gray Background
- **#FFFFFF** – Pure White Cards

### Accent Colors (Choose ONE)
- **Blue #007AFF** (Recommended)
- **Green #34C759**
- **Purple #AF52DE**
- **Teal #5AC8FA**

---

## 2️⃣ Typography (Apple-grade clean)
- Headings: **SF Pro Display / Inter – Bold**
- Body: **SF Pro Text / Inter – Regular**

### Font Sizes
- H1: 36px
- H2: 28px
- H3: 22px
- Body Large: 16px
- Body Small: 14px

---

## 3️⃣ Card & Container Design
- Rounded corners: 18–22px
- Background: White or Charcoal
- Shadow: `0 6px 20px rgba(0,0,0,0.08)`
- Padding: 24px

**Hover Animation**
- Scale: 1.01
- Shadow expands softly

---

## 4️⃣ Buttons (Enterprise-ready)
### Primary
- Blue (#007AFF)
- White text
- 12px radius
- 48px height

### Secondary (Ghost)
- 1px border #D1D1D6
- Transparent
- Black text

---

## 5️⃣ Layout Style (Apple minimal)
- Top bar: 72px height
- Sidebar: 250px width
- Page padding: 40px

Use:
✔ White space  
✔ Large typography  
✔ Thin icons  
✔ Minimal distractions  

---

## 6️⃣ Dashboard UI (Apple x Enterprise Mix)
### Analytics Cards
- Large stats in black
- Light gray labels
- Mini accent icon

### Attendance Table
- Rounded table
- Thin lines (#E5E5EA)
- Row hover highlight
- Optional glass header

---

## 7️⃣ Apple Glass Effect Example
```
backdrop-filter: blur(14px);
background: rgba(255, 255, 255, 0.7);
```

---

## 8️⃣ Icon Style
- Feather / Heroicons (thin stroke)
- Gray icons (#8E8E93)
- Accent only when active

---

## 9️⃣ Animations (Apple smooth)
- Page load: fade-up, 150ms
- Buttons: scale 1.03, 120ms spring
- Tabs: sliding underline, microfade

---

## 🔟 Themes
### Light Mode
- Background #F5F5F7
- White cards
- Blue accent

### Dark Mode
- Black → Charcoal gradient
- Glass blur
- Neon blue accents


---

## 1️⃣1️⃣ Seasonal Dynamic Themes (Premium Feature)

A world-class feature used by Apple, Google, Discord, Steam, and other top global apps. The system automatically activates holiday-themed UI decorations to make the app feel alive, premium, and engaging.

### How It Works
- System checks the current date automatically
- If it matches a holiday period, special animations, icons, and graphics activate
- After the holiday ends, the theme automatically disappears
- Users can manually enable/disable seasonal mode in Profile → Seasonal tab

### Supported Holidays

| Holiday | Period | Effects |
|---------|--------|---------|
| 🎄 Christmas | Dec 1 – Dec 31 | Snowfall, Santa hat on avatar, festive borders |
| 🎃 Halloween | Oct 25 – Nov 1 | Ghosts, fog, pumpkin decorations |
| 🎆 New Year | Jan 1 – Jan 7 | Confetti, fireworks, gold accents |
| ❤️ Valentine's | Feb 10 – Feb 14 | Floating hearts, pink accents |
| 🇵🇭 Independence Day (PH) | June 12 | Philippine flag colors, stars |
| 🌙 Eid | Varies | Crescent moon, gold geometric patterns |

### Design Principles (Apple-Quality)
- **Subtle animations** – No cheap confetti spam, elegant and smooth
- **Blur and opacity** – Soft, clean, glass, glowing edges
- **Transparent elements** – PNG elements with gentle motion
- **Graceful fallback** – Instant return to normal when disabled

### User Preferences
Located in Profile → Seasonal tab:
- **Enable/Disable** – Toggle seasonal themes on/off
- **Intensity Levels**:
  - Minimal: Subtle effects only
  - Standard: Balanced decorations (default)
  - Full: All effects enabled
- **Festive Sounds** – Optional holiday notification tones
- **Preview Themes** – Test any holiday theme manually

### Components
- `SeasonalEffects` – Canvas-based particle animations
- `SeasonalDecorations` – Corner emojis, banners, glowing orbs
- `SeasonalProfileBadge` – Avatar with holiday hat/frame
- `SeasonalCard` – Cards with festive gradient borders
- `SeasonalLoginCelebration` – Welcome popup on login during holidays
- `SeasonalSettings` – User preference controls

### CSS Variables
```css
--seasonal-primary: #C41E3A;    /* Holiday primary color */
--seasonal-secondary: #228B22;  /* Holiday secondary color */
--seasonal-accent: #FFD700;     /* Holiday accent color */
--seasonal-glow: rgba(196, 30, 58, 0.3);  /* Glow effect */
```

### Accessibility
- Respects `prefers-reduced-motion` – Disables animations automatically
- All decorations are `aria-hidden` and non-interactive
- Canvas effects use `pointer-events: none`
