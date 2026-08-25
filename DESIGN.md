# Healthflex — Design System

A voice-first, AI-guided customer onboarding experience. The design language combines the **calm clinical trust** of a premium health brand with the **cinematic, reactive presence** of modern AI assistants (Siri, Apple Intelligence, Lumix.AI, Payocat).

The defining moment of the product is the **listening state** — a living, glowing, breathing UI element that makes the user feel *heard* before they finish their sentence.

---

## 1. Design Principles

1. **Listening is the hero.** The mic, orb, or waveform is never decorative. It always reflects real audio state.
2. **Dark-first, light-supported.** The voice experience lives on a deep, near-black canvas so the teal glow can radiate. Forms and dashboards offer a light mode.
3. **One bright thing at a time.** A single luminous element draws the eye — the orb, the active question, the mic halo. Everything else recedes.
4. **Type is editorial, not corporate.** Big serif headlines, generous tracking, calm cadence.
5. **Motion is breath, not animation.** Eases are slow, organic, looped — never bouncy or playful.
6. **No clinical sterility.** Warm cream in light mode; warm-black (not pure black) in dark mode.

---

## 2. Color System

The palette stays anchored in Healthflex **teal**, but the dark voice canvas is treated as the new primary stage.

### 2.1 Brand

| Token | Hex | Role |
|---|---|---|
| `--brand-700` | `#0F766E` | Primary actions, links |
| `--brand-500` | `#14B8A6` | Hover, gradients |
| `--brand-400` | `#2DD4BF` | Voice glow, halos, particle dots |
| `--brand-300` | `#5EEAD4` | Highest-energy waveform peaks |
| `--coral-400` | `#FB7185` | Warm secondary CTA, error empathy |

### 2.2 Voice canvas (dark mode)

| Token | Hex | Role |
|---|---|---|
| `--canvas` | `#07090C` | App background during voice |
| `--canvas-raised` | `#0F1216` | Modal sheets, top bar |
| `--canvas-pill` | `#1A1D22` | "Listening" pill, chips |
| `--canvas-border` | `#1E2329` | Hairline dividers |
| `--text-hi` | `#F4F5F7` | Active question |
| `--text-mid` | `#9BA1AB` | Inactive transcript |
| `--text-lo` | `#5A6068` | Trailing/ghost text |

### 2.3 Light mode (forms, dashboards, completion)

| Token | Hex | Role |
|---|---|---|
| `--bg` | `#FAFAF7` | Cream page bg |
| `--bg-alt` | `#F5F3EE` | Section bands, AI bubbles |
| `--surface` | `#FFFFFF` | Cards |
| `--border` | `#E5E7EB` | Inputs, cards |
| `--ink` | `#0F172A` | Primary text |
| `--slate` | `#475569` | Body |
| `--muted` | `#94A3B8` | Tertiary |

### 2.4 The Teal Aurora (voice glow gradient)

Inspired by the Apple Intelligence orb (ref. image 3), but recolored to Healthflex teal.

```css
--aurora: radial-gradient(
  circle at 50% 50%,
  #5EEAD4 0%,
  #14B8A6 28%,
  #0F766E 52%,
  #134E4A 72%,
  transparent 88%
);

--aurora-bloom: 0 0 80px 8px rgba(45, 212, 191, 0.45),
                0 0 160px 24px rgba(20, 184, 166, 0.25),
                0 0 240px 40px rgba(15, 118, 110, 0.12);
```

### 2.5 Semantic

| Role | Hex | Tint (light) |
|---|---|---|
| Success | `#10B981` | `#ECFDF5` |
| Warning | `#F59E0B` | `#FFFBEB` |
| Error | `#EF4444` | `#FEF2F2` |

---

## 3. Typography

