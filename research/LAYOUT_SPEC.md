# Ergonomic Layout Specification — *PopStacks: Art Toy Atelier*

- **Target Reference Viewport**: `390×844 dp` (`9:19.5` mobile portrait aspect ratio; responsive scaling down to `360×640 dp` and up to `430×932 dp` / tablet `3:4` letterboxed canvas).
- **Safe Area Insets**:
  - Top Safe Area Inset: `0–4.0% H` (`0–34dp`) reserved for OS status bar / dynamic island clearance; interactive HUD controls begin at `Y ≥ 16dp` (`≥1.9% H`).
  - Bottom Safe Area Inset: `98.0–100% H` (`827–844dp`, `17dp`) reserved for OS home indicator bar.
- **Ergonomic Touch Standard**: Every interactive button, tab, booster slot, hex cell drag handle, and modal action maintains a minimum hit target of **`≥48×48dp`** with **`≥8dp`** clear separation between adjacent interactive regions.

---

## 1. Global Design Tokens, Palette & Typography Scale

### 1.1 Atelier Surface & Semantic Color Tokens
| Token Name | Hex Value | Usage |
| :--- | :--- | :--- |
| `--bg-workbench-cream` | `#F7F3EB` | Primary warm birch/plaster workshop background |
| `--bg-shelf-oak` | `#E8DEC8` | Secondary recessed shelf & tray container surface |
| `--bg-card-porcelain` | `#FFFFFF` | Elevated modal & card surface (`16px` corner radius) |
| `--bg-hud-espresso` | `#231F20` | High-contrast top HUD pills, badges, and modal backdrop (`rgba(35,31,32,0.72)`) |
| `--text-ink-primary` | `#1E1B18` | Primary headings and body copy (WCAG AAA `14.2:1` on `#FFFFFF`) |
| `--text-ink-muted` | `#6E655F` | Secondary labels, captions, and inactive tab text (`5.3:1` on `#F7F3EB`) |
| `--accent-cta-amber` | `#FF9F1C` | Primary Play CTA & active highlight (`#1E1B18` text on `#FF9F1C`, `8.1:1`) |
| `--accent-prism-teal` | `#00A896` | Secondary action, Prism currency badge, and completion accents |
| `--border-brass-rim` | `#D4C3A3` | `2px` card borders and recessed hex socket rims |

### 1.2 8-Color Vinyl Disc Palette + Redundant 3D Relief Symbols
| ID | Vinyl Color Name | Hex | Top Rim Specular | Front Bevel | Embossed Relief Symbol |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `C1` | **Coral Vinyl** | `#FF5A5F` | `#FF8589` | `#D9383E` | Crown (`♛`) |
| `C2` | **Marigold Glaze** | `#FFB400` | `#FFD15C` | `#CC8E00` | 8-Point Star (`✸`) |
| `C3` | **Mint Ceramic** | `#00A896` | `#42C9BA` | `#007A6C` | Heart (`♥`) |
| `C4` | **Cobalt Enamel** | `#3B82F6` | `#76A9FA` | `#1D4ED8` | Lightning Bolt (`⚡`) |
| `C5` | **Lavender Clay** | `#8B5CF6` | `#B495FA` | `#6D28D9` | Four-Leaf Clover (`♣`) |
| `C6` | **Rose Bisque** | `#EC4899` | `#F482B9` | `#BE185D` | Crescent Moon (`☾`) |
| `C7` | **Jade Porcelain** | `#10B981` | `#52D6A7` | `#047857` | Diamond (`◆`) |
| `C8` | **Tangerine Kiln** | `#F97316` | `#FB9D56` | `#C2410C` | Studio Flame (`🔥`) |

### 1.3 Typography Scale (`Recoleta Bold` Display + `Plus Jakarta Sans` UI)
| Style Token | Font Family & Weight | Size (`px`/`dp`) | Line Height | Letter Spacing | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Display-XL` | `Recoleta Bold` (700) | `32px` | `38px` (`1.18`) | `-0.02em` | Level Complete banner, Unboxing title, FTUE hero |
| `Heading-L` | `Recoleta Bold` (700) | `24px` | `30px` (`1.25`) | `-0.015em` | Modal headers, Chapter card title, Gallery series header |
| `Heading-M` | `Recoleta Bold` (700) | `18px` | `24px` (`1.33`) | `-0.01em` | HUD level label, Shop pack titles, Sub-banners |
| `UI-Numeric-L` | `Plus Jakarta Sans ExtraBold` (800) | `20px` | `24px` (`1.20`) | `0.00em` | Objective progress (`150/250`), Coin/Prism counters, CTA labels |
| `Body-M` | `Plus Jakarta Sans SemiBold` (600) | `15px` | `21px` (`1.40`) | `0.00em` | Modal descriptions, tutorial coach tips, mission rules |
| `Caption-S` | `Plus Jakarta Sans Bold` (700) | `12px` | `16px` (`1.33`) | `+0.02em` | Booster counts, nav tab labels, hex stack height badge (`7/10`) |

### 1.4 Corner Radii & Elevation Tokens
- **Primary Cards & Modals**: `16px` corner radius, `2px` solid `#D4C3A3` border, `0 8px 20px rgba(35,31,32,0.12)` drop shadow.
- **HUD Pills & Currency Badges**: `999px` (full capsule pill), `36dp` height inside `48dp` touch wrapper.
- **Primary CTA Buttons**: `16px` corner radius, `56dp`–`64dp` height with `4dp` bottom 3D tactile lip (`#CC7A00`).
- **Booster Dock Buttons**: `16px` rounded square (`64×64dp` visual, `≥68×64dp` hit area).

