#!/usr/bin/env python3
"""
True Neural Image-to-3D (.glb) Converter for PopStacks: Art Toy Atelier.

Supports TWO zero-cost / self-hosted backends to convert all 60 cutouts
(`assets/art/figurines/fig-01.webp` .. `fig-60.webp`) into true 360° 3D `.glb` models
(`assets/models/fig-01.glb` .. `fig-60.glb`):

  Mode 1 — Free Hugging Face Spaces via `gradio_client` (uses your `HF_TOKEN`):
    pip install gradio_client pillow requests
    HF_TOKEN=hf_xxx python3 scripts/generate-glb-hf.py --provider hunyuan3d --only fig-01
    HF_TOKEN=hf_xxx python3 scripts/generate-glb-hf.py --provider trellis

  Mode 2 — Your Self-Hosted GPU VM running `scripts/gpu-vm-hunyuan3d-server.py`:
    python3 scripts/generate-glb-hf.py --server-url http://<YOUR_GPU_VM_IP>:8080
"""

import argparse
import os
import shutil
import sys
import tempfile
import time
import urllib.request

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUTOUT_DIR = os.path.join(ROOT_DIR, "assets", "art", "figurines")
OUTPUT_DIR = os.path.join(ROOT_DIR, "assets", "models")


def prepare_rgba_png(webp_path, out_png_path):
    """Convert .webp RGBA cutout to a clean 1024x1024 padded RGBA .png for neural 3D models."""
    from PIL import Image

    im = Image.open(webp_path).convert("RGBA")
    size = 1024
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    scale = min((size * 0.86) / im.width, (size * 0.86) / im.height)
    nw = max(1, int(round(im.width * scale)))
    nh = max(1, int(round(im.height * scale)))
    resized = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2))
    canvas.save(out_png_path, format="PNG")
    return out_png_path


def extract_glb_path_from_gradio_result(res):
    """Recursively find a .glb file path or dict{'value'|'path'} in a Gradio response."""
    if isinstance(res, str) and res.lower().endswith(".glb") and os.path.exists(res):
        return res
    if isinstance(res, dict):
        for k in ("value", "path", "glb", "mesh"):
            if k in res:
                found = extract_glb_path_from_gradio_result(res[k])
                if found:
                    return found
    if isinstance(res, (list, tuple)):
        for item in res:
            found = extract_glb_path_from_gradio_result(item)
            if found:
                return found
    return None


def convert_via_hf_hunyuan3d(client, png_path, seed=42):
    """Call Tencent/Hunyuan3D-2 Hugging Face Space."""
    from gradio_client import handle_file

    # Hunyuan3D-2 Space exposes `/generation_all` (shape + textured paint in one call)
    try:
        res = client.predict(
            image=handle_file(png_path),
            mv_image_front=None,
            mv_image_back=None,
            mv_image_left=None,
            mv_image_right=None,
            steps=30,
            guidance_scale=5.0,
            seed=seed,
            octree_resolution=256,
            check_box_rembg=False,
            num_chunks=8000,
            randomize_seed=False,
            api_name="/generation_all",
        )
        glb_path = extract_glb_path_from_gradio_result(res)
        if glb_path:
            return glb_path
    except Exception:
        pass

    # Fallback for simplified Hunyuan3D-2 Spaces where `/shape_generation` or `/predict` is primary
    res = client.predict(image=handle_file(png_path), api_name="/generation_all")
    glb_path = extract_glb_path_from_gradio_result(res)
    if not glb_path:
        raise RuntimeError(f"Could not locate .glb file in Hunyuan3D-2 response: {res}")
    return glb_path


def convert_via_hf_trellis(client, png_path, seed=42):
    """Call Microsoft TRELLIS Hugging Face Space (e.g. trellis-community/TRELLIS)."""
    from gradio_client import handle_file

    try:
        client.predict(api_name="/start_session")
    except Exception:
        pass

    # Step 1: image_to_3d
    res1 = client.predict(
        image=handle_file(png_path),
        multiimages=[],
        seed=seed,
        ss_guidance_strength=7.5,
        ss_sampling_steps=12,
        slat_guidance_strength=3.0,
        slat_sampling_steps=12,
        multiimage_algo="stochastic",
        api_name="/image_to_3d",
    )
    glb_direct = extract_glb_path_from_gradio_result(res1)
    if glb_direct:
        return glb_direct

    # Step 2: extract_glb (bakes 1024x1024 UV texture into watertight simplified .glb)
    res2 = client.predict(
        mesh_simplify=0.95,
        texture_size=1024,
        api_name="/extract_glb",
    )
    glb_path = extract_glb_path_from_gradio_result(res2)
    if not glb_path:
        raise RuntimeError(f"Could not locate .glb file in TRELLIS response: {res2}")
    return glb_path