| Use | Family | Weight | Size / leading |
|---|---|---|---|
| Hero question (voice screen) | **Instrument Serif** | 400 | 36–44px / 1.15 |
| Section headers | **Fraunces** or Instrument Serif | 500 | 28px / 1.2 |
| Body, UI | **Inter** (or **Geist Sans**) | 400/500 | 15–16px / 1.6 |
| Pills, labels | **Inter** | 500 | 13px / 1, +1% tracking |
| Transcript (live) | **Inter** | 400 | 18px / 1.4, italic optional |
| Extracted values | **JetBrains Mono** | 500 | 13px |

**The "trailing transcript" effect** (ref. image 2 — "What *does the scene look like, and*"): the just-spoken words appear in `--text-hi`, words further back fade to `--text-mid`, and partially-recognized trailing words sit in `--text-lo`. Use a soft 600ms fade between tiers.

---

## 4. Reactive Voice Elements — the core of the system

Three distinct reactive components, each used in a different context. All are **canvas-rendered** (HTML5 `<canvas>` or WebGL) for smooth 60fps and real audio responsiveness.

### 4.1 The Aurora Orb (primary, hero contexts)

> Inspired by ref. image 3 (Apple Intelligence). Used on the landing screen, the welcome moment, and between questions.

**Visuals:**
- A floating 3D-looking sphere, ~180–220px diameter
- Built from layered radial gradients of `--brand-300 → --brand-700` (see `--aurora`)
- A specular highlight from upper-left at ~30° (white, 18% opacity, gaussian-blurred)
- A darker teal "shadow side" on the lower-right (`#134E4A` at 40%)
- An outer bloom (`--aurora-bloom`) that pulses with breath
- A subtle flowing internal "current" — two intersecting cubic curves traced in `--brand-300` at 35% opacity, rotating slowly (8s loop)

**States:**
| State | Behavior |
|---|---|
| Idle | Slow breathing scale 1.00 → 1.04 → 1.00 over 4s; bloom dims to 60% |
| Listening | Bloom intensifies to 110%; internal currents speed up to 3s loop; tiny inner core brightens proportionally to mic amplitude |
| Thinking | Currents flow faster (1.5s loop), bloom shifts hue toward `#5EEAD4` |
| Speaking (AI reply) | Orb gently bobs 6px vertically in sync with TTS amplitude |
| Error | Bloom desaturates to slate gray, orb stops rotating for 600ms, then resumes |

**Implementation note:** Render two stacked `<canvas>` layers — back layer for the bloom (blur filter applied), front layer for the orb surface. Update with `requestAnimationFrame`, drive amplitude input from `AnalyserNode.getByteFrequencyData()` averaged over 8 low-frequency bins.

### 4.2 The Particle Ring (mid-priority, "constellation" listening)

> Inspired by ref. image 2 (Lumix.AI). Used inside the form flow at the top of each question, as a quieter ambient indicator.

**Visuals:**
- 96–120 small dots (1.5px) arranged in a perfect ring, ~140px diameter
- Color: `--brand-400` at 80% opacity, with random per-dot brightness variance ±20%
- Each dot has a tiny independent radial offset (±4px) so the ring looks organic, not mechanical
- Inner ring subtly visible (50 dots at 30% opacity) for depth

**States:**
| State | Behavior |
|---|---|
| Idle | Slow clockwise rotation, 24s/full revolution; gentle individual twinkle (each dot oscillates opacity 60–100% on its own 1.5–3s cycle) |
| Listening | Ring "inhales" — dots pull inward by 8px on speech onset, expand back out on silence; amplitude modulates outward push up to 24px |
| Reacting to peak | Dots facing the audio "source" (top of ring) brighten to `--brand-300`, ripple cascades around the ring in 800ms |
| Loading / thinking | Ring rotates faster (6s/rev), individual dots flicker more rapidly |

**Implementation:** Single `<canvas>`, particles stored as `{angle, radiusOffset, brightness, phase}` array, updated each frame.

### 4.3 The Mic Halo Button (action element, ref. image 1)

