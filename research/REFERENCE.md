# Reference Evidence — Checked October 17, 2026

## 1. Store Locators & Live Snapshot Metadata

- **Google Play Store Locator**: `https://play.google.com/store/apps/details?id=com.gamebrain.hexasort&hl=en&gl=US`
- **Apple App Store Locator**: `https://apps.apple.com/us/app/hexa-sort/id6463127238`
- **Scope Note**: US web store views (`hl=en&gl=US` / `/us/`); these values are live snapshots captured on October 17, 2026, not guarantees for another locale or date. No rankings or counts from the task prompt were assumed.

| Metric | Google Play Store (`com.gamebrain.hexasort`) | Apple App Store (`id6463127238`) |
| :--- | :--- | :--- |
| **Title / Subtitle** | *Hexa Sort* | *Hexa Sort — Color tile sorting puzzle game* |
| **Publisher / Developer** | Lion Studios Plus (`https://lionstudios.cc/`) | Lion Studios Plus (Seller: Lion Studios Plus) |
| **Star Rating** | **4.5 stars** (`4.481664657592773` in JSON-LD `AggregateRating`) | **4.7 stars** (`4.7 out of 5` in header and JSON-LD) |
| **Review / Rating Count** | **460K reviews** in header (`460,437` in JSON-LD `ratingCount`); **436K reviews** in Phone review scope | **219K Ratings** in header (`218,641` in JSON-LD `reviewCount`) |
| **Downloads / Chart Rank** | **10M+ Downloads** | **#105 in Board** |
| **Last Updated / Size** | Updated on **Oct 16, 2026** | Size: **633.3 MB**; Requires iOS 15.6 or later |
| **Category / Genre** | `GAME_PUZZLE` (Tags: *Puzzle, Sort, Casual, Single player, Abstract, Light-hearted, Offline*) | `Games` → `Board` / `Puzzle` |
| **Monetization & Content** | Free · Contains ads · In-app purchases (Includes Random Items) · Rated `Everyone` | Free · In-App Purchases · Age Rating `18+ Years` (US store page display) |
| **Live Store Events (Oct 2026)** | *Spooky thrills await! Jack O'Lanterns*, *Epic Golden Collection*, *Haunted camp for ghosts n goblins* (Ends 10/31) | *Spooky Gala*, *Unlock Epic Golden Collection*, *Haunted Season Awaits!* |

---

## 2. Visual Evidence Actually Inspected

All available store assets were fetched directly from Google Play (`play-lh.googleusercontent.com`) and the Apple App Store (`is1-ssl.mzstatic.com`) into `/Users/andychiang/Development/weekly_games/research/hexa_sort/` (`play_screenshot_1.jpg`–`14.jpg`, `ios_screenshot_1.jpg`–`6.jpg`, `play_icon.jpg`, `ios_icon.jpg`, `play_promo.jpg`, and the embedded Play Store trailer `play_trailer.mp4` with extracted 1-fps frames `trailer_frame_01.jpg`–`07.jpg`).

Six representative reference files were copied into `/Users/andychiang/Development/weekly_games/week422026/popstacks/research/` for side-by-side design analysis (`reference-promo.jpg`, `reference-board.jpg`, `reference-symbols.jpg`, `reference-merge.jpg`, `reference-meta.jpg`, and `reference-trailer-frame.jpg`). **None of these reference files are placed in `public/`, `assets/`, `dist/`, Android assets, or image-generation inputs.**

### Direct Visual Inspection of Downloaded Store Captures

1. **`play_screenshot_1.jpg` (`600×1067`) / `play_screenshot_8.jpg` (`600×801`) / `ios_screenshot_1.jpg` (`600×1300`) — `reference-promo.jpg`**
   - **Source URL**: `https://play-lh.googleusercontent.com/0xV1aTDHkI9MAyGIKkp231yB9chqvVtvoC6olF5vC4H6wtv7ATSfRE_RQaN5HRJkUf_znjeKpoHLBRJLDTC2IQ=w526-h296`
   - **Visual Findings**: Promotional hero composition showing a massive cylindrical concentric tower of 3D hexagonal tile stacks in saturated glossy colors (magenta, yellow, lime green, cobalt blue, orange, purple) with a 3D cartoon hand pointing at a glowing magenta segment. Top HUD bar (`Y = 3.0%–6.8%`) shows the gold hexagonal `$` coin badge (`223` + green `+`), center rainbow hexagon progress bar (`0/1500`), and right periwinkle gear icon. Bottom promotional banner reads `"SORT BY COLOR!"`. Marketing illustration of tower depth, not a standard level board.

