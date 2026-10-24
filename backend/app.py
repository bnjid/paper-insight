"""Ultra Paper — optional local engine (FastAPI).

Run:  uvicorn backend.app:app --host 127.0.0.1 --port 8765
Endpoints: GET /api/health · POST /api/extract (PDF) · POST /api/meta (yi/vi) · POST /api/metafor (yi/vi via R)
Security: binds to localhost by default; PDFs are processed in memory and never written to disk.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from . import meta_stats
from .extract_pdf import HAS_TABLES, HAS_TESSERACT, extract

VERSION = "3.0.0"
MAX_BYTES = int(os.getenv("UP_MAX_MB", "40")) * 1024 * 1024
ORIGINS = [o.strip() for o in os.getenv("UP_ALLOWED_ORIGINS", "https://bnjid.github.io,http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8000,http://localhost:8000,null").split(",") if o.strip()]
R_SCRIPT = Path(__file__).with_name("validate_metafor.R")

app = FastAPI(title="Ultra Paper Engine", version=VERSION)
app.add_middleware(CORSMiddleware, allow_origins=ORIGINS, allow_methods=["GET", "POST", "OPTIONS"], allow_headers=["*"])


@app.middleware("http")
async def private_network_access(request: Request, call_next):
    """Chrome Private Network Access: allow https://*.github.io to reach 127.0.0.1."""
    response = await call_next(request)
    if request.method == "OPTIONS" and request.headers.get("access-control-request-private-network"):
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response


def _has_metafor() -> bool:
    if not shutil.which("Rscript"):
        return False
    try:
        r = subprocess.run(["Rscript", "-e", "cat(requireNamespace('metafor', quietly=TRUE) && requireNamespace('jsonlite', quietly=TRUE))"],
                           capture_output=True, text=True, timeout=30)
        return r.stdout.strip().endswith("TRUE")
    except Exception:
        return False


METAFOR = _has_metafor()


@app.get("/api/health")
def health():
    return {"ok": True, "version": VERSION, "ocr": HAS_TESSERACT, "tables": HAS_TABLES, "R": bool(shutil.which("Rscript")), "metafor": METAFOR}


@app.post("/api/extract")
async def api_extract(file: UploadFile = File(...), ocr: str = Form("true"), lang: str = Form("eng+ind")):
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "PDF terlalu besar")
    if not data.startswith(b"%PDF"):
        raise HTTPException(415, "Bukan file PDF")
    if not all(part.isalpha() and len(part) <= 8 for part in lang.split("+")):
        raise HTTPException(400, "Bahasa OCR tidak valid")
    try:
        return extract(data, ocr=ocr.lower() == "true", lang=lang)
    except Exception as exc:
        raise HTTPException(422, f"Gagal membaca PDF: {exc}") from exc


class Study(BaseModel):
    name: str = ""
    yi: float
    vi: float = Field(gt=0)


class MetaRequest(BaseModel):
    studies: list[Study] = Field(min_length=1, max_length=5000)
    method: str = "REML"
    test: str = "z"
    level: float = Field(95, gt=50, lt=100)


@app.post("/api/meta")
def api_meta(req: MetaRequest):
    try:
        r = meta_stats.pool([s.yi for s in req.studies], [s.vi for s in req.studies], req.method, req.test, req.level)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc
    d = r.to_dict()
    d["engine"] = "Python NumPy/SciPy (backend/meta_stats.py)"
    return d


@app.post("/api/metafor")
def api_metafor(req: MetaRequest):
    if not METAFOR:
        raise HTTPException(501, "R + metafor + jsonlite belum terpasang")
    with tempfile.TemporaryDirectory() as tmp:
        src, dst = Path(tmp, "in.json"), Path(tmp, "out.json")
        src.write_text(json.dumps(req.model_dump()))
        r = subprocess.run(["Rscript", str(R_SCRIPT), "--json", str(src), str(dst)], capture_output=True, text=True, timeout=120)
        if r.returncode != 0 or not dst.exists():
            raise HTTPException(500, r.stderr[-800:])
        return json.loads(dst.read_text())