> Inspired by ref. image 1 (Payocat). The tappable mic button that anchors the bottom of every voice screen.

**Visuals:**
- 72px circular button, centered
- Background: radial gradient `--brand-700 → --brand-500` (40% to 100% radius)
- Glyph: white microphone icon, 24px
- Outer halo: 3 concentric radial glows, total reach 180px, using `--aurora-bloom`
- Below the button: a soft warm "floor reflection" — a horizontally-stretched radial gradient that fades into the canvas (ref. image 1 shows this beautifully)

**States:**
| State | Behavior |
|---|---|
| Idle | Halo at 50% intensity, button at full color, micro-pulse at 4s breathing |
| Hover | Halo brightens to 80%, scale 1.04, cursor pointer |
| Pressing (active) | Halo expands by 30%, button scales 0.96, inner color brightens, **screen dims around it by 8%** to focus attention |
| Listening | Halo pulses in sync with mic amplitude — radius modulates ±20%, intensity ±30% — creating the "glowing orb floating in space" effect from ref. image 1 |
| Disabled | Desaturate to slate, halo removed, opacity 50% |

**Critical detail:** the halo must use `mix-blend-mode: screen` (or `lighter` on canvas) so it visually blooms against the dark canvas rather than feeling like a flat circle.

### 4.4 The Listening Pill (status chip, ref. image 1)

A small pill at the top of voice screens that confirms the mic is live.

```
[ Listening • ]
```

- Background: `--canvas-pill`
- Text: `--text-hi`, 13px Inter Medium
- The `•` is a 6px dot in `--brand-400` that pulses (opacity 40% → 100% → 40%, 1.2s loop)
- Padding: 8px 14px, border-radius 999px
- Sits ~24px below the top bar, horizontally centered

### 4.5 The Ask-Anything Pill (text fallback, ref. image 3)

Bottom-pinned text-input pill for users who'd rather type.

- 92% screen width, 56px tall, border-radius 999px
- Background: linear gradient from `rgba(15,118,110,0.15)` to `rgba(20,184,166,0.10)` over a frosted blur (`backdrop-filter: blur(20px)`)
- Subtle 1px inner border `rgba(94,234,212,0.20)`
- Left: placeholder "Ask anything…" in `--text-mid`
- Right: 16px mini-waveform icon in `--brand-400` (4 bars, animated when focused)
- Glowing under-shadow `0 24px 60px -20px rgba(20,184,166,0.4)` to lift it off the canvas

---

## 5. Layout & Screens

### 5.1 Voice Screen (the hero — landing, between-questions, deep prompts)

```
┌──────────────────────────────────────┐
│  ‹      Healthflex •         👤      │   ← top bar, 56px
│                                      │
│           [ Listening • ]            │   ← pill (4.4)
│                                      │
│                                      │
│         I don't understand           │   ← question, Instrument Serif 40px
│         how to make                  │      lines fade-in from bottom
│         a transaction…               │
│                                      │
│         ─────────────                │   ← hairline divider, --canvas-border
│                                      │
│                ⊙                     │   ← Mic Halo (4.3), 72px
│             (glowing)                │      with floor reflection
│                                      │
└──────────────────────────────────────┘
```

- Canvas: `--canvas` (`#07090C`)
- All elements vertically centered with generous breathing room
- The orb (4.1) replaces the question on the welcome screen (ref. image 3 layout)

### 5.2 Form Screen (the working surface)

Three-column layout on desktop:

| Left rail (240px) | Center (flex) | Right rail (320px) |
|---|---|---|
| Sections + progress ticks | Conversation + active question + mic dock | Extracted values, confidence bars |

- **Light mode by default** for forms — easier on the eyes during long sessions
- **Dark voice overlay** slides up from the bottom when the user taps the mic, taking over the full screen with the voice canvas
- This overlay is the moment of focus — the form disappears, only the orb (4.1) or particle ring (4.2) and the question remain

### 5.3 Completion Screen

