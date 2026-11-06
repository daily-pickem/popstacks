#!/usr/bin/env python3
"""
Self-Hosted GPU VM Worker for True 360° Image-to-3D (.glb) Conversion
using Tencent Hunyuan3D-2 (`tencent/Hunyuan3D-2`).

Can be run on your CUDA GPU VM (16GB+ VRAM recommended, e.g. L4 / A10G / RTX 4090 / A100) in two ways:
  1. HTTP API Server Mode (recommended so your Mac can call it directly):
     python3 gpu-vm-hunyuan3d-server.py --serve --host 0.0.0.0 --port 8080

  2. Local Folder Batch Mode on the GPU VM:
     python3 gpu-vm-hunyuan3d-server.py --batch --input-dir ./figurines --output-dir ./models
"""

import argparse
import glob
import io
import os
import tempfile
import time
from PIL import Image

SHAPE_PIPE = None
PAINT_PIPE = None


def load_hunyuan3d_pipelines(with_texture=True):
    global SHAPE_PIPE, PAINT_PIPE
    if SHAPE_PIPE is not None:
        return SHAPE_PIPE, PAINT_PIPE

    import torch
    from hy3dgen.shapegen import Hunyuan3DDiTFlowMatchingPipeline, FaceReducer, FloaterRemover, DegenerateFaceRemover

    print("[GPU-VM] Loading Hunyuan3D-2 Shape Pipeline (tencent/Hunyuan3D-2)...")
    SHAPE_PIPE = Hunyuan3DDiTFlowMatchingPipeline.from_pretrained(
        "tencent/Hunyuan3D-2",
        subfolder="hunyuan3d-dit-v2-0",
        use_safetensors=True,
        variant="fp16",
    )
    SHAPE_PIPE.to("cuda")

    if with_texture:
        try:
            from hy3dgen.texgen import Hunyuan3DPaintPipeline

            print("[GPU-VM] Loading Hunyuan3D-2 Texture Paint Pipeline...")
            PAINT_PIPE = Hunyuan3DPaintPipeline.from_pretrained("tencent/Hunyuan3D-2")
        except Exception as exc:
            print(f"[GPU-VM] Warning: Texture paint pipeline unavailable ({exc}); exporting untextured mesh.")
            PAINT_PIPE = None

    return SHAPE_PIPE, PAINT_PIPE


def convert_single_image_to_glb(pil_img, out_glb_path, target_faces=18000):
    from hy3dgen.shapegen import FaceReducer, FloaterRemover, DegenerateFaceRemover

    shape_pipe, paint_pipe = load_hunyuan3d_pipelines(with_texture=True)

    # Ensure clean 1024x1024 RGBA input
    rgba = pil_img.convert("RGBA")
    size = 1024
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    scale = min((size * 0.86) / rgba.width, (size * 0.86) / rgba.height)
    nw = max(1, int(round(rgba.width * scale)))
    nh = max(1, int(round(rgba.height * scale)))
    resized = rgba.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas.paste(resized, ((size - nw) // 2, (size - nh) // 2))

    mesh = shape_pipe(
        image=canvas,
        num_inference_steps=35,
        octree_resolution=256,
        num_chunks=8000,
        output_type="trimesh",
    )[0]

    mesh = FloaterRemover()(mesh)
    mesh = DegenerateFaceRemover()(mesh)
    mesh = FaceReducer()(mesh, max_facenum=target_faces)

    if paint_pipe is not None:
        mesh = paint_pipe(mesh, image=canvas)

    mesh.export(out_glb_path)
    return out_glb_path


def run_batch(input_dir, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    files = sorted(
        glob.glob(os.path.join(input_dir, "fig-*.webp"))
        + glob.glob(os.path.join(input_dir, "fig-*.png"))
    )
    if not files:
        raise FileNotFoundError(f"No fig-*.webp or fig-*.png files found in {input_dir}")

    for idx, fpath in enumerate(files, start=1):
        stem = os.path.splitext(os.path.basename(fpath))[0]
        out_path = os.path.join(output_dir, f"{stem}.glb")
        t0 = time.time()
        print(f"[{idx}/{len(files)}] Converting {fpath} -> {out_path} ...")
        im = Image.open(fpath).convert("RGBA")
        convert_single_image_to_glb(im, out_path)
        print(f"  -> Done in {time.time() - t0:.1f}s ({os.path.getsize(out_path)/1024:.1f} KB)")


def run_server(host, port):
    from fastapi import FastAPI, File, Form, UploadFile
    from fastapi.responses import Response
    import uvicorn

    app = FastAPI(title="PopStacks Hunyuan3D-2 GPU Worker")
    load_hunyuan3d_pipelines(with_texture=True)

    @app.get("/health")
    def health():
        return {"status": "ok"}

    @app.post("/generate-glb")
    async def generate_glb(image: UploadFile = File(...), fig_id: str = Form("fig-01")):
        raw = await image.read()
        pil_img = Image.open(io.BytesIO(raw)).convert("RGBA")
        with tempfile.NamedTemporaryFile(suffix=".glb", delete=False) as tmp:
            tmp_path = tmp.name
        try:
            convert_single_image_to_glb(pil_img, tmp_path)
            with open(tmp_path, "rb") as f:
                glb_bytes = f.read()
            return Response(content=glb_bytes, media_type="model/gltf-binary")
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    uvicorn.run(app, host=host, port=port)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--serve", action="store_true", help="Run FastAPI server on --host:--port")
    parser.add_argument("--batch", action="store_true", help="Batch-convert all images in --input-dir")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--input-dir", default="./figurines")
    parser.add_argument("--output-dir", default="./models")
    args = parser.parse_args()

    if args.serve:
        run_server(args.host, args.port)
    else:
        run_batch(args.input_dir, args.output_dir)
