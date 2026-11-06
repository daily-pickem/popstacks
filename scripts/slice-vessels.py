#!/usr/bin/env python3
"""Slice the Gacha Vessel render sheets into 10 transparent WebP cutouts.

Inputs:
  - assets/art/gacha_vessels/src/sheet_vessels_1_6.jpg  (3 cols x 2 rows = vessels 1..6)
  - assets/art/gacha_vessels/src/sheet_vessels_7_10.jpg (2 cols x 2 rows = vessels 7..10)
Outputs:
  - assets/art/gacha_vessels/vessel-01.webp .. vessel-10.webp (512px max side, RGBA)
"""
from collections import deque
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/art/gacha_vessels/src"
OUT = ROOT / "assets/art/gacha_vessels"
MAX_SIDE = 512
KEY_T0, KEY_T1 = 40.0, 150.0
FLOOD_T = 95.0
FEATHER_PX = 2
HOLE_T = 62.0
DOWN = 4
MIN_AREA = 60


def sample_key(rgb: np.ndarray) -> np.ndarray:
    border = np.concatenate([
        rgb[:6].reshape(-1, 3),
        rgb[-6:].reshape(-1, 3),
        rgb[:, :6].reshape(-1, 3),
        rgb[:, -6:].reshape(-1, 3),
    ])
    return np.median(border, axis=0)


def label_components(mask: np.ndarray):
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    comps = []
    cur = 0
    for y in range(h):
        for x in range(w):
            if mask[y, x] and labels[y, x] == 0:
                cur += 1
                q = deque([(y, x)])
                labels[y, x] = cur
                pts = []
                while q:
                    cy, cx = q.popleft()
                    pts.append((cy, cx))
                    for ny, nx in ((cy + 1, cx), (cy - 1, cx), (cy, cx + 1), (cy, cx - 1)):
                        if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and labels[ny, nx] == 0:
                            labels[ny, nx] = cur
                            q.append((ny, nx))
                comps.append((cur, pts))
    return labels, comps


def dilate(mask: np.ndarray, r: int) -> np.ndarray:
    out = mask.copy()
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            out |= np.roll(np.roll(mask, dy, 0), dx, 1)
    return out


def process_grid_sheet(path: Path, cols: int, rows: int, start_vessel_idx: int):
    img = Image.open(path).convert("RGB")
    rgb = np.asarray(img).astype(np.float32)
    H, W, _ = rgb.shape
    key = sample_key(rgb)

    dist = np.sqrt(((rgb - key) ** 2).sum(axis=2))
    cand = dist < FLOOD_T
    bg = np.zeros_like(cand)
    bg[0, :], bg[-1, :], bg[:, 0], bg[:, -1] = cand[0, :], cand[-1, :], cand[:, 0], cand[:, -1]
    while True:
        grown = bg.copy()
        grown[1:, :] |= bg[:-1, :]
        grown[:-1, :] |= bg[1:, :]
        grown[:, 1:] |= bg[:, :-1]
        grown[:, :-1] |= bg[:, 1:]
        grown &= cand
        if (grown == bg).all():
            break
        bg = grown

    bg |= dist < HOLE_T
    bg = dilate(bg, 1)

    ring = dilate(bg, FEATHER_PX) & ~bg
    soft = np.clip((dist - KEY_T0) / (KEY_T1 - KEY_T0), 0.0, 1.0)
    alpha = np.where(bg, 0.0, np.where(ring, soft, 1.0))

    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = np.clip(np.minimum(r, b) - g, 0, None)
    strong = (spill > 70) & (r > 170) & (b > 150)
    amt = np.where(ring, 1.0, np.where(strong, 0.7, 0.0)) * spill
    rgb[..., 0] = r - amt
    rgb[..., 2] = b - amt

    small = np.asarray(
        Image.fromarray((alpha * 255).astype(np.uint8)).resize((W // DOWN, H // DOWN), Image.BILINEAR)
    ) > 40
    small = dilate(small, 2)
    labels, comps = label_components(small)

    sh, sw = small.shape
    total_cells = cols * rows
    cells = {i: [] for i in range(total_cells)}
    for lab, pts in comps:
        if len(pts) < MIN_AREA:
            continue
        ys = np.array([p[0] for p in pts])
        xs = np.array([p[1] for p in pts])
        col = min(cols - 1, int(xs.mean() / (sw / cols)))
        row = min(rows - 1, int(ys.mean() / (sh / rows)))
        cells[row * cols + col].append(lab)

    for i in range(total_cells):
        labs = cells[i]
        vessel_num = start_vessel_idx + i
        if not labs:
            print(f"  !! {path.name}: no vessel found in cell {i + 1}")
            continue
        sel_small = np.isin(labels, labs)
        sel = np.asarray(
            Image.fromarray(sel_small.astype(np.uint8) * 255).resize((W, H), Image.NEAREST)
        ) > 0
        a = np.where(sel, alpha, 0.0)
        ys, xs = np.where(a > 0.05)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        pad = int(max(y1 - y0, x1 - x0) * 0.04)
        y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
        y1, x1 = min(H, y1 + pad), min(W, x1 + pad)

        rgba = np.dstack([np.clip(rgb[y0:y1, x0:x1], 0, 255), a[y0:y1, x0:x1] * 255]).astype(np.uint8)
        v_img = Image.fromarray(rgba, "RGBA")
        scale = MAX_SIDE / max(v_img.size)
        if scale < 1:
            v_img = v_img.resize((round(v_img.width * scale), round(v_img.height * scale)), Image.LANCZOS)

        out = OUT / f"vessel-{vessel_num:02d}.webp"
        v_img.save(out, "WEBP", quality=88, method=6)
        print(f"  vessel-{vessel_num:02d}.webp  {v_img.width}x{v_img.height}")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    p1 = SRC / "sheet_vessels_1_6.jpg"
    p2 = SRC / "sheet_vessels_7_10.jpg"
    if p1.exists():
        print("Processing sheet_vessels_1_6.jpg...")
        process_grid_sheet(p1, cols=3, rows=2, start_vessel_idx=1)
    if p2.exists():
        print("Processing sheet_vessels_7_10.jpg...")
        process_grid_sheet(p2, cols=2, rows=2, start_vessel_idx=7)


if __name__ == "__main__":
    main()
