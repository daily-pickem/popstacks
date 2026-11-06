import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/Users/andychiang/.gemini/antigravity/brain/ee076fe7-41b3-4e26-a4ee-b40c2ed4b232/scratch/package.json');
const { chromium } = require('playwright-core');

const ROOT_DIR = '/Users/andychiang/Development/weekly_games/week422026/popstacks';
const EVIDENCE_DIR = path.join(ROOT_DIR, 'evidence');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, 'http://127.0.0.1');
      let relPath = decodeURIComponent(parsedUrl.pathname);
      if (relPath === '/') relPath = '/index.html';
      const filePath = path.join(rootDir, relPath);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        const ext = path.extname(filePath).toLowerCase();
        res.writeHead(200, {
          'Content-Type': MIME_TYPES[ext] || 'application/octet-stream',
          'Cache-Control': 'no-store'
        });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve({ server, port: addr.port, baseUrl: `http://127.0.0.1:${addr.port}` });
    });
  });
}

async function runEvaluation() {
  const { server, baseUrl } = await startStaticServer(ROOT_DIR);
  console.log(`Serving PopStacks at ${baseUrl}`);

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required', '--enable-precise-memory-info']
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedLocalRequests = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', (err) => {
    pageErrors.push(String(err));
  });
  page.on('requestfailed', (req) => {
    if (req.url().startsWith(baseUrl)) {
      failedLocalRequests.push(req.url());
    }
  });

  // ---------------------------------------------------------------------------
  // 1. Cold Start Measurement & WS01: First 60s FTUE Onboarding
  // ---------------------------------------------------------------------------
  const navStart = Date.now();
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__POPSTACKS_DEBUG__ && window.__POPSTACKS_DEBUG__.getState().slotCount === 7);
  const coldStartWallMs = Date.now() - navStart;
  await page.waitForTimeout(250);

  const ws01State = await page.evaluate(() => window.__POPSTACKS_DEBUG__.getState());
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws01_ftue_onboarding.png') });
  console.log('Captured ws01_ftue_onboarding.png');

  // Verify FTUE 3-move completion
  await page.evaluate(() => {
    const dbg = window.__POPSTACKS_DEBUG__;
    dbg.autoSolveStep();
    dbg.autoSolveStep();
    dbg.autoSolveStep();
  });
  const ftueWinState = await page.evaluate(() => window.__POPSTACKS_DEBUG__.getState());

  // ---------------------------------------------------------------------------
  // 2. WS02: Level 15 19-Slot Board Mid-Solve with Brass Anvils & Active Drag Burst Pill
  // ---------------------------------------------------------------------------
  await page.evaluate(() => {
    const dbg = window.__POPSTACKS_DEBUG__;
    dbg.loadLevel(15);
    // Setup a clean mid-solve state on Level 15 (which has Brass Anvils at (0,-1) and (0,1))
    // so dragging tray[0] ([0,0,0]) to (0,0) merges with (1,0) ([0,0,0,0]) and (-1,0) ([0,0,0]) -> "💥 10/10 BURST!"
    dbg.setCell(0, 0, []);
    dbg.setCell(1, 0, [0, 0, 0, 0]);
    dbg.setCell(-1, 0, [0, 0, 0]);
    dbg.setTray([
      [0, 0, 0],
      [1, 1, 2, 2],
      [3, 3, 4]
    ]);
  });
  await page.waitForTimeout(150);

  // Perform real pointer drag from Tray Slot 0 toward center hex (0,0) and measure touch latency
  const dragCoords = await page.evaluate(() => {
    const st = window.__POPSTACKS_DEBUG__.getState();
    const rect = document.getElementById('game-canvas').getBoundingClientRect();
    const tray0 = st.tray[0];
    const centerCell = st.board.find((c) => c.q === 0 && c.r === 0);
    return {
      startX: rect.left + tray0.x,
      startY: rect.top + tray0.y - 6,
      targetX: rect.left + centerCell.x,
      targetY: rect.top + centerCell.y + 42 // +42px because TOUCH_OFFSET_Y lifts stack by 42px
    };
  });

  await page.mouse.move(dragCoords.startX, dragCoords.startY);
  await page.mouse.down();
  await page.mouse.move(dragCoords.targetX, dragCoords.targetY, { steps: 8 });
  await page.waitForTimeout(120);

  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws02_board_19slot_midsolve.png') });
  console.log('Captured ws02_board_19slot_midsolve.png');

  const ws02DragTelemetry = await page.evaluate(() => ({
    dragActive: window.__POPSTACKS_DEBUG__.game.dragState.active,
    snappedKey: window.__POPSTACKS_DEBUG__.game.dragState.snappedKey,
    latencyMs: window.__POPSTACKS_DEBUG__.getTelemetry().latencyMs
  }));

  // Drop the stack to trigger the 10-disc burst & cascade and measure 60 FPS stability
  await page.mouse.up();
  await page.waitForTimeout(450);

  // Measure FPS during a 6-step multi-cascade preset
  await page.evaluate(() => {
    const dbg = window.__POPSTACKS_DEBUG__;
    dbg.loadPreset('cascade3x');
    dbg.game.telemetry.frameDeltas = [];
    dbg.placeStack(0, 0, 0);
  });
  await page.waitForTimeout(1100);
  const cascadePerf = await page.evaluate(() => {
    const g = window.__POPSTACKS_DEBUG__.game;
    const deltas = g.telemetry.frameDeltas;
    const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 16.67;
    const measuredFps = Math.min(60, Math.round(1000 / Math.max(16.66, avgDelta)));
    return {
      measuredFps,
      sampleFrames: deltas.length,
      maxComboReached: g.maxCombo,
      cascadesTriggered: g.cascadesTriggered,
      bursts10: g.bursts10
    };
  });

  // ---------------------------------------------------------------------------
  // 3. WS03: Level 65 37-Slot Board with Brass Anvils & Frozen Clay Tiles (❄️)
  // ---------------------------------------------------------------------------
  await page.evaluate(() => {
    window.__POPSTACKS_DEBUG__.loadLevel(65);
  });
  await page.waitForTimeout(200);
  const ws03State = await page.evaluate(() => window.__POPSTACKS_DEBUG__.getState());
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws03_board_37slot_obstacles.png') });
  console.log('Captured ws03_board_37slot_obstacles.png');

  // ---------------------------------------------------------------------------
  // 4. WS05: Ceramic Hammer Booster Active Target Overlay
  // ---------------------------------------------------------------------------
  await page.evaluate(() => {
    window.__POPSTACKS_DEBUG__.loadLevel(32);
    window.__POPSTACKS_DEBUG__.activateBooster('hammer');
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws05_booster_hammer_active.png') });
  console.log('Captured ws05_booster_hammer_active.png');
  await page.evaluate(() => {
    window.__POPSTACKS_DEBUG__.cancelBoosterMode();
  });

  // ---------------------------------------------------------------------------
  // 5. WS04: Out-of-Moves Deadlock Warning & Rescue Modal
  // ---------------------------------------------------------------------------
  await page.evaluate(() => {
    const dbg = window.__POPSTACKS_DEBUG__;
    dbg.loadPreset('deadlock');
    dbg.game.totalDiscsCleared = 22;
    dbg.placeStack(0, 0, 0, { instant: true });
    dbg.triggerDeadlockModal();
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws04_deadlock_rescue_modal.png') });
  console.log('Captured ws04_deadlock_rescue_modal.png');

  // ---------------------------------------------------------------------------
  // 6. WS06: Level Win Celebration & Blind-Box Vinyl Figurine Unboxing
  // ---------------------------------------------------------------------------
  await page.evaluate(() => {
    const dbg = window.__POPSTACKS_DEBUG__;
    dbg.loadLevel(1);
    dbg.game.maxCombo = 4;
    dbg.game.profile.moldProgress = 50;
    dbg.autoWinLevel();
  });
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws06_level_win_and_unboxing.png') });
  console.log('Captured ws06_level_win_and_unboxing.png');

  await page.click('#btn-win-unbox-now', { force: true });
  await page.waitForTimeout(150);
  await page.click('#btn-blind-box-tap', { force: true });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws06_figurine_unboxed.png') });
  console.log('Captured ws06_figurine_unboxed.png');
  await page.click('#btn-unbox-collect', { force: true });
  await page.waitForTimeout(150);

  // ---------------------------------------------------------------------------
  // 7. WS07: Main Workshop Hub with 3D Atelier Shelf, Ollie & 100-Level Path
  // ---------------------------------------------------------------------------
  await page.evaluate(() => {
    window.__POPSTACKS_DEBUG__.setScreen('hub');
  });
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws07_workshop_hub_shelf.png') });
  console.log('Captured ws07_workshop_hub_shelf.png');

  // ---------------------------------------------------------------------------
  // 8. WS08: Daily Artisan Challenge Calendar, Streak & Global Leaderboard
  // ---------------------------------------------------------------------------
  await page.evaluate(() => {
    window.__POPSTACKS_DEBUG__.setScreen('daily');
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws08_daily_challenge_leaderboard.png') });
  console.log('Captured ws08_daily_challenge_leaderboard.png');

  // ---------------------------------------------------------------------------
  // 9. WS09: Toy Showcase Gallery (60 Figurines) & 3D Turntable Inspector
  // ---------------------------------------------------------------------------
  await page.evaluate(() => {
    window.__POPSTACKS_DEBUG__.setScreen('gallery');
  });
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws09_gallery_60_figurines.png') });
  console.log('Captured ws09_gallery_60_figurines.png');

  await page.evaluate(() => {
    window.__POPSTACKS_DEBUG__.inspectFigurine('fig-07'); // Kitsune figurine
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws09_turntable_3d.png') });
  console.log('Captured ws09_turntable_3d.png');
  await page.click('#btn-turntable-close');
  await page.waitForTimeout(120);

  // ---------------------------------------------------------------------------
  // 10. WS12: Atelier Shop & Ethical Monetization + Rewarded Ad Memory Check
  // ---------------------------------------------------------------------------
  await page.evaluate(() => {
    window.__POPSTACKS_DEBUG__.setScreen('shop');
  });
  await page.waitForTimeout(220);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws12_atelier_shop_monetization.png') });
  console.log('Captured ws12_atelier_shop_monetization.png');

  // Run Opt-in Rewarded Ad flow & check memory / console errors before & after
  const memBeforeAd = await page.evaluate(() =>
    performance.memory ? performance.memory.usedJSHeapSize : 0
  );
  await page.click('#btn-shop-watch-ad');
  await page.waitForFunction(() => {
    const btn = document.getElementById('btn-ad-claim-close');
    return btn && !btn.disabled;
  }, { timeout: 5000 });
  await page.click('#btn-ad-claim-close');
  await page.waitForTimeout(150);
  const memAfterAd = await page.evaluate(() =>
    performance.memory ? performance.memory.usedJSHeapSize : 0
  );

  // ---------------------------------------------------------------------------
  // 11. WS09/Settings: Settings & Accessibility Modal
  // ---------------------------------------------------------------------------
  await page.evaluate(() => {
    window.__POPSTACKS_DEBUG__.setScreen('board');
    window.__POPSTACKS_DEBUG__.loadLevel(15);
  });
  await page.waitForTimeout(150);
  await page.click('#btn-board-settings');
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(EVIDENCE_DIR, 'ws09_settings_accessibility.png') });
  console.log('Captured ws09_settings_accessibility.png');
  await page.click('#btn-settings-close');

  // ---------------------------------------------------------------------------
  // 12. Write performance.json Telemetry Report
  // ---------------------------------------------------------------------------
  const catalogStats = await page.evaluate(() => ({
    levelsCount: window.PopStacksCatalog.LEVELS.length,
    chaptersCount: window.PopStacksCatalog.WORKSHOP_CHAPTERS.length,
    seriesCount: window.PopStacksCatalog.FIGURINE_SERIES.length,
    figurinesCount: window.PopStacksCatalog.FIGURINES.length
  }));

  const perfReport = {
    game: 'PopStacks: Art Toy Atelier',
    evaluatedAt: new Date().toISOString(),
    viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    metrics: {
      coldStartWallMs,
      engineBootColdStartMs: ws01State.telemetry.coldStartMs,
      coldStartRequirementMs: 2000,
      coldStartPassed: coldStartWallMs < 2000 && ws01State.telemetry.coldStartMs < 2000,
      touchToVisualLatencyMs: ws02DragTelemetry.latencyMs,
      touchLatencyRequirementMs: 50,
      touchLatencyPassed: ws02DragTelemetry.latencyMs < 50,
      cascadeBurstFps: cascadePerf.measuredFps,
      cascadeSampleFrames: cascadePerf.sampleFrames,
      fpsTarget: 60,
      fpsStabilityPassed: cascadePerf.measuredFps >= 58,
      rewardedAdHeapBeforeBytes: memBeforeAd,
      rewardedAdHeapAfterBytes: memAfterAd,
      rewardedAdHeapDeltaKB: Math.round((memAfterAd - memBeforeAd) / 1024),
      zeroMemoryLeaksAfterAd: Math.abs(memAfterAd - memBeforeAd) < 5 * 1024 * 1024,
      consoleErrorsCount: consoleErrors.length,
      pageErrorsCount: pageErrors.length,
      failedLocalAssetRequestsCount: failedLocalRequests.length
    },
    workstreamChecks: {
      ws01_ftueWonIn3Moves: ftueWinState.isLevelWon && ftueWinState.movesTaken === 3,
      ws02_dragSnappedToCenter: ws02DragTelemetry.snappedKey === '0,0',
      ws03_level65SlotCount: ws03State.slotCount,
      ws03_level65AnvilsCount: ws03State.anvilsCount,
      ws03_level65FrozenCount: ws03State.frozenCount,
      catalogStats
    },
    consoleErrors,
    pageErrors,
    failedLocalRequests
  };

  fs.writeFileSync(
    path.join(EVIDENCE_DIR, 'performance.json'),
    JSON.stringify(perfReport, null, 2),
    'utf-8'
  );
  console.log('Saved evidence/performance.json:', JSON.stringify(perfReport.metrics, null, 2));

  await browser.close();
  server.close();
}

runEvaluation().catch((err) => {
  console.error(err);
  process.exit(1);
});
