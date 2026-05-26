# v2 — Stance Health brand refresh

This branch rebases the customer-agent frontend on the **Stance Health brand
guidelines** and introduces a new segmented progress component for the
interview flow. Application logic (WebSocket, audio capture, transcription,
form-state, URL params, localStorage restore) is unchanged — every change is
presentational.

---

## 1. Design system

### 1.1 Color tokens

The palette in `src/index.css` is rewritten to use Stance Health colors.
Token names (shadcn HSL variables) are preserved, so every existing component
picks up the new palette automatically.

| Token | v1 | v2 | Stance name | Hex |
|---|---|---|---|---|
| `--primary` | vibrant green | deep navy | **Steel Blue** | `#132644` |
| `--accent` | warm orange | vibrant lime | **Neon Green** | `#DDFE71` |
| `--background` | light gray | white | **White** | `#FFFFFF` |
| `--foreground` | charcoal | dark grey | **Dark Grey** | `#2F2F32` |
| `--secondary` / `--muted` | gray | smoke | **Light Smoke** | `#ECECEC` |
| `--destructive` | red | sun orange | **Sun** | `#FE7833` |
| `--ring` | green | steel blue | **Steel Blue** | `#132644` |
| `--sidebar-background` | green-tinted dark | navy | **Steel Blue** | `#132644` |
| `--glow` / `--glow-strong` | green | neon green | **Neon Green** | `#DDFE71` |

The full secondary palette is also available as raw Tailwind tokens (see §1.3):
**Cosmic Latte** `#FBF9ED`, **Lava 20** `#F8DBD3`, **Sun** `#FE7833`,
**Purple 20** `#E4DAFC`, **Mint 200** `#203A37`. Per the brand guide, secondary
colors should be used sparingly — never as main floods.

### 1.2 Typography

Two new fonts are loaded via Google Fonts in `src/index.css`:

| Use | Family | Weight |
|---|---|---|
| Display headlines | **Unbounded** | 400–900 |
| Body / UI | **DM Sans** | 300–700 |

- `body` and `html` default to **DM Sans**.
- A `.font-display` utility class applies **Unbounded** + tightened tracking
  for hero headings. Applied to "User Interview" and "Medical Interview"
  headlines.
- Tailwind exposes `font-sans` (DM Sans) and `font-display` (Unbounded).

### 1.3 Raw brand tokens

`tailwind.config.ts` adds a `stance.*` color namespace for direct use when a
component needs a specific brand swatch rather than a semantic token:

```ts
colors.stance.neon    // #DDFE71  Neon Green
colors.stance.stone   // #ADDCEC  Washed Stone
colors.stance.steel   // #132644  Steel Blue
colors.stance.grey    // #2F2F32  Dark Grey
colors.stance.smoke   // #ECECEC  Light Smoke
colors.stance.latte   // #FBF9ED  Cosmic Latte
colors.stance.lava    // #F8DBD3  Lava 20
colors.stance.sun     // #FE7833  Sun
colors.stance.purple  // #E4DAFC  Purple 20
colors.stance.mint    // #203A37  Mint 200
```

Use `bg-stance-neon`, `text-stance-steel`, `border-stance-stone`, etc.

### 1.4 Combination rules

Per the brand guide, valid combinations are:

1. **Two primary + one secondary** — e.g. Neon Green + Steel Blue + Light Smoke
2. **Neutrals + two primary + two secondary** — denser layouts only

The implementation honors rule 1 by default: Steel Blue + Neon Green + Light
Smoke do the heavy lifting; Sun is only invoked for `--destructive` surfaces
(pause / warning). No purple/lava/latte are used unless you reach for them
explicitly.

---

## 2. New components

### 2.1 `SegmentedProgress`

`src/components/voice/SegmentedProgress.tsx`

A pill-shaped progress track inspired by the Stance Health dashboard hero.
One segment per interview section. Replaces the previous flat `<Progress>`
bar in `TranscriptionInterface`.

