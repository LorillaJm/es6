# Apple WWDC-Quality Motion Design System

A comprehensive motion design system for the Student Attendance application, designed to meet Apple's Human Interface Guidelines and deliver a premium user experience.

## Motion Philosophy

1. **Motion guides attention, never distracts** - Every animation has a purpose
2. **Slower is better than faster** - Perceived quality comes from deliberate motion
3. **Motion should feel "alive" but calm** - Organic, breathing animations
4. **Respect user preferences** - Full support for `prefers-reduced-motion`

---

## Timing Constants

| Token | Duration | Use Case |
|-------|----------|----------|
| `INSTANT` | 100ms | Micro-interactions, button press feedback |
| `QUICK` | 150ms | Hover states, toggles |
| `FAST` | 200ms | Standard interactions |
| `NORMAL` | 300ms | Default transitions |
| `MODERATE` | 400ms | Page transitions, modals |
| `SLOW` | 500ms | Deliberate reveals |
| `GENTLE` | 600ms | Dramatic entrances |
| `DRAMATIC` | 800ms | Hero animations |
| `CINEMATIC` | 1000ms | Splash screens, celebrations |

---

## Easing Curves

### Standard Apple Curves
```css
--ease-apple: cubic-bezier(0.25, 0.1, 0.25, 1);
--ease-apple-in: cubic-bezier(0.42, 0, 1, 1);
--ease-apple-out: cubic-bezier(0, 0, 0.58, 1);
```

### Premium Curves
```css
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275);      /* Bouncy entrance */
--ease-spring-gentle: cubic-bezier(0.34, 1.56, 0.64, 1);    /* Subtle overshoot */
--ease-decelerate: cubic-bezier(0, 0, 0.2, 1);              /* Smooth landing */
--ease-accelerate: cubic-bezier(0.4, 0, 1, 1);              /* Quick exit */
--ease-breathe: cubic-bezier(0.37, 0, 0.63, 1);             /* Organic pulse */
```

---

## Component Animations

### 1. AI Assistant Orb (`AI3DAssistant.svelte`)

**States & Behaviors:**

| State | Breathing | Glow | Particles | Special Effect |
|-------|-----------|------|-----------|----------------|
| `IDLE` | Slow, 4% scale | 1.0x | Gentle orbit | Floating motion |
| `LISTENING` | Fast, 8% scale | 1.3x | Pulsing | Sound wave rings |
| `THINKING` | Medium, 3% scale | 1.5x | Spiral | Rotating arcs |
| `RESPONDING` | Medium, 6% scale | 1.2x | Wave | Audio bars |
| `ERROR` | Minimal, 1.5% scale | 0.7x | Shake | Warning icon |
| `SUCCESS` | Fast, 10% scale | 1.6x | Burst | Checkmark + particles |

**Timing:**
- Breath cycle: 3000ms (idle), 1200ms (listening)
- State transition: 300ms with smooth interpolation
- Particle smoothing: 60-100ms individual variation

### 2. Attendance Confirmation (`AttendanceConfirmation.svelte`)

**Animation Sequence:**
```
0ms     → Ring starts drawing
300ms   → Content fades in
450ms   → Checkmark draws
600ms   → Particle burst + haptic
800ms   → Time display scales in
1100ms  → Message fades in
3000ms  → Complete callback
```

**Particle System:**
- 40 particles with physics simulation
- Gravity: 0.08-0.12
- Friction: 0.96-0.98
- Shapes: circles and stars
- Colors: Green (check-in) / Orange (check-out)

### 3. Page Transitions (`PageTransition.svelte`)

**Variants:**
- `default` - Slide up with fade (400ms)
- `slide` - Longer slide (500ms)
- `fade` - Simple opacity (300ms)
- `scale` - Scale with fade (400ms)
- `none` - Instant (0ms)

**Stagger Delays:**
```
Child 1: 0ms
Child 2: 50ms
Child 3: 100ms
Child 4: 150ms
...
Child 8: 350ms
```

### 4. Splash Screen (`SplashScreen.svelte`)

**Animation Timeline:**
```
150ms   → Logo entrance (spring scale)
500ms   → App name character reveal
800ms   → Tagline fade in
1000ms  → Progress bar appears
1100ms  → Progress animation starts
2800ms  → Fade out begins
3300ms  → Complete callback
```

**Logo Animation:**
- Scale: 0 → 1 with elastic overshoot
- Rotation: -10° → 0°
- Glow pulse: 3s infinite cycle

---

## CSS Classes

### Page Animations
```css
.page-enter-premium    /* Full page entrance */
.content-reveal        /* Staggered content */
.content-reveal-1..6   /* Delay variants */
```

### Card Interactions
```css
.card-premium          /* Hover lift + shadow */
.btn-premium           /* Button press effect */
```

### Celebrations
```css
.success-pop           /* Scale bounce */
.check-animated        /* SVG checkmark draw */
.ring-animated         /* Circle progress */
.particle              /* Burst particle */
```

### Loading States
```css
.shimmer-premium       /* Enhanced skeleton */
.thinking-spin         /* Rotation spinner */
.pulse-glow            /* Attention glow */
```

### Modals & Toasts
```css
.modal-enter           /* Scale + fade in */
.modal-exit            /* Scale + fade out */
.backdrop-fade         /* Blur backdrop */
.toast-enter           /* Slide down */
.toast-exit            /* Slide up */
```

---

## Usage Examples

### Basic Page with Transitions
```svelte
<script>
  import PageTransition from '$lib/components/PageTransition.svelte';
</script>

<PageTransition variant="default" stagger={true}>
  <header class="content-reveal">...</header>
  <main class="content-reveal">...</main>
  <footer class="content-reveal">...</footer>
</PageTransition>
```

### Attendance Confirmation
```svelte
<script>
  import AttendanceConfirmation from '$lib/components/AttendanceConfirmation.svelte';
  
  let showConfirmation = false;
  
  function handleCheckIn() {
    showConfirmation = true;
  }
</script>

<AttendanceConfirmation 
  show={showConfirmation}
  type="check-in"
  time="9:00 AM"
  onComplete={() => showConfirmation = false}
/>
```

### AI Assistant States
```svelte
<script>
  import AI3DAssistant from '$lib/components/AI3DAssistant.svelte';
  import { AI_STATES } from '$lib/ai/hybridEngine';
  
  let aiState = AI_STATES.IDLE;
</script>

<AI3DAssistant 
  state={aiState}
  size={80}
  position="inline"
  interactive={true}
/>
```

---

## Performance Considerations

1. **GPU Acceleration** - All transforms use `translateZ(0)` or `will-change`
2. **Reduced Motion** - Full support via `prefers-reduced-motion: reduce`
3. **Canvas Optimization** - Particle systems use requestAnimationFrame
4. **Lazy Animation** - Animations only run when visible
5. **Smooth Interpolation** - Linear interpolation prevents jank

---

## Accessibility

- All animations respect `prefers-reduced-motion`
- Focus states are visible and animated
- Haptic feedback syncs with visual cues
- Screen readers announce state changes
- Keyboard navigation fully supported

---

## Files

| File | Purpose |
|------|---------|
| `src/lib/motion/motionSystem.js` | Core timing, easing, utilities |
| `src/lib/components/AI3DAssistant.svelte` | AI orb with state animations |
| `src/lib/components/AttendanceConfirmation.svelte` | Check-in/out celebration |
| `src/lib/components/PageTransition.svelte` | Route transition wrapper |
| `src/lib/components/SplashScreen.svelte` | App intro animation |
| `src/app.css` | Global animation classes |
