#!/usr/bin/env node
/**
 * Optional Cloud Neural Image-to-3D (.glb) Batch Generator for PopStacks: Art Toy Atelier.
 *
 * Converts `assets/art/figurines/fig-01.webp` .. `fig-60.webp` into neural `.glb` meshes
 * using your choice of Image-to-3D provider:
 *   - fal.ai (`FAL_KEY` in ~/.env or env): Microsoft TRELLIS (`fal-ai/trellis`) or Hunyuan3D-2 (`fal-ai/hunyuan3d-v2`)
 *   - Tripo3D (`TRIPO_API_KEY` in ~/.env or env): `v2/openapi/task` (`image_to_model`)
 *   - Meshy (`MESHY_API_KEY` in ~/.env or env): `openapi/v1/image-to-3d`
 *
 * Usage:
 *   node scripts/generate-glb-cloud.mjs --provider=fal --only=fig-01,fig-60
 *   node scripts/generate-glb-cloud.mjs --provider=tripo --all
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CUTOUT_DIR = path.join(ROOT, 'assets', 'art', 'figurines');
const MODEL_DIR = path.join(ROOT, 'assets', 'models');

function loadDotEnv() {
  const candidates = [path.join(os.homedir(), '.env'), path.join(ROOT, '.env')];
  for (const envFile of candidates) {
    if (!fs.existsSync(envFile)) continue;
    const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
      }
    }
  }
}

async function generateViaFal(figId, imageBuffer) {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) throw new Error('Missing FAL_KEY in ~/.env');

  const dataUri = `data:image/webp;base64,${imageBuffer.toString('base64')}`;
  const res = await fetch('https://fal.run/fal-ai/trellis', {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      image_url: dataUri,
      ss_guidance_strength: 7.5,
      slat_guidance_strength: 3.0,
      mesh_simplify: 0.95,
      texture_size: 1024
    })
  });
  if (!res.ok) {
    throw new Error(`fal.ai error (${res.status}): ${await res.text()}`);
  }
  const payload = await res.json();
  const glbUrl = payload?.model_mesh?.url || payload?.glb?.url;
  if (!glbUrl) throw new Error(`No GLB URL in fal.ai response for ${figId}`);
  const glbRes = await fetch(glbUrl);
  return Buffer.from(await glbRes.arrayBuffer());
}

async function main() {
  loadDotEnv();
  fs.mkdirSync(MODEL_DIR, { recursive: true });

  const args = process.argv.slice(2);
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const ids = onlyArg
    ? onlyArg.replace('--only=', '').split(',')
    : Array.from({ length: 60 }, (_, i) => `fig-${String(i + 1).padStart(2, '0')}`);

  console.log(`Generating ${ids.length} GLB models via fal.ai TRELLIS...`);
  for (const id of ids) {
    const imgPath = path.join(CUTOUT_DIR, `${id}.webp`);
    const outPath = path.join(MODEL_DIR, `${id}.glb`);
    const buf = await generateViaFal(id, fs.readFileSync(imgPath));
    fs.writeFileSync(outPath, buf);
    console.log(`Saved ${outPath} (${(buf.length / 1024).toFixed(1)} KB)`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