- Light cream `--bg`
- Centered serif headline "You're all set."
- Subtle teal checkmark (drawn-stroke animation, 800ms)
- Two buttons: outline secondary + filled primary
- A tiny aurora orb (4.1, scaled to 64px) sits above the headline, now at peaceful idle

---

## 6. Motion Specification

| Property | Value |
|---|---|
| **Default ease** | `cubic-bezier(0.22, 1, 0.36, 1)` |
| **Breath cycle** | 4000ms, sine wave, scale 1.00 ↔ 1.04 |
| **Aurora rotation** | 8000ms linear, infinite |
| **Particle ring rotation** | 24000ms linear, idle / 6000ms thinking |
| **Halo pulse (idle)** | 4000ms, opacity 50% ↔ 80% |
| **Halo pulse (listening)** | Driven by audio amplitude, no fixed duration |
| **Page transitions** | 320ms fade + 8px upward translate |
| **Question swap** | Old question fades down + out (240ms), new question fades up + in (320ms), 80ms overlap |
| **Reduced motion** | Replace all loops with a single static glow; the listening dot still pulses (accessibility-safe at 1.2s) |

---

## 7. Component Reference

| Component | File | Notes |
|---|---|---|
| `AuroraOrb` | `src/components/voice/AuroraOrb.tsx` | Canvas-based, amplitude prop |
| `ParticleRing` | `src/components/voice/ParticleRing.tsx` | Canvas-based, amplitude prop |
| `MicHalo` | `src/components/voice/MicHalo.tsx` | Wraps button, listens via Web Audio API |
| `ListeningPill` | `src/components/voice/ListeningPill.tsx` | Stateful chip |
| `AskAnythingPill` | `src/components/voice/AskAnythingPill.tsx` | Glass input with waveform icon |
| `TranscriptStream` | `src/components/voice/TranscriptStream.tsx` | Three-tier opacity fade |
| `QuestionDisplay` | `src/components/voice/QuestionDisplay.tsx` | Serif typography, slide transitions |
| `SectionRail` | `src/components/form/SectionRail.tsx` | Left sidebar, progress ticks |
| `ContextPanel` | `src/components/form/ContextPanel.tsx` | Right panel, extracted values |
| `SlideButton` | `src/components/SlideButton.tsx` | Existing — restyle to teal aurora |
| `WaveformAnimation` | `src/components/WaveformAnimation.tsx` | Existing — re-color to `--brand-400` |

---

## 8. Accessibility

- All reactive voice elements have a **silent, static equivalent** under `prefers-reduced-motion`
- Mic must be operable via keyboard (Space to toggle) and screen reader (`aria-live="polite"` on transcript)
- Question text maintains AA contrast (`--text-hi` on `--canvas` = 16.5:1)
- The teal glow is decorative; never the only signal — always paired with text ("Listening", "Thinking", "Ready")
- A text-input fallback (4.5) is **always** available, never hidden behind a mode toggle

---

## 9. Don'ts

- No pure black (`#000`) — always warm-black `#07090C`
- No emoji glyphs in voice UI (the cat/avatar icons in ref. images 1 & 2 are out)
- No bouncy springs, no scale > 1.06, no rotational easing on UI chrome
- No multiple reactive elements visible at once — one orb OR one ring OR one mic, never two
- No purple/blue gradients — Healthflex is teal; the Apple-blue orb (ref. image 3) is inspiration, not template
- No flat material-design shadows on the voice canvas — only radial blooms

---

## 10. Inspirations & references

- **Apple Intelligence / Siri orb** — for the 3D aurora sphere and ask-anything pill
- **Lumix.AI** — for the particle constellation ring
- **Payocat** — for the warm glowing mic with floor reflection and the "Listening" pill
- **Healthflex teal** — the through-line that ties it back to brand

The result: a voice agent that feels like Siri's grace, Lumix's mystery, and Payocat's warmth — wearing Healthflex's coat.
