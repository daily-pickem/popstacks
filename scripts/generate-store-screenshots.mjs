#!/usr/bin/env node
/**
 * PopStacks: Art Toy Atelier — Play Store Screenshot & Evidence Renderer
 * Uses Headless Google Chrome + CDP to capture live gameplay states and
 * render 8 high-converting 1080x1920 annotated Google Play Store screenshots.
 */
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'store-listing', 'screenshots');
const EVIDENCE_DIR = path.join(ROOT_DIR, 'evidence');
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function startStaticServer(rootDir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url, 'http://127.0.0.1');
      let relPath = decodeURIComponent(reqUrl.pathname);
      if (relPath === '/') relPath = '/index.html';
      const filePath = path.join(rootDir, relPath);
      if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function launchChrome() {
  return new Promise((resolve, reject) => {
    const userDataDir = path.join('/tmp', `popstacks-chrome-${Date.now()}`);
    const proc = spawn(CHROME_PATH, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--remote-debugging-port=0',
      `--user-data-dir=${userDataDir}`,
      '--window-size=1080,1920',
      'about:blank'
    ]);

    let stderrBuf = '';
    proc.stderr.on('data', (chunk) => {
      stderrBuf += chunk.toString();
      const match = stderrBuf.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) {
        resolve({ proc, wsEndpoint: match[1], userDataDir });
      }
    });
    proc.on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.wsUrl);
      this.ws = ws;
      ws.addEventListener('open', () => resolve());
      ws.addEventListener('error', (err) => reject(err));
      ws.addEventListener('message', (ev) => {
        const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message));
          else res(msg.result);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async screenshotPngBuffer(clip = null) {
    const params = { format: 'png', fromSurface: true };
    if (clip) {
      params.clip = { ...clip, scale: 1 };
      params.captureBeyondViewport = true;
    }
    const res = await this.send('Page.captureScreenshot', params);
    return Buffer.from(res.data, 'base64');
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildMarketingFrameHTML({ badge, headline, subhead, accentColor, bgGradient, screenshotBase64, calloutLeft, calloutRight, stepNum }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,800;9..144,900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 1080px;
      height: 1920px;
      overflow: hidden;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      background: ${bgGradient};
      color: #231F20;
      position: relative;
    }
    /* Decorative tactile studio background rings & hexes */
    .bg-decor-circle-1 {
      position: absolute;
      top: -140px;
      right: -140px;
      width: 580px;
      height: 580px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,255,255,0.52) 0%, rgba(255,255,255,0) 70%);
      pointer-events: none;
    }
    .bg-decor-circle-2 {
      position: absolute;
      bottom: -180px;
      left: -140px;
      width: 680px;
      height: 680px;
      border-radius: 50%;
      background: radial-gradient(circle, ${accentColor}33 0%, transparent 70%);
      pointer-events: none;
    }
    .studio-grid-overlay {
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(35, 31, 32, 0.08) 2px, transparent 2px);
      background-size: 36px 36px;
      pointer-events: none;
    }
    .promo-header {
      position: relative;
      z-index: 5;
      padding: 64px 64px 28px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 18px;
    }
    .eyebrow-pill {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: #231F20;
      color: #FAF7F2;
      padding: 10px 26px;
      border-radius: 999px;
      font-size: 21px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border: 3px solid ${accentColor};
      box-shadow: 0 6px 0 rgba(35,31,32,0.22);
    }
    .eyebrow-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: ${accentColor};
      display: inline-block;
    }
    .headline {
      font-family: 'Fraunces', Georgia, serif;
      font-weight: 900;
      font-size: 54px;
      line-height: 1.09;
      letter-spacing: -0.02em;
      color: #231F20;
      text-shadow: 0 3px 0 rgba(255, 255, 255, 0.85);
      max-width: 950px;
    }
    .subhead-bar {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 253, 248, 0.92);
      border: 2.5px solid #231F20;
      border-radius: 18px;
      padding: 10px 26px;
      font-size: 23px;
      font-weight: 800;
      color: #3D3531;
      box-shadow: 0 5px 0 #231F20;
    }
    /* Phone Bezel Stage */
    .phone-stage {
      position: relative;
      z-index: 4;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-top: 12px;
    }
    .phone-chassis {
      width: 690px;
      height: 1445px;
      background: #231F20;
      border-radius: 62px;
      padding: 18px;
      border: 5px solid #4A423F;
      box-shadow:
        0 34px 70px rgba(35, 31, 32, 0.38),
        0 10px 0 #141112,
        inset 0 2px 4px rgba(255, 255, 255, 0.25);
      position: relative;
      display: flex;
      flex-direction: column;
    }
    .phone-notch {
      position: absolute;
      top: 28px;
      left: 50%;
      transform: translateX(-50%);
      width: 148px;
      height: 24px;
      background: #141112;
      border-radius: 999px;
      z-index: 10;
      border: 1.5px solid rgba(255,255,255,0.12);
    }
    .phone-screen {
      width: 100%;
      height: 100%;
      border-radius: 46px;
      overflow: hidden;
      background: #F7F3EB;
      position: relative;
      border: 2px solid #141112;
    }
    .phone-screen img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top center;
      display: block;
    }
    /* Floating Callout Badges */
    .floating-callout {
      position: absolute;
      z-index: 12;
      background: #FFFDF9;
      border: 3.5px solid #231F20;
      border-radius: 24px;
      padding: 14px 22px;
      box-shadow: 0 10px 0 #231F20, 0 16px 32px rgba(0,0,0,0.22);
      display: flex;
      align-items: center;
      gap: 14px;
      max-width: 340px;
    }
    .floating-callout.left {
      left: 34px;
      bottom: 240px;
      transform: rotate(-2.5deg);
    }
    .floating-callout.right {
      right: 34px;
      top: 520px;
      transform: rotate(2.5deg);
    }
    .callout-icon {
      width: 54px;
      height: 54px;
      border-radius: 16px;
      background: ${accentColor};
      border: 2.5px solid #231F20;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      flex-shrink: 0;
    }
    .callout-copy strong {
      display: block;
      font-size: 21px;
      font-weight: 800;
      color: #231F20;
      line-height: 1.15;
    }
    .callout-copy span {
      display: block;
      font-size: 16px;
      font-weight: 700;
      color: #5C534E;
      margin-top: 2px;
    }
    .corner-brand-pill {
      position: absolute;
      bottom: 26px;
      right: 48px;
      z-index: 15;
      background: #231F20;
      color: #FAF7F2;
      padding: 8px 20px;
      border-radius: 999px;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: 0.05em;
      border: 2px solid ${accentColor};
    }
  </style>