def convert_via_gpu_vm(server_url, png_path, fig_id):
    """Send RGBA PNG to self-hosted GPU VM server (`scripts/gpu-vm-hunyuan3d-server.py`)."""
    import requests

    url = server_url.rstrip("/") + "/generate-glb"
    with open(png_path, "rb") as f:
        resp = requests.post(
            url,
            files={"image": (f"{fig_id}.png", f, "image/png")},
            data={"fig_id": fig_id},
            timeout=600,
        )
    if resp.status_code != 200:
        raise RuntimeError(f"GPU VM returned HTTP {resp.status_code}: {resp.text[:300]}")
    tmp_glb = tempfile.NamedTemporaryFile(delete=False, suffix=".glb")
    tmp_glb.write(resp.content)
    tmp_glb.close()
    return tmp_glb.name


def main():
    parser = argparse.ArgumentParser(description="Convert PopStacks figurines to true 3D .glb models.")
    parser.add_argument(
        "--provider",
        choices=["hunyuan3d", "trellis"],
        default="hunyuan3d",
        help="Hugging Face Space model to use when --server-url is not set (default: hunyuan3d)",
    )
    parser.add_argument(
        "--space-id",
        default=None,
        help="Optional custom Hugging Face Space ID (e.g. tencent/Hunyuan3D-2 or trellis-community/TRELLIS)",
    )
    parser.add_argument(
        "--server-url",
        default=os.environ.get("GPU_VM_URL"),
        help="URL of your self-hosted GPU VM server, e.g. http://10.0.0.12:8080",
    )
    parser.add_argument(
        "--only",
        default=None,
        help="Convert only a specific figurine ID, e.g. --only fig-01",
    )
    args = parser.parse_args()

    os.makedirs(OUTPUT_DIR, exist_ok=True)
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACE_TOKEN")

    client = None
    if not args.server_url:
        try:
            from gradio_client import Client
        except ImportError:
            print("Missing dependency: run `pip install gradio_client pillow requests` first.", file=sys.stderr)
            sys.exit(1)

        space_id = args.space_id or (
            "tencent/Hunyuan3D-2" if args.provider == "hunyuan3d" else "trellis-community/TRELLIS"
        )
        print(f"Connecting to Hugging Face Space `{space_id}`...")
        client = Client(space_id, hf_token=hf_token)

    target_ids = [args.only] if args.only else [f"fig-{i:02d}" for i in range(1, 61)]

    with tempfile.TemporaryDirectory() as tmpdir:
        for idx, fig_id in enumerate(target_ids, start=1):
            webp_path = os.path.join(CUTOUT_DIR, f"{fig_id}.webp")
            out_glb_path = os.path.join(OUTPUT_DIR, f"{fig_id}.glb")
            if not os.path.exists(webp_path):
                print(f"[{idx}/{len(target_ids)}] Skipping {fig_id}: missing {webp_path}")
                continue

            png_path = os.path.join(tmpdir, f"{fig_id}.png")
            prepare_rgba_png(webp_path, png_path)

            t0 = time.time()
            print(f"[{idx}/{len(target_ids)}] Generating true 3D GLB for {fig_id}...")
            if args.server_url:
                tmp_glb = convert_via_gpu_vm(args.server_url, png_path, fig_id)
            elif args.provider == "hunyuan3d":
                tmp_glb = convert_via_hf_hunyuan3d(client, png_path, seed=42 + idx)
            else:
                tmp_glb = convert_via_hf_trellis(client, png_path, seed=42 + idx)

            shutil.copyfile(tmp_glb, out_glb_path)
            dt = time.time() - t0
            size_kb = os.path.getsize(out_glb_path) / 1024.0
            print(f"  -> Saved {out_glb_path} ({size_kb:.1f} KB in {dt:.1f}s)")

    print("\nAll requested .glb models generated! Run `npm run build` to copy them to `dist/`.")


if __name__ == "__main__":
    main()
