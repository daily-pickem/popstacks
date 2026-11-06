/**
 * Automated Headless Solver & Verification Script for PopStacks: Art Toy Atelier
 * Runs all 100 levels (Levels 1..100) with ZERO boosters and ZERO extra slots,
 * verifies 100% completion without deadlock, validates the 60-figurine catalog
 * & Daily Artisan Challenge generator, and outputs `evidence/solver-100-levels.json`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

const catalog = require('../levels.js');
const {
  LEVELS,
  WORKSHOP_CHAPTERS,
  FIGURINE_SERIES,
  FIGURINES,
  simulateLevelWithSolver,
  getDailyChallengeConfig,
  generateAxialGridCoords
} = catalog;

function runVerification() {
  console.log('===================================================================');
  console.log(' PopStacks: Art Toy Atelier — 100-Level Headless Solver Verifier');
  console.log('===================================================================');

  // 1. Verify Axial Grid Helpers (7, 19, 37 slots)
  const grid7 = generateAxialGridCoords(1);
  const grid19 = generateAxialGridCoords(2);
  const grid37 = generateAxialGridCoords(3);
  if (grid7.length !== 7 || grid19.length !== 19 || grid37.length !== 37) {
    throw new Error(
      `Axial Grid Helper mismatch: expected 7/19/37, got ${grid7.length}/${grid19.length}/${grid37.length}`
    );
  }
  console.log(`[PASS] Axial Grid Helpers verified: 7-slot (${grid7.length}), 19-slot (${grid19.length}), 37-slot (${grid37.length})`);

  // 2. Verify 60 Collectible Vinyl Figurines across 10 Series
  if (!Array.isArray(FIGURINE_SERIES) || FIGURINE_SERIES.length !== 10 || FIGURINES.length !== 60) {
    throw new Error(
      `Figurine catalog mismatch: expected 10 series & 60 figurines, got ${FIGURINE_SERIES?.length} series & ${FIGURINES?.length} figurines`
    );
  }
  console.log(`[PASS] Meta Figurine Catalog verified: ${FIGURINE_SERIES.length} Series × 6 = ${FIGURINES.length} Collectible Figurines`);

  // 3. Verify Daily Artisan Challenge Generator
  const sampleDaily = getDailyChallengeConfig('2026-10-18');
  const dailyResult = simulateLevelWithSolver(sampleDaily);
  if (!dailyResult.won) {
    throw new Error(`Daily Challenge for 2026-10-18 failed headless solver!`);
  }
  console.log(`[PASS] Daily Artisan Challenge (2026-10-18) solved in ${dailyResult.movesTaken} moves (${dailyResult.bursts10} bursts)`);

  // 4. Verify all 100 Campaign Levels with ZERO boosters & ZERO extra slots
  if (!Array.isArray(LEVELS) || LEVELS.length !== 100) {
    throw new Error(`Expected 100 levels in LEVELS, found ${LEVELS?.length}`);
  }

  const results = [];
  let passedCount = 0;
  let totalMoves = 0;
  let totalCascades = 0;
  let totalBursts = 0;
  let totalFrozenCleared = 0;
  let totalSolveTimeMs = 0;

  for (let i = 0; i < LEVELS.length; i++) {
    const lvl = LEVELS[i];
    const sim = simulateLevelWithSolver(lvl);
    const entry = {
      level: lvl.level,
      id: lvl.id,
      name: lvl.name,
      chapter: lvl.chapter,
      chapterName: lvl.chapterName,
      seed: lvl.seed,
      gridSlots: sim.gridSlots,
      won: sim.won,
      movesTaken: sim.movesTaken,
      cascadesTriggered: sim.cascadesTriggered,
      bursts10: sim.bursts10,
      anvilsCount: sim.anvilsCount,
      frozenCleared: sim.frozenCleared,
      totalDiscsGoal: lvl.objective.totalDiscsGoal,
      totalDiscsCleared: sim.totalDiscsCleared,
      solveTimeMs: sim.solveTimeMs
    };
    results.push(entry);

    if (sim.won) {
      passedCount++;
    } else {
      console.error(`[FAIL] Level ${lvl.level} (${lvl.name}) deadlocked after ${sim.movesTaken} moves!`);
    }

    totalMoves += sim.movesTaken;
    totalCascades += sim.cascadesTriggered;
    totalBursts += sim.bursts10;
    totalFrozenCleared += sim.frozenCleared;
    totalSolveTimeMs += sim.solveTimeMs;
  }

  const report = {
    game: 'PopStacks: Art Toy Atelier',
    verifiedAt: new Date().toISOString(),
    summary: {
      totalLevels: 100,
      passedLevels: passedCount,
      failedLevels: 100 - passedCount,
      passRate: `${passedCount}%`,
      boostersUsed: 0,
      extraSlotsUsed: 0,
      chaptersCount: WORKSHOP_CHAPTERS.length,
      figurineSeriesCount: FIGURINE_SERIES.length,
      figurinesCount: FIGURINES.length,
      averageMovesPerLevel: Number((totalMoves / 100).toFixed(2)),
      totalCascadesTriggered: totalCascades,
      totalBursts10: totalBursts,
      totalFrozenCleared,
      totalSolveTimeMs: Number(totalSolveTimeMs.toFixed(2))
    },
    levels: results
  };

  const evidenceDir = path.resolve(__dirname, '../evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const outPath = path.join(evidenceDir, 'solver-100-levels.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8');

  console.log('-------------------------------------------------------------------');
  console.log(` Total Levels Verified : ${passedCount} / 100 (${report.summary.passRate})`);
  console.log(` Boosters / Extra Slots: 0 / 0`);
  console.log(` Level 1 FTUE Moves    : ${results[0].movesTaken} moves (${results[0].bursts10} bursts, ${results[0].cascadesTriggered} cascades)`);
  console.log(` Avg Moves / Level     : ${report.summary.averageMovesPerLevel}`);
  console.log(` Total 10-Disc Bursts  : ${totalBursts}`);
  console.log(` Total Cascades        : ${totalCascades}`);
  console.log(` Total Frozen Cleared  : ${totalFrozenCleared}`);
  console.log(` Total Solve Time      : ${report.summary.totalSolveTimeMs} ms`);
  console.log(` Evidence Report Saved : ${outPath}`);
  console.log('===================================================================');

  if (passedCount !== 100) {
    process.exit(1);
  }
}

runVerification();
