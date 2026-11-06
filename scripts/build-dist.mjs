#!/usr/bin/env node
/**
 * Builds the production web bundle into dist/ for Capacitor Android packaging
 * Explicitly excludes research/ reference media and internal evidence logs.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

const filesToCopy = ['index.html', 'styles.css', 'audio.js', 'levels.js', 'game.js'];
for (const file of filesToCopy) {
  const src = path.join(rootDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, file));
  }
}

const assetsSrc = path.join(rootDir, 'assets', 'art');
const assetsDst = path.join(distDir, 'assets', 'art');
if (fs.existsSync(assetsSrc)) {
  fs.mkdirSync(assetsDst, { recursive: true });
  for (const entry of fs.readdirSync(assetsSrc)) {
    const s = path.join(assetsSrc, entry);
    if (fs.statSync(s).isFile()) {
      fs.copyFileSync(s, path.join(assetsDst, entry));
    }
  }
}

// 60 collectible trophy renders (WebP only; the source render sheets in figurines/src stay out of the bundle).
const figSrc = path.join(assetsSrc, 'figurines');
const figDst = path.join(assetsDst, 'figurines');
if (fs.existsSync(figSrc)) {
  fs.mkdirSync(figDst, { recursive: true });
  for (const entry of fs.readdirSync(figSrc)) {
    if (entry.endsWith('.webp')) {
      fs.copyFileSync(path.join(figSrc, entry), path.join(figDst, entry));
    }
  }
}

// 10 material Gacha Vessel renders (WebP only).
const vesselSrc = path.join(assetsSrc, 'gacha_vessels');
const vesselDst = path.join(assetsDst, 'gacha_vessels');
if (fs.existsSync(vesselSrc)) {
  fs.mkdirSync(vesselDst, { recursive: true });
  for (const entry of fs.readdirSync(vesselSrc)) {
    if (entry.endsWith('.webp')) {
      fs.copyFileSync(path.join(vesselSrc, entry), path.join(vesselDst, entry));
    }
  }
}

// Three.js GLB viewer bundle
const vendorSrc = path.join(rootDir, 'assets', 'vendor');
const vendorDst = path.join(distDir, 'assets', 'vendor');
if (fs.existsSync(vendorSrc)) {
  fs.mkdirSync(vendorDst, { recursive: true });
  for (const entry of fs.readdirSync(vendorSrc)) {
    const s = path.join(vendorSrc, entry);
    if (fs.statSync(s).isFile()) {
      fs.copyFileSync(s, path.join(vendorDst, entry));
    }
  }
}

// 60 3D .glb figurine models
const modelsSrc = path.join(rootDir, 'assets', 'models');
const modelsDst = path.join(distDir, 'assets', 'models');
if (fs.existsSync(modelsSrc)) {
  fs.mkdirSync(modelsDst, { recursive: true });
  for (const entry of fs.readdirSync(modelsSrc)) {
    if (entry.endsWith('.glb')) {
      fs.copyFileSync(path.join(modelsSrc, entry), path.join(modelsDst, entry));
    }
  }
}

console.log(`Built production web bundle in ${distDir}`);