---

## 2. Screen-by-Screen Ergonomic Layout Specification (`390×844 dp`)

### Screen 1: Main Workshop Hub
Provides one-handed thumb access to core level launch, daily challenge, and meta-collection shelves while showcasing *Ollie the Otter* in the sunlit art-toy workshop.

| Zone | `% Width` (`X` bounds) | `% Height` (`Y` bounds) | Pixel Bounds (`390×844`) | Padding & Internal Layout |
| :--- | :--- | :--- | :--- | :--- |
| **1A. Top Status Bar** | `0–100% W` (`0–390dp`) | `0–8% H` (`0–68dp`) | `390×68dp` | `padding: 16dp 16dp 8dp 16dp`. Left: **Workshop clay Coin Pill** (`X: 16–132dp`, `116×38dp` visual, `48dp` hit height, icon + `1,450` + `+` button). Center: **Prism Gem Pill** (`X: 144–256dp`, `112×38dp`, icon + `85` + `+` button). Right: **Settings Gear Button** (`X: 326–374dp`, `48×48dp` circular button, `16px` corner radius). |
| **1B. Featured Shelf & Ollie Mascot Banner** | `4.1–95.9% W` (`16–374dp`) | `8–42% H` (`68–354dp`) | `358×286dp` | `padding: 16dp`, `16px` corner radius diorama card. Upper `65%` (`186dp`): 3D birch display shelf holding the current chapter's 6 vinyl figurines (unlocked figurines rendered in glossy 3D vinyl; locked slots shown as frosted blind-box silhouettes). Lower `35%` (`100dp`): *Ollie the Otter* animated mascot on left (`96×96dp`) with a speech-bubble tip card (`"2 more Glaze Clears to unbox Kitsune Fox!"`, `Plus Jakarta Sans SemiBold 14px`). |
| **1C. Current Level & Chapter Card** | `4.1–95.9% W` (`16–374dp`) | `42–64% H` (`354–540dp`) | `358×186dp` | `padding: 16dp`, `16px` corner radius (`#FFFFFF` card with `2px` `#D4C3A3` border). Header: `Chapter 2: Pastel Kiln · Series 02` (`Caption-S 12px`, `#00A896`). Title: `Level 14 — Honeycomb Glaze` (`Recoleta Bold 24px`). Center: 3-hex preview miniature + **Blind-Box Progress Bar** (`240×20dp`, `3/5 Levels to Next Blind Box` with animated gift box icon on right cap). |
| **1D. Primary Play CTA & Daily Challenge Pill** | `4.1–95.9% W` (`16–374dp`) | `64–88% H` (`540–743dp`) | `358×203dp` | `padding: 12dp 0`. Top (`Y: 552–620dp`): **Primary Play CTA Button** (`358×68dp`, `#FF9F1C` amber fill, `16px` radius, `4dp` bottom lip, `Recoleta Bold 24px` `"PLAY LEVEL 14"` + subtitle `"Goal: 250 Vinyl Discs"`). Bottom (`Y: 636–700dp`): **Daily Artisan Challenge Pill** (`358×64dp`, `#00A896` teal card, `16px` radius, calendar-kiln badge on left, `"Daily Kiln Run · Oct 17"`, right `"PLAY"` pill `88×48dp`). |
| **1E. Bottom 5-Tab Navigation Bar** | `0–100% W` (`0–390dp`) | `88–100% H` (`743–844dp`) | `390×101dp` | `padding: 8dp 12dp 21dp 12dp`, `#231F20` espresso dock with top brass border. Contains 5 equal-width tabs (`73.2×72dp` each; **exceeds `48×48dp` tap target**): `1. Gallery` (Shelf icon), `2. Daily` (Calendar badge), `3. Workshop` (Center elevated active tab `76×76dp`, `#FF9F1C` highlight), `4. Pass` (Collector Pass ticket), `5. Shop` (Atelier chest). |