**Props**

| Prop | Type | Notes |
|---|---|---|
| `steps` | `string[]` | Ordered section labels. One segment per step. |
| `currentStep` | `number` | 1-indexed position of the active step. |
| `stepStatus` | `Array<{ isComplete?: boolean; ... }>` | Optional backend-driven per-step state. Takes precedence over `currentStep`. |
| `overallProgress` | `number` | 0–100. Displayed as the large percentage. |
| `activeLabel` | `string?` | Overrides the resolved step name. |
| `className` | `string?` | — |

**Visual states**

- **Complete** — segment filled in Neon Green with a soft glow shadow.
- **Active** — segment filled at 30% Neon Green with a brighter leading edge
  and a subtle animated sweep.
- **Pending** — segment dim against the track.

The header row mirrors the FormProgressCard convention: shows the
**1-indexed position** (`1/6 sections` when on Present Complaint), not the
completed count. This keeps the top-bar progress consistent with the right
sidebar.

**Caption row**

```
INTERVIEW   Present Complaint                          25%   2/6 sections
```

- Tiny uppercase "INTERVIEW" eyebrow + active section name (DM Sans medium)
- Large percentage in semibold + "X/Y sections" position counter

### 2.2 `voice/` namespace

Created `src/components/voice/` as the home for future voice-specific
presentational components. Today it contains just `SegmentedProgress.tsx`.

---

## 3. Modified files

| File | Change |
|---|---|
| `src/index.css` | Full token rewrite to Stance palette + Google Fonts imports for Unbounded & DM Sans. |
| `tailwind.config.ts` | Added `fontFamily.sans`, `fontFamily.display`, and the `stance.*` color namespace. |
| `src/components/TranscriptionInterface.tsx` | Imported `SegmentedProgress` and replaced the old `<Progress>` + caption block. "User Interview" heading uses `font-display`. Removed unused `Progress` import. |
| `src/components/WaveformAnimation.tsx` | Canvas bars recolored from old green to Neon Green (`hsl(74, 99%, …)`). |
| `src/components/cards/FormProgressCard.tsx` | Added `filledFields` / `totalFields` props so partial-completion ratios can be displayed next to unticked sections. |
| `src/pages/Index.tsx` | "Medical Interview" heading uses `font-display`. Removed the green→orange gradient text wash so it reads as solid Dark Grey. |

The mic-recording-active state intentionally retains the red `bg-red-500`
button — that is a UX signal for "we are recording", not a brand element.

---

## 4. Unchanged

- WebSocket integration (`useWebSocket`)
- Audio capture / streaming (`useVoiceRecorder`)
- Transcription auto-send (2 s debounce, edit detection)
- Interview state machine, section derivation, missing-fields surfaces
- URL parameter handling (`userId` / `formId` / `centerId`)
- localStorage session persistence and resume
- File upload flow and attachment listing
- Pause & continue later flow (`sendEndSession`)
- Form selection / login flow (centers, users, GraphQL queries)

---

## 5. Compatibility notes

- Any component referencing `--primary` now renders **Steel Blue**, not the
  previous green. This includes the Send button, "Connected" status badge,
  SlideButton fill, mic button (idle state), and focus rings.
- Any component referencing `--accent` now renders **Neon Green**.
- `--destructive` is now **Sun orange**, not red. The "Pause & Continue
  Later" destructive button will read warm-orange instead of red.
- `prefers-reduced-motion` is unaffected — the SegmentedProgress sweep uses a
  CSS `animate-pulse` that the existing reduced-motion preset already handles.

---

## 6. Files added

```
CHANGELOG-v2.md
DESIGN.md
src/components/voice/SegmentedProgress.tsx
```

---

## 7. Verification

```bash
npm run build
# ✓ 2244 modules transformed
# ✓ built in ~2.5s — no warnings
```

Local dev:

```bash
npm run dev
# http://localhost:8080
```