</head>
<body>
  <div class="bg-decor-circle-1"></div>
  <div class="bg-decor-circle-2"></div>
  <div class="studio-grid-overlay"></div>

  <header class="promo-header">
    <div class="eyebrow-pill">
      <span class="eyebrow-dot"></span>
      <span>${badge}</span>
    </div>
    <h1 class="headline">${headline}</h1>
    <div class="subhead-bar">${subhead}</div>
  </header>

  <div class="phone-stage">
    <div class="floating-callout left">
      <div class="callout-icon">${calloutLeft.icon}</div>
      <div class="callout-copy">
        <strong>${calloutLeft.title}</strong>
        <span>${calloutLeft.sub}</span>
      </div>
    </div>

    <div class="phone-chassis">
      <div class="phone-notch"></div>
      <div class="phone-screen">
        <img src="data:image/png;base64,${screenshotBase64}" alt="Gameplay Screenshot" />
      </div>
    </div>

    <div class="floating-callout right">
      <div class="callout-icon">${calloutRight.icon}</div>
      <div class="callout-copy">
        <strong>${calloutRight.title}</strong>
        <span>${calloutRight.sub}</span>
      </div>
    </div>
  </div>

  <div class="corner-brand-pill">POPSTACKS: ART TOY ATELIER · ${stepNum}/8</div>
