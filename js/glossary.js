/* Ultra Paper — glossary, contextual help & usage guide (window.UPHelp). */
(function () { 'use strict';
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* key → [nama lengkap, penjelasan, kategori] */
const TERMS = {
  'RR': ['Risk Ratio (rasio risiko)', 'Risiko kejadian pada kelompok intervensi dibagi risiko pada kontrol. RR = 1: tidak ada beda; RR 0,75: risiko 25% lebih rendah; RR 1,30: risiko 30% lebih tinggi.', 'Effect size'],
  'OR': ['Odds Ratio', 'Perbandingan odds (peluang kejadian ÷ peluang tidak terjadi) antara intervensi dan kontrol. Mendekati RR bila kejadian jarang (< 10%).', 'Effect size'],
  'RD': ['Risk Difference (selisih risiko)', 'Selisih absolut risiko: risiko intervensi − risiko kontrol. RD −0,05 = 5 poin persen lebih sedikit kejadian. 1/|RD| = NNT/NNH.', 'Effect size'],
  'MD': ['Mean Difference (selisih rerata)', 'Selisih rerata outcome kontinu antar kelompok dalam satuan aslinya (mis. mmHg). Hanya untuk studi dengan satuan sama.', 'Effect size'],
  'SMD': ['Standardized Mean Difference', "Selisih rerata dibagi SD gabungan, sehingga skala berbeda dapat digabung. Patokan Cohen: 0,2 kecil, 0,5 sedang, 0,8 besar.", 'Effect size'],
  "Hedges' g": ["Hedges' g", 'SMD dengan koreksi bias sampel kecil (faktor J). Interpretasi sama dengan SMD.', 'Effect size'],
  'HR': ['Hazard Ratio', 'Rasio laju kejadian per satuan waktu (analisis survival, mis. Cox). Jangan digabung dengan OR/RR.', 'Effect size'],
  'aHR': ['Adjusted Hazard Ratio', 'HR yang sudah disesuaikan dengan kovariat (confounder). Pastikan set kovariat antarstudi sebanding.', 'Effect size'],
  'aOR': ['Adjusted Odds Ratio', 'OR hasil regresi multivariabel yang disesuaikan dengan confounder.', 'Effect size'],
  'GENR': ['Rasio terpublikasi + CI', 'Mode input untuk HR/aOR/aRR yang dilaporkan beserta 95% CI. Aplikasi mengubahnya ke ln(estimate) dan SE dari lebar CI.', 'Effect size'],
  'GEN': ['Generic inverse-variance', 'Input langsung effect (yi) dan standard error pada skala analisis, mis. ln HR dan SE(ln HR).', 'Effect size'],
  'PLO': ['Proporsi logit', 'Meta-analisis prevalensi/proporsi. Dianalisis pada skala logit agar CI tetap di antara 0 dan 1.', 'Effect size'],
  'ZCOR': ['Korelasi Fisher z', 'Koefisien korelasi r diubah ke z = atanh(r) agar distribusinya mendekati normal, lalu dikembalikan ke r.', 'Effect size'],
  'CI': ['Confidence Interval (interval kepercayaan)', 'Rentang nilai yang kompatibel dengan data. Jika 95% CI tidak mencakup nilai null (1 untuk rasio, 0 untuk selisih), hasil bermakna pada α = 0,05.', 'Inferensi'],
  'PI': ['Prediction Interval', 'Rentang efek yang diperkirakan pada studi/setting baru, memperhitungkan heterogenitas (τ²). Selalu lebih lebar dari CI.', 'Inferensi'],
  'Prediction interval': ['Prediction Interval', 'Rentang efek yang diperkirakan pada studi/setting baru, memperhitungkan heterogenitas (τ²). Selalu lebih lebar dari CI.', 'Inferensi'],
  'p-value': ['p-value', 'Peluang mendapatkan hasil seekstrem ini bila sebenarnya tidak ada efek. p < 0,05 lazim disebut bermakna, tetapi tidak mengukur besar atau pentingnya efek.', 'Inferensi'],
  'I²': ['I² (heterogenitas)', 'Persentase variasi antarstudi yang bukan karena kebetulan. Panduan Cochrane: 0–40% mungkin tidak penting, 30–60% moderat, 50–90% substansial, 75–100% sangat besar.', 'Heterogenitas'],
  'τ²': ['Tau² (varians antarstudi)', 'Besarnya variasi efek sebenarnya antarstudi pada skala analisis. τ² = 0 berarti tidak ada heterogenitas yang terdeteksi.', 'Heterogenitas'],
  'τ': ['Tau', 'Akar τ²: simpangan baku efek sebenarnya antarstudi.', 'Heterogenitas'],
  'Cochran Q': ["Cochran's Q", 'Uji chi-square apakah variasi antarstudi melebihi yang diharapkan dari kebetulan. Daya uji rendah bila studi sedikit (sering memakai p < 0,10).', 'Heterogenitas'],
  'Q': ["Cochran's Q", 'Statistik uji heterogenitas (chi-square, df = k − 1).', 'Heterogenitas'],
  'H²': ['H²', 'Rasio variabilitas total terhadap variabilitas sampling. H² = 1 berarti homogen.', 'Heterogenitas'],
  'Heterogeneity': ['Heterogenitas', 'Perbedaan hasil antarstudi melebihi kebetulan—akibat beda populasi, intervensi, desain, atau risiko bias.', 'Heterogenitas'],
  'REML': ['Restricted Maximum Likelihood', 'Estimator τ² default di R metafor; umumnya direkomendasikan untuk outcome kontinu maupun biner.', 'Model'],
  'DL': ['DerSimonian–Laird', 'Estimator τ² klasik (metode momen). Cepat, tetapi cenderung meremehkan τ² bila studi sedikit.', 'Model'],
  'PM': ['Paule–Mandel', 'Estimator τ² yang direkomendasikan beberapa panduan, termasuk untuk outcome biner.', 'Model'],
  'ML': ['Maximum Likelihood', 'Estimator τ² berbasis likelihood penuh; cenderung bias ke bawah pada k kecil.', 'Model'],
  'SJ': ['Sidik–Jonkman', 'Estimator τ² yang cenderung lebih besar (konservatif).', 'Model'],
  'Random effects': ['Model random-effects', 'Mengasumsikan efek sebenarnya bervariasi antarstudi; pooled effect = rerata distribusi efek. Pilihan umum untuk meta-analisis klinis.', 'Model'],
  'Common effect': ['Model common/fixed-effect', 'Mengasumsikan satu efek sebenarnya yang sama untuk semua studi. Hanya wajar bila studi sangat homogen.', 'Model'],
  'Knapp–Hartung': ['Koreksi Knapp–Hartung (KH)', 'Menghitung CI efek gabungan dengan distribusi t dan varians yang disesuaikan, sehingga lebih jujur bila jumlah studi sedikit.', 'Model'],
  'Inverse-variance': ['Pembobotan inverse-variance', 'Setiap studi diberi bobot 1/varians: studi besar & presisi memperoleh bobot lebih besar.', 'Model'],
  'Forest Plot': ['Forest plot', 'Grafik efek tiap studi (kotak = estimasi, ukuran = bobot, garis = CI) dan efek gabungan (diamond).', 'Grafik'],
  'Funnel plot': ['Funnel plot', 'Sebaran efek terhadap standard error. Asimetri dapat menandakan small-study effects / bias publikasi.', 'Grafik'],
  'Contour': ['Contour-enhanced funnel', 'Funnel dengan zona signifikansi (p < 0,01, 0,05, 0,10) untuk membedakan bias publikasi dari penyebab asimetri lain.', 'Grafik'],
  'Egger': ['Uji Egger', 'Regresi efek terstandar terhadap presisi; intercept ≠ 0 menandakan asimetri funnel. Gunakan bila k ≥ 10; ambang lazim p < 0,10.', 'Bias'],
  'Begg': ['Uji Begg', 'Korelasi rank Kendall antara efek terstandar dan varians; daya uji lebih rendah dari Egger.', 'Bias'],
  'Trim-and-fill': ['Trim-and-fill', 'Memperkirakan studi "hilang" dari sisi funnel yang kosong dan menghitung ulang efek. Analisis sensitivitas, bukan koreksi definitif.', 'Bias'],
  'Small-study effects': ['Small-study effects', 'Kecenderungan studi kecil menunjukkan efek lebih besar—bisa karena bias publikasi, kualitas rendah, atau heterogenitas.', 'Bias'],
  'Baujat': ['Baujat plot', 'Sumbu X: kontribusi studi terhadap heterogenitas; sumbu Y: pengaruhnya terhadap hasil gabungan. Studi di kanan-atas patut ditelaah.', 'Grafik'],
  'Galbraith': ['Galbraith (radial) plot', 'Efek terstandar vs presisi. Studi di luar pita ±2 berkontribusi besar terhadap heterogenitas.', 'Grafik'],
  'Leave-one-out': ['Leave-one-out', 'Menghitung ulang meta-analisis berulang kali dengan mengeluarkan satu studi tiap kali, untuk menilai kestabilan hasil.', 'Sensitivitas'],
  'rstudent': ['Studentized residual', 'Seberapa jauh suatu studi dari efek gabungan yang dihitung tanpa studi itu. |nilai| > 1,96 → studi berpotensi outlier.', 'Sensitivitas'],
  'Meta-Regression': ['Meta-regresi', 'Regresi efek studi terhadap karakteristik studi (moderator) untuk menjelaskan heterogenitas. Bersifat observasional; butuh ±10 studi per moderator.', 'Model'],
  'Moderator': ['Moderator', 'Karakteristik level-studi (mis. tahun, dosis, latitude) yang diuji pengaruhnya terhadap besar efek.', 'Model'],
  'QM': ['Test of moderators (QM)', 'Uji apakah moderator secara bersama menjelaskan variasi efek.', 'Model'],
  'QE': ['Residual heterogeneity (QE)', 'Heterogenitas yang tersisa setelah memperhitungkan moderator.', 'Model'],
  'R²': ['R² (meta-regresi)', 'Persentase τ² yang dijelaskan oleh moderator.', 'Model'],
  'Subgroup': ['Analisis subgrup', 'Meta-analisis terpisah per kelompok (kolom Group) dan uji perbedaan antarsubgrup. Eksploratif; rawan temuan kebetulan.', 'Model'],
  'Cumulative': ['Cumulative meta-analysis', 'Efek gabungan dihitung ulang setiap kali satu studi (urut tahun) ditambahkan — memperlihatkan kapan bukti menjadi stabil.', 'Grafik'],
  "L'Abbé": ["L'Abbé plot", 'Risiko kelompok intervensi vs kontrol per studi; titik di bawah diagonal = intervensi menurunkan risiko.', 'Grafik'],
  'RoB': ['Risk of Bias', 'Penilaian risiko bias metodologis tiap studi (RoB 2 untuk RCT, ROBINS-I untuk non-randomized): Low / Some concerns / High.', 'Kualitas'],
  'GRADE': ['GRADE', 'Kerangka menilai kepastian bukti (tinggi/sedang/rendah/sangat rendah) berdasarkan risiko bias, inkonsistensi, ketidaklangsungan, imprecision, dan bias publikasi.', 'Kualitas'],
  'PRISMA': ['PRISMA 2020', 'Pedoman pelaporan systematic review, termasuk diagram alur seleksi studi.', 'Pelaporan'],
  'NNT': ['Number Needed to Treat', 'Jumlah orang yang perlu mendapat intervensi agar 1 kejadian buruk tercegah = 1/ARR.', 'Effect size'],
  'NNH': ['Number Needed to Harm', 'Jumlah orang yang mendapat intervensi hingga 1 tambahan kejadian buruk muncul.', 'Effect size'],
  'ARR': ['Absolute Risk Reduction', 'Risiko kontrol − risiko intervensi (dalam poin persen).', 'Effect size'],
  'OCR': ['Optical Character Recognition', 'Pengenalan teks dari gambar halaman (PDF hasil scan). Akurasi bergantung kualitas scan—periksa angka secara cermat.', 'Ekstraksi'],
  'DOI': ['Digital Object Identifier', 'Kode unik permanen artikel (mis. 10.1001/jama.1994…). Dipakai untuk melengkapi metadata via Crossref.', 'Ekstraksi'],
  'Crossref': ['Crossref', 'Registri DOI publik. Aplikasi hanya mengirim DOI untuk mengambil judul, penulis, jurnal, dan tahun.', 'Ekstraksi'],
  'SE': ['Standard Error', 'Ketidakpastian suatu estimasi; makin kecil makin presisi. 95% CI ≈ estimasi ± 1,96 × SE.', 'Statistik'],
  'SD': ['Standard Deviation', 'Sebaran data individu dalam satu kelompok. SE = SD/√n.', 'Statistik'],
  'IQR': ['Interquartile Range', 'Rentang Q1–Q3 (50% data tengah). Dapat dikonversi ke perkiraan SD di Kalkulator Konversi.', 'Statistik'],
  'yi': ['yi', 'Effect size tiap studi pada skala analisis (mis. ln RR).', 'Statistik'],
  'vi': ['vi', 'Varians sampling effect size tiap studi (SE²).', 'Statistik'],
  'Weight': ['Bobot studi', 'Persentase kontribusi studi terhadap efek gabungan (inverse-variance).', 'Model'],
  'Continuity correction': ['Continuity correction', 'Penambahan 0,5 pada semua sel tabel 2×2 bila ada sel bernilai nol agar log RR/OR dapat dihitung.', 'Statistik'],
  'Verified': ['Verified', 'Tanda bahwa angka telah dicek manual terhadap PDF sumber (idealnya oleh dua reviewer).', 'Kualitas'],
  'Provenance': ['Provenance (jejak sumber)', 'Catatan asal setiap angka: file, halaman, dan kutipan — syarat transparansi systematic review.', 'Kualitas']
};
const ALIASES = { 'I2': 'I²', 'tau²': 'τ²', 'τ² / Q': 'τ²', 'Heterogeneity & inferensi': 'Heterogeneity', 'Forest plot': 'Forest Plot', 'Funnel Plot': 'Funnel plot', 'Common-effect': 'Common effect', 'KH': 'Knapp–Hartung', 'Meta-regression': 'Meta-Regression', 'Leave-one-out analysis': 'Leave-one-out', 'Subgroup analysis': 'Subgroup', 'Cumulative meta-analysis': 'Cumulative', 'p-value pooled': 'p-value', 'Estimator τ²': 'τ²', 'Inferensi': 'Knapp–Hartung', 'Bobot': 'Weight', 'Risk-of-bias': 'RoB', 'Risk of Bias': 'RoB', 'Prediction interval (Higgins, t k−2)': 'PI', 'Egger regression': 'Egger', 'Begg rank correlation': 'Begg', 'Trim-and-fill (L0)': 'Trim-and-fill', 'Baujat plot': 'Baujat', 'Galbraith (radial) plot': 'Galbraith', 'Influence diagnostics': 'rstudent', 'Effect measure': 'SMD', 'Moderator': 'Moderator', 'Level CI': 'CI' };
const keys = [...new Set([...Object.keys(TERMS), ...Object.keys(ALIASES)])].sort((a, b) => b.length - a.length);
const RX = new RegExp('(?<![\\p{L}\\p{N}])(' + keys.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?![\\p{L}\\p{N}])', 'u');
const resolve = k => TERMS[k] ? k : ALIASES[k] && TERMS[ALIASES[k]] ? ALIASES[k] : null;
const SEL = '.panel h3, .panel > h4, .capture-card h4, .calc-card h3, th, .stat small, .analysis-controls label > span, .study-settings label > span, .check';

function decorate(root) { if (!root) return; root.querySelectorAll(SEL).forEach(el => { if (el.dataset.gl) return; el.dataset.gl = '1'; const own = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ') || el.textContent; const m = own.match(RX); const key = m && resolve(m[1]); if (!key) return;
  const b = document.createElement('button'); b.type = 'button'; b.className = 'gl-tip'; b.dataset.term = key; b.setAttribute('aria-label', 'Penjelasan ' + key); b.textContent = '?'; el.append(b); }); }

let pop = null;
function show(btn) { const t = TERMS[btn.dataset.term]; if (!t) return; if (!pop) { pop = document.createElement('div'); pop.id = 'glPop'; pop.setAttribute('role', 'dialog'); document.body.append(pop); }
  pop.innerHTML = `<button class="gl-close" aria-label="Tutup">✕</button><span class="gl-cat">${esc(t[2])}</span><strong>${esc(btn.dataset.term)} — ${esc(t[0])}</strong><p>${esc(t[1])}</p><button class="gl-more" data-glossary="${esc(btn.dataset.term)}">Buka glosarium lengkap →</button>`;
  pop.hidden = false; const r = btn.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 24); pop.style.width = w + 'px'; let left = r.left + window.scrollX - 20; left = Math.max(12, Math.min(left, window.scrollX + window.innerWidth - w - 12)); pop.style.left = left + 'px'; pop.style.top = (r.bottom + window.scrollY + 8) + 'px'; }
const hide = () => { if (pop) pop.hidden = true; };
document.addEventListener('click', e => { const b = e.target.closest('.gl-tip'); if (b) { e.preventDefault(); e.stopPropagation(); show(b); return; } if (e.target.closest('.gl-close')) return hide(); const more = e.target.closest('[data-glossary]'); if (more) { hide(); window.dispatchEvent(new CustomEvent('up-open-glossary', { detail: more.dataset.glossary })); return; } if (pop && !pop.hidden && !e.target.closest('#glPop')) hide(); }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });

