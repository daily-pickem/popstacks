#!/usr/bin/env python3
"""
Serverless GPU Image-to-3D (.glb) Pipeline on Modal.com using Tencent/Hunyuan3D-2.

Converts `assets/art/figurines/fig-01.webp` .. `fig-60.webp` on your Mac directly into
true 360° textured 3D models (`assets/models/fig-01.glb` .. `fig-60.glb`) using Modal GPUs.

Quickstart:
  1. Install & authenticate Modal on your Mac:
       pip3 install modal
       modal setup

  2. Test 1 figurine first (builds the container image once, caches weights, outputs `assets/models/fig-01.glb`):
       modal run scripts/modal_hunyuan3d.py --only fig-01

  3. Convert all 60 figurines in parallel (up to 4 GPUs concurrently) and rebuild `dist/`:
       modal run scripts/modal_hunyuan3d.py
       npm run build
"""

import io
import os
import time
import modal

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CUTOUT_DIR = os.path.join(ROOT_DIR, "assets", "art", "figurines")
VESSEL_CUTOUT_DIR = os.path.join(ROOT_DIR, "assets", "art", "gacha_vessels")
OUTPUT_DIR = os.path.join(ROOT_DIR, "assets", "models")

# 1. Define the CUDA 12.4 Devel Image with Hunyuan3D-2 + Custom Rasterizer compiled for A10G/L4/L40S/A100
hunyuan_image = (
    modal.Image.from_registry("nvidia/cuda:12.4.1-devel-ubuntu22.04", add_python="3.11")
    .apt_install(
        "git",
        "build-essential",
        "clang",
        "llvm",
        "pkg-config",
        "cmake",
        "ninja-build",
        "libgl1",
        "libegl1",
        "libgl1-mesa-dev",
        "libglib2.0-0",
        "libgomp1",
        "libxrender1",
        "libsm6",
        "libxext6",
    )
    .env(
        {
            # Required so PyTorch compiles CUDA extensions at image-build time without an attached GPU
            # 8.0 = A100, 8.6 = A10G, 8.9 = L4 / L40S / RTX 4090
            "TORCH_CUDA_ARCH_LIST": "8.0;8.6;8.9",
            "FORCE_CUDA": "1",
            "CUDA_HOME": "/usr/local/cuda",
            "HF_HUB_ENABLE_HF_TRANSFER": "1",
        }
    )
    .run_commands(
        "pip install --upgrade pip setuptools wheel pybind11 ninja",
        "pip install torch==2.5.1 torchvision==0.20.1 --index-url https://download.pytorch.org/whl/cu124",
        "git clone https://github.com/Tencent/Hunyuan3D-2.git /opt/Hunyuan3D-2",
        "cd /opt/Hunyuan3D-2 && pip install -r requirements.txt && pip install -e .",
        "pip install hf_transfer trimesh pymeshlab pygltflib xatlas",
        # Compile custom CUDA rasterizer & differentiable renderer for 360° UV texture baking
        "cd /opt/Hunyuan3D-2/hy3dgen/texgen/custom_rasterizer && pip install --no-build-isolation .",
        "cd /opt/Hunyuan3D-2/hy3dgen/texgen/differentiable_renderer && pip install --no-build-isolation .",
    )
    .run_commands(
        # Pin diffusers/transformers compatible with torch 2.5.1 + Hunyuan3D-2 (cached incremental layer)
        "pip install 'diffusers==0.31.0' 'transformers==4.46.3' 'accelerate==1.1.1' 'huggingface-hub>=0.26.0,<1.0.0'"
    )
)

app = modal.App("popstacks-hunyuan3d-converter", image=hunyuan_image)

# Persistent Volume so the ~10 GB Hunyuan3D-2 weights are downloaded only once
hf_cache_vol = modal.Volume.from_name("hunyuan3d-hf-cache", create_if_missing=True)


def ensure_torch_compat():
    import types
    import torch

    if not hasattr(torch, "accelerator"):
        torch.accelerator = types.SimpleNamespace(
            is_available=lambda: torch.cuda.is_available(),
            current_accelerator=lambda: torch.device("cuda" if torch.cuda.is_available() else "cpu"),
        )


