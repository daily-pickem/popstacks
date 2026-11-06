/**
 * PopStacks: Art Toy Atelier — 100-Level Campaign, Axial Grid Helpers,
 * Deterministic Tray Wave Generator, Headless Cascade Solver,
 * 60-Figurine Collectible Catalog & Daily Artisan Challenge Architect.
 *
 * Dual-environment module:
 *  - Browser: sets `window.PopStacksCatalog`
 *  - Node.js / CommonJS / ESM: exports via `module.exports` and named `exports.*`
 */
(function (root, factory) {
  const catalog = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = catalog;
    Object.keys(catalog).forEach((k) => {
      module.exports[k] = catalog[k];
    });
  }
  if (typeof window !== 'undefined') {
    window.PopStacksCatalog = catalog;
  }
  if (root && typeof root === 'object') {
    root.PopStacksCatalog = catalog;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // ===========================================================================
  // 1. Matte Vinyl Color Palette & Normalization Helpers
  // ===========================================================================
  const VINYL_COLORS = [
    {
      id: 0,
      key: 'coral',
      name: 'Coral Red',
      top: '#FF5964',
      side: '#D63B46',
      sideDark: '#A82630',
      rim: '#FF8A92',
      ink: '#FFF9F9',
      stamp: 'circle',
      symbol: '●'
    },
    {
      id: 1,
      key: 'cobalt',
      name: 'Cobalt Blue',
      top: '#386FA4',
      side: '#27527C',
      sideDark: '#1A3958',
      rim: '#699FD3',
      ink: '#F7FBFF',
      stamp: 'triangle',
      symbol: '▲'
    },
    {
      id: 2,
      key: 'mustard',
      name: 'Mustard Gold',
      top: '#F4B942',
      side: '#CA8E1D',
      sideDark: '#9B6A0F',
      rim: '#F9D37D',
      ink: '#FFFDF7',
      stamp: 'diamond',
      symbol: '◆'
    },
    {
      id: 3,
      key: 'mint',
      name: 'Mint Teal',
      top: '#2EC4B6',
      side: '#1E968B',
      sideDark: '#136B63',
      rim: '#6AE0D5',
      ink: '#F7FFFE',
      stamp: 'cross',
      symbol: '✚'
    },
    {
      id: 4,
      key: 'plum',
      name: 'Plum Violet',
      top: '#845EC2',
      side: '#62409B',
      sideDark: '#462B73',
      rim: '#AC8CE0',
      ink: '#FBF9FF',
      stamp: 'star',
      symbol: '★'
    },
    {
      id: 5,
      key: 'terracotta',
      name: 'Terracotta Orange',
      top: '#F9844A',
      side: '#CD5F28',
      sideDark: '#9D4417',
      rim: '#FCA97E',
      ink: '#FFF9F5',
      stamp: 'hexagon',
      symbol: '⬣'
    }
  ];

  const COLOR_BY_KEY = {};
  const COLOR_BY_ID = {};
  VINYL_COLORS.forEach((c) => {
    COLOR_BY_KEY[c.key] = c;
    COLOR_BY_ID[c.id] = c;
  });

  function normalizeColorId(c) {
    if (typeof c === 'number' && c >= 0 && c < VINYL_COLORS.length) return c;
    if (typeof c === 'string') {
      const lower = c.toLowerCase().trim();
      if (COLOR_BY_KEY[lower]) return COLOR_BY_KEY[lower].id;
      const parsed = parseInt(lower, 10);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < VINYL_COLORS.length) return parsed;
    }
    return 0;
  }

  function getColorKey(c) {
    const id = normalizeColorId(c);
    return VINYL_COLORS[id] ? VINYL_COLORS[id].key : 'coral';
  }

  function getColorMeta(c) {
    const id = normalizeColorId(c);
    return VINYL_COLORS[id] || VINYL_COLORS[0];
  }

  // ===========================================================================
  // 2. Deterministic Seeded PRNG (Mulberry32 + FNV-1a Hash)
  // ===========================================================================
  function hashSeedString(str) {
    const s = String(str || 'ATELIER-1');
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function createMulberry32(seedInt) {
    let a = seedInt >>> 0;
    return function nextFloat() {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ===========================================================================
  // 3. Axial Grid Helpers for 7-Slot (R=1), 19-Slot (R=2), and 37-Slot (R=3)
  // ===========================================================================
  const AXIAL_DIRS = [
    { dq: 1, dr: 0, name: 'E' },
    { dq: 1, dr: -1, name: 'NE' },
    { dq: 0, dr: -1, name: 'NW' },
    { dq: -1, dr: 0, name: 'W' },
    { dq: -1, dr: 1, name: 'SW' },
    { dq: 0, dr: 1, name: 'SE' }
  ];

  const BURST_THRESHOLD = 10;

  const GRID_CONFIGS = {
    7: {
      radius: 1,
      slots: 7,
      label: '7-Slot Studio',
      colsSpan: 3.12,
      rowsSpan: 2.95,
      maxHexR: 64
    },
    19: {
      radius: 2,
      slots: 19,
      label: '19-Slot Workshop',
      colsSpan: 4.88,
      rowsSpan: 4.55,
      maxHexR: 54
    },
    37: {
      radius: 3,
      slots: 37,
      label: '37-Slot Grand Atelier',
      colsSpan: 6.75,
      rowsSpan: 6.20,
      maxHexR: 40
    }
  };

  function cellKey(q, r) {
    return `${q},${r}`;
  }

  function parseCellKey(key) {
    const parts = String(key).split(',');
    return { q: parseInt(parts[0], 10) || 0, r: parseInt(parts[1], 10) || 0 };
  }

  function getRadiusForSlots(radiusOrSlots) {
    const n = Number(radiusOrSlots);
    if (n === 1 || n === 7) return 1;
    if (n === 3 || n === 37) return 3;
    return 2;
  }

  function getSlotsForRadius(radiusOrSlots) {
    const r = getRadiusForSlots(radiusOrSlots);
    if (r === 1) return 7;
    if (r === 3) return 37;
    return 19;
  }

  function axialDistance(q1, r1, q2 = 0, r2 = 0) {
    const dq = q1 - q2;
    const dr = r1 - r2;
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
  }

  /**
   * Generates concentric hexagonal coordinates for radius 1 (7 slots),
   * radius 2 (19 slots), or radius 3 (37 slots), sorted back-to-front (r then q).
   */
  function generateAxialGridCoords(radiusOrSlots = 2) {
    const radius = getRadiusForSlots(radiusOrSlots);
    const coords = [];
    for (let r = -radius; r <= radius; r++) {
      for (let q = -radius; q <= radius; q++) {
        const ring = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
        if (ring <= radius) {
          coords.push({
            q,
            r,
            key: cellKey(q, r),
            ring
          });
        }
      }
    }
    coords.sort((a, b) => (a.r !== b.r ? a.r - b.r : a.q - b.q));
    return coords;
  }

  function getAxialNeighbors(q, r, radiusOrSlots = 3) {
    const radius = getRadiusForSlots(radiusOrSlots);
    const out = [];
    for (let i = 0; i < AXIAL_DIRS.length; i++) {
      const d = AXIAL_DIRS[i];
      const nq = q + d.dq;
      const nr = r + d.dr;
      if (axialDistance(nq, nr, 0, 0) <= radius) {
        out.push({ q: nq, r: nr, key: cellKey(nq, nr), dirIndex: i, dirName: d.name });
      }
    }
    return out;
  }

  // Stack inspection utilities
  function getTopColor(stack) {
    if (!stack || stack.length === 0) return null;
    return stack[stack.length - 1];
  }

  function getTopContiguousCount(stack) {
    if (!stack || stack.length === 0) return 0;
    const top = stack[stack.length - 1];
    let count = 0;
    for (let i = stack.length - 1; i >= 0; i--) {
      if (stack[i] === top) count++;
      else break;
    }
    return count;
  }

  function getColorGroups(stack) {
    if (!stack || stack.length === 0) return [];
    const groups = [];
    for (let i = 0; i < stack.length; i++) {
      const c = stack[i];
      if (groups.length === 0 || groups[groups.length - 1].color !== c) {
        groups.push({ color: c, count: 1 });
      } else {
        groups[groups.length - 1].count++;
      }
    }
    return groups;
  }

  // ===========================================================================
  // 4. Workshop Chapters Metadata (10 Chapters × 10 Levels = 100 Levels)
  // ===========================================================================
  const WORKSHOP_CHAPTERS = [
    {
      chapter: 1,
      id: 'chapter-1',
      name: 'Clay Foundations',
      subtitle: '7-Slot & 19-Slot Studio Onboarding',
      levelRange: [1, 10],
      themeColor: '#FF5964',
      mechanicIntro: 'Drag-and-drop placement, clockwise neighbor merges, sub-disc exposure cascades & Color Target Objectives.'
    },
    {
      chapter: 2,
      id: 'chapter-2',
      name: 'Brass Anvil Foundry',
      subtitle: 'Fixed Brass Anvil Pedestals',
      levelRange: [11, 20],
      themeColor: '#F4B942',
      mechanicIntro: 'Fixed Brass Anvil Pedestals block hex placement and carve tactical routing lanes.'
    },
    {
      chapter: 3,
      id: 'chapter-3',
      name: 'Cast Iron & Chokepoints',
      subtitle: 'Tri-Anvil Routing & 5-Color Casts',
      levelRange: [21, 30],
      themeColor: '#386FA4',
      mechanicIntro: 'Multi-anvil chokepoints require sub-disc lookahead across 5 active vinyl colors.'
    },
    {
      chapter: 4,
      id: 'chapter-4',
      name: 'Glaze & Frozen Clay Kiln',
      subtitle: 'Hardened Frozen Clay Crusts',
      levelRange: [31, 40],
      themeColor: '#2EC4B6',
      mechanicIntro: 'Frozen Clay Tiles stay locked until an adjacent 10-disc burst cracks their crust and unveils hidden stacks!'
    },
    {
      chapter: 5,
      id: 'chapter-5',
      name: 'Frost-Cracked Porcelain',
      subtitle: '2-Layer Kiln Glaze & Chain Thaws',
      levelRange: [41, 50],
      themeColor: '#845EC2',
      mechanicIntro: 'Reinforced 2-HP Frozen Clay tiles demand sequential adjacent bursts to shatter.'
    },
    {
      chapter: 6,
      id: 'chapter-6',
      name: 'Twin-Kiln Resonance',
      subtitle: 'Anvil + Frozen Clay Synergy',
      levelRange: [51, 60],
      themeColor: '#F9844A',
      mechanicIntro: 'Brass Anvils and 2-HP Frozen Clay clusters combine in high-combo 19-slot workshops.'
    },
    {
      chapter: 7,
      id: 'chapter-7',
      name: 'Grand Atelier Foundations',
      subtitle: '37-Slot Concentric Hex Table',
      levelRange: [61, 70],
      themeColor: '#2EC4B6',
      mechanicIntro: 'Expand to the 37-slot (Radius 3) Grand Atelier table with sweeping 5-color cascades.'
    },
    {
      chapter: 8,
      id: 'chapter-8',
      name: 'Clockwork Brass Conservatory',
      subtitle: '37-Slot Brass Ring Fortresses',
      levelRange: [71, 80],
      themeColor: '#F4B942',
      mechanicIntro: '6 active vinyl colors and geometric Brass Anvil rings across 37-slot and dense 19-slot tables.'
    },
    {
      chapter: 9,
      id: 'chapter-9',
      name: "Master Sculptor's Crucible",
      subtitle: '3-HP Deep Glaze & 6-Color Mastery',
      levelRange: [81, 90],
      themeColor: '#845EC2',
      mechanicIntro: '3-HP Frozen Clay vaults and 60–80 disc multi-color casting quotas.'
    },
    {
      chapter: 10,
      id: 'chapter-10',
      name: "Golden Founder's Grand Atelier",
      subtitle: 'The Final 37-Slot Masterpieces',
      levelRange: [91, 100],
      themeColor: '#FF5964',
      mechanicIntro: 'Ultimate 37-slot commissions uniting all 6 vinyl colors, Brass Anvil citadels, and 3-HP Frozen Clay vaults.'
    }
  ];

  // ===========================================================================
  // 5. Pure Deterministic Tray Generator & Board Physics Engine
  // ===========================================================================

  /**
   * Generates a single smart stack of 2 to 4 vinyl discs (1 or 2 color layers).
   * Deterministically weights active target colors and current board top colors
   * so levels are strategic, fair, and rewarding.
   */
  function generateSmartTrayStack(state, rng, levelDef) {
    const activeColors =
      levelDef && Array.isArray(levelDef.activeColors) && levelDef.activeColors.length > 0
        ? levelDef.activeColors.map(normalizeColorId)
        : [0, 1, 2, 3];

    // Inspect current board state & unmet objective targets
    const weightedPool = [];
    const topColorCounts = new Map();
    let occupiedPlaceable = 0;
    let totalPlaceable = 0;

    if (state && Array.isArray(state.cellList)) {
      for (let i = 0; i < state.cellList.length; i++) {
        const c = state.cellList[i];
        if (c.isAnvil) continue;
        totalPlaceable++;
        if (c.stack.length > 0) {
          occupiedPlaceable++;
          const top = getTopColor(c.stack);
          const topCnt = getTopContiguousCount(c.stack);
          if (c.iceHp === 0) {
            // Weight active unlocked top colors strongly so merges are always accessible
            const weight = topCnt >= 5 ? 5 : 3;
            for (let w = 0; w < weight; w++) weightedPool.push(top);
            topColorCounts.set(top, (topColorCounts.get(top) || 0) + topCnt);
          } else {
            // Lightly include frozen top colors so when they thaw, matches are ready
            weightedPool.push(top);
          }
        }
      }
    }

    // Weight unmet target colors strongly so the player is never starved of target colors
    const unmetTargetColors = [];
    if (levelDef && levelDef.objective && Array.isArray(levelDef.objective.targets)) {
      for (let i = 0; i < levelDef.objective.targets.length; i++) {
        const t = levelDef.objective.targets[i];
        const cid = normalizeColorId(t.colorId !== undefined ? t.colorId : t.colorIndex);
        const cleared =
          state && state.clearedByColor ? state.clearedByColor[getColorKey(cid)] || 0 : 0;
        if (cleared < t.count) {
          unmetTargetColors.push(cid);
          for (let w = 0; w < 4; w++) weightedPool.push(cid);
        }
      }
    }

    // Always include base activeColors in pool
    for (let i = 0; i < activeColors.length; i++) {
      weightedPool.push(activeColors[i]);
    }

    const pickColor = (excludeColor = -1) => {
      for (let attempt = 0; attempt < 8; attempt++) {
        let chosen;
        if (unmetTargetColors.length > 0 && rng() < 0.48) {
          chosen = unmetTargetColors[Math.floor(rng() * unmetTargetColors.length)];
        } else if (weightedPool.length > 0 && rng() < 0.78) {
          chosen = weightedPool[Math.floor(rng() * weightedPool.length)];
        } else {
          chosen = activeColors[Math.floor(rng() * activeColors.length)];
        }
        if (chosen !== excludeColor || activeColors.length <= 1) return chosen;
      }
      for (let i = 0; i < activeColors.length; i++) {
        if (activeColors[i] !== excludeColor) return activeColors[i];
      }
      return activeColors[0];
    };

    const occupancyRatio = totalPlaceable > 0 ? occupiedPlaceable / totalPlaceable : 0;
    const totalDiscs = occupancyRatio > 0.55 ? (rng() < 0.65 ? 4 : 3) : 2 + Math.floor(rng() * 3); // 2..4 discs
    const singleLayerBias = occupancyRatio > 0.52 ? 0.72 : 0.48;
    const numLayersRoll = rng();
    const stack = [];

    if (totalDiscs === 2) {
      if (numLayersRoll < singleLayerBias + 0.1) {
        const c1 = pickColor();
        stack.push(c1, c1);
      } else {
        const c1 = pickColor();
        const c2 = pickColor(c1);
        stack.push(c1, c2);
      }
    } else if (totalDiscs === 3) {
      if (numLayersRoll < singleLayerBias) {
        const c1 = pickColor();
        stack.push(c1, c1, c1);
      } else {
        const c1 = pickColor();
        const c2 = pickColor(c1);
        if (rng() < 0.55) {
          stack.push(c1, c2, c2);
        } else {
          stack.push(c1, c1, c2);
        }
      }
    } else {
      if (numLayersRoll < singleLayerBias) {
        const c1 = pickColor();
        stack.push(c1, c1, c1, c1);
      } else {
        const c1 = pickColor();
        const c2 = pickColor(c1);
        const split = rng() < 0.6 ? 1 : 2;
        for (let i = 0; i < split; i++) stack.push(c1);
        for (let i = split; i < 4; i++) stack.push(c2);
      }
    }

    return stack;
  }

  /**
   * Generates a 3-stack dispenser tray wave deterministically.
   * For Campaign Levels 1..100 (`!levelDef.isEndless`), uses pre-baked `staticTrayWaves`
   * so all 100 campaign levels are static levels (procedural generation is reserved for Endless 101+).
   */
  function generateTrayWave(state, rng, levelDef, waveIndex = 0) {
    if (
      levelDef &&
      !levelDef.isEndless &&
      Array.isArray(levelDef.staticTrayWaves) &&
      waveIndex >= 0 &&
      waveIndex < levelDef.staticTrayWaves.length &&
      Array.isArray(levelDef.staticTrayWaves[waveIndex])
    ) {
      return levelDef.staticTrayWaves[waveIndex].map((s) => s.map(normalizeColorId));
    }
    if (
      waveIndex === 0 &&
      levelDef &&
      Array.isArray(levelDef.initialTray) &&
      levelDef.initialTray.length === 3
    ) {
      return levelDef.initialTray.map((s) => s.map(normalizeColorId));
    }
    const wave = [];
    for (let i = 0; i < 3; i++) {
      wave.push(generateSmartTrayStack(state, rng, levelDef));
    }
    return wave;
  }

  /**
   * Creates a clean, self-contained simulation state from a level definition.
   */
  function createSimulationState(levelDef) {
    const radius = getRadiusForSlots(levelDef.gridRadius || levelDef.gridSlots || 2);
    const coords = generateAxialGridCoords(radius);
    const cells = new Map();
    const cellList = [];

    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      const cell = {
        q: c.q,
        r: c.r,
        key: c.key,
        ring: c.ring,
        stack: [],
        isAnvil: false,
        iceHp: 0,
        maxIceHp: 0
      };
      cells.set(cell.key, cell);
      cellList.push(cell);
    }

    // Apply fixed Brass Anvils
    if (Array.isArray(levelDef.anvils)) {
      levelDef.anvils.forEach((a) => {
        const cell = cells.get(cellKey(a.q, a.r));
        if (cell) {
          cell.isAnvil = true;
          cell.stack = [];
          cell.iceHp = 0;
        }
      });
    }

    // Apply starter stacks
    if (Array.isArray(levelDef.starterStacks)) {
      levelDef.starterStacks.forEach((s) => {
        const cell = cells.get(cellKey(s.q, s.r));
        if (cell && !cell.isAnvil) {
          cell.stack = (s.stack || []).map(normalizeColorId);
        }
      });
    }

    // Apply Frozen Clay Tiles
    if (Array.isArray(levelDef.frozenCells)) {
      levelDef.frozenCells.forEach((f) => {
        const cell = cells.get(cellKey(f.q, f.r));
        if (cell && !cell.isAnvil) {
          cell.stack = (f.stack || []).map(normalizeColorId);
          cell.iceHp = Math.max(1, Number(f.iceHp) || 1);
          cell.maxIceHp = cell.iceHp;
        }
      });
    }

    const clearedByColor = {
      coral: 0,
      cobalt: 0,
      mustard: 0,
      mint: 0,
      plum: 0,
      terracotta: 0
    };

    const rng = createMulberry32(hashSeedString(levelDef.seed || `POPSTACKS-L${levelDef.level}`));

    const state = {
      level: levelDef.level,
      gridRadius: radius,
      gridSlots: getSlotsForRadius(radius),
      cells,
      cellList,
      tray: [null, null, null],
      waveIndex: 0,
      rng,
      clearedByColor,
      totalDiscsCleared: 0,
      movesTaken: 0,
      cascadesTriggered: 0,
      bursts10: 0,
      frozenCleared: 0,
      iceDamageDealt: 0,
      score: 0
    };

    const firstWave = generateTrayWave(state, state.rng, levelDef, 0);
    state.tray = firstWave.map((discs) => [...discs]);
    state.generatedWaves = [firstWave.map((discs) => [...discs])];
    state.waveIndex = 1;

    return state;
  }

  /**
   * Checks if all Color Target Objectives in `levelDef.objective` have been met.
   */
  function isObjectiveComplete(state, levelDef) {
    if (!levelDef || !levelDef.objective) return state.totalDiscsCleared >= 30;
    const obj = levelDef.objective;
    if (Array.isArray(obj.targets) && obj.targets.length > 0) {
      for (let i = 0; i < obj.targets.length; i++) {
        const t = obj.targets[i];
        const key = getColorKey(t.colorId !== undefined ? t.colorId : t.colorIndex);
        if ((state.clearedByColor[key] || 0) < t.count) {
          return false;
        }
      }
      return true;
    }
    return state.totalDiscsCleared >= (obj.totalDiscsGoal || 30);
  }

  function getMatchingUnlockedNeighbors(state, q, r, targetColor) {
    if (targetColor === null || targetColor === undefined) return [];
    const matches = [];
    for (let i = 0; i < AXIAL_DIRS.length; i++) {
      const d = AXIAL_DIRS[i];
      const nCell = state.cells.get(cellKey(q + d.dq, r + d.dr));
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

  function computeMergePlanInState(state, focalCell, matchingNeighbors) {
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
        const focalSubMatches = getMatchingUnlockedNeighbors(
          state,
          focalCell.q,
          focalCell.r,
          focalSubColor
        ).some((c) => c.key !== n.key);
        const nSubMatches = getMatchingUnlockedNeighbors(state, n.q, n.r, nSubColor).some(
          (c) => c.key !== focalCell.key
        );

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

  function findOutOfEquilibriumCellInState(state) {
    for (let i = 0; i < state.cellList.length; i++) {
      const c = state.cellList[i];
      if (!c.isAnvil && c.iceHp === 0 && getTopContiguousCount(c.stack) >= BURST_THRESHOLD) {
        return c;
      }
    }
    for (let i = 0; i < state.cellList.length; i++) {
      const c = state.cellList[i];
      if (c.isAnvil || c.iceHp > 0 || c.stack.length === 0) continue;
      const top = getTopColor(c.stack);
      const matches = getMatchingUnlockedNeighbors(state, c.q, c.r, top);
      if (matches.length > 0) return c;
    }
    return null;
  }

  /**
   * Executes a single placement of `discs` onto `(q, r)` in `state` and resolves
   * all resulting clockwise merges, sub-disc exposures, 10-disc bursts, and
   * adjacent Frozen Clay (`iceHp`) cracks to 100% equilibrium.
   */
  function executePlacementOnState(state, q, r, discs) {
    const targetCell = state.cells.get(cellKey(q, r));
    if (!targetCell || targetCell.isAnvil || targetCell.iceHp > 0 || targetCell.stack.length > 0) {
      return false;
    }

    targetCell.stack = [...discs];
    state.movesTaken++;

    const queue = [{ q, r, reason: 'placement' }];
    let turnCombo = 0;

    const enqueue = (cq, cr, reason) => {
      if (!queue.some((item) => item.q === cq && item.r === cr)) {
        queue.push({ q: cq, r: cr, reason });
      }
    };

    const enqueueFront = (cq, cr, reason) => {
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].q === cq && queue[i].r === cr) queue.splice(i, 1);
      }
      queue.unshift({ q: cq, r: cr, reason });
    };

    let safety = 0;
    while (safety++ < 300) {
      if (queue.length === 0) {
        const eq = findOutOfEquilibriumCellInState(state);
        if (eq) {
          queue.push({ q: eq.q, r: eq.r, reason: 'equilibrium' });
        } else {
          break;
        }
      }

      const item = queue.shift();
      const focal = state.cells.get(cellKey(item.q, item.r));
      if (!focal || focal.isAnvil || focal.iceHp > 0 || focal.stack.length === 0) continue;

      // 1. Check immediate >= 10 top contiguous burst
      const topCount = getTopContiguousCount(focal.stack);
      if (topCount >= BURST_THRESHOLD) {
        const burstColorId = getTopColor(focal.stack);
        const burstColorKey = getColorKey(burstColorId);
        focal.stack.splice(focal.stack.length - topCount, topCount);

        turnCombo = Math.max(1, turnCombo);
        state.bursts10++;
        state.totalDiscsCleared += topCount;
        state.clearedByColor[burstColorKey] = (state.clearedByColor[burstColorKey] || 0) + topCount;
        state.score += 100 * turnCombo;

        // Crack adjacent Frozen Clay tiles (reduce iceHp by 1; if 0, enqueue for cascades!)
        for (let dIdx = 0; dIdx < AXIAL_DIRS.length; dIdx++) {
          const d = AXIAL_DIRS[dIdx];
          const adj = state.cells.get(cellKey(focal.q + d.dq, focal.r + d.dr));
          if (adj && !adj.isAnvil && adj.iceHp > 0) {
            adj.iceHp = Math.max(0, adj.iceHp - 1);
            state.iceDamageDealt++;
            if (adj.iceHp === 0) {
              state.frozenCleared++;
              if (adj.stack.length > 0) {
                enqueue(adj.q, adj.r, 'thawed-frozen-clay');
              }
            }
          }
        }

        if (focal.stack.length > 0) {
          enqueueFront(focal.q, focal.r, 'post-burst-subdisc');
        }
        continue;
      }

      // 2. Inspect 6 clockwise neighbors for matching top color
      const topCol = getTopColor(focal.stack);
      const matchingNeighbors = getMatchingUnlockedNeighbors(state, focal.q, focal.r, topCol);
      if (matchingNeighbors.length === 0) continue;

      const plan = computeMergePlanInState(state, focal, matchingNeighbors);
      turnCombo++;
      state.cascadesTriggered++;

      for (let tIdx = 0; tIdx < plan.transfers.length; tIdx++) {
        const tr = plan.transfers[tIdx];
        for (let k = 0; k < tr.count; k++) {
          const d = tr.donor.stack.pop();
          tr.receiver.stack.push(d);
        }
      }

      for (let tIdx = 0; tIdx < plan.transfers.length; tIdx++) {
        const tr = plan.transfers[tIdx];
        if (tr.donor.stack.length > 0) {
          enqueue(tr.donor.q, tr.donor.r, 'exposed-subdisc');
        }
      }

      if (getTopContiguousCount(plan.receiver.stack) >= BURST_THRESHOLD) {
        enqueueFront(plan.receiver.q, plan.receiver.r, 'immediate-burst');
      } else if (plan.receiver.stack.length > 0) {
        enqueue(plan.receiver.q, plan.receiver.r, 'merged-receiver');
      }
    }

    return true;
  }

  /**
   * Lightweight state cloner for fast solver lookahead evaluation.
   */
  function cloneLightBoardState(state) {
    const cells = new Map();
    const cellList = [];
    for (let i = 0; i < state.cellList.length; i++) {
      const src = state.cellList[i];
      const copy = {
        q: src.q,
        r: src.r,
        key: src.key,
        ring: src.ring,
        stack: src.stack.slice(),
        isAnvil: src.isAnvil,
        iceHp: src.iceHp,
        maxIceHp: src.maxIceHp
      };
      cells.set(copy.key, copy);
      cellList.push(copy);
    }
    return {
      level: state.level,
      gridRadius: state.gridRadius,
      gridSlots: state.gridSlots,
      cells,
      cellList,
      clearedByColor: { ...state.clearedByColor },
      totalDiscsCleared: state.totalDiscsCleared,
      movesTaken: state.movesTaken,
      cascadesTriggered: state.cascadesTriggered,
      bursts10: state.bursts10,
      frozenCleared: state.frozenCleared,
      iceDamageDealt: state.iceDamageDealt,
      score: state.score
    };
  }

  /**
   * Evaluates a candidate placement `(trayIndex, q, r)` for the headless solver.
   */
  function scoreCandidatePlacement(beforeState, afterState, placedQ, placedR, levelDef) {
    const remainingFrozen = afterState.cellList.filter((c) => c.iceHp > 0).length;
    const totalInitialFrozen = Array.isArray(levelDef.frozenCells) ? levelDef.frozenCells.length : 0;
    const allFrozenClearedOrNone = totalInitialFrozen === 0 || afterState.frozenCleared > 0;

    if (isObjectiveComplete(afterState, levelDef) && allFrozenClearedOrNone) {
      return 1000000 - afterState.movesTaken * 100 + afterState.frozenCleared * 5000;
    }

    let score = 0;

    // 1. Progress on unmet target colors
    if (levelDef && levelDef.objective && Array.isArray(levelDef.objective.targets)) {
      for (let i = 0; i < levelDef.objective.targets.length; i++) {
        const t = levelDef.objective.targets[i];
        const key = getColorKey(t.colorId !== undefined ? t.colorId : t.colorIndex);
        const beforeC = Math.min(t.count, beforeState.clearedByColor[key] || 0);
        const afterC = Math.min(t.count, afterState.clearedByColor[key] || 0);
        score += (afterC - beforeC) * 160;
      }
    }

    // 2. Frozen clay damage & thawing priority
    const frozenDelta = afterState.frozenCleared - beforeState.frozenCleared;
    const iceDmgDelta = afterState.iceDamageDealt - beforeState.iceDamageDealt;
    score += frozenDelta * 900 + iceDmgDelta * 450;

    // 3. Bursts and cascades
    const burstsDelta = afterState.bursts10 - beforeState.bursts10;
    const cascadesDelta = afterState.cascadesTriggered - beforeState.cascadesTriggered;
    score += burstsDelta * 260 + cascadesDelta * 65;

    // 4. Empty cells remaining (board breathing room prevents deadlock)
    let emptyPlaceable = 0;
    for (let i = 0; i < afterState.cellList.length; i++) {
      const c = afterState.cellList[i];
      if (!c.isAnvil && c.iceHp === 0 && c.stack.length === 0) {
        emptyPlaceable++;
      } else if (!c.isAnvil && c.iceHp === 0 && c.stack.length > 0) {
        const topCnt = getTopContiguousCount(c.stack);
        const groups = getColorGroups(c.stack);
        // Reward building contiguous top groups toward 10, especially adjacent to frozen clay
        score += topCnt * topCnt * 3.2;
        if (groups.length === 1) score += 18;
        if (remainingFrozen > 0) {
          let adjFrozen = false;
          for (let dIdx = 0; dIdx < AXIAL_DIRS.length; dIdx++) {
            const d = AXIAL_DIRS[dIdx];
            const adj = afterState.cells.get(cellKey(c.q + d.dq, c.r + d.dr));
            if (adj && adj.iceHp > 0) {
              adjFrozen = true;
              break;
            }
          }
          if (adjFrozen) {
            score += topCnt * 22;
          }
        }
      }
    }
    score += emptyPlaceable * 75;

    // 5. Slight preference for placing adjacent to frozen cells when frozen cells still exist
    if (remainingFrozen > 0) {
      for (let dIdx = 0; dIdx < AXIAL_DIRS.length; dIdx++) {
        const d = AXIAL_DIRS[dIdx];
        const adj = afterState.cells.get(cellKey(placedQ + d.dq, placedR + d.dr));
        if (adj && adj.iceHp > 0) {
          score += 55;
        }
      }
    }

    return score;
  }

  /**
   * Pure, deterministic headless level solver (`simulateLevelWithSolver`).
   * Runs with ZERO boosters and ZERO extra slots.
   */
  function simulateLevelWithSolver(levelDef, options = {}) {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const maxMoves = options.maxMoves || 220;
    const state = createSimulationState(levelDef);
    const moveHistory = [];

    const totalInitialFrozen = Array.isArray(levelDef.frozenCells) ? levelDef.frozenCells.length : 0;

    while (state.movesTaken < maxMoves) {
      // Check win condition (all color targets met; if level has frozen cells, also ensure at least 1 frozen cell thawed)
      if (
        isObjectiveComplete(state, levelDef) &&
        (totalInitialFrozen === 0 || state.frozenCleared > 0)
      ) {
        break;
      }

      // Refill tray if all 3 slots are consumed
      if (!state.tray[0] && !state.tray[1] && !state.tray[2]) {
        const nextWave = generateTrayWave(state, state.rng, levelDef, state.waveIndex++);
        state.tray = nextWave.map((d) => [...d]);
        if (Array.isArray(state.generatedWaves)) {
          state.generatedWaves.push(nextWave.map((d) => [...d]));
        }
      }

      // If Level 1 FTUE has guided steps for the opening moves, follow them first
      let chosenMove = null;
      if (
        levelDef.isFtue &&
        Array.isArray(levelDef.ftueSteps) &&
        state.movesTaken < levelDef.ftueSteps.length
      ) {
        const step = levelDef.ftueSteps[state.movesTaken];
        const targetCell = state.cells.get(cellKey(step.targetQ, step.targetR));
        if (
          step &&
          state.tray[step.trayIndex] &&
          targetCell &&
          !targetCell.isAnvil &&
          targetCell.iceHp === 0 &&
          targetCell.stack.length === 0
        ) {
          chosenMove = {
            trayIndex: step.trayIndex,
            q: step.targetQ,
            r: step.targetR
          };
        }
      }

      if (!chosenMove) {
        const emptyCells = [];
        for (let i = 0; i < state.cellList.length; i++) {
          const c = state.cellList[i];
          if (!c.isAnvil && c.iceHp === 0 && c.stack.length === 0) {
            emptyCells.push(c);
          }
        }

        if (emptyCells.length === 0) {
          // Deadlock reached!
          break;
        }

        let bestScore = -Infinity;
        for (let tIdx = 0; tIdx < 3; tIdx++) {
          const discs = state.tray[tIdx];
          if (!discs || discs.length === 0) continue;

          for (let cIdx = 0; cIdx < emptyCells.length; cIdx++) {
            const cell = emptyCells[cIdx];
            const sim = cloneLightBoardState(state);
            executePlacementOnState(sim, cell.q, cell.r, discs);
            const sc = scoreCandidatePlacement(state, sim, cell.q, cell.r, levelDef);
            if (sc > bestScore) {
              bestScore = sc;
              chosenMove = { trayIndex: tIdx, q: cell.q, r: cell.r };
            }
          }
        }
      }

      if (!chosenMove) break;

      const discsToPlace = state.tray[chosenMove.trayIndex];
      state.tray[chosenMove.trayIndex] = null;
      executePlacementOnState(state, chosenMove.q, chosenMove.r, discsToPlace);
      if (options.recordMoves) {
        moveHistory.push({
          move: state.movesTaken,
          trayIndex: chosenMove.trayIndex,
          q: chosenMove.q,
          r: chosenMove.r,
          discs: discsToPlace
        });
      }
    }

    const endTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const won =
      isObjectiveComplete(state, levelDef) &&
      (totalInitialFrozen === 0 || state.frozenCleared > 0);

    return {
      level: levelDef.level,
      gridSlots: state.gridSlots,
      gridRadius: state.gridRadius,
      won,
      movesTaken: state.movesTaken,
      cascadesTriggered: state.cascadesTriggered,
      bursts10: state.bursts10,
      anvilsCount: Array.isArray(levelDef.anvils) ? levelDef.anvils.length : 0,
      frozenCleared: state.frozenCleared,
      totalDiscsCleared: state.totalDiscsCleared,
      clearedByColor: state.clearedByColor,
      generatedWaves: state.generatedWaves,
      solveTimeMs: Number(Math.max(0.05, endTime - startTime).toFixed(2)),
      moveHistory: options.recordMoves ? moveHistory : undefined
    };
  }

  // ===========================================================================
  // 6. 100 Hand-Balanced, Deterministically Seeded Campaign Levels (1..100)
  // ===========================================================================
  const LEVEL_TITLES = [
    // Ch 1: Clay Foundations (1-10)
    'First Clay Press', 'Warm Terracotta Wheel', 'Mint Glaze Dip', 'Tri-Color Pinch Pot', 'Kiln Shelf Trio',
    'Expanded 19-Slot Bench', 'Four-Pigment Palette', 'Spiral Turnings', 'Bisque Firing I', 'Apprentice Showcase',
    // Ch 2: Brass Anvil Foundry (11-20)
    'Single Brass Pedestal', 'Anvil Pivot', 'Foundry Twin-Post', 'Molten Rim Routing', 'Brass Channeling',
    'Plum Pigment Arrival', 'Five-Hue Crucible', 'Split-Bench Mold', 'Bronze Gateways', 'Foundry Masterwork',
    // Ch 3: Cast Iron & Chokepoints (21-30)
    'Tri-Anvil Triangle', 'Narrow Pour Spout', 'Iron Bridgehead', 'Counter-Clockwise Cast', 'Staggered Pedestals',
    'Deep Groove Sort', 'Siphon Chokepoint', 'Anvil Labyrinth', 'Pressured Extrusion', 'Foundry Graduation',
    // Ch 4: Glaze & Frozen Clay Kiln (31-40)
    'Hardened Clay Crust', 'First Thaw Burst', 'Cracked Celadon', 'Twin Frost Shells', 'Glaze Breaker',
    'Kiln Vent Thaw', 'Thermal Shockwave', 'Encased Centerpiece', 'Porcelain Awakening', 'Kiln Keeper Trial',
    // Ch 5: Frost-Cracked Porcelain (41-50)
    'Double-Baked Crust', 'Two-Stage Shatter', 'Frosted Anvil Flanking', 'Crystalline Glaze', 'Deep Kiln Core',
    'Resonant Cracking', 'Winter Ceramic Studio', 'Layered Bisque Lock', 'Shatter-Chain Symphony', 'Porcelain Artisan',
    // Ch 6: Twin-Kiln Resonance (51-60)
    'Twin-Kiln Ignition', 'Crossfire Thaw', 'Brass & Ice Equilibrium', 'Dual Core Extraction', 'Vitrified Vault',
    'Kiln Overdrive', 'Symmetric Crusts', 'Thermal Cascade', 'Pyrometric Cone 10', 'Master Kiln Graduation',
    // Ch 7: Grand Atelier Foundations (61-70)
    'Welcome to the 37-Slot Table', 'Outer Ring Expansion', 'Concentric Vinyl Wave', 'Grand Studio Corners', 'Wide-Arc Cascades',
    'Six-Spoke Starburst', 'Atelier Promenade', 'Panoramic Clay Sort', 'Triple-Ring Harmony', 'Grand Table Commencement',
    // Ch 8: Clockwork Brass Conservatory (71-80)
    'Clockwork Gear Ring', 'Six-Pigment Spectrum', 'Terracotta Sunburst', 'Precision 19-Slot Interlude', 'Brass Pendulum',
    'Escapement Chokepoints', 'Mainspring Unwind', 'Dense 19-Slot Mainspring', 'Chronometer Calibration', 'Conservatory Sovereign',
    // Ch 9: Master Sculptor's Crucible (81-90)
    'Triple-Glazed Monolith', '3-HP Core Excavations', 'Sculptor Chisel Line', 'Compact 19-Slot Crucible', 'Grand Ring Siege',
    'Hexagonal Cathedral', 'Six-Color Confluence', 'Dense 19-Slot Resonance', 'Masterpiece Pre-Cast', 'Crucible Grandmaster',
    // Ch 10: Golden Founder's Grand Atelier (91-100)
    "Founder's Golden Seal", 'Imperial Vinyl Vault', 'Astral Kiln Alignment', 'Kitsune Shrine Commission', 'Botanical Crown Cast',
    'Clockwork Citadel', 'Velvet Nocturne Gala', 'Origami Zenith', "Ollie's Royal Gallery", 'Grand Atelier Finale (Level 100)'
  ];

  // Candidate anvil layouts for 19-slot (R=2) and 37-slot (R=3) boards
  const ANVIL_PATTERNS_19 = [
    [{ q: 0, r: -1 }],
    [{ q: 1, r: -1 }],
    [{ q: -1, r: 1 }],
    [{ q: -1, r: 0 }, { q: 1, r: 0 }],
    [{ q: 0, r: -1 }, { q: 0, r: 1 }],
    [{ q: -1, r: 1 }, { q: 1, r: -1 }],
    [{ q: -1, r: -1 }, { q: 1, r: 0 }, { q: 0, r: 1 }],
    [{ q: 1, r: -2 }, { q: -1, r: 2 }, { q: 0, r: 0 }],
    [{ q: -2, r: 1 }, { q: 2, r: -1 }, { q: 0, r: -1 }]
  ];

  const ANVIL_PATTERNS_37 = [
    [{ q: -1, r: 0 }, { q: 1, r: 0 }],
    [{ q: -1, r: -1 }, { q: 1, r: -1 }, { q: 0, r: 2 }],
    [{ q: -2, r: 1 }, { q: 2, r: -1 }, { q: 0, r: 0 }],
    [{ q: -2, r: 0 }, { q: 2, r: 0 }, { q: 0, r: -2 }],
    [{ q: -1, r: -1 }, { q: 2, r: -1 }, { q: -1, r: 2 }, { q: 1, r: 1 }],
    [{ q: -2, r: 1 }, { q: 2, r: -1 }, { q: -1, r: -1 }, { q: 1, r: 1 }],
    [{ q: -2, r: 0 }, { q: 2, r: 0 }, { q: 0, r: -2 }, { q: 0, r: 2 }, { q: 0, r: 0 }]
  ];

  /**
   * Builds a single deterministic level specification for `levelNum` (1..100) with `seedVariant`.
   */
  function buildCandidateLevel(levelNum, seedVariant = 1) {
    const chapterIdx = Math.floor((levelNum - 1) / 10);
    const chapterObj = WORKSHOP_CHAPTERS[chapterIdx];

    // Special Hand-Crafted Level 1: First-60-Seconds Interactive FTUE Onboarding Level
    if (levelNum === 1) {
      return {
        level: 1,
        id: 'LVL-001',
        name: LEVEL_TITLES[0],
        chapter: 1,
        chapterName: chapterObj.name,
        seed: 'POPSTACKS-L001-FTUE',
        gridRadius: 1,
        gridSlots: 7,
        activeColors: [0, 1, 3],
        activeColorKeys: ['coral', 'cobalt', 'mint'],
        anvils: [],
        frozenCells: [],
        starterStacks: [
          { q: 1, r: 0, key: '1,0', stack: [0, 0, 0, 0] },
          { q: 0, r: -1, key: '0,-1', stack: [1, 1, 1, 0, 0, 0] },
          { q: -1, r: 0, key: '-1,0', stack: [3, 3, 3, 3, 1, 1, 1, 1] },
          { q: 0, r: 1, key: '0,1', stack: [3, 3, 3] }
        ],
        initialTray: [
          [0, 0, 0],
          [1, 1, 1],
          [3, 3, 3]
        ],
        objective: {
          type: 'color_clear',
          targets: [
            { colorId: 'coral', colorIndex: 0, key: 'coral', id: 0, name: 'Coral Red', count: 10 },
            { colorId: 'cobalt', colorIndex: 1, key: 'cobalt', id: 1, name: 'Cobalt Blue', count: 10 },
            { colorId: 'mint', colorIndex: 3, key: 'mint', id: 3, name: 'Mint Teal', count: 10 }
          ],
          totalDiscsGoal: 30
        },
        rewards: {
          vinylClay: 50,
          glazeDrops: 15,
          starThresholds: [250, 450, 700]
        },
        isFtue: true,
        ftueSteps: [
          {
            moveIndex: 0,
            trayIndex: 0,
            targetQ: 0,
            targetR: 0,
            targetKey: '0,0',
            hint: 'Step 1/3: Drag the Coral Red stack onto the center socket (0,0) for an instant 10-disc burst & sub-disc cascade!'
          },
          {
            moveIndex: 1,
            trayIndex: 1,
            targetQ: 0,
            targetR: 0,
            targetKey: '0,0',
            hint: 'Step 2/3: Drop the Cobalt Blue stack onto (0,0) to merge with the exposed Cobalt stack and burst 10!'
          },
          {
            moveIndex: 2,
            trayIndex: 2,
            targetQ: -1,
            targetR: 1,
            targetKey: '-1,1',
            hint: 'Step 3/3: Place the Mint Teal stack onto (-1,1) to link both Mint neighbors and complete the commission!'
          }
        ]
      };
    }

    const seedStr = `POPSTACKS-L${String(levelNum).padStart(3, '0')}-V${seedVariant}`;
    const rng = createMulberry32(hashSeedString(seedStr));

    // Determine Grid Radius / Slots
    let gridRadius = 2; // 19-slot default
    if (levelNum <= 5) {
      gridRadius = 1; // 7-slot early Chapter 1
    } else if (levelNum >= 61) {
      // Chapters 7-10: predominantly 37-slot (radius = 3) with select dense 19-slot stages (L74, L78, L84, L88)
      const isDense19 = levelNum === 74 || levelNum === 78 || levelNum === 84 || levelNum === 88;
      gridRadius = isDense19 ? 2 : 3;
    }
    const gridSlots = getSlotsForRadius(gridRadius);

    // Determine Active Colors count (3..6)
    let numColors = 4;
    if (levelNum <= 4) numColors = 3;
    else if (levelNum <= 15) numColors = 4;
    else if (levelNum <= 35) numColors = 4 + (levelNum % 2); // 4..5
    else if (levelNum <= 70) numColors = 5;
    else numColors = 6;

    const activeColors = [];
    for (let i = 0; i < numColors; i++) activeColors.push(i);
    const activeColorKeys = activeColors.map(getColorKey);

    // Determine Brass Anvils (Levels 11..100)
    const anvils = [];
    const occupiedKeys = new Set();

    if (levelNum >= 11) {
      if (gridRadius === 2) {
        let patternIdx = (levelNum + seedVariant) % ANVIL_PATTERNS_19.length;
        if (levelNum <= 16) patternIdx = levelNum % 3; // 1 anvil
        else if (levelNum <= 22) patternIdx = 3 + (levelNum % 3); // 2 anvils
        const rawPattern = ANVIL_PATTERNS_19[patternIdx];
        rawPattern.forEach((p) => {
          const k = cellKey(p.q, p.r);
          anvils.push({ q: p.q, r: p.r, key: k });
          occupiedKeys.add(k);
        });
      } else if (gridRadius === 3) {
        const patternIdx = (levelNum + seedVariant) % ANVIL_PATTERNS_37.length;
        const rawPattern = ANVIL_PATTERNS_37[patternIdx];
        rawPattern.forEach((p) => {
          const k = cellKey(p.q, p.r);
          anvils.push({ q: p.q, r: p.r, key: k });
          occupiedKeys.add(k);
        });
      }
    }

    // Determine Color Target Objectives
    let totalGoal = 30;
    let numTargets = 2;
    if (levelNum <= 5) {
      totalGoal = 30;
      numTargets = 2;
    } else if (levelNum <= 10) {
      totalGoal = 30 + (levelNum >= 8 ? 10 : 0);
      numTargets = 2;
    } else if (levelNum <= 30) {
      totalGoal = 40 + (levelNum >= 25 ? 10 : 0);
      numTargets = levelNum >= 20 ? 3 : 2;
    } else if (levelNum <= 60) {
      totalGoal = 40 + Math.floor((levelNum - 31) / 10) * 10; // 40, 50, 60
      numTargets = 3;
    } else {
      // Levels 61-100: 50 to 90 target discs cleared
      if (levelNum <= 70) totalGoal = 50;
      else if (levelNum <= 80) totalGoal = 60;
      else if (levelNum <= 90) totalGoal = 70;
      else if (levelNum < 100) totalGoal = 80;
      else totalGoal = 90;
      numTargets = levelNum >= 75 ? 4 : 3;
    }

    const targets = [];
    let remainingGoal = totalGoal;
    for (let i = 0; i < numTargets; i++) {
      const cId = activeColors[(i + (levelNum % activeColors.length)) % activeColors.length];
      const meta = getColorMeta(cId);
      const count =
        i === numTargets - 1
          ? remainingGoal
          : Math.max(10, Math.round(remainingGoal / (numTargets - i) / 10) * 10);
      remainingGoal -= count;
      targets.push({
        colorId: meta.key,
        colorIndex: meta.id,
        key: meta.key,
        id: meta.id,
        name: meta.name,
        count
      });
    }

    // Determine Frozen Clay Tiles (Levels 31..100)
    const frozenCells = [];
    if (levelNum >= 31) {
      const candidateFrozenCoords =
        gridRadius === 2
          ? [
              { q: 0, r: 0 },
              { q: 1, r: 0 },
              { q: 0, r: 1 },
              { q: -1, r: 1 },
              { q: -1, r: 0 },
              { q: 0, r: -1 },
              { q: 1, r: -1 }
            ]
          : [
              { q: 0, r: 0 },
              { q: 1, r: 0 },
              { q: 0, r: 1 },
              { q: -1, r: 1 },
              { q: -1, r: 0 },
              { q: 0, r: -1 },
              { q: 1, r: -1 },
              { q: 2, r: -1 },
              { q: -2, r: 1 }
            ];

      const desiredFrozenCount =
        levelNum <= 40 ? 1 : levelNum <= 60 ? 2 : levelNum <= 85 ? 2 : 3;

      for (let i = 0; i < candidateFrozenCoords.length && frozenCells.length < desiredFrozenCount; i++) {
        const fc = candidateFrozenCoords[(i + levelNum) % candidateFrozenCoords.length];
        const k = cellKey(fc.q, fc.r);
        if (occupiedKeys.has(k)) continue;

        // First frozen cell uses iceHp = 1 so an adjacent 10-burst immediately thaws it;
        // additional frozen cells scale up to iceHp 2 (Ch 5-8) or 3 (Ch 9-10).
        let iceHp = 1;
        if (frozenCells.length > 0) {
          if (levelNum >= 81) iceHp = 2 + (frozenCells.length % 2); // 2..3
          else if (levelNum >= 41) iceHp = 2;
        }

        const topTargetColor = targets[frozenCells.length % targets.length].colorIndex;
        const bottomColor = activeColors[(topTargetColor + 1) % activeColors.length];
        frozenCells.push({
          q: fc.q,
          r: fc.r,
          key: k,
          stack: [bottomColor, bottomColor, topTargetColor, topTargetColor, topTargetColor, topTargetColor],
          iceHp
        });
        occupiedKeys.add(k);
      }
    }

    // Place Starter Stacks (pre-charged adjacent to frozen cells or center so early bursts happen fast)
    const starterStacks = [];
    const allCoords = generateAxialGridCoords(gridRadius);

    // If there is a frozen cell with iceHp === 1, place 2 friendly starter stacks adjacent to an empty neighbor of that frozen cell!
    if (frozenCells.length > 0) {
      const primaryFrozen = frozenCells[0];
      const primaryColor = targets[0].colorIndex;
      const fNeighbors = getAxialNeighbors(primaryFrozen.q, primaryFrozen.r, gridRadius).filter(
        (n) => !occupiedKeys.has(n.key)
      );
      if (fNeighbors.length >= 2) {
        // Leave fNeighbors[0] empty as the burst trigger socket, and place starter stacks on its neighbors!
        const triggerSocket = fNeighbors[0];
        occupiedKeys.add(triggerSocket.key); // reserve triggerSocket so it stays empty at start
        const triggerSocketNeighbors = getAxialNeighbors(
          triggerSocket.q,
          triggerSocket.r,
          gridRadius
        ).filter((n) => !occupiedKeys.has(n.key));

        if (triggerSocketNeighbors.length >= 1) {
          const s1 = triggerSocketNeighbors[0];
          starterStacks.push({
            q: s1.q,
            r: s1.r,
            key: s1.key,
            stack: [
              targets[1 % targets.length].colorIndex,
              targets[1 % targets.length].colorIndex,
              primaryColor,
              primaryColor,
              primaryColor,
              primaryColor,
              primaryColor,
              primaryColor
            ]
          });
          occupiedKeys.add(s1.key);
        }
      }
    }

    const desiredStarters = gridRadius === 1 ? 2 : gridRadius === 2 ? 3 : 5;
    for (let i = 0; i < allCoords.length && starterStacks.length < desiredStarters; i++) {
      const idx = (i * 5 + levelNum + seedVariant) % allCoords.length;
      const c = allCoords[idx];
      if (occupiedKeys.has(c.key) || (c.q === 0 && c.r === 0)) continue;

      const c1 = targets[starterStacks.length % targets.length].colorIndex;
      const c2 = activeColors[(c1 + 1 + Math.floor(rng() * (activeColors.length - 1))) % activeColors.length];
      // Ensure neighbor doesn't already have c2 on top so initial board is in equilibrium
      const hasSameTopNeighbor = starterStacks.some(
        (s) => axialDistance(s.q, s.r, c.q, c.r) === 1 && getTopColor(s.stack) === c2
      );
      const topC = hasSameTopNeighbor ? c1 : c2;
      const botC = topC === c1 ? c2 : c1;

      starterStacks.push({
        q: c.q,
        r: c.r,
        key: c.key,
        stack: [botC, botC, topC, topC, topC]
      });
      occupiedKeys.add(c.key);
    }

    // Initial tray wave: provide a crisp opening wave that connects with starterStacks
    const firstTargetColor = targets[0].colorIndex;
    const secondTargetColor = targets[1 % targets.length].colorIndex;
    const thirdColor = activeColors[(secondTargetColor + 1) % activeColors.length];
    const initialTray = [
      [firstTargetColor, firstTargetColor, firstTargetColor, firstTargetColor],
      [secondTargetColor, firstTargetColor, firstTargetColor, firstTargetColor],
      [thirdColor, secondTargetColor, secondTargetColor, secondTargetColor]
    ];

    return {
      level: levelNum,
      id: `LVL-${String(levelNum).padStart(3, '0')}`,
      name: LEVEL_TITLES[levelNum - 1] || `Atelier Commission ${levelNum}`,
      chapter: chapterObj.chapter,
      chapterName: chapterObj.name,
      seed: seedStr,
      gridRadius,
      gridSlots,
      activeColors,
      activeColorKeys,
      anvils,
      frozenCells,
      starterStacks,
      initialTray,
      objective: {
        type: 'color_clear',
        targets,
        totalDiscsGoal: totalGoal
      },
      rewards: {
        vinylClay: 40 + chapterObj.chapter * 15 + (levelNum % 10 === 0 ? 50 : 0),
        glazeDrops: 10 + chapterObj.chapter * 5,
        starThresholds: [
          totalGoal * 10,
          totalGoal * 18,
          totalGoal * 26
        ]
      },
      isFtue: false,
      ftueSteps: []
    };
  }

  /**
   * Builds and verifies all 100 static campaign levels (1..100).
   * Bakes deterministic `staticTrayWaves` and solver-calibrated Turn Par (`par3Moves`, `par2Moves`)
   * directly onto each of the 100 campaign levels, leaving procedural generation for Endless Mode (101+).
   */
  function buildAll100Levels() {
    const levels = [];
    for (let lvl = 1; lvl <= 100; lvl++) {
      let chosen = null;
      let chosenRes = null;
      for (let variant = 1; variant <= 25; variant++) {
        const candidate = buildCandidateLevel(lvl, variant);
        const res = simulateLevelWithSolver(candidate, { maxMoves: 180 });
        if (res.won) {
          chosen = candidate;
          chosenRes = res;
          break;
        }
      }
      if (!chosen) {
        chosen = buildCandidateLevel(lvl, 1);
        chosenRes = simulateLevelWithSolver(chosen, { maxMoves: 180 });
      }

      // Bake static tray waves and solver-tested turn par for Campaign Levels 1..100
      const baseWaves = Array.isArray(chosenRes && chosenRes.generatedWaves)
        ? chosenRes.generatedWaves.map((w) => w.map((s) => [...s]))
        : [chosen.initialTray.map((s) => [...s])];
      const tailRng = createMulberry32(hashSeedString(`${chosen.seed}-STATIC-WAVES`));
      while (baseWaves.length < 36) {
        baseWaves.push([
          generateSmartTrayStack(null, tailRng, chosen),
          generateSmartTrayStack(null, tailRng, chosen),
          generateSmartTrayStack(null, tailRng, chosen)
        ]);
      }

      const solverMoves = Math.max(3, (chosenRes && chosenRes.movesTaken) || 8);
      const par3Moves = lvl === 1 ? 3 : solverMoves + 1;
      const par2Moves = lvl === 1 ? 5 : par3Moves + Math.max(3, Math.ceil(par3Moves * 0.35));

      chosen.isStaticCampaign = true;
      chosen.isEndless = false;
      chosen.staticTrayWaves = baseWaves;
      chosen.solverMoves = solverMoves;
      chosen.par3Moves = par3Moves;
      chosen.par2Moves = par2Moves;

      levels.push(chosen);
    }
    return levels;
  }

  const LEVELS = buildAll100Levels();
  const ENDLESS_CACHE = new Map();

  function buildEndlessLevel(levelNumber) {
    const lvlNum = Math.max(101, Math.floor(Number(levelNumber) || 101));
    if (ENDLESS_CACHE.has(lvlNum)) return ENDLESS_CACHE.get(lvlNum);

    const endlessStage = lvlNum - 100;
    const seedStr = `POPSTACKS-ENDLESS-${lvlNum}`;
    const rng = createMulberry32(hashSeedString(seedStr));

    // Endless Mode alternates between complex 37-slot Grand Boards and high-density 19-slot Crucibles
    const gridRadius = endlessStage % 4 === 0 ? 2 : 3;
    const gridSlots = getSlotsForRadius(gridRadius);
    const activeColors = [0, 1, 2, 3, 4, 5];
    const activeColorKeys = activeColors.map(getColorKey);

    const anvils = [];
    const occupiedKeys = new Set();
    const anvilPatterns = gridRadius === 2 ? ANVIL_PATTERNS_19 : ANVIL_PATTERNS_37;
    const rawPattern = anvilPatterns[(lvlNum + endlessStage) % anvilPatterns.length];
    rawPattern.forEach((p) => {
      const k = cellKey(p.q, p.r);
      anvils.push({ q: p.q, r: p.r, key: k });
      occupiedKeys.add(k);
    });

    // Goal scales smoothly with endless stage
    const totalGoal = Math.min(180, 90 + Math.floor((endlessStage - 1) / 2) * 10);
    const numTargets = 4;
    const targets = [];
    let remainingGoal = totalGoal;
    for (let i = 0; i < numTargets; i++) {
      const cId = activeColors[(i + endlessStage) % activeColors.length];
      const meta = getColorMeta(cId);
      const count =
        i === numTargets - 1
          ? remainingGoal
          : Math.max(10, Math.round(remainingGoal / (numTargets - i) / 10) * 10);
      remainingGoal -= count;
      targets.push({
        colorId: meta.key,
        colorIndex: meta.id,
        key: meta.key,
        id: meta.id,
        name: meta.name,
        count
      });
    }

    // Frozen clay obstacles scale from 3 up to 5 with iceHp 2..3
    const frozenCells = [];
    const candidateFrozenCoords =
      gridRadius === 2
        ? [
            { q: 0, r: 0 },
            { q: 1, r: 0 },
            { q: 0, r: 1 },
            { q: -1, r: 1 },
            { q: -1, r: 0 },
            { q: 0, r: -1 },
            { q: 1, r: -1 }
          ]
        : [
            { q: 0, r: 0 },
            { q: 1, r: 0 },
            { q: 0, r: 1 },
            { q: -1, r: 1 },
            { q: -1, r: 0 },
            { q: 0, r: -1 },
            { q: 1, r: -1 },
            { q: 2, r: -1 },
            { q: -2, r: 1 },
            { q: 0, r: 2 },
            { q: 0, r: -2 }
          ];
    const desiredFrozenCount = Math.min(gridRadius === 2 ? 3 : 5, 3 + Math.floor(endlessStage / 8));
    for (let i = 0; i < candidateFrozenCoords.length && frozenCells.length < desiredFrozenCount; i++) {
      const fc = candidateFrozenCoords[(i + lvlNum) % candidateFrozenCoords.length];
      const k = cellKey(fc.q, fc.r);
      if (occupiedKeys.has(k)) continue;
      const iceHp = frozenCells.length === 0 ? 1 : 2 + ((endlessStage + i) % 2);
      const topTargetColor = targets[frozenCells.length % targets.length].colorIndex;
      const bottomColor = activeColors[(topTargetColor + 1) % activeColors.length];
      frozenCells.push({
        q: fc.q,
        r: fc.r,
        key: k,
        stack: [bottomColor, bottomColor, topTargetColor, topTargetColor, topTargetColor, topTargetColor],
        iceHp
      });
      occupiedKeys.add(k);
    }

    const starterStacks = [];
    const allCoords = generateAxialGridCoords(gridRadius);
    const desiredStarters = gridRadius === 2 ? 4 : 6;
    for (let i = 0; i < allCoords.length && starterStacks.length < desiredStarters; i++) {
      const idx = (i * 7 + lvlNum) % allCoords.length;
      const c = allCoords[idx];
      if (occupiedKeys.has(c.key) || (c.q === 0 && c.r === 0)) continue;
      const c1 = targets[starterStacks.length % targets.length].colorIndex;
      const c2 = activeColors[(c1 + 1 + Math.floor(rng() * 4)) % activeColors.length];
      starterStacks.push({
        q: c.q,
        r: c.r,
        key: c.key,
        stack: [c1, c1, c2, c2, c2]
      });
      occupiedKeys.add(c.key);
    }

    const firstTargetColor = targets[0].colorIndex;
    const secondTargetColor = targets[1].colorIndex;
    const thirdColor = targets[2].colorIndex;
    const endlessDef = {
      level: lvlNum,
      id: `ENDLESS-${lvlNum}`,
      name: `Endless Atelier #${endlessStage}`,
      chapter: 11,
      chapterName: 'Endless Atelier',
      isEndless: true,
      seed: seedStr,
      gridRadius,
      gridSlots,
      activeColors,
      activeColorKeys,
      anvils,
      frozenCells,
      starterStacks,
      initialTray: [
        [firstTargetColor, firstTargetColor, firstTargetColor, firstTargetColor],
        [secondTargetColor, firstTargetColor, firstTargetColor, firstTargetColor],
        [thirdColor, secondTargetColor, secondTargetColor, secondTargetColor]
      ],
      objective: {
        type: 'color_clear',
        targets,
        totalDiscsGoal: totalGoal
      },
      rewards: {
        vinylClay: 150,
        glazeDrops: 50,
        starThresholds: [totalGoal * 10, totalGoal * 18, totalGoal * 26]
      },
      staticTrayWaves: null,
      par3Moves: Math.max(12, Math.round(totalGoal * 0.36)),
      par2Moves: Math.max(16, Math.round(totalGoal * 0.5)),
      isFtue: false,
      ftueSteps: []
    };

    ENDLESS_CACHE.set(lvlNum, endlessDef);
    return endlessDef;
  }

  function getLevelConfig(levelNumber) {
    const num = Math.max(1, Math.floor(Number(levelNumber) || 1));
    if (num > 100) {
      return buildEndlessLevel(num);
    }
    return LEVELS[num - 1];
  }

  // ===========================================================================
  // 7. 60 Unique Collectible Vinyl Figurines Catalog (10 Series × 6 Figurines)
  // ===========================================================================
  const RAW_SERIES_SPECS = [
    {
      seriesId: 'series-1',
      seriesName: 'Botanical Spirits',
      chapter: 1,
      themeColor: '#2EC4B6',
      items: [
        ['Mossy Sproutling', 'Common', '#2EC4B6', '#FF5964', '#F4B942', 'sprout', 'leaf', 'A dew-kissed vinyl seedling sculpted from soft mint clay.'],
        ['Fern Whisperer', 'Common', '#2EC4B6', '#386FA4', '#FFFDF7', 'ears', 'cross', 'Listens to the gentle pop of ceramic glazes cooling in the kiln.'],
        ['Bonsai Kodama', 'Rare', '#1E968B', '#F4B942', '#FF8A92', 'spirit', 'circle', 'Hums a harmonic pentatonic chord whenever 10 discs align.'],
        ['Lotus Dew Guardian', 'Rare', '#FF5964', '#2EC4B6', '#F9D37D', 'crown', 'diamond', 'Crowned with a matte coral petal that repels kiln soot.'],
        ['Succulent Golem', 'Epic', '#2EC4B6', '#845EC2', '#F4B942', 'golem', 'hexagon', 'Chunky geometric rosettes cast in dual-durometer art vinyl.'],
        ['Elder Camellia Spirit', 'Legendary', '#FF5964', '#2EC4B6', '#F4B942', 'spirit', 'star', 'First-edition botanical centerpiece stamped with a golden leaf seal.']
      ]
    },
    {
      seriesId: 'series-2',
      seriesName: 'Kitsune & Folklore',
      chapter: 2,
      themeColor: '#FF5964',
      items: [
        ['Inari Cubs', 'Common', '#FF5964', '#FFF9F9', '#F4B942', 'fox', 'circle', 'Playful shrine fox with a hand-brushed vermilion tail tip.'],
        ['Lantern Tanuki', 'Common', '#F9844A', '#F4B942', '#386FA4', 'ears', 'diamond', 'Carries a warm paper lantern through the foundry night.'],
        ['Torii Gate Sentinel', 'Rare', '#D63B46', '#F4B942', '#1A3958', 'fox', 'triangle', 'Stands watch beside the brass anvil pedestals.'],
        ['Moonlit Nine-Tails', 'Rare', '#845EC2', '#FF5964', '#F9D37D', 'fox', 'star', 'Swirling plum and coral tails cast from a 9-part split mold.'],
        ['Tengu Mask Sculpt', 'Epic', '#FF5964', '#1A3958', '#F4B942', 'crown', 'hexagon', 'Bold matte crimson lacquer paired with gilded brow ridges.'],
        ['Celestial Kitsune Okami', 'Legendary', '#FFF9F9', '#FF5964', '#F4B942', 'fox', 'star', 'Mythic shrine guardian with embossed gold-foil cloud motifs.']
      ]
    },
    {
      seriesId: 'series-3',
      seriesName: 'Astral Voyagers',
      chapter: 3,
      themeColor: '#386FA4',
      items: [
        ['Starhopper Cadet', 'Common', '#386FA4', '#F4B942', '#FFF9F9', 'helmet', 'triangle', 'Bubble-visor vinyl astronaut ready for zero-gravity stack sorting.'],
        ['Nebula Peeper', 'Common', '#845EC2', '#2EC4B6', '#F9D37D', 'owl', 'star', 'Wide cosmic eyes that track parabolic disc trajectories.'],
        ['Comet Drifter', 'Rare', '#386FA4', '#FF5964', '#6AE0D5', 'helmet', 'circle', 'Leaves a trail of shimmering pastel stardust across the hex board.'],
        ['Lunar Rover Bot', 'Rare', '#F4B942', '#386FA4', '#FF5964', 'robo', 'hexagon', 'Six-wheeled vinyl automaton built for cratered hex grids.'],
        ['Pulsar Navigator', 'Epic', '#62409B', '#2EC4B6', '#F4B942', 'spirit', 'diamond', 'Glows with internal ultraviolet pigment between dark-clay layers.'],
        ['Sovereign of Saturn', 'Legendary', '#386FA4', '#F4B942', '#FF5964', 'crown', 'star', 'Surrounded by a floating halo of miniature hexagonal vinyl discs.']
      ]
    },
    {
      seriesId: 'series-4',
      seriesName: 'Matcha Tea House',
      chapter: 4,
      themeColor: '#2EC4B6',
      items: [
        ['Whisked Foam Cat', 'Common', '#2EC4B6', '#FFFDF7', '#F4B942', 'cat', 'circle', 'Curled atop a warm ceramic chawan with frothy jade ears.'],
        ['Yuzu Mochi Bun', 'Common', '#F4B942', '#2EC4B6', '#FF5964', 'sprout', 'diamond', 'Squishy matte vinyl finish scented with imaginary citrus zest.'],
        ['Raku Teapot Golem', 'Rare', '#CD5F28', '#2EC4B6', '#FFF9F5', 'golem', 'hexagon', 'Crackle-glazed terracotta body that loves adjacent 10-disc bursts.'],
        ['Sakura Wagashi Spirit', 'Rare', '#FF8A92', '#2EC4B6', '#F4B942', 'spirit', 'cross', 'Delicate pastel petals pressed with an artisan wooden confections mold.'],
        ['Cast-Iron Tetsubin Owl', 'Epic', '#1A3958', '#2EC4B6', '#F4B942', 'owl', 'triangle', 'Textured hobnail surface inspired by heritage南部鉄器 kettles.'],
        ['Grandmaster Sencha Fox', 'Legendary', '#1E968B', '#F4B942', '#FF5964', 'fox', 'star', 'Pours liquid gold glaze that thaws frozen clay on contact.']
      ]
    },
    {
      seriesId: 'series-5',
      seriesName: 'Terracotta Guardians',
      chapter: 5,
      themeColor: '#F9844A',
      items: [
        ['Kiln Ember Cub', 'Common', '#F9844A', '#F4B942', '#FFF9F5', 'ears', 'hexagon', 'Born from the warmest corner of the earthenware firing chamber.'],
        ['Canyon Clay Owl', 'Common', '#CD5F28', '#386FA4', '#F9D37D', 'owl', 'triangle', 'Banded with desert ochre, turquoise, and sun-baked sienna stripes.'],
        ['Sunstone Sentinel', 'Rare', '#F9844A', '#FF5964', '#F4B942', 'golem', 'diamond', 'Broad-shouldered vinyl guardian carved with geometric relief stamps.'],
        ['Adobe Crown Cat', 'Rare', '#F9844A', '#2EC4B6', '#FFF9F5', 'cat', 'circle', 'Wears a turquoise glaze collar around its warm terracotta neck.'],
        ['Obsidian & Ochre Colossus', 'Epic', '#9D4417', '#F4B942', '#2EC4B6', 'golem', 'hexagon', 'Heavyweight designer toy weighing in at 12 ounces of solid vinyl.'],
        ['Emperor of the Red Kiln', 'Legendary', '#F9844A', '#F4B942', '#FF5964', 'crown', 'star', 'Commanding centerpiece of the Terracotta Guardians collection.']
      ]
    },
    {
      seriesId: 'series-6',
      seriesName: 'Velvet Nocturne',
      chapter: 6,
      themeColor: '#845EC2',
      items: [
        ['Dusk Moth Sprite', 'Common', '#845EC2', '#F4B942', '#FBF9FF', 'spirit', 'star', 'Flocked matte plum wings with embossed lunar phase markings.'],
        ['Midnight Alley Cat', 'Common', '#462B73', '#FF5964', '#F9D37D', 'cat', 'circle', 'Pads silently across the studio workbench after midnight.'],
        ['Vesper Barn Owl', 'Rare', '#845EC2', '#2EC4B6', '#FFFDF7', 'owl', 'diamond', 'Heart-shaped porcelain face mask framed by deep violet plumage.'],
        ['Shadow Theatre Fox', 'Rare', '#62409B', '#F9844A', '#F4B942', 'fox', 'triangle', 'Articulated silhouette inspired by nocturnal festival puppetry.'],
        ['Dreamweaver Golem', 'Epic', '#845EC2', '#386FA4', '#F4B942', 'golem', 'hexagon', 'Stores echoing combo chimes inside its hollow resonance chamber.'],
        ['Nocturne Symphony Maestro', 'Legendary', '#462B73', '#F4B942', '#FF5964', 'crown', 'star', 'Conducts 5x cascade chains with a baton of spun brass.']
      ]
    },
    {
      seriesId: 'series-7',
      seriesName: 'Clockwork Brass',
      chapter: 7,
      themeColor: '#F4B942',
      items: [
        ['Gear-Eared Sprocket', 'Common', '#F4B942', '#386FA4', '#FFFDF7', 'robo', 'hexagon', 'Wind-up vinyl companion with a clickable brass ratchet key.'],
        ['Pendulum Owl', 'Common', '#CA8E1D', '#2EC4B6', '#FFF9F5', 'owl', 'diamond', 'Ticks in exact 60fps rhythm with the studio cascade engine.'],
        ['Steam-Valve Golem', 'Rare', '#F4B942', '#FF5964', '#1A3958', 'golem', 'circle', 'Vents miniature confetti puffs whenever a 10-disc stack bursts.'],
        ['Brass Anvil Automaton', 'Rare', '#F4B942', '#CD5F28', '#6AE0D5', 'robo', 'triangle', 'Forged from the very same alloy as the board anvil pedestals.'],
        ['Chrono-Kitsune', 'Epic', '#F4B942', '#845EC2', '#FF5964', 'fox', 'star', 'Interlocking bevel gears spin beneath its translucent amber tail.'],
        ['Grand Horologist Rex', 'Legendary', '#F4B942', '#1A3958', '#FF5964', 'crown', 'star', 'Masterpiece of the Clockwork Brass Conservatory series.']
      ]
    },
    {
      seriesId: 'series-8',
      seriesName: 'Coral Reef Atelier',
      chapter: 8,
      themeColor: '#FF5964',
      items: [
        ['Anemone Puff', 'Common', '#FF5964', '#2EC4B6', '#FFF9F9', 'sprout', 'circle', 'Soft coral tentacles sculpted with rounded tactile vinyl tips.'],
        ['Nautilus Diver', 'Common', '#386FA4', '#F9844A', '#F4B942', 'helmet', 'triangle', 'Porthole copper helmet peering into the sunken porcelain reef.'],
        ['Tidepool Sea-Cat', 'Rare', '#2EC4B6', '#FF5964', '#F9D37D', 'cat', 'cross', 'Collects smooth sea-glass discs along the 37-slot shoreline.'],
        ['Reef Citadel Golem', 'Rare', '#FF5964', '#845EC2', '#2EC4B6', 'golem', 'hexagon', 'Living coral architecture encrusted onto volcanic basalt clay.'],
        ['Abyssal Lantern Spirit', 'Epic', '#1A3958', '#2EC4B6', '#FF5964', 'spirit', 'diamond', 'Bioluminescent teal lure illuminates deep-board sub-discs.'],
        ['Poseidon of the Kiln', 'Legendary', '#2EC4B6', '#FF5964', '#F4B942', 'crown', 'star', 'Regal maritime art toy finished in iridescent mother-of-pearl glaze.']
      ]
    },
    {
      seriesId: 'series-9',
      seriesName: 'Origami Fold',
      chapter: 9,
      themeColor: '#386FA4',
      items: [
        ['Paper Crane Chick', 'Common', '#FFFDF7', '#FF5964', '#386FA4', 'owl', 'triangle', 'Crisp faceted planes cast to mimic folded washi cardstock.'],
        ['Faceted Fox Kitsune', 'Common', '#F9844A', '#FFF9F5', '#F4B942', 'fox', 'diamond', 'Sharp polyhedral angles softened by a warm satin vinyl coat.'],
        ['Modular Hex Cube Bot', 'Rare', '#386FA4', '#2EC4B6', '#F4B942', 'robo', 'hexagon', 'Assembled from six interlocking sonobe vinyl modules.'],
        ['Creased Crown Cat', 'Rare', '#845EC2', '#F4B942', '#FFF9F9', 'cat', 'star', 'Every ear fold aligns with the 60-degree axial grid geometry.'],
        ['Kusudama Blossom Spirit', 'Epic', '#FF5964', '#F4B942', '#2EC4B6', 'spirit', 'circle', 'Geometric floral sphere celebrating symmetrical 6-neighbor merges.'],
        ['Zenith Senbazuru Dragon', 'Legendary', '#F4B942', '#FF5964', '#386FA4', 'crown', 'star', 'The 1,000th fold immortalized in museum-grade art vinyl.']
      ]
    },
    {
      seriesId: 'series-10',
      seriesName: "Golden Founder's Vault",
      chapter: 10,
      themeColor: '#F4B942',
      items: [
        ['Apprentice Ollie (Classic)', 'Rare', '#F9844A', '#386FA4', '#F4B942', 'owl', 'circle', 'Ollie in his signature cobalt sculptor apron and clay-dusted goggles.'],
        ['Kiln-Fired Ollie (Terracotta)', 'Epic', '#CD5F28', '#F4B942', '#2EC4B6', 'owl', 'hexagon', 'Raw unglazed terracotta edition commemorating the 50th workshop commission.'],
        ['Astral Ollie (Starlight)', 'Epic', '#845EC2', '#2EC4B6', '#F4B942', 'owl', 'star', 'Nebula-dipped variant of Ollie holding a glowing mint vinyl disc.'],
        ['Clockwork Ollie (Brass Edition)', 'Legendary', '#F4B942', '#1A3958', '#FF5964', 'owl', 'diamond', 'Precision-machined brass plumage with bespoke engraved serial plate.'],
        ['Porcelain Mint Ollie (VIP)', 'Mythic', '#2EC4B6', '#FFFDF7', '#F4B942', 'owl', 'cross', 'Ultra-rare celadon glaze variant reserved for 37-Slot Grand Atelier masters.'],
        ["Founder's Golden Ollie (Level 100)", 'Mythic', '#F4B942', '#FF5964', '#FFFDF7', 'crown', 'star', '24-karat gold-leaf vinyl trophy awarded upon conquering all 100 Atelier levels!']
      ]
    }
  ];

  const FIGURINES = [];
  const FIGURINE_SERIES = RAW_SERIES_SPECS.map((sSpec, sIdx) => {
    const seriesFigurines = sSpec.items.map((item, fIdx) => {
      const globalIdx = sIdx * 6 + fIdx + 1;
      const unlockLevel = Math.min(100, sIdx * 10 + fIdx * 2 + 1);
      const rarity = item[1];
      const moldCost =
        rarity === 'Common'
          ? 80
          : rarity === 'Rare'
          ? 140
          : rarity === 'Epic'
          ? 220
          : rarity === 'Legendary'
          ? 340
          : 500;

      const fig = {
        id: `fig-${String(globalIdx).padStart(2, '0')}`,
        seriesId: sSpec.seriesId,
        seriesName: sSpec.seriesName,
        seriesIndex: sIdx + 1,
        indexInSeries: fIdx + 1,
        name: item[0],
        rarity,
        primaryColor: item[2],
        secondaryColor: item[3],
        accentColor: item[4],
        silhouetteType: item[5],
        stampMotif: item[6],
        unlockLevel,
        moldCost,
        blurb: item[7]
      };
      FIGURINES.push(fig);
      return fig;
    });

    return {
      id: sSpec.seriesId,
      seriesId: sSpec.seriesId,
      seriesName: sSpec.seriesName,
      name: sSpec.seriesName,
      chapter: sSpec.chapter,
      themeColor: sSpec.themeColor,
      figurines: seriesFigurines
    };
  });

  function getFigurineById(id) {
    return FIGURINES.find((f) => f.id === id) || FIGURINES[0];
  }

  function getFigurinesBySeries(seriesId) {
    const s = FIGURINE_SERIES.find((ser) => ser.seriesId === seriesId || ser.id === seriesId);
    return s ? s.figurines : [];
  }

  // ===========================================================================
  // 8. Daily Artisan Challenge Generator & Global Leaderboard Seed Data
  // ===========================================================================
  const DAILY_LEADERBOARD = [
    {
      rank: 1,
      handle: 'KitsuneKiln_JP',
      title: 'Grand Sculptor',
      avatarSilhouette: 'fox',
      avatarColor: '#FF5964',
      score: 4820,
      moves: 18,
      bursts: 9,
      country: 'JP',
      badge: '🏆 Gold Mold'
    },
    {
      rank: 2,
      handle: 'StudioCeladon',
      title: 'Porcelain Master',
      avatarSilhouette: 'owl',
      avatarColor: '#2EC4B6',
      score: 4590,
      moves: 19,
      bursts: 8,
      country: 'KR',
      badge: '✨ 6x Chain'
    },
    {
      rank: 3,
      handle: 'BrassAnvil_Leo',
      title: 'Foundry Architect',
      avatarSilhouette: 'robo',
      avatarColor: '#F4B942',
      score: 4310,
      moves: 21,
      bursts: 8,
      country: 'DE',
      badge: '🔥 Thaw Pro'
    },
    {
      rank: 4,
      handle: 'MochiVinylCo',
      title: 'Senior Artisan',
      avatarSilhouette: 'cat',
      avatarColor: '#845EC2',
      score: 4120,
      moves: 22,
      bursts: 7,
      country: 'US',
      badge: '🎨 6-Color'
    },
    {
      rank: 5,
      handle: 'TerracottaTess',
      title: 'Kiln Specialist',
      avatarSilhouette: 'golem',
      avatarColor: '#F9844A',
      score: 3890,
      moves: 24,
      bursts: 7,
      country: 'CA',
      badge: '⚡ Speed Cast'
    },
    {
      rank: 6,
      handle: 'OrigamiFold_UK',
      title: 'Vinyl Collector',
      avatarSilhouette: 'crown',
      avatarColor: '#386FA4',
      score: 3640,
      moves: 25,
      bursts: 6,
      country: 'GB',
      badge: '🌟 Collector'
    },
    {
      rank: 7,
      handle: 'MatchaWhisk88',
      title: 'Ceramics Apprentice',
      avatarSilhouette: 'sprout',
      avatarColor: '#2EC4B6',
      score: 3410,
      moves: 27,
      bursts: 6,
      country: 'TW',
      badge: '🍵 Tea House'
    }
  ];

  const DAILY_MODIFIERS = [
    {
      name: 'Kiln Overdrive',
      desc: '5-Color 19-Slot Workshop with Twin Brass Anvils & Frosted Centerpiece.'
    },
    {
      name: 'Grand Atelier Exhibition',
      desc: '37-Slot Concentric Hex Table with symmetric Brass Anvil gates & 60-disc target.'
    },
    {
      name: 'Glaze & Frost Crucible',
      desc: 'Crack the hardened Frozen Clay shells around the center hex to unleash chain bursts.'
    },
    {
      name: 'Master Sculptor Speed Cast',
      desc: 'High-density starter stacks primed for immediate multi-color 10-disc bursts.'
    }
  ];

  /**
   * Deterministically generates a unique, solvable 19-slot or 37-slot Daily Artisan Challenge
   * for any `YYYY-MM-DD` date string.
   */
  function getDailyChallengeConfig(dateStr) {
    const cleanDate =
      typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())
        ? dateStr.trim()
        : new Date().toISOString().slice(0, 10);

    const dayHash = hashSeedString(`DAILY-ARTISAN-${cleanDate}`);
    const templateLevelNum = 32 + (dayHash % 65); // Maps into rich 19-slot / 37-slot Anvil + Frozen Clay levels (32..96)
    const baseLevel = getLevelConfig(templateLevelNum);
    const mod = DAILY_MODIFIERS[dayHash % DAILY_MODIFIERS.length];

    const dailyLeaderboard = DAILY_LEADERBOARD.map((entry, idx) => {
      const jitter = ((dayHash >> (idx + 1)) % 180) - 90;
      return {
        ...entry,
        score: Math.max(2400, entry.score + jitter)
      };
    }).sort((a, b) => b.score - a.score);
    dailyLeaderboard.forEach((e, i) => {
      e.rank = i + 1;
    });

    return {
      ...baseLevel,
      id: `DAILY-${cleanDate}`,
      isDailyChallenge: true,
      dateStr: cleanDate,
      name: `Daily Artisan: ${mod.name} (${cleanDate})`,
      modifierName: mod.name,
      modifierDesc: mod.desc,
      bonusClayReward: 150,
      leaderboard: dailyLeaderboard
    };
  }

  /**
   * Deterministically generates per-level Turn-Par ("Par Moves") star benchmarks (1★ / 2★ / 3★),
   * solver move targets, and social rivals for any puzzle level (`1..100+`).
   *
   * Star Rating Mechanics (Turn-Based Par):
   *  - 3⭐ (Master Sculptor): Completed in `<= par3Moves` turns (calibrated from solver test on static levels 1..100)
   *  - 2⭐ (Skilled Artisan): Completed in `<= par2Moves` turns
   *  - 1⭐ (Round Cleared):   Completed in `> par2Moves` turns
   */
  function getLevelSocialBenchmark(levelNumber = 1, customLevelDef = null) {
    const passedObj =
      levelNumber && typeof levelNumber === 'object' ? levelNumber : customLevelDef;
    const lvlNum = Math.max(
      1,
      Math.floor(Number(passedObj ? passedObj.level : levelNumber) || 1)
    );
    const def = passedObj || getLevelConfig(lvlNum);
    const goalDiscs = (def && def.objective && def.objective.totalDiscsGoal) || 30;
    const burstsNeeded = Math.max(2, Math.round(goalDiscs / 10));
    const h = hashSeedString(`SOCIAL-BENCHMARK-L${lvlNum}-${def ? def.id : ''}`);

    const solverMoves =
      def && typeof def.solverMoves === 'number'
        ? def.solverMoves
        : lvlNum === 1
        ? 3
        : Math.max(5, Math.round(goalDiscs * 0.32));
    const par3Moves =
      def && typeof def.par3Moves === 'number'
        ? def.par3Moves
        : lvlNum === 1
        ? 3
        : solverMoves + 1;
    const par2Moves =
      def && typeof def.par2Moves === 'number'
        ? def.par2Moves
        : lvlNum === 1
        ? 5
        : par3Moves + Math.max(3, Math.ceil(par3Moves * 0.35));

    const baseParScore = Math.max(600, Math.round(burstsNeeded * 300));
    const star1 = Math.round(burstsNeeded * 200);
    const star2 = Math.round(burstsNeeded * 450);
    const star3 = Math.round(burstsNeeded * 650);
    const minComboStar2 = 2;
    const minComboStar3 = 3;

    /**
     * Computes 1★ / 2★ / 3★ strictly from the number of turns (`movesTaken`) required to clear the level.
     */
    function computeStars(movesTaken) {
      const m = Math.max(1, Math.floor(Number(movesTaken) || 1));
      if (m <= par3Moves) return 3;
      if (m <= par2Moves) return 2;
      return 1;
    }

    const friendPools = [
      ['Sora V.', 'Maya K.', 'Kenji T.'],
      ['Hana S.', 'Leo C.', 'Noor A.'],
      ['Aiko T.', 'Mateo R.', 'Chloe W.'],
      ['Ren K.', 'Elena R.', 'Sam P.']
    ];
    const names = friendPools[h % friendPools.length];

    const rivals = [
      {
        handle: names[0],
        badge: `⭐⭐⭐ (${Math.max(2, par3Moves - 1)} turns)`,
        moves: Math.max(2, par3Moves - 1),
        score: Math.round((star3 * 1.18 + (h % 90)) / 10) * 10,
        maxCombo: 4 + (h % 3)
      },
      {
        handle: names[1],
        badge: `⭐⭐⭐ (${par3Moves} turns · Par)`,
        moves: par3Moves,
        score: Math.round((star3 * 1.02 + ((h >> 3) % 60)) / 10) * 10,
        maxCombo: 3 + (h % 2)
      },
      {
        handle: 'Community Avg',
        badge: `⭐⭐ (${par2Moves - 1} turns)`,
        moves: par2Moves - 1,
        score: Math.round((star2 * 1.04 + ((h >> 5) % 50)) / 10) * 10,
        maxCombo: 2
      },
      {
        handle: names[2],
        badge: `⭐ (${par2Moves + 3} turns)`,
        moves: par2Moves + 3,
        score: Math.round((baseParScore * 0.92 + ((h >> 7) % 40)) / 10) * 10,
        maxCombo: 1
      }
    ];

    function computeTopPercent(score, movesTaken = par3Moves) {
      const m = Number(movesTaken) || par3Moves;
      if (m < par3Moves) return 1;
      if (m === par3Moves) return 8;
      if (m <= par2Moves) return 25;
      return 58;
    }

    return {
      level: lvlNum,
      solverMoves,
      par3Moves,
      par2Moves,
      baseParScore,
      starThresholds: {
        par3Moves,
        par2Moves,
        star1,
        star2,
        star3,
        minComboStar2,
        minComboStar3
      },
      computeStars,
      rivals,
      computeTopPercent
    };
  }

  /**
   * Japanese Gashapon / Gacha Rarity Drop Rate Tables (N / R / SR / SSR / UR)
   * - First Gacha (`firstPull`, pull #1): 100% Guaranteed Random "Rare" item to welcome the player.
   * - Subsequent Pulls (`standard` / `boosted`, pull #2+): Common is the baseline (~85% standard / ~76% boosted)
   *   so pulling Rare, Epic, Legendary, or Mythic genuinely feels special and exciting!
   */
  const RARITY_DROP_RATES = {
    firstPull: [
      { rarity: 'Rare', gachaGrade: 'R', jpLabel: 'レア', weight: 100 }
    ],
    standard: [
      { rarity: 'Common', gachaGrade: 'N', jpLabel: 'ノーマル', weight: 85 },
      { rarity: 'Rare', gachaGrade: 'R', jpLabel: 'レア', weight: 10 },
      { rarity: 'Epic', gachaGrade: 'SR', jpLabel: 'Sレア', weight: 3.5 },
      { rarity: 'Legendary', gachaGrade: 'SSR', jpLabel: 'SSレア', weight: 1.2 },
      { rarity: 'Mythic', gachaGrade: 'UR', jpLabel: '超激レア', weight: 0.3 }
    ],
    boosted: [
      { rarity: 'Common', gachaGrade: 'N', jpLabel: 'ノーマル', weight: 76 },
      { rarity: 'Rare', gachaGrade: 'R', jpLabel: 'レア', weight: 15 },
      { rarity: 'Epic', gachaGrade: 'SR', jpLabel: 'Sレア', weight: 6 },
      { rarity: 'Legendary', gachaGrade: 'SSR', jpLabel: 'SSレア', weight: 2.3 },
      { rarity: 'Mythic', gachaGrade: 'UR', jpLabel: '超激レア', weight: 0.7 }
    ],
    pitySR: [
      { rarity: 'Epic', gachaGrade: 'SR', jpLabel: 'Sレア', weight: 65 },
      { rarity: 'Legendary', gachaGrade: 'SSR', jpLabel: 'SSレア', weight: 27 },
      { rarity: 'Mythic', gachaGrade: 'UR', jpLabel: '超激レア', weight: 8 }
    ],
    pitySSR: [
      { rarity: 'Legendary', gachaGrade: 'SSR', jpLabel: 'SSレア', weight: 78 },
      { rarity: 'Mythic', gachaGrade: 'UR', jpLabel: '超激レア', weight: 22 }
    ]
  };

  /**
   * Rolls a figurine using the Gacha rarity table:
   * - Pull #1 (`pullCount === 0`): Guaranteed random "Rare" item across the series.
   * - Pull #2+: High Common rate (85% standard / 76% boosted) so any non-Common pull feels truly special.
   */
  function rollRandomBlindBoxFigurine(options = {}) {
    const pullNum = Math.max(1, (Number(options.pullCount) || 0) + 1);
    const isForcedSSR = Boolean(options.forceSSR);
    const isForcedSR = !isForcedSSR && Boolean(options.forceSR);
    const isFirstGachaPull = pullNum === 1 && !isForcedSSR && !isForcedSR;

    const table = isForcedSSR
      ? RARITY_DROP_RATES.pitySSR
      : isForcedSR
      ? RARITY_DROP_RATES.pitySR
      : isFirstGachaPull
      ? RARITY_DROP_RATES.firstPull
      : options.boosted
      ? RARITY_DROP_RATES.boosted
      : RARITY_DROP_RATES.standard;

    const totalWeight = table.reduce((acc, r) => acc + r.weight, 0);
    let roll = Math.random() * totalWeight;
    let chosenRarity = table[0].rarity;
    for (let i = 0; i < table.length; i++) {
      roll -= table[i].weight;
      if (roll <= 0) {
        chosenRarity = table[i].rarity;
        break;
      }
    }

    const pool = FIGURINES.filter(
      (f) => String(f.rarity).toLowerCase() === chosenRarity.toLowerCase()
    );
    const list = pool.length > 0 ? pool : FIGURINES;

    const unlockedSet = new Set(Array.isArray(options.unlockedIds) ? options.unlockedIds : []);
    const recentList = Array.isArray(options.recentIds) ? options.recentIds : [];
    const recentSet = new Set(recentList.slice(-6));
    const recentSeriesSet = new Set(
      recentList
        .slice(-3)
        .map((id) => {
          const found = FIGURINES.find((f) => f.id === id);
          return found ? found.seriesId : null;
        })
        .filter(Boolean)
    );

    // Count how many figurines the player already owns per series (series-1..series-10)
    const ownedPerSeries = {};
    unlockedSet.forEach((id) => {
      const f = FIGURINES.find((item) => item.id === id);
      if (f && f.seriesId) {
        ownedPerSeries[f.seriesId] = (ownedPerSeries[f.seriesId] || 0) + 1;
      }
    });

    // Weight each candidate in the rarity pool for maximum cross-series variety & discovery
    const weightedCandidates = list.map((fig) => {
      let w = 1.0;
      const isOwned = unlockedSet.has(fig.id);
      const seriesOwnedCount = ownedPerSeries[fig.seriesId] || 0;

      // 1. Strong discovery boost for unowned figurines
      if (!isOwned) {
        w *= 3.8;
      } else {
        w *= 0.45;
      }

      // 2. Cross-Series Variety Boost: strongly favor series the player hasn't experienced yet!
      if (seriesOwnedCount === 0) {
        w *= 3.2;
      } else if (seriesOwnedCount === 1) {
        w *= 1.85;
      } else if (seriesOwnedCount >= 4) {
        w *= 0.65;
      }

      // 3. Avoid pulling from the exact same series back-to-back
      if (recentSeriesSet.has(fig.seriesId)) {
        w *= 0.35;
      }

      // 4. Featured Pickup Series (ピックアップ) Rate-Up
      if (options.pickupSeriesId && fig.seriesId === options.pickupSeriesId) {
        w *= 2.4;
      }

      // 5. Strict Anti-Repeat Guard against recently pulled figurines
      if (recentSet.has(fig.id)) {
        w *= 0.04;
      }

      return { fig, weight: Math.max(0.01, w) };
    });

    const candidateTotal = weightedCandidates.reduce((sum, item) => sum + item.weight, 0);
    let pickRoll = Math.random() * candidateTotal;
    for (let i = 0; i < weightedCandidates.length; i++) {
      pickRoll -= weightedCandidates[i].weight;
      if (pickRoll <= 0) {
        return weightedCandidates[i].fig;
      }
    }
    return weightedCandidates[weightedCandidates.length - 1].fig;
  }

  // Color adjustment helpers for per-figurine cosmetic kits
  function hexToRgbObj(hex) {
    const clean = String(hex || '#888888').replace('#', '').trim();
    const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16) || 0;
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbToHexStr(r, g, b) {
    const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
    return (
      '#' +
      [clamp(r), clamp(g), clamp(b)]
        .map((v) => v.toString(16).padStart(2, '0'))
        .join('')
        .toUpperCase()
    );
  }

  function mixHexColors(hexA, hexB, weightB = 0.5) {
    const a = hexToRgbObj(hexA);
    const b = hexToRgbObj(hexB);
    const w = Math.max(0, Math.min(1, weightB));
    return rgbToHexStr(
      a.r * (1 - w) + b.r * w,
      a.g * (1 - w) + b.g * w,
      a.b * (1 - w) + b.b * w
    );
  }

  function shadeHexColor(hex, factor = -0.2) {
    if (factor >= 0) return mixHexColors(hex, '#FFFFFF', factor);
    return mixHexColors(hex, '#100C0D', -factor);
  }

  function makeDiscColorEntry(id, key, name, topHex, stamp, symbol, inkHex = '#FFFDF7', extra = {}) {
    return {
      id,
      key,
      name,
      top: topHex,
      topHighlight: extra.topHighlight || shadeHexColor(topHex, 0.36),
      topShadow: extra.topShadow || shadeHexColor(topHex, -0.22),
      side: extra.side || shadeHexColor(topHex, -0.32),
      rim: extra.rim || shadeHexColor(topHex, 0.38),
      well: extra.well || shadeHexColor(topHex, -0.36),
      border: extra.border || '#231F20',
      ink: inkHex,
      stamp,
      symbol,
      figAccent: extra.figAccent || '#FFD166',
      figIndex: extra.figIndex || 0
    };
  }

  const SERIES_COSMETIC_ARCHETYPES = {
    'series-1': {
      kitTitle: 'Botanical Forest Kit',
      discStyle: 'botanical',
      discStyleLabel: 'Carved Cedar Wood-Slice & Leaf Tiles',
      isDarkStage: false,
      stageBgTop: '#DDF2E5',
      stageBgBottom: '#A6D8BC',
      deckStop0: '#E8F8EE',
      deckStop1: '#BEE6CE',
      deckStop2: '#89BFA2',
      rimFill: '#285943',
      rimStroke: '#143325',
      socketOuter: '#F2FCF6',
      socketWell: '#A8D4BC',
      socketStroke: '#669E82',
      trayDeck: '#F2FAF5',
      trayLip: '#78A88D',
      traySlotFill: '#E1F3E8',
      traySlotStroke: '#528A6D',
      sideBarkHex: '#5A381E',
      borderHex: '#2D1B0E',
      wellHex: '#3B2313',
      // Vibrant forest jewel color variants (Berry Rose, Deep Moss, Sunlit Pollen, Brook Cyan, Wild Orchid, Maple Amber)
      baseDiscHexes: ['#E6194B', '#118AB2', '#F5B700', '#06A77D', '#9B5DE5', '#E85D04']
    },
    'series-2': {
      kitTitle: 'Urushi Shrine Kit',
      discStyle: 'lacquer',
      discStyleLabel: 'Black Urushi Lacquer & Gold Maki-e Tiles',
      isDarkStage: false,
      stageBgTop: '#FFE6DE',
      stageBgBottom: '#F2B2A2',
      deckStop0: '#FFF2EC',
      deckStop1: '#F7C6B8',
      deckStop2: '#DF9280',
      rimFill: '#8B1E22',
      rimStroke: '#420B0D',
      socketOuter: '#FFF8F5',
      socketWell: '#E6ADA0',
      socketStroke: '#B86B5A',
      trayDeck: '#FFF7F2',
      trayLip: '#C47262',
      traySlotFill: '#FCE6E0',
      traySlotStroke: '#9E3B33',
      sideBarkHex: '#1A0E12',
      borderHex: '#FFD166',
      wellHex: '#180B0E',
      // Shrine Vermilion, Indigo Night, Imperial Gold, Torii Jade, Wisteria Royal, Foxfire Tangerine
      baseDiscHexes: ['#D90429', '#1D3557', '#FFB703', '#00A896', '#7209B7', '#FB5607']
    },
    'series-3': {
      kitTitle: 'Deep Space Nebula Kit',
      discStyle: 'astral',
      discStyleLabel: 'Cyber-Neon Plasma & Obsidian Hex Pods',
      isDarkStage: true,
      stageBgTop: '#1A2340',
      stageBgBottom: '#0E1326',
      deckStop0: '#283866',
      deckStop1: '#1B264B',
      deckStop2: '#111833',
      rimFill: '#3A508C',
      rimStroke: '#0A0E1F',
      socketOuter: '#2F4278',
      socketWell: '#162040',
      socketStroke: '#4CC9F0',
      trayDeck: '#1D2747',
      trayLip: '#10172E',
      traySlotFill: '#141C36',
      traySlotStroke: '#4CC9F0',
      sideBarkHex: '#0B1026',
      borderHex: '#00F5D4',
      wellHex: '#090D20',
      // Electric Neon Plasma variants
      baseDiscHexes: ['#FF007F', '#00D2FF', '#FFE600', '#00FF9D', '#B5179E', '#FF5E00']
    },
    'series-4': {
      kitTitle: 'Ceremonial Matcha Kit',
      discStyle: 'matcha',
      discStyleLabel: 'Crackle-Glaze Raku Ceramic & Sakura Tiles',
      isDarkStage: false,
      stageBgTop: '#ECF4D8',
      stageBgBottom: '#C2D69C',
      deckStop0: '#F5F9E9',
      deckStop1: '#D8E6B8',
      deckStop2: '#B5C98A',
      rimFill: '#4A3728',
      rimStroke: '#261B12',
      socketOuter: '#FAFDF2',
      socketWell: '#C4D69E',
      socketStroke: '#889E5E',
      trayDeck: '#F9FCF0',
      trayLip: '#98AD72',
      traySlotFill: '#EBF2D8',
      traySlotStroke: '#6B7F46',
      sideBarkHex: '#59483B',
      borderHex: '#3A2B20',
      wellHex: '#FAF3E0',
      // Pastel Wagashi & Raku Ceramic Glaze colors
      baseDiscHexes: ['#FF5D8F', '#2B7A9B', '#F4C430', '#48A96A', '#8A5CF5', '#D96B43']
    },
    'series-5': {
      kitTitle: 'Red Kiln Canyon Kit',
      discStyle: 'terracotta',
      discStyleLabel: 'Chiseled Sandstone & Turquoise Inlay Tablets',
      isDarkStage: false,
      stageBgTop: '#FDE4CE',
      stageBgBottom: '#E0A378',
      deckStop0: '#FFF1E4',
      deckStop1: '#F0C09C',
      deckStop2: '#D48F62',
      rimFill: '#6E2B1C',
      rimStroke: '#36120A',
      socketOuter: '#FFF7F0',
      socketWell: '#DFAA84',
      socketStroke: '#AC6C44',
      trayDeck: '#FFF5EB',
      trayLip: '#C27E54',
      traySlotFill: '#FAE4D2',
      traySlotStroke: '#96522E',
      sideBarkHex: '#4F2013',
      borderHex: '#36120A',
      wellHex: '#2C120A',
      // Canyon Jasper, Lapis, Sunstone, Turquoise, Geode, Adobe
      baseDiscHexes: ['#C92A2A', '#1864AB', '#F08C00', '#0CA678', '#6741D9', '#D9480F']
    },
    'series-6': {
      kitTitle: 'Moonlit Velvet Kit',
      discStyle: 'nocturne',
      discStyleLabel: 'Gothic Stained-Glass & Moon-Gold Tarot Tiles',
      isDarkStage: true,
      stageBgTop: '#26183B',
      stageBgBottom: '#130B20',
      deckStop0: '#3C265C',
      deckStop1: '#281840',
      deckStop2: '#190E29',
      rimFill: '#7B4B94',
      rimStroke: '#12081E',
      socketOuter: '#472E6B',
      socketWell: '#211336',
      socketStroke: '#C77DFF',
      trayDeck: '#2A1B42',
      trayLip: '#170E26',
      traySlotFill: '#1E1230',
      traySlotStroke: '#9D4EDD',
      sideBarkHex: '#180B29',
      borderHex: '#FDE047',
      wellHex: '#120721',
      // Stained Glass Tarot Jewels
      baseDiscHexes: ['#FF2A55', '#3B82F6', '#FACC15', '#10B981', '#A855F7', '#F97316']
    },
    'series-7': {
      kitTitle: 'Clockwork Brass Kit',
      discStyle: 'clockwork',
      discStyleLabel: '12-Tooth Brass Gear Cog & Copper Dial Tiles',
      isDarkStage: false,
      stageBgTop: '#EFE5CE',
      stageBgBottom: '#C8B082',
      deckStop0: '#FAF2E1',
      deckStop1: '#E2CEAA',
      deckStop2: '#C2A676',
      rimFill: '#6B4722',
      rimStroke: '#33200D',
      socketOuter: '#FCF7EB',
      socketWell: '#D1BA90',
      socketStroke: '#9B7B48',
      trayDeck: '#FAF3E6',
      trayLip: '#A88854',
      traySlotFill: '#EFE3CA',
      traySlotStroke: '#806030',
      sideBarkHex: '#5C3D18',
      borderHex: '#42280B',
      wellHex: '#291B0C',
      // Steampunk Enamel & Brass Gear colors
      baseDiscHexes: ['#DC2626', '#1E40AF', '#EAB308', '#0D9488', '#7C3AED', '#EA580C']
    },
    'series-8': {
      kitTitle: 'Coral Lagoon Kit',
      discStyle: 'reef',
      discStyleLabel: 'Iridescent Mother-of-Pearl & Sea-Glass Tiles',
      isDarkStage: false,
      stageBgTop: '#D4F5F7',
      stageBgBottom: '#8AD6E2',
      deckStop0: '#EAFCFD',
      deckStop1: '#B5E8F0',
      deckStop2: '#7DC8D6',
      rimFill: '#166078',
      rimStroke: '#093140',
      socketOuter: '#F2FEFF',
      socketWell: '#9CDCE6',
      socketStroke: '#4FA3B5',
      trayDeck: '#F0FDFF',
      trayLip: '#66B6C4',
      traySlotFill: '#DCF7FA',
      traySlotStroke: '#2E8B9E',
      sideBarkHex: '#0F4C64',
      borderHex: '#083344',
      wellHex: '#E0F7FA',
      // Tropical Lagoon & Mother-of-Pearl colors
      baseDiscHexes: ['#FF3864', '#0284C7', '#FBBF24', '#00C4B4', '#8B5CF6', '#FF6B35']
    },
    'series-9': {
      kitTitle: 'Washi Origami Kit',
      discStyle: 'origami',
      discStyleLabel: '6-Facet Low-Poly Folded Washi Paper Tiles',
      isDarkStage: false,
      stageBgTop: '#EAF0FC',
      stageBgBottom: '#BCCDF0',
      deckStop0: '#F7FAFF',
      deckStop1: '#D6E2F9',
      deckStop2: '#AEC0EA',
      rimFill: '#2B4C7E',
      rimStroke: '#142747',
      socketOuter: '#FFFFFF',
      socketWell: '#C4D4F2',
      socketStroke: '#7E9BCE',
      trayDeck: '#F7FAFF',
      trayLip: '#8CA6D6',
      traySlotFill: '#E6EEFC',
      traySlotStroke: '#5276B0',
      sideBarkHex: '#253859',
      borderHex: '#14213D',
      wellHex: '#FFFFFF',
      // Crisp Washi Paper colors
      baseDiscHexes: ['#EF233C', '#2563EB', '#F59E0B', '#14B8A6', '#8B5CF6', '#F97316']
    },
    'series-10': {
      kitTitle: 'Obsidian & 24K Gold Kit',
      discStyle: 'gilded',
      discStyleLabel: '24K Gold-Bullion Bezel & Faceted Jewel Tiles',
      isDarkStage: true,
      stageBgTop: '#261F1B',
      stageBgBottom: '#120E0C',
      deckStop0: '#3D332E',
      deckStop1: '#29221F',
      deckStop2: '#181412',
      rimFill: '#D4A349',
      rimStroke: '#5C4010',
      socketOuter: '#4A3E38',
      socketWell: '#211B18',
      socketStroke: '#D4A349',
      trayDeck: '#2B2320',
      trayLip: '#B88A32',
      traySlotFill: '#1C1715',
      traySlotStroke: '#D4A349',
      sideBarkHex: '#9A6B16',
      borderHex: '#FDE047',
      wellHex: '#1C1308',
      // Royal Crown Jewel colors framed in 24K Gold
      baseDiscHexes: ['#E11D48', '#2563EB', '#F59E0B', '#059669', '#9333EA', '#EA580C']
    }
  };

  /**
   * Pokémon GO–Style Equipped Figurine Cosmetic Kit:
   * Radically transforms the stage atmosphere, hexagonal workbench deck, sockets, tray,
   * tile 3D geometry & texture, center graphic emblems, and all 6 tile color variants!
   */
  function getFigurineCosmeticKit(figOrId = null) {
    if (!figOrId) {
      return {
        id: 'classic',
        figurine: null,
        name: 'Classic Studio Birch',
        kitTitle: 'Classic Birch Workbench · Matte Studio Vinyl Discs',
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

    const fig = typeof figOrId === 'string' ? getFigurineById(figOrId) : figOrId;
    const arch = SERIES_COSMETIC_ARCHETYPES[fig.seriesId] || SERIES_COSMETIC_ARCHETYPES['series-1'];
    const pCol = fig.primaryColor || '#2EC4B6';
    const sCol = fig.secondaryColor || '#F4B942';
    const aCol = fig.accentColor || '#FF5964';

    const deckStop0 = arch.isDarkStage
      ? mixHexColors(arch.deckStop0, pCol, 0.24)
      : mixHexColors(arch.deckStop0, pCol, 0.18);
    const deckStop1 = arch.isDarkStage
      ? mixHexColors(arch.deckStop1, pCol, 0.28)
      : mixHexColors(arch.deckStop1, pCol, 0.24);
    const deckStop2 = arch.isDarkStage
      ? mixHexColors(arch.deckStop2, sCol, 0.24)
      : mixHexColors(arch.deckStop2, sCol, 0.26);

    const rimFill = mixHexColors(arch.rimFill, pCol, 0.4);
    const rimStroke = shadeHexColor(rimFill, -0.45);
    const rivetFill = aCol;
    const inlayStroke = aCol;

    const stamps = ['circle', 'triangle', 'diamond', 'cross', 'star', 'hexagon'];
    const symbols = ['●', '▲', '◆', '✚', '★', '⬡'];
    const keys = ['coral', 'cobalt', 'mustard', 'mint', 'plum', 'terracotta'];
    const names = ['Crimson', 'Cobalt', 'Citrine', 'Emerald', 'Amethyst', 'Tangerine'];

    const fIdx = Math.max(0, (fig.indexInSeries || 1) - 1);
    // Each figurine within a series applies a distinct color-variant tint & contrast shift
    const shadeShifts = [0, 0.12, -0.1, 0.16, -0.14, 0.08];
    const figShade = shadeShifts[fIdx % shadeShifts.length];

    const discPalette = arch.baseDiscHexes.map((baseHex, idx) => {
      const tintSource = idx % 3 === 0 ? pCol : idx % 3 === 1 ? sCol : aCol;
      const blendWeight = 0.24 + ((fIdx + idx) % 3) * 0.05;
      const blendedHex = mixHexColors(baseHex, tintSource, blendWeight);
      const topHex = figShade !== 0 ? shadeHexColor(blendedHex, figShade) : blendedHex;
      const sideHex = mixHexColors(shadeHexColor(topHex, -0.35), arch.sideBarkHex || '#231F20', 0.48);
      const wellHex = mixHexColors(shadeHexColor(topHex, -0.42), arch.wellHex || '#1A1114', 0.55);
      const rimHex = mixHexColors(shadeHexColor(topHex, 0.42), aCol, 0.22);
      const inkHex = idx === 2 && !arch.isDarkStage && arch.discStyle !== 'astral' ? '#231F20' : '#FFFDF7';

      return makeDiscColorEntry(
        idx,
        keys[idx],
        `${fig.name.split(' ')[0]} ${names[idx]}`,
        topHex,
        stamps[idx],
        symbols[idx],
        inkHex,
        {
          topHighlight: shadeHexColor(topHex, 0.42),
          topShadow: shadeHexColor(topHex, -0.26),
          side: sideHex,
          rim: rimHex,
          well: wellHex,
          border: arch.borderHex || '#231F20',
          figAccent: aCol,
          figIndex: fIdx
        }
      );
    });

    return {
      id: fig.id,
      figurine: fig,
      name: `${fig.name}`,
      kitTitle: `${arch.kitTitle} · ${arch.discStyleLabel}`,
      discStyle: arch.discStyle,
      discStyleLabel: arch.discStyleLabel,
      isDarkStage: arch.isDarkStage,
      stageBgTop: arch.isDarkStage
        ? mixHexColors(arch.stageBgTop, pCol, 0.18)
        : mixHexColors(arch.stageBgTop, pCol, 0.14),
      stageBgBottom: arch.isDarkStage
        ? mixHexColors(arch.stageBgBottom, sCol, 0.16)
        : mixHexColors(arch.stageBgBottom, sCol, 0.14),
      deckStop0,
      deckStop1,
      deckStop2,
      rimFill,
      rimStroke,
      inlayStroke,
      rivetFill,
      socketOuter: arch.socketOuter,
      socketWell: mixHexColors(arch.socketWell, pCol, 0.14),
      socketStroke: mixHexColors(arch.socketStroke, pCol, 0.25),
      snapFill: arch.isDarkStage ? mixHexColors('#1E293B', aCol, 0.35) : '#D9F4EE',
      snapStroke: aCol,
      trayDeck: arch.trayDeck,
      trayLip: mixHexColors(arch.trayLip, pCol, 0.22),
      traySlotFill: arch.traySlotFill,
      traySlotStroke: mixHexColors(arch.traySlotStroke, pCol, 0.25),
      crestColor: pCol,
      discPalette
    };
  }

  return {
    VINYL_COLORS,
    COLOR_BY_KEY,
    COLOR_BY_ID,
    normalizeColorId,
    getColorKey,
    getColorMeta,
    hashSeedString,
    createMulberry32,
    AXIAL_DIRS,
    BURST_THRESHOLD,
    GRID_CONFIGS,
    cellKey,
    parseCellKey,
    getRadiusForSlots,
    getSlotsForRadius,
    axialDistance,
    generateAxialGridCoords,
    getAxialNeighbors,
    getTopColor,
    getTopContiguousCount,
    getColorGroups,
    WORKSHOP_CHAPTERS,
    LEVELS,
    getLevelConfig,
    generateSmartTrayStack,
    generateTrayWave,
    createSimulationState,
    isObjectiveComplete,
    executePlacementOnState,
    simulateLevelWithSolver,
    FIGURINE_SERIES,
    FIGURINES,
    getFigurineById,
    getFigurinesBySeries,
    DAILY_LEADERBOARD,
    getDailyChallengeConfig,
    getLevelSocialBenchmark,
    RARITY_DROP_RATES,
    rollRandomBlindBoxFigurine,
    SERIES_COSMETIC_ARCHETYPES,
    getFigurineCosmeticKit
  };
});