/* ---------- usage guide ---------- */
const GUIDE = {
  dashboard: { t: 'Dashboard', s: ['Lihat ringkasan: jumlah studi, partisipan, pooled effect, dan I².', 'Kotak "Kesimpulan otomatis" merangkum hasil analisis terkini.', 'Klik "Coba dataset BCG" untuk belajar dengan data publik (13 RCT vaksin BCG).'] },
  extraction: { t: 'Paper Extraction', s: ['Tarik/pilih file PDF (bisa beberapa sekaligus), atau tempel teks abstrak.', 'Biarkan "OCR otomatis" aktif untuk PDF hasil scan; pilih bahasa OCR.', 'Klik paper di Koleksi untuk melihat metadata, bagian artikel, research gap, dan jumlah statistik terdeteksi.', 'Klik "Crossref" untuk melengkapi judul/penulis/jurnal dari DOI.', 'Lanjutkan ke "Telusuri halaman, tabel & statistik".'], tip: 'Jika teks kosong/berantakan: aktifkan OCR, atau gunakan backend Python untuk tabel rumit.' },
  evidence: { t: 'Evidence Explorer', s: ['Pilih paper dan halaman; bandingkan "Gambar PDF" dengan "Teks".', 'Di "Statistik terstruktur", klik → T / → C / → Rasio untuk mengisi form transfer otomatis.', 'Periksa angka pada gambar halaman, isi nama studi, lalu klik tombol "+ Transfer".', 'Gunakan pencarian (mis. "mortality", "95% CI") untuk menemukan angka di seluruh dokumen.'], tip: 'Satu proyek = satu outcome & satu effect measure. Jangan campur HR dengan OR/RR.' },
  studies: { t: 'Study Data', s: ['Pilih effect measure yang sesuai dengan data (RR/OR/RD untuk 2×2, MD/SMD untuk mean ± SD, dst.).', 'Isi atau koreksi angka; kolom paling kanan menampilkan effect + CI tiap studi.', 'Isi Group (subgrup), Mod (moderator numerik), dan RoB.', 'Centang Verified setelah angka dicek terhadap PDF.', 'Import CSV/Excel (koma, titik-koma, tab) atau Backup/Restore JSON.'] },
  analysis: { t: 'Meta-Analysis', s: ['Pilih estimator τ² (REML dianjurkan) dan inferensi (Knapp–Hartung bila studi sedikit).', 'Baca kartu "Interpretasi & Kesimpulan": besar efek, signifikansi, heterogenitas, robustnes, dan kepastian bukti.', 'Periksa forest plot, tabel heterogeneity, subgrup, dan cumulative.', 'Unduh Laporan HTML atau forest PNG 300 dpi untuk naskah.'] },
  diagnostics: { t: 'Bias & Sensitivity', s: ['Lihat funnel plot (aktifkan contour dan trim-and-fill).', 'Baca uji Egger/Begg—hanya bermakna bila k ≥ 10.', 'Gunakan Baujat, Galbraith, leave-one-out, dan rstudent untuk menemukan studi berpengaruh/outlier.'] },
  metareg: { t: 'Meta-Regression', s: ['Pilih moderator: Tahun, kolom Mod, atau Group.', 'Baca koefisien (b), p-value, R², dan interpretasi otomatis.', 'Bubble plot: ukuran lingkaran = bobot studi.'], tip: 'Meta-regresi bersifat observasional; hindari menguji banyak moderator pada sedikit studi.' },
  calculator: { t: 'Kalkulator Konversi', s: ['Pilih kartu sesuai statistik yang dilaporkan paper (median/IQR, SE, CI, p-value, dll.).', 'Isi angka; hasil muncul otomatis.', 'Klik "→ Isi arm" untuk mengirim hasil ke form transfer di Evidence Explorer.'], tip: 'Catat metode konversi pada kolom kutipan studi.' },
  code: { t: 'R · Stata · Python', s: ['Pilih tab R, Stata, Python, Data CSV, atau Teks Metode.', 'Salin atau unduh skrip, lalu jalankan di RStudio / Stata 16+ / Python.', 'Opsional: jalankan backend lokal dan klik "Bandingkan dengan R metafor".'] },
  prisma: { t: 'PRISMA 2020', s: ['Isi jumlah record pada setiap tahap seleksi dari log pencarian Anda.', 'Periksa peringatan konsistensi, lalu unduh diagram SVG.'] },
  simulation: { t: 'Simulation', s: ['Ubah events dan total tiap kelompok atau geser slider.', 'Amati perubahan RR, OR, ARR, dan NNT/NNH.'] },
  help: { t: 'Panduan & Glosarium', s: ['Ikuti Mulai cepat, buka panduan per halaman, atau cari istilah di glosarium.', 'Tombol "?" kecil di samping judul/kolom menampilkan penjelasan istilah.'] }
};
const QUICK = ['Unggah PDF di <b>Paper Extraction</b> (atau muat dataset BCG untuk latihan).', 'Buka <b>Evidence Explorer</b>, klik statistik yang relevan, cek gambar halaman, lalu <b>+ Transfer</b>.', 'Di <b>Study Data</b>, lengkapi angka, Group, RoB, dan centang <b>Verified</b>.', 'Baca <b>Meta-Analysis</b>: forest plot + kartu Interpretasi & Kesimpulan.', 'Cek <b>Bias & Sensitivity</b> dan, bila perlu, <b>Meta-Regression</b>.', 'Ekspor Laporan HTML dan skrip <b>R/Stata/Python</b>; simpan Backup JSON.'];
const FAQ = [['Apakah PDF saya diunggah ke internet?', 'Tidak. PDF diproses di browser. Yang dikirim hanya DOI ke Crossref (bisa dimatikan) dan—bila Anda menekan tombolnya—data ke backend lokal milik Anda.'], ['Kenapa angka ekstraksi harus diverifikasi?', 'Tabel PDF sering bergeser kolom, OCR bisa salah baca, dan satu paper bisa melaporkan banyak outcome/timepoint. Aplikasi menandai semua angka sebagai kandidat.'], ['Model apa yang sebaiknya dipakai?', 'Umumnya random-effects REML (atau PM) dengan Knapp–Hartung bila studi < 10–20. Common-effect hanya bila studi sangat homogen dan sebanding.'], ['Bagaimana memulai proyek baru?', 'Klik Backup JSON untuk mengarsipkan, lalu tombol ↺ Reset di bagian atas.'], ['Hasil berbeda dengan RevMan?', 'RevMan klasik memakai DL dan Mantel–Haenszel untuk data biner. Samakan estimator (pilih DL) untuk pembanding; aplikasi ini identik dengan metafor (inverse-variance).']];

