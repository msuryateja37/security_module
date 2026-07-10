# Handoff: DLRRD Security Services Portal — Restyle (Classic variant)

## Overview
A visual redesign of the CD: Security Services Portal (Department of Rural Development & Land Reform, RSA) covering: **Login**, **Dashboard (Classic variant)**, **Track My Incidents**, and the **Submit Reports multi-step form** (DLRRD Standard 3-step wizard + NOC Initial Notification variant).

## ⚠️ How to use this package (read first)

**This is a RESTYLE, not a rebuild.**

- The target application already exists and is nearly complete. **Do NOT replace, rewrite, or restructure its components, routes, state, or data layer.**
- Apply ONLY the visual styling, layout, interaction states, and animations documented here to the **existing** components.
- **All data must continue to come from the application's own data sources** (APIs, stores, props). The numbers/case records in the design file are sample data for preview only — never hard-code them.
- Work screen by screen. Screens not covered here (AI Assistant, Policy Hub, other roles' views) should reuse the same design tokens and component styles for consistency, keeping their current structure.

Suggested Claude Code prompt:
> "Apply the design specs in design_handoff_security_portal/README.md to my existing screens. Keep all logic, routing, and data fetching exactly as-is — only update styling, layout, and interaction states. Use my app's real data everywhere."

## About the Design Files
`Security Portal.dc.html` is a **design reference created in HTML** — a prototype showing intended look and behavior, not production code to copy. Recreate its styling in the target codebase's existing environment (framework, CSS approach) using its established patterns. All styles in the file are **inline**, so any element can be inspected for exact values.

## Fidelity
**High-fidelity.** Colors, typography, spacing, radii, shadows and interaction states are final. Recreate pixel-perfectly with the codebase's existing libraries.

## Design Tokens

### Colors
| Token | Hex | Use |
|---|---|---|
| green-950 | `#031E16` | Login bg gradient edge |
| green-900 | `#052E22` | Sidebar gradient top, dark text on mint |
| green-850 | `#063A2C` | Sidebar gradient bottom, header bands, primary button gradient end |
| green-800 | `#0B4635` | Primary buttons, active chips, headings accent, bar gradient end |
| green-700 | `#0E5A43` | Hero band gradient end (Executive) |
| green-600 | `#157A5B` | Links, chart line, icons, donut seg |
| mint-500 | `#2FB98A` | Accent: active nav, focus rings, bar gradient start, CTA |
| mint-300 | `#7EDDB9` | Sidebar icons, logout text |
| mint-200 | `#8FD4BA` | Subtitles on dark green |
| gold | `#C89B3C` | Crest ring, "Secret" classification |
| rust | `#B4432D` / `#C2543B` | "Top Secret", escalated/unassigned, required asterisks |
| ink | `#13241D` | Primary text |
| ink-600 | `#3E4E46` | Secondary text |
| ink-400 | `#5B6B63` / `#7C8B84` | Muted text, labels |
| ink-300 | `#8A978F` / `#9AA8A1` | Placeholder, disabled |
| border | `#E3EAE6` | Card & input borders (inputs: `#D4DED9`) |
| surface | `#FFFFFF` | Cards |
| bg | `#F2F5F3` | Page background |
| bg-subtle | `#F6F9F7` | Table headers, readonly inputs, insets |
| hover-row | `#F6FBF8` | Table row hover |

Status chips (bg / text):
- UNDER REVIEW / UNDER INVESTIGATION: `#FDF3D7` / `#8A6A16`
- SUBMITTED: `#E8EDF2` / `#3F5364`
- OPEN: `#FDE3DC` / `#9C3B24`
- ESCALATED: `#FBDAD3` / `#A83A22`
- APPROVED / RESOLVED: `#DDF5E8` / `#136B4A`

Chart series:
- Donut (loss by classification): Unclassified `#2FB98A`, Restricted `#157A5B`, Confidential `#0B4635`, Secret `#C89B3C`, Top Secret `#B4432D`
- Status distribution: Resolved `#2FB98A`, Under Review `#D6A331`, Submitted `#64748B`, Under Investigation `#157A5B`, Escalated `#C2543B`
- Bars: vertical gradient `#2FB98A → #0B4635`

### Typography
Font: **Public Sans** (Google Fonts), weights 400/500/600/700/800. Fallback: system-ui, sans-serif.
- Page title (topbar): 19px / 800
- Card titles: 16px / 800; section headers in forms: 17px / 800
- KPI number: 32px / 800, color green-800
- Body/table: 13–13.5px; labels 12.5px / 700
- Overline labels (table headers, kickers): 10.5–11px / 700, letter-spacing .08–.14em, uppercase
- Chips: 10.5px / 800, letter-spacing .04em

### Spacing & Shape
- Card radius 13–14px; buttons/inputs 9–10px; chips pill (18–20px)
- Card border 1px `#E3EAE6`; content padding 22–28px; grid gaps 14–24px
- Page gutter 28px, max content width 1480px centered
- Shadows: cards rely on borders (flat); elevation only on hover/CTAs, e.g. `0 12px 28px rgba(6,58,44,.12)`

## Screens / Views

### 1. Login
- Full viewport, bg: `radial-gradient(1200px 800px at 50% 20%, #0A4A37, #052E22 55%, #031E16)`
- Centered card 500px, radius 16px, shadow `0 30px 80px rgba(0,0,0,.45)`
- Header band: gradient `160deg #063A2C→#052E22`, bottom border 3px mint, white 72px logo tile (radius 14), dept name 22px/800 white, kickers in mint-200 with wide letter-spacing
- Role selector: 2-col grid of pill buttons (1.5px border `#D4DED9`); selected = green-800 fill, white text. Selecting a role pre-fills the username field (e.g. `employee@dlrrd.gov.za`)
- Inputs: left icon 18px, padding 12px 14px (42px left), radius 9px; focus: border mint + ring `0 0 0 3px rgba(47,185,138,.15)`
- Password field has eye toggle button (right, 6px inset)
- Sign In: full width, gradient `160deg #0B4635→#063A2C`, radius 10, 15px/700; hover: lift −1px + shadow `0 8px 22px rgba(6,58,44,.4)`

### 2. App shell (all authenticated screens)
**Sidebar** — 264px fixed, sticky full-height, gradient `180deg #052E22→#063A2C`:
- White logo card (radius 12) at top with crest + dept name
- "MAIN MENU" overline, then nav items: radius 9, padding 11px 13px, 13.5px/600, icon 18px
  - Inactive: text `rgba(255,255,255,.72)`, icon mint-300
  - Hover: bg `rgba(255,255,255,.09)`, white text, `translateX(3px)`, .18s ease
  - Active: gradient `90deg #2FB98A→#1E9E71`, dark green (#052E22) text+icon, shadow `0 6px 16px rgba(47,185,138,.35)`, small pulsing white dot on the right (scale 1→1.4, 2s loop)
- Footer: divider `rgba(255,255,255,.08)`, user avatar (36px mint circle) + name/role, then Logout button: mint 1px border at 50% + bg `rgba(47,185,138,.12)`, mint-300 text; hover inverts to solid mint with dark text

**Topbar** — white, 66px, border-bottom, sticky: page title left; right: pill search input (radius 20, bg-subtle; focus mint ring), bell button with rust badge dot, settings button (hover rotates 30°), avatar + name/role. Icon buttons 38px, radius 10, border `#E3EAE6`; hover bg `#F0F5F2`.

### 3. Dashboard — Classic variant (the chosen layout)
- Greeting row: "Good morning, …" 20px/800 + date subtitle; right-aligned **Report Incident** primary button (gradient green, plus icon; hover lift + shadow) → navigates to Submit Reports
- **KPI row**: 4 equal white cards. Overline label + 32px/800 number (animate count-up 0→value, ~900ms ease-out cubic, on mount) + icon in 32px mint-tinted tile (`#EAF7F1`, icon green-600) + 11.5px caption. Hover: lift −3px, border mint, shadow.
- **Row 1 (2fr / 1fr)**:
  - *Incidents by Province* bar chart: 9 bars in a fixed-height track (138px), width ≤44px, radius `7 7 3 3`, gradient mint→green-800; value label above (12px/800 green-800), province below (10.5px). Bars animate height 0→value with the same easing. Hover: `brightness(1.25)` + `scaleX(1.08)`.
  - *Loss Value by Classification* donut: stroke-width 22, radius 70, segments per classification colors, 3px gaps, sweep animates on mount; center shows "TOTAL LOSS" + total. Legend rows: swatch 10px (radius 3), label, amount 12.5px/800, % right-aligned; row hover bg `#F0F5F2`. Segment hover: stroke-width 22→26.
- **Row 2 (2fr / 1fr)**:
  - *Incident Trend* line chart: 12 monthly points; line green-600 3px, area fill vertical gradient mint 28%→0; dots r 4.5 white fill, green-600 stroke (hover r 7); month labels 10.5px. "+12% vs last quarter" badge in mint tile top-right.
  - *Case Status Distribution*: horizontal stacked bar 14px (radius 8, segment hover brightens) + legend rows with counts; SAPS/SSA referral inset card at bottom (bg-subtle) with outline "Register →" button (hover fills green-800).
- **Recent Security Incidents table**: header row bg-subtle with 10.5px overline columns; rows 14px padding, bottom border `#F0F5F2`; ref no. green-600/800 weight; classification as neutral chip (`#EEF3F0`), status as colored pill chip; row hover `#F6FBF8`, cursor pointer → opens case drawer. "View All Register Cases" outline button in header → Track My Incidents.

### 4. Track My Incidents
- Breadcrumb (Home › Track My Incidents), 13px, links green-600
- Dark green gradient header band (radius 14): title white 21px/800, subtitle mint-200; right side 3 stat blocks (24px/800: total white, in-progress `#F5C451`, approved mint-300) with 11px overlines
- Filter bar inside table card: search input (flex, bg-subtle, mint focus ring) + status filter pill chips (radius 18; active = green-800 fill white text; hover lift)
- Table columns: Case details (ref 13.5px/800 green-600 + "Reported {date} · Day n/14 · due {date}" 11.5px muted), Province, Place, Responsible Officer (700; **"Unassigned" in rust**), Status chip, Classification chip, eye icon button (32px; hover fills green-800)
- Row click (or eye) opens **Case Detail Drawer**: right-side panel 440px, overlay `rgba(3,30,22,.45)`; header = green gradient with ref + status chip + close; body = 2×2 meta grid (bg-subtle tiles) + vertical **progress timeline** (Submitted → Preliminary Review → Investigation → Resolved; done = green-600 dot w/ check, current = mint dot, pending = grey outline; connecting 2.5px lines) + amber SLA note card (`#FFF9EC` bg, `#F0DFB4` border)
- Search + filters must operate on the app's real case data

### 5. Submit Reports (multi-step form)
- Breadcrumb + dark green header band; right side shows kicker "STEP n OF 3" + current step name (or "Direct NOC Alert Dispatch")
- **Scheme toggle card**: two buttons — "DLRRD Standard Form" / "NOC Initial Notification" (active = green-800 fill). To the right, a **3-node stepper**: 34px circles (done = green-600 with check, current = green-800 white number, pending = white w/ grey border), 56px connector lines that fill green as steps complete, labels beneath
- **Step 1 — General & Contact Info**: 2-col grid; Department readonly (bg-subtle); Reported-by & contact pre-filled from the logged-in user (app data); datetime-local input; Province + Classification selects. "Next Step: Categorization →" bottom-right
- **Step 2 — Categorization & Loss**: incident types as **toggleable pill chips** (28 types; selected = green-800 fill w/ check icon; live "n selected" counter badge); "other" input; loss/injuries textareas; Loss Value input with "R" prefix; SAPS/SSA + resolution-window selects. Back / Next buttons
- **Step 3 — Narrative Report**: 13 question textareas in 2-col grid; dashed attach-files dropzone (hover: mint border + tint); Back + mint **Submit** button
- **NOC variant** (single page): amber "Immediate Dispatch Mode" warning banner, contact/date/place/province grid, same pill type selector, summary textarea, resolution select, compact dropzone, "Cancel NOC Alert" (hover turns rust) + dark green submit
- **Success state**: centered card — 84px mint-tinted circle with check, title, reference number in dashed-mint-border tile (24px/800), SLA note, buttons "Track My Incidents" + "Report Another Incident". Reference numbers must come from the app's backend.

## Interactions & Behavior (global)
- Transitions: `all .15–.2s ease` on interactive elements
- Buttons hover: `translateY(-1px)` + colored shadow; active: press down `translateY(1px)`
- Cards hover (KPI): `translateY(-3px)` + shadow + mint border
- Screen enter: fade-up (opacity 0→1, translateY 10px→0, .4s ease)
- Count-up + chart-grow animation: single progress value 0→1 over 900ms, easing `1-(1-t)^3`, drives KPI numbers, bar heights, donut sweep, area/line reveal
- Focus (all inputs): mint border + `0 0 0 3px rgba(47,185,138,.15)` ring
- Nav flows: login → dashboard; Report Incident → Submit form; table row → drawer; logout → login

## State Management (map to your app)
- Active route/screen (existing router)
- Dashboard animation progress (local, restart on mount)
- Incidents: search string + active status filter (client-side filter of your real data)
- Drawer: selected case (null = closed)
- Form: scheme (`standard`/`noc`), current step (1–3), selected incident types (set), submitted reference (from API)

## Assets
- Coat of arms: the design uses a placeholder roundel — use the department's real crest asset from your application
- Icons: 24px-grid stroke icons (stroke-width 2, round caps) — use your existing icon library's equivalents (Lucide/Feather style)
- Font: Public Sans via Google Fonts (self-host if required by policy)

## Files
- `Security Portal.dc.html` — the complete interactive prototype (open in a browser; all styles inline). The Classic dashboard variant is the documented default.