2. **`play_screenshot_2.jpg` (`600×1067`) / `play_screenshot_9.jpg` (`600×801`) / `ios_screenshot_2.jpg` (`600×1300`) — `reference-board.jpg`**
   - **Source URL**: `https://play-lh.googleusercontent.com/O7OzsoqMs34ccOrUi3d6mR--s37C0q8GOnqhmDvK0JzYGqjku01PnJ4yNRpQkCVXZB3Iy74hGd_lN-loh3tPPA=w526-h296`
   - **Visual Findings**: Canonical mid-solve board layout on a `#CECECE` neutral light-gray studio backdrop:
     - **Top HUD Bar (`Y = 3.0%–6.8%`)**: Left coin pill (`100` + green `+` at `X = 5.0%–24.5%`), center target collection goal bar (`0/250` with 3D rainbow hex badge at `X = 37.3%–62.7%`), and right settings gear (`X = 88.0%–95.0%`).
     - **Board Framing & Camera Tilt (`Y = 13.5%–56.5%`)**: 19-cell hexagonal grid rendered at a `~52°–55°` isometric camera pitch (screen hex aspect ratio `~0.82:1` H:W). 18 cells hold single-color stacks of 5 tiles (red, yellow, green, blue) with crisp specular bevels and `~5–6px` per-layer front edge thickness; the bottom-center cell (`row 5, col 3`) is an empty recessed gray hexagonal socket (`#A4A4A4`) with an inner beveled lip.
     - **Bottom 3-Slot Dispenser Tray (`Y = 63.0%–75.5%`)**: Three candidate tile stacks (Blue ×5, Red ×5, Green ×5) spaced horizontally at `X ≈ 22.5%, 50.0%, 77.5%` with `~35px` (`5.8%` W) clear gutter between stacks.
     - **Bottom Banner (`Y = 79.5%–95.0%`)**: Store marketing sticker `"PERFECT TIME-KILLER!"` overlays the bottom booster zone.

3. **`play_screenshot_3.jpg` (`600×1067`) / `play_screenshot_10.jpg` (`600×801`) / `ios_screenshot_3.jpg` (`600×1300`) — `reference-symbols.jpg`**
   - **Source URL**: `https://play-lh.googleusercontent.com/g8ErRWEZu3bs6nLYFwklQ6DFT9m_kxRnDWyz6nHHEh8hKcK_MYienZH_9Gf0JnBEJagWSU21Zqp4O_PErPqALQ=w526-h296`
   - **Visual Findings**: Zoomed-in honeycomb board demonstrating redundant icon/symbol overlays printed on top of each colored hex tile: purple eggplant, yellow sunflower, orange smiling sun, green four-leaf clover, red flame, blue water droplet, and cyan hibiscus flower. A glowing white upward arrow guides the center tray stack (yellow sunflower ×8) into the single empty gray hex socket (`Y = 46%–54%`). Top HUD reads `321` coins and `0/800` goal.

4. **`play_screenshot_4.jpg` (`600×1067`) / `play_screenshot_11.jpg` (`600×801`) / `ios_screenshot_4.jpg` (`598×1300`)**
   - **Source URL**: `https://play-lh.googleusercontent.com/lBJ9dYOv9rM5yjpNyxV40VSMyNQiIkdFDtYpTBTPhJQk43dCmTtKK3xSbUdo1En5pMbppLsQ_BXabxFfRdDl=w526-h296`
   - **Visual Findings**: Mid-drag capture (`350` coins, `150/450` goal) showing the 3D hand dragging a multi-color stack (Red top over Cyan/Green base) across the board with a yellow dashed trajectory arc from an empty glowing slot. Only 2 stacks remain in the bottom tray (White/Green and Green/White), proving that the 3-slot dispenser tray only deals a new batch of 3 stacks once all 3 current stacks have been placed.

5. **`play_screenshot_5.jpg` (`600×1067`) / `play_screenshot_12.jpg` (`600×801`) / `ios_screenshot_6.jpg` (`598×1300`) — `reference-merge.jpg`**
   - **Source URL**: `https://play-lh.googleusercontent.com/yGuRZErKa5lcRE4JEcY4p6sFmBPutgMVT_mQm7V99KlP4yz5im96K-zQ2Q60iMHvQq2Rh0ibMozzSlqDUtq5lr4=w526-h296`
   - **Visual Findings**: Active tile-flip merge capture (`350` coins in Play / `450` coins in iOS, `150/450` in Play / `350/450` in iOS) on a 17-cell irregular hex board. Shows green tiles fanning through the air in a 3D hinge-flip arc (`30°`, `60°`, `90°` mid-air leaves) between adjacent stacks, plus two dark-gray locked board cells displaying a padlock icon and `100` (coin-unlockable grid cells).

