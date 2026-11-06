#!/usr/bin/env python3
"""Slice the 3x2 figurine render sheets into 60 transparent PNG trophies.

Input : assets/art/figurines/src/sheet_sNN.png  (6 figures on flat magenta, 3 cols x 2 rows)
Output: assets/art/figurines/fig-XX.webp        (512px max side, transparent, trimmed)

Keying: soft chroma key against the sheet's own background colour (sampled from the
border), then edge-only magenta despill. Figures are separated by connected components
on a downscaled mask, and each component is assigned to the grid cell containing its
centroid, so detached parts (halo rings, tails, comet trails) stay with their figure.
"""
from collections import deque
from pathlib import Path
import sys

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "assets/art/figurines/src"
OUT = ROOT / "assets/art/figurines"
MAX_SIDE = 512
KEY_T0, KEY_T1 = 40.0, 150.0   # feather ramp (colour distance) inside the edge ring
FLOOD_T = 95.0                  # max distance from key for flood-filled background
FEATHER_PX = 2                  # width of the soft edge ring
HOLE_T = 60.0                   # enclosed pockets: drop pixels this close to the key anywhere
DOWN = 4                       # mask downscale factor for component labelling
MIN_AREA = 40                  # in downscaled pixels; smaller specks are dropped


def sample_key(rgb: np.ndarray) -> np.ndarray:
    border = np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3),
                             rgb[:, :6].reshape(-1, 3), rgb[:, -6:].reshape(-1, 3)])
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


def process_sheet(path: Path, series_idx: int) -> int:
    img = Image.open(path).convert("RGB")
    rgb = np.asarray(img).astype(np.float32)
    H, W, _ = rgb.shape
    key = sample_key(rgb)

    dist = np.sqrt(((rgb - key) ** 2).sum(axis=2))

    # Background = pixels close to the key colour AND connected to the sheet border.
    # A global key would also eat figure interiors that happen to be near magenta
    # (plum/violet bodies), so we flood-fill from the border instead.
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

    # Enclosed pockets (inside handles, rings, between legs) aren't border-connected,
    # so also drop pixels that are almost exactly the key colour anywhere. The tight
    # threshold keeps plum/violet figure bodies (distance ~110+) intact.
    bg |= dist < HOLE_T

    # Erode the figure by 1px so the JPEG-blended magenta halo never survives.
    bg = dilate(bg, 1)

    # Feather only a thin ring just outside the background for soft anti-aliased edges.
    ring = dilate(bg, FEATHER_PX) & ~bg
    soft = np.clip((dist - KEY_T0) / (KEY_T1 - KEY_T0), 0.0, 1.0)
    alpha = np.where(bg, 0.0, np.where(ring, soft, 1.0))

    # Despill: full strength on the edge ring, and on any strongly magenta-tinted pixel
    # (e.g. background seen through translucent crystal).
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = np.clip(np.minimum(r, b) - g, 0, None)
    strong = (spill > 70) & (r > 170) & (b > 150)
    amt = np.where(ring, 1.0, np.where(strong, 0.7, 0.0)) * spill
    rgb[..., 0] = r - amt
    rgb[..., 2] = b - amt

    # Component labelling on a downscaled, slightly dilated mask.
    small = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).resize(
        (W // DOWN, H // DOWN), Image.BILINEAR)) > 40
    small = dilate(small, 2)
    labels, comps = label_components(small)

    sh, sw = small.shape
    cells = {i: [] for i in range(6)}
    for lab, pts in comps:
        if len(pts) < MIN_AREA:
            continue
        ys = np.array([p[0] for p in pts]); xs = np.array([p[1] for p in pts])
        col = min(2, int(xs.mean() / (sw / 3)))
        row = min(1, int(ys.mean() / (sh / 2)))
        cells[row * 3 + col].append(lab)

    written = 0
    for i in range(6):
        labs = cells[i]
        if not labs:
            print(f"  !! {path.name}: no figure found in cell {i + 1}")
            continue
        sel_small = np.isin(labels, labs)
        sel = np.asarray(Image.fromarray(sel_small.astype(np.uint8) * 255).resize((W, H), Image.NEAREST)) > 0
        a = np.where(sel, alpha, 0.0)
        ys, xs = np.where(a > 0.05)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        pad = int(max(y1 - y0, x1 - x0) * 0.04)
        y0, x0 = max(0, y0 - pad), max(0, x0 - pad)
        y1, x1 = min(H, y1 + pad), min(W, x1 + pad)

        rgba = np.dstack([np.clip(rgb[y0:y1, x0:x1], 0, 255), a[y0:y1, x0:x1] * 255]).astype(np.uint8)
        fig = Image.fromarray(rgba, "RGBA")
        scale = MAX_SIDE / max(fig.size)
        if scale < 1:
            fig = fig.resize((round(fig.width * scale), round(fig.height * scale)), Image.LANCZOS)

        fig_num = (series_idx - 1) * 6 + i + 1
        out = OUT / f"fig-{fig_num:02d}.webp"
        fig.save(out, "WEBP", quality=86, method=6)
        written += 1
        print(f"  fig-{fig_num:02d}  {fig.width}x{fig.height}  parts={len(labs)}")
    return written


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    only = {int(a) for a in sys.argv[1:]} if len(sys.argv) > 1 else None
    total = 0
    for s in range(1, 11):
        if only and s not in only:
            continue
        p = SRC / f"sheet_s{s:02d}.png"
        if not p.exists():
            print(f"missing {p.name}")
            continue
        print(p.name)
        total += process_sheet(p, s)
    print(f"wrote {total} figurines")


if __name__ == "__main__":
    main()
