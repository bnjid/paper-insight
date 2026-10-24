# Advanced Engine (opsional) — Python · R · Stata

GitHub Pages hanya menyajikan file statis; **R, Python, dan Stata tidak berjalan di sana**. Folder ini berisi mesin lokal untuk kebutuhan lanjutan. Aplikasi web tetap berfungsi penuh tanpa backend.

| Komponen | Fungsi |
|---|---|
| `app.py` | FastAPI: `/api/health`, `/api/extract` (PDF → teks + tabel + OCR), `/api/meta` (validasi SciPy), `/api/metafor` (validasi R) |
| `extract_pdf.py` | PyMuPDF `find_tables`, fallback pdfplumber, OCR Tesseract 300 dpi |
| `meta_stats.py` | Mesin meta-analisis NumPy/SciPy independen (FE/DL/HE/SJ/PM/ML/REML, z/KH) |
| `validate_metafor.R` | Validasi & grafik publikasi dengan `metafor` |
| `report.py` | Forest/funnel PNG 300 dpi + `report.md` dari CSV |
| `stata/ultra_paper_meta.do` | Analisis Stata 16+ dari CSV ekspor |

## 1. Python

```bash
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.app:app --host 127.0.0.1 --port 8765
```

Buka aplikasi → **Paper Extraction → Periksa backend**. Chrome mengizinkan halaman `https://bnjid.github.io` mengakses `http://127.0.0.1` (header Private Network Access sudah ditangani). Ubah origin yang diizinkan dengan variabel `UP_ALLOWED_ORIGINS`.

**OCR:** pasang Tesseract + data bahasa.
- Ubuntu: `sudo apt install tesseract-ocr tesseract-ocr-ind`
- macOS: `brew install tesseract tesseract-lang`
- Windows: installer UB Mannheim, centang *Indonesian*, tambahkan ke PATH.

## 2. R (RStudio)

```r
install.packages(c("metafor", "jsonlite"))
```
```bash
Rscript backend/validate_metafor.R ultra-paper-analysis-data.csv REML knha
```
Jika `Rscript` ada di PATH saat backend dijalankan, tombol **Bandingkan dengan R metafor** aktif.

## 3. Stata 16+

```stata
do backend/stata/ultra_paper_meta.do "ultra-paper-analysis-data.csv"
```

## 4. Laporan Python

```bash
python -m backend.report ultra-paper-analysis-data.csv --method REML --test knha --ratio --out report
```

## Keamanan
- Bind ke `127.0.0.1` (jangan `0.0.0.0` di jaringan publik). PDF diproses di memori, tidak disimpan.
- Batas ukuran `UP_MAX_MB` (default 40). Tidak ada autentikasi — jangan expose ke internet tanpa reverse proxy + auth.
- Jangan unggah data identitas pasien.