---

### Screen 2: Puzzle Board Mid-Solve
Mirrors the proven ergonomic hierarchy of *Hexa Sort* (`reference-board.jpg`) while adding explicit stack height counters, a 1-step Undo button, and a dedicated 4th Extra Staging Slot.

| Zone | `% Width` (`X` bounds) | `% Height` (`Y` bounds) | Pixel Bounds (`390×844`) | Padding & Internal Layout |
| :--- | :--- | :--- | :--- | :--- |
| **2A. Top HUD & Level Objective Target Strip** | `0–100% W` (`0–390dp`) | `0–13% H` (`0–110dp`) | `390×110dp` | `padding: 16dp 16dp 8dp 16dp`.<br>• **Left (`X: 16–112dp`, `Y: 20–68dp`)**: **Clay Coin Pill** (`96×48dp` tap area, `38dp` visual height, gold clay stamp + `1,450` + green `+`).<br>• **Center (`X: 122–268dp`, `Y: 18–76dp`)**: **Level Objective Target Strip** (`146×58dp`, `#231F20` hexagonal capsule with `16px` end caps). Displays `LEVEL 14` (`11px` gold label above) and a 3D multi-color vinyl hex icon + `150 / 250` (`Plus Jakarta Sans ExtraBold 20px`) with an animated fill bar (`#00A896`).<br>• **Right (`X: 278–326dp` & `330–378dp`, `Y: 20–68dp`)**: **Free 1-Step Undo Button** (`48×48dp`) + **Pause/Settings Gear Button** (`48×48dp`). |
| **2B. Isometric 7/19/37-Slot Hexagonal Workbench Stage** | `0–100% W` (`0–390dp`) | `13–68% H` (`110–574dp`) | `390×464dp` | `padding: 12dp 16dp` (`358×440dp` active board canvas).<br>• **Camera & Projection**: `55°` isometric tilt (`0.82:1` vertical-to-horizontal hex foreshortening) centered at `(195dp, 342dp)`.<br>• **Adaptive Ring Scaling**:<br>  - **7-Slot Board (Tutorial / Early Levels 1–3)**: Hex outer radius `R = 46dp` (`92×76dp` per cell), `6dp` brass-rimmed gutter.<br>  - **19-Slot Board (Standard Core Levels, Radius 2)**: Hex outer radius `R = 32dp` (`64×53dp` per cell), `5dp` gutter.<br>  - **37-Slot Board (Master Levels, Radius 3)**: Hex outer radius `R = 23dp` (`46×38dp` per cell), `4dp` gutter.<br>• **Stack Visuals**: Each vinyl disc layer renders with `6dp` vertical front-bevel thickness (up to 10 discs per stack = `60dp` stack height). Top disc displays its 3D relief symbol + a floating **`Caption-S 12px` stack-depth pill** (`7/10`) on the front bevel. Locked coin slots render with a recessed dark ceramic cap, padlock icon, and `100` coin badge. |
| **2C. 3-Slot + 4th Extra Staging Slot Dispenser Tray** | `3.1–96.9% W` (`12–378dp`) | `68–86% H` (`574–726dp`) | `366×152dp` | `padding: 12dp 14dp`, `#E8DEC8` recessed oak tray (`16px` corner radius, inner shadow).<br>• **3 Primary Dispenser Slots**: Centered at `X = 74dp (19% W)`, `168dp (43% W)`, `262dp (67% W)`, `Y = 650dp`. Each slot has an **`82×116dp` touch/drag hit box** (exceeding `48×48dp`). When dragged, the stack lifts by `-42dp` (`Y` offset) and scales to `1.12×` so the player's thumb never occludes the target hex socket.<br>• **4th Extra Staging Slot (`X = 336dp / 86% W`)**: `68×96dp` dashed brass hex socket on the right end of the tray (shows a `+ Slot` / Prism badge when locked; acts as a temporary parking or 4th dealer slot when unlocked). |
| **2D. Bottom 3-Booster Dock** | `4.1–95.9% W` (`16–374dp`) | `86–98% H` (`726–827dp`) | `358×101dp` | `padding: 10dp 16dp`, horizontally centered dock with 3 ergonomic booster buttons (`100×76dp` each, `16px` corner radius, `13dp` gap between buttons; **far exceeding `48×48dp`**):<br>1. **Ceramic Mallet (`Hammer`)** (`X: 29–129dp`): Smashes and clears any single hex stack on the board. Badge shows inventory count (`2`) or `150` coin price.<br>2. **Spatula Swap (`Swap`)** (`X: 145–245dp`): Picks up and relocates any existing board stack to an empty socket, or flips/rerolls the 3 tray stacks.<br>3. **Extra Staging Slot (`Extra Slot`)** (`X: 261–361dp`): Unlocks the 4th tray slot or clears a locked board socket for the remainder of the level. |

