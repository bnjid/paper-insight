# Ultra Paper Evidence Studio 3.0

Ekstraksi artikel & PDF → data studi berprovenance → meta-analisis tervalidasi → skrip reproducible **R · Stata · Python**. Berjalan penuh di browser (GitHub Pages), dengan mesin Python/R lokal opsional.

**Demo:** https://bnjid.github.io/paper-insight/

## Fitur

**Ekstraksi artikel (browser, tanpa server)**
- PDF.js text layer dengan **urutan baca dua kolom**, penghapusan header/footer berulang, perbaikan hyphenation, ligatur, dan desimal gaya Lancet (`0·74`).
- **OCR otomatis** (Tesseract.js, Inggris + Indonesia) untuk halaman scan — dimuat hanya saat dibutuhkan.
- Judul berbasis ukuran font, kandidat penulis, DOI, tahun, desain studi, ukuran sampel, follow-up, registrasi (NCT/ISRCTN/PROSPERO), kata kunci, pendanaan, bagian Abstract → Conclusion (Inggris & Indonesia), kandidat research gap.
- **Parser statistik terstruktur:** HR/OR/RR/IRR + 95% CI, MD/SMD/β + CI, events/N (dicek terhadap %), mean ± SD, median (IQR), p-value, n =, I².
- **Metadata Crossref** (opsional; hanya DOI yang dikirim).
- Juga menerima TXT, Markdown, HTML, JATS-XML, dan teks tempel.

**Evidence Explorer**
- Gambar halaman PDF asli berdampingan dengan teks ekstraksi; pencarian dengan highlight; navigasi halaman.
- Satu klik dari statistik terdeteksi → form transfer (2×2, rasio + CI, mean/SD per arm, selisih + CI, proporsi). Setiap baris menyimpan file, halaman, dan kutipan sumber.
- Tabel terdeteksi dapat diunduh sebagai CSV.

**Meta-analisis** (tervalidasi terhadap `metafor` — lihat `tests/`)
- Effect size: RR, OR, RD, MD, Hedges' g (koreksi J eksak), rasio terpublikasi + CI (HR/aOR), generic IV, proporsi (logit), korelasi (Fisher z).
- τ²: REML, Paule–Mandel, DerSimonian–Laird, ML, Sidik–Jonkman, Hedges, common-effect. Inferensi z, Knapp–Hartung, KH ad-hoc.
- Q, I² (τ²-based & Higgins), H², **CI Q-profile untuk τ² dan I²**, prediction interval.
- Forest plot publikasi (bobot, RoB, PI, label "favours"), cumulative forest, subgroup (uji random-effects), **meta-regresi** mixed-effects + bubble plot.
- Bias & sensitivitas: contour-enhanced funnel, Egger, Begg, **trim-and-fill (L0)**, Baujat, Galbraith, leave-one-out, studentized residual, L'Abbé.
- Kalkulator konversi: median/IQR atau range → mean/SD (Luo 2018, Wan 2014), SE/CI → SD, gabung multi-arm, rasio + CI → ln/SE, p → SE, ln(OR) ↔ SMD, r → z.

**Interpretasi, panduan & glosarium**
- Kartu **Interpretasi & Kesimpulan** otomatis: besar & arah efek (mis. "risiko 51% lebih rendah", NNT, ukuran Cohen), signifikansi, kategori heterogenitas (Cochrane), presisi, bias publikasi, robustnes leave-one-out, risiko bias, serta **indikasi kepastian bukti gaya GRADE** dan paragraf kesimpulan (ID/EN) — juga di Dashboard, laporan HTML, dan Teks Metode.
- Interpretasi meta-regresi dan small-study effects.
- Tombol **?** di samping judul/kolom menjelaskan ±70 istilah & akronim; halaman **Panduan & Glosarium** (mulai cepat, panduan per halaman, FAQ, glosarium dapat dicari); tombol **❓ Panduan** kontekstual per halaman.
- **↺ Reset** proyek (dengan tawaran backup), **↺ Default** pengaturan analisis, **↺ Kosongkan form** transfer.

**Ekspor & reproducibility**
- Skrip **R (metafor)**, **Stata 16+ (meta)**, **Python (SciPy/matplotlib)** dengan data Anda tertanam; draf teks Metode & Hasil (EN/ID).
- Laporan HTML (siap print/PDF), forest/funnel SVG & PNG 300 dpi, CSV hasil, CSV data, JSON proyek, PRISMA 2020 SVG.
- Autosave lokal; file PDF tidak pernah diunggah.

## Struktur repository

```
index.html  styles.css  pro.css  qris.png  thumbnail.jpg  .nojekyll
js/stats.js      mesin statistik (browser + Node)
js/extract.js    PDF/OCR/parser
js/plots.js      grafik SVG
js/codegen.js    generator skrip R/Stata/Python
js/app.js        UI
data/            bcg-colditz-1994.csv, contoh-studi-sintetis.csv
backend/         FastAPI (PyMuPDF tables, Tesseract), meta_stats.py, validate_metafor.R, stata/*.do, report.py
tests/           node:test (stats.test.mjs) + pytest (test_meta_stats.py)
.github/workflows/ci.yml
```

## Deploy ke GitHub Pages

1. Unggah **seluruh isi folder** ke root repository `bnjid/paper-insight` (replace file lama; `app.js` lama di root tidak dipakai lagi dan boleh dihapus).
2. **Settings → Pages → Deploy from a branch → `main` / (root)**.
3. Tab **Actions** menjalankan tes JS, Python, dan validasi R otomatis pada setiap push.

Jalankan lokal: `python -m http.server 8000` lalu buka `http://localhost:8000` (PDF.js butuh server, bukan `file://`).

## Validasi

`node --test tests/` dan `pytest tests/` mereproduksi output `metafor` untuk dataset BCG: REML log RR = −0.7145 (SE 0.1798), τ² = 0.3132 [0.1197, 1.1115], I² = 92.22%; DL τ² = 0.3088; meta-regresi latitude b = −0.0291, τ² = 0.0764.

## Catatan ilmiah

- **Tidak ada ekstraksi otomatis yang sempurna.** Tabel kompleks, figur, scan berkualitas rendah, supplementary, multi-arm, cluster RCT, dan adjusted estimate memerlukan keputusan manusia. Semua angka adalah *kandidat* sampai diverifikasi dua reviewer.
- Pastikan populasi, intervensi, pembanding, definisi outcome, timepoint, dan unit analisis setara sebelum pooling. Jangan mencampur HR, OR, dan RR.
- Uji asimetri funnel tidak andal bila k < 10; trim-and-fill adalah analisis sensitivitas.
- Untuk publikasi, jalankan ulang skrip R/Stata yang dibangkitkan dan dokumentasikan versi paket.
- Jangan unggah data identitas pasien. Google Analytics (G-XSN0M1W9R8) hanya mencatat page view.

© 2026 Ultra Paper · MIT License · Dukungan sukarela via QRIS resmi **BOOKS AND JOURNAL** (`qris.png` — jangan diganti tanpa izin pemilik).