function guideHtml(page) { const g = GUIDE[page] || GUIDE.dashboard; return `<h3>${esc(g.t)}</h3><ol class="guide-steps">${g.s.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${g.tip ? `<div class="notice subtle">💡 ${esc(g.tip)}</div>` : ''}`; }
function renderHelpPage(container, query = '') { const q = query.trim().toLowerCase(), cats = {};
  Object.entries(TERMS).forEach(([k, [n, d, c]]) => { if (q && !(k + n + d).toLowerCase().includes(q)) return; (cats[c] = cats[c] || []).push([k, n, d]); });
  container.querySelector('#helpQuick').innerHTML = QUICK.map(x => `<li>${x}</li>`).join('');
  container.querySelector('#helpPages').innerHTML = Object.entries(GUIDE).filter(([k]) => k !== 'help').map(([k, g]) => `<details class="guide-item"><summary>${esc(g.t)}</summary><ol class="guide-steps">${g.s.map(x => `<li>${esc(x)}</li>`).join('')}</ol>${g.tip ? `<p class="smallprint">💡 ${esc(g.tip)}</p>` : ''}<button class="text-btn" data-go-help="${k}">Buka halaman →</button></details>`).join('');
  container.querySelector('#helpGlossary').innerHTML = Object.keys(cats).length ? Object.entries(cats).map(([c, list]) => `<h4>${esc(c)}</h4><dl class="gl-list">${list.map(([k, n, d]) => `<div id="term-${esc(k).replace(/[^\w-]/g, '_')}"><dt><b>${esc(k)}</b> <span>${esc(n)}</span></dt><dd>${esc(d)}</dd></div>`).join('')}</dl>`).join('') : '<p class="smallprint">Istilah tidak ditemukan.</p>';
  container.querySelector('#helpFaq').innerHTML = FAQ.map(([a, b]) => `<details class="guide-item"><summary>${esc(a)}</summary><p>${esc(b)}</p></details>`).join(''); }

window.UPHelp = { TERMS, decorate, guideHtml, renderHelpPage, hide };
})();