@app.cls(
    gpu="L40S",  # 48GB VRAM (you can also use "A10G" or "A100")
    timeout=900,
    max_containers=8,  # Runs up to 8 GPUs in parallel when converting all 60 figurines
    volumes={"/root/.cache/huggingface": hf_cache_vol},
)
class Hunyuan3DWorker:
    @modal.enter()
    def load_models(self):
        import torch

        ensure_torch_compat()
        from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline
        from hy3dgen.texgen import Hunyuan3DPaintPipeline

        print("[Modal GPU] Loading tencent/Hunyuan3D-2 Shape & Texture Paint pipelines...")
        self.shape_pipe = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
            "tencent/Hunyuan3D-2",
            subfolder="hunyuan3d-dit-v2-0",
            use_safetensors=True,
            variant="fp16",
        )
        self.shape_pipe.to("cuda", dtype=torch.float16)

        self.paint_pipe = Hunyuan3DPaintPipeline.from_pretrained("tencent/Hunyuan3D-2")
        hf_cache_vol.commit()
        print("[Modal GPU] Hunyuan3D-2 ready!")

    @modal.method()
    def convert_image_to_glb(
        self,
        fig_id: str,
        image_bytes: bytes,
        steps: int = 35,
        octree_resolution: int = 256,
        target_faces: int = 18000,
        with_texture: bool = True,
    ) -> tuple[str, bytes]:
        import tempfile
        from PIL import Image
        from hy3dgen.shapegen import FaceReducer, FloaterRemover, DegenerateFaceRemover

        t0 = time.time()
        rgba = Image.open(io.BytesIO(image_bytes)).convert("RGBA")

        # Center on clean 1024x1024 RGBA canvas with 7% margin so top/bottom never clip
        size = 1024
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        scale = min((size * 0.86) / rgba.width, (size * 0.86) / rgba.height)
        nw = max(1, int(round(rgba.width * scale)))
        nh = max(1, int(round(rgba.height * scale)))
        resized = rgba.resize((nw, nh), Image.Resampling.LANCZOS)
        canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2))

        # 1. Generate 360° 3D geometry via Hunyuan3D-DiT Flow Matching
        mesh = self.shape_pipe(
            image=canvas,
            num_inference_steps=steps,
            octree_resolution=octree_resolution,
            num_chunks=8000,
            output_type="trimesh",
        )[0]

        # 2. Clean & simplify mesh for smooth mobile WebGL performance
        mesh = FloaterRemover()(mesh)
        mesh = DegenerateFaceRemover()(mesh)
        mesh = FaceReducer()(mesh, max_facenum=target_faces)

        # 3. Synthesize & bake multi-view 360° UV texture map
        if with_texture and self.paint_pipe is not None:
            mesh = self.paint_pipe(mesh, image=canvas)

        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            mesh.export(tmp_path)
            with open(tmp_path, "rb") as f:
                glb_bytes = f.read()
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

        print(f"[Modal GPU] {fig_id} completed in {time.time() - t0:.1f}s ({len(glb_bytes)/1024:.1f} KB)")
        return fig_id, glb_bytes


def is_already_hunyuan_glb(glb_path: str) -> bool:
    if not os.path.exists(glb_path):
        return False
    if os.path.getsize(glb_path) < 700_000:
        return False
    with open(glb_path, "rb") as f:
        head = f.read(512)
    return b"PopStacks Atelier Image-to-3D GLB Pipeline" not in head


@app.local_entrypoint()
def main(
    only: str = "",
    vessels: bool = False,
    steps: int = 35,
    octree_resolution: int = 256,
    target_faces: int = 18000,
    no_texture: bool = False,
    force: bool = False,
):
    """
    Runs locally on your Mac: reads `assets/art/figurines/fig-*.webp` (or `assets/art/gacha_vessels/vessel-*.webp`
    when `--vessels` is passed), dispatches them to Modal GPUs in parallel, and writes the resulting `.glb` files
    to `assets/models/`.
    """
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if vessels:
        target_ids = [only] if only else [f"vessel-{i:02d}" for i in range(1, 11)]
        src_dir = VESSEL_CUTOUT_DIR
    else:
        target_ids = [only] if only else [f"fig-{i:02d}" for i in range(1, 61)]
        src_dir = CUTOUT_DIR

    jobs = []
    for item_id in target_ids:
        webp_path = os.path.join(src_dir, f"{item_id}.webp")
        out_path = os.path.join(OUTPUT_DIR, f"{item_id}.glb")
        if not os.path.exists(webp_path):
            print(f"Skipping {item_id}: {webp_path} not found")
            continue
        if not force and not only and is_already_hunyuan_glb(out_path):
            print(f"Skipping {item_id}: already converted by Hunyuan3D-2 ({os.path.getsize(out_path)/1024:.1f} KB)")
            continue
        with open(webp_path, "rb") as f:
            jobs.append((item_id, f.read(), steps, octree_resolution, target_faces, not no_texture))

    if not jobs:
        print("All requested figurines are already converted!")
        return

    print(f"Dispatching {len(jobs)} figurine(s) to Modal L40S GPUs (Hunyuan3D-2, up to 8 GPUs in parallel)...")
    t_start = time.time()
    worker = Hunyuan3DWorker()

    for idx, (fig_id, glb_bytes) in enumerate(
        worker.convert_image_to_glb.starmap(jobs, order_outputs=False), start=1
    ):
        out_path = os.path.join(OUTPUT_DIR, f"{fig_id}.glb")
        with open(out_path, "wb") as f:
            f.write(glb_bytes)
        print(f"[{idx}/{len(jobs)}] Saved {out_path} ({len(glb_bytes) / 1024:.1f} KB)")

    total_s = time.time() - t_start
    print(f"\nDone in {total_s:.1f}s! Run `npm run build` to copy the new .glb models into `dist/`.")
