"""Ultra Paper — server-side PDF extraction (PyMuPDF + optional Tesseract OCR + pdfplumber fallback)."""
from __future__ import annotations

import io
import re
import shutil
from typing import Any

import fitz  # PyMuPDF

try:
    import pytesseract
    from PIL import Image
except Exception:  # pragma: no cover - optional
    pytesseract = None

try:
    import pdfplumber
except Exception:  # pragma: no cover - optional
    pdfplumber = None

HAS_TESSERACT = bool(pytesseract) and shutil.which("tesseract") is not None
HAS_TABLES = hasattr(fitz.Page, "find_tables")

_NORMALIZE = [(re.compile(r"(\d)\s?[·•∙]\s?(\d)"), r"\1.\2"), (re.compile(r"[\u2212\u2010\u2011]"), "-"),
              (re.compile(r"([a-z])-\n([a-z])"), r"\1\2"), (re.compile(r"\u00a0"), " ")]


def normalize(text: str) -> str:
    for rx, rep in _NORMALIZE:
        text = rx.sub(rep, text)
    return text.replace("\ufb01", "fi").replace("\ufb02", "fl")


def _ocr_page(page: "fitz.Page", lang: str) -> str:
    pix = page.get_pixmap(dpi=300)
    img = Image.open(io.BytesIO(pix.tobytes("png")))
    return pytesseract.image_to_string(img, lang=lang, config="--psm 3")


def _clean_table(rows: list[list[Any]]) -> list[list[str]]:
    out = []
    for r in rows:
        cells = ["" if c is None else re.sub(r"\s+", " ", str(c)).strip() for c in r]
        if any(cells):
            out.append(cells[:25])
    return out[:150]


def extract(data: bytes, ocr: bool = True, lang: str = "eng+ind", max_pages: int = 300) -> dict:
    doc = fitz.open(stream=data, filetype="pdf")
    pages, tables, ocr_pages = [], [], []
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        no = i + 1
        # sort=True orders blocks top-left to bottom-right; good for most 1-2 column layouts
        text = page.get_text("text", sort=True)
        engine = "PyMuPDF"
        if ocr and HAS_TESSERACT and len(text.strip()) < 60:
            try:
                text, engine = _ocr_page(page, lang), "Tesseract OCR"
                ocr_pages.append(no)
            except Exception as exc:  # pragma: no cover
                engine = f"OCR failed: {exc}"
        pages.append({"page": no, "text": normalize(text), "engine": engine})
        if HAS_TABLES:
            try:
                for j, t in enumerate(page.find_tables().tables, 1):
                    rows = _clean_table(t.extract())
                    if len(rows) >= 2:
                        tables.append({"page": no, "index": j, "method": "PyMuPDF find_tables", "rows": rows})
            except Exception:
                pass
    if not tables and pdfplumber is not None:
        try:
            with pdfplumber.open(io.BytesIO(data)) as pdf:
                for i, pg in enumerate(pdf.pages[:max_pages], 1):
                    for j, t in enumerate(pg.extract_tables(), 1):
                        rows = _clean_table(t)
                        if len(rows) >= 2:
                            tables.append({"page": i, "index": j, "method": "pdfplumber", "rows": rows})
        except Exception:
            pass
    meta = doc.metadata or {}
    return {"page_count": doc.page_count, "pages": pages, "tables": tables, "ocr_pages": ocr_pages,
            "metadata": {"title": meta.get("title", ""), "author": meta.get("author", ""), "subject": meta.get("subject", ""),
                         "keywords": meta.get("keywords", "")},
            "engine": f"PyMuPDF {fitz.VersionBind}" + (" + Tesseract" if ocr_pages else "")}


RATIO = re.compile(r"\b(a?HR|a?OR|a?RR|IRR|hazard ratio|odds ratio|risk ratio|relative risk)\b[^0-9\n]{0,30}?(\d+(?:\.\d+)?)\s*[(\[,;]?\s*"
                   r"(?:95\s*%\s*(?:CI|confidence interval)\s*[:=,]?\s*)?(\d+(?:\.\d+)?)\s*(?:to|–|—|,|;|-)\s*(\d+(?:\.\d+)?)", re.I)
EVENTS = re.compile(r"\b(\d{1,6})\s*/\s*(\d{1,7})\b(?:\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\))?")


def parse_statistics(text: str, page: int = 1) -> list[dict]:
    """Python port of the browser parser (subset) for batch pipelines."""
    out = []
    for m in RATIO.finditer(text):
        est, lo, hi = float(m[2]), float(m[3]), float(m[4])
        if 0 < lo <= est <= hi:
            out.append({"type": "ratio", "page": page, "measure": m[1], "est": est, "lower": lo, "upper": hi, "raw": m[0]})
    for m in EVENTS.finditer(text):
        a, n = int(m[1]), int(m[2])
        pct = float(m[3]) if m[3] else None
        if n > 0 and a <= n and (pct is None or abs(a / n * 100 - pct) < 0.6) and not (1900 <= n <= 2100 and a <= 31):
            out.append({"type": "events", "page": page, "events": a, "total": n, "pct": pct, "raw": m[0]})
    return out