6. **`play_screenshot_6.jpg` (`600×1067`) / `play_screenshot_13.jpg` (`600×801`) — `reference-meta.jpg`**
   - **Source URL**: `https://play-lh.googleusercontent.com/zXKNxlZTDvBgQWwVtIidRZyEsBB8bxzuCrSj1p112kX9d2hhS57u5yS-2YUpQWiG_TYYhICWrlClE8wIjgPZNA=w526-h296`
   - **Visual Findings**: Meta-progression screen (`"COLOR AND DECORATE!"`) showing an isometric low-poly 3D island diorama (camper van, pine trees, dog, picnic table, tent, campfire) split diagonally by a sparkling golden sweep line transitioning the scene from uncolored grayscale clay on the upper-right to fully painted vibrant colors on the lower-left.

7. **`play_screenshot_7.jpg` (`600×1067`) / `play_screenshot_14.jpg` (`600×801`)**
   - **Source URL**: `https://play-lh.googleusercontent.com/4-vjzfp7wcQGqa3kBYnPlJX2LsbmdRGlVnBUtVMaP-ZLrmR0afhzh8n2sJkZUL6uT8jGqIB6njqhC_2vyw8UzQ=w526-h296`
   - **Visual Findings**: Multi-world progression overview (`"EXPLORE WORLDS!"`) showing three vertically stacked diorama vignettes separated by sparkling diagonal dividers: (top) carnival Ferris wheel and carousel, (middle) red barn and sunflower farm, (bottom) lakeside camper campsite.

8. **`ios_screenshot_5.jpg` (`598×1300`)**
   - **Source URL**: `https://is1-ssl.mzstatic.com/image/thumb/PurpleSource221/v4/b3/47/19/b347190f-f987-4933-2bce-7763991db07d/SC-2.jpg/600x1300bb.jpg`
   - **Visual Findings**: Simultaneous multi-stack cascade capture (`600` coins, `170/450` goal, `"SATISFYING ASMR!"`) showing three separate color groups (yellow on left, red at top-center, purple on right) simultaneously flipping across adjacent stacks with white four-point sparkle particles.

9. **`play_icon.jpg` (`512×512`), `ios_icon.jpg` (`512×512`), and `play_promo.jpg` (`648×364`)**
   - **Visual Findings**: Both app icons depict a tall hexagonal prism composed of concentric rainbow rings of mini-hexagons (Play icon on a royal blue gradient background; iOS icon on a pitch-black background). `play_promo.jpg` is the October 2026 Halloween live-ops event banner showing a spooky alchemist library with glowing jack-o'-lanterns and a bubbling green cauldron.

---

## 3. Public Video Inspection & Gameplay Evidence Gap

- **Play Store Embedded Trailer Inspected (`play_trailer.mp4` / `reference-trailer-frame.jpg`)**:
  - Fetched directly from `https://play-games.googleusercontent.com/vp/mp4/1280x720/WBMNxsHXyIc.mp4` (`1280×720`, VP9, `20 fps`, `6.95s` duration, `139 frames`) and decomposed into 1-fps stills (`trailer_frame_01.jpg`–`07.jpg`).
  - **Observed Timestamps**:
    - `00:00.0–00:02.0` (`trailer_frame_01.jpg`–`02.jpg`): 3D hand drags a White/Purple stack from the bottom staging area into an empty gray hex cell adjacent to an existing White/Yellow stack; top White tiles hinge-flip across the shared hex edge onto the neighbor.
    - `00:02.5–00:04.0` (`trailer_frame_03.jpg`–`04.jpg`): The combined White stack reaches the 10-tile threshold and clears, uncovering the Yellow tiles underneath (`t=00:03.0s`), which immediately auto-cascade onto the adjacent Yellow stack (`t=00:04.0s`).
    - `00:04.5–00:05.5` (`trailer_frame_05.jpg`): Second stack placement triggers a Purple/Cyan cascade.
    - `00:05.8–00:06.95` (`trailer_frame_06.jpg`–`07.jpg`): Gaussian blur transition into the *Hexa Sort* logo end-card with three phone mockups.
