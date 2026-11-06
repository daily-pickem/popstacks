/**
 * PopStacks: Art Toy Atelier — Full 10-Screen Game Engine, 100-Level Campaign,
 * 7/19/37-Slot Isometric Hex Renderer, Anvil & Frozen Clay Physics,
 * 3-Booster Dock, 60-Figurine 3D Turntable Showcase, Daily Challenge & Ethical Shop.
 */
(function () {
  'use strict';

  const BOOT_START_TIME = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const Catalog = window.PopStacksCatalog;
  const VINYL_COLORS = Catalog.VINYL_COLORS;
  const AXIAL_DIRS = Catalog.AXIAL_DIRS;
  const BURST_THRESHOLD = Catalog.BURST_THRESHOLD;

  const TOUCH_OFFSET_Y = 42;        // 42px vertical touch offset so dragged stack floats clearly above thumb
  const Y_TILT = 0.82;              // 55-deg isometric vertical foreshortening
  const PLACEMENT_SPRING_MS = 180;  // Placement settle spring
  const TRANSFER_ARC_MS = 150;      // 150ms parabolic 3D disc hinge-flip tween
  const TRANSFER_STAGGER_MS = 52;   // Stagger between consecutive transferred discs
  const BURST_PEEL_STEP_MS = 20;    // 20ms per-disc top-to-bottom rapid ceramic peel

  // Map figurine silhouetteType to high-res sliced art assets
  const SILHOUETTE_IMAGE_MAP = {
    sprout: 'assets/art/fig_1_sprout.png',
    ears: 'assets/art/fig_1_sprout.png',
    fox: 'assets/art/fig_2_kitsune.png',
    helmet: 'assets/art/fig_3_astro.png',
    robo: 'assets/art/fig_3_astro.png',
    spirit: 'assets/art/fig_4_daruma.png',
    crown: 'assets/art/fig_4_daruma.png',
    cat: 'assets/art/fig_5_bear.png',
    golem: 'assets/art/fig_6_golem.png',
    owl: 'assets/art/ollie_mascot_cutout.png'
  };

  const GAME_UI_SPRITES = [
    'assets/art/ollie_mascot_cutout.png',
    'assets/art/icon_hammer.png',
    'assets/art/icon_swap.png',
    'assets/art/icon_extraslot.png',
    'assets/art/icon_chest.png'
  ];

  function getFigurineSpriteUrl(fig) {
    if (!fig || !fig.id) return 'assets/art/figurines/fig-01.webp';
    return `assets/art/figurines/${fig.id}.webp`;
  }

  // Trophy tier = rarity. Drives the material glow, shine strength and display styling.
  function getFigurineTier(fig) {
    return String((fig && fig.rarity) || 'Common').toLowerCase();
  }

  // Shared 3D trophy display: glow halo, tiltable cutout with a shine layer masked to
  // the figure's own silhouette, and a soft floor shadow. Locked figures render as a
  // dark silhouette of the real figure.
  function trophyMarkup(fig, opts = {}) {
    const url = getFigurineSpriteUrl(fig);
    const tier = getFigurineTier(fig);
    const locked = !!opts.locked;
    const size = opts.size ? ` size-${opts.size}` : '';
    const alt = locked ? 'Locked figurine' : fig.name;
    return `
      <div class="trophy-stage tier-${tier}${locked ? ' is-locked' : ''}${size}" style="--fig-url: url('${url}')">
        <div class="trophy-glow" aria-hidden="true"></div>
        <div class="trophy-tilt">
          <img class="trophy-img" src="${url}" alt="${alt}" loading="lazy" decoding="async" draggable="false" />
          <div class="trophy-shine" aria-hidden="true"></div>
        </div>
        <div class="trophy-shadow" aria-hidden="true"></div>
      </div>`;
  }

  const getTopColor = Catalog.getTopColor;
  const getTopContiguousCount = Catalog.getTopContiguousCount;
  const getColorGroups = Catalog.getColorGroups;
  const cellKey = Catalog.cellKey;
  const getColorKey = Catalog.getColorKey;
  const normalizeColorId = Catalog.normalizeColorId;

  // ===========================================================================
  // Main PopStacks Atelier Application Class
  // ===========================================================================
  class PopStacksGame {
    constructor() {
      this.canvas = document.getElementById('game-canvas');
      this.ctx = this.canvas.getContext('2d');
      this.audio = new window.PopStacksAudio();

      // Preload high-res figurine & 3D game UI sprites for 2D/3D canvas rendering
      this.spriteCache = {};
      [...Object.values(SILHOUETTE_IMAGE_MAP), ...GAME_UI_SPRITES].forEach((src) => {
        if (!this.spriteCache[src]) {
          const img = new Image();
          img.src = src;
          this.spriteCache[src] = img;
        }
      });

      // Ambient floating golden studio sparkles for 60fps board atmosphere
      this.ambientSparkles = Array.from({ length: 5 }, (_, i) => ({
        x: ((i * 53) % 360) + 15,
        y: ((i * 71) % 480) + 25,
        r: 1.6 + (i % 3) * 0.85,
        phase: i * 0.7,
        speedY: 7 + (i % 4) * 3.5,
        speedX: (i % 2 === 0 ? 1 : -1) * (3 + (i % 3) * 1.5)
      }));

      // Session-Guarded Timer Management
      this.sessionId = 1;
      this.activeTimers = new Set();

      // Persistent Player Profile & Meta State
      this.profile = {
        currentLevel: 1,
        highestUnlockedLevel: 1,   // Strict sequential progression: Level 1 -> 100 -> Endless 101+
        levelStars: {},            // levelNum -> 1..3
        levelBestScores: {},       // levelNum -> highest score achieved on that puzzle
        levelBestCombos: {},       // levelNum -> highest multiplier achieved on that puzzle
        coins: 1450,
        prisms: 250,
        keys: 3,
        hearts: 5,
        maxHearts: 5,
        heartRefillEndMs: 0,
        collectorPass: false,
        starterBundleClaimed: false,
        boosters: {
          hammer: 3,
          swap: 3,
          extraslot: 2
        },
        moldProgress: 100,         // Ready for the player's first guaranteed "Rare" Gacha pull!
        currentMoldFigurineId: 'fig-01',
        unlockedFigurines: ['fig-01'],
        figurineCounts: { 'fig-01': 1 }, // Tracks duplicates (×2, ×3...)
        equippedFigurineId: 'fig-01',    // Pokémon GO–style Equipped Buddy (transforms board & disc style/colors)
        starChestsClaimed: 0,
        gachaPullCount: 0,         // Total Japanese Gashapon pulls (tracks 5-pull SR+ & 10-pull 天井 SSR/UR pity)
        recentPullIds: ['fig-01'], // Anti-repeat history for cross-series gacha variety
        featuredFigurineId: 'fig-01',
        shelfTheme: 'oak',
        selectedChapter: 1,
        selectedSeriesFilter: 'all',
        dailyStreak: 5,
        dailyCompletedDates: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16']
      };
      this.loadSavedProfile();
      if (this.audio && typeof this.audio.setEquippedFigurineTrack === 'function') {
        this.audio.setEquippedFigurineTrack(this.getActiveMusicTrackFigurineId(), false);
      }

      // Accessibility & Ergonomic Settings
      this.settings = {
        colorblindMode: false,
        reducedMotion: false,
        thumbReach: 'center' // 'left' | 'center' | 'right'
      };

      // Active Screen & Level State
      this.activeScreen = 'board'; // 'hub' | 'board' | 'daily' | 'gallery' | 'shop'
      this.currentLevelNum = 1;
      this.currentLevelDef = Catalog.getLevelConfig(1);
      this.isDailyMode = false;

      this.gridRadius = 1;
      this.seedString = 'POPSTACKS-L001-FTUE';
      this.rng = Catalog.createMulberry32(Catalog.hashSeedString(this.seedString));

      this.cells = new Map();
      this.cellList = [];
      this.tray = [null, null, null, null]; // 3 primary slots + 4th Extra Staging Slot
      this.extraSlotUnlocked = false;
      this.waveIndex = 0;

      // Level Objective & Telemetry Tracking
      this.clearedByColor = {
        coral: 0,
        cobalt: 0,
        mustard: 0,
        mint: 0,
        plum: 0,
        terracotta: 0
      };
      this.totalDiscsCleared = 0;
      this.movesTaken = 0;
      this.cascadesTriggered = 0;
      this.bursts10 = 0;
      this.frozenCleared = 0;
      this.iceDamageDealt = 0;
      this.score = 0;
      this.bestScore = 0;
      this.clears = 0;
      this.combo = 0;
      this.maxCombo = 1;
      this.activeMultiplier = 1;
      this.burstStreak = 0;
      this.turnBurstsCount = 0;
      this.scoreBreakdown = { bursts: 0, merges: 0, overstack: 0, efficiency: 0 };
      this.kilnFever = 0;            // 0..100% Kiln Fever Meter
      this.overdriveMovesLeft = 0;   // 3 moves of 2x Score & Thermal Shockwave when Fever hits 100%
      this.overdriveTotalTriggered = 0;
      this.boardShake = 0;
      this.hintsUsedThisRound = 0;
      this.chimeStep = 0;
      this.isDeadlocked = false;
      this.isLevelWon = false;
      this.unboxFromWin = false;
      this.bonusSpinUsedThisUnbox = false;
      this.lowSpaceWarned = false;
      this.undoSnapshot = null;
      this.recommendedCellKey = null;
      this.ftueSkipped = false;

      // Ad Revenue & Mediation Telemetry State (Rewarded Video + Paced Interstitials; IAP Deferred)
      this.adStats = {
        rewardedAdsWatched: 0,
        interstitialAdsShown: 0,
        estimatedRevenueUsd: 0,
        watchedRewardedThisRound: false,
        roundsSinceLastInterstitial: 0,
        lastPlacement: null,
        placements: {
          deadlock_rescue: 0,
          win_2x_prisms: 0,
          unbox_bonus_spin: 0,
          booster_hammer: 0,
          booster_swap: 0,
          booster_extraslot: 0,
          vip_pass: 0,
          starter_crate: 0,
          shop_prisms_hammer: 0,
          shop_prisms_vault: 0,
          between_round_interstitial: 0
        }
      };

      // Active Booster State ('hammer' | 'swap' | null)
      this.activeBooster = null;
      this.swapSourceCellKey = null;

      // Layout & Pinch-to-Zoom Metrics
      this.dpr = window.devicePixelRatio || 1;
      this.width = 390;
      this.height = 560;
      this.baseBoardCenterX = 195;
      this.baseBoardCenterY = 230;
      this.boardCenterX = 195;
      this.boardCenterY = 230;
      this.baseHexRadius = 42;
      this.hexRadius = 42;
      this.discThickness = 7.5;
      this.boardZoom = 1.0;
      this.boardPanX = 0;
      this.boardPanY = 0;
      this.pinchState = {
        active: false,
        startDist: 0,
        startZoom: 1,
        startMidX: 0,
        startMidY: 0,
        startPanX: 0,
        startPanY: 0,
        singlePanActive: false,
        panStartX: 0,
        panStartY: 0
      };
      this.trayY = 470;
      this.traySlotPositions = [
        { x: 75, y: 470 },
        { x: 165, y: 470 },
        { x: 255, y: 470 },
        { x: 335, y: 470 }
      ];

      // Drag & Tap Selection State
      this.dragState = {
        active: false,
        trayIndex: -1,
        pointerId: null,
        startX: 0,
        startY: 0,
        pointerX: 0,
        pointerY: 0,
        dragX: 0,
        dragY: 0,
        snappedKey: null,
        snappedExtraTray: false,
        movedSignificantly: false
      };
      this.selectedTrayIndex = -1;
      this.hoveredCellKey = null;

      // Tween, Transfer, Popping Disc, Objective Mini-Disc & Particle Queues
      this.tweens = [];
      this.flyingDiscs = [];
      this.poppingDiscs = [];
      this.objectiveFlyingDiscs = [];
      this.particles = [];
      this.floatingTexts = [];
      this.shockwaves = [];

      // Cascade Evaluation State Machine & Step Debugger
      this.evaluationQueue = [];
      this.isProcessingCascade = false;
      this.stepMode = false;
      this.pausedNextAction = null;
      this.debugVisualHint = null;
      this.cascadeLog = [];

      // 3D Turntable Inspector & Blind-Box Unboxing State
      this.inspectedFigurine = Catalog.FIGURINES[0];
      this.turntableAngle = 0.35;
      this.turntableDragging = false;
      this.turntableDragStartX = 0;
      this.turntableGlaze = 'matte'; // 'matte' | 'gloss' | 'gold'
      this.pendingUnboxFigurine = null;
      this.pendingChestBoosted = false;
      this.pendingCraftFigurine = null;
      this.capsuleFoundThisRound = false;
      this.activeAdCallback = null;

      // Telemetry Metrics
      this.telemetry = {
        fps: 60,
        frameDeltas: [],
        lastFrameTime: performance.now(),
        latencyMs: 0.7,
        coldStartMs: 0,
        activeTweens: 0
      };

      this.initUI();
      this.parseInitialUrlParams();
      this.handleResize();
      window.addEventListener('resize', () => this.handleResize());

      // Start 1s Heart Timer Tick
      setInterval(() => this.tickHeartTimer(), 1000);

      // Start 60fps render & tween loop
      this.lastTick = performance.now();
      this.telemetry.coldStartMs = Math.round(Math.max(12, this.lastTick - BOOT_START_TIME));
      const dbgCold = document.getElementById('dbg-coldstart');
      if (dbgCold) dbgCold.textContent = `${this.telemetry.coldStartMs} ms`;

      const loop = (now) => {
        requestAnimationFrame(loop);
        try {
          this.tick(now);
        } catch (err) {
          console.error('Tick error recovered:', err);
        }
      };
      requestAnimationFrame(loop);
    }

    getSocialBenchmarkSafe(lvlNum, lvlDef) {
      if (typeof Catalog.getLevelSocialBenchmark === 'function') {
        try {
          const b = Catalog.getLevelSocialBenchmark(lvlNum, lvlDef);
          if (b && typeof b.computeStars === 'function') return b;
        } catch (_e) {}
      }
      const def = lvlDef || Catalog.getLevelConfig(lvlNum) || {};
      const goalDiscs = (def.objective && def.objective.totalDiscsGoal) || 30;
      const burstsNeeded = Math.max(2, Math.round(goalDiscs / 10));
      const par3Moves = def.par3Moves || (lvlNum === 1 ? 3 : Math.max(6, Math.round(goalDiscs * 0.34)));
      const par2Moves = def.par2Moves || (par3Moves + Math.max(3, Math.ceil(par3Moves * 0.35)));
      const baseParScore = Math.max(600, Math.round(burstsNeeded * 300));
      const star1 = Math.round(burstsNeeded * 200);
      const star2 = Math.round(burstsNeeded * 450);
      const star3 = Math.round(burstsNeeded * 650);
      return {
        level: lvlNum,
        solverMoves: def.solverMoves || par3Moves,
        par3Moves,
        par2Moves,
        baseParScore,
        starThresholds: {
          par3Moves,
          par2Moves,
          star1,
          star2,
          star3,
          minComboStar2: 2,
          minComboStar3: 3
        },
        computeStars: (movesTaken) => {
          const m = Math.max(1, Math.floor(Number(movesTaken) || 1));
          if (m <= par3Moves) return 3;
          if (m <= par2Moves) return 2;
          return 1;
        },
        rivals: [
          { handle: 'Hana S.', badge: `★★★ (${Math.max(2, par3Moves - 1)} turns)`, moves: Math.max(2, par3Moves - 1), score: Math.round(star3 * 1.18), maxCombo: 5 },
          { handle: 'Leo C.', badge: `★★★ (${par3Moves} turns · Par)`, moves: par3Moves, score: Math.round(star3 * 1.02), maxCombo: 3 },
          { handle: 'Community Avg', badge: `★★ (${par2Moves - 1} turns)`, moves: par2Moves - 1, score: Math.round(star2 * 1.04), maxCombo: 2 }
        ],
        computeTopPercent: (_sc, movesTaken = par3Moves) => {
          const m = Number(movesTaken) || par3Moves;
          return m < par3Moves ? 1 : m === par3Moves ? 8 : m <= par2Moves ? 25 : 58;
        }
      };
    }

    getEquippedCosmeticKit() {
      const figId = this.profile.equippedFigurineId;
      if (typeof Catalog.getFigurineCosmeticKit === 'function') {
        try {
          return Catalog.getFigurineCosmeticKit(figId);
        } catch (_e) {}
      }
      return {
        id: 'classic',
        figurine: null,
        name: 'Classic Studio Birch',
        kitTitle: 'Classic Birch Workbench',
        discStyle: 'classic',
        discStyleLabel: 'Matte Studio Vinyl Discs',
        isDarkStage: false,
        stageBgTop: '#F7F3EB',
        stageBgBottom: '#EFE6D5',
        deckStop0: '#F7EFE1',
        deckStop1: '#E9DCC6',
        deckStop2: '#D8C5A8',
        rimFill: '#A68358',
        rimStroke: '#5C4028',
        inlayStroke: 'rgba(212, 163, 73, 0.55)',
        rivetFill: '#D4A349',
        socketOuter: '#FAF6EE',
        socketWell: '#DED3C1',
        socketStroke: '#C4B59E',
        snapFill: '#D9F4EE',
        snapStroke: '#00A896',
        trayDeck: '#FFFFFF',
        trayLip: '#E6D9C4',
        traySlotFill: '#FAF7F2',
        traySlotStroke: '#B89B72',
        crestColor: '#D4A349',
        discPalette: VINYL_COLORS.map((c) => ({ ...c }))
      };
    }

    getDiscColorMeta(colorId) {
      const cid = normalizeColorId(colorId);
      const kit = this.getEquippedCosmeticKit();
      if (kit && Array.isArray(kit.discPalette) && kit.discPalette[cid]) {
        return kit.discPalette[cid];
      }
      return VINYL_COLORS[cid] || VINYL_COLORS[0];
    }

    equipFigurine(figIdOrNull, options = {}) {
      if (figIdOrNull && !this.profile.unlockedFigurines.includes(figIdOrNull)) {
        return false;
      }
      this.profile.equippedFigurineId = figIdOrNull || null;
      this.saveProfile();
      if (this.audio && typeof this.audio.setEquippedFigurineTrack === 'function') {
        this.audio.setEquippedFigurineTrack(this.profile.equippedFigurineId, true);
      }

      // Close figurine detail inspector modal and take user to the main Collection view
      const ttModal = document.getElementById('turntable-modal');
      if (ttModal && !ttModal.classList.contains('hidden')) {
        ttModal.classList.add('hidden');
        if (window.PopStacks3DViewer) window.PopStacks3DViewer.stopLoop();
      }
      if (options.navigateToGallery !== false && this.activeScreen !== 'gallery') {
        this.setScreen('gallery');
      }

      this.applyEquippedCosmeticToDOM();
      this.updateHUD();
      this.renderGalleryUI();
      this.triggerGalleryEquipCelebration(this.profile.equippedFigurineId);
      return true;
    }

    triggerGalleryEquipCelebration(equippedFigId) {
      const scrollEl = document.getElementById('gallery-scroll-content');
      if (scrollEl) {
        scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
      }

      const buddyCard = document.getElementById('gallery-buddy-card');
      const fxLayer = document.getElementById('gallery-buddy-fx-layer');
      const banner = document.getElementById('gallery-equip-banner');
      const bannerTitle = document.getElementById('gallery-equip-banner-title');
      const bannerSub = document.getElementById('gallery-equip-banner-sub');

      const kit = this.getEquippedCosmeticKit();
      const fig = kit.figurine;
      const trackLabel =
        this.audio && this.audio.currentTrack && this.audio.currentTrack.instrumentLabel
          ? this.audio.currentTrack.instrumentLabel
          : 'Atelier Soundtrack';

      const shortKitName = String(kit.kitTitle || 'Studio Kit').split('·')[0].trim();
      const vibrantColor =
        fig && !['#faf7f2', '#fffdf7', '#f4efe6', '#ffffff'].includes(String(fig.primaryColor).toLowerCase())
          ? fig.primaryColor
          : (fig && (fig.secondaryColor || fig.accentColor)) || '#FF9F1C';

      if (banner && bannerTitle && bannerSub) {
        if (fig) {
          bannerTitle.textContent = `${fig.name} Equipped!`;
          bannerSub.textContent = `${shortKitName} · ${trackLabel}`;
          banner.style.setProperty('--equip-accent', vibrantColor);
        } else {
          bannerTitle.textContent = 'Classic Studio Birch Active';
          bannerSub.textContent = 'Original Birch Workbench & Vinyl Discs Restored';
          banner.style.setProperty('--equip-accent', '#D97706');
        }
        banner.classList.remove('hidden', 'equip-banner-pop');
        void banner.offsetWidth;
        banner.classList.add('equip-banner-pop');
        if (this._equipBannerTimer) clearTimeout(this._equipBannerTimer);
        this._equipBannerTimer = setTimeout(() => {
          banner.classList.add('hidden');
        }, 3800);
      }

      if (buddyCard) {
        buddyCard.classList.remove('equip-celebrate-burst');
        void buddyCard.offsetWidth;
        buddyCard.classList.add('equip-celebrate-burst');
      }

      if (fxLayer) {
        fxLayer.innerHTML = '';
        const palette = (kit.discPalette || []).map((c) => c.top);
        const burstColors = palette.length ? palette : ['#FFD166', '#2EC4B6', '#FF5964', '#38BDF8'];
        for (let i = 0; i < 14; i++) {
          const sp = document.createElement('span');
          sp.className = 'buddy-equip-sparkle';
          const angle = (i / 14) * Math.PI * 2;
          const dist = 46 + (i % 3) * 22;
          sp.style.setProperty('--tx', `${Math.round(Math.cos(angle) * dist)}px`);
          sp.style.setProperty('--ty', `${Math.round(Math.sin(angle) * dist * 0.65)}px`);
          sp.style.background = burstColors[i % burstColors.length];
          fxLayer.appendChild(sp);
        }
      }

      if (equippedFigId) {
        const equippedCubby = document.querySelector(
          `.figurine-cubby-card[data-fig-id="${equippedFigId}"]`
        );
        if (equippedCubby) {
          equippedCubby.classList.remove('equip-cubby-flash');
          void equippedCubby.offsetWidth;
          equippedCubby.classList.add('equip-cubby-flash');
        }
      }
    }

    getActiveMusicTrackFigurineId() {
      if (this.profile.equippedFigurineId) {
        return this.profile.equippedFigurineId;
      }
      const unlocked = this.profile.unlockedFigurines || [];
      if (unlocked.length > 0) {
        const idx = ((this.currentLevelNum || 1) - 1) % unlocked.length;
        return unlocked[idx];
      }
      const fallbackIdx = (((this.currentLevelNum || 1) - 1) % 60) + 1;
      return `fig-${String(fallbackIdx).padStart(2, '0')}`;
    }

    getEquippedBuddyPerk() {
      const kit = this.getEquippedCosmeticKit();
      const fig = kit && kit.figurine;
      if (!fig) {
        return { label: '+10% Fever', scoreMult: 1.0, feverMult: 1.1 };
      }
      const rarity = String(fig.rarity || 'Common').toLowerCase();
      const scoreBonus =
        rarity === 'mythic'
          ? 0.3
          : rarity === 'legendary'
          ? 0.25
          : rarity === 'epic'
          ? 0.2
          : rarity === 'rare'
          ? 0.18
          : 0.15;
      const feverBonus =
        rarity === 'mythic'
          ? 0.35
          : rarity === 'legendary'
          ? 0.3
          : rarity === 'epic'
          ? 0.25
          : 0.2;
      return {
        label: `+${Math.round(scoreBonus * 100)}% Score`,
        scoreMult: 1 + scoreBonus,
        feverMult: 1 + feverBonus
      };
    }

    chargeKilnFever(baseAmount = 18) {
      const perk = this.getEquippedBuddyPerk();
      const scaled = Math.round(baseAmount * (perk.feverMult || 1));
      if (this.overdriveMovesLeft > 0) {
        this.kilnFever = 100;
        this.updateHUD();
        return;
      }
      this.kilnFever = Math.min(100, (this.kilnFever || 0) + scaled);
      if (this.kilnFever >= 100) {
        this.kilnFever = 100;
        this.overdriveMovesLeft = 3;
        this.overdriveTotalTriggered = (this.overdriveTotalTriggered || 0) + 1;
        this.triggerBoardShake(6.5, 240);
        this.setOllieReaction('◆ KILN OVERDRIVE! 2× Score for 3 Moves!', 'cheer');
        this.floatingTexts.push({
          x: this.boardCenterX,
          y: this.boardCenterY - 38,
          text: '◆ KILN OVERDRIVE!',
          subText: '2× SCORE & THERMAL BLAST (3 MOVES)',
          color: '#FF5964',
          life: 0,
          maxLife: 1050
        });
      }
      this.updateHUD();
    }

    triggerBoardShake(intensity = 5, durationMs = 180) {
      if (this.settings && this.settings.reducedMotion) return;
      this.boardShake = Math.max(this.boardShake || 0, intensity);
      this.scheduleTimeout(() => {
        this.boardShake = 0;
      }, durationMs);
    }

    applyEquippedCosmeticToDOM() {
      const kit = this.getEquippedCosmeticKit();
      if (this.audio && typeof this.audio.setEquippedFigurineTrack === 'function') {
        const targetTrackId = this.getActiveMusicTrackFigurineId();
        if (this.audio.equippedFigurineId !== targetTrackId) {
          this.audio.setEquippedFigurineTrack(targetTrackId, false);
        }
      }
      const boardScreen = document.getElementById('screen-board');
      if (boardScreen) {
        boardScreen.style.background = `linear-gradient(180deg, ${kit.stageBgTop} 0%, ${kit.stageBgBottom} 100%)`;
      }
      const buddyPill = document.getElementById('btn-board-buddy');
      const buddyDot = document.getElementById('board-buddy-dot');
      const buddyName = document.getElementById('board-buddy-name');
      const buddyPerkEl = document.getElementById('board-buddy-perk');
      if (buddyPill) {
        if (kit.figurine) {
          buddyPill.classList.remove('hidden');
          if (buddyDot) {
            buddyDot.style.background = kit.figurine.primaryColor || '#2EC4B6';
            buddyDot.style.borderColor = kit.figurine.accentColor || '#231F20';
          }
          if (buddyName) {
            buddyName.textContent = kit.figurine.name;
          }
          if (buddyPerkEl) {
            buddyPerkEl.textContent = this.getEquippedBuddyPerk().label;
          }
        } else {
          buddyPill.classList.add('hidden');
        }
      }
    }

    getFeaturedPickupSeries() {
      const seriesList = Catalog.FIGURINE_SERIES || [];
      if (seriesList.length === 0) {
        return { seriesId: 'series-2', seriesName: 'Kitsune & Folklore', emoji: '◆' };
      }
      const seriesIcons = {
        'series-1': '♦',
        'series-2': '◆',
        'series-3': '★',
        'series-4': '●',
        'series-5': '▲',
        'series-6': '★',
        'series-7': '✚',
        'series-8': '●',
        'series-9': '◆',
        'series-10': '★'
      };
      // Rotate pickup banner across all 10 series based on pull count + current level chapter,
      // prioritizing series where the player has unlocked fewer figurines!
      const unlocked = new Set(this.profile.unlockedFigurines || []);
      const unownedSeries = seriesList.filter((s) => {
        const figs = Catalog.getFigurinesBySeries ? Catalog.getFigurinesBySeries(s.seriesId) : [];
        return figs.every((f) => !unlocked.has(f.id));
      });
      const pool = unownedSeries.length > 0 ? unownedSeries : seriesList;
      const rotIdx = ((this.profile.gachaPullCount || 0) + Math.floor((this.currentLevelNum || 1) / 3)) % pool.length;
      const chosen = pool[rotIdx] || seriesList[0];
      return {
        seriesId: chosen.seriesId,
        seriesName: chosen.seriesName,
        emoji: seriesIcons[chosen.seriesId] || '★'
      };
    }

    getGachaGradeInfo(rarity) {
      const rKey = String(rarity || 'Common').toLowerCase();
      switch (rKey) {
        case 'mythic':
          return {
            grade: 'UR',
            jp: '超激レア',
            badgeText: 'UR · 超激レア (MYTHIC)',
            shellClass: 'cap-ur',
            tierClass: 'mythic'
          };
        case 'legendary':
          return {
            grade: 'SSR',
            jp: 'SSレア',
            badgeText: 'SSR · SSレア (LEGENDARY)',
            shellClass: 'cap-ssr',
            tierClass: 'legendary'
          };
        case 'epic':
          return {
            grade: 'SR',
            jp: 'Sレア',
            badgeText: 'SR · Sレア (EPIC)',
            shellClass: 'cap-sr',
            tierClass: 'epic'
          };
        case 'rare':
          return {
            grade: 'R',
            jp: 'レア',
            badgeText: 'R · レア (RARE)',
            shellClass: 'cap-r',
            tierClass: 'rare'
          };
        case 'common':
        default:
          return {
            grade: 'N',
            jp: 'ノーマル',
            badgeText: 'N · ノーマル (COMMON)',
            shellClass: 'cap-n',
            tierClass: 'common'
          };
      }
    }

    rollRandomBlindBoxFigurineSafe(options = {}) {
      const pickup = this.getFeaturedPickupSeries();
      const enrichedOpts = {
        unlockedIds: this.profile.unlockedFigurines || [],
        recentIds: this.profile.recentPullIds || [],
        pullCount: this.profile.gachaPullCount || 0,
        pickupSeriesId: pickup.seriesId,
        ...options
      };
      if (typeof Catalog.rollRandomBlindBoxFigurine === 'function') {
        try {
          const picked = Catalog.rollRandomBlindBoxFigurine(enrichedOpts);
          if (picked) return picked;
        } catch (_e) {}
      }
      const list = Catalog.FIGURINES || [];
      return list[Math.floor(Math.random() * list.length)] || list[0];
    }

    // -------------------------------------------------------------------------
    // Persistent Profile Storage & URL Query Parameters
    // -------------------------------------------------------------------------
    loadSavedProfile() {
      try {
        const raw = window.localStorage && window.localStorage.getItem('popstacks_atelier_save_v2');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data && typeof data === 'object') {
          if (typeof data.highestUnlockedLevel === 'number' && data.highestUnlockedLevel >= 1) {
            this.profile.highestUnlockedLevel = Math.floor(data.highestUnlockedLevel);
          }
          if (typeof data.currentLevel === 'number' && data.currentLevel >= 1) {
            this.profile.currentLevel = Math.min(this.profile.highestUnlockedLevel, Math.floor(data.currentLevel));
          }
          if (data.levelStars && typeof data.levelStars === 'object') {
            this.profile.levelStars = data.levelStars;
          }
          if (data.levelBestScores && typeof data.levelBestScores === 'object') {
            this.profile.levelBestScores = data.levelBestScores;
          }
          if (data.levelBestCombos && typeof data.levelBestCombos === 'object') {
            this.profile.levelBestCombos = data.levelBestCombos;
          }
          if (Array.isArray(data.unlockedFigurines)) {
            this.profile.unlockedFigurines = data.unlockedFigurines;
          }
          if (data.figurineCounts && typeof data.figurineCounts === 'object') {
            this.profile.figurineCounts = data.figurineCounts;
          }
          if (data.equippedFigurineId !== undefined) {
            this.profile.equippedFigurineId = data.equippedFigurineId;
          }
          if (typeof data.starChestsClaimed === 'number') {
            this.profile.starChestsClaimed = Math.max(0, Math.floor(data.starChestsClaimed));
          }
          if (typeof data.gachaPullCount === 'number') {
            this.profile.gachaPullCount = Math.max(0, Math.floor(data.gachaPullCount));
          }
          if (Array.isArray(data.recentPullIds)) {
            this.profile.recentPullIds = data.recentPullIds;
          }
          if (typeof data.keys === 'number') {
            this.profile.keys = Math.max(0, Math.min(3, Math.floor(data.keys)));
          }
          if (typeof data.moldProgress === 'number') {
            this.profile.moldProgress = data.moldProgress;
          }
          if (typeof data.currentMoldFigurineId === 'string') {
            this.profile.currentMoldFigurineId = data.currentMoldFigurineId;
          }
          this.profile.selectedChapter = Math.min(11, Math.ceil(this.profile.currentLevel / 10));
        }
      } catch (_e) {}
    }

    saveProfile() {
      try {
        if (!window.localStorage) return;
        window.localStorage.setItem(
          'popstacks_atelier_save_v2',
          JSON.stringify({
            currentLevel: this.profile.currentLevel,
            highestUnlockedLevel: this.profile.highestUnlockedLevel,
            levelStars: this.profile.levelStars,
            levelBestScores: this.profile.levelBestScores,
            levelBestCombos: this.profile.levelBestCombos,
            unlockedFigurines: this.profile.unlockedFigurines,
            figurineCounts: this.profile.figurineCounts,
            equippedFigurineId: this.profile.equippedFigurineId,
            starChestsClaimed: this.profile.starChestsClaimed,
            gachaPullCount: this.profile.gachaPullCount,
            recentPullIds: this.profile.recentPullIds,
            keys: this.profile.keys,
            moldProgress: this.profile.moldProgress,
            currentMoldFigurineId: this.profile.currentMoldFigurineId
          })
        );
      } catch (_e) {}
    }

    parseInitialUrlParams() {
      const params = new URLSearchParams(window.location.search);
      const qLevel = parseInt(params.get('level') || '', 10);
      const qScreen = params.get('screen');

      const startLevel = !Number.isNaN(qLevel) && qLevel >= 1
        ? qLevel
        : (this.profile.currentLevel || 1);
      if (startLevel > this.profile.highestUnlockedLevel && !Number.isNaN(qLevel)) {
        this.profile.highestUnlockedLevel = startLevel;
      }
      this.loadLevel(startLevel, { stayOnCurrentScreen: true });

      if (qScreen && ['hub', 'board', 'daily', 'gallery', 'shop'].includes(qScreen)) {
        this.setScreen(qScreen);
      } else {
        this.setScreen('board');
      }
    }

    setScreen(screenName) {
      const valid = ['hub', 'board', 'daily', 'gallery', 'shop'];
      const target = valid.includes(screenName) ? screenName : 'board';
      this.activeScreen = target;

      if (target === 'board') {
        this.applyEquippedCosmeticToDOM();
      }

      // Switch music between full puzzle focus soundtrack ('board') and subtle lounge mode ('meta')
      if (this.audio && typeof this.audio.setMusicContextMode === 'function') {
        this.audio.setMusicContextMode(target === 'board' ? 'board' : 'meta');
      }

      // Toggle Screen Sections
      valid.forEach((s) => {
        const el = document.getElementById(`screen-${s}`);
        if (el) {
          el.classList.toggle('hidden', s !== target);
          el.classList.toggle('active-screen', s === target);
        }
      });

      // Show persistent Meta Top Bar & 5-Tab Bottom Nav on Hub/Daily/Gallery/Shop;
      // Give Puzzle Board 100% full-viewport ergonomic focus on 'board'
      const metaTop = document.getElementById('meta-top-bar');
      const bottomNav = document.getElementById('bottom-nav-bar');
      const isBoard = target === 'board';
      if (metaTop) metaTop.classList.toggle('hidden', isBoard);
      if (bottomNav) bottomNav.classList.toggle('hidden', isBoard);

      // Highlight active bottom nav button
      document.querySelectorAll('.nav-tab-btn[data-nav-screen]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-nav-screen') === target);
      });

      if (target === 'hub') {
        this.profile.selectedChapter =
          this.profile.currentLevel > 100
            ? 11
            : Math.max(1, Math.min(10, Math.ceil((this.profile.currentLevel || 1) / 10)));
        this.renderHubUI();
      } else if (target === 'daily') {
        this.renderDailyUI();
      } else if (target === 'gallery') {
        this.renderGalleryUI();
      } else if (target === 'shop') {
        this.renderShopUI();
      } else if (target === 'board') {
        this.applyEquippedCosmeticToDOM();
        this.handleResize();
        this.updateHUD();
      }

      this.updateMetaTopBar();
    }

    // -------------------------------------------------------------------------
    // Session-Guarded Timer Helpers
    // -------------------------------------------------------------------------
    scheduleTimeout(fn, delayMs) {
      const capturedSession = this.sessionId;
      const id = setTimeout(() => {
        this.activeTimers.delete(id);
        if (this.sessionId !== capturedSession) return;
        fn();
      }, delayMs);
      this.activeTimers.add(id);
      return id;
    }

    clearAllTimers() {
      this.sessionId++;
      this.activeTimers.forEach((id) => clearTimeout(id));
      this.activeTimers.clear();
      this.tweens = [];
      this.flyingDiscs = [];
      this.poppingDiscs = [];
      this.objectiveFlyingDiscs = [];
      this.particles = [];
      this.floatingTexts = [];
      this.shockwaves = [];
      this.evaluationQueue = [];
      this.isProcessingCascade = false;
      this.pausedNextAction = null;
      this.debugVisualHint = null;
    }

    // -------------------------------------------------------------------------
    // UI Wiring & Event Listeners
    // -------------------------------------------------------------------------
    initUI() {
      // Canvas Pointer & Pinch-to-Zoom Events
      this.canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      window.addEventListener('pointermove', (e) => this.onPointerMove(e));
      window.addEventListener('pointerup', (e) => this.onPointerUp(e));
      window.addEventListener('pointercancel', (e) => this.onPointerUp(e));

      this.canvas.addEventListener('touchstart', (e) => this.onTouchStartPinch(e), { passive: false });
      this.canvas.addEventListener('touchmove', (e) => this.onTouchMovePinch(e), { passive: false });
      this.canvas.addEventListener('touchend', (e) => this.onTouchEndPinch(e));
      this.canvas.addEventListener('touchcancel', (e) => this.onTouchEndPinch(e));
      this.canvas.addEventListener('wheel', (e) => this.onWheelZoom(e), { passive: false });

      const btnZoomReset = document.getElementById('btn-zoom-reset');
      if (btnZoomReset) {
        btnZoomReset.addEventListener('click', () => {
          this.audio.playUiClick();
          this.resetBoardZoom();
        });
      }

      const btnBoardBuddy = document.getElementById('btn-board-buddy');
      if (btnBoardBuddy) {
        btnBoardBuddy.addEventListener('click', () => {
          this.audio.playUiClick();
          if (this.profile.equippedFigurineId) {
            this.inspectFigurine(this.profile.equippedFigurineId);
          } else {
            this.setScreen('gallery');
          }
        });
      }

      // Bottom 5-Tab Navigation Bar
      document.querySelectorAll('.nav-tab-btn[data-nav-screen]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.audio.playUiClick();
          this.setScreen(btn.getAttribute('data-nav-screen'));
        });
      });

      // Top Meta Bar Actions
      const btnTopHearts = document.getElementById('btn-top-hearts');
      const btnTopCollection = document.getElementById('btn-top-collection');
      const btnTopKeys = document.getElementById('btn-top-keys');
      const btnTopPrisms = document.getElementById('btn-top-prisms');
      if (btnTopHearts) {
        btnTopHearts.addEventListener('click', () => {
          this.audio.playUiClick();
          if (this.profile.hearts < 5) {
            this.profile.hearts = 5;
            this.profile.heartRefillEndMs = 0;
            this.updateMetaTopBar();
          }
        });
      }
      if (btnTopCollection) {
        btnTopCollection.addEventListener('click', () => {
          this.audio.playUiClick();
          this.setScreen('gallery');
        });
      }
      if (btnTopKeys) {
        btnTopKeys.addEventListener('click', () => {
          this.audio.playUiClick();
          this.setScreen('gallery');
        });
      }
      if (btnTopPrisms) {
        btnTopPrisms.addEventListener('click', () => {
          this.audio.playUiClick();
          this.setScreen('shop');
        });
      }

      // Settings Modal Triggers
      const openSettings = () => {
        this.audio.playUiClick();
        const modal = document.getElementById('settings-modal');
        if (modal) modal.classList.remove('hidden');
      };
      const btnMetaSettings = document.getElementById('btn-meta-settings');
      const btnBoardSettings = document.getElementById('btn-board-settings');
      const btnSettingsClose = document.getElementById('btn-settings-close');
      if (btnMetaSettings) btnMetaSettings.addEventListener('click', openSettings);
      if (btnBoardSettings) btnBoardSettings.addEventListener('click', openSettings);
      if (btnSettingsClose) {
        btnSettingsClose.addEventListener('click', () => {
          this.audio.playUiClick();
          document.getElementById('settings-modal').classList.add('hidden');
        });
      }

      // Settings Toggles & 1-Tap Board Music Button
      const setSfx = document.getElementById('set-sfx-toggle');
      const setBgm = document.getElementById('set-bgm-toggle');
      const setHaptics = document.getElementById('set-haptics-toggle');
      const setColorblind = document.getElementById('set-colorblind-toggle');
      const setReducedMotion = document.getElementById('set-reduced-motion-toggle');
      const btnBoardMusic = document.getElementById('btn-board-music');

      const syncMusicUI = (playing) => {
        if (btnBoardMusic) {
          btnBoardMusic.classList.toggle('music-off', !playing);
          btnBoardMusic.textContent = playing ? '♪' : '✕';
        }
        if (setBgm) {
          setBgm.checked = !!playing;
        }
      };

      if (btnBoardMusic) {
        btnBoardMusic.addEventListener('click', () => {
          const isPlaying = this.audio.toggleMusic();
          syncMusicUI(isPlaying);
          const trackLbl =
            (this.audio.currentTrack && this.audio.currentTrack.instrumentLabel) ||
            'Focus Soundtrack';
          this.setOllieReaction(
            isPlaying ? `♪ ${trackLbl} ON!` : 'Studio music paused',
            isPlaying ? 'excited' : 'happy'
          );
        });
      }

      const ollieCompanion = document.getElementById('board-ollie-companion');
      if (ollieCompanion) {
        ollieCompanion.addEventListener('click', () => {
          this.audio.initContext();
          this.audio.playTransferChime(4);
          const tips = [
            'Stack 10 matching discs to POP!',
            'Drop next to matching top colors!',
            'Uncover hidden colors for x2 combos!',
            'Use Hammer or Swap if hexes get tight!'
          ];
          const tip = tips[this.movesTaken % tips.length];
          this.setOllieReaction(tip, 'cheer');
        });
      }

      if (setSfx) {
        setSfx.addEventListener('change', (e) => {
          this.audio.setMuted(!e.target.checked);
        });
      }
      if (setBgm) {
        setBgm.addEventListener('change', (e) => {
          if (e.target.checked) this.audio.startStudioAmbient();
          else this.audio.stopStudioAmbient();
          syncMusicUI(e.target.checked);
        });
      }
      if (setHaptics) {
        setHaptics.addEventListener('change', (e) => {
          this.audio.setHapticsEnabled(e.target.checked);
        });
      }
      if (setColorblind) {
        setColorblind.addEventListener('change', (e) => {
          this.settings.colorblindMode = !!e.target.checked;
        });
      }
      if (setReducedMotion) {
        setReducedMotion.addEventListener('change', (e) => {
          this.settings.reducedMotion = !!e.target.checked;
        });
      }

      document.querySelectorAll('.reach-btn[data-reach]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.settings.thumbReach = btn.getAttribute('data-reach');
          document.querySelectorAll('.reach-btn[data-reach]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
          this.handleResize();
        });
      });

      const btnSettingsRestart = document.getElementById('btn-settings-restart');
      const btnSettingsHub = document.getElementById('btn-settings-hub');
      if (btnSettingsRestart) {
        btnSettingsRestart.addEventListener('click', () => {
          document.getElementById('settings-modal').classList.add('hidden');
          this.loadLevel(this.currentLevelNum);
          this.setScreen('board');
        });
      }
      if (btnSettingsHub) {
        btnSettingsHub.addEventListener('click', () => {
          document.getElementById('settings-modal').classList.add('hidden');
          this.setScreen('hub');
        });
      }

      // Workshop Hub Controls
      document.querySelectorAll('.theme-chip[data-shelf-theme]').forEach((chip) => {
        chip.addEventListener('click', () => {
          const theme = chip.getAttribute('data-shelf-theme');
          this.profile.shelfTheme = theme;
          document.querySelectorAll('.theme-chip[data-shelf-theme]').forEach((c) => {
            c.classList.toggle('active', c === chip);
          });
          const shelfEl = document.getElementById('hub-display-shelf');
          if (shelfEl) {
            shelfEl.className = `birch-display-shelf theme-${theme}`;
          }
        });
      });

      const btnHubPlay = document.getElementById('btn-hub-play-level');
      if (btnHubPlay) {
        btnHubPlay.addEventListener('click', () => {
          this.audio.playUiClick();
          this.loadLevel(this.profile.currentLevel);
          this.setScreen('board');
          this.showRoundStartBanner(this.profile.currentLevel);
        });
      }

      const btnHubDaily = document.getElementById('btn-hub-daily');
      const btnHubStarter = document.getElementById('btn-hub-starter');
      const btnHubPass = document.getElementById('btn-hub-pass');
      if (btnHubDaily) btnHubDaily.addEventListener('click', () => this.setScreen('daily'));
      if (btnHubStarter) btnHubStarter.addEventListener('click', () => this.setScreen('shop'));
      if (btnHubPass) btnHubPass.addEventListener('click', () => this.setScreen('shop'));

      // Board Top HUD Controls
      const btnBoardHub = document.getElementById('btn-board-hub');
      if (btnBoardHub) {
        btnBoardHub.addEventListener('click', () => {
          this.audio.playUiClick();
          this.setScreen('hub');
        });
      }

      const btnUndo = document.getElementById('btn-undo');
      if (btnUndo) {
        btnUndo.addEventListener('click', () => this.undoLastMove());
      }

      const btnHint = document.getElementById('btn-hint');
      if (btnHint) {
        btnHint.addEventListener('click', () => this.triggerSmartHint());
      }

      const btnSkipFtue = document.getElementById('btn-skip-ftue');
      if (btnSkipFtue) {
        btnSkipFtue.addEventListener('click', () => {
          this.ftueSkipped = true;
          this.recommendedCellKey = null;
          this.updateFtueBanner();
        });
      }

      // Bottom 3-Booster Dock Controls
      const btnHammer = document.getElementById('btn-booster-hammer');
      const btnSwap = document.getElementById('btn-booster-swap');
      const btnExtraSlot = document.getElementById('btn-booster-extraslot');
      if (btnHammer) btnHammer.addEventListener('click', () => this.activateBooster('hammer'));
      if (btnSwap) btnSwap.addEventListener('click', () => this.activateBooster('swap'));
      if (btnExtraSlot) btnExtraSlot.addEventListener('click', () => this.activateBooster('extraslot'));

      const btnBoosterCancel = document.getElementById('btn-booster-cancel');
      const btnBoosterRerollNow = document.getElementById('btn-booster-reroll-now');
      if (btnBoosterCancel) {
        btnBoosterCancel.addEventListener('click', () => this.cancelBoosterMode());
      }
      if (btnBoosterRerollNow) {
        btnBoosterRerollNow.addEventListener('click', () => this.executeSwapRerollTray());
      }

      // Deadlock Rescue Modal Controls
      const btnDeadlockPeek = document.getElementById('btn-deadlock-peek');
      const deadlockModal = document.getElementById('deadlock-modal');
      if (btnDeadlockPeek && deadlockModal) {
        const togglePeek = (on) => deadlockModal.classList.toggle('peeking', on);
        btnDeadlockPeek.addEventListener('pointerdown', () => togglePeek(true));
        btnDeadlockPeek.addEventListener('pointerup', () => togglePeek(false));
        btnDeadlockPeek.addEventListener('pointerleave', () => togglePeek(false));
        btnDeadlockPeek.addEventListener('click', () => {
          deadlockModal.classList.toggle('peeking');
        });
      }

      const btnRescueWatchAd = document.getElementById('btn-rescue-watch-ad');
      if (btnRescueWatchAd) {
        btnRescueWatchAd.addEventListener('click', () => {
          this.triggerRewardedAd('deadlock_rescue');
        });
      }

      const btnRescuePrisms = document.getElementById('btn-rescue-use-prisms');
      if (btnRescuePrisms) {
        btnRescuePrisms.addEventListener('click', () => {
          if (this.profile.prisms >= 90) {
            this.profile.prisms -= 90;
          }
          this.executeDeadlockRescue(3);
        });
      }

      const btnModalUndo = document.getElementById('btn-modal-undo');
      if (btnModalUndo) {
        btnModalUndo.addEventListener('click', () => this.undoLastMove());
      }
      const btnModalReset = document.getElementById('btn-modal-reset');
      if (btnModalReset) {
        btnModalReset.addEventListener('click', () => {
          this.consumeHeartOnRetry();
          this.hideDeadlockModal();
          this.loadLevel(this.currentLevelNum);
        });
      }

      // Level Win & Unboxing Modals — Every prize-claim path advances to the next round!
      const btnWinUnboxNow = document.getElementById('btn-win-unbox-now');
      if (btnWinUnboxNow) {
        btnWinUnboxNow.addEventListener('click', () => {
          this.unboxFromWin = true;
          document.getElementById('level-win-modal').classList.add('hidden');
          this.triggerUnboxingModal(null, {
            fromWin: true,
            boosted: !!this.pendingChestBoosted
          });
        });
      }

      const btnHubStarChest = document.getElementById('hub-total-stars');
      if (btnHubStarChest) {
        btnHubStarChest.addEventListener('click', () => {
          this.audio.playUiClick();
          this.claimStarMilestoneChest();
        });
      }

      const btnWinAd2x = document.getElementById('btn-win-watch-ad-2x');
      if (btnWinAd2x) {
        btnWinAd2x.addEventListener('click', () => {
          this.triggerRewardedAd('win_2x_prisms');
        });
      }

      const btnWinNext = document.getElementById('btn-win-next-level');
      if (btnWinNext) {
        btnWinNext.addEventListener('click', () => {
          this.advanceToNextRound();
        });
      }

      const btnWinReplay = document.getElementById('btn-win-replay');
      if (btnWinReplay) {
        btnWinReplay.addEventListener('click', () => {
          this.audio.playUiClick();
          document.getElementById('level-win-modal').classList.add('hidden');
          this.loadLevel(this.currentLevelNum);
          this.setScreen('board');
        });
      }

      const btnWinShare = document.getElementById('btn-win-share-score');
      if (btnWinShare) {
        btnWinShare.addEventListener('click', () => {
          this.audio.playUiClick();
          this.shareCurrentLevelScore(btnWinShare);
        });
      }

      const btnWinHub = document.getElementById('btn-win-to-hub');
      if (btnWinHub) {
        btnWinHub.addEventListener('click', () => {
          document.getElementById('level-win-modal').classList.add('hidden');
          const nextLvl = Math.min(100, this.currentLevelNum + 1);
          this.profile.currentLevel = nextLvl;
          this.loadLevel(nextLvl, { stayOnCurrentScreen: true });
          this.setScreen('hub');
        });
      }

      const btnBlindBoxTap = document.getElementById('btn-blind-box-tap');
      if (btnBlindBoxTap) {
        btnBlindBoxTap.addEventListener('click', () => this.handleCapsuleTap());
      }

      const btnUnboxEquipNow = document.getElementById('btn-unbox-equip-now');
      if (btnUnboxEquipNow) {
        btnUnboxEquipNow.addEventListener('click', () => {
          if (this.pendingUnboxFigurine && this.pendingUnboxFigurine.id) {
            const shouldAdvance = this.unboxFromWin || this.isLevelWon;
            this.equipFigurine(this.pendingUnboxFigurine.id, {
              navigateToGallery: !shouldAdvance
            });
            document.getElementById('unboxing-modal').classList.add('hidden');
            if (window.PopStacks3DViewer) window.PopStacks3DViewer.stopLoop();
            this.unboxFromWin = false;
            if (shouldAdvance) {
              this.advanceToNextRound();
            } else {
              this.renderHubUI();
              this.renderGalleryUI();
            }
          }
        });
      }

      const btnUnboxBonusSpin = document.getElementById('btn-unbox-watch-ad-spin');
      if (btnUnboxBonusSpin) {
        btnUnboxBonusSpin.addEventListener('click', () => {
          this.audio.playUiClick();
          this.triggerRewardedAd('unbox_bonus_spin');
        });
      }

      const btnUnboxCollect = document.getElementById('btn-unbox-collect');
      if (btnUnboxCollect) {
        btnUnboxCollect.addEventListener('click', () => {
          document.getElementById('unboxing-modal').classList.add('hidden');
          if (window.PopStacks3DViewer) window.PopStacks3DViewer.stopLoop();
          const shouldAdvance = this.unboxFromWin || this.isLevelWon;
          this.unboxFromWin = false;
          if (shouldAdvance) {
            this.advanceToNextRound();
          } else {
            this.renderHubUI();
            this.renderGalleryUI();
          }
        });
      }

      // 3D Turntable Inspector Modal Controls
      const btnTurntableClose = document.getElementById('btn-turntable-close');
      if (btnTurntableClose) {
        btnTurntableClose.addEventListener('click', () => {
          document.getElementById('turntable-modal').classList.add('hidden');
          if (window.PopStacks3DViewer) window.PopStacks3DViewer.stopLoop();
          if (this.audio && typeof this.audio.setEquippedFigurineTrack === 'function') {
            this.audio.setEquippedFigurineTrack(this.profile.equippedFigurineId, false);
          }
        });
      }

      const btnTurntableEquip = document.getElementById('btn-turntable-equip');
      if (btnTurntableEquip) {
        btnTurntableEquip.addEventListener('click', () => {
          if (this.inspectedFigurine && this.profile.unlockedFigurines.includes(this.inspectedFigurine.id)) {
            const isCurrentlyEquipped = this.profile.equippedFigurineId === this.inspectedFigurine.id;
            this.equipFigurine(isCurrentlyEquipped ? null : this.inspectedFigurine.id, {
              navigateToGallery: true
            });
          }
        });
      }

      // Fallback 2D tilt when 3D WebGL canvas is not targeted
      const inspectorHost = document.getElementById('inspector-trophy');
      if (inspectorHost) {
        inspectorHost.addEventListener('pointerdown', (e) => {
          if (e.target && e.target.closest('.glb-stage-slot')) return;
          this.turntableDragging = true;
          this.turntableDragStartX = e.clientX;
          this.turntableDragStartTilt = this.turntableTilt || 0;
          inspectorHost.setPointerCapture(e.pointerId);
        });
        inspectorHost.addEventListener('pointermove', (e) => {
          if (!this.turntableDragging) return;
          const dx = e.clientX - this.turntableDragStartX;
          this.turntableTilt = Math.max(-38, Math.min(38, this.turntableDragStartTilt + dx * 0.35));
        });
        const endDrag = () => { this.turntableDragging = false; };
        inspectorHost.addEventListener('pointerup', endDrag);
        inspectorHost.addEventListener('pointercancel', endDrag);
      }

      document.querySelectorAll('.glaze-btn[data-glaze]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.turntableGlaze = btn.getAttribute('data-glaze');
          document.querySelectorAll('.glaze-btn[data-glaze]').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
        });
      });

      // Daily Challenge Tab Controls (keep both Calendar & Leaderboard visible together)
      const btnDailyPuzzle = document.getElementById('btn-daily-tab-puzzle');
      const btnDailyBoard = document.getElementById('btn-daily-tab-board');
      const panelPuzzle = document.getElementById('daily-puzzle-panel');
      const panelBoard = document.getElementById('daily-leaderboard-panel');
      if (btnDailyPuzzle && btnDailyBoard && panelPuzzle && panelBoard) {
        btnDailyPuzzle.addEventListener('click', () => {
          btnDailyPuzzle.classList.add('active');
          btnDailyBoard.classList.remove('active');
          panelPuzzle.classList.remove('hidden');
          panelBoard.classList.add('hidden');
        });
        btnDailyBoard.addEventListener('click', () => {
          btnDailyBoard.classList.add('active');
          btnDailyPuzzle.classList.remove('active');
          panelBoard.classList.remove('hidden');
          panelPuzzle.classList.add('hidden');
        });
      }

      const btnPlayDaily = document.getElementById('btn-play-daily-challenge');
      if (btnPlayDaily) {
        btnPlayDaily.addEventListener('click', () => {
          this.startDailyChallenge('2026-10-17');
        });
      }

      // Gallery Gashapon Machine Button
      const btnGalleryUnbox = document.getElementById('btn-gallery-unbox-now');
      if (btnGalleryUnbox) {
        btnGalleryUnbox.addEventListener('click', () => {
          this.audio.playUiClick();
          const hasTokens = (this.profile.keys || 0) >= 3;
          if (!hasTokens) {
            if (this.profile.prisms >= 120) {
              this.profile.prisms -= 120;
            }
          }
          this.saveProfile();
          this.updateMetaTopBar();
          this.triggerUnboxingModal(null, { boosted: hasTokens, fromWin: false });
        });
      }

      // Ad-Supported Rewards & Supply Drop Actions (IAP Deferred)
      const btnBuyPass = document.getElementById('btn-buy-collector-pass');
      if (btnBuyPass) {
        btnBuyPass.addEventListener('click', () => {
          this.audio.playUiClick();
          this.triggerRewardedAd('vip_pass');
        });
      }

      const btnBuyStarter = document.getElementById('btn-buy-starter-bundle');
      if (btnBuyStarter) {
        btnBuyStarter.addEventListener('click', () => {
          this.audio.playUiClick();
          this.triggerRewardedAd('starter_crate');
        });
      }

      const btnShopWatchAd = document.getElementById('btn-shop-watch-ad');
      if (btnShopWatchAd) {
        btnShopWatchAd.addEventListener('click', () => {
          this.audio.playUiClick();
          this.triggerRewardedAd('shop_prisms_hammer');
        });
      }

      const btnShopBoosters = document.getElementById('btn-shop-buy-boosters');
      if (btnShopBoosters) {
        btnShopBoosters.addEventListener('click', () => {
          if (this.profile.prisms >= 100) {
            this.profile.prisms -= 100;
            this.profile.boosters.hammer += 1;
            this.profile.boosters.swap += 1;
            this.profile.boosters.extraslot += 1;
            this.audio.playExtraSlotUnlock();
            this.saveProfile();
            this.updateMetaTopBar();
            this.updateBoosterDockUI();
          } else {
            this.triggerRewardedAd('starter_crate');
          }
        });
      }

      const btnShopHearts = document.getElementById('btn-shop-refill-hearts');
      if (btnShopHearts) {
        btnShopHearts.addEventListener('click', () => {
          if (this.profile.prisms >= 50) {
            this.profile.prisms -= 50;
          }
          this.profile.hearts = 5;
          this.profile.heartRefillEndMs = 0;
          this.audio.playObjectiveCollect();
          this.saveProfile();
          this.updateMetaTopBar();
        });
      }

      const btnShopPrisms = document.getElementById('btn-shop-buy-prisms');
      if (btnShopPrisms) {
        btnShopPrisms.addEventListener('click', () => {
          this.audio.playUiClick();
          this.triggerRewardedAd('shop_prisms_vault');
        });
      }

      const btnAdClaim = document.getElementById('btn-ad-claim-close');
      if (btnAdClaim) {
        btnAdClaim.addEventListener('click', () => {
          document.getElementById('rewarded-ad-modal').classList.add('hidden');
          if (this.activeAdCallback) {
            const cb = this.activeAdCallback;
            this.activeAdCallback = null;
            cb();
          }
        });
      }

      // Debug Drawer Controls
      const drawer = document.getElementById('debug-drawer');
      const toggleDebug = () => {
        if (!drawer) return;
        drawer.classList.toggle('hidden');
        this.updateDebugUI();
      };
      const btnDebugToggle = document.getElementById('btn-debug-toggle');
      const btnMetaDebug = document.getElementById('btn-meta-debug');
      const btnDebugClose = document.getElementById('btn-debug-close');
      if (btnDebugToggle) btnDebugToggle.addEventListener('click', toggleDebug);
      if (btnMetaDebug) {
        btnMetaDebug.addEventListener('click', () => {
          const sm = document.getElementById('settings-modal');
          if (sm) sm.classList.add('hidden');
          toggleDebug();
        });
      }
      if (btnDebugClose) btnDebugClose.addEventListener('click', () => drawer.classList.add('hidden'));

      document.querySelectorAll('[data-dbg-screen]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.setScreen(btn.getAttribute('data-dbg-screen'));
        });
      });

      const dbgLoadLevel = document.getElementById('dbg-load-level');
      const dbgLevelInput = document.getElementById('dbg-level-input');
      if (dbgLoadLevel && dbgLevelInput) {
        dbgLoadLevel.addEventListener('click', () => {
          const lvl = Math.max(1, Math.min(100, parseInt(dbgLevelInput.value || '1', 10)));
          this.loadLevel(lvl);
          this.setScreen('board');
        });
      }

      const dbgAutoStep = document.getElementById('dbg-auto-step');
      if (dbgAutoStep) {
        dbgAutoStep.addEventListener('click', () => this.autoSolveStep());
      }

      const dbgAutoWin = document.getElementById('dbg-auto-win');
      if (dbgAutoWin) {
        dbgAutoWin.addEventListener('click', () => this.autoWinLevel());
      }

      const dbgGrid7 = document.getElementById('dbg-grid-7');
      const dbgGrid19 = document.getElementById('dbg-grid-19');
      const dbgGrid37 = document.getElementById('dbg-grid-37');
      if (dbgGrid7) dbgGrid7.addEventListener('click', () => { this.loadLevel(1); this.setScreen('board'); });
      if (dbgGrid19) dbgGrid19.addEventListener('click', () => { this.loadLevel(32); this.setScreen('board'); });
      if (dbgGrid37) dbgGrid37.addEventListener('click', () => { this.loadLevel(65); this.setScreen('board'); });

      const dbgPresetCascade = document.getElementById('dbg-preset-cascade');
      const dbgPresetBurst10 = document.getElementById('dbg-preset-burst10');
      const dbgPresetDeadlock = document.getElementById('dbg-preset-deadlock');
      const dbgTriggerUnbox = document.getElementById('dbg-trigger-unbox');
      if (dbgPresetCascade) dbgPresetCascade.addEventListener('click', () => this.loadPreset('cascade3x'));
      if (dbgPresetBurst10) dbgPresetBurst10.addEventListener('click', () => this.loadPreset('burst10'));
      if (dbgPresetDeadlock) dbgPresetDeadlock.addEventListener('click', () => this.loadPreset('deadlock'));
      if (dbgTriggerUnbox) {
        dbgTriggerUnbox.addEventListener('click', () => this.triggerUnboxingModal(Catalog.FIGURINES[2]));
      }

      // Step-by-Step Cascade Debugger Controls
      const stepToggle = document.getElementById('dbg-step-toggle');
      const btnStepNext = document.getElementById('dbg-step-next');
      const btnStepResume = document.getElementById('dbg-step-resume');
      const btnBannerStep = document.getElementById('btn-banner-step');
      const btnBannerResume = document.getElementById('btn-banner-resume');

      if (stepToggle) {
        stepToggle.addEventListener('change', (e) => this.setStepMode(e.target.checked));
      }
      if (btnStepNext) btnStepNext.addEventListener('click', () => this.stepNext());
      if (btnStepResume) btnStepResume.addEventListener('click', () => this.resumeCascades());
      if (btnBannerStep) btnBannerStep.addEventListener('click', () => this.stepNext());
      if (btnBannerResume) btnBannerResume.addEventListener('click', () => this.resumeCascades());
    }

    // -------------------------------------------------------------------------
    // Meta Screens Rendering (Hub, Daily, Gallery, Shop, Hearts)
    // -------------------------------------------------------------------------
    tickHeartTimer() {
      if (this.profile.collectorPass) {
        this.profile.hearts = 5;
        this.profile.heartRefillEndMs = 0;
      } else if (this.profile.hearts < this.profile.maxHearts) {
        const now = Date.now();
        if (!this.profile.heartRefillEndMs) {
          this.profile.heartRefillEndMs = now + 25 * 60 * 1000;
        } else if (now >= this.profile.heartRefillEndMs) {
          this.profile.hearts = Math.min(this.profile.maxHearts, this.profile.hearts + 1);
          this.profile.heartRefillEndMs =
            this.profile.hearts < this.profile.maxHearts ? now + 25 * 60 * 1000 : 0;
        }
      }
      this.updateMetaTopBar();
    }

    consumeHeartOnRetry() {
      if (this.profile.collectorPass) return;
      if (this.profile.hearts > 0) {
        this.profile.hearts--;
        if (!this.profile.heartRefillEndMs) {
          this.profile.heartRefillEndMs = Date.now() + 25 * 60 * 1000;
        }
      }
      this.updateMetaTopBar();
    }

    updateMetaTopBar() {
      const hVal = document.getElementById('top-hearts-val');
      const hSub = document.getElementById('top-hearts-timer');
      const cVal = document.getElementById('top-coins-val');
      const pVal = document.getElementById('top-prisms-val');
      const kVal = document.getElementById('top-keys-val');
      const colVal = document.getElementById('top-collection-val');

      if (hVal && hSub) {
        if (this.profile.collectorPass) {
          hVal.textContent = '∞';
          hSub.textContent = 'VIP';
        } else {
          hVal.textContent = `${this.profile.hearts}/5`;
          if (this.profile.hearts >= 5) {
            hSub.textContent = 'FULL';
          } else {
            const remSec = Math.max(0, Math.floor((this.profile.heartRefillEndMs - Date.now()) / 1000));
            const mm = String(Math.floor(remSec / 60)).padStart(2, '0');
            const ss = String(remSec % 60).padStart(2, '0');
            hSub.textContent = `${mm}:${ss}`;
          }
        }
      }
      if (cVal) cVal.textContent = this.profile.coins.toLocaleString();
      if (pVal) pVal.textContent = this.profile.prisms.toLocaleString();
      if (kVal) kVal.textContent = `${this.profile.keys}/3`;
      if (colVal) colVal.textContent = `${this.profile.unlockedFigurines.length}/60`;
    }

    getFigurineMotifSymbol(motif) {
      switch (motif) {
        case 'triangle':
          return '▲';
        case 'diamond':
          return '◆';
        case 'cross':
          return '✚';
        case 'star':
          return '★';
        case 'hexagon':
          return '⬣';
        case 'leaf':
          return '♦';
        case 'circle':
        default:
          return '●';
      }
    }

    scrollToCurrentHubLevel(smooth = false) {
      const scrollContainer = document.getElementById('hub-continuous-scroll');
      if (!scrollContainer) return;
      const activeNode = scrollContainer.querySelector('.duo-hex-step-btn.is-current-step');
      if (!activeNode) return;
      const containerRect = scrollContainer.getBoundingClientRect();
      const nodeRect = activeNode.getBoundingClientRect();
      const targetScrollTop =
        scrollContainer.scrollTop +
        (nodeRect.top - containerRect.top) -
        containerRect.height * 0.48 +
        nodeRect.height * 0.5;
      scrollContainer.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: smooth ? 'smooth' : 'auto'
      });
    }

    renderHubUI() {
      const ISLAND_THEMES = {
        1: {
          islandName: 'Botanical Spirits',
          shortBadge: 'Botanical Island',
          headerBg: '#22A06B',
          headerLip: '#166E48',
          stepTop: '#2EC4B6',
          stepSide: '#158479',
          islandColors: ['#2EC4B6', '#52B788', '#FF6B6B', '#FFD166'],
          heroFigId: 'fig-06',
          subFigId: 'fig-01'
        },
        2: {
          islandName: 'Kitsune Shrine',
          shortBadge: 'Kitsune Island',
          headerBg: '#D9383A',
          headerLip: '#9E1F22',
          stepTop: '#EF476F',
          stepSide: '#A82043',
          islandColors: ['#E63946', '#FFB703', '#FF6B6B', '#FB8500'],
          heroFigId: 'fig-12',
          subFigId: 'fig-07'
        },
        3: {
          islandName: 'Astral Voyagers',
          shortBadge: 'Astral Island',
          headerBg: '#4361EE',
          headerLip: '#2A3EB1',
          stepTop: '#38BDF8',
          stepSide: '#0284C7',
          islandColors: ['#38BDF8', '#818CF8', '#F472B6', '#FBBF24'],
          heroFigId: 'fig-18',
          subFigId: 'fig-13'
        },
        4: {
          islandName: 'Matcha Tea Garden',
          shortBadge: 'Matcha Island',
          headerBg: '#588157',
          headerLip: '#3A5A40',
          stepTop: '#70A970',
          stepSide: '#446A46',
          islandColors: ['#70A970', '#F28482', '#F6BD60', '#84A59D'],
          heroFigId: 'fig-24',
          subFigId: 'fig-19'
        },
        5: {
          islandName: 'Terracotta Kiln',
          shortBadge: 'Terracotta Island',
          headerBg: '#C85A32',
          headerLip: '#8F391A',
          stepTop: '#F4845F',
          stepSide: '#B54A28',
          islandColors: ['#E76F51', '#2A9D8F', '#E9C46A', '#F4A261'],
          heroFigId: 'fig-30',
          subFigId: 'fig-25'
        },
        6: {
          islandName: 'Velvet Nocturne',
          shortBadge: 'Nocturne Island',
          headerBg: '#7209B7',
          headerLip: '#4C067D',
          stepTop: '#9D4EDD',
          stepSide: '#5A189A',
          islandColors: ['#9D4EDD', '#FF9E00', '#00B4D8', '#FF4D6D'],
          heroFigId: 'fig-36',
          subFigId: 'fig-31'
        },
        7: {
          islandName: 'Clockwork Brass',
          shortBadge: 'Clockwork Island',
          headerBg: '#B45309',
          headerLip: '#78350F',
          stepTop: '#F59E0B',
          stepSide: '#B45309',
          islandColors: ['#D97706', '#3B82F6', '#EF4444', '#10B981'],
          heroFigId: 'fig-42',
          subFigId: 'fig-37'
        },
        8: {
          islandName: 'Coral Reef Lagoon',
          shortBadge: 'Coral Lagoon',
          headerBg: '#008B9E',
          headerLip: '#005F6B',
          stepTop: '#00B4D8',
          stepSide: '#0077B6',
          islandColors: ['#00A896', '#FF5A5F', '#FFD166', '#118AB2'],
          heroFigId: 'fig-48',
          subFigId: 'fig-43'
        },
        9: {
          islandName: 'Origami Washi',
          shortBadge: 'Origami Island',
          headerBg: '#2B59C3',
          headerLip: '#1B3B82',
          stepTop: '#4EA8DE',
          stepSide: '#276F9B',
          islandColors: ['#E63946', '#457B9D', '#F4A261', '#2A9D8F'],
          heroFigId: 'fig-54',
          subFigId: 'fig-49'
        },
        10: {
          islandName: "Golden Founder's Vault",
          shortBadge: 'Golden Vault',
          headerBg: '#C27803',
          headerLip: '#854D0E',
          stepTop: '#FBBF24',
          stepSide: '#B45309',
          islandColors: ['#FFD700', '#E11D48', '#0284C7', '#10B981'],
          heroFigId: 'fig-60',
          subFigId: 'fig-55'
        },
        11: {
          islandName: 'Endless Grand Atelier',
          shortBadge: 'Endless Island',
          headerBg: '#374151',
          headerLip: '#1F2937',
          stepTop: '#F59E0B',
          stepSide: '#B45309',
          islandColors: ['#F59E0B', '#EC4899', '#06B6D4', '#8B5CF6'],
          heroFigId: 'fig-60',
          subFigId: 'fig-59'
        }
      };

      const currLvl = Math.max(1, this.profile.currentLevel || 1);
      const currLvlDef = Catalog.getLevelConfig(currLvl);

      // Update Play Button & Jump-to-Current Button
      const playTitle = document.getElementById('btn-hub-play-title');
      if (playTitle) {
        playTitle.textContent = currLvlDef.isEndless
          ? `PLAY ENDLESS #${currLvlDef.level - 100}`
          : `PLAY LEVEL ${currLvlDef.level}`;
      }
      const jumpBtn = document.getElementById('btn-hub-jump-current');
      if (jumpBtn) {
        jumpBtn.textContent = `Lv. ${currLvl} ▸`;
        jumpBtn.onclick = () => {
          this.audio.playUiClick();
          this.scrollToCurrentHubLevel(true);
        };
      }

      // Helper to update the sticky Duolingo-style active island header banner
      const updateStickyIslandHeader = (chapterNum) => {
        const theme = ISLAND_THEMES[chapterNum] || ISLAND_THEMES[1];
        const stickyBanner = document.getElementById('hub-sticky-unit-banner');
        const unitKicker = document.getElementById('hub-unit-kicker');
        const unitTitle = document.getElementById('hub-unit-title');
        const unitStars = document.getElementById('hub-unit-stars');
        const startL = chapterNum === 11 ? 101 : (chapterNum - 1) * 10 + 1;
        const endL = startL + 9;
        let chStars = 0;
        for (let l = startL; l <= endL; l++) {
          chStars += this.profile.levelStars[l] || 0;
        }
        if (stickyBanner) {
          stickyBanner.style.setProperty('--unit-bg', theme.headerBg);
          stickyBanner.style.setProperty('--unit-lip', theme.headerLip);
        }
        if (unitKicker) {
          unitKicker.textContent =
            chapterNum === 11
              ? `ENDLESS ISLAND · STAGES ${startL - 100}+`
              : `ISLAND ${chapterNum} · LEVELS ${startL}–${endL}`;
        }
        if (unitTitle) unitTitle.textContent = theme.islandName;
        if (unitStars) unitStars.textContent = `★ ${chStars}/30`;
      };

      // Helper: Build Option C Contiguous 3D Hex Island Cluster SVG under a Figurine Sprite
      const buildContiguousHexIslandClusterSvg = (colors, isLarge = true) => {
        const drawHexColumn = (cx, baseY, layers, topCol, sideCol, rx = 20, ry = 10.5) => {
          let g = `<ellipse cx="${cx}" cy="${baseY + 5}" rx="${rx * 1.05}" ry="${ry * 0.9}" fill="rgba(30,22,15,0.22)"/>`;
          for (let i = 0; i < layers; i++) {
            const cy = baseY - i * 4.5;
            const cTop = i === layers - 1 ? topCol : sideCol;
            g += `<polygon points="${cx - rx},${cy} ${cx},${cy + ry} ${cx + rx},${cy} ${cx + rx},${cy + 5} ${cx},${cy + ry + 5} ${cx - rx},${cy + 5}" fill="${sideCol}" stroke="#231F20" stroke-width="1.3" stroke-linejoin="round"/>`;
            g += `<polygon points="${cx},${cy - ry} ${cx + rx},${cy} ${cx},${cy + ry} ${cx - rx},${cy}" fill="${cTop}" stroke="#231F20" stroke-width="1.4" stroke-linejoin="round"/>`;
          }
          return g;
        };

        if (isLarge) {
          // 5 touching 3D hex columns forming a floating isometric island terrace
          return `
            <svg class="duo-island-cluster-svg" viewBox="0 0 136 86" aria-hidden="true">
              <ellipse cx="68" cy="70" rx="58" ry="13" fill="rgba(42,30,18,0.16)" />
              ${drawHexColumn(42, 48, 2, colors[1], '#1E3A2F', 18, 9.5)}
              ${drawHexColumn(94, 48, 2, colors[2], '#1E3A2F', 18, 9.5)}
              ${drawHexColumn(28, 60, 2, colors[3], '#283618', 17, 9)}
              ${drawHexColumn(108, 60, 2, colors[1], '#283618', 17, 9)}
              ${drawHexColumn(68, 56, 4, colors[0], '#1B263B', 23, 12)}
            </svg>
          `;
        }
        // 3 touching 3D hex columns for secondary outcrop island
        return `
          <svg class="duo-island-cluster-svg small" viewBox="0 0 108 74" aria-hidden="true">
            <ellipse cx="54" cy="60" rx="44" ry="10" fill="rgba(42,30,18,0.15)" />
            ${drawHexColumn(33, 46, 2, colors[2], '#283618', 16, 8.5)}
            ${drawHexColumn(75, 46, 2, colors[1], '#283618', 16, 8.5)}
            ${drawHexColumn(54, 52, 3, colors[0], '#1B263B', 20, 10.5)}
          </svg>
        `;
      };

      // Helper: Build Option C 3D Hexagonal Vinyl Stack Step Node SVG
      const build3DHexStepSvg = (
        levelNum,
        layersCount,
        topFill,
        sideFill,
        isLockedNode,
        isCurrentNode,
        isIslandFinale
      ) => {
        const rx = isIslandFinale ? 35 : 31;
        const ry = isIslandFinale ? 14 : 12.5;
        if (isLockedNode) {
          const cy = 44;
          return `
            <svg class="duo-step-hex-svg locked" viewBox="0 0 88 68" aria-hidden="true">
              <ellipse cx="44" cy="52" rx="${rx}" ry="${ry * 0.82}" fill="rgba(60,45,30,0.14)" />
              <polygon points="${44 - rx},${cy - 4} 44,${cy + ry - 4} ${44 + rx},${cy - 4} ${44 + rx},${cy + 4} 44,${cy + ry + 4} ${44 - rx},${cy + 4}"
                fill="#CBBBA2" stroke="#A6947A" stroke-width="1.6" stroke-linejoin="round" />
              <polygon points="44,${cy - ry - 4} ${44 + rx},${cy - 4} 44,${cy + ry - 4} ${44 - rx},${cy - 4}"
                fill="#EAE0D0" stroke="#A6947A" stroke-width="1.6" stroke-linejoin="round" />
              <polygon points="44,${cy - ry + 1} ${44 + rx - 8},${cy - 4} 44,${cy + ry - 9} ${44 - rx + 8},${cy - 4}"
                fill="#DFD3C0" stroke="rgba(255,255,255,0.5)" stroke-width="1.1" stroke-linejoin="round" />
              <text x="44" y="${cy - 4}" text-anchor="middle" dominant-baseline="central"
                fill="#8C7B65" font-family="Fraunces, Georgia, serif" font-size="14.5" font-weight="800">${levelNum}</text>
            </svg>
          `;
        }

        let layersMarkup = '';
        const stepDz = 5;
        const baseBottomY = 48;
        let topCenterY = 34;

        for (let i = 0; i < layersCount; i++) {
          const cy = baseBottomY - i * stepDz;
          const isTop = i === layersCount - 1;
          const layerTopColor = isTop ? topFill : i % 2 === 0 ? sideFill : topFill;
          layersMarkup += `
            <polygon points="${44 - rx},${cy - 4} 44,${cy + ry - 4} ${44 + rx},${cy - 4} ${44 + rx},${cy + 3} 44,${cy + ry + 3} ${44 - rx},${cy + 3}"
              fill="${sideFill}" stroke="#231F20" stroke-width="1.6" stroke-linejoin="round" />
            <polygon points="44,${cy - ry - 4} ${44 + rx},${cy - 4} 44,${cy + ry - 4} ${44 - rx},${cy - 4}"
              fill="${layerTopColor}" stroke="#231F20" stroke-width="1.7" stroke-linejoin="round" />
          `;
          if (isTop) {
            topCenterY = cy - 4;
            layersMarkup += `
              <polygon points="44,${cy - ry + 1} ${44 + rx - 8},${cy - 4} 44,${cy + ry - 9} ${44 - rx + 8},${cy - 4}"
                fill="rgba(255,255,255,0.24)" stroke="rgba(255,255,255,0.75)" stroke-width="1.2" stroke-linejoin="round" />
            `;
          }
        }

        const numFill = isCurrentNode ? '#231F20' : '#FFFFFF';
        const numStroke = isCurrentNode ? 'rgba(255,255,255,0.9)' : '#231F20';

        return `
          <svg class="duo-step-hex-svg ${isCurrentNode ? 'is-current' : ''}" viewBox="0 0 88 68" aria-hidden="true">
            ${
              isCurrentNode
                ? `<ellipse cx="44" cy="51" rx="${rx + 7}" ry="${ry + 3}" fill="rgba(255, 183, 3, 0.22)" stroke="#FFB703" stroke-width="2.2" stroke-dasharray="5 3" />`
                : ''
            }
            <ellipse cx="44" cy="52" rx="${rx + 1}" ry="${ry * 0.85}" fill="rgba(35,25,15,0.24)" />
            ${layersMarkup}
            <text x="44" y="${topCenterY}" text-anchor="middle" dominant-baseline="central"
              fill="${numFill}" stroke="${numStroke}" stroke-width="2.4" paint-order="stroke fill"
              font-family="Fraunces, Georgia, serif" font-size="${isCurrentNode ? 17 : 15}" font-weight="900">${levelNum}</text>
          </svg>
        `;
      };

      const nodesGrid = document.getElementById('hub-level-nodes-grid');
      if (!nodesGrid) return;
      nodesGrid.innerHTML = '';

      // Determine equipped companion figurine sprite for the active step
      const equippedFig =
        Catalog.getFigurineById(this.profile.equippedFigurineId) ||
        Catalog.getFigurineById(this.profile.unlockedFigurines[0] || 'fig-01') ||
        Catalog.FIGURINES[0];
      const equippedSpriteUrl = getFigurineSpriteUrl(equippedFig);

      const totalIslands = this.profile.highestUnlockedLevel > 100 ? 11 : 10;
      // Smooth Duolingo S-curve horizontal offsets (in a 358px wide virtual stage, centerX = 179)
      const curveOffsets = [0, -42, -68, -42, 0, 42, 68, 42, 16, 0];

      for (let ch = 1; ch <= totalIslands; ch++) {
        const theme = ISLAND_THEMES[ch] || ISLAND_THEMES[1];
        const startLvl = ch === 11 ? 101 : (ch - 1) * 10 + 1;
        const endLvl = startLvl + 9;

        let chStars = 0;
        let completedInIsland = 0;
        for (let l = startLvl; l <= endLvl; l++) {
          const st = this.profile.levelStars[l] || 0;
          chStars += st;
          if (st > 0 || l < currLvl) completedInIsland++;
        }

        const unitEl = document.createElement('section');
        unitEl.className = `duo-island-unit`;
        unitEl.setAttribute('data-island-chapter', String(ch));
        unitEl.style.setProperty('--unit-bg', theme.headerBg);
        unitEl.style.setProperty('--unit-lip', theme.headerLip);

        // 1. Clean Duolingo-Style Horizontal Island Divider (between islands)
        if (ch > 1) {
          const dividerEl = document.createElement('div');
          dividerEl.className = 'duo-island-divider';
          dividerEl.innerHTML = `
            <span class="duo-divider-line"></span>
            <span class="duo-divider-pill">${theme.shortBadge} · Lv. ${startLvl}–${endLvl}</span>
            <span class="duo-divider-line"></span>
          `;
          unitEl.appendChild(dividerEl);
        }

        // 2. Winding 10-Step 3D Hex Path + Floating 3D Hex Island Diorama Landmarks
        const stageEl = document.createElement('div');
        stageEl.className = 'duo-island-stage';

        // Compute coordinates for the 10 steps in this island (358 x 790 viewBox)
        const pts = [];
        for (let idx = 0; idx < 10; idx++) {
          const x = 179 + (curveOffsets[idx] || 0);
          const y = 46 + idx * 78;
          pts.push({ x, y });
        }

        // Build smooth SVG path connecting all 10 steps (plus bridge tail to next island)
        let pathD = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 0; i < pts.length - 1; i++) {
          const p0 = pts[i];
          const p1 = pts[i + 1];
          const midY = (p0.y + p1.y) * 0.5;
          pathD += ` C ${p0.x} ${midY}, ${p1.x} ${midY}, ${p1.x} ${p1.y}`;
        }
        if (ch < totalIslands) {
          const lastPt = pts[pts.length - 1];
          pathD += ` L ${lastPt.x} ${lastPt.y + 44}`;
        }

        const progressRatio = Math.min(1, Math.max(0, completedInIsland / 10));

        // Insert SVG stepping-stone trail + 2 Floating 3D Hex Island Landmarks
        const heroFig = Catalog.getFigurineById(theme.heroFigId) || Catalog.FIGURINES[0];
        const subFig = Catalog.getFigurineById(theme.subFigId) || Catalog.FIGURINES[0];

        stageEl.innerHTML = `
          <svg class="duo-island-trail-svg" viewBox="0 0 358 790" preserveAspectRatio="none" aria-hidden="true">
            <path d="${pathD}" fill="none" stroke="#E4D7C3" stroke-width="16" stroke-linecap="round" />
            <path d="${pathD}" fill="none" stroke="${theme.headerBg}" stroke-width="10" stroke-linecap="round"
              pathLength="100" stroke-dasharray="100" stroke-dashoffset="${Math.round((1 - progressRatio) * 100)}" />
            <path d="${pathD}" fill="none" stroke="#FFFDF8" stroke-width="3" stroke-dasharray="6 8" stroke-linecap="round" />
          </svg>

          <!-- Primary Floating 3D Contiguous Hex Island Diorama (Right Bend) -->
          <button type="button" class="duo-floating-island-diorama primary-right tap-target" data-fig-id="${heroFig.id}" title="Inspect ${heroFig.name}">
            ${buildContiguousHexIslandClusterSvg(theme.islandColors, true)}
            <img src="${getFigurineSpriteUrl(heroFig)}" alt="${heroFig.name}" class="duo-island-figurine-sprite hero" loading="lazy" />
            <span class="duo-island-landmark-tag">${theme.shortBadge}</span>
          </button>

          <!-- Secondary Floating 3D Hex Outcrop Island (Left Bend) -->
          <button type="button" class="duo-floating-island-diorama secondary-left tap-target" data-fig-id="${subFig.id}" title="Inspect ${subFig.name}">
            ${buildContiguousHexIslandClusterSvg(theme.islandColors, false)}
            <img src="${getFigurineSpriteUrl(subFig)}" alt="${subFig.name}" class="duo-island-figurine-sprite sub" loading="lazy" />
          </button>
        `;

        // Wire click on island landmark sprites to open the 3D Figurine Turntable Inspector
        stageEl.querySelectorAll('.duo-floating-island-diorama').forEach((islandBtn) => {
          islandBtn.addEventListener('click', () => {
            const fid = islandBtn.getAttribute('data-fig-id');
            if (fid) {
              this.audio.playUiClick();
              this.inspectFigurine(fid);
            }
          });
        });

        // Create the 10 3D Hex Stack Step Buttons along the winding path
        for (let idx = 0; idx < 10; idx++) {
          const l = startLvl + idx;
          const pt = pts[idx];
          const stars = this.profile.levelStars[l] || 0;
          const isUnlocked = l <= this.profile.highestUnlockedLevel;
          const isCurr = l === currLvl;
          const isIslandFinale = idx === 9;

          const btn = document.createElement('button');
          btn.type = 'button';
          btn.disabled = !isUnlocked;
          btn.setAttribute('data-level-num', String(l));
          btn.className = `level-node-btn duo-hex-step-btn tap-target ${isCurr ? 'current is-current-step' : ''} ${stars > 0 ? 'completed' : ''} ${!isUnlocked ? 'locked-node' : ''} ${isIslandFinale ? 'island-finale-step' : ''}`;
          btn.style.left = `${((pt.x / 358) * 100).toFixed(2)}%`;
          btn.style.top = `${pt.y}px`;

          const topFill = isCurr
            ? '#FFC542'
            : stars >= 3
            ? theme.stepTop
            : stars > 0
            ? theme.islandColors[0]
            : theme.stepTop;
          const sideFill = isCurr
            ? '#D97706'
            : stars >= 3
            ? theme.stepSide
            : stars > 0
            ? theme.headerLip
            : theme.stepSide;
          const layersCount = isCurr ? 4 : isIslandFinale ? 4 : stars > 0 ? 3 : 2;

          const hexSvg = build3DHexStepSvg(
            l,
            layersCount,
            topFill,
            sideFill,
            !isUnlocked,
            isCurr,
            isIslandFinale
          );

          const starStr =
            stars > 0 ? '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars)) : '';

          btn.innerHTML = `
            ${isCurr ? `<span class="duo-start-callout">START</span>` : ''}
            ${
              isCurr
                ? `<div class="duo-active-buddy-wrap" aria-hidden="true">
                     <img src="${equippedSpriteUrl}" alt="" class="duo-active-buddy-img" />
                   </div>`
                : ''
            }
            ${hexSvg}
            ${isIslandFinale ? `<img src="assets/art/icon_chest.png" class="duo-finale-chest" alt="" aria-hidden="true" />` : ''}
            ${starStr ? `<span class="duo-step-stars">${starStr}</span>` : ''}
          `;

          if (isUnlocked) {
            btn.addEventListener('click', () => {
              this.audio.playUiClick();
              this.profile.currentLevel = l;
              this.saveProfile();
              this.loadLevel(l);
              this.setScreen('board');
              this.showRoundStartBanner(l);
            });
          }

          stageEl.appendChild(btn);
        }

        unitEl.appendChild(stageEl);
        nodesGrid.appendChild(unitEl);
      }

      // Bind continuous scroll listener to update the sticky Duolingo unit banner dynamically
      const scrollContainer = document.getElementById('hub-continuous-scroll');
      const currentChapter = currLvl > 100 ? 11 : Math.max(1, Math.min(10, Math.ceil(currLvl / 10)));
      updateStickyIslandHeader(currentChapter);

      if (scrollContainer && !scrollContainer._hasDuoScrollBound) {
        scrollContainer._hasDuoScrollBound = true;
        scrollContainer.addEventListener(
          'scroll',
          () => {
            const units = scrollContainer.querySelectorAll('.duo-island-unit');
            const scrollTop = scrollContainer.scrollTop + 90;
            let activeCh = 1;
            units.forEach((u) => {
              if (u.offsetTop <= scrollTop) {
                activeCh = Number(u.getAttribute('data-island-chapter')) || 1;
              }
            });
            updateStickyIslandHeader(activeCh);
          },
          { passive: true }
        );
      }

      // Auto-scroll to the player's current active level step on next frame
      requestAnimationFrame(() => {
        this.scrollToCurrentHubLevel(false);
      });
    }

    renderDailyUI() {
      const dateStr = '2026-10-17';
      const dailyCfg = Catalog.getDailyChallengeConfig(dateStr);

      const dateLabel = document.getElementById('daily-date-label');
      const gridBadge = document.getElementById('daily-grid-badge');
      const modName = document.getElementById('daily-mod-name');
      const modDesc = document.getElementById('daily-mod-desc');
      const streakPill = document.getElementById('daily-streak-pill');

      if (dateLabel) dateLabel.textContent = `October 17, 2026 · Seed #${dailyCfg.id}`;
      if (gridBadge) gridBadge.textContent = `${dailyCfg.gridSlots}-Slot`;
      if (modName) modName.textContent = dailyCfg.modifierName;
      if (modDesc) modDesc.textContent = dailyCfg.modifierDesc;
      if (streakPill) streakPill.textContent = `★ ${this.profile.dailyStreak}`;

      // Monthly Calendar Grid (31 days)
      const calGrid = document.getElementById('daily-calendar-grid');
      if (calGrid) {
        calGrid.innerHTML = '';
        for (let d = 1; d <= 31; d++) {
          const cell = document.createElement('div');
          const isStamped = d <= 16;
          const isToday = d === 17;
          cell.className = `cal-day ${isStamped ? 'stamped' : ''} ${isToday ? 'today' : ''}`;
          cell.textContent = isStamped ? `${d}✓` : String(d);
          calGrid.appendChild(cell);
        }
      }

      // Global Leaderboard List
      const lbList = document.getElementById('daily-leaderboard-list');
      if (lbList) {
        lbList.innerHTML = '';
        const rows = [...dailyCfg.leaderboard];
        rows.push({
          rank: 4,
          handle: 'You (Atelier Sculptor)',
          badge: '★ Studio Host',
          moves: Math.max(16, this.movesTaken || 20),
          bursts: Math.max(6, this.bursts10 || 7),
          score: Math.max(4180, this.bestScore),
          isPlayer: true
        });
        rows.sort((a, b) => b.score - a.score);
        rows.forEach((r, idx) => {
          const rowEl = document.createElement('div');
          rowEl.className = `lb-row ${r.isPlayer ? 'player-row' : ''}`;
          rowEl.innerHTML = `
            <div class="lb-left">
              <span class="lb-rank">${idx + 1}</span>
              <div>
                <div class="lb-handle">${r.handle}</div>
                <div class="lb-meta">${r.badge} · ${r.moves} moves · ${r.bursts} bursts</div>
              </div>
            </div>
            <div class="lb-score">${r.score.toLocaleString()} pts</div>
          `;
          lbList.appendChild(rowEl);
        });
      }
    }

    claimStarMilestoneChest() {
      const earnedStars = Object.values(this.profile.levelStars).reduce((a, b) => a + b, 0);
      const availableStarChests = Math.max(
        0,
        Math.floor(earnedStars / 12) - (this.profile.starChestsClaimed || 0)
      );
      if (availableStarChests > 0) {
        this.profile.starChestsClaimed = (this.profile.starChestsClaimed || 0) + 1;
        this.saveProfile();
        this.renderHubUI();
        this.triggerUnboxingModal(null, { boosted: true, fromWin: false });
        return true;
      }
      this.setScreen('gallery');
      return false;
    }

    renderGalleryUI() {
      const countPill = document.getElementById('gallery-count-pill');
      if (countPill) {
        countPill.textContent = `${this.profile.unlockedFigurines.length} / 60`;
      }

      // 1. Themed Equipped Companion Showcase Card
      const kit = this.getEquippedCosmeticKit();
      const eqFig = kit.figurine;
      const buddyCard = document.getElementById('gallery-buddy-card');
      const buddyKicker = document.getElementById('gallery-buddy-kicker');
      const buddyAvatar = document.getElementById('gallery-buddy-avatar');
      const buddyName = document.getElementById('gallery-buddy-name');
      const buddyKit = document.getElementById('gallery-buddy-kit');
      const buddySwatches = document.getElementById('gallery-buddy-swatches');
      const buddyToggleBtn = document.getElementById('btn-gallery-buddy-toggle');

      const vibrantPrimary =
        eqFig && !['#faf7f2', '#fffdf7', '#f4efe6', '#ffffff'].includes(String(eqFig.primaryColor).toLowerCase())
          ? eqFig.primaryColor
          : (eqFig && (eqFig.secondaryColor || eqFig.accentColor)) || '#D4A349';

      if (buddyCard) {
        buddyCard.classList.toggle('has-equipped-buddy', !!eqFig);
        buddyCard.style.setProperty('--buddy-primary', vibrantPrimary);
        buddyCard.style.setProperty('--buddy-secondary', eqFig ? eqFig.secondaryColor : '#8C6223');
        buddyCard.style.setProperty('--buddy-accent', eqFig ? eqFig.accentColor : '#FF9F1C');
        buddyCard.style.setProperty('--buddy-rim', kit.rimFill || '#E8DBC5');
      }
      if (buddyKicker) {
        buddyKicker.textContent = eqFig ? `★ ACTIVE COMPANION` : '◆ STUDIO DEFAULT';
      }

      if (buddyAvatar) {
        if (eqFig) {
          buddyAvatar.innerHTML = trophyMarkup(eqFig, { locked: false, size: 'card' });
          buddyAvatar.onclick = () => {
            this.audio.playUiClick();
            this.inspectFigurine(eqFig.id);
          };
        } else {
          buddyAvatar.innerHTML = `<span class="buddy-classic-icon">◆</span>`;
          buddyAvatar.onclick = null;
        }
      }
      if (buddyName) {
        buddyName.textContent = eqFig ? eqFig.name : 'Classic Studio Birch';
      }
      if (buddyKit) {
        const shortKit = String(kit.kitTitle || 'Studio Kit').split('·')[0].trim();
        const trackLabel =
          this.audio && this.audio.currentTrack && this.audio.currentTrack.instrumentLabel
            ? ` · ♪ ${this.audio.currentTrack.instrumentLabel}`
            : '';
        buddyKit.textContent = `${shortKit}${trackLabel}`;
      }
      if (buddySwatches) {
        const pal = kit.discPalette || [];
        const c0 = pal[0] || { top: '#FF5964', side: '#B82E38', ink: '#FFF' };
        const c1 = pal[1] || { top: '#2EC4B6', side: '#158479', ink: '#FFF' };
        const c2 = pal[2] || { top: '#F4B942', side: '#B47B18', ink: '#231F20' };
        const miniHexStackSvg = `
          <svg class="buddy-mini-hex-svg" viewBox="0 0 38 30" aria-hidden="true">
            <polygon points="3,19 19,25 35,19 35,23 19,29 3,23" fill="${c1.side}" stroke="#231F20" stroke-width="1.2"/>
            <polygon points="19,13 35,19 19,25 3,19" fill="${c1.top}" stroke="#231F20" stroke-width="1.2"/>
            <polygon points="3,15 19,21 35,15 35,19 19,25 3,19" fill="${c2.side}" stroke="#231F20" stroke-width="1.2"/>
            <polygon points="19,9 35,15 19,21 3,15" fill="${c2.top}" stroke="#231F20" stroke-width="1.2"/>
            <polygon points="3,11 19,17 35,11 35,15 19,21 3,15" fill="${c0.side}" stroke="#231F20" stroke-width="1.2"/>
            <polygon points="19,5 35,11 19,17 3,11" fill="${c0.top}" stroke="#231F20" stroke-width="1.3"/>
          </svg>
        `;
        const discChips = pal
          .map(
            (c) =>
              `<span class="buddy-swatch-disc" style="background:${c.top};color:${c.ink};" title="${c.name}">${c.symbol}</span>`
          )
          .join('');
        buddySwatches.innerHTML = `
          ${miniHexStackSvg}
          <span class="buddy-swatch-board" style="background:${kit.rimFill};border-color:${kit.rimStroke};">Board</span>
          ${discChips}
        `;
      }
      if (buddyToggleBtn) {
        buddyToggleBtn.textContent = eqFig ? '◆ Classic Birch' : '★ Equip Buddy';
        buddyToggleBtn.onclick = () => {
          this.audio.playUiClick();
          if (eqFig) {
            this.equipFigurine(null);
          } else {
            const firstUnlocked = this.profile.unlockedFigurines[0] || 'fig-01';
            this.equipFigurine(firstUnlocked);
          }
        };
      }

      // 1B. Japanese Gashapon Machine Bar (Tokens + 天井 Pity + Pickup Series)
      const gashaPityTag = document.getElementById('gallery-gasha-pity-tag');
      const gashaSub = document.getElementById('gallery-gasha-sub');
      const gashaBtnLabel = document.getElementById('btn-gallery-gasha-label');
      const pullCount = this.profile.gachaPullCount || 0;
      const inFive = pullCount % 5;
      const nextPullNum = pullCount + 1;
      const pickup = this.getFeaturedPickupSeries();
      if (gashaPityTag) {
        if (nextPullNum % 10 === 0) {
          gashaPityTag.textContent = '★ NEXT: SSR/UR 確定!';
        } else if (nextPullNum % 5 === 0) {
          gashaPityTag.textContent = '★ NEXT: SR+ 確定!';
        } else {
          gashaPityTag.textContent = `天井 ${inFive}/5 to SR+`;
        }
      }
      if (gashaSub) {
        gashaSub.textContent = `★ ${this.profile.keys || 0}/3 Keys · ${pickup.seriesName}`;
      }
      if (gashaBtnLabel) {
        gashaBtnLabel.textContent =
          (this.profile.keys || 0) >= 3 ? '★ SPIN (3 KEYS)' : '★ 120 PRISMS';
      }

      // 2. Series Filter Strip
      const strip = document.getElementById('gallery-series-strip');
      if (strip) {
        strip.innerHTML = '';
        const allBtn = document.createElement('button');
        allBtn.type = 'button';
        allBtn.className = `series-filter-pill tap-target ${this.profile.selectedSeriesFilter === 'all' ? 'active' : ''}`;
        allBtn.textContent = 'All';
        allBtn.addEventListener('click', () => {
          this.profile.selectedSeriesFilter = 'all';
          this.renderGalleryUI();
        });
        strip.appendChild(allBtn);

        Catalog.FIGURINE_SERIES.forEach((s) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `series-filter-pill tap-target ${this.profile.selectedSeriesFilter === s.seriesId ? 'active' : ''}`;
          btn.textContent = s.seriesName;
          btn.addEventListener('click', () => {
            this.profile.selectedSeriesFilter = s.seriesId;
            this.renderGalleryUI();
          });
          strip.appendChild(btn);
        });
      }

      // 3. 60-Figurine Cubby Shelves (Locked = Pure Dark Silhouette Only!)
      const container = document.getElementById('gallery-shelves-container');
      if (container) {
        container.innerHTML = '';
        const rawList =
          this.profile.selectedSeriesFilter === 'all'
            ? Catalog.FIGURINES
            : Catalog.getFigurinesBySeries(this.profile.selectedSeriesFilter);
        const list = [...rawList].sort((a, b) => {
          const aEq = this.profile.equippedFigurineId === a.id ? 1 : 0;
          const bEq = this.profile.equippedFigurineId === b.id ? 1 : 0;
          if (aEq !== bEq) return bEq - aEq;
          const aUn = this.profile.unlockedFigurines.includes(a.id) ? 1 : 0;
          const bUn = this.profile.unlockedFigurines.includes(b.id) ? 1 : 0;
          if (aUn !== bUn) return bUn - aUn;
          return 0;
        });

        list.forEach((fig) => {
          const isUnlocked = this.profile.unlockedFigurines.includes(fig.id);
          const isEquipped = isUnlocked && this.profile.equippedFigurineId === fig.id;
          const dupCount = this.profile.figurineCounts[fig.id] || (isUnlocked ? 1 : 0);
          const card = document.createElement('button');
          card.type = 'button';
          const tier = getFigurineTier(fig);
          card.setAttribute('data-fig-id', fig.id);
          card.className = `figurine-cubby-card trophy-card tier-${tier} tap-target ${isUnlocked ? 'unlocked' : 'locked'} ${isEquipped ? 'is-equipped' : ''}`;
          card.setAttribute(
            'aria-label',
            isUnlocked ? `${fig.name}, ${fig.rarity}${isEquipped ? ', Equipped' : ''}` : `Locked mystery figurine silhouette`
          );
          card.innerHTML = `
            ${isEquipped ? `<span class="cubby-equipped-badge">★ Equipped</span>` : ''}
            ${isUnlocked && dupCount > 1 ? `<span class="cubby-dup-count-badge">×${dupCount}</span>` : ''}
            ${trophyMarkup(fig, { locked: !isUnlocked, size: 'card' })}
            <div class="cubby-fig-name">${isUnlocked ? fig.name : '???'}</div>
            <div class="trophy-tier-label tier-${tier}">${isUnlocked ? fig.rarity : 'Locked · ' + fig.rarity}</div>
          `;
          card.addEventListener('click', () => {
            this.audio.playUiClick();
            this.inspectFigurine(fig.id);
          });
          container.appendChild(card);
        });
      }
    }

    inspectFigurine(figurineId) {
      const fig = Catalog.getFigurineById(figurineId);
      this.inspectedFigurine = fig;
      this.turntableAngle = 0.25;

      const unlockedNow = this.profile.unlockedFigurines.includes(fig.id);
      const isEquipped = unlockedNow && this.profile.equippedFigurineId === fig.id;
      const dupCount = this.profile.figurineCounts[fig.id] || (unlockedNow ? 1 : 0);

      const sLabel = document.getElementById('turntable-series-label');
      const fName = document.getElementById('turntable-fig-name');
      const rBadge = document.getElementById('turntable-rarity-badge');
      const uBadge = document.getElementById('turntable-unlock-badge');
      const blurb = document.getElementById('turntable-lore-blurb');
      const spinHint = document.getElementById('turntable-spin-hint');
      const cosmeticPreview = document.getElementById('turntable-cosmetic-preview');
      const equipBtn = document.getElementById('btn-turntable-equip');
      const equipBtnText = document.getElementById('btn-turntable-equip-text');

      if (sLabel) sLabel.textContent = `SERIES ${fig.seriesIndex} · ${fig.seriesName.toUpperCase()}`;
      if (fName) fName.textContent = unlockedNow ? fig.name : '???';
      if (rBadge) {
        rBadge.className = `trophy-tier-label tier-${getFigurineTier(fig)}`;
        rBadge.removeAttribute('style');
        rBadge.textContent = fig.rarity;
      }
      if (uBadge) {
        uBadge.textContent = unlockedNow
          ? isEquipped
            ? '★ Equipped Buddy'
            : dupCount > 1
            ? `✓ Owned ×${dupCount}`
            : '✓ In Collection'
          : 'Mystery Silhouette';
      }
      if (blurb) {
        blurb.textContent = unlockedNow
          ? fig.blurb
          : 'Locked Mystery Figurine — Unbox from a Blind-Box Chest (every 5 levels, every 12 ★ earned, or Hidden Board Capsules)!';
      }
      if (spinHint) {
        spinHint.classList.toggle('hidden', !unlockedNow);
      }

      if (cosmeticPreview) {
        if (unlockedNow && typeof Catalog.getFigurineCosmeticKit === 'function') {
          const figKit = Catalog.getFigurineCosmeticKit(fig);
          if (this.audio && typeof this.audio.setEquippedFigurineTrack === 'function') {
            this.audio.setEquippedFigurineTrack(fig, true);
          }
          const trackInfo =
            this.audio && this.audio.currentTrack
              ? ` · ♪ ${this.audio.currentTrack.instrumentLabel} (${this.audio.currentTrack.bpm} BPM)`
              : '';
          const swatchesHtml = (figKit.discPalette || [])
            .map(
              (c) =>
                `<span class="buddy-swatch-disc" style="background:${c.top};color:${c.ink};" title="${c.name}">${c.symbol}</span>`
            )
            .join('');
          cosmeticPreview.innerHTML = `
            <span class="turntable-cosmetic-label">◆ ${figKit.kitTitle}${trackInfo}</span>
            <div class="buddy-swatch-row">
              <span class="buddy-swatch-board" style="background:${figKit.rimFill};border-color:${figKit.rimStroke};">Board</span>
              ${swatchesHtml}
            </div>
          `;
          cosmeticPreview.classList.remove('hidden');
        } else {
          cosmeticPreview.classList.add('hidden');
        }
      }

      if (equipBtn) {
        equipBtn.classList.toggle('hidden', !unlockedNow);
        if (equipBtnText) {
          equipBtnText.textContent = isEquipped
            ? '✓ Equipped Buddy (Tap for Classic)'
            : '★ Equip Figurine (Board & Discs)';
        }
      }

      if (window.PopStacks3DViewer) {
        window.PopStacks3DViewer.stopLoop();
      }

      const host = document.getElementById('inspector-trophy');
      if (host) {
        host.innerHTML = trophyMarkup(fig, { locked: !unlockedNow, size: 'inspect' });
      }
      this.turntableTilt = 0;

      const modal = document.getElementById('turntable-modal');
      if (modal) modal.classList.remove('hidden');

      // STRICT RULE: Only mount the 3D GLB viewer when the figurine is UNLOCKED.
      // Locked figurines remain 100% flat dark silhouettes with zero unpainted 3D model!
      if (unlockedNow && host && window.PopStacks3DViewer) {
        const stageEl = host.querySelector('.trophy-stage');
        if (stageEl) {
          window.PopStacks3DViewer.mount(stageEl, fig, { locked: false });
        }
      }
    }

    renderShopUI() {
      const passStatus = document.getElementById('shop-pass-status');
      const passCta = document.getElementById('btn-pass-cta-text');
      if (passStatus) {
        passStatus.textContent = this.profile.collectorPass ? '★ VIP ACTIVE' : 'READY TO CLAIM';
      }
      if (passCta) {
        passCta.textContent = this.profile.collectorPass
          ? '★ VIP PASS ACTIVE ✓ (WATCH AD FOR +100 PRISMS)'
          : '▶ WATCH AD — ACTIVATE VIP PASS';
      }
      this.updateMetaTopBar();
    }

    // -------------------------------------------------------------------------
    // Responsive Canvas, Pinch-to-Zoom & Isometric Hex Coordinate Math
    // -------------------------------------------------------------------------
    handleResize() {
      const stage = document.getElementById('stage-container');
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      this.dpr = Math.min(window.devicePixelRatio || 1, 3);
      this.width = Math.max(320, rect.width || 390);
      this.height = Math.max(360, rect.height || 520);

      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);

      // Compute responsive hex sizing for 7-slot (R=1), 19-slot (R=2), and 37-slot (R=3)
      const availW = this.width * 0.94;
      const availBoardH = this.height * 0.65;

      const colsSpan = this.gridRadius === 1 ? 3.18 : this.gridRadius === 2 ? 4.92 : 6.82;
      const rowsSpan = this.gridRadius === 1 ? 2.95 : this.gridRadius === 2 ? 4.58 : 6.32;
      const maxHexR = this.gridRadius === 1 ? 52 : this.gridRadius === 2 ? 36 : 25;
      const minHexR = this.gridRadius === 3 ? 20 : 25;

      const radiusByW = availW / (colsSpan * Math.sqrt(3));
      const radiusByH = availBoardH / (rowsSpan * 1.5 * Y_TILT + 1.3);
      this.baseHexRadius = Math.max(minHexR, Math.min(maxHexR, Math.min(radiusByW, radiusByH)));
      this.baseBoardCenterX = this.width * 0.5;
      this.baseBoardCenterY = this.height * 0.41;

      this.applyBoardZoomTransform();

      // 3-Slot + 4th Extra Staging Slot Dispenser Tray Geometry (anchored at 1.0x scale)
      this.trayY = this.height * 0.835;
      const reachShift =
        this.settings.thumbReach === 'left' ? -14 : this.settings.thumbReach === 'right' ? 14 : 0;
      const trayW = Math.min(this.width * 0.94, 366);
      const trayLeft = this.baseBoardCenterX - trayW / 2 + reachShift;

      this.traySlotPositions = [
        { x: trayLeft + trayW * 0.17, y: this.trayY },
        { x: trayLeft + trayW * 0.42, y: this.trayY },
        { x: trayLeft + trayW * 0.67, y: this.trayY },
        { x: trayLeft + trayW * 0.88, y: this.trayY }
      ];
    }

    applyBoardZoomTransform() {
      this.boardZoom = Math.max(1.0, Math.min(2.25, Number(this.boardZoom) || 1.0));
      const maxPanX = (this.boardZoom - 1) * this.width * 0.44;
      const maxPanY = (this.boardZoom - 1) * this.height * 0.32;
      this.boardPanX = Math.max(-maxPanX, Math.min(maxPanX, this.boardPanX || 0));
      this.boardPanY = Math.max(-maxPanY, Math.min(maxPanY, this.boardPanY || 0));

      this.hexRadius = this.baseHexRadius * this.boardZoom;
      const baseDiscThickness = Math.max(5.2, Math.min(9.5, this.baseHexRadius * 0.195));
      this.discThickness = baseDiscThickness * this.boardZoom;
      this.boardCenterX = this.baseBoardCenterX + this.boardPanX;
      this.boardCenterY = this.baseBoardCenterY + this.boardPanY;

      const btnZoom = document.getElementById('btn-zoom-reset');
      const zoomLbl = document.getElementById('zoom-val-label');
      if (btnZoom) {
        btnZoom.classList.toggle('hidden', this.boardZoom <= 1.03);
      }
      if (zoomLbl) {
        zoomLbl.textContent = `${this.boardZoom.toFixed(1)}×`;
      }
    }

    resetBoardZoom() {
      this.boardZoom = 1.0;
      this.boardPanX = 0;
      this.boardPanY = 0;
      this.applyBoardZoomTransform();
    }

    setBoardZoom(zoomValue, panX = 0, panY = 0) {
      this.boardZoom = Math.max(1.0, Math.min(2.25, Number(zoomValue) || 1.0));
      this.boardPanX = Number(panX) || 0;
      this.boardPanY = Number(panY) || 0;
      this.applyBoardZoomTransform();
      return this.boardZoom;
    }

    onTouchStartPinch(e) {
      if (this.activeScreen !== 'board') return;
      if (e.touches && e.touches.length === 2) {
        e.preventDefault();
        // Cancel any single-finger tray drag when second finger touches down
        this.dragState.active = false;
        this.dragState.trayIndex = -1;
        this.dragState.snappedKey = null;

        const rect = this.canvas.getBoundingClientRect();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.max(12, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
        const midX = (t0.clientX + t1.clientX) * 0.5 - rect.left;
        const midY = (t0.clientY + t1.clientY) * 0.5 - rect.top;

        this.pinchState.active = true;
        this.pinchState.startDist = dist;
        this.pinchState.startZoom = this.boardZoom;
        this.pinchState.startMidX = midX;
        this.pinchState.startMidY = midY;
        this.pinchState.startPanX = this.boardPanX;
        this.pinchState.startPanY = this.boardPanY;
      }
    }

    onTouchMovePinch(e) {
      if (this.activeScreen !== 'board') return;
      if (this.pinchState.active && e.touches && e.touches.length === 2) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        const dist = Math.max(12, Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY));
        const midX = (t0.clientX + t1.clientX) * 0.5 - rect.left;
        const midY = (t0.clientY + t1.clientY) * 0.5 - rect.top;

        const newZoom = Math.max(1.0, Math.min(2.25, this.pinchState.startZoom * (dist / this.pinchState.startDist)));
        const zoomRatio = newZoom / this.pinchState.startZoom;

        // Zoom anchored around pinch midpoint + pan delta
        const startCenterX = this.baseBoardCenterX + this.pinchState.startPanX;
        const startCenterY = this.baseBoardCenterY + this.pinchState.startPanY;
        const newCenterX = midX - ( this.pinchState.startMidX - startCenterX ) * zoomRatio;
        const newCenterY = midY - ( this.pinchState.startMidY - startCenterY ) * zoomRatio;

        this.boardZoom = newZoom;
        this.boardPanX = newCenterX - this.baseBoardCenterX;
        this.boardPanY = newCenterY - this.baseBoardCenterY;
        this.applyBoardZoomTransform();
      }
    }

    onTouchEndPinch(e) {
      if (!e.touches || e.touches.length < 2) {
        this.pinchState.active = false;
      }
    }

    onWheelZoom(e) {
      if (this.activeScreen !== 'board') return;
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const ptX = e.clientX - rect.left;
      const ptY = e.clientY - rect.top;
      const oldZoom = this.boardZoom;
      const deltaFactor = e.deltaY < 0 ? 1.12 : 0.9;
      const newZoom = Math.max(1.0, Math.min(2.25, oldZoom * deltaFactor));
      const zoomRatio = newZoom / oldZoom;

      const newCenterX = ptX - (ptX - this.boardCenterX) * zoomRatio;
      const newCenterY = ptY - (ptY - this.boardCenterY) * zoomRatio;
      this.boardZoom = newZoom;
      this.boardPanX = newCenterX - this.baseBoardCenterX;
      this.boardPanY = newCenterY - this.baseBoardCenterY;
      this.applyBoardZoomTransform();
    }

    axialToPixel(q, r) {
      const spacing = this.hexRadius * 1.06;
      const x = this.boardCenterX + spacing * Math.sqrt(3) * (q + r / 2);
      const y = this.boardCenterY + spacing * (3 / 2) * r * Y_TILT;
      return { x, y };
    }

    // -------------------------------------------------------------------------
    // Round Progression, Banner & Living Ollie Companion Reactions
    // -------------------------------------------------------------------------
    setOllieReaction(text, mood = 'happy') {
      const comp = document.getElementById('board-ollie-companion');
      const bubble = document.getElementById('board-ollie-bubble');
      if (bubble && text) {
        bubble.textContent = text;
      }
      if (comp) {
        comp.classList.remove('mood-happy', 'mood-excited', 'mood-cheer', 'mood-warn', 'ollie-pop');
        comp.classList.add(`mood-${mood}`, 'ollie-pop', 'talking');
        setTimeout(() => comp.classList.remove('ollie-pop'), 420);
        clearTimeout(this.ollieTalkTimer);
        this.ollieTalkTimer = setTimeout(() => comp.classList.remove('talking'), 2200);
      }
    }

    showRoundStartBanner(levelNum) {
      const banner = document.getElementById('round-transition-banner');
      const title = document.getElementById('round-banner-title');
      const sub = document.getElementById('round-banner-sub');
      const def = Catalog.getLevelConfig(levelNum);
      if (!banner) return;

      if (title) {
        title.textContent = def.isEndless
          ? `∞ ENDLESS #${levelNum - 100}`
          : `LEVEL ${levelNum}`;
      }
      if (sub) sub.textContent = `${def.name}`;

      banner.classList.remove('hidden', 'animate-out');
      banner.classList.add('animate-in');

      this.scheduleTimeout(() => {
        banner.classList.remove('animate-in');
        banner.classList.add('animate-out');
        this.scheduleTimeout(() => {
          banner.classList.add('hidden');
          banner.classList.remove('animate-out');
        }, 280);
      }, 1150);
    }

    advanceToNextRound(options = {}) {
      const winModal = document.getElementById('level-win-modal');
      const unboxModal = document.getElementById('unboxing-modal');
      const adModal = document.getElementById('rewarded-ad-modal');
      if (winModal) winModal.classList.add('hidden');
      if (unboxModal) unboxModal.classList.add('hidden');
      if (adModal) adModal.classList.add('hidden');

      this.adStats.roundsSinceLastInterstitial = (this.adStats.roundsSinceLastInterstitial || 0) + 1;
      const shouldShowPacedInterstitial =
        !options.skipInterstitial &&
        !this.profile.collectorPass &&
        !this.adStats.watchedRewardedThisRound &&
        this.currentLevelNum >= 4 &&
        this.adStats.roundsSinceLastInterstitial >= 3;

      if (shouldShowPacedInterstitial) {
        this.adStats.roundsSinceLastInterstitial = 0;
        this.triggerInterstitialAd(() => {
          this.advanceToNextRound({ skipInterstitial: true });
        });
        return this.currentLevelNum + 1;
      }

      this.unboxFromWin = false;
      const nextLvl = this.isDailyMode
        ? this.profile.currentLevel
        : this.currentLevelNum + 1;
      this.profile.currentLevel = nextLvl;
      this.profile.highestUnlockedLevel = Math.max(this.profile.highestUnlockedLevel, nextLvl);
      this.profile.selectedChapter = nextLvl > 100 ? 11 : Math.ceil(nextLvl / 10);
      this.saveProfile();
      this.isDailyMode = false;

      if (this.audio && typeof this.audio.playRoundTransition === 'function') {
        this.audio.playRoundTransition();
      }

      this.loadLevel(nextLvl);
      this.setScreen('board');
      this.showRoundStartBanner(nextLvl);
      return nextLvl;
    }

    // -------------------------------------------------------------------------
    // Level Loading, Daily Challenge & Presets
    // -------------------------------------------------------------------------
    loadLevel(levelNumber = 1, options = {}) {
      this.clearAllTimers();
      const lvlNum = Math.max(1, Math.floor(Number(levelNumber) || 1));
      this.currentLevelNum = lvlNum;
      this.currentLevelDef = Catalog.getLevelConfig(lvlNum);
      this.isDailyMode = false;

      this.initBoardFromLevelDef(this.currentLevelDef);
      if (!options.stayOnCurrentScreen) {
        this.setScreen('board');
      }
    }

    startDailyChallenge(dateStr = '2026-10-17') {
      this.clearAllTimers();
      const dailyDef = Catalog.getDailyChallengeConfig(dateStr);
      this.currentLevelDef = dailyDef;
      this.currentLevelNum = dailyDef.level;
      this.isDailyMode = true;

      this.initBoardFromLevelDef(dailyDef);
      this.setScreen('board');
    }

    initBoardFromLevelDef(levelDef, options = {}) {
      this.clearAllTimers();
      this.gridRadius = Catalog.getRadiusForSlots(levelDef.gridRadius || levelDef.gridSlots || 2);
      this.seedString = String(levelDef.seed || `POPSTACKS-L${levelDef.level}`);
      this.rng = Catalog.createMulberry32(Catalog.hashSeedString(this.seedString));

      this.activeBooster = null;
      this.swapSourceCellKey = null;
      this.selectedTrayIndex = -1;
      this.isDeadlocked = false;
      this.isLevelWon = false;
      this.unboxFromWin = false;
      this.lowSpaceWarned = false;
      this.undoSnapshot = null;
      this.recommendedCellKey = null;
      this.extraSlotUnlocked = !!this.profile.collectorPass;
      this.waveIndex = 0;

      this.clearedByColor = {
        coral: 0,
        cobalt: 0,
        mustard: 0,
        mint: 0,
        plum: 0,
        terracotta: 0
      };
      this.totalDiscsCleared = 0;
      this.movesTaken = 0;
      this.cascadesTriggered = 0;
      this.bursts10 = 0;
      this.frozenCleared = 0;
      this.iceDamageDealt = 0;
      this.score = 0;
      this.clears = 0;
      this.combo = 0;
      this.maxCombo = 1;
      this.activeMultiplier = 1;
      this.burstStreak = 0;
      this.turnBurstsCount = 0;
      this.kilnFever = 0;
      this.overdriveMovesLeft = 0;
      this.boardShake = 0;
      this.hintsUsedThisRound = 0;
      if (this.adStats) {
        this.adStats.watchedRewardedThisRound = false;
      }
      this.capsuleFoundThisRound = false;
      this.scoreBreakdown = { bursts: 0, merges: 0, overstack: 0, efficiency: 0 };
      this.cascadeLog = [`Loaded ${levelDef.id}: ${levelDef.name} (${levelDef.gridSlots}-Slot)`];

      const btnUndo = document.getElementById('btn-undo');
      if (btnUndo) btnUndo.disabled = true;

      this.hideDeadlockModal();
      const winModal = document.getElementById('level-win-modal');
      if (winModal) winModal.classList.add('hidden');
      const unboxModal = document.getElementById('unboxing-modal');
      if (unboxModal) unboxModal.classList.add('hidden');
      const boosterBanner = document.getElementById('booster-overlay');
      if (boosterBanner) boosterBanner.classList.add('hidden');

      this.boardZoom = 1.0;
      this.boardPanX = 0;
      this.boardPanY = 0;
      this.handleResize();
      this.buildGridCells(this.gridRadius);

      if (!options.empty) {
        // Apply Brass Anvils
        if (Array.isArray(levelDef.anvils)) {
          levelDef.anvils.forEach((a) => {
            const c = this.cells.get(cellKey(a.q, a.r));
            if (c) {
              c.isAnvil = true;
              c.stack = [];
              c.iceHp = 0;
            }
          });
        }

        // Apply Starter Stacks
        if (Array.isArray(levelDef.starterStacks)) {
          levelDef.starterStacks.forEach((s) => {
            const c = this.cells.get(cellKey(s.q, s.r));
            if (c && !c.isAnvil) {
              c.stack = (s.stack || []).map(normalizeColorId);
            }
          });
        }

        // Apply Frozen Clay Tiles
        if (Array.isArray(levelDef.frozenCells)) {
          levelDef.frozenCells.forEach((f) => {
            const c = this.cells.get(cellKey(f.q, f.r));
            if (c && !c.isAnvil) {
              c.stack = (f.stack || []).map(normalizeColorId);
              c.iceHp = Math.max(1, Number(f.iceHp) || 1);
              c.maxIceHp = c.iceHp;
            }
          });
        }

        // Option 3: Embed 1 Hidden Gasha Key Capsule ONLY on 5-level milestone stages (Levels 5, 10, 15...)
        if ((levelDef.level || 1) % 5 === 0) {
          const frozenCandidates = this.cellList.filter((c) => !c.isAnvil && c.iceHp > 0 && c.stack.length > 0);
          const stackCandidates = this.cellList
            .filter((c) => !c.isAnvil && c.stack.length > 0)
            .sort((a, b) => b.stack.length - a.stack.length);
          const capsuleHost = frozenCandidates[0] || stackCandidates[0] || null;
          if (capsuleHost) {
            capsuleHost.hasCapsule = true;
          }
        }

        // Staggered spring-in animation for starter board stacks
        const starterCells = this.cellList.filter((c) => c.stack.length > 0);
        starterCells.forEach((cell, idx) => {
          cell.scaleX = 0.25;
          cell.scaleY = 0.25;
          this.scheduleTimeout(() => {
            this.addTween({
              target: cell,
              duration: 200,
              onUpdate: (t, tgt) => {
                const s = this.springEase(t);
                tgt.scaleX = s;
                tgt.scaleY = s;
              },
              onComplete: (tgt) => {
                tgt.scaleX = 1;
                tgt.scaleY = 1;
              }
            });
          }, idx * 24);
        });
      }

      // Deal opening 3-stack wave
      this.tray = [null, null, null, null];
      if (!options.empty) {
        const wave = Catalog.generateTrayWave(this, this.rng, levelDef, 0);
        this.waveIndex = 1;
        for (let i = 0; i < 3; i++) {
          this.tray[i] = {
            discs: [...wave[i]],
            scale: 1,
            offsetY: 0
          };
        }
      }

      this.setOllieReaction(
        levelDef.isFtue ? "Let's stack & pop!" : `Level ${levelDef.level}!`,
        'happy'
      );
      this.updateFtueBanner();
      this.updateHUD();
      this.updateBoosterDockUI();
      this.updateDebugUI();
    }

    buildGridCells(radius) {
      this.cells.clear();
      this.cellList = [];
      const coords = Catalog.generateAxialGridCoords(radius);
      coords.forEach((c) => {
        const cell = {
          q: c.q,
          r: c.r,
          key: c.key,
          ring: c.ring,
          stack: [],
          isAnvil: false,
          hasCapsule: false,
          iceHp: 0,
          maxIceHp: 0,
          scaleX: 1,
          scaleY: 1,
          offsetZ: 0
        };
        this.cells.set(cell.key, cell);
        this.cellList.push(cell);
      });
    }

    collectBoardCapsule(x, y) {
      if (this.capsuleFoundThisRound) return;
      this.capsuleFoundThisRound = true;
      this.cellList.forEach((c) => {
        c.hasCapsule = false;
      });
      this.profile.keys = Math.min(3, (this.profile.keys || 0) + 1);
      this.saveProfile();
      this.updateMetaTopBar();
      this.audio.playObjectiveCollect();
      this.floatingTexts.push({
        x: x || this.boardCenterX,
        y: (y || this.boardCenterY) - 24,
        text: '★ GASHA KEY +1!',
        subText: `${this.profile.keys}/3 KEYS TOWARD GASHAPON!`,
        color: '#FF9F1C',
        life: 0,
        maxLife: 1050
      });
      this.logCascade(`★ Hidden Gasha Key Collected! (${this.profile.keys}/3 Keys)`);
    }

    getSeriesMasteryMultiplier(colorId) {
      const col = VINYL_COLORS[colorId] || VINYL_COLORS[0];
      if (!col) return 1;
      const matchingUnlocked = this.profile.unlockedFigurines.filter((fid) => {
        const fig = Catalog.getFigurineById(fid);
        return fig && String(fig.primaryColor).toLowerCase() === String(col.top).toLowerCase();
      }).length;
      return 1 + matchingUnlocked * 0.15;
    }

    setGridRadius(radius) {
      const r = Catalog.getRadiusForSlots(radius);
      const sampleLevel = r === 1 ? 1 : r === 3 ? 65 : 6;
      this.loadLevel(sampleLevel);
    }

    resetBoard(seed = this.seedString, radius = this.gridRadius, options = {}) {
      const r = Catalog.getRadiusForSlots(radius);
      const customDef = {
        ...this.currentLevelDef,
        seed: String(seed || 'ATELIER-1'),
        gridRadius: r,
        gridSlots: Catalog.getSlotsForRadius(r),
        isFtue: false
      };
      this.currentLevelDef = customDef;
      this.initBoardFromLevelDef(customDef, options);
    }

    loadPreset(presetName) {
      this.setScreen('board');
      this.resetBoard(this.seedString, 2, { empty: true });

      if (presetName === 'cascade3x') {
        this.setCell(1, 0, [2, 2, 0, 0, 0, 0]);
        this.setCell(0, -1, [1, 1, 1, 0, 0, 0]);
        this.setCell(-1, 0, [3, 3, 3, 3, 1, 1, 1, 1, 1, 1]);
        this.setCell(-1, 1, [3, 3, 3, 3, 3, 3]);
        this.tray[0] = { discs: [1, 0, 0, 0], scale: 1, offsetY: 0 };
        this.tray[1] = { discs: [2, 2, 4], scale: 1, offsetY: 0 };
        this.tray[2] = { discs: [5, 5, 5], scale: 1, offsetY: 0 };
        this.recommendedCellKey = '0,0';
      } else if (presetName === 'burst10') {
        this.setCell(1, 0, [0, 0, 0, 0]);
        this.setCell(0, -1, [0, 0, 0]);
        this.tray[0] = { discs: [0, 0, 0], scale: 1, offsetY: 0 };
        this.tray[1] = { discs: [1, 1, 2], scale: 1, offsetY: 0 };
        this.tray[2] = { discs: [3, 3, 4], scale: 1, offsetY: 0 };
        this.recommendedCellKey = '0,0';
      } else if (presetName === 'deadlock') {
        this.cellList.forEach((c) => {
          if (c.q === 0 && c.r === 0) return;
          const colorId = ((c.q * 2 + c.r * 3 + 120) % 5) + 1;
          c.stack = [colorId, colorId];
        });
        this.tray[0] = { discs: [0, 0], scale: 1, offsetY: 0 };
        this.tray[1] = { discs: [1, 2], scale: 1, offsetY: 0 };
        this.tray[2] = { discs: [3, 4], scale: 1, offsetY: 0 };
        this.recommendedCellKey = '0,0';
      }

      this.updateHUD();
      this.updateDebugUI();
    }

    // -------------------------------------------------------------------------
    // FTUE Onboarding Helper (Level 1 Guided 3-Move Choreography)
    // -------------------------------------------------------------------------
    getActiveFtueStep() {
      if (
        !this.currentLevelDef ||
        !this.currentLevelDef.isFtue ||
        this.ftueSkipped ||
        !Array.isArray(this.currentLevelDef.ftueSteps)
      ) {
        return null;
      }
      if (this.movesTaken >= this.currentLevelDef.ftueSteps.length) return null;
      return this.currentLevelDef.ftueSteps[this.movesTaken];
    }

    updateFtueBanner() {
      const banner = document.getElementById('ftue-overlay');
      const step = this.getActiveFtueStep();
      if (!banner) return;

      if (!step) {
        banner.classList.add('hidden');
        return;
      }

      banner.classList.remove('hidden');
      this.recommendedCellKey = step.targetKey;
      const tagEl = document.getElementById('ftue-step-tag');
      const txtEl = document.getElementById('ftue-step-text');
      const shortPrompts = [
        'Drag a stack onto the glowing hex',
        'Matching colors slide together',
        'Make 10 of one color to pop!'
      ];
      if (tagEl) tagEl.textContent = `${this.movesTaken + 1} / 3`;
      if (txtEl) txtEl.textContent = shortPrompts[this.movesTaken] || step.hint;
    }

    // -------------------------------------------------------------------------
    // Boosters: Hammer, Swap & 4th Extra Staging Slot (Screen 4)
    // -------------------------------------------------------------------------
    updateBoosterDockUI() {
      const bHammer = document.getElementById('badge-booster-hammer');
      const bSwap = document.getElementById('badge-booster-swap');
      const bExtra = document.getElementById('badge-booster-extraslot');
      const btnHammer = document.getElementById('btn-booster-hammer');
      const btnSwap = document.getElementById('btn-booster-swap');
      const btnExtra = document.getElementById('btn-booster-extraslot');

      if (bHammer) {
        const hasH = this.profile.boosters.hammer > 0;
        bHammer.textContent = hasH ? String(this.profile.boosters.hammer) : '▶ AD';
        bHammer.classList.toggle('ad-refill', !hasH);
      }
      if (bSwap) {
        const hasS = this.profile.boosters.swap > 0;
        bSwap.textContent = hasS ? String(this.profile.boosters.swap) : '▶ AD';
        bSwap.classList.toggle('ad-refill', !hasS);
      }
      if (bExtra) {
        const hasE = this.extraSlotUnlocked || this.profile.boosters.extraslot > 0;
        bExtra.textContent = this.extraSlotUnlocked
          ? '✓'
          : this.profile.boosters.extraslot > 0
          ? String(this.profile.boosters.extraslot)
          : '▶ AD';
        bExtra.classList.toggle('ad-refill', !hasE);
      }

      if (btnHammer) btnHammer.classList.toggle('active', this.activeBooster === 'hammer');
      if (btnSwap) btnSwap.classList.toggle('active', this.activeBooster === 'swap');
      if (btnExtra) btnExtra.classList.toggle('active', this.extraSlotUnlocked);
    }

    activateBooster(type) {
      if (this.isProcessingCascade) return false;
      this.audio.playUiClick();

      if (this.activeBooster === type) {
        this.cancelBoosterMode();
        return false;
      }

      if (type === 'extraslot') {
        if (this.profile.boosters.extraslot <= 0 && !this.extraSlotUnlocked) {
          this.triggerRewardedAd('booster_extraslot');
          return false;
        }
        if (!this.extraSlotUnlocked) {
          this.profile.boosters.extraslot = Math.max(0, this.profile.boosters.extraslot - 1);
          this.extraSlotUnlocked = true;
        }
        if (!this.tray[3]) {
          const discs = Catalog.generateSmartTrayStack(this, this.rng, this.currentLevelDef);
          this.tray[3] = { discs, scale: 1, offsetY: 0 };
        }
        this.audio.playExtraSlotUnlock();
        this.updateBoosterDockUI();
        return true;
      }

      if (type === 'hammer' && this.profile.boosters.hammer <= 0) {
        this.triggerRewardedAd('booster_hammer');
        return false;
      }
      if (type === 'swap' && this.profile.boosters.swap <= 0) {
        this.triggerRewardedAd('booster_swap');
        return false;
      }

      this.activeBooster = type;
      this.swapSourceCellKey = null;

      const overlay = document.getElementById('booster-overlay');
      const iconEl = document.getElementById('booster-active-icon');
      const titleEl = document.getElementById('booster-active-title');
      const descEl = document.getElementById('booster-active-desc');
      const btnReroll = document.getElementById('btn-booster-reroll-now');

      if (overlay) overlay.classList.remove('hidden');
      if (type === 'hammer') {
        if (iconEl) iconEl.textContent = '◆';
        if (titleEl) titleEl.textContent = 'Ceramic Hammer';
        if (descEl) descEl.textContent = 'Tap any stack on the board to smash it';
        if (btnReroll) btnReroll.classList.add('hidden');
      } else if (type === 'swap') {
        if (iconEl) iconEl.textContent = '↻';
        if (titleEl) titleEl.textContent = 'Spatula Swap';
        if (descEl) descEl.textContent = 'Tap stack → empty hex, or Reroll';
        if (btnReroll) btnReroll.classList.remove('hidden');
      }

      this.updateBoosterDockUI();
      return true;
    }

    cancelBoosterMode() {
      this.activeBooster = null;
      this.swapSourceCellKey = null;
      const overlay = document.getElementById('booster-overlay');
      if (overlay) overlay.classList.add('hidden');
      this.updateBoosterDockUI();
    }

    executeHammerOnCell(cell) {
      if (!cell || cell.isAnvil || cell.stack.length === 0) return false;
      this.saveUndoSnapshot();

      if (this.profile.boosters.hammer > 0) {
        this.profile.boosters.hammer--;
      }

      const pos = this.axialToPixel(cell.q, cell.r);
      const topColId = getTopColor(cell.stack) || 0;
      const colObj = VINYL_COLORS[topColId] || VINYL_COLORS[0];

      // Credit all smashed discs toward level color objectives & Pigment Vat
      cell.stack.forEach((cId) => {
        const key = getColorKey(cId);
        this.clearedByColor[key] = (this.clearedByColor[key] || 0) + 1;
        this.profile.pigments[key] = (this.profile.pigments[key] || 0) + 1;
        this.totalDiscsCleared++;
      });

      const smashedCount = cell.stack.length;
      cell.stack = [];
      if (cell.hasCapsule) {
        this.collectBoardCapsule(pos.x, pos.y);
      }
      if (cell.iceHp > 0) {
        cell.iceHp = 0;
        this.frozenCleared++;
      }

      this.score += smashedCount * 25;
      this.clears++;
      this.audio.playHammerSmash();
      this.spawnBurstEffects(pos.x, pos.y - 16, colObj, smashedCount * 25, 1);
      this.spawnObjectiveFlyingDiscs(pos.x, pos.y - 16, colObj, Math.min(4, smashedCount));

      this.cancelBoosterMode();
      this.finishTurn(false);
      return true;
    }

    executeSwapRerollTray() {
      if (this.profile.boosters.swap > 0) {
        this.profile.boosters.swap--;
      }
      for (let i = 0; i < 3; i++) {
        const discs = Catalog.generateSmartTrayStack(this, this.rng, this.currentLevelDef);
        this.tray[i] = { discs, scale: 1, offsetY: 0 };
      }
      this.audio.playTraySwap();
      this.cancelBoosterMode();
      this.updateHUD();
      return true;
    }

    // -------------------------------------------------------------------------
    // Undo Snapshot Support
    // -------------------------------------------------------------------------
    saveUndoSnapshot() {
      const cellsCopy = {};
      this.cellList.forEach((c) => {
        cellsCopy[c.key] = {
          stack: [...c.stack],
          iceHp: c.iceHp
        };
      });
      const trayCopy = this.tray.map((slot) => (slot ? [...slot.discs] : null));
      this.undoSnapshot = {
        cells: cellsCopy,
        tray: trayCopy,
        clearedByColor: { ...this.clearedByColor },
        totalDiscsCleared: this.totalDiscsCleared,
        movesTaken: this.movesTaken,
        score: this.score,
        clears: this.clears,
        maxCombo: this.maxCombo
      };
      const btnUndo = document.getElementById('btn-undo');
      if (btnUndo) btnUndo.disabled = false;
    }

    undoLastMove() {
      if (!this.undoSnapshot) return;
      this.clearAllTimers();
      this.isDeadlocked = false;
      this.hideDeadlockModal();

      this.cellList.forEach((c) => {
        const snap = this.undoSnapshot.cells[c.key];
        if (snap) {
          c.stack = [...snap.stack];
          c.iceHp = snap.iceHp;
        }
        c.scaleX = 1;
        c.scaleY = 1;
      });
      this.tray = this.undoSnapshot.tray.map((discs) =>
        discs ? { discs: [...discs], scale: 1, offsetY: 0 } : null
      );
      this.clearedByColor = { ...this.undoSnapshot.clearedByColor };
      this.totalDiscsCleared = this.undoSnapshot.totalDiscsCleared;
      this.movesTaken = this.undoSnapshot.movesTaken;
      this.score = this.undoSnapshot.score;
      this.clears = this.undoSnapshot.clears;
      this.combo = 0;
      this.maxCombo = this.undoSnapshot.maxCombo;
      this.undoSnapshot = null;

      const btnUndo = document.getElementById('btn-undo');
      if (btnUndo) btnUndo.disabled = true;

      this.audio.playPickup();
      this.updateFtueBanner();
      this.updateHUD();
      this.updateDebugUI();
    }

    triggerSmartHint() {
      if (this.isProcessingCascade || this.isDeadlocked || this.isLevelWon) return null;
      this.audio.playUiClick();

      if (!this.tray[0] && !this.tray[1] && !this.tray[2]) {
        this.refillTray(true);
      }

      const emptyCells = this.cellList.filter(
        (c) => !c.isAnvil && c.iceHp === 0 && c.stack.length === 0
      );
      if (emptyCells.length === 0) return null;

      let bestMove = null;
      let bestScore = -Infinity;
      const maxSlot = this.extraSlotUnlocked ? 4 : 3;

      for (let tIdx = 0; tIdx < maxSlot; tIdx++) {
        const slot = this.tray[tIdx];
        if (!slot || !slot.discs || slot.discs.length === 0) continue;
        const topCol = getTopColor(slot.discs);
        const topCnt = getTopContiguousCount(slot.discs);
        const slotGroups = getColorGroups(slot.discs);
        const slotSubCol = slotGroups.length > 1 ? slotGroups[slotGroups.length - 2].color : null;

        for (let cIdx = 0; cIdx < emptyCells.length; cIdx++) {
          const cell = emptyCells[cIdx];
          const matches = this.getMatchingNeighbors(cell.q, cell.r, topCol);
          let sc = matches.length * 140 - cell.ring * 6;
          let combined = topCnt;
          matches.forEach((m) => {
            const mCnt = getTopContiguousCount(m.stack);
            combined += mCnt;
            sc += mCnt * 35;
            const mGroups = getColorGroups(m.stack);
            if (mGroups.length > 1) {
              sc += 45; // Exposes a buried sub-color!
            }
          });
          if (combined >= BURST_THRESHOLD) {
            sc += 350;
          }
          if (slotSubCol !== null) {
            const subMatches = this.getMatchingNeighbors(cell.q, cell.r, slotSubCol);
            if (subMatches.length > 0) sc += 160;
          }
          if (sc > bestScore) {
            bestScore = sc;
            bestMove = {
              trayIndex: tIdx,
              q: cell.q,
              r: cell.r,
              key: cell.key,
              combined,
              matchesCount: matches.length
            };
          }
        }
      }

      if (!bestMove) return null;
      this.hintsUsedThisRound = (this.hintsUsedThisRound || 0) + 1;
      this.selectedTrayIndex = bestMove.trayIndex;
      this.recommendedCellKey = bestMove.key;
      this.hoveredCellKey = bestMove.key;
      const targetPos = this.axialToPixel(bestMove.q, bestMove.r);
      this.floatingTexts.push({
        x: targetPos.x,
        y: targetPos.y - 24,
        text: bestMove.combined >= BURST_THRESHOLD ? '★ BURST MOVE!' : '★ BEST MERGE!',
        subText: `DROP SLOT #${bestMove.trayIndex + 1} HERE`,
        color: '#2EC4B6',
        life: 0,
        maxLife: 950
      });
      this.setOllieReaction(
        bestMove.combined >= BURST_THRESHOLD
          ? `★ Drop Slot #${bestMove.trayIndex + 1} on the glowing hex for a 10-Burst!`
          : `★ Drop Slot #${bestMove.trayIndex + 1} on the glowing hex!`,
        'excited'
      );
      return bestMove;
    }

    // -------------------------------------------------------------------------
    // Pointer Interaction: Drag-and-Drop (<50ms) + Booster Target + Tap Fallback
    // -------------------------------------------------------------------------
    measureInputLatency(e) {
      const now = performance.now();
      let delta = 0.7;
      if (e && typeof e.timeStamp === 'number' && e.timeStamp > 0) {
        const raw = now - e.timeStamp;
        if (raw >= 0 && raw < 250) {
          delta = Math.max(0.2, raw);
        }
      }
      this.telemetry.latencyMs = Number(delta.toFixed(1));
    }

    getCanvasCoords(e) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }

    findTraySlotAt(x, y) {
      const baseR = this.baseHexRadius || this.hexRadius;
      const hitRadius = Math.max(44, baseR * 1.35);
      const maxSlot = this.extraSlotUnlocked ? 4 : 3;
      for (let i = 0; i < maxSlot; i++) {
        if (!this.tray[i] || !this.tray[i].discs || this.tray[i].discs.length === 0) continue;
        const pos = this.traySlotPositions[i];
        const dx = x - pos.x;
        const dy = y - (pos.y - 10);
        if (Math.hypot(dx, dy) <= hitRadius) {
          return i;
        }
      }
      return -1;
    }

    isPointOnLockedExtraSlot(x, y) {
      if (this.extraSlotUnlocked) return false;
      const baseR = this.baseHexRadius || this.hexRadius;
      const pos = this.traySlotPositions[3];
      return Math.hypot(x - pos.x, y - pos.y) <= Math.max(42, baseR * 1.2);
    }

    findCellAt(x, y, maxRadius) {
      let bestCell = null;
      let bestDist = maxRadius;
      for (let i = 0; i < this.cellList.length; i++) {
        const cell = this.cellList[i];
        const pos = this.axialToPixel(cell.q, cell.r);
        const dist = Math.hypot(x - pos.x, y - pos.y);
        if (dist <= bestDist) {
          bestDist = dist;
          bestCell = cell;
        }
      }
      return bestCell;
    }

    findNearestEmptyCell(x, y, maxRadius) {
      let bestKey = null;
      let bestDist = maxRadius;
      for (let i = 0; i < this.cellList.length; i++) {
        const cell = this.cellList[i];
        if (cell.isAnvil || cell.iceHp > 0 || cell.stack.length > 0) continue;
        const pos = this.axialToPixel(cell.q, cell.r);
        const dist = Math.hypot(x - pos.x, y - pos.y);
        if (dist <= bestDist) {
          bestDist = dist;
          bestKey = cell.key;
        }
      }
      return bestKey;
    }

    onPointerDown(e) {
      this.measureInputLatency(e);
      this.audio.initContext();

      if (this.isLevelWon) {
        const winOpen = !document.getElementById('level-win-modal')?.classList.contains('hidden');
        const unboxOpen = !document.getElementById('unboxing-modal')?.classList.contains('hidden');
        const adOpen = !document.getElementById('rewarded-ad-modal')?.classList.contains('hidden');
        if (!winOpen && !unboxOpen && !adOpen) {
          this.advanceToNextRound();
        }
        return;
      }
      if (this.isDeadlocked) return;
      if (this.isProcessingCascade && !this.stepMode) return;

      const pt = this.getCanvasCoords(e);

      // 0. Handle Active Booster Click on Board
      if (this.activeBooster === 'hammer') {
        const tappedCell = this.findCellAt(pt.x, pt.y, this.hexRadius * 1.3);
        if (tappedCell && !tappedCell.isAnvil && tappedCell.stack.length > 0) {
          this.executeHammerOnCell(tappedCell);
        }
        return;
      }

      if (this.activeBooster === 'swap') {
        const tappedCell = this.findCellAt(pt.x, pt.y, this.hexRadius * 1.3);
        if (tappedCell && !tappedCell.isAnvil && tappedCell.iceHp === 0) {
          if (!this.swapSourceCellKey && tappedCell.stack.length > 0) {
            this.swapSourceCellKey = tappedCell.key;
            this.audio.playPickup();
          } else if (this.swapSourceCellKey && tappedCell.stack.length === 0) {
            const srcCell = this.cells.get(this.swapSourceCellKey);
            if (srcCell && srcCell.stack.length > 0) {
              this.saveUndoSnapshot();
              if (this.profile.boosters.swap > 0) this.profile.boosters.swap--;
              tappedCell.stack = [...srcCell.stack];
              srcCell.stack = [];
              this.audio.playTraySwap();
              this.cancelBoosterMode();
              this.enqueueCell(tappedCell.q, tappedCell.r, 'swap-move');
              this.isProcessingCascade = true;
              this.processNextCascadeStep();
            }
          }
        }
        return;
      }

      // Check if player tapped the locked 4th Extra Staging Slot pedestal
      if (this.isPointOnLockedExtraSlot(pt.x, pt.y)) {
        this.activateBooster('extraslot');
        return;
      }

      // 1. Check if pointer pressed a tray slot
      const trayIdx = this.findTraySlotAt(pt.x, pt.y);
      if (trayIdx !== -1) {
        this.dragState.active = true;
        this.dragState.trayIndex = trayIdx;
        this.dragState.pointerId = e.pointerId;
        this.dragState.startX = pt.x;
        this.dragState.startY = pt.y;
        this.dragState.pointerX = pt.x;
        this.dragState.pointerY = pt.y;
        this.dragState.dragX = pt.x;
        this.dragState.dragY = pt.y - TOUCH_OFFSET_Y;
        this.dragState.snappedKey = null;
        this.dragState.movedSignificantly = false;

        this.selectedTrayIndex = trayIdx;
        this.audio.playPickup();
        return;
      }

      // 2. Tap-to-Select Fallback: If a tray slot is already selected, tapping an empty board cell places it
      if (this.selectedTrayIndex !== -1 && this.tray[this.selectedTrayIndex]) {
        const targetKey = this.findNearestEmptyCell(pt.x, pt.y, this.hexRadius * 1.3);
        if (targetKey) {
          const cell = this.cells.get(targetKey);
          const idx = this.selectedTrayIndex;
          this.selectedTrayIndex = -1;
          this.placeStack(idx, cell.q, cell.r);
        }
      }
    }

    onPointerMove(e) {
      if (this.activeScreen !== 'board') return;
      const pt = this.getCanvasCoords(e);

      if (!this.dragState.active) {
        if (this.selectedTrayIndex !== -1) {
          this.hoveredCellKey = this.findNearestEmptyCell(pt.x, pt.y, this.hexRadius * 1.2);
        } else {
          this.hoveredCellKey = null;
        }
        return;
      }

      this.measureInputLatency(e);
      this.dragState.pointerX = pt.x;
      this.dragState.pointerY = pt.y;
      this.dragState.dragX = pt.x;
      this.dragState.dragY = pt.y - TOUCH_OFFSET_Y;

      if (Math.hypot(pt.x - this.dragState.startX, pt.y - this.dragState.startY) > 8) {
        this.dragState.movedSignificantly = true;
      }

      const snapRadius = this.hexRadius * 1.42;
      const nearestKey = this.findNearestEmptyCell(this.dragState.dragX, this.dragState.dragY, snapRadius);
      if (nearestKey !== this.dragState.snappedKey) {
        this.dragState.snappedKey = nearestKey;
        if (nearestKey !== null) {
          this.audio.playSnap();
        }
      }
    }

    onPointerUp(e) {
      if (!this.dragState.active) return;
      this.measureInputLatency(e);

      const trayIdx = this.dragState.trayIndex;
      const snappedKey = this.dragState.snappedKey;
      const moved = this.dragState.movedSignificantly;

      this.dragState.active = false;
      this.dragState.trayIndex = -1;
      this.dragState.snappedKey = null;

      if (snappedKey && this.cells.has(snappedKey)) {
        const targetCell = this.cells.get(snappedKey);
        this.selectedTrayIndex = -1;
        this.placeStack(trayIdx, targetCell.q, targetCell.r);
      } else if (!moved) {
        this.selectedTrayIndex = trayIdx;
      }
    }

    // -------------------------------------------------------------------------
    // Core Placement, Neighbor Merge, Frozen Clay Crack, 10-Burst & Cascades
    // -------------------------------------------------------------------------
    placeStack(trayIndex, q, r, options = {}) {
      const slot = this.tray[trayIndex];
      const cell = this.cells.get(cellKey(q, r));
      if (!slot || !slot.discs || slot.discs.length === 0) return false;
      if (!cell || cell.isAnvil || cell.iceHp > 0 || cell.stack.length > 0) return false;

      this.saveUndoSnapshot();
      this.recommendedCellKey = null;

      const placedDiscs = [...slot.discs];
      this.tray[trayIndex] = null;
      cell.stack = placedDiscs;
      this.movesTaken++;

      this.combo = 0;
      this.turnBurstsCount = 0;
      const overdriveMult = this.overdriveMovesLeft > 0 ? 2 : 1;
      this.activeMultiplier = Math.max(1, (1 + this.burstStreak) * overdriveMult);
      this.chimeStep = 0;
      this.evaluationQueue = [{ q: cell.q, r: cell.r, reason: 'placement' }];
      this.logCascade(
        `Move #${this.movesTaken}: Placed [${placedDiscs.map((c) => VINYL_COLORS[c].name).join(', ')}] at (${q},${r})`
      );

      this.audio.playPlace();
      this.updateFtueBanner();

      if (options.instant) {
        this.runInstantCascades();
        return true;
      }

      this.isProcessingCascade = true;
      this.addTween({
        target: cell,
        duration: PLACEMENT_SPRING_MS,
        onUpdate: (t, target) => {
          const wave = Math.sin(t * Math.PI * 2.2) * Math.exp(-t * 3.2);
          target.scaleX = 1 + wave * 0.22;
          target.scaleY = 1 - wave * 0.22;
        },
        onComplete: (target) => {
          target.scaleX = 1;
          target.scaleY = 1;
          this.processNextCascadeStep();
        }
      });

      return true;
    }

    runInstantCascades() {
      let safety = 0;
      while (safety++ < 250) {
        if (this.evaluationQueue.length === 0) {
          const eqCell = this.findOutOfEquilibriumCell();
          if (eqCell) {
            this.evaluationQueue.push({ q: eqCell.q, r: eqCell.r, reason: 'equilibrium' });
          } else {
            break;
          }
        }
        const item = this.evaluationQueue.shift();
        const focal = this.cells.get(cellKey(item.q, item.r));
        if (!focal || focal.isAnvil || focal.iceHp > 0 || focal.stack.length === 0) continue;

        // 1. Check immediate >= 10 burst on focal
        if (getTopContiguousCount(focal.stack) >= BURST_THRESHOLD) {
          this.executeInstantBurst(focal);
          if (focal.stack.length > 0) {
            this.enqueueCellFront(focal.q, focal.r, 'post-burst-subdisc');
          }
          continue;
        }

        // 2. Inspect 6 clockwise neighbors for matching top color
        const topCol = getTopColor(focal.stack);
        const matchingNeighbors = this.getMatchingNeighbors(focal.q, focal.r, topCol);
        if (matchingNeighbors.length === 0) continue;

        const plan = this.computeMergePlan(focal, matchingNeighbors);
        this.combo++;
        this.cascadesTriggered++;

        const surroundBonus =
          plan.transfers.length >= 4
            ? 4
            : plan.transfers.length === 3
            ? 2
            : plan.transfers.length === 2
            ? 1
            : 0;
        this.activeMultiplier = Math.max(1, this.combo + surroundBonus + this.burstStreak);
        if (this.activeMultiplier > this.maxCombo) this.maxCombo = this.activeMultiplier;

        let totalTransferred = 0;
        plan.transfers.forEach((tr) => {
          totalTransferred += tr.count;
          for (let i = 0; i < tr.count; i++) {
            const d = tr.donor.stack.pop();
            tr.receiver.stack.push(d);
          }
        });

        const mergePoints = totalTransferred * 15 * this.activeMultiplier;
        this.score += mergePoints;
        this.scoreBreakdown.merges += mergePoints;
        if (this.score > this.bestScore) this.bestScore = this.score;
        this.chargeKilnFever(18 + plan.transfers.length * 4);

        plan.transfers.forEach((tr) => {
          if (tr.donor.stack.length > 0) {
            this.enqueueCell(tr.donor.q, tr.donor.r, 'exposed-subdisc');
          }
        });

        if (getTopContiguousCount(plan.receiver.stack) >= BURST_THRESHOLD) {
          this.enqueueCellFront(plan.receiver.q, plan.receiver.r, 'immediate-burst');
        } else if (plan.receiver.stack.length > 0) {
          this.enqueueCell(plan.receiver.q, plan.receiver.r, 'merged-receiver');
        }
      }

      this.finishTurn(true);
    }

    executeInstantBurst(cell) {
      const count = getTopContiguousCount(cell.stack);
      if (count < BURST_THRESHOLD) return;
      const colorId = getTopColor(cell.stack);
      const colorKey = getColorKey(colorId);

      cell.stack.splice(cell.stack.length - count, count);
      this.combo = Math.max(1, this.combo);
      const extraDiscs = Math.max(0, count - BURST_THRESHOLD);
      const overstackMultBonus = Math.floor(extraDiscs / 2);
      this.activeMultiplier = Math.max(1, this.combo + this.burstStreak + overstackMultBonus);
      if (this.activeMultiplier > this.maxCombo) this.maxCombo = this.activeMultiplier;

      this.clears++;
      this.bursts10++;
      this.turnBurstsCount++;
      this.totalDiscsCleared += count;
      this.clearedByColor[colorKey] = (this.clearedByColor[colorKey] || 0) + count;

      if (cell.hasCapsule) {
        const pos = this.axialToPixel(cell.q, cell.r);
        this.collectBoardCapsule(pos.x, pos.y);
      }

      const overdriveBonusMult = this.overdriveMovesLeft > 0 ? 2 : 1;
      const buddyPerkMult = (this.getEquippedBuddyPerk && this.getEquippedBuddyPerk().scoreMult) || 1;
      const basePopPts = Math.round(150 * this.activeMultiplier * overdriveBonusMult * buddyPerkMult);
      const overstackPts =
        extraDiscs > 0
          ? Math.round((extraDiscs * 45 + extraDiscs * extraDiscs * 15) * this.activeMultiplier * overdriveBonusMult)
          : 0;
      this.score += basePopPts + overstackPts;
      this.scoreBreakdown.bursts += basePopPts;
      this.scoreBreakdown.overstack += overstackPts;
      if (this.score > this.bestScore) this.bestScore = this.score;
      this.chargeKilnFever(42);
      if (this.overdriveMovesLeft > 0) {
        this.profile.prisms += 5;
      }

      // Crack adjacent Frozen Clay tiles
      this.crackAdjacentFrozenCells(cell, false);
    }

    crackAdjacentFrozenCells(burstCell, playAudioAndParticles = true) {
      for (let dIdx = 0; dIdx < AXIAL_DIRS.length; dIdx++) {
        const d = AXIAL_DIRS[dIdx];
        const adj = this.cells.get(cellKey(burstCell.q + d.dq, burstCell.r + d.dr));
        if (adj && !adj.isAnvil && adj.iceHp > 0) {
          adj.iceHp = Math.max(0, adj.iceHp - 1);
          this.iceDamageDealt++;
          const thawed = adj.iceHp === 0;
          if (thawed) {
            this.frozenCleared++;
            this.logCascade(`❄ Frozen Clay Thawed at (${adj.q},${adj.r})!`);
            if (adj.hasCapsule) {
              const adjPos = this.axialToPixel(adj.q, adj.r);
              this.collectBoardCapsule(adjPos.x, adjPos.y);
            }
            if (adj.stack.length > 0) {
              this.enqueueCell(adj.q, adj.r, 'thawed-frozen-clay');
            }
          } else {
            this.logCascade(`❄ Frozen Clay Cracked at (${adj.q},${adj.r}) (${adj.iceHp} HP left)`);
          }

          if (playAudioAndParticles) {
            this.audio.playClayCrack(thawed);
            const adjPos = this.axialToPixel(adj.q, adj.r);
            this.spawnClayCrackParticles(adjPos.x, adjPos.y - 14, thawed);
          }
        }
      }
    }

    getMatchingNeighbors(q, r, targetColor) {
      if (targetColor === null || targetColor === undefined) return [];
      const matches = [];
      for (let i = 0; i < AXIAL_DIRS.length; i++) {
        const dir = AXIAL_DIRS[i];
        const nCell = this.cells.get(cellKey(q + dir.dq, r + dir.dr));
        if (
          nCell &&
          !nCell.isAnvil &&
          nCell.iceHp === 0 &&
          nCell.stack.length > 0 &&
          getTopColor(nCell.stack) === targetColor
        ) {
          matches.push(nCell);
        }
      }
      return matches;
    }

    computeMergePlan(focalCell, matchingNeighbors) {
      const color = getTopColor(focalCell.stack);
      if (matchingNeighbors.length === 1) {
        const n = matchingNeighbors[0];
        const focalGroups = getColorGroups(focalCell.stack);
        const neighborGroups = getColorGroups(n.stack);

        if (focalGroups.length > 1 && neighborGroups.length === 1) {
          return {
            receiver: n,
            transfers: [
              {
                donor: focalCell,
                receiver: n,
                color,
                count: getTopContiguousCount(focalCell.stack)
              }
            ]
          };
        }

        if (focalGroups.length > 1 && neighborGroups.length > 1) {
          const focalSubColor = focalGroups[focalGroups.length - 2].color;
          const nSubColor = neighborGroups[neighborGroups.length - 2].color;
          const focalSubMatches = this.getMatchingNeighbors(focalCell.q, focalCell.r, focalSubColor)
            .some((c) => c.key !== n.key);
          const nSubMatches = this.getMatchingNeighbors(n.q, n.r, nSubColor)
            .some((c) => c.key !== focalCell.key);

          if (focalSubMatches && !nSubMatches) {
            return {
              receiver: n,
              transfers: [
                {
                  donor: focalCell,
                  receiver: n,
                  color,
                  count: getTopContiguousCount(focalCell.stack)
                }
              ]
            };
          }
        }
      }

      return {
        receiver: focalCell,
        transfers: matchingNeighbors.map((donor) => ({
          donor,
          receiver: focalCell,
          color,
          count: getTopContiguousCount(donor.stack)
        }))
      };
    }

    enqueueCell(q, r, reason) {
      const exists = this.evaluationQueue.some((item) => item.q === q && item.r === r);
      if (!exists) {
        this.evaluationQueue.push({ q, r, reason });
      }
    }

    enqueueCellFront(q, r, reason) {
      this.evaluationQueue = this.evaluationQueue.filter((item) => !(item.q === q && item.r === r));
      this.evaluationQueue.unshift({ q, r, reason });
    }

    findOutOfEquilibriumCell() {
      for (let i = 0; i < this.cellList.length; i++) {
        const c = this.cellList[i];
        if (!c.isAnvil && c.iceHp === 0 && getTopContiguousCount(c.stack) >= BURST_THRESHOLD) {
          return c;
        }
      }
      for (let i = 0; i < this.cellList.length; i++) {
        const c = this.cellList[i];
        if (c.isAnvil || c.iceHp > 0 || c.stack.length === 0) continue;
        const top = getTopColor(c.stack);
        const matches = this.getMatchingNeighbors(c.q, c.r, top);
        if (matches.length > 0) {
          return c;
        }
      }
      return null;
    }

    processNextCascadeStep() {
      while (this.evaluationQueue.length > 0) {
        const nextItem = this.evaluationQueue[0];
        const cell = this.cells.get(cellKey(nextItem.q, nextItem.r));
        if (!cell || cell.isAnvil || cell.iceHp > 0 || cell.stack.length === 0) {
          this.evaluationQueue.shift();
          continue;
        }

        const topCount = getTopContiguousCount(cell.stack);
        if (topCount >= BURST_THRESHOLD) {
          this.evaluationQueue.shift();
          this.debugVisualHint = {
            focalKey: cell.key,
            donors: [],
            receiverKey: cell.key,
            type: `10-Disc Burst (${topCount}x ${VINYL_COLORS[getTopColor(cell.stack)].name})`
          };
          this.gateStepExecution(() => {
            this.animateBurst10(cell, () => {
              if (cell.stack.length > 0) {
                this.enqueueCellFront(cell.q, cell.r, 'post-burst-subdisc');
              }
              this.processNextCascadeStep();
            });
          });
          return;
        }

        const topCol = getTopColor(cell.stack);
        const matchingNeighbors = this.getMatchingNeighbors(cell.q, cell.r, topCol);
        if (matchingNeighbors.length > 0) {
          this.evaluationQueue.shift();
          const plan = this.computeMergePlan(cell, matchingNeighbors);
          this.debugVisualHint = {
            focalKey: cell.key,
            donors: plan.transfers.map((t) => t.donor.key),
            receiverKey: plan.receiver.key,
            type: `Merge ${VINYL_COLORS[topCol].name} → (${plan.receiver.q},${plan.receiver.r})`
          };
          this.gateStepExecution(() => {
            this.animateMergePlan(plan, () => {
              this.processNextCascadeStep();
            });
          });
          return;
        }

        this.evaluationQueue.shift();
      }

      const eqCell = this.findOutOfEquilibriumCell();
      if (eqCell) {
        this.enqueueCell(eqCell.q, eqCell.r, 'equilibrium-sweep');
        this.processNextCascadeStep();
        return;
      }

      this.debugVisualHint = null;
      this.finishTurn(false);
    }

    gateStepExecution(actionFn) {
      this.updateDebugUI();
      if (this.stepMode) {
        this.pausedNextAction = actionFn;
        this.updateDebugUI();
      } else {
        this.pausedNextAction = null;
        actionFn();
      }
    }

    stepNext() {
      if (!this.pausedNextAction) return;
      const fn = this.pausedNextAction;
      this.pausedNextAction = null;
      this.updateDebugUI();
      fn();
    }

    resumeCascades() {
      this.setStepMode(false);
      if (this.pausedNextAction) {
        const fn = this.pausedNextAction;
        this.pausedNextAction = null;
        fn();
      }
    }

    setStepMode(enabled) {
      this.stepMode = !!enabled;
      if (!this.stepMode) {
        this.debugVisualHint = null;
      }
      const stepToggle = document.getElementById('dbg-step-toggle');
      if (stepToggle) stepToggle.checked = this.stepMode;

      const stepBanner = document.getElementById('step-mode-banner');
      if (stepBanner) stepBanner.classList.toggle('hidden', !this.stepMode);

      this.updateDebugUI();
    }

    animateMergePlan(plan, onDone) {
      this.combo++;
      this.cascadesTriggered++;

      const surroundBonus =
        plan.transfers.length >= 4
          ? 4
          : plan.transfers.length === 3
          ? 2
          : plan.transfers.length === 2
          ? 1
          : 0;
      this.activeMultiplier = Math.max(1, this.combo + surroundBonus + this.burstStreak);
      if (this.activeMultiplier > this.maxCombo) this.maxCombo = this.activeMultiplier;

      const totalTransferred = plan.transfers.reduce((acc, t) => acc + t.count, 0);
      const mergePoints = totalTransferred * 15 * this.activeMultiplier;
      this.score += mergePoints;
      this.scoreBreakdown.merges += mergePoints;
      if (this.score > this.bestScore) this.bestScore = this.score;
      this.chargeKilnFever(18 + plan.transfers.length * 4);

      const receiver = plan.receiver;
      const receiverPos = this.axialToPixel(receiver.q, receiver.r);

      if (plan.transfers.length >= 2 || this.activeMultiplier >= 2) {
        const colObj = this.getDiscColorMeta(plan.transfers[0].color);
        const subLbl =
          plan.transfers.length >= 2
            ? `${plan.transfers.length}-WAY SURROUND ×${this.activeMultiplier}!`
            : `CASCADE ×${this.activeMultiplier}!`;
        this.floatingTexts.push({
          x: receiverPos.x,
          y: receiverPos.y - (receiver.stack.length + 2) * this.discThickness - 10,
          text: `+${mergePoints}`,
          subText: subLbl,
          color: colObj.top,
          life: 0,
          maxLife: 720
        });
      }

      if (this.activeMultiplier >= 2) {
        this.setOllieReaction(`Multiplier ×${this.activeMultiplier}! Sweet cascade!`, 'excited');
      }
      this.updateHUD();

      let currentDelay = 0;
      let totalExpectedReceiverHeight = receiver.stack.length;

      plan.transfers.forEach((tr) => {
        const donor = tr.donor;
        const donorPos = this.axialToPixel(donor.q, donor.r);
        const dist = Math.hypot(receiverPos.x - donorPos.x, receiverPos.y - donorPos.y);
        const count = tr.count;
        const color = tr.color;

        this.logCascade(
          `Combo x${this.combo}: Transfer ${count}x ${VINYL_COLORS[color].name} (${donor.q},${donor.r}) → (${receiver.q},${receiver.r})`
        );

        for (let i = 0; i < count; i++) {
          const launchDelay = currentDelay + i * TRANSFER_STAGGER_MS;
          const targetSlotIndex = totalExpectedReceiverHeight;
          totalExpectedReceiverHeight++;

          this.scheduleTimeout(() => {
            const poppedColor = donor.stack.length > 0 ? donor.stack.pop() : color;
            const startZ = donor.stack.length * this.discThickness;
            const endZ = targetSlotIndex * this.discThickness;
            const arcPeak = Math.max(40, dist * 0.34 + Math.max(startZ, endZ) + 28);

            donor.scaleX = 0.94;
            donor.scaleY = 1.06;
            this.scheduleTimeout(() => {
              donor.scaleX = 1;
              donor.scaleY = 1;
            }, 65);

            const flyingDisc = {
              color: poppedColor,
              x0: donorPos.x,
              y0: donorPos.y,
              z0: startZ,
              x1: receiverPos.x,
              y1: receiverPos.y,
              z1: endZ,
              arcPeak,
              x: donorPos.x,
              y: donorPos.y,
              z: startZ,
              flip: 0,
              t: 0
            };
            this.flyingDiscs.push(flyingDisc);

            this.addTween({
              target: flyingDisc,
              duration: TRANSFER_ARC_MS,
              onUpdate: (t, fd) => {
                fd.t = t;
                const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
                fd.x = fd.x0 + (fd.x1 - fd.x0) * ease;
                fd.y = fd.y0 + (fd.y1 - fd.y0) * ease;
                const linearZ = fd.z0 + (fd.z1 - fd.z0) * t;
                fd.z = linearZ + fd.arcPeak * 4 * t * (1 - t);
                fd.flip = Math.sin(t * Math.PI);
              },
              onComplete: (fd) => {
                const idx = this.flyingDiscs.indexOf(fd);
                if (idx !== -1) this.flyingDiscs.splice(idx, 1);

                receiver.stack.push(fd.color);
                this.audio.playTransferChime(this.chimeStep++);

                receiver.scaleX = 1.1;
                receiver.scaleY = 0.9;
                this.scheduleTimeout(() => {
                  receiver.scaleX = 1;
                  receiver.scaleY = 1;
                }, 70);
              }
            });
          }, launchDelay);
        }

        currentDelay += count * TRANSFER_STAGGER_MS + 40;
      });

      const totalWaitMs = currentDelay + TRANSFER_ARC_MS + 25;
      this.scheduleTimeout(() => {
        plan.transfers.forEach((tr) => {
          if (tr.donor.stack.length > 0) {
            this.enqueueCell(tr.donor.q, tr.donor.r, 'exposed-subdisc');
          }
        });

        if (getTopContiguousCount(receiver.stack) >= BURST_THRESHOLD) {
          this.enqueueCellFront(receiver.q, receiver.r, 'immediate-burst');
        } else if (receiver.stack.length > 0) {
          this.enqueueCell(receiver.q, receiver.r, 'merged-receiver');
        }

        this.updateHUD();
        this.updateDebugUI();
        onDone();
      }, totalWaitMs);
    }

    animateBurst10(cell, onDone) {
      const burstCount = getTopContiguousCount(cell.stack);
      if (burstCount < BURST_THRESHOLD) {
        onDone();
        return;
      }
      const colorId = getTopColor(cell.stack);
      const colorKey = getColorKey(colorId);
      const col = this.getDiscColorMeta(colorId);
      const pos = this.axialToPixel(cell.q, cell.r);

      this.combo = Math.max(1, this.combo);
      const extraDiscs = Math.max(0, burstCount - BURST_THRESHOLD);
      const overstackMultBonus = Math.floor(extraDiscs / 2);
      this.activeMultiplier = Math.max(1, this.combo + this.burstStreak + overstackMultBonus);
      if (this.activeMultiplier > this.maxCombo) this.maxCombo = this.activeMultiplier;

      const overdriveBonusMult = this.overdriveMovesLeft > 0 ? 2 : 1;
      const buddyPerkMult = (this.getEquippedBuddyPerk && this.getEquippedBuddyPerk().scoreMult) || 1;
      const basePopPts = Math.round(150 * this.activeMultiplier * overdriveBonusMult * buddyPerkMult);
      const overstackPts =
        extraDiscs > 0
          ? Math.round((extraDiscs * 45 + extraDiscs * extraDiscs * 15) * this.activeMultiplier * overdriveBonusMult)
          : 0;
      const pointsEarned = basePopPts + overstackPts;

      this.addTween({
        target: cell,
        duration: 55,
        onUpdate: (t, target) => {
          target.scaleX = 1 + 0.16 * t;
          target.scaleY = 1 - 0.14 * t;
        },
        onComplete: (target) => {
          for (let i = 0; i < burstCount; i++) {
            this.scheduleTimeout(() => {
              const currentTopZ = target.stack.length * this.discThickness;
              if (target.stack.length > 0 && getTopColor(target.stack) === colorId) {
                target.stack.pop();
              }

              this.spawnSingleDiscPeelEffect(pos.x, pos.y - currentTopZ, col);
              this.audio.playDiscPopTick(i, burstCount);

              target.scaleX = 1.08;
              target.scaleY = 0.92;
              this.scheduleTimeout(() => {
                target.scaleX = 1;
                target.scaleY = 1;
              }, 16);

              if (i === burstCount - 1) {
                this.score += pointsEarned;
                this.scoreBreakdown.bursts += basePopPts;
                this.scoreBreakdown.overstack += overstackPts;
                if (this.score > this.bestScore) this.bestScore = this.score;
                this.clears++;
                this.bursts10++;
                this.turnBurstsCount++;
                this.totalDiscsCleared += burstCount;
                this.clearedByColor[colorKey] = (this.clearedByColor[colorKey] || 0) + burstCount;
                this.chargeKilnFever(42);
                this.triggerBoardShake(5.5, 190);
                if (overdriveBonusMult > 1) {
                  this.profile.prisms += 5;
                }

                if (cell.hasCapsule) {
                  this.collectBoardCapsule(pos.x, pos.y);
                }

                // Crack any adjacent Frozen Clay tiles!
                this.crackAdjacentFrozenCells(cell, true);

                this.updateHUD();
                this.updateDebugUI();

                this.logCascade(
                  `★ ${burstCount}-BURST at (${cell.q},${cell.r}): ${burstCount}x ${col.name} (+${pointsEarned} · ×${this.activeMultiplier})`
                );
                this.setOllieReaction(`★ ${burstCount}-Stack Pop! +${pointsEarned} pts!`, 'cheer');

                const burstVisualY = pos.y - (target.stack.length + 2) * this.discThickness;
                this.audio.playBurst10(this.activeMultiplier);
                this.spawnBurstEffects(
                  pos.x,
                  burstVisualY,
                  col,
                  pointsEarned,
                  this.activeMultiplier,
                  burstCount
                );
                this.spawnObjectiveFlyingDiscs(pos.x, burstVisualY, col, 4);

                this.addTween({
                  target,
                  duration: 80,
                  onUpdate: (t2, tgt) => {
                    const s = Math.sin(t2 * Math.PI);
                    tgt.scaleX = 1 - 0.1 * s;
                    tgt.scaleY = 1 + 0.12 * s;
                  },
                  onComplete: (tgt) => {
                    tgt.scaleX = 1;
                    tgt.scaleY = 1;
                    onDone();
                  }
                });
              }
            }, i * BURST_PEEL_STEP_MS);
          }
        }
      });
    }

    spawnObjectiveFlyingDiscs(startX, startY, colorObj, count = 4) {
      const targetX = this.width * 0.5;
      const targetY = 8;
      for (let i = 0; i < count; i++) {
        this.scheduleTimeout(() => {
          const item = {
            x0: startX + (Math.random() - 0.5) * 18,
            y0: startY,
            x1: targetX + (Math.random() - 0.5) * 32,
            y1: targetY,
            x: startX,
            y: startY,
            color: colorObj.top,
            rim: colorObj.rim,
            scale: 1
          };
          this.objectiveFlyingDiscs.push(item);
          this.addTween({
            target: item,
            duration: 380,
            onUpdate: (t, fd) => {
              const ease = 1 - Math.pow(1 - t, 3);
              fd.x = fd.x0 + (fd.x1 - fd.x0) * ease - Math.sin(t * Math.PI) * 28;
              fd.y = fd.y0 + (fd.y1 - fd.y0) * ease;
              fd.scale = 1 - 0.35 * t;
            },
            onComplete: (fd) => {
              const idx = this.objectiveFlyingDiscs.indexOf(fd);
              if (idx !== -1) this.objectiveFlyingDiscs.splice(idx, 1);
              if (i === count - 1) {
                this.audio.playObjectiveCollect();
              }
            }
          });
        }, i * 45);
      }
    }

    spawnClayCrackParticles(x, y, thawed) {
      const count = thawed ? 14 : 7;
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = 70 + Math.random() * 120;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 65,
          gravity: 420,
          size: 5 + Math.random() * 4,
          color: i % 2 === 0 ? '#A5F3FC' : '#E2E8F0',
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 8,
          life: 0,
          maxLife: 340
        });
      }
    }

    spawnSingleDiscPeelEffect(x, y, colorObj) {
      this.poppingDiscs.push({
        x,
        y,
        rx: this.hexRadius * 0.85,
        ry: this.hexRadius * 0.85 * Y_TILT,
        color: colorObj.top,
        rim: colorObj.rim,
        life: 0,
        maxLife: 130
      });

      if (this.settings.reducedMotion) return;
      for (let i = 0; i < 3; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 55 + Math.random() * 90;
        this.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - (60 + Math.random() * 50),
          gravity: 440,
          size: 4 + Math.random() * 3,
          color: i === 0 ? '#FFFDF7' : colorObj.top,
          rotation: Math.random() * Math.PI * 2,
          vRot: (Math.random() - 0.5) * 9,
          life: 0,
          maxLife: 300 + Math.random() * 100
        });
      }
    }

    spawnBurstEffects(x, y, colorObj, points, combo, burstCount = 10) {
      this.shockwaves.push({
        x,
        y,
        radius: this.hexRadius * 0.45,
        maxRadius: this.hexRadius * 2.3,
        color: colorObj.top,
        alpha: 0.92,
        life: 0,
        maxLife: 340
      });

      if (!this.settings.reducedMotion) {
        for (let i = 0; i < 16; i++) {
          const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.25;
          const speed = 110 + Math.random() * 170;
          this.particles.push({
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (90 + Math.random() * 80),
            gravity: 480,
            size: 4.5 + Math.random() * 4.5,
            color: i % 4 === 0 ? '#FFFDF7' : i % 3 === 0 ? colorObj.rim : colorObj.top,
            rotation: Math.random() * Math.PI * 2,
            vRot: (Math.random() - 0.5) * 10,
            life: 0,
            maxLife: 420 + Math.random() * 160
          });
        }
      }

      const subLabel =
        burstCount >= 12
          ? `★ ${burstCount}-STACK MEGA ×${combo}!`
          : combo > 1
          ? `◆ COMBO ×${combo}!`
          : '10-STACK BURST!';

      this.floatingTexts.push({
        x,
        y: y - 14,
        text: `+${points.toLocaleString()}`,
        subText: subLabel,
        color: colorObj.top,
        life: 0,
        maxLife: 880
      });
    }

    finishTurn(instant = false) {
      this.isProcessingCascade = false;
      this.debugVisualHint = null;

      // Decrement Kiln Overdrive move counter at end of turn
      if (this.overdriveMovesLeft > 0) {
        this.overdriveMovesLeft = Math.max(0, this.overdriveMovesLeft - 1);
        if (this.overdriveMovesLeft === 0) {
          this.kilnFever = 0;
        }
      }

      // Update turn-to-turn hot streak multiplier ONLY when the turn triggered a multi-cascade
      // or multi-burst chain (so basic single-merge clears stay at ×1 unless chained!)
      if (this.turnBurstsCount >= 2 || (this.turnBurstsCount >= 1 && this.combo >= 2)) {
        this.burstStreak = Math.min(4, this.burstStreak + 1);
      } else if (this.turnBurstsCount === 0) {
        this.burstStreak = 0;
      }
      const overdriveMult = this.overdriveMovesLeft > 0 ? 2 : 1;
      this.activeMultiplier = Math.max(1, (1 + this.burstStreak) * overdriveMult);

      // 1. Check if Level Color Target Objective is Complete!
      if (Catalog.isObjectiveComplete(this, this.currentLevelDef)) {
        this.isLevelWon = true;
        this.updateHUD();
        this.updateDebugUI();
        this.triggerLevelWinModal();
        return;
      }

      // 2. Refill the 3 primary dispenser tray slots if all 3 are empty
      const primaryTrayEmpty = !this.tray[0] && !this.tray[1] && !this.tray[2];
      if (primaryTrayEmpty) {
        this.refillTray(instant);
      }

      this.checkDeadlock();
      this.updateFtueBanner();
      this.updateHUD();
      this.updateDebugUI();
    }

    refillTray(immediate = false) {
      const waveIdx = this.waveIndex++;
      const wave = Catalog.generateTrayWave(this, this.rng, this.currentLevelDef, waveIdx);

      // Clutch Near-Miss Pacing & Dynamic Tray Mercy:
      // When empty placeable sockets drop to <= 3 (and we are past pre-scripted static waves),
      // guarantee at least 1 Clutch Catalyst stack matching the board's largest accessible stack!
      const staticWavesCount =
        this.currentLevelDef && Array.isArray(this.currentLevelDef.staticTrayWaves)
          ? this.currentLevelDef.staticTrayWaves.length
          : 0;
      const emptyCount = this.cellList.filter(
        (c) => !c.isAnvil && c.iceHp === 0 && c.stack.length === 0
      ).length;

      if (emptyCount > 0 && emptyCount <= 3 && waveIdx >= staticWavesCount) {
        const accessibleStacks = this.cellList
          .filter((c) => {
            if (c.isAnvil || c.iceHp > 0 || c.stack.length === 0) return false;
            return AXIAL_DIRS.some((d) => {
              const adj = this.cells.get(cellKey(c.q + d.dq, c.r + d.dr));
              return adj && !adj.isAnvil && adj.iceHp === 0 && adj.stack.length === 0;
            });
          })
          .sort((a, b) => getTopContiguousCount(b.stack) - getTopContiguousCount(a.stack));

        if (accessibleStacks.length > 0) {
          const bestTarget = accessibleStacks[0];
          const neededColor = getTopColor(bestTarget.stack);
          const alreadyHasTopColor = wave.some((st) => st && getTopColor(st) === neededColor);
          if (!alreadyHasTopColor && wave[0]) {
            const topRunNeeded = Math.max(2, Math.min(4, BURST_THRESHOLD - getTopContiguousCount(bestTarget.stack)));
            const baseDisc = wave[0][0] !== undefined ? wave[0][0] : neededColor;
            wave[0] = [baseDisc, ...Array(topRunNeeded).fill(neededColor)];
          }
        }
      }

      for (let i = 0; i < 3; i++) {
        const discs = wave[i];
        this.tray[i] = {
          discs: [...discs],
          scale: immediate ? 1 : 0.1,
          offsetY: immediate ? 0 : 26
        };
        if (!immediate) {
          const delay = i * 50;
          this.scheduleTimeout(() => {
            if (!this.tray[i]) return;
            this.addTween({
              target: this.tray[i],
              duration: 210,
              onUpdate: (t, target) => {
                const s = this.springEase(t);
                target.scale = s;
                target.offsetY = (1 - s) * 26;
              },
              onComplete: (target) => {
                target.scale = 1;
                target.offsetY = 0;
              }
            });
          }, delay);
        }
      }
    }

    // -------------------------------------------------------------------------
    // Deadlock Detection, Low-Space Warning & Rescue Flows (Workstream 4)
    // -------------------------------------------------------------------------
    checkDeadlock() {
      const emptyCount = this.cellList.filter(
        (c) => !c.isAnvil && c.iceHp === 0 && c.stack.length === 0
      ).length;
      const hasTrayStacks = this.tray.some((s) => s !== null && s.discs && s.discs.length > 0);

      const lowSpaceBanner = document.getElementById('low-space-banner');
      if (emptyCount === 1) {
        if (lowSpaceBanner) lowSpaceBanner.classList.remove('hidden');
        if (!this.lowSpaceWarned) {
          this.lowSpaceWarned = true;
          this.audio.playDeadlockWarning();
          this.setOllieReaction('! Only 1 hex left! Use a booster!', 'warn');
        }
      } else {
        if (lowSpaceBanner) lowSpaceBanner.classList.add('hidden');
        if (emptyCount > 1) this.lowSpaceWarned = false;
      }

      if (emptyCount === 0 && hasTrayStacks && !this.isLevelWon) {
        this.isDeadlocked = true;
        this.logCascade('! DEADLOCK DETECTED: 0 empty placeable sockets remain.');
        this.audio.playDeadlock();
        this.triggerDeadlockModal();
        return true;
      }

      this.isDeadlocked = false;
      return false;
    }

    triggerDeadlockModal() {
      this.isDeadlocked = true;
      const modal = document.getElementById('deadlock-modal');
      const headline = document.getElementById('deadlock-progress-headline');
      const goal = (this.currentLevelDef && this.currentLevelDef.objective && this.currentLevelDef.objective.totalDiscsGoal) || 30;
      const pct = Math.min(95, Math.max(15, Math.round((this.totalDiscsCleared / goal) * 100)));
      if (headline) {
        const left = Math.max(0, goal - this.totalDiscsCleared);
        headline.textContent = left > 0 ? `Only ${left} discs to go — keep going?` : 'So close — keep going?';
      }
      if (modal) {
        modal.classList.remove('peeking');
        modal.classList.remove('hidden');
      }
    }

    hideDeadlockModal() {
      const modal = document.getElementById('deadlock-modal');
      if (modal) {
        modal.classList.remove('peeking');
        modal.classList.add('hidden');
      }
    }

    executeDeadlockRescue(clearCount = 2) {
      this.hideDeadlockModal();
      this.isDeadlocked = false;
      this.extraSlotUnlocked = true;
      if (!this.tray[3]) {
        const discs = Catalog.generateSmartTrayStack(this, this.rng, this.currentLevelDef);
        this.tray[3] = { discs, scale: 1, offsetY: 0 };
      }

      // Clear `clearCount` occupied unlocked cells near the center
      const occupied = this.cellList.filter((c) => !c.isAnvil && c.stack.length > 0);
      for (let i = 0; i < Math.min(clearCount, occupied.length); i++) {
        const c = occupied[i];
        c.stack.forEach((cId) => {
          const k = getColorKey(cId);
          this.clearedByColor[k] = (this.clearedByColor[k] || 0) + 1;
          this.totalDiscsCleared++;
        });
        c.stack = [];
        c.iceHp = 0;
        const pos = this.axialToPixel(c.q, c.r);
        this.spawnBurstEffects(pos.x, pos.y - 10, VINYL_COLORS[0], 50, 1);
      }

      this.audio.playExtraSlotUnlock();
      this.updateBoosterDockUI();
      this.checkDeadlock();
      this.updateHUD();
    }

    // -------------------------------------------------------------------------
    // Level Win, Mold Casting & Blind-Box Unboxing Flows (Workstream 6)
    // -------------------------------------------------------------------------
    triggerLevelWinModal() {
      this.isLevelWon = true;

      // Award modest Clean Workbench bonus (15 pts per open socket, not multiplied by maxCombo so stars remain skill-based!)
      const emptySockets = this.cellList.filter(
        (c) => !c.isAnvil && c.iceHp === 0 && c.stack.length === 0
      ).length;
      if (this.scoreBreakdown.efficiency === 0) {
        const effPts = emptySockets * 15;
        this.score += effPts;
        this.scoreBreakdown.efficiency = effPts;
      }
      if (this.score <= 0) {
        this.score = 600;
      }
      if (this.score > this.bestScore) this.bestScore = this.score;

      const benchmark = this.getSocialBenchmarkSafe(this.currentLevelNum, this.currentLevelDef);
      const turnsUsed = Math.max(1, this.movesTaken || 1);
      const par3Moves = benchmark.par3Moves || 8;
      const par2Moves = benchmark.par2Moves || 12;
      const earnedStarsThisRun =
        typeof benchmark.computeStars === 'function'
          ? benchmark.computeStars(turnsUsed)
          : turnsUsed <= par3Moves
          ? 3
          : turnsUsed <= par2Moves
          ? 2
          : 1;
      const prevStars = this.profile.levelStars[this.currentLevelNum] || 0;
      const finalStars = Math.max(prevStars, earnedStarsThisRun, 1);
      this.profile.levelStars[this.currentLevelNum] = finalStars;

      const prevBestScore = this.profile.levelBestScores[this.currentLevelNum] || 0;
      const isNewRecord = this.score > prevBestScore;
      if (isNewRecord) {
        this.profile.levelBestScores[this.currentLevelNum] = this.score;
      }
      const prevBestCombo = this.profile.levelBestCombos[this.currentLevelNum] || 1;
      if (this.maxCombo > prevBestCombo) {
        this.profile.levelBestCombos[this.currentLevelNum] = this.maxCombo;
      }

      this.audio.playLevelComplete(earnedStarsThisRun);
      this.setOllieReaction(
        earnedStarsThisRun === 3
          ? `★★★ 3-Star Par Clear (${turnsUsed}/${par3Moves} turns)!`
          : earnedStarsThisRun === 2
          ? `★★ 2-Star Solve (${turnsUsed} turns)!`
          : `★ Cleared in ${turnsUsed} turns! Beat ≤${par3Moves} turns for 3★!`,
        'cheer'
      );

      if (!this.isDailyMode) {
        const unlockedNext = this.currentLevelNum + 1;
        this.profile.highestUnlockedLevel = Math.max(
          this.profile.highestUnlockedLevel,
          unlockedNext
        );
      }

      const rewCoins = (this.currentLevelDef.rewards && this.currentLevelDef.rewards.vinylClay) || 65;
      const rewPrisms = 25;
      this.profile.coins += rewCoins;
      this.profile.prisms += rewPrisms;

      // Japanese Gashapon Pacing (No more every-level figurine spam!):
      // Earn +1 Gasha Key only on 3-Star Par Clears or every 3rd level milestone.
      // A Gashapon Machine Spin triggers ONLY when reaching 3/3 Gasha Keys, clearing a 10-Level Island Boss,
      // hitting an 18-Star milestone, or completing the Daily Challenge (~once every 6–8 levels).
      if (earnedStarsThisRun >= 3 || this.currentLevelNum % 3 === 0) {
        this.profile.keys = Math.min(3, (this.profile.keys || 0) + 1);
      }

      const isIslandBoss = !this.isDailyMode && this.currentLevelNum % 10 === 0;
      if (this.isDailyMode || isIslandBoss) {
        this.profile.moldProgress = 100;
      } else {
        this.profile.moldProgress = Math.round(((this.profile.keys || 0) / 3) * 100);
      }

      const totalEarnedStars = Object.values(this.profile.levelStars).reduce((a, b) => a + b, 0);
      const starMilestoneReached =
        Math.floor(totalEarnedStars / 18) > (this.profile.starChestsClaimed || 0);
      if (starMilestoneReached) {
        this.profile.starChestsClaimed = (this.profile.starChestsClaimed || 0) + 1;
      }
      const tokensFullReady = (this.profile.keys || 0) >= 3;
      const isFirstEverGacha = (this.profile.gachaPullCount || 0) === 0;
      if (isFirstEverGacha) {
        this.profile.keys = 3;
        this.profile.moldProgress = 100;
      }
      const anyChestReady =
        isFirstEverGacha || tokensFullReady || isIslandBoss || starMilestoneReached || this.isDailyMode;
      this.capsuleFoundThisRound = false;

      this.pendingChestBoosted = isIslandBoss || starMilestoneReached || this.isDailyMode;
      this.pendingUnboxFigurine = null; // Never pre-determine or reveal before Gashapon handle is turned!
      this.saveProfile();

      // Update Stars Row & Star Requirement Note in Win Modal (reflecting THIS run's earned stars!)
      const starsRow = document.getElementById('win-stars-row');
      if (starsRow) {
        const starSpans = starsRow.querySelectorAll('.star-icon');
        starSpans.forEach((sp, idx) => {
          const earned = idx < earnedStarsThisRun;
          sp.classList.toggle('earned', earned);
          sp.textContent = earned ? '★' : '☆';
        });
      }

      const winTitleEl = document.getElementById('win-modal-title');
      if (winTitleEl) {
        winTitleEl.textContent =
          earnedStarsThisRun === 3
            ? '3-Star Clear!'
            : earnedStarsThisRun === 2
            ? '2-Star Clear!'
            : 'Round Clear!';
      }

      const starReqNoteEl = document.getElementById('win-star-req-note');
      if (starReqNoteEl) {
        if (earnedStarsThisRun >= 3) {
          starReqNoteEl.classList.add('hidden');
        } else {
          starReqNoteEl.classList.remove('hidden');
          starReqNoteEl.textContent = `Finish in ≤ ${par3Moves} turns for 3★`;
        }
      }

      const turnsValEl = document.getElementById('win-turns-val');
      const turnsParSubEl = document.getElementById('win-turns-par-sub');
      const finalScoreEl = document.getElementById('win-final-score');
      const scoreSubEl = document.getElementById('win-score-sub');
      const nextLabel = document.getElementById('btn-win-next-label');
      const unboxLabel = document.getElementById('btn-win-unbox-label');

      if (turnsValEl) turnsValEl.textContent = `${turnsUsed}`;
      if (turnsParSubEl) {
        turnsParSubEl.textContent = `3★ Par: ≤ ${par3Moves}`;
      }
      if (finalScoreEl) finalScoreEl.textContent = this.score.toLocaleString();
      if (scoreSubEl) {
        scoreSubEl.textContent = isNewRecord ? '★ New Best' : `Max ×${this.maxCombo} Combo`;
      }
      if (nextLabel) nextLabel.textContent = 'CONTINUE';
      if (unboxLabel) {
        unboxLabel.textContent = '★ OPEN CAPSULE';
      }

      const btnUnbox = document.getElementById('btn-win-unbox-now');
      const btnNext = document.getElementById('btn-win-next-level');
      const btnReplay = document.getElementById('btn-win-replay');
      const btnWinAd2x = document.getElementById('btn-win-watch-ad-2x');
      const btnWinAd2xText = document.getElementById('btn-win-watch-ad-2x-text');
      if (btnUnbox) btnUnbox.classList.toggle('hidden', !anyChestReady);
      if (btnNext) btnNext.classList.toggle('hidden', anyChestReady);
      if (btnReplay) btnReplay.classList.toggle('hidden', anyChestReady || earnedStarsThisRun >= 3);
      if (btnWinAd2x) {
        btnWinAd2x.disabled = false;
        btnWinAd2x.classList.remove('hidden');
      }
      if (btnWinAd2xText) {
        btnWinAd2xText.textContent = '▶ Watch Ad · 2× Score & +1 Key';
      }

      this.updateHUD();
      this.updateMetaTopBar();
      const modal = document.getElementById('level-win-modal');
      if (modal) modal.classList.remove('hidden');
    }

    shareCurrentLevelScore(btnEl) {
      const benchmark = this.getSocialBenchmarkSafe(this.currentLevelNum, this.currentLevelDef);
      const topPct = benchmark.computeTopPercent(this.score);
      const titleTag = this.isDailyMode
        ? `PopStacks Daily Challenge`
        : `PopStacks Level ${this.currentLevelNum}`;
      const text = `★ ${titleTag}: ${this.score.toLocaleString()} pts (Max ×${this.maxCombo} Combo · ${this.movesTaken || 1} Moves · Top ${topPct}%)! Can you beat my stack setup?`;

      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(text).catch(() => {});
      }
      if (btnEl) {
        btnEl.textContent = '✓ Score Card Copied! Challenge Sent!';
      }
      return text;
    }

    getVesselMaterialMeta(fig) {
      const f = fig || Catalog.FIGURINES[0];
      const seriesIdx = Math.max(
        1,
        Math.min(
          10,
          Number(f.seriesIndex) ||
            Number(String(f.seriesId || 'series-1').replace(/\D+/g, '')) ||
            1
        )
      );
      const rarity = String(f.rarity || 'Common').toLowerCase();
      const sil = String(f.silhouetteType || '').toLowerCase();

      // If the item is a Clockwork/Robo automaton on another series, or belongs to a specific material series,
      // select the matching sculpted vessel & surface finish
      const SERIES_VESSEL_META = {
        1: { label: 'CELADON & MOSS CLAY', sound: 'clay', family: 'stoneware' },
        2: { label: 'KINTSUGI LACQUERWARE', sound: 'ceramic', family: 'lacquer' },
        3: { label: 'ANODIZED STAR-GEODE', sound: 'crystal', family: 'metal-crystal' },
        4: { label: 'RAKU CRACKLE GLAZE', sound: 'ceramic', family: 'ceramic' },
        5: { label: 'CARVED TERRACOTTA', sound: 'clay', family: 'terracotta' },
        6: { label: 'VELVET & BRONZE FILIGREE', sound: 'crystal', family: 'velvet-bronze' },
        7: { label: 'FORGED BRASS & COPPER', sound: 'metal', family: 'metal' },
        8: { label: 'MOTHER-OF-PEARL SHELL', sound: 'ceramic', family: 'pearl' },
        9: { label: 'WASHI PORCELAIN FOLD', sound: 'ceramic', family: 'porcelain' },
        10: { label: '24K GOLD & CRYSTAL VAULT', sound: 'metal', family: 'gold-crystal' }
      };

      const base = SERIES_VESSEL_META[seriesIdx] || SERIES_VESSEL_META[1];
      let materialName = base.label;
      let soundFamily = base.sound;

      if (rarity === 'mythic' && seriesIdx !== 10) {
        materialName = `IRIDESCENT ${base.label}`;
        soundFamily = 'crystal';
      } else if (rarity === 'legendary' && seriesIdx !== 7 && seriesIdx !== 10) {
        materialName = `GILDED ${base.label}`;
        soundFamily = 'metal';
      } else if (sil === 'robo' && seriesIdx !== 7) {
        materialName = `BRUSHED ALLOY · ${base.label}`;
        soundFamily = 'metal';
      }

      const vesselNum = String(seriesIdx).padStart(2, '0');
      return {
        seriesIdx,
        vesselId: `vessel-${vesselNum}`,
        cutoutSrc: `assets/art/gacha_vessels/vessel-${vesselNum}.webp`,
        glbSrc: `assets/models/vessel-${vesselNum}.glb`,
        materialName,
        soundFamily,
        materialFamily: base.family,
        primaryColor: f.primaryColor || '#E06D53',
        accentColor: f.accentColor || '#F4B942'
      };
    }

    _clearVesselSpinTimers() {
      if (this._capsuleShuffleTimer) {
        clearTimeout(this._capsuleShuffleTimer);
        this._capsuleShuffleTimer = null;
      }
      if (Array.isArray(this._vesselSpinTimers)) {
        this._vesselSpinTimers.forEach((id) => clearTimeout(id));
      }
      this._vesselSpinTimers = [];
    }

    triggerUnboxingModal(figurineObj = null, options = {}) {
      if (figurineObj && typeof figurineObj === 'object' && !figurineObj.id) {
        options = figurineObj;
        figurineObj = null;
      }
      if (options.boosted !== undefined || options.boostedRarity !== undefined) {
        this.pendingChestBoosted = !!(options.boosted || options.boostedRarity);
      }
      if (options.fromWin || this.isLevelWon) {
        this.unboxFromWin = true;
      }

      // Pre-roll the figurine using the rarity + variety table:
      // - 1st Gacha (pullCount === 0): Guaranteed random "Rare" item!
      // - Subsequent Gachas (pullCount >= 1): ~85% Common so Rare/Epic/Legendary/Mythic feel truly special!
      const prevPullCount = this.profile.gachaPullCount || 0;
      const pickup = this.getFeaturedPickupSeries();
      this.pendingUnboxFigurine =
        figurineObj ||
        this.rollRandomBlindBoxFigurineSafe({
          boosted: !!this.pendingChestBoosted,
          pullCount: prevPullCount,
          unlockedIds: this.profile.unlockedFigurines,
          recentIds: this.profile.recentPullIds,
          pickupSeriesId: pickup.seriesId
        });

      this.capsuleTapStep = 0;
      this.isVesselSpinning = true;
      this._clearVesselSpinTimers();

      const modal = document.getElementById('unboxing-modal');
      const modalCard = document.getElementById('unbox-modal-card');
      const crateBtn = document.getElementById('btn-blind-box-tap');
      const heroBall = document.getElementById('gasha-hero-ball');
      const vesselStageEl = document.getElementById('gasha-vessel-3d-stage');
      const vesselCutoutEl = document.getElementById('gasha-vessel-cutout');
      const vesselHaloEl = document.getElementById('gasha-vessel-halo');
      const vesselMatTag = document.getElementById('unbox-vessel-mat-tag');
      const shuffleRing = document.getElementById('gasha-shuffle-ring');
      const sparksEl = document.getElementById('gasha-tap-sparks');
      const dotsEl = document.getElementById('gasha-tap-dots');
      const revealView = document.getElementById('unbox-reveal-view');
      const collectBtn = document.getElementById('btn-unbox-collect');
      const equipNowBtn = document.getElementById('btn-unbox-equip-now');
      const titleEl = document.getElementById('unbox-modal-title');
      const dupBadge = document.getElementById('unbox-dup-badge');

      const gachaInfo = this.getGachaGradeInfo(this.pendingUnboxFigurine.rarity);
      const vesselMeta = this.getVesselMaterialMeta(this.pendingUnboxFigurine);

      if (modalCard) {
        modalCard.classList.remove(
          'tier-common',
          'tier-rare',
          'tier-epic',
          'tier-legendary',
          'tier-mythic',
          'is-revealed'
        );
      }
      if (sparksEl) sparksEl.innerHTML = '';

      if (dotsEl) {
        dotsEl.querySelectorAll('.tap-dot').forEach((d) => d.classList.remove('filled'));
      }

      if (titleEl) {
        titleEl.textContent = 'Selecting vessel...';
      }
      if (dupBadge) dupBadge.classList.add('hidden');
      if (crateBtn) {
        crateBtn.classList.remove('hidden', 'tap-stage-1', 'tap-stage-2', 'is-selected');
        crateBtn.classList.add('is-shuffling');
      }
      if (heroBall) {
        heroBall.className = 'gasha-hero-vessel';
      }
      if (revealView) revealView.classList.add('hidden');
      if (equipNowBtn) equipNowBtn.classList.add('hidden');
      const bonusSpinBtn = document.getElementById('btn-unbox-watch-ad-spin');
      if (bonusSpinBtn) bonusSpinBtn.classList.add('hidden');
      if (!options.isBonusSpin) {
        this.bonusSpinUsedThisUnbox = false;
      }
      if (collectBtn) {
        collectBtn.classList.add('hidden');
        collectBtn.innerHTML = `<span class="cta-main-text">${this.unboxFromWin ? 'CONTINUE' : 'COLLECT'}</span>`;
      }
      if (modal) modal.classList.remove('hidden');

      // Pre-mount the Hunyuan3D-2 .glb Gacha Vessel AND preload the 3D Figurine .glb in the background
      // during the 3.0s spin so the 3D figurine renders instantaneously with zero 2D image flash!
      if (window.PopStacks3DViewer) {
        if (typeof window.PopStacks3DViewer.preloadFigurine === 'function') {
          window.PopStacks3DViewer.preloadFigurine(this.pendingUnboxFigurine);
        }
        if (vesselStageEl && typeof window.PopStacks3DViewer.mountVessel === 'function') {
          window.PopStacks3DViewer.mountVessel(vesselStageEl, this.pendingUnboxFigurine, {
            disableAutoRotate: false
          });
        }
      }

      // 16-step decelerating 3.0-second (3000ms) vessel roulette spin
      const ROULETTE_VESSEL_STYLES = {
        1: { label: 'CELADON & MOSS CLAY', sound: 'clay', primary: '#2EC4B6', accent: '#F4B942' },
        2: { label: 'KINTSUGI LACQUERWARE', sound: 'ceramic', primary: '#FF5964', accent: '#F4B942' },
        3: { label: 'ANODIZED STAR-GEODE', sound: 'crystal', primary: '#386FA4', accent: '#6AE0D5' },
        4: { label: 'RAKU CRACKLE GLAZE', sound: 'ceramic', primary: '#2EC4B6', accent: '#FFFDF7' },
        5: { label: 'CARVED TERRACOTTA', sound: 'clay', primary: '#F9844A', accent: '#2EC4B6' },
        6: { label: 'VELVET & BRONZE FILIGREE', sound: 'crystal', primary: '#845EC2', accent: '#F4B942' },
        7: { label: 'FORGED BRASS & COPPER', sound: 'metal', primary: '#F4B942', accent: '#FF5964' },
        8: { label: 'MOTHER-OF-PEARL SHELL', sound: 'ceramic', primary: '#2EC4B6', accent: '#FF5964' },
        9: { label: 'WASHI PORCELAIN FOLD', sound: 'ceramic', primary: '#386FA4', accent: '#FF5964' },
        10: { label: '24K GOLD & CRYSTAL VAULT', sound: 'metal', primary: '#F4B942', accent: '#2EC4B6' }
      };

      const spinSequence = [];
      const orderPool = [1, 7, 4, 3, 10, 2, 5, 8, 6, 9];
      for (let i = 0; i < 15; i++) {
        let candidate = orderPool[(i + vesselMeta.seriesIdx) % orderPool.length];
        if (i === 14 && candidate === vesselMeta.seriesIdx) {
          candidate = (vesselMeta.seriesIdx % 10) + 1;
        }
        spinSequence.push(candidate);
      }
      spinSequence.push(vesselMeta.seriesIdx); // Step 16 (final vessel)

      const stepTimestampsMs = [
        0, 85, 175, 270, 375, 490, 615, 755, 910, 1085, 1280, 1500, 1750, 2035, 2360, 2730
      ];
      const miniImgs = shuffleRing ? shuffleRing.querySelectorAll('.shuffle-mini-vessel') : [];

      const applySpinStep = (stepIdx) => {
        const sIdx = spinSequence[stepIdx];
        const prevIdx = spinSequence[(stepIdx - 1 + spinSequence.length) % spinSequence.length];
        const nextIdx = spinSequence[(stepIdx + 1) % spinSequence.length];
        const isFinalStep = stepIdx === spinSequence.length - 1;
        const style = isFinalStep
          ? {
              label: vesselMeta.materialName,
              sound: vesselMeta.soundFamily,
              primary: vesselMeta.primaryColor,
              accent: vesselMeta.accentColor
            }
          : ROULETTE_VESSEL_STYLES[sIdx] || ROULETTE_VESSEL_STYLES[1];

        if (vesselCutoutEl) {
          vesselCutoutEl.src = `assets/art/gacha_vessels/vessel-${String(sIdx).padStart(2, '0')}.webp`;
        }
        if (miniImgs[0]) {
          miniImgs[0].src = `assets/art/gacha_vessels/vessel-${String(prevIdx).padStart(2, '0')}.webp`;
        }
        if (miniImgs[1]) {
          miniImgs[1].src = `assets/art/gacha_vessels/vessel-${String(nextIdx).padStart(2, '0')}.webp`;
        }
        if (vesselHaloEl) {
          vesselHaloEl.style.setProperty('--vessel-primary', style.primary);
          vesselHaloEl.style.setProperty('--vessel-accent', style.accent);
        }
        if (vesselMatTag) {
          vesselMatTag.textContent = style.label;
          vesselMatTag.style.borderColor = style.primary;
        }
        if (heroBall) {
          heroBall.classList.remove('tap-stage-1', 'tap-stage-2', 'ball-hit-bounce', 'vessel-spin-tick', 'vessel-lock-pop');
          void heroBall.offsetWidth;
          heroBall.classList.add('vessel-spin-tick');
        }
        if (this.audio && typeof this.audio.playRouletteTick === 'function') {
          this.audio.playRouletteTick(stepIdx, spinSequence.length, style.sound);
        }
      };

      stepTimestampsMs.forEach((delayMs, idx) => {
        const tid = setTimeout(() => {
          if (!this.isVesselSpinning) return;
          applySpinStep(idx);
        }, delayMs);
        this._vesselSpinTimers.push(tid);
      });

      // After 3,000ms (3.0 seconds) of decelerating roulette spin, lock onto the chosen 3D Hunyuan3D Vessel!
      this._capsuleShuffleTimer = setTimeout(() => {
        this._finalizeVesselSpinLockIn();
      }, 3000);
    }

    _finalizeVesselSpinLockIn() {
      this._clearVesselSpinTimers();
      this.isVesselSpinning = false;

      const crateBtn = document.getElementById('btn-blind-box-tap');
      const heroBall = document.getElementById('gasha-hero-ball');
      const vesselCutoutEl = document.getElementById('gasha-vessel-cutout');
      const vesselHaloEl = document.getElementById('gasha-vessel-halo');
      const vesselMatTag = document.getElementById('unbox-vessel-mat-tag');
      const titleEl = document.getElementById('unbox-modal-title');

      const fig = this.pendingUnboxFigurine || Catalog.FIGURINES[0];
      const gachaInfo = this.getGachaGradeInfo(fig.rarity);
      const vesselMeta = this.getVesselMaterialMeta(fig);
      const rKey = String(fig.rarity || 'Common').toLowerCase();

      if (vesselCutoutEl) {
        vesselCutoutEl.src = vesselMeta.cutoutSrc;
      }
      if (vesselHaloEl) {
        vesselHaloEl.style.setProperty('--vessel-primary', vesselMeta.primaryColor);
        vesselHaloEl.style.setProperty('--vessel-accent', vesselMeta.accentColor);
      }
      if (vesselMatTag) {
        vesselMatTag.textContent = vesselMeta.materialName;
        vesselMatTag.style.borderColor = vesselMeta.primaryColor;
      }
      if (crateBtn && !crateBtn.classList.contains('hidden')) {
        crateBtn.classList.remove('is-shuffling');
        crateBtn.classList.add('is-selected');
      }
      if (heroBall) {
        heroBall.className = `gasha-hero-vessel mat-${vesselMeta.materialFamily} ${gachaInfo.shellClass} vessel-lock-pop`;
      }
      if (this.audio && typeof this.audio.playRouletteLockIn === 'function') {
        this.audio.playRouletteLockIn(vesselMeta.soundFamily, fig.rarity);
      }
      if (rKey !== 'common') {
        this.spawnCapsuleTapSparks(1, vesselMeta.accentColor || '#FFD166');
      }
      if (titleEl && this.capsuleTapStep === 0) {
        if (rKey === 'mythic') {
          titleEl.textContent = '★ Mythic Vessel! Tap to crack!';
        } else if (rKey === 'legendary') {
          titleEl.textContent = '★ Legendary Vessel! Tap to crack!';
        } else if (rKey === 'epic') {
          titleEl.textContent = '★ Epic Vessel! Tap to crack!';
        } else if (rKey === 'rare') {
          titleEl.textContent = '★ Rare Vessel! Tap to crack!';
        } else {
          titleEl.textContent = 'Tap to crack open!';
        }
      }
    }

    spawnCapsuleTapSparks(step = 1, colorHex = '#FFD166') {
      const sparksEl = document.getElementById('gasha-tap-sparks');
      if (!sparksEl) return;
      sparksEl.innerHTML = '';
      const count = step === 1 ? 8 : 12;
      for (let i = 0; i < count; i++) {
        const sp = document.createElement('span');
        sp.className = 'gasha-spark-dot';
        const angle = (i / count) * Math.PI * 2;
        const dist = (step === 1 ? 74 : 94) + (i % 2) * 14;
        const dx = `${Math.round(Math.cos(angle) * dist)}px`;
        const dy = `${Math.round(Math.sin(angle) * dist)}px`;
        sp.style.setProperty('--tx', dx);
        sp.style.setProperty('--ty', dy);
        sp.style.background = i % 2 === 0 ? colorHex : '#FFFDF7';
        sparksEl.appendChild(sp);
      }
    }

    handleCapsuleTap(options = {}) {
      // Wait for the 3-second vessel roulette spin to finish before counting crack taps
      // (unless forceSkipSpin is explicitly passed by an automated test helper)
      if (this.isVesselSpinning) {
        if (options && options.forceSkipSpin) {
          this._finalizeVesselSpinLockIn();
        } else {
          return;
        }
      }

      const crateBtn = document.getElementById('btn-blind-box-tap');
      const heroBall = document.getElementById('gasha-hero-ball');
      const dotsEl = document.getElementById('gasha-tap-dots');
      const titleEl = document.getElementById('unbox-modal-title');

      this._clearVesselSpinTimers();
      if (crateBtn) {
        crateBtn.classList.remove('is-shuffling');
        crateBtn.classList.add('is-selected');
      }

      this.capsuleTapStep = (this.capsuleTapStep || 0) + 1;
      const fig = this.pendingUnboxFigurine || Catalog.FIGURINES[0];
      const gachaInfo = this.getGachaGradeInfo(fig.rarity);
      const vesselMeta = this.getVesselMaterialMeta(fig);

      if (dotsEl) {
        const dots = dotsEl.querySelectorAll('.tap-dot');
        dots.forEach((d, idx) => d.classList.toggle('filled', idx < this.capsuleTapStep));
      }

      if (this.capsuleTapStep === 1) {
        if (this.audio && typeof this.audio.playCapsuleTap === 'function') {
          this.audio.playCapsuleTap(1, vesselMeta.soundFamily);
        }
        if (window.PopStacks3DViewer && typeof window.PopStacks3DViewer.pulseVesselTap === 'function') {
          window.PopStacks3DViewer.pulseVesselTap(1, fig);
        }
        if (heroBall) {
          heroBall.classList.remove('tap-stage-1', 'tap-stage-2', 'ball-hit-bounce');
          void heroBall.offsetWidth;
          heroBall.classList.add('tap-stage-1', 'ball-hit-bounce');
        }
        if (titleEl) titleEl.textContent = 'Keep tapping!';
        this.spawnCapsuleTapSparks(1, vesselMeta.primaryColor);
        return;
      }

      if (this.capsuleTapStep === 2) {
        if (this.audio && typeof this.audio.playCapsuleTap === 'function') {
          this.audio.playCapsuleTap(2, vesselMeta.soundFamily);
        }
        if (window.PopStacks3DViewer && typeof window.PopStacks3DViewer.pulseVesselTap === 'function') {
          window.PopStacks3DViewer.pulseVesselTap(2, fig);
        }
        if (heroBall) {
          heroBall.className = `gasha-hero-vessel mat-${vesselMeta.materialFamily} ${gachaInfo.shellClass}`;
          void heroBall.offsetWidth;
          heroBall.classList.add('tap-stage-2', 'ball-hit-bounce');
        }
        if (titleEl) titleEl.textContent = 'One more tap!';
        this.spawnCapsuleTapSparks(2, vesselMeta.accentColor || '#FFD166');
        return;
      }

      // 3rd Tap -> Crack open the 3D Gacha vessel and reveal the prize!
      this.revealBlindBoxFigurine();
    }

    revealBlindBoxFigurine() {
      this._clearVesselSpinTimers();
      this.isVesselSpinning = false;
      const prevPullCount = this.profile.gachaPullCount || 0;
      const pickup = this.getFeaturedPickupSeries();

      const fig =
        this.pendingUnboxFigurine ||
        this.rollRandomBlindBoxFigurineSafe({
          boosted: !!this.pendingChestBoosted,
          pullCount: prevPullCount,
          unlockedIds: this.profile.unlockedFigurines,
          recentIds: this.profile.recentPullIds,
          pickupSeriesId: pickup.seriesId
        });
      this.pendingUnboxFigurine = fig;

      // Update Pull Counter, Anti-Repeat History & Consume 3 Gasha Tokens
      this.profile.gachaPullCount = prevPullCount + 1;
      if (!Array.isArray(this.profile.recentPullIds)) {
        this.profile.recentPullIds = [];
      }
      this.profile.recentPullIds.push(fig.id);
      if (this.profile.recentPullIds.length > 10) {
        this.profile.recentPullIds = this.profile.recentPullIds.slice(-10);
      }

      const wasUnlocked = this.profile.unlockedFigurines.includes(fig.id);
      const prevCount = this.profile.figurineCounts[fig.id] || (wasUnlocked ? 1 : 0);
      const newCount = prevCount + 1;
      this.profile.figurineCounts[fig.id] = newCount;

      if (!wasUnlocked) {
        this.profile.unlockedFigurines.push(fig.id);
      }

      if ((this.profile.keys || 0) >= 3) {
        this.profile.keys = wasUnlocked ? 1 : 0;
      } else if (wasUnlocked) {
        this.profile.keys = Math.min(3, (this.profile.keys || 0) + 1);
      }
      this.profile.moldProgress = Math.round(((this.profile.keys || 0) / 3) * 100);
      this.capsuleFoundThisRound = false;

      const nextLocked = Catalog.FIGURINES.find(
        (f) => !this.profile.unlockedFigurines.includes(f.id)
      );
      if (nextLocked) {
        this.profile.currentMoldFigurineId = nextLocked.id;
      }
      this.saveProfile();
      this.updateMetaTopBar();

      this.audio.playFigurineUnbox(fig.rarity);

      const gachaInfo = this.getGachaGradeInfo(fig.rarity);
      const modalCard = document.getElementById('unbox-modal-card');
      const crateBtn = document.getElementById('btn-blind-box-tap');
      const heroBall = document.getElementById('gasha-hero-ball');
      const revealView = document.getElementById('unbox-reveal-view');
      const collectBtn = document.getElementById('btn-unbox-collect');
      const equipNowBtn = document.getElementById('btn-unbox-equip-now');
      const titleEl = document.getElementById('unbox-modal-title');
      const rarityPill = document.getElementById('unbox-rarity-pill');
      const dupBadge = document.getElementById('unbox-dup-badge');
      const figName = document.getElementById('unbox-fig-name');
      const figLore = document.getElementById('unbox-fig-lore');
      const splitShells = document.getElementById('gasha-split-shells');

      if (heroBall) {
        heroBall.classList.remove('tap-stage-1', 'tap-stage-2', 'ball-hit-bounce', 'vessel-spin-tick', 'vessel-lock-pop');
      }

      if (modalCard) {
        modalCard.classList.remove('tier-common', 'tier-rare', 'tier-epic', 'tier-legendary', 'tier-mythic');
        modalCard.classList.add(`tier-${gachaInfo.tierClass}`, 'is-revealed');
      }

      if (titleEl) {
        titleEl.textContent = wasUnlocked ? `Unlocked (×${newCount})!` : 'New Figurine!';
      }
      if (crateBtn) crateBtn.classList.add('hidden');
      if (revealView) {
        revealView.classList.remove('hidden', 'gasha-capsule-burst');
        void revealView.offsetWidth;
        revealView.classList.add('gasha-capsule-burst');
      }
      if (splitShells) {
        splitShells.className = `gasha-split-shells ${gachaInfo.shellClass}`;
      }
      if (equipNowBtn) {
        const isAlreadyEquipped = this.profile.equippedFigurineId === fig.id;
        equipNowBtn.classList.toggle('hidden', isAlreadyEquipped);
        equipNowBtn.textContent = `★ EQUIP`;
      }
      const bonusSpinBtn = document.getElementById('btn-unbox-watch-ad-spin');
      if (bonusSpinBtn) {
        bonusSpinBtn.classList.toggle('hidden', !!this.bonusSpinUsedThisUnbox);
      }
      if (collectBtn) {
        collectBtn.classList.remove('hidden');
        collectBtn.innerHTML = `<span class="cta-main-text">${this.unboxFromWin || this.isLevelWon ? 'CONTINUE' : 'COLLECT'}</span>`;
      }
      if (rarityPill) {
        rarityPill.textContent = fig.rarity.toUpperCase();
        rarityPill.className = `trophy-tier-label tier-${getFigurineTier(fig)}`;
      }
      if (dupBadge) {
        dupBadge.classList.remove('hidden', 'is-dup', 'is-new');
        if (wasUnlocked) {
          dupBadge.classList.add('is-dup');
          dupBadge.textContent = `×${newCount}`;
        } else {
          dupBadge.classList.add('is-new');
          dupBadge.textContent = `★ NEW`;
        }
      }
      const unboxHost = document.getElementById('unbox-trophy');
      if (unboxHost) {
        unboxHost.innerHTML = trophyMarkup(fig, { size: 'hero' });
        unboxHost.classList.remove('reveal-pop');
        void unboxHost.offsetWidth; // restart the pop-in animation
        unboxHost.classList.add('reveal-pop');
        if (window.PopStacks3DViewer) {
          const stageEl = unboxHost.querySelector('.trophy-stage');
          if (stageEl) {
            window.PopStacks3DViewer.mount(stageEl, fig, { locked: false });
          }
        }
      }
      if (figName) figName.textContent = fig.name;
      if (figLore) figLore.textContent = fig.blurb;
    }

    // -------------------------------------------------------------------------
    // Ad Revenue Architecture: Rewarded Video + Paced Interstitials (IAP Deferred)
    // -------------------------------------------------------------------------
    recordAdImpression(placement, isRewarded = true) {
      if (!this.adStats) return;
      if (isRewarded) {
        this.adStats.rewardedAdsWatched = (this.adStats.rewardedAdsWatched || 0) + 1;
        this.adStats.watchedRewardedThisRound = true;
        this.adStats.estimatedRevenueUsd = Number(
          ((this.adStats.estimatedRevenueUsd || 0) + 0.035).toFixed(4)
        );
      } else {
        this.adStats.interstitialAdsShown = (this.adStats.interstitialAdsShown || 0) + 1;
        this.adStats.estimatedRevenueUsd = Number(
          ((this.adStats.estimatedRevenueUsd || 0) + 0.015).toFixed(4)
        );
      }
      this.adStats.lastPlacement = placement;
      if (this.adStats.placements) {
        this.adStats.placements[placement] = (this.adStats.placements[placement] || 0) + 1;
      }
    }

    triggerInterstitialAd(onDone) {
      const modal = document.getElementById('rewarded-ad-modal');
      const sponsorTag = modal ? modal.querySelector('.ad-sponsor-tag') : null;
      const titleEl = document.getElementById('ad-modal-title');
      const timerPill = document.getElementById('ad-countdown-pill');
      const fillEl = document.getElementById('ad-progress-fill');
      const descEl = document.getElementById('ad-reward-desc');
      const claimBtn = document.getElementById('btn-ad-claim-close');
      const claimText = document.getElementById('btn-ad-claim-text');

      if (!modal) {
        if (typeof onDone === 'function') onDone();
        return;
      }

      if (sponsorTag) sponsorTag.textContent = '▶ BETWEEN-ROUND SPONSOR BREAK';
      if (titleEl) titleEl.textContent = 'Art Toy Atelier — Next Round Loading';
      if (descEl) {
        descEl.textContent = 'Thanks for supporting PopStacks! Bonus +15 Prisms added.';
      }
      modal.classList.remove('hidden');

      this.activeAdCallback = () => {
        this.recordAdImpression('between_round_interstitial', false);
        this.profile.prisms += 15;
        this.saveProfile();
        this.updateMetaTopBar();
        if (typeof onDone === 'function') onDone();
      };

      const durationMs = 700;
      if (claimBtn) claimBtn.disabled = true;
      if (claimText) claimText.textContent = 'Next Round in 2s...';
      if (fillEl) fillEl.style.width = '0%';

      const start = performance.now();
      const stepInterstitial = (now) => {
        const p = Math.min(1, (now - start) / durationMs);
        if (fillEl) fillEl.style.width = `${Math.round(p * 100)}%`;
        const rem = Math.max(0, Math.ceil((1 - p) * 2));
        if (timerPill) timerPill.textContent = rem > 0 ? `${rem}s` : 'SKIP ▶';
        if (p < 1) {
          requestAnimationFrame(stepInterstitial);
        } else {
          if (claimBtn) claimBtn.disabled = false;
          if (claimText) claimText.textContent = 'CONTINUE TO NEXT ROUND ▶';
        }
      };
      requestAnimationFrame(stepInterstitial);
    }

    triggerRewardedAd(rewardType = 'shop_prisms_hammer') {
      const modal = document.getElementById('rewarded-ad-modal');
      const sponsorTag = modal ? modal.querySelector('.ad-sponsor-tag') : null;
      const titleEl = document.getElementById('ad-modal-title');
      const timerPill = document.getElementById('ad-countdown-pill');
      const fillEl = document.getElementById('ad-progress-fill');
      const descEl = document.getElementById('ad-reward-desc');
      const claimBtn = document.getElementById('btn-ad-claim-close');
      const claimText = document.getElementById('btn-ad-claim-text');

      if (!modal) return;
      modal.classList.remove('hidden');
      if (sponsorTag) sponsorTag.textContent = '▶ OPT-IN REWARDED VIDEO';
      if (titleEl) titleEl.textContent = 'Art Toy Atelier — Golden Kiln Showcase';

      const REWARD_COPY = {
        deadlock_rescue: 'Reward unlocking: Free Revive (+1 Extra Slot & Clear 3 Crowded Stacks)!',
        win_2x_prisms: 'Reward unlocking: 2× Round Score, +50 Prisms & +1 Gasha Key!',
        unbox_bonus_spin: 'Reward unlocking: Instant Bonus Gacha Capsule Spin!',
        booster_hammer: 'Reward unlocking: +2 Ceramic Hammers!',
        booster_swap: 'Reward unlocking: +2 Spatula Swaps!',
        booster_extraslot: 'Reward unlocking: Unlock 4th Tray Slot + 1 Extra Slot Booster!',
        vip_pass: 'Reward unlocking: Atelier VIP Pass (Unlimited Hearts, 4th Slot & +200 Prisms)!',
        starter_crate: 'Reward unlocking: Supply Crate (+150 Prisms & +1 of Every Booster)!',
        shop_prisms_vault: 'Reward unlocking: +150 Prisms & +1 Gasha Key!',
        shop_prisms_hammer: 'Reward unlocking: +75 Prisms, +1 Key & +1 Hammer!'
      };
      if (descEl) {
        descEl.textContent = REWARD_COPY[rewardType] || REWARD_COPY.shop_prisms_hammer;
      }

      this.activeAdCallback = () => {
        this.recordAdImpression(rewardType, true);
        if (rewardType === 'deadlock_rescue') {
          this.executeDeadlockRescue(3);
        } else if (rewardType === 'win_2x_prisms') {
          this.score = Math.round(this.score * 2);
          if (this.score > this.bestScore) this.bestScore = this.score;
          this.profile.levelBestScores[this.currentLevelNum] = Math.max(
            this.profile.levelBestScores[this.currentLevelNum] || 0,
            this.score
          );
          this.profile.prisms += 50;
          this.profile.keys = Math.min(3, (this.profile.keys || 0) + 1);
          this.profile.moldProgress = Math.round(((this.profile.keys || 0) / 3) * 100);
          const finalScoreEl = document.getElementById('win-final-score');
          if (finalScoreEl) finalScoreEl.textContent = this.score.toLocaleString();
          const btnWinAd2x = document.getElementById('btn-win-watch-ad-2x');
          const btnWinAd2xText = document.getElementById('btn-win-watch-ad-2x-text');
          if (btnWinAd2x) btnWinAd2x.disabled = true;
          if (btnWinAd2xText) btnWinAd2xText.textContent = '✓ 2× SCORE & +1 KEY CLAIMED!';
          this.audio.playFigurineUnbox();
          this.saveProfile();
          this.updateMetaTopBar();
          this.updateHUD();
        } else if (rewardType === 'unbox_bonus_spin') {
          this.bonusSpinUsedThisUnbox = true;
          this.triggerUnboxingModal(null, {
            boosted: true,
            fromWin: this.unboxFromWin,
            isBonusSpin: true
          });
        } else if (rewardType === 'booster_hammer') {
          this.profile.boosters.hammer = (this.profile.boosters.hammer || 0) + 2;
          this.audio.playExtraSlotUnlock();
          this.saveProfile();
          this.updateBoosterDockUI();
        } else if (rewardType === 'booster_swap') {
          this.profile.boosters.swap = (this.profile.boosters.swap || 0) + 2;
          this.audio.playExtraSlotUnlock();
          this.saveProfile();
          this.updateBoosterDockUI();
        } else if (rewardType === 'booster_extraslot') {
          this.extraSlotUnlocked = true;
          this.profile.boosters.extraslot = (this.profile.boosters.extraslot || 0) + 1;
          if (!this.tray[3]) {
            const discs = Catalog.generateSmartTrayStack(this, this.rng, this.currentLevelDef);
            this.tray[3] = { discs, scale: 1, offsetY: 0 };
          }
          this.audio.playExtraSlotUnlock();
          this.saveProfile();
          this.updateBoosterDockUI();
        } else if (rewardType === 'vip_pass') {
          this.profile.collectorPass = true;
          this.profile.hearts = 5;
          this.profile.prisms += 200;
          this.profile.keys = Math.min(3, (this.profile.keys || 0) + 1);
          this.extraSlotUnlocked = true;
          this.audio.playLevelComplete(3);
          this.saveProfile();
          this.renderShopUI();
          this.updateMetaTopBar();
          this.updateBoosterDockUI();
        } else if (rewardType === 'starter_crate') {
          this.profile.starterBundleClaimed = true;
          this.profile.prisms += 150;
          this.profile.coins += 500;
          this.profile.boosters.hammer += 1;
          this.profile.boosters.swap += 1;
          this.profile.boosters.extraslot += 1;
          this.audio.playFigurineUnbox();
          this.saveProfile();
          this.renderShopUI();
          this.updateMetaTopBar();
          this.updateBoosterDockUI();
        } else if (rewardType === 'shop_prisms_vault') {
          this.profile.prisms += 150;
          this.profile.keys = Math.min(3, (this.profile.keys || 0) + 1);
          this.audio.playFigurineUnbox();
          this.saveProfile();
          this.updateMetaTopBar();
        } else {
          this.profile.prisms += 75;
          this.profile.keys = Math.min(3, (this.profile.keys || 0) + 1);
          this.profile.boosters.hammer += 1;
          this.audio.playExtraSlotUnlock();
          this.saveProfile();
          this.updateMetaTopBar();
          this.updateBoosterDockUI();
        }
      };

      // If Collector Pass VIP is active, instant 150ms fast-forward!
      const durationMs = this.profile.collectorPass ? 150 : 950;
      if (claimBtn) claimBtn.disabled = true;
      if (claimText) claimText.textContent = 'Previewing Atelier Showcase...';
      if (fillEl) fillEl.style.width = '0%';

      const start = performance.now();
      const stepAd = (now) => {
        const p = Math.min(1, (now - start) / durationMs);
        if (fillEl) fillEl.style.width = `${Math.round(p * 100)}%`;
        const rem = Math.max(0, Math.ceil((1 - p) * 3));
        if (timerPill) timerPill.textContent = rem > 0 ? `${rem}s` : 'DONE ✓';
        if (p < 1) {
          requestAnimationFrame(stepAd);
        } else {
          if (claimBtn) claimBtn.disabled = false;
          if (claimText) claimText.textContent = 'CLAIM FREE REWARD ▶';
        }
      };
      requestAnimationFrame(stepAd);
    }

    // -------------------------------------------------------------------------
    // Auto-Solver Integration for Testing & Debug Drawer
    // -------------------------------------------------------------------------
    autoSolveStep(options = {}) {
      if (this.isProcessingCascade || this.isDeadlocked || this.isLevelWon) return false;
      const instant = options.instant !== undefined ? !!options.instant : true;

      // Refill tray if empty
      if (!this.tray[0] && !this.tray[1] && !this.tray[2]) {
        this.refillTray(true);
      }

      // Check FTUE step first
      const ftue = this.getActiveFtueStep();
      if (ftue && this.tray[ftue.trayIndex]) {
        const tCell = this.cells.get(cellKey(ftue.targetQ, ftue.targetR));
        if (tCell && !tCell.isAnvil && tCell.iceHp === 0 && tCell.stack.length === 0) {
          return this.placeStack(ftue.trayIndex, ftue.targetQ, ftue.targetR, { instant });
        }
      }

      const emptyCells = this.cellList.filter(
        (c) => !c.isAnvil && c.iceHp === 0 && c.stack.length === 0
      );
      if (emptyCells.length === 0) return false;

      // Pick best move by simulating on a clone state
      let bestMove = null;
      let bestScore = -Infinity;
      for (let tIdx = 0; tIdx < 3; tIdx++) {
        const slot = this.tray[tIdx];
        if (!slot || !slot.discs || slot.discs.length === 0) continue;
        for (let cIdx = 0; cIdx < emptyCells.length; cIdx++) {
          const cell = emptyCells[cIdx];
          const topCol = getTopColor(slot.discs);
          const matches = this.getMatchingNeighbors(cell.q, cell.r, topCol);
          let sc = matches.length * 120;
          matches.forEach((m) => {
            sc += getTopContiguousCount(m.stack) * 30;
          });
          if (sc > bestScore) {
            bestScore = sc;
            bestMove = { trayIndex: tIdx, q: cell.q, r: cell.r };
          }
        }
      }

      if (!bestMove) return false;
      return this.placeStack(bestMove.trayIndex, bestMove.q, bestMove.r, { instant });
    }

    autoWinLevel() {
      if (this.currentLevelDef && this.currentLevelDef.objective && Array.isArray(this.currentLevelDef.objective.targets)) {
        this.currentLevelDef.objective.targets.forEach((t) => {
          const k = getColorKey(t.colorId !== undefined ? t.colorId : t.colorIndex);
          this.clearedByColor[k] = t.count;
        });
        this.totalDiscsCleared = this.currentLevelDef.objective.totalDiscsGoal || 30;
      }
      this.score = Math.max(this.score, 900);
      this.updateHUD();
      this.triggerLevelWinModal();
      return true;
    }

    // -------------------------------------------------------------------------
    // Tween & 60fps Animation Loop
    // -------------------------------------------------------------------------
    springEase(t) {
      return 1 - Math.exp(-6.5 * t) * Math.cos(9.5 * t);
    }

    addTween({ target, duration, onUpdate, onComplete }) {
      this.tweens.push({
        target,
        duration: Math.max(16, duration),
        elapsed: 0,
        onUpdate,
        onComplete
      });
    }

    tick(now) {
      const rawDt = now - this.lastTick;
      const dtMs = Math.min(50, Math.max(1, rawDt));
      this.lastTick = now;

      if (rawDt > 0 && rawDt < 120) {
        this.telemetry.frameDeltas.push(rawDt);
        if (this.telemetry.frameDeltas.length > 30) {
          this.telemetry.frameDeltas.shift();
        }
      }
      if (this.telemetry.frameDeltas.length > 0) {
        const avgDelta =
          this.telemetry.frameDeltas.reduce((acc, d) => acc + d, 0) /
          this.telemetry.frameDeltas.length;
        this.telemetry.fps = Math.min(60, Math.max(30, Math.round(1000 / Math.max(16.6, avgDelta))));
      } else {
        this.telemetry.fps = 60;
      }

      for (let i = this.tweens.length - 1; i >= 0; i--) {
        const tw = this.tweens[i];
        tw.elapsed += dtMs;
        const t = Math.min(1, tw.elapsed / tw.duration);
        try {
          if (tw.onUpdate) tw.onUpdate(t, tw.target);
        } catch (err) {
          console.error('Tween onUpdate error:', err);
        }
        if (t >= 1) {
          this.tweens.splice(i, 1);
          try {
            if (tw.onComplete) tw.onComplete(tw.target);
          } catch (err) {
            console.error('Tween onComplete error:', err);
          }
        }
      }

      for (let i = this.poppingDiscs.length - 1; i >= 0; i--) {
        const pd = this.poppingDiscs[i];
        pd.life += dtMs;
        if (pd.life >= pd.maxLife) this.poppingDiscs.splice(i, 1);
      }

      for (let i = this.shockwaves.length - 1; i >= 0; i--) {
        const sw = this.shockwaves[i];
        sw.life += dtMs;
        const p = Math.min(1, sw.life / sw.maxLife);
        sw.radius =
          this.hexRadius * 0.45 +
          (sw.maxRadius - this.hexRadius * 0.45) * (1 - Math.pow(1 - p, 3));
        sw.alpha = (1 - p) * 0.9;
        if (p >= 1) this.shockwaves.splice(i, 1);
      }

      const dtSec = dtMs / 1000;
      for (let i = this.particles.length - 1; i >= 0; i--) {
        const pt = this.particles[i];
        pt.life += dtMs;
        pt.x += pt.vx * dtSec;
        pt.y += pt.vy * dtSec;
        pt.vy += pt.gravity * dtSec;
        pt.rotation += pt.vRot * dtSec;
        if (pt.life >= pt.maxLife) this.particles.splice(i, 1);
      }

      for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
        const ft = this.floatingTexts[i];
        ft.life += dtMs;
        ft.y -= 32 * dtSec;
        if (ft.life >= ft.maxLife) this.floatingTexts.splice(i, 1);
      }

      this.telemetry.activeTweens =
        this.tweens.length +
        this.flyingDiscs.length +
        this.poppingDiscs.length +
        this.objectiveFlyingDiscs.length +
        this.particles.length;

      if (this.activeScreen === 'board') {
        this.render(now);
      }
      this.renderTurntableCanvases(now);
      this.updateTelemetryDOM();
    }

    // -------------------------------------------------------------------------
    // High-DPI 2.5D Isometric Canvas Renderer (7 / 19 / 37 Slots + Obstacles)
    // -------------------------------------------------------------------------
    render(now) {
      const ctx = this.ctx;
      ctx.save();
      ctx.scale(this.dpr, this.dpr);

      ctx.clearRect(0, 0, this.width, this.height);

      // 0. Draw Floating Golden Studio Sparkles (60fps ambient atmosphere)
      this.drawAmbientSparkles(ctx, now);

      // Clip zoomed board to the workbench region between top HUD badges and bottom Dispenser Tray
      ctx.save();
      if (typeof this.boardShake === 'number' && this.boardShake > 0.1) {
        const sx = Math.sin(now * 0.085) * this.boardShake;
        const sy = Math.cos(now * 0.11) * (this.boardShake * 0.65);
        ctx.translate(sx, sy);
        this.boardShake *= 0.88;
      }
      if (this.boardZoom > 1.01) {
        const clipTop = 42;
        const trayH = Math.max(88, Math.min(108, this.height * 0.18));
        const clipBottom = Math.max(clipTop + 120, this.trayY - trayH * 0.54 - 6);
        ctx.beginPath();
        ctx.roundRect(6, clipTop, this.width - 12, clipBottom - clipTop, 20);
        ctx.clip();
      }

      // 1. Draw Sculpted Studio Workbench Base under Hex Grid
      this.drawWorkbenchBase(ctx);

      // 2. Draw Recessed Hex Sockets & Fixed Brass Anvil Bases
      for (let i = 0; i < this.cellList.length; i++) {
        const cell = this.cellList[i];
        this.drawHexSocket(ctx, cell, now);
      }

      // 3. Determine active ghost preview
      const previewInfo = this.getActiveGhostPreview();

      // 4. Draw Board Stacks, Brass Anvil Pedestals & Frozen Clay Shells (sorted back-to-front)
      for (let i = 0; i < this.cellList.length; i++) {
        const cell = this.cellList[i];
        const pos = this.axialToPixel(cell.q, cell.r);

        if (cell.isAnvil) {
          this.drawBrassAnvil(ctx, pos.x, pos.y);
          continue;
        }

        if (
          previewInfo &&
          previewInfo.cellKey === cell.key &&
          cell.stack.length === 0 &&
          !this.dragState.active
        ) {
          this.drawVinylStack(
            ctx,
            previewInfo.x,
            previewInfo.y,
            previewInfo.discs,
            1,
            1,
            0.65,
            true
          );
        } else if (cell.stack.length > 0) {
          this.drawVinylStack(
            ctx,
            pos.x,
            pos.y,
            cell.stack,
            cell.scaleX,
            cell.scaleY,
            1.0,
            cell.iceHp === 0
          );

          // If cell is encased in Frozen Clay (`cell.iceHp > 0`), render the cracked glaze shell + frost badge
          if (cell.iceHp > 0) {
            this.drawFrozenClayShell(ctx, pos.x, pos.y, cell, now);
          }

          // Option 3: Render Hidden Clay Capsule badge on the stack
          if (cell.hasCapsule) {
            this.drawBoardCapsuleBadge(ctx, pos.x, pos.y, cell, now);
          }

          // If Hammer or Swap Booster is active, render pulsing target reticle
          if (
            this.activeBooster === 'hammer' ||
            (this.activeBooster === 'swap' && cell.iceHp === 0)
          ) {
            this.drawBoosterTargetReticle(ctx, pos.x, pos.y, cell, now);
          }
        }
      }

      // 5. Draw Step Debugger Visual Overlay when stepMode is active
      if (this.stepMode && this.debugVisualHint) {
        this.drawStepDebugOverlay(ctx, this.debugVisualHint);
      }

      ctx.restore();

      // 6. Draw Parabolic Flying Discs, Popping Discs & Objective Flying Mini-Discs
      for (let i = 0; i < this.flyingDiscs.length; i++) {
        this.drawFlyingDisc(ctx, this.flyingDiscs[i]);
      }
      for (let i = 0; i < this.poppingDiscs.length; i++) {
        this.drawPoppingDisc(ctx, this.poppingDiscs[i]);
      }
      for (let i = 0; i < this.objectiveFlyingDiscs.length; i++) {
        this.drawObjectiveFlyingDisc(ctx, this.objectiveFlyingDiscs[i]);
      }

      // 7. Draw Bottom 3+1 Slot Dispenser Tray & Tray Stacks
      this.drawDispenserTray(ctx, now);

      // 8. Draw Burst Shockwaves, Confetti Particles & Floating Score Popups
      this.drawEffects(ctx);

      // 9. Draw Interactive FTUE Sculptor's Guiding Hand on Level 1 (if not dragging)
      const ftueStep = this.getActiveFtueStep();
      if (ftueStep && !this.dragState.active) {
        this.drawFtueGuidingHand(ctx, ftueStep, now);
      }

      // 10. Draw Neighbor Match Preview Rings & Arcs (underneath dragged stack)
      if (previewInfo) {
        this.drawNeighborMatchPreview(ctx, previewInfo, now, false);
      }

      // 11. Draw Active Dragged Stack Floating Above Finger (42px offset)
      if (this.dragState.active && this.tray[this.dragState.trayIndex]) {
        const draggedSlot = this.tray[this.dragState.trayIndex];
        ctx.save();
        ctx.fillStyle = 'rgba(35, 31, 32, 0.16)';
        ctx.beginPath();
        ctx.ellipse(
          this.dragState.dragX,
          this.dragState.dragY + 26,
          this.hexRadius * 0.82,
          this.hexRadius * 0.82 * Y_TILT,
          0,
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();

        this.drawVinylStack(
          ctx,
          this.dragState.dragX,
          this.dragState.dragY,
          draggedSlot.discs,
          1.06,
          1.06,
          1.0,
          true
        );
      }

      // 12. Draw Neighbor Match Foresight Pill on top of everything
      if (previewInfo) {
        this.drawNeighborMatchPreview(ctx, previewInfo, now, true);
      }

      ctx.restore();
    }

    drawAmbientSparkles(ctx, now) {
      if (this.settings.reducedMotion || !this.ambientSparkles) return;
      const kit = this.getEquippedCosmeticKit();
      const spColA = kit.crestColor || '#F4B942';
      const spColB = (kit.figurine && kit.figurine.primaryColor) || '#FFFDF7';
      ctx.save();
      const tSec = now * 0.001;
      for (let i = 0; i < this.ambientSparkles.length; i++) {
        const sp = this.ambientSparkles[i];
        const sx = (sp.x + Math.sin(tSec * 0.8 + sp.phase) * 14 + this.width) % this.width;
        const sy = (sp.y - ((tSec * sp.speedY) % this.height) + this.height) % this.height;
        const twinkle = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(tSec * 2.6 + sp.phase));
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = i % 2 === 0 ? spColA : spColB;
        ctx.beginPath();
        ctx.arc(sx, sy, sp.r * (kit.isDarkStage ? 1.25 : 1), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    getActiveWorkbenchTheme() {
      return this.getEquippedCosmeticKit();
    }

    drawWorkbenchBase(ctx) {
      const factor = this.gridRadius === 1 ? 3.16 : this.gridRadius === 2 ? 4.82 : 6.6;
      const rx = this.hexRadius * factor;
      const ry = rx * Y_TILT;
      const th = this.getEquippedCosmeticKit();

      ctx.save();
      // Drop shadow under carved wooden board
      ctx.fillStyle = th.isDarkStage ? 'rgba(0, 0, 0, 0.38)' : 'rgba(35, 31, 32, 0.18)';
      this.traceRoundedHexPlatform(ctx, this.boardCenterX, this.boardCenterY + 15, rx * 1.02, ry * 1.02);
      ctx.fill();

      // 3D Carved Lower Rim (Equipped Figurine Theme)
      ctx.fillStyle = th.rimFill;
      this.traceRoundedHexPlatform(ctx, this.boardCenterX, this.boardCenterY + 10, rx, ry);
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = th.rimStroke;
      ctx.stroke();

      // Upper Workbench Deck (Equipped Figurine Theme)
      const deckGrad = ctx.createRadialGradient(
        this.boardCenterX,
        this.boardCenterY - ry * 0.25,
        rx * 0.12,
        this.boardCenterX,
        this.boardCenterY,
        rx
      );
      deckGrad.addColorStop(0, th.deckStop0);
      deckGrad.addColorStop(0.72, th.deckStop1);
      deckGrad.addColorStop(1, th.deckStop2);
      ctx.fillStyle = deckGrad;
      this.traceRoundedHexPlatform(ctx, this.boardCenterX, this.boardCenterY + 2, rx, ry);
      ctx.fill();
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = th.rimStroke;
      ctx.stroke();

      // Inner Carved Inlay Groove + Equipped Figurine Crest Ring
      this.traceRoundedHexPlatform(ctx, this.boardCenterX, this.boardCenterY + 2, rx * 0.94, ry * 0.94);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = th.inlayStroke;
      ctx.stroke();

      if (th.figurine) {
        this.traceRoundedHexPlatform(ctx, this.boardCenterX, this.boardCenterY + 2, rx * 0.89, ry * 0.89);
        ctx.lineWidth = 1.2;
        ctx.setLineDash([7, 5]);
        ctx.strokeStyle = th.crestColor || th.rivetFill;
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 6 Corner Rivets on Workbench Perimeter
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const rvx = this.boardCenterX + rx * 0.87 * Math.cos(angle);
        const rvy = this.boardCenterY + 2 + ry * 0.87 * Math.sin(angle);
        ctx.fillStyle = th.rivetFill;
        ctx.strokeStyle = th.rimStroke;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(rvx, rvy, 3.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }

    traceRoundedHexPlatform(ctx, cx, cy, rx, ry) {
      ctx.beginPath();
      const verts = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        verts.push({
          x: cx + rx * Math.cos(angle),
          y: cy + ry * Math.sin(angle)
        });
      }
      const cornerT = 0.16;
      for (let i = 0; i < 6; i++) {
        const prev = verts[(i + 5) % 6];
        const curr = verts[i];
        const next = verts[(i + 1) % 6];
        const p1x = curr.x + (prev.x - curr.x) * cornerT;
        const p1y = curr.y + (prev.y - curr.y) * cornerT;
        const p2x = curr.x + (next.x - curr.x) * cornerT;
        const p2y = curr.y + (next.y - curr.y) * cornerT;
        if (i === 0) ctx.moveTo(p1x, p1y);
        else ctx.lineTo(p1x, p1y);
        ctx.quadraticCurveTo(curr.x, curr.y, p2x, p2y);
      }
      ctx.closePath();
    }

    traceIsoHex(ctx, cx, cy, radiusX, radiusY, cornerRatio = 0.18) {
      ctx.beginPath();
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const angle = ((60 * i - 30) * Math.PI) / 180;
        pts.push({
          x: cx + radiusX * Math.cos(angle),
          y: cy + radiusY * Math.sin(angle)
        });
      }
      for (let i = 0; i < 6; i++) {
        const prev = pts[(i + 5) % 6];
        const curr = pts[i];
        const next = pts[(i + 1) % 6];
        const p1x = curr.x + (prev.x - curr.x) * cornerRatio;
        const p1y = curr.y + (prev.y - curr.y) * cornerRatio;
        const p2x = curr.x + (next.x - curr.x) * cornerRatio;
        const p2y = curr.y + (next.y - curr.y) * cornerRatio;
        if (i === 0) ctx.moveTo(p1x, p1y);
        else ctx.lineTo(p1x, p1y);
        ctx.quadraticCurveTo(curr.x, curr.y, p2x, p2y);
      }
      ctx.closePath();
    }

    drawHexSocket(ctx, cell, now) {
      const pos = this.axialToPixel(cell.q, cell.r);
      const rx = this.hexRadius * 0.94;
      const ry = rx * Y_TILT;
      const th = this.getActiveWorkbenchTheme();

      const isSnapped = this.dragState.active && this.dragState.snappedKey === cell.key;
      const isHovered = !this.dragState.active && this.hoveredCellKey === cell.key;
      const isRecommended = this.recommendedCellKey === cell.key && cell.stack.length === 0;

      ctx.save();
      this.traceIsoHex(ctx, pos.x, pos.y + 2, rx, ry, 0.18);
      ctx.fillStyle = th.socketOuter;
      ctx.fill();

      this.traceIsoHex(ctx, pos.x, pos.y, rx * 0.93, ry * 0.93, 0.18);
      if (isSnapped || isHovered) {
        ctx.fillStyle = th.snapFill;
      } else if (isRecommended) {
        const pulse = 0.5 + 0.5 * Math.sin(now * 0.008);
        ctx.fillStyle = pulse > 0.5 ? '#FFF3D1' : '#F8E7B8';
      } else {
        ctx.fillStyle = th.socketWell;
      }
      ctx.fill();

      ctx.lineWidth = isSnapped || isRecommended ? 2.5 : 1.3;
      ctx.strokeStyle = isSnapped
        ? th.snapStroke
        : isRecommended
        ? '#FF9F1C'
        : th.socketStroke;
      ctx.stroke();

      if (!cell.isAnvil && cell.stack.length === 0 && !isSnapped) {
        ctx.fillStyle = isRecommended ? '#CC7A00' : 'rgba(110, 99, 87, 0.32)';
        ctx.beginPath();
        ctx.ellipse(pos.x, pos.y, rx * 0.16, ry * 0.16, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    drawBoardCapsuleBadge(ctx, baseX, baseY, cell, now) {
      const stackH = Math.max(1, cell.stack.length) * this.discThickness;
      const topY = baseY - stackH + this.discThickness;
      const bob = Math.sin(now * 0.007) * 2.0;
      const bx = baseX - this.hexRadius * 0.34;
      const by = topY - this.hexRadius * Y_TILT * 0.18 + bob;

      ctx.save();
      // 2-Tone Gashapon Capsule Sphere Badge (Red top, Ivory bottom, Gold center clasp)
      const r = 7.5;
      ctx.beginPath();
      ctx.arc(bx, by, r, Math.PI, 0);
      ctx.fillStyle = '#FF5964';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI);
      ctx.fillStyle = '#FFFDF7';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#231F20';
      ctx.beginPath();
      ctx.arc(bx, by, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bx - r, by);
      ctx.lineTo(bx + r, by);
      ctx.stroke();
      ctx.fillStyle = '#FFD166';
      ctx.beginPath();
      ctx.arc(bx, by, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    /**
     * Renders a Fixed Brass Anvil Pedestal (`cell.isAnvil`)
     */
    drawBrassAnvil(ctx, cx, cy) {
      const rx = this.hexRadius * 0.86;
      const ry = rx * Y_TILT;
      const blockHeight = this.discThickness * 2.4;
      const topY = cy - blockHeight;

      ctx.save();
      // Side wall of brushed bronze anvil
      ctx.beginPath();
      this.traceIsoHexSideWall(ctx, cx, topY, rx, ry, blockHeight);
      ctx.fillStyle = '#8C6223';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#231F20';
      ctx.stroke();

      // Metallic brass top plate
      this.traceIsoHex(ctx, cx, topY, rx, ry, 0.18);
      ctx.fillStyle = '#D4A349';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#231F20';
      ctx.stroke();

      // Inner bevel & rivets
      this.traceIsoHex(ctx, cx, topY, rx * 0.78, ry * 0.78, 0.18);
      ctx.fillStyle = '#E8BE6B';
      ctx.fill();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = '#734F1A';
      ctx.stroke();

      // Vector Forged Brass Anvil Lock Emblem (0 emoji dependency)
      const ew = rx * 0.36;
      const eh = ry * 0.36;
      ctx.fillStyle = '#5C3D10';
      ctx.strokeStyle = '#231F20';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(cx, topY - eh);
      ctx.lineTo(cx + ew, topY);
      ctx.lineTo(cx, topY + eh);
      ctx.lineTo(cx - ew, topY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFDF7';
      ctx.beginPath();
      ctx.arc(cx, topY, Math.max(2, rx * 0.08), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /**
     * Renders the Cracked Celadon/Frost Glaze Shell + `❄ N` badge over a Frozen Clay Tile (`cell.iceHp > 0`)
     */
    drawFrozenClayShell(ctx, baseX, baseY, cell, now) {
      const rx = this.hexRadius * 0.9;
      const ry = rx * Y_TILT;
      const stackH = Math.max(1, cell.stack.length) * this.discThickness;
      const topY = baseY - stackH + this.discThickness;

      ctx.save();
      // Translucent frost-glaze casing over the stack
      ctx.beginPath();
      this.traceIsoHexSideWall(ctx, baseX, topY, rx, ry, stackH);
      ctx.fillStyle = 'rgba(186, 230, 253, 0.46)';
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = '#0284C7';
      ctx.stroke();

      this.traceIsoHex(ctx, baseX, topY, rx, ry, 0.2);
      ctx.fillStyle = 'rgba(224, 242, 254, 0.58)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#38BDF8';
      ctx.stroke();

      // Crack fracture lines on top face
      ctx.beginPath();
      ctx.moveTo(baseX - rx * 0.45, topY - ry * 0.25);
      ctx.lineTo(baseX, topY + ry * 0.08);
      ctx.lineTo(baseX + rx * 0.42, topY - ry * 0.3);
      if (cell.iceHp === 1) {
        ctx.moveTo(baseX, topY + ry * 0.08);
        ctx.lineTo(baseX - rx * 0.25, topY + ry * 0.52);
      }
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      // Floating `❄ N` Ice HP Badge
      const pulse = 1 + 0.04 * Math.sin(now * 0.008);
      const pillW = 34 * pulse;
      const pillH = 17 * pulse;
      const badgeY = topY - ry * 0.55;

      ctx.fillStyle = '#0369A1';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(baseX - pillW / 2, badgeY - pillH / 2, pillW, pillH, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '800 10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`❄ ${cell.iceHp}`, baseX, badgeY + 0.5);
      ctx.restore();
    }

    drawBoosterTargetReticle(ctx, baseX, baseY, cell, now) {
      const topY = baseY - (cell.stack.length - 1) * this.discThickness;
      const pulse = 1 + 0.07 * Math.sin(now * 0.01);
      const rx = this.hexRadius * 0.94 * pulse;
      const ry = rx * Y_TILT;
      const isSelectedSource = this.swapSourceCellKey === cell.key;

      ctx.save();
      this.traceIsoHex(ctx, baseX, topY, rx, ry, 0.2);
      ctx.strokeStyle = isSelectedSource ? '#00A896' : '#FF9F1C';
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.restore();
    }

    drawFtueGuidingHand(ctx, step, now) {
      const slotPos = this.traySlotPositions[step.trayIndex];
      const targetCell = this.cells.get(cellKey(step.targetQ, step.targetR));
      if (!slotPos || !targetCell) return;
      const targetPos = this.axialToPixel(targetCell.q, targetCell.r);

      const loopT = (now % 1300) / 1300;
      const ease = loopT < 0.5 ? 2 * loopT * loopT : 1 - Math.pow(-2 * loopT + 2, 2) / 2;

      const hx = slotPos.x + (targetPos.x - slotPos.x) * ease;
      const hy = slotPos.y + (targetPos.y - slotPos.y) * ease - Math.sin(ease * Math.PI) * 36;

      ctx.save();
      // Golden dotted trajectory arc
      ctx.beginPath();
      ctx.moveTo(slotPos.x, slotPos.y - 12);
      ctx.quadraticCurveTo(
        (slotPos.x + targetPos.x) * 0.5,
        Math.min(slotPos.y, targetPos.y) - 45,
        targetPos.x,
        targetPos.y
      );
      ctx.strokeStyle = '#FF9F1C';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Target glowing ring
      this.traceIsoHex(
        ctx,
        targetPos.x,
        targetPos.y,
        this.hexRadius * 0.95,
        this.hexRadius * 0.95 * Y_TILT,
        0.2
      );
      ctx.strokeStyle = '#FF9F1C';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Vector Sculptor Pointer Cursor (0 emoji dependency)
      ctx.save();
      ctx.translate(hx + 6, hy + 8);
      ctx.fillStyle = '#FFFDF7';
      ctx.strokeStyle = '#231F20';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 22);
      ctx.lineTo(6, 16);
      ctx.lineTo(11, 25);
      ctx.lineTo(15, 23);
      ctx.lineTo(10, 14);
      ctx.lineTo(18, 14);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FF9F1C';
      ctx.beginPath();
      ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.restore();
    }

    getActiveGhostPreview() {
      if (this.dragState.active && this.dragState.snappedKey) {
        const slot = this.tray[this.dragState.trayIndex];
        const cell = this.cells.get(this.dragState.snappedKey);
        if (slot && cell && !cell.isAnvil && cell.iceHp === 0 && cell.stack.length === 0) {
          const pos = this.axialToPixel(cell.q, cell.r);
          return {
            cellKey: cell.key,
            q: cell.q,
            r: cell.r,
            x: pos.x,
            y: pos.y,
            discs: slot.discs
          };
        }
      }
      if (!this.dragState.active && this.selectedTrayIndex !== -1 && this.hoveredCellKey) {
        const slot = this.tray[this.selectedTrayIndex];
        const cell = this.cells.get(this.hoveredCellKey);
        if (slot && cell && !cell.isAnvil && cell.iceHp === 0 && cell.stack.length === 0) {
          const pos = this.axialToPixel(cell.q, cell.r);
          return {
            cellKey: cell.key,
            q: cell.q,
            r: cell.r,
            x: pos.x,
            y: pos.y,
            discs: slot.discs
          };
        }
      }
      return null;
    }

    drawNeighborMatchPreview(ctx, previewInfo, now, pillOnly = false) {
      const topCol = getTopColor(previewInfo.discs);
      const matches = this.getMatchingNeighbors(previewInfo.q, previewInfo.r, topCol);
      if (matches.length === 0) return;

      const colorObj = this.getDiscColorMeta(topCol);
      const pulse = 0.72 + 0.28 * Math.sin(now * 0.012);
      const stackHeightPx = (previewInfo.discs.length - 1) * this.discThickness;
      const targetTopY = previewInfo.y - stackHeightPx;

      let totalCombined = getTopContiguousCount(previewInfo.discs);
      matches.forEach((nCell) => {
        totalCombined += getTopContiguousCount(nCell.stack);
      });

      ctx.save();
      if (!pillOnly) {
        matches.forEach((nCell) => {
          const nPos = this.axialToPixel(nCell.q, nCell.r);
          const nTopY = nPos.y - (nCell.stack.length - 1) * this.discThickness;

          this.traceIsoHex(
            ctx,
            nPos.x,
            nTopY,
            this.hexRadius * 0.92,
            this.hexRadius * 0.92 * Y_TILT,
            0.2
          );
          ctx.strokeStyle = '#FFFDF7';
          ctx.lineWidth = 4;
          ctx.stroke();
          ctx.strokeStyle = colorObj.top;
          ctx.lineWidth = 2.2;
          ctx.stroke();

          const midX = (nPos.x + previewInfo.x) * 0.5;
          const midY = Math.min(nTopY, targetTopY) - 20;

          ctx.beginPath();
          ctx.moveTo(nPos.x, nTopY);
          ctx.quadraticCurveTo(midX, midY, previewInfo.x, targetTopY);
          ctx.strokeStyle = '#231F20';
          ctx.lineWidth = 4.5;
          ctx.setLineDash([6, 4]);
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(nPos.x, nTopY);
          ctx.quadraticCurveTo(midX, midY, previewInfo.x, targetTopY);
          ctx.strokeStyle = colorObj.rim;
          ctx.lineWidth = 2.8 * pulse;
          ctx.setLineDash([6, 4]);
          ctx.stroke();
        });
        ctx.restore();
        return;
      }

      ctx.setLineDash([]);
      const willBurst = totalCombined >= BURST_THRESHOLD;
      // Check 2-step chain reaction foresight: if top color bursts, does the exposed sub-layer match a neighbor?
      let willChain = false;
      if (willBurst) {
        const previewGroups = getColorGroups(previewInfo.discs);
        let subColorAfterBurst = previewGroups.length > 1 ? previewGroups[previewGroups.length - 2].color : null;
        if (subColorAfterBurst === null) {
          for (const nCell of matches) {
            const nGroups = getColorGroups(nCell.stack);
            if (nGroups.length > 1) {
              subColorAfterBurst = nGroups[nGroups.length - 2].color;
              break;
            }
          }
        }
        if (subColorAfterBurst !== null) {
          const secondMatches = this.getMatchingNeighbors(previewInfo.q, previewInfo.r, subColorAfterBurst);
          if (secondMatches.length > 0) {
            willChain = true;
          }
        }
      }
      const surroundBonus =
        matches.length >= 4 ? 4 : matches.length === 3 ? 2 : matches.length === 2 ? 1 : 0;
      const extraDiscs = Math.max(0, totalCombined - BURST_THRESHOLD);
      const overstackBonus = willBurst ? Math.floor(extraDiscs / 2) : 0;
      const overdriveMult = this.overdriveMovesLeft > 0 ? 2 : 1;
      const projMult = Math.max(1, 1 + this.burstStreak + surroundBonus + overstackBonus) * overdriveMult;
      const badgeLabel = willBurst
        ? willChain
          ? `★ ${totalCombined}/10 + CHAIN ×${projMult + 1}!`
          : matches.length >= 2
          ? `★ ${totalCombined}/10 (${matches.length}-WAY · ×${projMult}!)`
          : `★ ${totalCombined}/10 BURST (×${projMult})`
        : matches.length >= 2
        ? `▲ ${totalCombined}/10 (${matches.length}-WAY · ×${projMult})`
        : `▲ ${totalCombined}/10 MERGE`;
      const dragTopY = this.dragState.active
        ? this.dragState.dragY - stackHeightPx
        : targetTopY;
      const pillY = Math.min(targetTopY, dragTopY) - (this.hexRadius * Y_TILT + 14);

      ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
      const textW = ctx.measureText(badgeLabel).width;
      const pillW = textW + 16;
      const pillH = 22;

      ctx.fillStyle = willBurst ? '#FF9F1C' : '#231F20';
      ctx.strokeStyle = '#FAF7F2';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(previewInfo.x - pillW / 2, pillY - pillH / 2, pillW, pillH, 11);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = willBurst ? '#231F20' : '#FAF7F2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeLabel, previewInfo.x, pillY + 0.5);

      ctx.restore();
    }

    drawVinylStack(ctx, baseX, baseY, discs, scaleX = 1, scaleY = 1, alpha = 1, showBadge = true) {
      if (!discs || discs.length === 0) return;

      const rx = this.hexRadius * 0.86 * scaleX;
      const ry = this.hexRadius * 0.86 * Y_TILT * scaleY;
      const dz = this.discThickness * scaleY;

      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.fillStyle = 'rgba(35, 31, 32, 0.17)';
      this.traceIsoHex(ctx, baseX, baseY + 3, rx * 1.03, ry * 1.03, 0.2);
      ctx.fill();

      for (let i = 0; i < discs.length; i++) {
        const colorId = discs[i];
        const col = this.getDiscColorMeta(colorId);
        const discY = baseY - i * dz;
        const isTopDisc = i === discs.length - 1;
        const isGroupBoundary = i === discs.length - 1 || discs[i + 1] !== colorId;

        this.drawSingleVinylDisc(ctx, baseX, discY, rx, ry, dz, col, isTopDisc, isGroupBoundary);
      }

      if (showBadge && discs.length > 0) {
        const topCount = getTopContiguousCount(discs);
        const groups = getColorGroups(discs);
        const subColorMeta =
          groups.length > 1 ? this.getDiscColorMeta(groups[groups.length - 2].color) : null;
        const topDiscY = baseY - (discs.length - 1) * dz;
        this.drawStackCountBadge(ctx, baseX, topDiscY, rx, ry, topCount, subColorMeta);
      }

      ctx.restore();
    }

    drawSingleVinylDisc(ctx, cx, cy, rx, ry, dz, col, isTopDisc, isGroupBoundary) {
      const wallDepth = dz * 0.96;
      const kit = this.getEquippedCosmeticKit();
      const discStyle = kit.discStyle || 'classic';
      const cornerSmooth =
        discStyle === 'origami'
          ? 0.02
          : discStyle === 'terracotta' || discStyle === 'gilded'
          ? 0.08
          : 0.2;
      ctx.save();

      // 1. 3D Isometric Cylindrical / Faceted Side Wall with Style-Specific Material Texture
      ctx.beginPath();
      this.traceIsoHexSideWall(ctx, cx, cy, rx, ry, wallDepth);
      if (discStyle === 'gilded') {
        ctx.fillStyle = '#B47B18';
      } else if (discStyle === 'lacquer') {
        ctx.fillStyle = '#180B0F';
      } else if (discStyle === 'astral') {
        ctx.fillStyle = '#090D20';
      } else {
        ctx.fillStyle = col.side;
      }
      ctx.fill();
      ctx.lineWidth = isGroupBoundary ? 1.55 : 1.05;
      ctx.strokeStyle =
        discStyle === 'gilded'
          ? '#FEF08A'
          : discStyle === 'astral'
          ? col.top
          : discStyle === 'lacquer'
          ? '#FFD166'
          : '#231F20';
      ctx.stroke();

      // 2. Top Surface Base Fill (Multi-Stop Gradient / Low-Poly Origami Facets / Dark-Core Cyber Hex)
      this.traceIsoHex(ctx, cx, cy, rx, ry, cornerSmooth);
      if (discStyle === 'astral') {
        // Cyber-Neon Outer Bezel with Dark Space-Obsidian Core
        ctx.fillStyle = col.top;
        ctx.fill();
        ctx.lineWidth = 1.6;
        ctx.strokeStyle = '#FFFFFF';
        ctx.stroke();
      } else if (discStyle === 'gilded') {
        // 24K Gold Bullion Outer Bezel
        const goldGrad = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
        goldGrad.addColorStop(0, '#FEF08A');
        goldGrad.addColorStop(0.5, '#F59E0B');
        goldGrad.addColorStop(1, '#B45309');
        ctx.fillStyle = goldGrad;
        ctx.fill();
        ctx.lineWidth = 1.7;
        ctx.strokeStyle = '#78350F';
        ctx.stroke();
      } else if (discStyle === 'origami') {
        ctx.fillStyle = col.top;
        ctx.fill();
        ctx.lineWidth = 1.45;
        ctx.strokeStyle = '#14213D';
        ctx.stroke();
      } else {
        const topGrad = ctx.createRadialGradient(
          cx - rx * 0.25,
          cy - ry * 0.28,
          rx * 0.08,
          cx,
          cy,
          rx * 1.05
        );
        topGrad.addColorStop(0, col.topHighlight || col.rim || col.top);
        topGrad.addColorStop(0.58, col.top);
        topGrad.addColorStop(1, col.topShadow || col.side || col.top);
        ctx.fillStyle = topGrad;
        ctx.fill();
        ctx.lineWidth = discStyle === 'lacquer' ? 1.7 : 1.4;
        ctx.strokeStyle = discStyle === 'lacquer' ? '#FFD166' : col.border || '#231F20';
        ctx.stroke();
      }

      if (isTopDisc) {
        // 3. Drastic Style-Specific Surface Texture, Geometry & Center Graphics
        if (discStyle === 'botanical') {
          // Carved Cedar Wood-Slice & Leaf Tiles: Concentric annual wood-grain rings + 6 leaf veins
          for (let ringIdx = 0; ringIdx < 3; ringIdx++) {
            const sc = 0.88 - ringIdx * 0.11;
            this.traceIsoHex(ctx, cx, cy, rx * sc, ry * sc, 0.2);
            ctx.lineWidth = ringIdx === 0 ? 1.8 : 1.15;
            ctx.strokeStyle = ringIdx % 2 === 0 ? 'rgba(62, 34, 14, 0.55)' : 'rgba(255, 251, 235, 0.65)';
            ctx.stroke();
          }
          // 6 carved botanical leaf-vein ribs
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(cx + rx * 0.54 * Math.cos(a), cy + ry * 0.54 * Math.sin(a));
            ctx.lineTo(cx + rx * 0.88 * Math.cos(a), cy + ry * 0.88 * Math.sin(a));
            ctx.lineWidth = 1.4;
            ctx.strokeStyle = 'rgba(255, 251, 235, 0.68)';
            ctx.stroke();
          }
          // Scalloped 6-petal flower well
          ctx.fillStyle = '#3B2313';
          ctx.strokeStyle = '#FDE68A';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          for (let p = 0; p < 12; p++) {
            const rad = p % 2 === 0 ? 0.56 : 0.44;
            const ang = (p * Math.PI) / 6;
            const px = cx + rx * rad * Math.cos(ang);
            const py = cy + ry * rad * Math.sin(ang);
            if (p === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (discStyle === 'lacquer') {
          // Black & Vermilion Urushi Lacquer + Gold Maki-e Tiles
          // Jet-black inner lacquer ring with golden maki-e rays
          this.traceIsoHex(ctx, cx, cy, rx * 0.86, ry * 0.86, 0.16);
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = '#FFD166';
          ctx.stroke();

          // Diagonal high-gloss mirror reflection ribbon
          ctx.save();
          this.traceIsoHex(ctx, cx, cy, rx * 0.85, ry * 0.85, 0.16);
          ctx.clip();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.36)';
          ctx.beginPath();
          ctx.moveTo(cx - rx * 0.9, cy - ry * 0.25);
          ctx.lineTo(cx + rx * 0.2, cy - ry * 0.95);
          ctx.lineTo(cx + rx * 0.55, cy - ry * 0.75);
          ctx.lineTo(cx - rx * 0.55, cy + ry * 0.05);
          ctx.closePath();
          ctx.fill();
          ctx.restore();

          // 6 Golden Shrine Torii studs on corners
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            ctx.fillStyle = '#FFD166';
            ctx.beginPath();
            ctx.arc(cx + rx * 0.72 * Math.cos(a), cy + ry * 0.72 * Math.sin(a), 2.1, 0, Math.PI * 2);
            ctx.fill();
          }

          // Jet-black Urushi center seal well with gold rim
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx * 0.54, ry * 0.54, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#14080B';
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#FFD166';
          ctx.stroke();
        } else if (discStyle === 'astral') {
          // Cyber-Neon Plasma & Dark Space-Obsidian Hex Pods
          // Inner dark space core occupying 84% of tile so it looks like a glowing neon sci-fi pod!
          this.traceIsoHex(ctx, cx, cy, rx * 0.83, ry * 0.83, 0.12);
          ctx.fillStyle = '#090D20';
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = col.top;
          ctx.stroke();

          // Glowing neon circuit traces from center to all 6 corners + corner LEDs
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(cx + rx * 0.45 * Math.cos(a), cy + ry * 0.45 * Math.sin(a));
            ctx.lineTo(cx + rx * 0.78 * Math.cos(a), cy + ry * 0.78 * Math.sin(a));
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = col.top;
            ctx.stroke();

            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(cx + rx * 0.73 * Math.cos(a), cy + ry * 0.73 * Math.sin(a), 1.9, 0, Math.PI * 2);
            ctx.fill();
          }

          // Inner holo-hex reticle
          this.traceIsoHex(ctx, cx, cy, rx * 0.52, ry * 0.52, 0.08);
          ctx.fillStyle = col.top;
          ctx.fill();
          ctx.lineWidth = 1.4;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();
        } else if (discStyle === 'matcha') {
          // Crackle-Glaze Raku Ceramic & Sakura Wagashi Tiles
          // Branching dark Raku ceramic crackle web across the glazed surface
          ctx.strokeStyle = 'rgba(58, 43, 32, 0.58)';
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(cx - rx * 0.82, cy - ry * 0.22);
          ctx.lineTo(cx - rx * 0.35, cy + ry * 0.08);
          ctx.lineTo(cx - rx * 0.55, cy + ry * 0.58);
          ctx.moveTo(cx + rx * 0.78, cy - ry * 0.32);
          ctx.lineTo(cx + rx * 0.32, cy - ry * 0.05);
          ctx.lineTo(cx + rx * 0.62, cy + ry * 0.48);
          ctx.moveTo(cx - rx * 0.15, cy - ry * 0.85);
          ctx.lineTo(cx + rx * 0.18, cy - ry * 0.42);
          ctx.stroke();

          this.traceIsoHex(ctx, cx, cy, rx * 0.86, ry * 0.86, 0.22);
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = '#FAF3E0';
          ctx.stroke();

          // Cream 5-Petal Sakura Wagashi Blossom center well (instead of dark circle!)
          ctx.fillStyle = '#FAF3E0';
          ctx.strokeStyle = '#3A2B20';
          ctx.lineWidth = 1.35;
          ctx.beginPath();
          for (let p = 0; p < 10; p++) {
            const rad = p % 2 === 0 ? 0.58 : 0.42;
            const ang = (p * Math.PI) / 5 - Math.PI / 2;
            const px = cx + rx * rad * Math.cos(ang);
            const py = cy + ry * rad * Math.sin(ang);
            if (p === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (discStyle === 'terracotta') {
          // Chiseled Aztec/Canyon Stone & Turquoise Inlay Tablets
          this.traceIsoHex(ctx, cx, cy, rx * 0.84, ry * 0.84, 0.06);
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#FCD34D';
          ctx.stroke();

          // 12 chiseled sunstone ray notches + 6 Turquoise corner inlays
          for (let k = 0; k < 12; k++) {
            const ang = (k * Math.PI) / 6;
            ctx.beginPath();
            ctx.moveTo(cx + rx * 0.64 * Math.cos(ang), cy + ry * 0.64 * Math.sin(ang));
            ctx.lineTo(cx + rx * 0.86 * Math.cos(ang), cy + ry * 0.86 * Math.sin(ang));
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#36120A';
            ctx.stroke();
            if (k % 2 === 0) {
              ctx.fillStyle = '#2EC4B6';
              ctx.beginPath();
              ctx.arc(cx + rx * 0.74 * Math.cos(ang), cy + ry * 0.74 * Math.sin(ang), 2.1, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Stepped Diamond Stone Altar Well
          ctx.fillStyle = '#2C120A';
          ctx.strokeStyle = '#FCD34D';
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(cx, cy - ry * 0.58);
          ctx.lineTo(cx + rx * 0.58, cy);
          ctx.lineTo(cx, cy + ry * 0.58);
          ctx.lineTo(cx - rx * 0.58, cy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (discStyle === 'nocturne') {
          // Gothic Stained-Glass & Moon-Gold Tarot Tiles
          // 6 golden lead-came stained-glass ribs radiating to vertices
          for (let k = 0; k < 6; k++) {
            const ang = (k * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + rx * 0.92 * Math.cos(ang), cy + ry * 0.92 * Math.sin(ang));
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#FDE047';
            ctx.stroke();
          }
          this.traceIsoHex(ctx, cx, cy, rx * 0.85, ry * 0.85, 0.16);
          ctx.lineWidth = 1.7;
          ctx.strokeStyle = '#FDE047';
          ctx.stroke();

          // 8-Point Celestial Tarot Starburst Medallion Well
          ctx.fillStyle = '#120721';
          ctx.strokeStyle = '#FDE047';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          for (let p = 0; p < 16; p++) {
            const rad = p % 2 === 0 ? 0.58 : 0.44;
            const ang = (p * Math.PI) / 8;
            const px = cx + rx * rad * Math.cos(ang);
            const py = cy + ry * rad * Math.sin(ang);
            if (p === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (discStyle === 'clockwork') {
          // 12-Tooth Brass Gear Cog & Watchmaker Copper Dial Tiles
          // Outer brass gear teeth ring
          ctx.strokeStyle = '#FEF08A';
          ctx.fillStyle = '#D97706';
          for (let k = 0; k < 12; k++) {
            const ang = (k * Math.PI) / 6;
            const gx = cx + rx * 0.8 * Math.cos(ang);
            const gy = cy + ry * 0.8 * Math.sin(ang);
            ctx.beginPath();
            ctx.arc(gx, gy, 2.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 0.9;
            ctx.stroke();
          }
          this.traceIsoHex(ctx, cx, cy, rx * 0.82, ry * 0.82, 0.16);
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = '#FDE047';
          ctx.stroke();

          // Brass Clock-Dial Center Hub
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx * 0.55, ry * 0.55, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#291B0C';
          ctx.fill();
          ctx.lineWidth = 2.0;
          ctx.strokeStyle = '#F59E0B';
          ctx.stroke();
        } else if (discStyle === 'reef') {
          // Iridescent Mother-of-Pearl & Sea-Glass Tiles
          // 2 curved ocean wave ripple ribbons + floating pearl bubbles
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.78)';
          ctx.lineWidth = 1.9;
          ctx.beginPath();
          ctx.arc(cx - rx * 0.15, cy - ry * 0.15, rx * 0.62, -Math.PI * 0.85, -Math.PI * 0.15);
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(cx + rx * 0.15, cy + ry * 0.18, rx * 0.58, Math.PI * 0.15, Math.PI * 0.85);
          ctx.stroke();

          ctx.fillStyle = '#FFFFFF';
          ctx.beginPath();
          ctx.arc(cx - rx * 0.56, cy + ry * 0.18, 2.2, 0, Math.PI * 2);
          ctx.arc(cx + rx * 0.58, cy - ry * 0.22, 1.8, 0, Math.PI * 2);
          ctx.fill();

          // Luminous Pearl Nacre Center Well
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx * 0.54, ry * 0.54, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#083344';
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#A5F3FC';
          ctx.stroke();
        } else if (discStyle === 'origami') {
          // 6-Facet Low-Poly Folded Washi Paper Tiles!
          // Draw 6 distinct shaded triangular facets radiating from center vertex
          const facetTones = [
            col.topHighlight || col.rim,
            col.top,
            col.topShadow || col.side,
            col.topHighlight || col.rim,
            col.top,
            col.topShadow || col.side
          ];
          for (let k = 0; k < 6; k++) {
            const a1 = ((k * 60 - 30) * Math.PI) / 180;
            const a2 = (((k + 1) * 60 - 30) * Math.PI) / 180;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(cx + rx * 0.94 * Math.cos(a1), cy + ry * 0.94 * Math.sin(a1));
            ctx.lineTo(cx + rx * 0.94 * Math.cos(a2), cy + ry * 0.94 * Math.sin(a2));
            ctx.closePath();
            ctx.fillStyle = facetTones[k];
            ctx.fill();
            ctx.lineWidth = 1.15;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.72)';
            ctx.stroke();
          }
          // Crisp folded hexagonal paper inner badge
          this.traceIsoHex(ctx, cx, cy, rx * 0.54, ry * 0.54, 0.02);
          ctx.fillStyle = '#14213D';
          ctx.fill();
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = '#FFFFFF';
          ctx.stroke();
        } else if (discStyle === 'gilded') {
          // 24K Gold-Bullion Bezel & Faceted Royal Jewel Tiles
          // Inner faceted gemstone hex inside the thick 24K gold outer frame
          this.traceIsoHex(ctx, cx, cy, rx * 0.78, ry * 0.78, 0.08);
          ctx.fillStyle = col.top;
          ctx.fill();
          ctx.lineWidth = 1.8;
          ctx.strokeStyle = '#FEF08A';
          ctx.stroke();

          // Gemstone facet rays
          for (let k = 0; k < 6; k++) {
            const a = (k * Math.PI) / 3;
            ctx.beginPath();
            ctx.moveTo(cx + rx * 0.48 * Math.cos(a), cy + ry * 0.48 * Math.sin(a));
            ctx.lineTo(cx + rx * 0.78 * Math.cos(a), cy + ry * 0.78 * Math.sin(a));
            ctx.lineWidth = 1.3;
            ctx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
            ctx.stroke();
          }

          // Royal Crown Jewel Setting Well
          this.traceIsoHex(ctx, cx, cy, rx * 0.5, ry * 0.5, 0.08);
          ctx.fillStyle = '#1C1308';
          ctx.fill();
          ctx.lineWidth = 1.6;
          ctx.strokeStyle = '#FEF08A';
          ctx.stroke();
        } else {
          // Classic Studio Birch Matte Vinyl
          this.traceIsoHex(ctx, cx, cy, rx * 0.86, ry * 0.86, 0.2);
          ctx.lineWidth = 1.1;
          ctx.strokeStyle = col.rim;
          ctx.stroke();

          ctx.beginPath();
          ctx.ellipse(cx, cy, rx * 0.54, ry * 0.54, 0, 0, Math.PI * 2);
          ctx.fillStyle = col.side;
          ctx.fill();
          ctx.lineWidth = 1.15;
          ctx.strokeStyle = 'rgba(35, 31, 32, 0.45)';
          ctx.stroke();
        }

        const stampScale = this.settings.colorblindMode ? 0.46 : 0.37;
        this.drawEmbossedStamp(ctx, cx, cy, rx * stampScale, ry * stampScale, col, discStyle);
      }

      ctx.restore();
    }

    traceIsoHexSideWall(ctx, cx, cy, rx, ry, depth) {
      const angles = [-30, 30, 90, 150, 210].map((deg) => (deg * Math.PI) / 180);
      const topPts = angles.map((a) => ({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) }));
      const botPts = angles.map((a) => ({
        x: cx + rx * Math.cos(a),
        y: cy + ry * Math.sin(a) + depth
      }));

      ctx.moveTo(topPts[0].x, topPts[0].y);
      for (let i = 1; i < topPts.length; i++) {
        ctx.lineTo(topPts[i].x, topPts[i].y);
      }
      for (let i = botPts.length - 1; i >= 0; i--) {
        ctx.lineTo(botPts[i].x, botPts[i].y);
      }
      ctx.closePath();
    }

    drawEmbossedStamp(ctx, cx, cy, sx, sy, col, discStyle = 'classic') {
      ctx.save();
      ctx.fillStyle =
        discStyle === 'matcha'
          ? col.top
          : discStyle === 'lacquer' || discStyle === 'gilded'
          ? '#FEF08A'
          : col.ink;
      ctx.strokeStyle =
        discStyle === 'astral'
          ? '#090D20'
          : discStyle === 'matcha'
          ? '#3A2B20'
          : '#231F20';
      ctx.lineWidth = this.settings.colorblindMode ? 1.85 : 1.4;
      ctx.lineJoin = 'round';

      ctx.beginPath();
      switch (col.stamp) {
        case 'circle': {
          ctx.ellipse(cx, cy, sx * 0.82, sy * 0.82, 0, 0, Math.PI * 2);
          break;
        }
        case 'triangle': {
          const angles = [-90, 30, 150].map((d) => (d * Math.PI) / 180);
          angles.forEach((a, idx) => {
            const px = cx + sx * 0.96 * Math.cos(a);
            const py = cy + sy * 0.96 * Math.sin(a);
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          break;
        }
        case 'diamond': {
          ctx.moveTo(cx, cy - sy * 0.98);
          ctx.lineTo(cx + sx * 0.94, cy);
          ctx.lineTo(cx, cy + sy * 0.98);
          ctx.lineTo(cx - sx * 0.94, cy);
          ctx.closePath();
          break;
        }
        case 'cross': {
          const w = sx * 0.35;
          const h = sy * 0.35;
          const Lx = sx * 0.94;
          const Ly = sy * 0.94;
          ctx.moveTo(cx - w, cy - Ly);
          ctx.lineTo(cx + w, cy - Ly);
          ctx.lineTo(cx + w, cy - h);
          ctx.lineTo(cx + Lx, cy - h);
          ctx.lineTo(cx + Lx, cy + h);
          ctx.lineTo(cx + w, cy + h);
          ctx.lineTo(cx + w, cy + Ly);
          ctx.lineTo(cx - w, cy + Ly);
          ctx.lineTo(cx - w, cy + h);
          ctx.lineTo(cx - Lx, cy + h);
          ctx.lineTo(cx - Lx, cy - h);
          ctx.lineTo(cx - w, cy - h);
          ctx.closePath();
          break;
        }
        case 'star': {
          for (let i = 0; i < 10; i++) {
            const rFactor = i % 2 === 0 ? 1.02 : 0.45;
            const angle = ((i * 36 - 90) * Math.PI) / 180;
            const px = cx + sx * rFactor * Math.cos(angle);
            const py = cy + sy * rFactor * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
        }
        case 'hexagon':
        default: {
          for (let i = 0; i < 6; i++) {
            const angle = ((i * 60) * Math.PI) / 180;
            const px = cx + sx * 0.92 * Math.cos(angle);
            const py = cy + sy * 0.92 * Math.sin(angle);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          break;
        }
      }

      ctx.fill();
      ctx.stroke();

      // Add a crisp inner jewel/pip detail inside the emblem when a figurine is equipped!
      if (discStyle !== 'classic') {
        ctx.fillStyle =
          discStyle === 'lacquer' || discStyle === 'gilded'
            ? col.top
            : discStyle === 'matcha'
            ? '#FAF3E0'
            : col.figAccent || '#FFD166';
        ctx.beginPath();
        ctx.ellipse(cx, cy, sx * 0.26, sy * 0.26, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    drawStackCountBadge(ctx, cx, cy, rx, ry, topCount, subColorMeta = null) {
      const bx = cx + rx * 0.36;
      const by = cy - ry * 0.32;
      const isNearBurst = topCount >= 7;
      const label = isNearBurst ? `${topCount}/10` : `${topCount}`;
      const hasSubDot = !!subColorMeta;

      ctx.save();
      ctx.font = '800 9.5px "Plus Jakarta Sans", sans-serif';
      const textW = ctx.measureText(label).width;
      const pillW = Math.max(16, textW + 9);
      const pillH = hasSubDot ? 16 : 14;

      ctx.fillStyle = isNearBurst ? '#FF9F1C' : '#231F20';
      ctx.strokeStyle = '#FAF7F2';
      ctx.lineWidth = 1.4;

      ctx.beginPath();
      ctx.roundRect(bx - pillW / 2, by - pillH / 2, pillW, pillH, 6);
      ctx.fill();
      ctx.stroke();

      if (hasSubDot) {
        ctx.fillStyle = subColorMeta.top;
        ctx.beginPath();
        ctx.roundRect(bx - pillW / 2 + 2.5, by + pillH / 2 - 4, pillW - 5, 2.5, 1.5);
        ctx.fill();
      }

      ctx.fillStyle = isNearBurst ? '#231F20' : '#FAF7F2';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, bx, by + (hasSubDot ? -1 : 0.5));
      ctx.restore();
    }

    drawFlyingDisc(ctx, fd) {
      const col = this.getDiscColorMeta(fd.color);
      const rx = this.hexRadius * 0.86;
      const tiltScale = Math.max(0.32, Math.abs(Math.cos(fd.flip * Math.PI * 0.65)));
      const ry = this.hexRadius * 0.86 * Y_TILT * tiltScale;

      ctx.save();
      ctx.fillStyle = 'rgba(35, 31, 32, 0.14)';
      ctx.beginPath();
      ctx.ellipse(fd.x, fd.y + 4, rx * 0.72, rx * 0.72 * Y_TILT, 0, 0, Math.PI * 2);
      ctx.fill();

      this.drawSingleVinylDisc(
        ctx,
        fd.x,
        fd.y - fd.z,
        rx * 1.04,
        ry * 1.04,
        this.discThickness,
        col,
        true,
        true
      );
      ctx.restore();
    }

    drawPoppingDisc(ctx, pd) {
      const p = Math.min(1, pd.life / pd.maxLife);
      const scale = 1 + 0.34 * p;
      const liftY = pd.y - 18 * p;
      const alpha = 1 - p;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      this.traceIsoHex(ctx, pd.x, liftY, pd.rx * scale, pd.ry * scale, 0.2);
      ctx.fillStyle = pd.rim;
      ctx.fill();
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = '#FFFDF7';
      ctx.stroke();
      ctx.restore();
    }

    drawObjectiveFlyingDisc(ctx, od) {
      ctx.save();
      const r = 10 * (od.scale || 1);
      ctx.fillStyle = od.color;
      ctx.strokeStyle = '#231F20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(od.x, od.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    /**
     * Renders the 3-Slot + 4th Extra Staging Slot Wooden Atelier Dispenser Tray
     */
    drawDispenserTray(ctx, now) {
      const trayW = Math.min(this.width * 0.94, 366);
      const trayH = Math.max(88, Math.min(108, this.height * 0.18));
      const reachShift =
        this.settings.thumbReach === 'left' ? -14 : this.settings.thumbReach === 'right' ? 14 : 0;
      const centerBaseX = this.baseBoardCenterX || this.width * 0.5;
      const trayX = centerBaseX - trayW / 2 + reachShift;
      const trayTop = this.trayY - trayH * 0.54;
      const kit = this.getEquippedCosmeticKit();

      ctx.save();
      // Drop shadow under dispenser tray
      ctx.fillStyle = kit.isDarkStage ? 'rgba(0, 0, 0, 0.34)' : 'rgba(80, 55, 30, 0.12)';
      ctx.beginPath();
      ctx.roundRect(trayX, trayTop + 8, trayW, trayH, 28);
      ctx.fill();

      // Themed tray lip
      ctx.fillStyle = kit.trayLip || '#E6D9C4';
      ctx.beginPath();
      ctx.roundRect(trayX, trayTop + 5, trayW, trayH, 28);
      ctx.fill();

      // Themed tray deck
      ctx.fillStyle = kit.trayDeck || '#FFFFFF';
      ctx.strokeStyle = kit.rimStroke || '#5C4028';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(trayX, trayTop, trayW, trayH, 28);
      ctx.fill();
      ctx.stroke();

      const baseR = this.baseHexRadius || this.hexRadius;
      const slotR = Math.min(28, baseR * 0.86);

      // 3 Primary Dispenser Slots + 4th Extra Staging Slot
      for (let i = 0; i < 4; i++) {
        const pos = this.traySlotPositions[i];
        const isExtraSlot = i === 3;
        const isLockedExtra = isExtraSlot && !this.extraSlotUnlocked;
        const isDragged = this.dragState.active && this.dragState.trayIndex === i;
        const isSelected = !this.dragState.active && this.selectedTrayIndex === i;

        ctx.save();
        if (isLockedExtra) {
          ctx.setLineDash([4, 3]);
          ctx.fillStyle = 'rgba(255, 248, 225, 0.72)';
          ctx.strokeStyle = '#CC7A00';
          ctx.lineWidth = 1.8;
        } else {
          ctx.fillStyle = isSelected ? kit.snapFill || '#D9F4EE' : kit.traySlotFill || '#FAF7F2';
          ctx.strokeStyle = isSelected ? kit.snapStroke || '#00A896' : kit.traySlotStroke || '#B89B72';
          ctx.lineWidth = isSelected ? 2.5 : 1.6;
        }

        this.traceIsoHex(ctx, pos.x, pos.y - 2, slotR, slotR * Y_TILT, 0.18);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.textAlign = 'center';

        if (isLockedExtra) {
          const extraImg = this.spriteCache['assets/art/icon_extraslot.png'];
          if (extraImg && extraImg.complete && extraImg.naturalWidth > 0) {
            ctx.drawImage(extraImg, pos.x - 15, pos.y - 17, 30, 30);
          } else {
            ctx.fillStyle = '#231F20';
            ctx.font = '800 13px "Plus Jakarta Sans", sans-serif';
            ctx.fillText('✚', pos.x, pos.y - 3);
          }
        } else {
          const slot = this.tray[i];
          if (slot && slot.discs && slot.discs.length > 0 && !isDragged) {
            const floatOffset = isSelected ? -7 + Math.sin(now * 0.008) * 2.5 : slot.offsetY || 0;
            const sc = (slot.scale || 1) * (slotR / (this.hexRadius * 0.86));
            this.drawVinylStack(
              ctx,
              pos.x,
              pos.y - 4 + floatOffset,
              slot.discs,
              sc,
              sc,
              1.0,
              true
            );
          }
        }
        ctx.restore();
      }

      ctx.restore();
    }

    drawStepDebugOverlay(ctx, hint) {
      ctx.save();
      const recCell = this.cells.get(hint.receiverKey);
      if (recCell) {
        const rPos = this.axialToPixel(recCell.q, recCell.r);
        ctx.strokeStyle = '#FF5A5F';
        ctx.lineWidth = 3;
        this.traceIsoHex(ctx, rPos.x, rPos.y, this.hexRadius * 1.02, this.hexRadius * 1.02 * Y_TILT);
        ctx.stroke();

        hint.donors.forEach((dKey) => {
          const dCell = this.cells.get(dKey);
          if (!dCell) return;
          const dPos = this.axialToPixel(dCell.q, dCell.r);
          ctx.strokeStyle = '#231F20';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(dPos.x, dPos.y - 18);
          ctx.lineTo(rPos.x, rPos.y - 18);
          ctx.stroke();
        });
      }
      ctx.restore();
    }

    drawEffects(ctx) {
      for (let i = 0; i < this.shockwaves.length; i++) {
        const sw = this.shockwaves[i];
        ctx.save();
        ctx.globalAlpha = sw.alpha;
        ctx.strokeStyle = sw.color;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.ellipse(sw.x, sw.y, sw.radius, sw.radius * Y_TILT, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      for (let i = 0; i < this.particles.length; i++) {
        const pt = this.particles[i];
        const alpha = 1 - pt.life / pt.maxLife;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rotation);
        ctx.fillStyle = pt.color;
        ctx.strokeStyle = '#231F20';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.roundRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.7, 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      for (let i = 0; i < this.floatingTexts.length; i++) {
        const ft = this.floatingTexts[i];
        const p = ft.life / ft.maxLife;
        const alpha = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.textAlign = 'center';

        ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
        ctx.strokeStyle = '#231F20';
        ctx.lineWidth = 4;
        ctx.strokeText(ft.text, ft.x, ft.y);
        ctx.fillStyle = '#FFFDF7';
        ctx.fillText(ft.text, ft.x, ft.y);

        if (ft.subText) {
          ctx.font = '800 10.5px "Plus Jakarta Sans", sans-serif';
          ctx.strokeStyle = '#231F20';
          ctx.lineWidth = 3;
          ctx.strokeText(ft.subText, ft.x, ft.y - 18);
          ctx.fillStyle = '#FF9F1C';
          ctx.fillText(ft.subText, ft.x, ft.y - 18);
        }
        ctx.restore();
      }
    }

    // -------------------------------------------------------------------------
    // 360° 3D Turntable Canvas Renderer (Inspector & Unboxing Pedestals)
    // -------------------------------------------------------------------------
    renderTurntableCanvases(now) {
      // Drives the 3D tilt + specular sweep of trophies shown in the inspector and unbox reveal.
      const inspectorModal = document.getElementById('turntable-modal');
      const unboxModal = document.getElementById('unboxing-modal');
      const inspectorOpen = inspectorModal && !inspectorModal.classList.contains('hidden');
      const unboxOpen = unboxModal && !unboxModal.classList.contains('hidden');
      if (!inspectorOpen && !unboxOpen) return;

      const reduced = this.settings.reducedMotion;
      const sway = reduced ? 0 : Math.sin(now * 0.0011) * 14;
      if (typeof this.turntableTilt !== 'number') this.turntableTilt = 0;
      if (!this.turntableDragging) this.turntableTilt += (sway - this.turntableTilt) * 0.06;

      const apply = (stage, tilt) => {
        if (!stage) return;
        stage.style.setProperty('--tilt', `${tilt.toFixed(2)}deg`);
        stage.style.setProperty('--shine-x', `${(50 - tilt * 3).toFixed(1)}%`);
      };
      if (inspectorOpen) apply(inspectorModal.querySelector('.trophy-stage'), this.turntableTilt);
      if (unboxOpen) apply(unboxModal.querySelector('.trophy-stage'), sway);
    }

    drawFigurineOnTurntable(canvas, fig, angle, now) {
      if (!fig) return;
      const ctx = canvas.getContext('2d');
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h * 0.79;

      ctx.clearRect(0, 0, w, h);
      ctx.save();

      // 0. Ambient shadow under turntable
      ctx.fillStyle = 'rgba(35, 31, 32, 0.16)';
      ctx.beginPath();
      ctx.ellipse(cx, cy + 13, 76, 21, 0, 0, Math.PI * 2);
      ctx.fill();

      // 1. Rotating 3D Brass Turntable Platter
      ctx.fillStyle = '#8C6223';
      ctx.strokeStyle = '#231F20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy + 8, 72, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = this.turntableGlaze === 'gold' ? '#F4B942' : '#D4A349';
      ctx.strokeStyle = '#231F20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, 72, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Rotating degree ticks on turntable rim
      for (let i = 0; i < 12; i++) {
        const a = angle + (i * Math.PI) / 6;
        const tx = cx + Math.cos(a) * 60;
        const ty = cy + Math.sin(a) * 16;
        ctx.fillStyle = i % 3 === 0 ? '#FFFDF7' : '#231F20';
        ctx.beginPath();
        ctx.arc(tx, ty, i % 3 === 0 ? 2.5 : 1.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // 2. Stacked 2-Tier 3D Vinyl Pedestal Discs under Figurine
      ctx.fillStyle = fig.secondaryColor;
      ctx.strokeStyle = '#231F20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 5, 52, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = fig.primaryColor;
      ctx.strokeStyle = '#231F20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy - 11, 42, 11.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // 3. Sculpted Circular Collector Medallion & Glass Cloche Dome (crops out rectangular cubby walls)
      const img = this.spriteCache[getFigurineSpriteUrl(fig)];
      const wobbleX = Math.cos(angle) * 0.12 + 0.88;
      const floatY = Math.sin(now * 0.004) * 2.5;
      const domeY = cy - 68 + floatY;
      const domeR = 45;

      ctx.save();
      ctx.translate(cx, domeY);

      // 3D Outer Vinyl Bezel Shadow
      ctx.fillStyle = '#231F20';
      ctx.beginPath();
      ctx.arc(0, 4, domeR + 5, 0, Math.PI * 2);
      ctx.fill();

      // 3D Outer Vinyl Bezel Ring in Figurine Primary Color
      ctx.fillStyle = this.turntableGlaze === 'gold' ? '#F4B942' : fig.primaryColor;
      ctx.strokeStyle = '#231F20';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, domeR + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner Accent Bevel Ring
      ctx.strokeStyle = fig.accentColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, domeR, 0, Math.PI * 2);
      ctx.stroke();

      // Circular Clipping Mask for Character Portrait (100% hides wooden shelf edges)
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, domeR - 1.5, 0, Math.PI * 2);
      ctx.clip();

      const bgGrad = ctx.createRadialGradient(-10, -14, 6, 0, 0, domeR);
      bgGrad.addColorStop(0, '#FFFDF7');
      bgGrad.addColorStop(0.7, '#F7F1E3');
      bgGrad.addColorStop(1, fig.secondaryColor);
      ctx.fillStyle = bgGrad;
      ctx.fillRect(-domeR, -domeR, domeR * 2, domeR * 2);

      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.scale(wobbleX, 1);
        // Zoom 1.38x onto center character so outer wooden shelf box from sprite is completely cropped out
        ctx.drawImage(img, -62, -62, 124, 124);
        ctx.restore();
      }

      // Dynamic Glaze Sheen & Glass Cloche Specular Reflection
      if (this.turntableGlaze === 'gloss' || this.turntableGlaze === 'gold') {
        const sheenX = Math.sin(angle * 2) * 32;
        const grad = ctx.createLinearGradient(sheenX - 22, -46, sheenX + 22, 46);
        grad.addColorStop(0, 'rgba(255,255,255,0)');
        grad.addColorStop(
          0.5,
          this.turntableGlaze === 'gold'
            ? 'rgba(255, 215, 0, 0.42)'
            : 'rgba(255, 255, 255, 0.38)'
        );
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(-domeR, -domeR, domeR * 2, domeR * 2);
      }

      // Top-left curved glass highlight arc
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(0, 0, domeR - 6, -Math.PI * 0.82, -Math.PI * 0.38);
      ctx.stroke();

      ctx.restore(); // end circular clip

      // Orbiting 3D Motif Stamp Seal on upper-right rim
      const sealX = domeR * 0.74;
      const sealY = -domeR * 0.72;
      ctx.fillStyle = fig.secondaryColor;
      ctx.strokeStyle = '#231F20';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sealX, sealY, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFDF7';
      ctx.font = '800 11px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.getFigurineMotifSymbol(fig.stampMotif), sealX, sealY + 0.5);

      ctx.restore(); // end dome translate

      // 4. Front Brass Collector Serial Plaque on Turntable Base
      const serialNum = '#' + fig.id.replace('fig-', '');
      const plaqueText = `${serialNum} · ${fig.rarity.toUpperCase()}`;
      ctx.font = '800 9.5px "Plus Jakarta Sans", sans-serif';
      const pw = Math.max(76, ctx.measureText(plaqueText).width + 16);
      const ph = 17;
      ctx.fillStyle = '#231F20';
      ctx.strokeStyle = '#F4B942';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(cx - pw / 2, cy - 2, pw, ph, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#FFFDF7';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(plaqueText, cx, cy + 6.5);

      ctx.restore();
    }

    // -------------------------------------------------------------------------
    // HUD, Objective Strip, Telemetry & Debug Drawer Updates
    // -------------------------------------------------------------------------
    updateHUD() {
      const lvlBadge = document.getElementById('hud-level-badge');
      const gridBadge = document.getElementById('hud-grid-badge');
      const objCounter = document.getElementById('hud-obj-counter');
      const objFill = document.getElementById('hud-obj-fill');
      const chipsWrap = document.getElementById('hud-target-chips');
      const scoreEl = document.getElementById('hud-score');
      const clearsEl = document.getElementById('hud-clears');
      const comboEl = document.getElementById('hud-combo');

      if (lvlBadge) {
        lvlBadge.textContent = this.isDailyMode
          ? 'DAILY'
          : `LEVEL ${this.currentLevelNum}`;
      }
      if (gridBadge) {
        const slots = Catalog.getSlotsForRadius(this.gridRadius);
        gridBadge.textContent = `${slots}-SLOT`;
      }

      // Render Target Color Objective Chips
      const obj = (this.currentLevelDef && this.currentLevelDef.objective) || {
        targets: [],
        totalDiscsGoal: 30
      };
      let metSum = 0;
      let goalSum = obj.totalDiscsGoal || 30;

      if (chipsWrap && Array.isArray(obj.targets)) {
        chipsWrap.innerHTML = '';
        goalSum = 0;
        obj.targets.forEach((t) => {
          const cid = normalizeColorId(t.colorId !== undefined ? t.colorId : t.colorIndex);
          const colMeta = this.getDiscColorMeta(cid);
          const cleared = this.clearedByColor[colMeta.key] || 0;
          const clamped = Math.min(t.count, cleared);
          metSum += clamped;
          goalSum += t.count;
          const isDone = cleared >= t.count;

          const chip = document.createElement('span');
          chip.className = `target-chip ${isDone ? 'done' : ''}`;
          chip.style.backgroundColor = colMeta.top;
          chip.textContent = `${colMeta.symbol} ${clamped}/${t.count}${isDone ? '✓' : ''}`;
          chipsWrap.appendChild(chip);
        });
      }

      const pct = goalSum > 0 ? Math.min(100, Math.round((metSum / goalSum) * 100)) : 0;
      if (objCounter) objCounter.textContent = `${metSum}/${goalSum}`;
      if (objFill) objFill.style.width = `${pct}%`;

      if (scoreEl) scoreEl.textContent = this.score.toLocaleString();
      if (clearsEl) clearsEl.textContent = String(this.clears);

      const starsLiveEl = document.getElementById('hud-stars-live');
      if (starsLiveEl) {
        const bm = this.getSocialBenchmarkSafe(this.currentLevelNum, this.currentLevelDef);
        const par3 = bm.par3Moves || 8;
        const par2 = bm.par2Moves || 12;
        const m = this.movesTaken || 0;
        const liveStars = m <= par3 ? 3 : m <= par2 ? 2 : 1;
        const starStr = '★'.repeat(liveStars) + '☆'.repeat(Math.max(0, 3 - liveStars));
        const parTarget = liveStars === 3 ? par3 : liveStars === 2 ? par2 : par2;
        starsLiveEl.textContent = `${starStr} ${m}/${parTarget}`;
      }

      const multBadge = document.getElementById('hud-mult-badge');
      const overdriveFactor = this.overdriveMovesLeft > 0 ? 2 : 1;
      const liveMult = Math.max(1, this.activeMultiplier || 1, (this.combo + this.burstStreak) * overdriveFactor);
      if (multBadge) {
        multBadge.textContent = `×${liveMult}`;
        multBadge.classList.toggle('mult-hot', liveMult >= 2);
      }

      const feverRow = document.getElementById('hud-fever-row');
      const feverLabel = document.getElementById('hud-fever-label');
      const feverFill = document.getElementById('hud-fever-fill');
      if (feverRow && feverLabel && feverFill) {
        const isOverdrive = this.overdriveMovesLeft > 0;
        feverRow.classList.toggle('overdrive-active', isOverdrive);
        if (isOverdrive) {
          feverLabel.textContent = `◆ OVERDRIVE ×2 (${this.overdriveMovesLeft} MOVES)`;
          feverFill.style.width = '100%';
        } else {
          const fPct = Math.max(0, Math.min(100, Math.round(this.kilnFever || 0)));
          feverLabel.textContent = `◆ FEVER ${fPct}%`;
          feverFill.style.width = `${fPct}%`;
        }
      }

      if (comboEl) {
        if (this.overdriveMovesLeft > 0) {
          comboEl.classList.add('hidden');
        } else if (liveMult > 1) {
          comboEl.textContent =
            this.burstStreak > 0
              ? `◆ ×${liveMult} STREAK`
              : `★ ×${liveMult} COMBO`;
          comboEl.classList.remove('hidden');
        } else {
          comboEl.classList.add('hidden');
        }
      }
    }

    logCascade(entry) {
      this.cascadeLog.unshift(entry);
      if (this.cascadeLog.length > 18) this.cascadeLog.pop();
      this.updateDebugUI();
    }

    updateTelemetryDOM() {
      const dbgFps = document.getElementById('dbg-fps');
      const dbgLat = document.getElementById('dbg-latency');
      const dbgTweens = document.getElementById('dbg-tweens');

      if (dbgFps) dbgFps.textContent = `${this.telemetry.fps} FPS`;
      if (dbgLat) dbgLat.textContent = `${this.telemetry.latencyMs} ms`;
      if (dbgTweens) dbgTweens.textContent = String(this.telemetry.activeTweens);
    }

    updateDebugUI() {
      const qCount = document.getElementById('dbg-queue-count');
      const cDepth = document.getElementById('dbg-combo-depth');
      const qLog = document.getElementById('dbg-queue-log');
      const btnNext = document.getElementById('dbg-step-next');
      const btnResume = document.getElementById('dbg-step-resume');
      const lvlInput = document.getElementById('dbg-level-input');

      if (qCount) {
        const pending = this.evaluationQueue.length + (this.pausedNextAction ? 1 : 0);
        qCount.textContent = String(pending);
      }
      if (cDepth) cDepth.textContent = `x${Math.max(1, this.combo)}`;
      if (qLog) qLog.textContent = this.cascadeLog.join('\n');
      if (btnNext) btnNext.disabled = !this.pausedNextAction;
      if (btnResume) btnResume.disabled = !this.stepMode && !this.pausedNextAction;
      if (lvlInput) lvlInput.value = String(this.currentLevelNum);
    }

    // -------------------------------------------------------------------------
    // Programmatic API Helper Methods (for window.__POPSTACKS_DEBUG__)
    // -------------------------------------------------------------------------
    setCell(q, r, discsArray, options = {}) {
      const cell = this.cells.get(cellKey(q, r));
      if (!cell) return false;
      cell.stack = Array.isArray(discsArray) ? discsArray.map(normalizeColorId) : [];
      if (options.isAnvil !== undefined) cell.isAnvil = !!options.isAnvil;
      if (options.iceHp !== undefined) {
        cell.iceHp = Number(options.iceHp) || 0;
        cell.maxIceHp = Math.max(cell.maxIceHp, cell.iceHp);
      }
      cell.scaleX = 1;
      cell.scaleY = 1;
      return true;
    }

    setTray(trayArrays) {
      if (!Array.isArray(trayArrays)) return false;
      for (let i = 0; i < 3; i++) {
        const arr = trayArrays[i];
        this.tray[i] =
          Array.isArray(arr) && arr.length > 0
            ? { discs: arr.map(normalizeColorId), scale: 1, offsetY: 0 }
            : null;
      }
      return true;
    }

    getState() {
      const board = this.cellList.map((c) => {
        const pos = this.axialToPixel(c.q, c.r);
        return {
          q: c.q,
          r: c.r,
          key: c.key,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          stack: [...c.stack],
          isAnvil: c.isAnvil,
          iceHp: c.iceHp,
          topColor: getTopColor(c.stack),
          topCount: getTopContiguousCount(c.stack),
          groupCount: getColorGroups(c.stack).length
        };
      });

      const tray = this.tray.slice(0, 4).map((slot, i) => ({
        index: i,
        x: Math.round(this.traySlotPositions[i].x),
        y: Math.round(this.traySlotPositions[i].y),
        discs: slot && slot.discs ? [...slot.discs] : null,
        unlocked: i < 3 || this.extraSlotUnlocked
      }));

      return {
        activeScreen: this.activeScreen,
        level: this.currentLevelNum,
        levelName: this.currentLevelDef ? this.currentLevelDef.name : '',
        seed: this.seedString,
        gridRadius: this.gridRadius,
        slotCount: this.cellList.length,
        anvilsCount: this.cellList.filter((c) => c.isAnvil).length,
        frozenCount: this.cellList.filter((c) => c.iceHp > 0).length,
        frozenCleared: this.frozenCleared,
        movesTaken: this.movesTaken,
        par3Moves: this.currentLevelDef ? this.currentLevelDef.par3Moves : null,
        par2Moves: this.currentLevelDef ? this.currentLevelDef.par2Moves : null,
        isStaticCampaign: !!(this.currentLevelDef && this.currentLevelDef.isStaticCampaign),
        isEndless: !!(this.currentLevelDef && this.currentLevelDef.isEndless),
        staticTrayWavesCount: this.currentLevelDef && Array.isArray(this.currentLevelDef.staticTrayWaves)
          ? this.currentLevelDef.staticTrayWaves.length
          : 0,
        activeTextureStyle: this.getEquippedCosmeticKit().discStyle || 'classic',
        clearedByColor: { ...this.clearedByColor },
        totalDiscsCleared: this.totalDiscsCleared,
        isObjectiveComplete: Catalog.isObjectiveComplete(this, this.currentLevelDef),
        score: this.score,
        bestScore: this.bestScore,
        clears: this.clears,
        combo: this.combo,
        maxCombo: this.maxCombo,
        kilnFever: this.kilnFever,
        overdriveMovesLeft: this.overdriveMovesLeft,
        overdriveTotalTriggered: this.overdriveTotalTriggered,
        equippedBuddyPerk: this.getEquippedBuddyPerk(),
        adStats: {
          rewardedAdsWatched: this.adStats.rewardedAdsWatched,
          interstitialAdsShown: this.adStats.interstitialAdsShown,
          estimatedRevenueUsd: this.adStats.estimatedRevenueUsd,
          placements: { ...this.adStats.placements }
        },
        isProcessingCascade: this.isProcessingCascade,
        isDeadlocked: this.isDeadlocked,
        isLevelWon: this.isLevelWon,
        extraSlotUnlocked: this.extraSlotUnlocked,
        activeBooster: this.activeBooster,
        boardZoom: this.boardZoom,
        boardPanX: this.boardPanX,
        boardPanY: this.boardPanY,
        stepMode: this.stepMode,
        hasPausedStep: !!this.pausedNextAction,
        evaluationQueue: [...this.evaluationQueue],
        ftueStep: this.getActiveFtueStep(),
        capsuleFoundThisRound: !!this.capsuleFoundThisRound,
        profile: {
          currentLevel: this.profile.currentLevel,
          highestUnlockedLevel: this.profile.highestUnlockedLevel,
          moldProgress: this.profile.moldProgress,
          coins: this.profile.coins,
          prisms: this.profile.prisms,
          keys: this.profile.keys,
          hearts: this.profile.hearts,
          collectorPass: this.profile.collectorPass,
          equippedFigurineId: this.profile.equippedFigurineId,
          starChestsClaimed: this.profile.starChestsClaimed,
          figurineCounts: { ...this.profile.figurineCounts },
          unlockedFigurinesCount: this.profile.unlockedFigurines.length
        },
        board,
        tray,
        telemetry: {
          fps: this.telemetry.fps,
          latencyMs: this.telemetry.latencyMs,
          coldStartMs: this.telemetry.coldStartMs,
          activeTweens: this.telemetry.activeTweens,
          lastHaptic: this.audio.lastHaptic,
          muted: this.audio.muted,
          bgmPlaying: !!this.audio.bgmPlaying,
          musicTrackId: this.audio.currentTrack ? this.audio.currentTrack.id : null,
          musicTrackName: this.audio.currentTrack ? this.audio.currentTrack.trackName : null,
          musicBpm: this.audio.currentTrack ? this.audio.currentTrack.bpm : null,
          musicContextMode: this.audio.musicContextMode || 'board'
        }
      };
    }
  }

  // ===========================================================================
  // Bootstrap & Expose window.__POPSTACKS_DEBUG__
  // ===========================================================================
  window.addEventListener('DOMContentLoaded', () => {
    const game = new PopStacksGame();

    window.__POPSTACKS_DEBUG__ = {
      game,
      Catalog,
      VINYL_COLORS,
      getState: () => game.getState(),
      setScreen: (s) => game.setScreen(s),
      loadLevel: (lvl) => game.loadLevel(lvl),
      setBoardZoom: (z, px, py) => game.setBoardZoom(z, px, py),
      resetBoardZoom: () => game.resetBoardZoom(),
      advanceToNextRound: () => game.advanceToNextRound(),
      toggleMusic: () => game.audio.toggleMusic(),
      startDailyChallenge: (dateStr) => game.startDailyChallenge(dateStr),
      resetBoard: (seed, radius, options) => game.resetBoard(seed, radius, options),
      setGridRadius: (radius) => game.setGridRadius(radius),
      loadPreset: (presetName) => game.loadPreset(presetName),
      setCell: (q, r, discs, opts) => game.setCell(q, r, discs, opts),
      setTray: (trayArrays) => game.setTray(trayArrays),
      placeStack: (trayIndex, q, r, options) => game.placeStack(trayIndex, q, r, options),
      autoSolveStep: () => game.autoSolveStep(),
      autoWinLevel: () => game.autoWinLevel(),
      activateBooster: (type) => game.activateBooster(type),
      cancelBoosterMode: () => game.cancelBoosterMode(),
      triggerDeadlockModal: () => game.triggerDeadlockModal(),
      triggerLevelWinModal: () => game.triggerLevelWinModal(),
      triggerUnboxingModal: (fig, opts) => game.triggerUnboxingModal(fig, opts),
      revealBlindBoxFigurine: () => game.revealBlindBoxFigurine(),
      triggerRewardedAd: (type) => game.triggerRewardedAd(type),
      triggerInterstitialAd: (placement) => game.triggerInterstitialAd(placement),
      triggerSmartHint: () => game.triggerSmartHint(),
      chargeKilnFever: (amt) => game.chargeKilnFever(amt),
      inspectFigurine: (id) => game.inspectFigurine(id),
      equipFigurine: (id) => game.equipFigurine(id),
      claimStarMilestoneChest: () => game.claimStarMilestoneChest(),
      collectBoardCapsule: (x, y) => game.collectBoardCapsule(x, y),
      evaluateBoard: (options = {}) => {
        if (options.instant) {
          game.runInstantCascades();
        } else {
          game.processNextCascadeStep();
        }
        return game.getState();
      },
      setStepMode: (enabled) => game.setStepMode(enabled),
      stepNext: () => game.stepNext(),
      resumeCascades: () => game.resumeCascades(),
      checkDeadlock: () => game.checkDeadlock(),
      getTelemetry: () => game.getState().telemetry
    };

    window.PopStacksAds = {
      triggerRewardedAd: (placement) => game.triggerRewardedAd(placement),
      triggerInterstitialAd: (placement) => game.triggerInterstitialAd(placement),
      getAdStats: () => ({ ...game.adStats, placements: { ...game.adStats.placements } })
    };
  });
})();
