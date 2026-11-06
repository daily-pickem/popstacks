# PopStacks: Art Toy Atelier (`com.popstacks.atelier`)

**Hexagonal Vinyl Disc Sorting Puzzle & 3D Designer Toy Workshop**  
*100 Solver-Verified Levels · 60 Collectible Vinyl Figurines · Zero Forced Ads · Native Android APK*

---

## 🔗 Live Entrypoints & Packaged Artifacts

| Surface | Path / Link | Description |
| :--- | :--- | :--- |
| **Playable Game Entrypoint** | [`index.html`](./index.html) | Full 100-level HTML5/Canvas mobile game with 5-tab Atelier Workshop, 3D Turntable Inspector, Daily Challenge, and Web Audio ASMR synthesizer |
| **Live Side-by-Side Progress & Evaluation Dashboard** | [`progress.html`](./progress.html) | Interactive visual comparison workbench (`Hexa Sort` reference captures vs. `PopStacks` Iteration 1 → Iteration 2 build captures, 8 Play Store screenshots, 13-Workstream scorecard, and 100-level solver log) |
| **Compiled Native Android Debug APK** | [`artifacts/popstacks-atelier-debug.apk`](./artifacts/popstacks-atelier-debug.apk) | `15 MB` Capacitor 8 native Android package (`com.popstacks.atelier`) bundled with all 5 `mdpi`–`xxxhdpi` adaptive launcher & drawable density buckets |
| **100-Level Automated Solver Log** | [`evidence/solver-100-levels.json`](./evidence/solver-100-levels.json) | `100 / 100` levels solved deterministically (`100%` pass rate, `0` boosters used, `0` extra slots used, `2,208` cascades, `582` 10-disc bursts) |
| **Google Play Store Listing & ASO Copy** | [`store-listing/ASO_LISTING.md`](./store-listing/ASO_LISTING.md) | Title, 80-char short description, 4000-char full ASO description, and 8 `1080×1920` annotated Play Store screenshots in [`store-listing/screenshots/`](./store-listing/screenshots/) |

---

## 📱 Quick Start & Commands

```bash
# Serve playable game & progress.html locally
npm run dev

# Run standalone 100-level deterministic solver verification
npm test

# Rebuild production dist/ bundle and sync Capacitor Android project
npm run cap:sync

# Re-render all 8 (1080x1920) Google Play Store screenshots & evidence captures
node scripts/generate-store-screenshots.mjs
```