</body>
</html>`;
}

async function main() {
  const { server, port } = await startStaticServer(ROOT_DIR);
  console.log(`Static server listening on http://127.0.0.1:${port}`);

  const { proc, wsEndpoint, userDataDir } = await launchChrome();
  console.log(`Chrome launched: ${wsEndpoint}`);

  try {
    const debugUrl = new URL(wsEndpoint);
    const listRes = await fetch(`http://127.0.0.1:${debugUrl.port}/json/list`);
    const targets = await listRes.json();
    const pageTarget = targets.find((t) => t.type === 'page');
    if (!pageTarget) throw new Error('No page target found in Chrome');

    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // Set mobile viewport (412x892 @ 2x DPR -> 824x1784 crisp capture)
    const setMobileViewport = async () => {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: 412,
        height: 892,
        deviceScaleFactor: 2,
        mobile: true
      });
    };

    await setMobileViewport();
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/index.html` });
    await sleep(1200);

    // Wait for __POPSTACKS_DEBUG__ and sprites
    await cdp.eval(`new Promise((resolve) => {
      const check = () => {
        if (window.__POPSTACKS_DEBUG__ && window.__POPSTACKS_DEBUG__.game) {
          resolve(true);
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    })`);
    await sleep(500);

    // Also capture Level 1 FTUE onboarding first for evidence/
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      dbg.setScreen('board');
      dbg.loadLevel(1);
      dbg.game.render(performance.now());
    })()`);
    await sleep(300);
    const ftueBuf = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_10_ftue_level1.png'), ftueBuf);

    // -------------------------------------------------------------------------
    // 1. 01_workshop_hub.png
    // -------------------------------------------------------------------------
    console.log('Capturing 01_workshop_hub...');
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      g.profile.unlockedFigurines = dbg.Catalog.FIGURINES.slice(0, 5).map((f) => f.id);
      g.profile.currentMoldFigurineId = dbg.Catalog.FIGURINES[5].id;
      g.profile.moldProgress = 75;
      g.profile.coins = 2450;
      g.profile.prisms = 380;
      g.profile.keys = 2;
      g.profile.currentLevel = 8;
      g.profile.levelStars = { 1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 3 };
      g.setScreen('hub');
      g.updateMetaTopBar();
    })()`);
    await sleep(400);
    const raw01 = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_01_hub.png'), raw01);

    // -------------------------------------------------------------------------
    // 2. 02_core_cascade_loop.png
    // -------------------------------------------------------------------------
    console.log('Capturing 02_core_cascade_loop...');
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      g.hideDeadlockModal();
      document.getElementById('level-win-modal').classList.add('hidden');
      document.getElementById('unboxing-modal').classList.add('hidden');
      document.getElementById('turntable-modal').classList.add('hidden');
      g.setScreen('board');
      g.loadLevel(12);
      g.ftueSkipped = true;
      g.updateFtueBanner();
      // Populate rich 19-slot board around (0,0) for an authentic 10/10 BURST preview
      g.setCell(0, 0, [], { iceHp: 0, isAnvil: false });
      g.setCell(1, 0, [2, 2, 0, 0, 0], { iceHp: 0, isAnvil: false });
      g.setCell(0, -1, [1, 1, 0, 0, 0], { iceHp: 0, isAnvil: false });
      g.setCell(-1, 1, [3, 3, 3, 1, 1], { iceHp: 0, isAnvil: false });
      g.setCell(-1, 0, [4, 4, 2, 2, 2], { iceHp: 0, isAnvil: false });
      g.setCell(0, 1, [1, 1, 3, 3, 3, 3], { iceHp: 0, isAnvil: false });
      g.setCell(1, -1, [2, 2, 4, 4, 4], { iceHp: 0, isAnvil: false });
      g.setCell(2, -1, [0, 0, 1, 1], { iceHp: 0, isAnvil: false });
      g.setCell(-2, 1, [3, 3, 2, 2], { iceHp: 0, isAnvil: false });
      g.setCell(1, 1, [4, 4, 0, 0], { iceHp: 0, isAnvil: false });
      g.setCell(-1, 2, [1, 1, 1, 2], { iceHp: 0, isAnvil: false });
      g.setTray([
        [0, 0, 0, 0],
        [1, 1, 2, 2],
        [3, 3, 4]
      ]);
      const pos = g.axialToPixel(0, 0);
      g.dragState = {
        active: true,
        trayIndex: 0,
        snappedKey: '0,0',
        pointerX: pos.x,
        pointerY: pos.y + 26,
        dragX: pos.x,
        dragY: pos.y - 16,
        movedSignificantly: true
      };
      g.score = 1850;
      g.clears = 9;
      g.combo = 3;
      g.clearedByColor.coral = 8;
      g.clearedByColor.cobalt = 9;
      g.clearedByColor.mint = 6;
      g.totalDiscsCleared = 23;
      g.updateHUD();
      g.render(performance.now());
    })()`);
    await sleep(350);
    const raw02 = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_02_board_cascade.png'), raw02);

    // -------------------------------------------------------------------------
    // 3. 03_obstacles_37slot.png
    // -------------------------------------------------------------------------
    console.log('Capturing 03_obstacles_37slot...');
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      g.dragState.active = false;
      g.dragState.snappedKey = null;
      g.setScreen('board');
      g.loadLevel(65);
      // Add extra colorful stacks across the 37-slot board so it looks mid-solve
      const sampleStacks = [
        { q: 0, r: 0, s: [0, 0, 1, 1, 1] },
        { q: 1, r: 0, s: [2, 2, 2, 1, 1] },
        { q: -1, r: 1, s: [3, 3, 0, 0, 0] },
        { q: 0, r: -2, s: [4, 4, 2, 2] },
        { q: 2, r: -1, s: [5, 5, 3, 3, 3] },
        { q: -2, r: 1, s: [1, 1, 4, 4] },
        { q: 1, r: 1, s: [0, 0, 5, 5] },
        { q: -1, r: -1, s: [2, 2, 3, 3, 3] },
        { q: 2, r: 0, s: [4, 4, 4, 0, 0] },
        { q: -2, r: 2, s: [1, 1, 2, 2] }
      ];
      sampleStacks.forEach((item) => {
        const c = g.cells.get(item.q + ',' + item.r);
        if (c && !c.isAnvil && c.iceHp === 0 && c.stack.length === 0) {
          c.stack = item.s;
        }
      });
      g.score = 3420;
      g.clears = 14;
      g.combo = 2;
      g.totalDiscsCleared = 32;
      g.clearedByColor.coral = 10;
      g.clearedByColor.cobalt = 8;
      g.clearedByColor.mint = 8;
      g.clearedByColor.mustard = 6;
      g.updateHUD();
      g.render(performance.now());
    })()`);
    await sleep(350);
    const raw03 = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_03_obstacles_37slot.png'), raw03);

    // -------------------------------------------------------------------------
    // 4. 04_booster_hammer.png
    // -------------------------------------------------------------------------
    console.log('Capturing 04_booster_hammer...');
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      g.dragState.active = false;
      g.setScreen('board');
      g.loadLevel(26);
      // Populate several stacks and Frozen Clay tiles for Hammer targeting
      g.setCell(0, 0, [0, 0, 0, 2, 2, 2], { iceHp: 2 });
      g.setCell(1, 0, [1, 1, 3, 3, 3, 3]);
      g.setCell(-1, 1, [2, 2, 0, 0, 0]);
      g.setCell(0, -1, [4, 4, 1, 1, 1], { iceHp: 1 });
      g.setCell(1, -1, [3, 3, 2, 2]);
      g.setCell(-1, 0, [0, 0, 4, 4, 4]);
      g.extraSlotUnlocked = true;
      g.tray[3] = { discs: [2, 2, 2], scale: 1, offsetY: 0 };
      g.activateBooster('hammer');
      g.score = 2190;
      g.clears = 11;
      g.updateHUD();
      g.render(performance.now());
    })()`);
    await sleep(350);
    const raw04 = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_04_booster_hammer.png'), raw04);

    // -------------------------------------------------------------------------
    // 5. 05_figurine_unboxing.png (Plus Level Win Modal in evidence/)
    // -------------------------------------------------------------------------
    console.log('Capturing 05_figurine_unboxing...');
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      g.cancelBoosterMode();
      g.maxCombo = 4;
      g.profile.moldProgress = 50;
      g.triggerLevelWinModal();
    })()`);
    await sleep(350);
    const rawWin = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_05a_level_win.png'), rawWin);

    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      document.getElementById('level-win-modal').classList.add('hidden');
      const kitsune = dbg.Catalog.FIGURINES[1]; // Kitsune Mask
      g.triggerUnboxingModal(kitsune);
      g.revealBlindBoxFigurine();
      g.renderTurntableCanvases(performance.now());
    })()`);
    await sleep(400);
    const raw05 = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_05_figurine_unboxing.png'), raw05);

    // -------------------------------------------------------------------------
    // 6. 06_toy_showcase_gallery.png
    // -------------------------------------------------------------------------
    console.log('Capturing 06_toy_showcase_gallery...');
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      document.getElementById('unboxing-modal').classList.add('hidden');
      g.profile.unlockedFigurines = dbg.Catalog.FIGURINES.slice(0, 14).map((f) => f.id);
      g.setScreen('gallery');
    })()`);
    await sleep(350);
    const rawGalleryShelves = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_06a_gallery_shelves.png'), rawGalleryShelves);

    // Open 3D Turntable Inspector on Astro Bot (FIGURINES[2]) with Iridescent Gold glaze
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      g.inspectFigurine(dbg.Catalog.FIGURINES[2].id);
      g.turntableGlaze = 'gold';
      document.querySelectorAll('.glaze-btn').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-glaze') === 'gold');
      });
      g.renderTurntableCanvases(performance.now());
    })()`);
    await sleep(400);
    const raw06 = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_06_toy_showcase_gallery.png'), raw06);

    // -------------------------------------------------------------------------
    // 7. 07_daily_artisan_challenge.png
    // -------------------------------------------------------------------------
    console.log('Capturing 07_daily_artisan_challenge...');
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      document.getElementById('turntable-modal').classList.add('hidden');
      g.setScreen('daily');
    })()`);
    await sleep(350);
    const raw07 = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_07_daily_artisan_challenge.png'), raw07);

    // Also capture Daily Leaderboard subpanel for evidence/
    await cdp.eval(`(() => {
      document.getElementById('btn-daily-tab-board').click();
    })()`);
    await sleep(250);
    const raw07Board = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_07b_daily_leaderboard.png'), raw07Board);

    // -------------------------------------------------------------------------
    // 8. 08_deadlock_rescue_shop.png (Plus Deadlock Rescue Modal & Colorblind Mode)
    // -------------------------------------------------------------------------
    console.log('Capturing 08_deadlock_rescue_shop...');
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      g.setScreen('shop');
    })()`);
    await sleep(350);
    const raw08 = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_08_deadlock_rescue_shop.png'), raw08);

    // Also capture Deadlock Rescue Modal for evidence/
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      g.setScreen('board');
      g.loadPreset('deadlock');
      g.totalDiscsCleared = 24;
      g.placeStack(0, 0, 0, { instant: true });
      g.triggerDeadlockModal();
      g.render(performance.now());
    })()`);
    await sleep(350);
    const rawDeadlock = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_08b_deadlock_rescue.png'), rawDeadlock);

    // Also capture Colorblind High-Contrast Relief Symbols & Settings for evidence/
    await cdp.eval(`(() => {
      const dbg = window.__POPSTACKS_DEBUG__;
      const g = dbg.game;
      g.hideDeadlockModal();
      g.loadLevel(16);
      g.settings.colorblindMode = true;
      g.render(performance.now());
    })()`);
    await sleep(300);
    const rawColorblind = await cdp.screenshotPngBuffer();
    fs.writeFileSync(path.join(EVIDENCE_DIR, 'screen_09_colorblind_mode.png'), rawColorblind);

    // -------------------------------------------------------------------------
    // Render 8 Annotated 1080x1920 Google Play Store Promotional Frames
    // -------------------------------------------------------------------------
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1080,
      height: 1920,
      deviceScaleFactor: 1,
      mobile: false
    });

    const frames = [
      {
        filename: '01_workshop_hub.png',
        stepNum: 1,
        badge: '★ ART TOY ATELIER · 100 SOLVER-VERIFIED LEVELS',
        headline: 'Welcome to the Art Toy Atelier — Craft 60 Collectible Vinyl Figurines!',
        subhead: '🏺 10 Designer Toy Series · Warm Sunlit Birch Studio · Ollie Mascot Guide',
        accentColor: '#FF9F1C',
        bgGradient: 'linear-gradient(160deg, #FBF6EE 0%, #F2E2CE 52%, #E5CBB0 100%)',
        screenshotBase64: raw01.toString('base64'),
        calloutLeft: { icon: '🏺', title: '60 Vinyl Figurines', sub: '10 Collectible Series Sets' },
        calloutRight: { icon: '⭐', title: '100 Verified Levels', sub: '100% Deterministic Solver' }
      },
      {
        filename: '02_core_cascade_loop.png',
        stepNum: 2,
        badge: '⚡ 60 FPS TACTILE CASCADES · ASMR CERAMIC AUDIO',
        headline: 'Drag, Match & Trigger Satisfying 10-Disc Vinyl Cascades!',
        subhead: '💥 Live Neighbor Match Arcs · 10/10 Burst Previews · Multi-Chain Combos',
        accentColor: '#FF5A5F',
        bgGradient: 'linear-gradient(160deg, #FFF5F2 0%, #F8DFD6 52%, #EBC4B5 100%)',
        screenshotBase64: raw02.toString('base64'),
        calloutLeft: { icon: '💥', title: '10/10 Vinyl Burst!', sub: 'Cast Molten Vinyl Into Molds' },
        calloutRight: { icon: '🔊', title: 'ASMR Ceramic Clinks', sub: 'Pitch-Escalating Combo Chimes' }
      },
      {
        filename: '03_obstacles_37slot.png',
        stepNum: 3,
        badge: '❄️ 7, 19 & 37-SLOT WORKBENCHES · STUDIO OBSTACLES',
        headline: 'Master 7, 19 & 37-Slot Boards with Brass Anvils & Frozen Clay!',
        subhead: '⚒️ Route Cascades Around Fixed Brass Anvils · Crack Frozen Glaze Shells',
        accentColor: '#1E88E5',
        bgGradient: 'linear-gradient(160deg, #F2F7FC 0%, #DCEAF7 52%, #C3D9EE 100%)',
        screenshotBase64: raw03.toString('base64'),
        calloutLeft: { icon: '❄️', title: 'Frozen Clay Shells', sub: 'Crack With Adjacent 10-Bursts' },
        calloutRight: { icon: '⚒️', title: '37-Slot Master Grid', sub: 'Deep Spatial Routing Puzzles' }
      },
      {
        filename: '04_booster_hammer.png',
        stepNum: 4,
        badge: '🔨 TACTILE SCULPTOR TOOLS · INSTANT BOARD RESCUE',
        headline: 'Powerful Studio Boosters: Ceramic Hammer, Spatula Swap & Extra Slot!',
        subhead: '🔨 Smash Any Stack · 🔄 Reposition or Reroll Tray · ➕ Unlock 4th Staging Slot',
        accentColor: '#F4B942',
        bgGradient: 'linear-gradient(160deg, #FDF9EE 0%, #F5E6C4 52%, #E8CFA0 100%)',
        screenshotBase64: raw04.toString('base64'),
        calloutLeft: { icon: '🔨', title: 'Ceramic Hammer', sub: 'Smash Any Stack or Frozen Tile' },
        calloutRight: { icon: '➕', title: '4th Staging Slot', sub: 'Hold Tricky Stacks Safely' }
      },
      {
        filename: '05_figurine_unboxing.png',
        stepNum: 5,
        badge: '🎁 TACTILE FOIL BLIND-BOX UNBOXING · EVERY 2 LEVELS',
        headline: 'Cast & Unbox Blind-Box Designer Figurines on Every Clear!',
        subhead: '✨ Tear Open Foil Packs · Discover Common, Rare, Epic & Mythic Vinyl Toys',
        accentColor: '#9B5DE5',
        bgGradient: 'linear-gradient(160deg, #F9F4FC 0%, #EADCF6 52%, #D6C0EC 100%)',
        screenshotBase64: raw05.toString('base64'),
        calloutLeft: { icon: '🎁', title: 'Blind-Box Foil Tear', sub: 'Guaranteed New Figurine Reveals' },
        calloutRight: { icon: '✨', title: 'Mythic Glaze Rarity', sub: 'Collect All 60 Studio Creations' }
      },
      {
        filename: '06_toy_showcase_gallery.png',
        stepNum: 6,
        badge: '🔄 360° 3D TURNTABLE INSPECTOR · CUSTOM GLAZE FINISHES',
        headline: 'Collect 10 Toy Series Sets & Inspect in 360° 3D Turntable!',
        subhead: '🏺 Toggle Matte Vinyl, Kiln Gloss & Iridescent Gold Finishes on Birch Shelves',
        accentColor: '#00A896',
        bgGradient: 'linear-gradient(160deg, #F1FAF8 0%, #D5EFEA 52%, #B8E1D9 100%)',
        screenshotBase64: raw06.toString('base64'),
        calloutLeft: { icon: '🔄', title: '360° 3D Turntable', sub: 'Drag to Rotate Every Figurine' },
        calloutRight: { icon: '✨', title: '3 Custom Glaze Coats', sub: 'Matte, Kiln Gloss & Gold Sheen' }
      },
      {
        filename: '07_daily_artisan_challenge.png',
        stepNum: 7,
        badge: '📅 SEEDED DAILY KILN RUN · GLOBAL SCULPTOR LEADERBOARD',
        headline: 'Daily Artisan Challenge & Global Sculptor Leaderboard!',
        subhead: '🔥 Earn Monthly Artisan Crown Stamps · Compete on Identical Daily Seeds',
        accentColor: '#FB8500',
        bgGradient: 'linear-gradient(160deg, #FFF7EE 0%, #F7E2CA 52%, #EBC9A6 100%)',
        screenshotBase64: raw07.toString('base64'),
        calloutLeft: { icon: '📅', title: 'Daily Crown Calendar', sub: '31 Monthly Artisan Stamps' },
        calloutRight: { icon: '🏆', title: 'Fair Seeded Ranks', sub: 'Same Deterministic Board for All' }
      },
      {
        filename: '08_deadlock_rescue_shop.png',
        stepNum: 8,
        badge: '🛡️ 100% ETHICAL MONETIZATION · ZERO FORCED ADS',
        headline: 'Zero Forced Ads — Pure Calm Flow & Optional Studio Upgrades!',
        subhead: '👑 Collector Pass VIP · Starter Atelier Bundle · 100% Opt-In Reward Previews',
        accentColor: '#00A896',
        bgGradient: 'linear-gradient(160deg, #FBF8F1 0%, #ECE2CF 52%, #DCD0B8 100%)',
        screenshotBase64: raw08.toString('base64'),
        calloutLeft: { icon: '🛡️', title: 'Zero Forced Ads', sub: 'Never Interrupted Mid-Level' },
        calloutRight: { icon: '👑', title: 'Collector VIP Pass', sub: '∞ Hearts + Permanent 4th Slot' }
      }
    ];

    for (const frame of frames) {
      const html = buildMarketingFrameHTML(frame);
      const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
      await cdp.send('Page.navigate', { url: dataUrl });
      await sleep(450);
      const pngBuf = await cdp.screenshotPngBuffer({ x: 0, y: 0, width: 1080, height: 1920 });
      const outPath = path.join(SCREENSHOTS_DIR, frame.filename);
      fs.writeFileSync(outPath, pngBuf);
      console.log(`Saved ${frame.filename} (${(pngBuf.length / 1024).toFixed(1)} KB)`);
    }

    cdp.close();
  } finally {
    proc.kill('SIGKILL');
    server.close();
    fs.rmSync(userDataDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
