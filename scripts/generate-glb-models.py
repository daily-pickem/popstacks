#!/usr/bin/env python3
"""
Single-Image-to-3D (.glb) Reconstruction Pipeline for PopStacks: Art Toy Atelier.

Converts all 60 alpha-keyed figurine cutouts (`assets/art/figurines/fig-01.webp` .. `fig-60.webp`)
into smooth, watertight 3D glTF 2.0 binary models (`assets/models/fig-01.glb` .. `fig-60.glb`)
featuring:
  1. Sub-pixel Iso-Contour Vertex Snapping + Laplacian Boundary Smoothing (eliminates grid stair-stepping).
  2. Smooth C1 Raised-Cosine Ellipsoidal Volume Inflation + UV Normal Inset (eliminates side-wall pixel stretching).
  3. Clean Back-of-Figure Texture Synthesis (removes front eyes/mouth/cheek-blush on the back hemisphere
     while matching the silhouette contour seamlessly).
"""

import io
import json
import math
import os
import re
import struct
import numpy as np
from PIL import Image, ImageFilter

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUTOUT_DIR = os.path.join(ROOT_DIR, "assets", "art", "figurines")
OUTPUT_DIR = os.path.join(ROOT_DIR, "assets", "models")


def parse_figurines_metadata():
    """Extract rarity and color metadata for fig-01..fig-60 from levels.js."""
    levels_path = os.path.join(ROOT_DIR, "levels.js")
    with open(levels_path, "r", encoding="utf-8") as f:
        text = f.read()

    pattern = re.compile(
        r"\[\s*(['\"])(.*?)\1\s*,\s*'(\w+)'\s*,\s*'(#[0-9A-Fa-f]{6})'\s*,\s*'(#[0-9A-Fa-f]{6})'\s*,\s*'(#[0-9A-Fa-f]{6})'\s*,\s*'(\w+)'\s*,\s*'(\w+)'"
    )
    matches = pattern.findall(text)
    meta = {}
    for idx, m in enumerate(matches, start=1):
        fig_id = f"fig-{idx:02d}"
        meta[fig_id] = {
            "id": fig_id,
            "name": m[1],
            "rarity": m[2],
            "primaryColor": m[3],
            "secondaryColor": m[4],
            "accentColor": m[5],
            "silhouetteType": m[6],
            "stampMotif": m[7],
        }
    return meta


def compute_edt_2d(mask):
    """Exact 2D Euclidean Distance Transform in pure NumPy."""
    h, w = mask.shape
    INF = 1e10
    f = np.where(mask, INF, 0.0)

    def edt_1d_rows(arr):
        n = arr.shape[1]
        out = np.zeros_like(arr)
        for i in range(arr.shape[0]):
            row = arr[i]
            if np.all(row == 0):
                continue
            v = np.zeros(n, dtype=np.int32)
            z = np.zeros(n + 1, dtype=np.float64)
            k = 0
            v[0] = 0
            z[0] = -INF
            z[1] = INF
            for q in range(1, n):
                s = ((row[q] + q * q) - (row[v[k]] + v[k] * v[k])) / (2.0 * q - 2.0 * v[k])
                while s <= z[k]:
                    k -= 1
                    s = ((row[q] + q * q) - (row[v[k]] + v[k] * v[k])) / (2.0 * q - 2.0 * v[k])
                k += 1
                v[k] = q
                z[k] = s
                z[k + 1] = INF
            k = 0
            for q in range(n):
                while z[k + 1] < q:
                    k += 1
                dx = q - v[k]
                out[i, q] = dx * dx + row[v[k]]
        return out

    d_cols = edt_1d_rows(f.T).T
    d_full = edt_1d_rows(d_cols)
    return np.sqrt(d_full)


def gaussian_blur_np(arr, radius):
    """Smooth a 2D float array using PIL GaussianBlur."""
    mn, mx = float(arr.min()), float(arr.max())
    if mx - mn < 1e-7:
        return arr.copy()
    norm = np.clip((arr - mn) / (mx - mn) * 255.0, 0, 255).astype(np.uint8)
    im = Image.fromarray(norm, mode="L").filter(ImageFilter.GaussianBlur(radius=radius))
    return (np.asarray(im, dtype=np.float32) / 255.0) * (mx - mn) + mn