---

### Screen 3: Out-of-Moves Deadlock Warning & Rescue Modal
Triggered `400ms` after the last empty hex cell on the workbench is filled without triggering a `10/10` stack clear while stacks remain in the tray.

| Component | `% Width` (`X` bounds) | `% Height` (`Y` bounds) | Pixel Bounds (`390×844`) | Specification & Details |
| :--- | :--- | :--- | :--- | :--- |
| **3A. Dimmed Backdrop & Board Peek** | `0–100% W` | `0–100% H` | `390×844dp` | `rgba(35,31,32,0.72)` backdrop blur (`backdrop-filter: blur(6px)`). A top **"Peek Board" hold button** (`X: 135–255dp`, `Y: 84–132dp`, `120×48dp` pill) lets players hold to inspect the deadlocked board before deciding. |
| **3B. Rescue Modal Card** | `6.2–93.8% W` (`24–366dp`) | `18–82% H` (`152–692dp`) | `342×540dp` | `#FFFFFF` porcelain card, `16px` corner radius, `24dp` internal padding. Top banner (`64dp` H, `#FF5A5F` coral header): `"WORKBENCH FULL!"` (`Recoleta Bold 24px`, `#FFFFFF`). |
| **3C. Progress Retention Callout** | `12.3–87.7% W` (`48–342dp`) | `28–44% H` (`236–371dp`) | `294×135dp` | Recessed `#F7F3EB` box (`16px` radius, `16dp` padding) showing *Ollie the Otter* holding a nearly full blind box: `"You're at 220 / 250 Discs (88%)! Clear 3 center stacks to keep your streak & unbox progress."` |
| **3D. Rescue Action Stack (3 Choices)** | `12.3–87.7% W` (`48–342dp`) | `46–79% H` (`388–667dp`) | `294×279dp` | Three vertical buttons with `12dp` vertical spacing:<br>1. **Primary Rescue CTA (`294×64dp`, `#FF9F1C`, `16px` radius)**: `"Clear 3 Stacks + Unlock Extra Slot"` — Cost: `200 Coins` (or `1 Free Rescue Token`).<br>2. **Opt-In Rewarded Workshop Preview (`294×56dp`, `#00A896`, `16px` radius)**: `"Watch 15s Artisan Preview (Free Rescue)"` — 100% opt-in, never forced.<br>3. **Secondary Retry CTA (`294×52dp`, ghost button `#6E655F`)**: `"Restart Level (No Life Lost)"` (`≥48dp` height). |

---

### Screen 4: Booster Tool Active Overlay
Activated when the player taps **Hammer**, **Swap**, or **Extra Slot** from Zone 2D during Screen 2 gameplay.

| Component | `% Width` (`X` bounds) | `% Height` (`Y` bounds) | Pixel Bounds (`390×844`) | Specification & Details |
| :--- | :--- | :--- | :--- | :--- |
| **4A. Top Instruction Banner** | `4.1–95.9% W` (`16–374dp`) | `2.5–12.5% H` (`21–105dp`) | `358×84dp` | Replaces Zone 2A temporarily with a `#231F20` banner (`16px` radius, `16dp` padding, `2px` `#FF9F1C` pulsing border). Left: `48×48dp` animated tool icon. Center: Tool title (`Recoleta Bold 18px`, `#FF9F1C`) + instruction (`Plus Jakarta Sans SemiBold 14px`, `#FFFFFF`):<br>• *Hammer Mode*: `"Tap any stack on the workbench to shatter & collect its discs."`<br>• *Swap Mode*: `"Tap a workbench stack to move it, or tap 'Reroll Tray' below."`<br>• *Extra Slot Mode*: `"4th Staging Slot unlocked! Drag any stack there to hold it."` |
| **4B. Highlighted Workbench Stage** | `0–100% W` (`0–390dp`) | `13–68% H` (`110–574dp`) | `390×464dp` | Non-target UI dims by `45%`; eligible hex stacks pulse (`1.00× ↔ 1.05×` scale at `800ms` period) with a `#FF9F1C` target reticle ring above each stack. |
| **4C. Bottom Action & Cancel Bar** | `4.1–95.9% W` (`16–374dp`) | `84–96% H` (`709–810dp`) | `358×101dp` | In *Swap Mode*, displays a secondary `"Reroll 3 Tray Stacks"` CTA (`196×56dp`, `#00A896`, `16px` radius) alongside a prominent **`"Cancel"` Button** (`146×56dp`, `#231F20` pill, `≥48dp` height) that exits booster mode at zero cost. |

---