- **Honest Documentation of Video & UI Capture Gaps**:
  - While the store screenshots and the 6.95s Play Store trailer directly establish board geometry, camera pitch, top HUD proportions, 3-slot tray spacing, tile-flip arc physics, cascade clears, and diorama meta-progression, **all store promotional assets replace the bottom 15% of the viewport with marketing text banners (`"SORT BY COLOR!"`, etc.) and omit the live in-game bottom 3-booster bar, out-of-space rescue modal, and main lobby navigation bar.**
  - Public gameplay documentation and community guides consulted via web search confirm the functional roles of the three standard bottom boosters (**Hammer** to smash/clear a single stack, **Hand/Swap** to reposition a board stack, and **Refresh/Reroll** to deal a new set of 3 tray stacks) and the **"Out of Space" rescue prompt** (offering extra slots or board clears when all hex cells fill). However, no unedited raw full-session gameplay video with HUD overlays was directly streamed or measured frame-by-frame. No randomized A/B user study or player preference claim is made.

---

## 4. Design Comparison: How *PopStacks: Art Toy Atelier* Preserves Proven Ergonomics While Replacing 100% of IP & Aesthetics

| Ergonomic / Structural Dimension | *Hexa Sort* Reference Observation | *PopStacks: Art Toy Atelier* Original Transformation |
| :--- | :--- | :--- |
| **Core Spatial Hierarchy (Portrait One-Handed Flow)** | Top HUD (`0–10%` H) → Isometric Hex Grid (`13–60%` H) → 3-Slot Dispenser Tray (`63–78%` H) → Bottom Booster Bar (`82–98%` H). | Preserves the exact top-to-bottom thumb-ergonomic vertical zoning on a `390×844` viewport (`0–13%` Top HUD, `13–68%` Isometric Hex Workbench, `68–86%` 3+1 Dispenser Tray, `86–98%` 3-Booster Dock with `≥48×48dp` targets). |
| **Camera Pitch & Stack Depth Readability** | `~52°–55°` isometric tilt exposing both top hex faces and front stack edges (`~5–6px` per layer) so players can estimate stack height at a glance. | Uses a `55°` isometric workbench tilt with thick `6px` matte-vinyl/ceramic disc bevels, top glaze specular highlights, and an explicit numeric stack-height badge (`7/10`) on every active stack. |
| **Color + Symbol Redundancy (Accessibility)** | Store screenshot #3 shows optional flat 2D icons (eggplant, sunflower, sun, clover) stamped onto bright primary plastic tiles. | Every vinyl color disc features a baked-in 3D embossed studio relief icon (Crown, Star, Heart, Bolt, Clover, Moon, Diamond, Flame) + toggleable High-Contrast Symbol Overlay mode across our warm bespoke 8-color Atelier palette (`#FF5A5F` Coral, `#FFB400` Marigold, `#00A896` Mint, `#3B82F6` Cobalt, `#8B5CF6` Lavender, `#EC4899` Rose, `#10B981` Jade, `#F97316` Tangerine). |
| **Visual Theme & World IP** | Generic flat light-gray background (`#CECECE`) with primary plastic hexagons and low-poly campsite/carnival coloring islands. | **100% original artisanal craft-workshop IP**: warm birch-wood workbench (`#F7F3EB`), recessed brass-rimmed ceramic sockets, *Ollie the Otter* master toy-maker mascot, and a **60-figurine 3D Blind-Box Vinyl Toy Showcase Gallery** (10 Series × 6 Figurines) replacing generic island coloring. |
| **Boosters, Fairness & Monetization** | Reviews on both stores cite frequent forced mid-game/post-level ads and deceptive pseudo-multiplayer league bots. | **Zero forced interstitial ads**, transparent deterministic single-player progression + seeded Daily Artisan Challenge, **Free 1-Step Undo** on accidental drops, and an explicit 3-Booster Dock (**Mallet/Hammer**, **Spatula Swap**, **4th Extra Staging Slot**) plus a fair **Out-of-Moves Rescue Modal**. |

---

## 5. Tooling & Platform Documentation Consulted

- **Google Play & App Store Live Listings**: Inspected October 17, 2026 via HTTP fetches (`urllib.request` + JSON-LD schema extraction).
- **Video Inspection**: `ffprobe` / `ffmpeg` (`v8.x` Homebrew macOS) used to inspect stream metadata and extract 1-fps keyframes from the Play Store VP9 preview (`WBMNxsHXyIc.mp4`).
- **Web & Mobile Target Standards**: Vite (`https://vite.dev/guide/`) and Capacitor Android workflow (`https://capacitorjs.com/docs/basics/workflow`), targeting a responsive `390×844` (9:19.5) mobile viewport with WCAG AA contrast and `≥48×48dp` touch targets.