def dilate_rgb_into_transparent(rgba_arr, iterations=14):
    """Bleed foreground RGB colors outward into transparent pixels so UV edges never sample dark fringes."""
    rgb = rgba_arr[:, :, :3].astype(np.float32)
    # Use high alpha threshold (140) so semi-transparent anti-aliased edge pixels take clean interior color
    alpha = rgba_arr[:, :, 3] > 140
    filled = alpha.copy()

    for _ in range(iterations):
        unfilled = ~filled
        if not np.any(unfilled):
            break
        acc = np.zeros_like(rgb)
        cnt = np.zeros(alpha.shape, dtype=np.float32)
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]:
            shifted_mask = np.roll(np.roll(filled, dy, axis=0), dx, axis=1)
            shifted_rgb = np.roll(np.roll(rgb, dy, axis=0), dx, axis=1)
            valid = unfilled & shifted_mask
            acc[valid] += shifted_rgb[valid]
            cnt[valid] += 1.0
        newly_filled = cnt > 0
        rgb[newly_filled] = acc[newly_filled] / cnt[newly_filled, None]
        filled |= newly_filled

    out = rgba_arr.copy()
    out[:, :, :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    return out


def synthesize_back_texture(front_rgba):
    """
    Synthesizes a clean Back-of-Figure texture from the Front cutout:
    - For the head zone (v in 0.15..0.60), uses the clean upper-crown/forehead base color
      with smooth 3D spherical studio shading so front eyes, mouth, and rosy cheek blush
      never appear on the back of the head.
    - For the torso & base zones, smoothly interpolates clean outer rim colors across each row
      and applies a large-radius 2D Gaussian blur so no horizontal scanline bands can form.
    """
    h, w, _ = front_rgba.shape
    back_rgba = front_rgba.copy()
    alpha = front_rgba[:, :, 3]

    # Sample clean upper-head dome color (y in 0.18..0.30 of height, middle 50% of width)
    y_crown0, y_crown1 = int(h * 0.18), int(h * 0.30)
    x_mid0, x_mid1 = int(w * 0.28), int(w * 0.72)
    crown_slice = front_rgba[y_crown0:y_crown1, x_mid0:x_mid1]
    crown_mask = crown_slice[:, :, 3] > 180
    if np.any(crown_mask):
        crown_pixels = crown_slice[:, :, :3][crown_mask].astype(np.float32)
        head_base_color = np.median(crown_pixels, axis=0)
    else:
        head_base_color = np.array([220.0, 220.0, 220.0], dtype=np.float32)

    for y in range(h):
        xs = np.where(alpha[y] > 90)[0]
        if len(xs) < 6:
            continue
        x0, x1 = int(xs[0]), int(xs[-1])
        span = x1 - x0 + 1
        if span < 8:
            continue

        v_norm = y / float(h)
        # Sample rim slightly inside the anti-aliased edge
        inset = min(3, span // 6)
        belt = max(2, int(span * 0.12))
        left_rim = np.median(front_rgba[y, x0 + inset : x0 + inset + belt, :3].astype(np.float32), axis=0)
        right_rim = np.median(front_rgba[y, x1 - inset - belt + 1 : x1 - inset + 1, :3].astype(np.float32), axis=0)

        # In the head/face zone (v in 0.16..0.60), smoothly transition to clean head_base_color
        # so rosy cheeks or eye edges on the front face NEVER appear on the back of the head!
        if 0.16 <= v_norm <= 0.60:
            head_t = (v_norm - 0.16) / 0.44
            head_w = math.pow(math.sin(head_t * math.pi), 0.55) * 0.94
            left_rim = left_rim * (1.0 - head_w) + head_base_color * head_w
            right_rim = right_rim * (1.0 - head_w) + head_base_color * head_w

        for x in range(x0, x1 + 1):
            t = (x - x0) / max(1.0, float(span - 1))
            interp_rgb = left_rim * (1.0 - t) + right_rim * t

            # Smooth 3D spherical studio shading on back + subtle vertical artisan seam
            arch = math.sin(t * math.pi)
            seam = 1.0 - 0.03 * math.exp(-((t - 0.5) / 0.06) ** 2)
            shade = (0.85 + 0.17 * arch) * seam

            back_rgba[y, x, :3] = np.clip(interp_rgb * shade, 0, 255).astype(np.uint8)

    # Dilate first so transparent pixels outside silhouette don't darken the Gaussian blur
    back_dilated = dilate_rgb_into_transparent(back_rgba, iterations=14)
    blurred_rgb = np.asarray(
        Image.fromarray(back_dilated[:, :, :3], mode="RGB").filter(ImageFilter.GaussianBlur(radius=6.0)),
        dtype=np.float32,
    )
    back_rgba[:, :, :3] = np.clip(blurred_rgb, 0, 255).astype(np.uint8)
    return back_rgba


def build_uv_atlas_webp(front_img, size=512):
    """
    Creates a 512x512 WebP texture atlas with a 4% padding border so top/bottom/sides never clip:
    - Left half (0..256 x 0..512): Dilated Front View
    - Right half (256..512 x 0..512): Dilated Synthesized Back View
    """
    half_w = size // 2
    pad_x = int(half_w * 0.05)
    pad_y = int(size * 0.04)
    inner_w = half_w - 2 * pad_x
    inner_h = size - 2 * pad_y

    front_inner = front_img.resize((inner_w, inner_h), Image.Resampling.LANCZOS)
    front_canvas = Image.new("RGBA", (half_w, size), (0, 0, 0, 0))
    front_canvas.paste(front_inner, (pad_x, pad_y))
    front_arr = np.asarray(front_canvas, dtype=np.uint8)

    back_arr = synthesize_back_texture(front_arr)

    front_dilated = dilate_rgb_into_transparent(front_arr, iterations=16)
    back_dilated = dilate_rgb_into_transparent(back_arr, iterations=16)

    atlas = np.zeros((size, size, 3), dtype=np.uint8)
    atlas[:, :half_w, :] = front_dilated[:, :, :3]
    atlas[:, half_w:, :] = back_dilated[:, :, :3]

    atlas_img = Image.fromarray(atlas, mode="RGB")
    buf = io.BytesIO()
    atlas_img.save(buf, format="WEBP", quality=92, method=4)
    return buf.getvalue(), front_canvas


def reconstruct_figurine_mesh(padded_rgba, orig_aspect, grid_w=84, grid_h=120):
    """
    Reconstructs a watertight, smooth-contoured 3D triangle mesh from the padded RGBA cutout.
    Key techniques (inspired by Monster Mash / Teddy 2D-to-3D inflation):
      1. 3-corner + 4-corner Marching Squares triangulation so curved silhouettes have zero Manhattan steps.
      2. Coupled Laplacian Grid Smoothing where boundary vertices glide onto the smooth contour while
         interior vertices relax proportionally so triangles never fold or compress.
      3. Elliptic Poisson Membrane Inflation (solving Lap(h) = -1, z = h^0.55) for a C-infinity smooth,
         plump 3D toy surface with zero medial-axis creases or horizontal scanline ridges.
      4. Smooth 2D UV Inset near the silhouette rim so side views sample clean interior colors.
    """
    small_rgba = padded_rgba.resize((grid_w, grid_h), Image.Resampling.LANCZOS)
    arr = np.asarray(small_rgba, dtype=np.uint8)

    alpha = arr[:, :, 3].astype(np.float32) / 255.0
    alpha_smooth = gaussian_blur_np(alpha, radius=1.25)
    active_mask = alpha_smooth > 0.36

    # Ensure outer border is False so mesh is strictly closed
    active_mask[0, :] = False
    active_mask[-1, :] = False
    active_mask[:, 0] = False
    active_mask[:, -1] = False

    # A vertex in active_mask is a boundary vertex if any of its 4-neighbors is outside active_mask.
    # This guarantees that both 4-corner boundary edges and 3-corner diagonal edges have z=0 on both endpoints!
    up_in = np.roll(active_mask, -1, axis=0)
    down_in = np.roll(active_mask, 1, axis=0)
    left_in = np.roll(active_mask, -1, axis=1)
    right_in = np.roll(active_mask, 1, axis=1)
    interior_mask = active_mask & up_in & down_in & left_in & right_in
    is_boundary = active_mask & (~interior_mask)

    # 1. Solve Elliptic Poisson Membrane equation (Lap(h) = -1 inside interior_mask, h = 0 on is_boundary)
    h_field = np.zeros((grid_h, grid_w), dtype=np.float32)
    for _ in range(160):
        h_avg = 0.25 * (
            np.roll(h_field, 1, axis=0)
            + np.roll(h_field, -1, axis=0)
            + np.roll(h_field, 1, axis=1)
            + np.roll(h_field, -1, axis=1)
        )
        h_field = np.where(interior_mask, h_avg + 1.0, 0.0)

    max_h = max(float(h_field.max()), 1.0)
    h_norm = np.clip(h_field / max_h, 0.0, 1.0)

    # Raising normalized Poisson solution to power 0.56 yields a true round 3D ellipsoidal dome!
    z_profile = np.where(interior_mask, np.power(h_norm, 0.56), 0.0)

    # Boost roundness on the trophy base at the bottom (r > 0.78 * grid_h)
    for r in range(int(grid_h * 0.78), grid_h):
        base_factor = 1.0 + 0.20 * ((r - grid_h * 0.78) / (grid_h * 0.22))
        z_profile[r, :] *= base_factor

    model_h = 1.60
    model_w = model_h * orig_aspect
    max_z = model_w * 0.38

    z_front = np.where(interior_mask, z_profile * max_z, 0.0)
    z_back = np.where(interior_mask, -(z_profile * 0.90) * max_z, 0.0)

    # 2. Smooth 2D Grid Coordinates:
    #    Snap ONLY `is_boundary` vertices gently toward the alpha_smooth=0.36 contour,
    #    then relax the grid so interior rings stay evenly spaced (zero cliff folding!).
    u_grid = np.linspace(0.0, 1.0, grid_w, dtype=np.float32)[None, :].repeat(grid_h, axis=0)
    v_grid = np.linspace(0.0, 1.0, grid_h, dtype=np.float32)[:, None].repeat(grid_w, axis=1)

    gy, gx = np.gradient(alpha_smooth)
    grad_mag_sq = gx * gx + gy * gy + 1e-6
    iso_val = 0.36
    delta_c = np.clip(-(alpha_smooth - iso_val) * gx / grad_mag_sq, -0.45, 0.45)
    delta_r = np.clip(-(alpha_smooth - iso_val) * gy / grad_mag_sq, -0.45, 0.45)

    u_pos = u_grid + np.where(is_boundary, delta_c / float(grid_w - 1), 0.0)
    v_pos = v_grid + np.where(is_boundary, delta_r / float(grid_h - 1), 0.0)

    # Smooth boundary contour tangentially along `is_boundary`, then gently relax 2 interior rings
    for _ in range(4):
        u_b_avg = np.zeros_like(u_pos)
        v_b_avg = np.zeros_like(v_pos)
        b_cnt = np.zeros_like(u_pos)
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]:
            m_nb = np.roll(np.roll(is_boundary, dy, axis=0), dx, axis=1)
            u_nb = np.roll(np.roll(u_pos, dy, axis=0), dx, axis=1)
            v_nb = np.roll(np.roll(v_pos, dy, axis=0), dx, axis=1)
            u_b_avg += np.where(m_nb, u_nb, 0.0)
            v_b_avg += np.where(m_nb, v_nb, 0.0)
            b_cnt += np.where(m_nb, 1.0, 0.0)
        valid_b = is_boundary & (b_cnt > 0)
        u_pos = np.where(valid_b, 0.50 * u_pos + 0.50 * (u_b_avg / np.maximum(b_cnt, 1.0)), u_pos)
        v_pos = np.where(valid_b, 0.50 * v_pos + 0.50 * (v_b_avg / np.maximum(b_cnt, 1.0)), v_pos)

        # Relax interior vertices slightly so mesh spacing near the boundary is completely uniform
        u_i_avg = 0.25 * (
            np.roll(u_pos, 1, axis=0) + np.roll(u_pos, -1, axis=0) + np.roll(u_pos, 1, axis=1) + np.roll(u_pos, -1, axis=1)
        )
        v_i_avg = 0.25 * (
            np.roll(v_pos, 1, axis=0) + np.roll(v_pos, -1, axis=0) + np.roll(v_pos, 1, axis=1) + np.roll(v_pos, -1, axis=1)
        )
        u_pos = np.where(interior_mask, 0.70 * u_pos + 0.30 * u_i_avg, u_pos)
        v_pos = np.where(interior_mask, 0.70 * v_pos + 0.30 * v_i_avg, v_pos)

    # 3. Smooth 2D UV Inset near the silhouette boundary so curved side walls sample clean interior colors
    #    with zero row-to-row jitter or horizontal stripes!
    edge_pull = np.power(1.0 - np.clip(z_profile, 0.0, 1.0), 2.2) * 0.11
    u_tex = np.clip(u_pos * (1.0 - edge_pull) + 0.5 * edge_pull, 0.002, 0.998)
    v_tex = np.clip(v_pos * (1.0 - edge_pull * 0.35) + 0.5 * (edge_pull * 0.35), 0.002, 0.998)

    front_idx_map = np.full((grid_h, grid_w), -1, dtype=np.int32)
    back_idx_map = np.full((grid_h, grid_w), -1, dtype=np.int32)

    positions = []
    uvs = []

    for r in range(grid_h):
        for c in range(grid_w):
            if not active_mask[r, c]:
                continue
            x_pos = (float(u_pos[r, c]) - 0.5) * model_w
            y_pos = (0.5 - float(v_pos[r, c])) * model_h

            ut = float(u_tex[r, c])
            vt = float(v_tex[r, c])

            # Front vertex (left half of atlas: u in [0.002 .. 0.498])
            u_front = 0.002 + ut * 0.496
            front_idx_map[r, c] = len(positions)
            positions.append([x_pos, y_pos, float(z_front[r, c])])
            uvs.append([u_front, vt])

            # Back vertex (right half of atlas: u in [0.502 .. 0.998])
            u_back = 0.502 + ut * 0.496
            back_idx_map[r, c] = len(positions)
            positions.append([x_pos, y_pos, float(z_back[r, c])])
            uvs.append([u_back, vt])

    indices = []
    for r in range(grid_h - 1):
        for c in range(grid_w - 1):
            m00 = bool(active_mask[r, c])
            m10 = bool(active_mask[r + 1, c])
            m01 = bool(active_mask[r, c + 1])
            m11 = bool(active_mask[r + 1, c + 1])
            cnt = int(m00) + int(m10) + int(m01) + int(m11)
            if cnt < 3:
                continue

            f00, f10, f01, f11 = (
                int(front_idx_map[r, c]),
                int(front_idx_map[r + 1, c]),
                int(front_idx_map[r, c + 1]),
                int(front_idx_map[r + 1, c + 1]),
            )
            b00, b10, b01, b11 = (
                int(back_idx_map[r, c]),
                int(back_idx_map[r + 1, c]),
                int(back_idx_map[r, c + 1]),
                int(back_idx_map[r + 1, c + 1]),
            )

            if cnt == 4:
                indices.extend([f00, f10, f01, f01, f10, f11])
                indices.extend([b00, b01, b10, b01, b11, b10])
            elif not m00:
                indices.extend([f01, f10, f11])
                indices.extend([b01, b11, b10])
            elif not m01:
                indices.extend([f00, f10, f11])
                indices.extend([b00, b11, b10])
            elif not m10:
                indices.extend([f00, f11, f01])
                indices.extend([b00, b01, b11])
            elif not m11:
                indices.extend([f00, f10, f01])
                indices.extend([b00, b01, b10])

    pos_np = np.array(positions, dtype=np.float32)
    uv_np = np.array(uvs, dtype=np.float32)
    idx_np = np.array(indices, dtype=np.uint16)

    # Compute smooth area-weighted vertex normals
    normals = np.zeros_like(pos_np)
    tris = idx_np.astype(np.int32).reshape(-1, 3)
    v0 = pos_np[tris[:, 0]]
    v1 = pos_np[tris[:, 1]]
    v2 = pos_np[tris[:, 2]]
    face_normals = np.cross(v1 - v0, v2 - v0)
    np.add.at(normals, tris[:, 0], face_normals)
    np.add.at(normals, tris[:, 1], face_normals)
    np.add.at(normals, tris[:, 2], face_normals)

    # Unify front and back normals along the z=0 boundary seam for a continuous rounded edge
    for r in range(grid_h):
        for c in range(grid_w):
            if is_boundary[r, c]:
                fi = front_idx_map[r, c]
                bi = back_idx_map[r, c]
                if fi >= 0 and bi >= 0:
                    avg_n = normals[fi] + normals[bi]
                    avg_n[2] = 0.0
                    normals[fi] = avg_n
                    normals[bi] = avg_n

    norms = np.linalg.norm(normals, axis=1, keepdims=True)
    safe_norms = np.maximum(norms, 1e-8)
    normals = np.where(norms > 1e-8, normals / safe_norms, np.array([[0.0, 0.0, 1.0]], dtype=np.float32))

    return pos_np, normals.astype(np.float32), uv_np, idx_np


def get_rarity_pbr(rarity):
    r = (rarity or "Common").lower()
    if r == "mythic":
        return {"fig_roughness": 0.14, "fig_metalness": 0.12}
    if r == "legendary":
        return {"fig_roughness": 0.20, "fig_metalness": 0.28}
    if r == "epic":
        return {"fig_roughness": 0.26, "fig_metalness": 0.10}
    if r == "rare":
        return {"fig_roughness": 0.18, "fig_metalness": 0.04}
    return {"fig_roughness": 0.76, "fig_metalness": 0.02}


def pack_glb(fig_id, meta, pos1, norm1, uv1, idx1, webp_bytes):
    """Packs the watertight 3D figurine mesh + embedded WebP texture atlas into a binary glTF 2.0 (.glb) file."""
    bin_chunks = []
    buffer_views = []
    accessors = []

    def append_buffer(raw_bytes, target=None):
        offset = sum(len(c) for c in bin_chunks)
        bin_chunks.append(raw_bytes)
        pad = (4 - (len(raw_bytes) % 4)) % 4
        if pad:
            bin_chunks.append(b"\x00" * pad)
        bv = {"buffer": 0, "byteOffset": offset, "byteLength": len(raw_bytes)}
        if target is not None:
            bv["target"] = target
        bv_idx = len(buffer_views)
        buffer_views.append(bv)
        return bv_idx

    def add_accessor(arr, component_type, acc_type, target=None, include_bounds=False):
        bv_idx = append_buffer(arr.tobytes(), target=target)
        acc = {
            "bufferView": bv_idx,
            "byteOffset": 0,
            "componentType": component_type,
            "count": int(arr.shape[0]),
            "type": acc_type,
        }
        if include_bounds:
            acc["min"] = [float(x) for x in arr.min(axis=0)]
            acc["max"] = [float(x) for x in arr.max(axis=0)]
        acc_idx = len(accessors)
        accessors.append(acc)
        return acc_idx

    acc_pos1 = add_accessor(pos1, 5126, "VEC3", target=34962, include_bounds=True)
    acc_norm1 = add_accessor(norm1, 5126, "VEC3", target=34962)
    acc_uv1 = add_accessor(uv1, 5126, "VEC2", target=34962)
    acc_idx1 = add_accessor(idx1, 5123, "SCALAR", target=34963)

    bv_img = append_buffer(webp_bytes, target=None)
    pbr = get_rarity_pbr(meta.get("rarity", "Common"))

    gltf_dict = {
        "asset": {
            "version": "2.0",
            "generator": "PopStacks Atelier Image-to-3D GLB Pipeline",
        },
        "scene": 0,
        "scenes": [{"name": meta.get("name", fig_id), "nodes": [0]}],
        "nodes": [
            {
                "name": fig_id,
                "mesh": 0,
                "extras": meta,
            }
        ],
        "meshes": [
            {
                "name": f"{fig_id}_mesh",
                "primitives": [
                    {
                        "attributes": {
                            "POSITION": acc_pos1,
                            "NORMAL": acc_norm1,
                            "TEXCOORD_0": acc_uv1,
                        },
                        "indices": acc_idx1,
                        "material": 0,
                        "mode": 4,
                    }
                ],
            }
        ],
        "materials": [
            {
                "name": f"{fig_id}_body_{meta.get('rarity', 'Common').lower()}",
                "doubleSided": True,
                "pbrMetallicRoughness": {
                    "baseColorTexture": {"index": 0},
                    "metallicFactor": pbr["fig_metalness"],
                    "roughnessFactor": pbr["fig_roughness"],
                },
                "extras": {
                    "role": "figurine_body",
                    "rarity": meta.get("rarity", "Common"),
                },
            }
        ],
        "textures": [{"sampler": 0, "source": 0}],
        "images": [
            {
                "bufferView": bv_img,
                "mimeType": "image/webp",
                "name": f"{fig_id}_atlas",
            }
        ],
        "samplers": [
            {
                "magFilter": 9729,
                "minFilter": 9987,
                "wrapS": 33071,
                "wrapT": 33071,
            }
        ],
        "bufferViews": buffer_views,
        "accessors": accessors,
        "buffers": [{"byteLength": sum(len(c) for c in bin_chunks)}],
    }

    json_bytes = json.dumps(gltf_dict, separators=(",", ":")).encode("utf-8")
    json_pad = (4 - (len(json_bytes) % 4)) % 4
    if json_pad:
        json_bytes += b" " * json_pad

    bin_bytes = b"".join(bin_chunks)
    total_len = 12 + 8 + len(json_bytes) + 8 + len(bin_bytes)

    header = struct.pack("<III", 0x46546C67, 2, total_len)
    json_header = struct.pack("<II", len(json_bytes), 0x4E4F534A)
    bin_header = struct.pack("<II", len(bin_bytes), 0x004E4942)

    return header + json_header + json_bytes + bin_header + bin_bytes


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    meta_map = parse_figurines_metadata()
    total_bytes = 0

    for i in range(1, 61):
        fig_id = f"fig-{i:02d}"
        cutout_path = os.path.join(CUTOUT_DIR, f"{fig_id}.webp")
        if not os.path.exists(cutout_path):
            raise FileNotFoundError(f"Missing cutout: {cutout_path}")

        im = Image.open(cutout_path).convert("RGBA")
        orig_aspect = float(im.width) / max(1.0, float(im.height))
        meta = meta_map.get(fig_id, {"id": fig_id, "name": fig_id, "rarity": "Common"})

        webp_bytes, padded_rgba = build_uv_atlas_webp(im, size=512)
        pos1, norm1, uv1, idx1 = reconstruct_figurine_mesh(
            padded_rgba, orig_aspect, grid_w=84, grid_h=120
        )

        glb_bytes = pack_glb(fig_id, meta, pos1, norm1, uv1, idx1, webp_bytes)
        out_path = os.path.join(OUTPUT_DIR, f"{fig_id}.glb")
        with open(out_path, "wb") as f:
            f.write(glb_bytes)

        total_bytes += len(glb_bytes)
        if i % 10 == 0 or i == 1:
            print(
                f"[{i:02d}/60] {fig_id} ({meta.get('name')} - {meta.get('rarity')}): "
                f"{len(pos1)} verts, {len(idx1)//3} tris, {len(glb_bytes)/1024:.1f} KB"
            )

    print(f"Done! Generated 60 GLB models in {OUTPUT_DIR} ({total_bytes / (1024*1024):.2f} MB total).")


if __name__ == "__main__":
    main()