### Screen 5: Level Complete Celebration & Blind-Box Vinyl Figurine Unboxing Modal
Two-stage celebratory sequence upon reaching `100%` of the level's disc collection goal (e.g., `250/250`).

| Component | `% Width` (`X` bounds) | `% Height` (`Y` bounds) | Pixel Bounds (`390×844`) | Specification & Details |
| :--- | :--- | :--- | :--- | :--- |
| **5A. Celebration Header Ribbon** | `6.2–93.8% W` (`24–366dp`) | `6–18% H` (`51–152dp`) | `342×101dp` | `Recoleta Bold 32px` `"MASTERPIECE COMPLETE!"` over a golden ceramic ribbon with confetti and kiln-sparkle particles. Sub-pill shows `"Level 14 Cleared · 14x Max Cascade Combo"`. |
| **5B. 3D Blind-Box / Figurine Unboxing Stage** | `6.2–93.8% W` (`24–366dp`) | `19–58% H` (`160–490dp`) | `342×330dp` | `#FFFFFF` showcase card (`16px` radius, `20dp` padding) featuring an interactive 3D turntable (`220×220dp` center canvas):<br>• **Standard Level**: Box shakes (`+20%` progress fill) and awards Coin + Prism tokens.<br>• **Milestone Level (100% Box Fill)**: Interactive **"Tap to Tear Foil"** gesture rips open the blind box (`450ms` tear animation) and reveals the newly unlocked 3D Vinyl Figurine (e.g., *Series 02 · #08 Kitsune Glaze*, `Rarity: Artisan Rare`) rotating on a brass pedestal with a `"NEW FIGURINE UNBOXED!"` badge. |
| **5C. Reward Breakdown Strip** | `6.2–93.8% W` (`24–366dp`) | `59–73% H` (`498–616dp`) | `342×118dp` | Horizontal 3-column reward card (`16px` radius, `#F7F3EB` fill, `12dp` padding): `+120 Clay Coins`, `+15 Prisms`, and `+1 Showcase Star`. |
| **5D. Next Level & Gallery CTAs** | `6.2–93.8% W` (`24–366dp`) | `75–94% H` (`633–793dp`) | `342×160dp` | Primary CTA: **`"NEXT LEVEL (LEVEL 15)"`** (`342×64dp`, `#FF9F1C` amber button, `16px` radius, `Recoleta Bold 22px`). Secondary CTA below (`12dp` gap): **`"Place on Workshop Shelf"`** (`342×52dp`, `#00A896` outline button, `16px` radius). |

---

### Screen 6: Daily Artisan Challenge & Global Leaderboard View
Accessible via the Daily Challenge Pill (Screen 1D) or Tab 2 (`Daily`) in the bottom navigation bar.

| Component | `% Width` (`X` bounds) | `% Height` (`Y` bounds) | Pixel Bounds (`390×844`) | Specification & Details |
| :--- | :--- | :--- | :--- | :--- |
| **6A. Top Header & Segmented Toggle** | `0–100% W` (`0–390dp`) | `0–14% H` (`0–118dp`) | `390×118dp` | `padding: 16dp`. Back button (`48×48dp` left), title `"Daily Artisan Kiln"` (`Recoleta Bold 24px`), and a 2-segment pill toggle (`358×48dp`, `16px` radius): **`Today's Puzzle`** vs. **`Global Artisan Board`**. |
| **6B. Seeded Daily Challenge Card** | `4.1–95.9% W` (`16–374dp`) | `15–46% H` (`127–388dp`) | `358×261dp` | `16px` radius card (`#FFFFFF`, `20dp` padding). Displays Today's Date (`October 17, 2026 · Seed #20261017`), special rule modifier (`"37-Slot Master Grid · No Locked Cells · Target: 600 Discs"`), Monthly Crown Calendar progress (`17/31 Days Stamped`), and a **`"START DAILY RUN"`** CTA (`318×56dp`, `#FF9F1C`). |
| **6C. Transparent Leaderboard List** | `4.1–95.9% W` (`16–374dp`) | `48–86% H` (`405–726dp`) | `358×321dp` | Scrollable card (`16px` radius, `12dp` padding) showing top scores ranked by **Fewest Moves Used** and **Highest Chain Combo** on today's identical deterministic seed. Includes an explicit transparency badge (`"Seed-Verified Runs · Personal Best & Friends Filter"` — zero deceptive rubber-banding bots). Each row is `52dp` tall (`12dp` horizontal padding). |
| **6D. Bottom Navigation Bar** | `0–100% W` (`0–390dp`) | `88–100% H` (`743–844dp`) | `390×101dp` | Persistent 5-tab bar with Tab 2 (`Daily`) highlighted. |

---

### Screen 7: Toy Showcase Gallery (10 Series × 6 Figurines = 60 Vinyl Figurines)
Replaces *Hexa Sort*'s generic island coloring (`reference-meta.jpg`) with a tactile 3D designer-toy collector room.

| Component | `% Width` (`X` bounds) | `% Height` (`Y` bounds) | Pixel Bounds (`390×844`) | Specification & Details |
| :--- | :--- | :--- | :--- | :--- |
| **7A. Collection Header & Total Counter** | `0–100% W` (`0–390dp`) | `0–11% H` (`0–93dp`) | `390×93dp` | `padding: 16dp`. Title: `"Atelier Toy Showcase"` (`Recoleta Bold 24px`). Right badge: **`18 / 60 Figurines Unboxed`** (`148×40dp` pill, `#231F20` fill with gold vinyl icon). |
| **7B. 10-Series Horizontal Carousel Strip** | `0–100% W` (`0–390dp`) | `11–20% H` (`93–169dp`) | `390×76dp` | Horizontal scroll of 10 Series Pills (`116×52dp` each, `8dp` gap, `16px` radius, `≥48dp` height):<br>`S1 Woodland Clay`, `S2 Pastel Kiln`, `S3 Neon Tokyo`, `S4 Botanical Glaze`, `S5 Celestial Porcelain`, `S6 Deep Sea Bisque`, `S7 Sweet Patisserie`, `S8 Mythic Beasts`, `S9 Retro Arcade`, `S10 Golden Atelier`. |
| **7C. 3×2 3D Birch Shelf Grid (6 Figurines per Series)** | `4.1–95.9% W` (`16–374dp`) | `21–67% H` (`177–565dp`) | `358×388dp` | Two birch-wood shelf tiers (`184dp` H each, `16px` radius frame, `12dp` padding) holding 3 figurines per row (`106×164dp` tap card per figurine, `10dp` gap):<br>• **Unlocked State**: Full-color 3D vinyl figurine with series number (`#07`), name (`Mochi Bunny`), and rarity star badge.<br>• **Locked State**: Matte terracotta silhouette with `"Unbox via Level Milestones or Prism Craft"` label. |
| **7D. Selected Figurine 3D Turntable Inspector Drawer** | `4.1–95.9% W` (`16–374dp`) | `68–86% H` (`574–726dp`) | `358×152dp` | `16px` radius `#FFFFFF` inspector card (`16dp` padding). Left (`116×116dp`): Interactive 360° drag-to-rotate 3D preview of the selected figurine + **"Change Glaze Finish"** button (`Matte / Gloss / Iridescent`). Right (`210×116dp`): Lore blurb (`Plus Jakarta Sans 14px`), unlock date, and **"Set as Workbench Mascot"** button (`196×48dp`). |
| **7E. Bottom Navigation Bar** | `0–100% W` (`0–390dp`) | `88–100% H` (`743–844dp`) | `390×101dp` | Persistent 5-tab bar with Tab 1 (`Gallery`) highlighted. |

---

### Screen 8: Atelier Shop & Ethical Monetization Modals
Accessible via Tab 4 (`Pass`), Tab 5 (`Shop`), or the `+` currency buttons in the top HUD. Built around zero forced ads and transparent value.

| Component | `% Width` (`X` bounds) | `% Height` (`Y` bounds) | Pixel Bounds (`390×844`) | Specification & Details |
| :--- | :--- | :--- | :--- | :--- |
| **8A. Shop Header & Currency Balances** | `0–100% W` (`0–390dp`) | `0–10% H` (`0–84dp`) | `390×84dp` | `padding: 16dp`. Title `"Atelier Supply Shop"` (`Recoleta Bold 24px`), live Coin & Prism balances, and `48×48dp` Close (`×`) button when opened as a modal. |
| **8B. Featured Collector Pass Banner (`$4.99/mo`)** | `4.1–95.9% W` (`16–374dp`) | `11–33% H` (`93–278dp`) | `358×185dp` | `16px` radius premium card (`#231F20` espresso background with gold foil border `#FFB400`, `16dp` padding). Header: **`Atelier Collector Pass — $4.99/mo`** (`Recoleta Bold 20px`). Perks list: (1) Exclusive Monthly Iridescent Vinyl Figurine, (2) Permanent **4th Extra Tray Slot** unlocked on all levels, (3) Daily `+100 Coins & +15 Prisms` stipend, (4) Instant skip on all opt-in reward previews. CTA button: `148×48dp` `#FF9F1C` pill (`"Subscribe $4.99"`). |
| **8C. Starter Atelier Bundle Card (`$2.99` One-Time)** | `4.1–95.9% W` (`16–374dp`) | `35–53% H` (`295–447dp`) | `358×152dp` | `16px` radius `#FFFFFF` card (`16dp` padding, `#00A896` border). Title: **`Starter Atelier Bundle — $2.99`** (`"One-Time Welcome Offer · 3x Value"`). Includes `1,500 Clay Coins`, `100 Prisms`, `3× Ceramic Mallets`, `3× Spatula Swaps`, and `1× Guaranteed Rare Blind Box`. CTA: `132×48dp` `#00A896` button (`"$2.99"`). |
| **8D. Prisms, Booster Packs & Opt-In Rewarded Ad Card** | `4.1–95.9% W` (`16–374dp`) | `55–86% H` (`464–726dp`) | `358×262dp` | 2×2 grid of `173×124dp` cards (`12dp` gap, `16px` radius):<br>1. **Artisan Booster Trio**: `1× Hammer + 1× Swap + 1× Extra Slot` (`400 Coins`).<br>2. **Kiln Pouch**: `500 Clay Coins` (`$0.99`).<br>3. **Prism Crate**: `120 Prisms` (`$1.99`).<br>4. **Opt-In Daily Studio Sponsor (`FREE`)**: `"Watch a 15s Sponsor Clip → +75 Coins + 5 Prisms (2/3 Left Today)"` (`150×48dp` button; strictly opt-in). |

---

### Screen 9: Settings & Accessibility Modal
Centered modal overlay accessible from the top-right `48×48dp` Gear button on both Screen 1 (Hub) and Screen 2 (Puzzle Board).

| Component | `% Width` (`X` bounds) | `% Height` (`Y` bounds) | Pixel Bounds (`390×844`) | Specification & Details |
| :--- | :--- | :--- | :--- | :--- |
| **9A. Modal Container** | `6.2–93.8% W` (`24–366dp`) | `14–86% H` (`118–726dp`) | `342×608dp` | `#FFFFFF` porcelain card (`16px` corner radius, `20dp` padding) over `rgba(35,31,32,0.72)` backdrop. Header: `"Atelier Settings"` (`Recoleta Bold 24px`) + `48×48dp` Close (`×`) button at top-right (`X: 310–358dp`, `Y: 126–174dp`). |
| **9B. Audio & Tactile Haptics Section** | `10.3–89.7% W` (`40–350dp`) | `23–44% H` (`194–371dp`) | `310×177dp` | Three `52dp`-tall toggle/slider rows (`≥48×48dp` switch targets):<br>1. **Ceramic Clink SFX (ASMR Stack Audio)**: Slider `0–100%` (Default `85%`).<br>2. **Lo-Fi Workshop Acoustic BGM**: Slider `0–100%` (Default `60%`).<br>3. **Tactile Haptic Ticks (Per-Disc Flip)**: Toggle switch (`ON / OFF`). |
| **9C. Accessibility & Ergonomics Section** | `10.3–89.7% W` (`40–350dp`) | `46–70% H` (`388–591dp`) | `310×203dp` | Three `56dp`-tall accessibility rows:<br>1. **High-Contrast Relief Symbols (Colorblind Mode)**: Enlarges the 3D embossed symbols (`♛ ✸ ♥ ⚡ ♣ ☾ ◆ 🔥`) with high-contrast white/black outlines on all discs (`ON / OFF`).<br>2. **Reduced Motion & Particle Flash**: Replaces 3D flip arcs and camera shake with smooth `150ms` cross-fades (`ON / OFF`).<br>3. **One-Handed Thumb Reach Offset**: Shifts the 3-slot dispenser tray `16dp` toward Left or Right thumb (`Left / Center / Right`). |
| **9D. Session Controls & Credits Footer** | `10.3–89.7% W` (`40–350dp`) | `72–84% H` (`608–709dp`) | `310×101dp` | Side-by-side action buttons (`148×52dp` each, `14dp` gap, `16px` radius): **`"Restart Level"`** (`#F7F3EB` fill) and **`"Return to Hub"`** (`#FF9F1C` fill), plus privacy/restore purchases links below. |

---

### Screen 10: First-60-Seconds Interactive FTUE Onboarding Overlay
Guides new players through the core mechanic in `< 60 seconds` on Level 1 (a compact **7-slot hexagonal board** with `R = 46dp` cells) without walls of text.

| Step & Time Window | `% Width` (`X` bounds) | `% Height` (`Y` bounds) | Pixel Bounds (`390×844`) | Interactive Choreography & Specification |
| :--- | :--- | :--- | :--- | :--- |
| **10A. Step 1 (`0–15s`): Drag & Place First Stack** | Spotlight: `18–82% W` (`70–320dp`) | Spotlight: `24–82% H` (`202–692dp`) | `250×490dp` active cutout | Scrim dims outer screen to `rgba(35,31,32,0.65)` while keeping the center tray stack (`Coral Vinyl ×6`, `X: 195dp, Y: 650dp`) and center empty hex socket (`X: 195dp, Y: 342dp`) brightly lit. An animated 3D artisan hand + golden dotted bezier curve glides from tray to socket (`1100ms` loop). Top *Ollie* coach pill (`X: 24–366dp, Y: 108–176dp`, `342×68dp`, `16px` radius): `"Drag the Coral stack next to the matching Coral discs!"` |
| **10B. Step 2 (`15–35s`): Watch the Hinge-Flip Merge & `10/10` Pop** | Board Stage `12–88% W` | Board Stage `18–62% H` | `296×371dp` | Immediately upon drop, the 6 Coral discs hinge-flip (`65ms` stagger per disc) onto the adjacent 4 Coral discs, reaching `10/10`. The stack compresses and pops into kiln sparkles (`320ms`), filling the top objective bar (`10 / 20`). *Ollie* banner updates: `"10 matching discs fuse into glaze! Now trigger a 2-color chain!"` |
| **10C. Step 3 (`35–60s`): Buried-Color Cascade & First Blind Box** | Full Board `0–100% W` | Full Board `0–100% H` | `390×844dp` | Player places the second tray stack (`Mint ×5` over `Marigold ×4`). Clearing the top Mint layer automatically exposes the buried Marigold layer, which cascades onto the neighboring Marigold stack (`20 / 20` goal complete) and transitions directly into **Screen 5** to unbox the player's first guaranteed figurine (*Series 01 · #01 Ollie Apprentice*). Includes a persistent **`"Skip Tutorial"`** pill (`96×48dp` at top-right `X: 278–374dp, Y: 20–68dp`). |

---

## 3. Motion Design, Transition Curves & Animation Durations

| Interaction / Transition | Duration (`ms`) | Easing Curve (`cubic-bezier`) | Visual & Tactile Choreography |
| :--- | :--- | :--- | :--- |
| **Tray Stack Pickup (Touch Down)** | `120ms` | `cubic-bezier(0.2, 0.9, 0.3, 1.1)` | Stack lifts `-42dp` vertically, scales `1.00× → 1.12×`, casts a soft `18dp` drop shadow on the board; valid empty hex sockets highlight with a `#00A896` inner rim. |
| **Invalid Drop Return (Snap Back)** | `240ms` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Spring-overshoot return to original dispenser slot; zero penalty. |
| **Valid Hex Socket Placement** | `140ms` | `cubic-bezier(0.22, 1, 0.36, 1)` | Crisp downward settle with a `2dp` squash-and-stretch (`scaleY: 0.94 → 1.00`) + wooden thud SFX. |
| **Disc-to-Disc Hinge Flip (Merge)** | `180ms` per disc (`65ms` stagger) | `cubic-bezier(0.45, 0, 0.55, 1)` | Top matching discs hinge-flip `180°` across the shared hex edge along a `28dp`-high parabolic arc; pitch rises `+1` semitone per consecutive disc. |
| **`10/10` Full Stack Compression & Pop** | `320ms` | `cubic-bezier(0.16, 1, 0.3, 1)` | At `10` identical discs, stack compresses downward (`0–110ms`), flashes warm gold (`110–160ms`), and bursts upward into 12 ceramic glaze particles (`160–320ms`) that fly into the Top Objective Bar (`420ms` flight). |
| **Buried-Layer Cascade Delay** | `150ms` pause | `linear` (anticipation beat) | Brief `150ms` readability beat after a top-layer clear before newly exposed bottom discs automatically initiate the next neighbor merge chain. |
| **3-Slot Dispenser Tray Deal** | `280ms` (`50ms` slot stagger) | `cubic-bezier(0.34, 1.45, 0.64, 1)` | When all 3 tray slots empty, 3 new stacks slide up `36dp` from the bottom oak lip with a gentle spring bounce. |
| **Screen-to-Screen Hub ↔ Tab Switch** | `260ms` | `cubic-bezier(0.22, 1, 0.36, 1)` | Horizontal `24dp` slide + opacity cross-fade (`0 → 1`) with active nav tab icon spring (`1.00× → 1.15× → 1.05×`). |
| **Modal Open / Close (Screens 3, 5, 8, 9)** | `280ms` open / `200ms` close | `cubic-bezier(0.16, 1, 0.3, 1)` open / `cubic-bezier(0.4, 0, 1, 1)` close | Backdrop fades `0 → 0.72` while the `16px`-radius porcelain card scales `0.88× → 1.00×` and translates `Y: +28dp → 0dp`. |
| **Blind-Box Foil Tear & Figurine Reveal** | `450ms` tear + `600ms` reveal | `cubic-bezier(0.22, 1, 0.36, 1)` | Foil wrapper peels diagonally; figurine springs upward (`scale: 0.5× → 1.08× → 1.00×`) onto the rotating 3D brass pedestal. |
