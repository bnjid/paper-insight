/* Ultra Paper — article extraction engine v3 (client-side).
 * PDF.js text layer with column-aware reading order, running header/footer removal,
 * font-size title detection, optional in-browser OCR (Tesseract.js), structured statistic parsing,
 * heuristic table reconstruction, and optional Crossref metadata lookup (sends DOI only).
 */
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; root.UPExtract = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
const NUM = '-?\\d+(?:\\.\\d+)?', SEP = '\\s*(?:to|–|—|,|;|-)\\s*';

function normalize(s) { return String(s || '')
  .replace(/\u00a0/g, ' ').replace(/[\u2212\u2010\u2011]/g, '-').replace(/\uFB01/g, 'fi').replace(/\uFB02/g, 'fl').replace(/\uFB00/g, 'ff').replace(/\uFB03/g, 'ffi')
  .replace(/(\d)\s?[·•∙]\s?(\d)/g, '$1.$2')            // Lancet decimal point 0·74
  .replace(/([a-z])-\n([a-z])/g, '$1$2')                // hyphenation across lines
  .replace(/[ \t]{2,}/g, ' '); }

/* ---------- PDF page reconstruction ---------- */
function reconstructPage(content, pageNumber, pageWidth) {
  const items = (content.items || []).filter(it => typeof it.str === 'string' && it.str.trim()).map(it => ({ t: it.str, x: +it.transform[4] || 0, y: +it.transform[5] || 0, w: +it.width || 0, h: Math.abs(+it.height || +it.transform[3] || 0) }));
  const groupLines = arr => { const sorted = [...arr].sort((a, b) => b.y - a.y || a.x - b.x), lines = []; for (const it of sorted) { const tol = Math.max(2.5, it.h * .45); let ln = lines.find(l => Math.abs(l.y - it.y) < tol); if (!ln) { ln = { y: it.y, parts: [], size: 0 }; lines.push(ln); } ln.parts.push(it); ln.size = Math.max(ln.size, it.h); } lines.sort((a, b) => b.y - a.y); lines.forEach(l => l.parts.sort((a, b) => a.x - b.x)); return lines; };
  const lineText = l => { let s = '', prev = null; for (const p of l.parts) { if (prev) { const gap = p.x - (prev.x + prev.w); s += gap > Math.max(6, prev.h * 1.2) ? '   ' : (gap > prev.h * .12 || /\s$/.test(prev.t) ? ' ' : ''); } s += p.t.trim(); prev = p; } return s.trim(); };
  // two-column detection: few items cross the vertical gutter and both halves are populated
  const mid = pageWidth / 2, crossing = items.filter(it => it.x < mid - 8 && it.x + it.w > mid + 8 && it.t.trim().length > 3).length, left = items.filter(it => it.x + it.w <= mid + 8), right = items.filter(it => it.x >= mid - 8);
  const twoCol = items.length > 40 && crossing / items.length < .07 && left.length > items.length * .25 && right.length > items.length * .25;
  let lines; if (twoCol) { const L = groupLines(left), R = groupLines(right.filter(it => !left.includes(it))); lines = [...L, ...R]; } else lines = groupLines(items);
  const text = lines.map(l => ({ text: lineText(l), size: l.size, y: l.y }));
  // heuristic tables (full width, aligned multi-cell lines)
  const tables = [], full = groupLines(items); let run = [];
  const flush = () => { if (run.length >= 3) { const numeric = run.flat().filter(c => /\d/.test(c)).length / run.flat().length; if (numeric > .3) tables.push({ page: pageNumber, index: tables.length + 1, method: 'browser spatial heuristic', rows: run.slice(0, 80).map(r => r.slice(0, 16)) }); } run = []; };
  for (const l of full) { const cells = []; let cell = '', last = null; for (const it of l.parts) { if (last && it.x - (last.x + last.w) > Math.max(10, last.h * 1.1)) { if (cell.trim()) cells.push(cell.trim()); cell = ''; } else if (last) cell += ' '; cell += it.t.trim(); last = it; } if (cell.trim()) cells.push(cell.trim()); if (cells.length >= 3) run.push(cells); else flush(); }
  flush();
  return { page: pageNumber, lines: text, text: normalize(text.map(l => l.text).join('\n')), tables: tables.slice(0, 10), twoColumn: twoCol }; }

function stripRunningHeaders(pages) { if (pages.length < 4) return pages; const key = s => s.replace(/\d+/g, '#').trim().toLowerCase(), count = new Map();
  pages.forEach(p => { const ls = p.text.split('\n'), edge = new Set([...ls.slice(0, 3), ...ls.slice(-3)].map(key).filter(k => k.length > 3)); edge.forEach(k => count.set(k, (count.get(k) || 0) + 1)); });
  const drop = new Set([...count].filter(([, c]) => c >= pages.length * .5).map(([k]) => k));
  return pages.map(p => { const ls = p.text.split('\n'); return { ...p, text: ls.filter((l, i) => !((i < 3 || i >= ls.length - 3) && drop.has(key(l)))).join('\n') }; }); }

/* ---------- structured statistics ---------- */
const excerpt = (t, i, len) => t.slice(Math.max(0, i - 90), Math.min(t.length, i + len + 110)).replace(/\s+/g, ' ').trim();
function parseStatistics(pages) { const out = [], seen = new Set();
  const push = (o, text, idx, len) => { const key = o.type + '|' + o.page + '|' + o.raw; if (seen.has(key)) return; seen.add(key); out.push({ ...o, excerpt: excerpt(text, idx, len) }); };
  const RATIO = new RegExp('\\b(a?HRs?|a?ORs?|a?RRs?|IRR|PR|sHR|hazard ratio|odds ratio|risk ratio|relative risk|rate ratio|prevalence ratio)\\b[^0-9\\n]{0,30}?(\\d+(?:\\.\\d+)?)\\s*[\\(\\[,;]?\\s*(?:(\\d{2}(?:\\.\\d)?)\\s*%\\s*(?:CI|confidence interval|CrI)\\s*[:=,]?\\s*)?(\\d+(?:\\.\\d+)?)' + SEP + '(\\d+(?:\\.\\d+)?)', 'gi');
  const DIFF = new RegExp("\\b(SMD|WMD|MD|mean difference|standardi[sz]ed mean difference|difference|Hedges'? ?g|Cohen'?s d|β|beta|coefficient)\\b[^0-9\\n-]{0,30}?(" + NUM + ')\\s*[\\(\\[,;]?\\s*(?:(\\d{2})\\s*%\\s*(?:CI|confidence interval)\\s*[:=,]?\\s*)(' + NUM + ')' + SEP + '(' + NUM + ')', 'gi');
  const EVENTS = /\b(\d{1,6})\s*\/\s*(\d{1,7})\b(?:\s*\(\s*(\d+(?:\.\d+)?)\s*%\s*\))?/g;
  const MSD = new RegExp('(' + NUM + ')\\s*(?:±|\\+\\/-|\\+-)\\s*(\\d+(?:\\.\\d+)?)', 'g'), MSD2 = new RegExp('(' + NUM + ')\\s*\\(\\s*SD\\s*[:=]?\\s*(\\d+(?:\\.\\d+)?)\\s*\\)', 'gi');
  const MED = new RegExp('(?:median|IQR)[^.\\n]{0,40}?(' + NUM + ')\\s*[\\(\\[]\\s*(?:IQR\\s*[:,]?\\s*)?(' + NUM + ')' + SEP + '(' + NUM + ')\\s*[\\)\\]]', 'gi');
  const PVAL = /\b[pP]\s*(?:-?value)?\s*([<>=≤≥])\s*(0?\.\d+|1(?:\.0+)?|\d(?:\.\d+)?\s*[x×]\s*10\s*-\s*\d+)/g;
  const NEQ = /\b[nN]\s*=\s*(\d{1,3}(?:,\d{3})+|\d+)\b/g, I2 = /I\s*(?:2|²|\^2)\s*[=:]\s*(\d+(?:\.\d+)?)\s*%/g;
  for (const pg of pages) { const t = String(pg.text || ''), page = pg.page; let m;
    RATIO.lastIndex = 0; while ((m = RATIO.exec(t))) { const est = +m[2], lo = +m[4], hi = +m[5]; if (lo > 0 && lo <= est && est <= hi && hi < 1000) push({ type: 'ratio', page, measure: m[1].replace(/s$/, ''), est, lower: lo, upper: hi, level: +(m[3] || 95), raw: m[0], confidence: m[3] ? 'tinggi' : 'sedang' }, t, m.index, m[0].length); }
    DIFF.lastIndex = 0; while ((m = DIFF.exec(t))) { const est = +m[2], lo = +m[4], hi = +m[5]; if (lo <= est && est <= hi) push({ type: 'diff', page, measure: m[1], est, lower: lo, upper: hi, level: +(m[3] || 95), raw: m[0], confidence: 'sedang' }, t, m.index, m[0].length); }
    EVENTS.lastIndex = 0; while ((m = EVENTS.exec(t))) { const a = +m[1], n = +m[2], pct = m[3] ? +m[3] : null; if (!(n > 0) || a > n) continue; if (n >= 1900 && n <= 2100 && a <= 31) continue; const consistent = pct !== null && Math.abs(a / n * 100 - pct) < .6; if (pct !== null && !consistent) continue; push({ type: 'events', page, events: a, total: n, pct, raw: m[0], confidence: consistent ? 'tinggi' : 'rendah' }, t, m.index, m[0].length); }
    for (const re of [MSD, MSD2]) { re.lastIndex = 0; while ((m = re.exec(t))) push({ type: 'meansd', page, mean: +m[1], sd: +m[2], raw: m[0], confidence: re === MSD2 ? 'tinggi' : 'sedang' }, t, m.index, m[0].length); }
    MED.lastIndex = 0; while ((m = MED.exec(t))) { const md = +m[1], q1 = +m[2], q3 = +m[3]; if (q1 <= md && md <= q3) push({ type: 'median', page, median: md, q1, q3, raw: m[0], confidence: 'sedang' }, t, m.index, m[0].length); }
    PVAL.lastIndex = 0; while ((m = PVAL.exec(t))) push({ type: 'p', page, op: m[1], value: m[2], raw: m[0], confidence: 'tinggi' }, t, m.index, m[0].length);
    NEQ.lastIndex = 0; while ((m = NEQ.exec(t))) push({ type: 'n', page, n: +m[1].replace(/,/g, ''), raw: m[0], confidence: 'sedang' }, t, m.index, m[0].length);
    I2.lastIndex = 0; while ((m = I2.exec(t))) push({ type: 'i2', page, value: +m[1], raw: m[0], confidence: 'tinggi' }, t, m.index, m[0].length);
  }
  return out.slice(0, 3000); }

/* ---------- article structure ---------- */
const HEADINGS = [
  ['abstract', 'ABSTRACT|SUMMARY|ABSTRAK'], ['background', 'BACKGROUND|INTRODUCTION|PENDAHULUAN|LATAR BELAKANG'], ['objective', 'OBJECTIVES?|AIMS?|PURPOSE|TUJUAN'],
  ['method', 'MATERIALS? AND METHODS|PATIENTS AND METHODS|SUBJECTS AND METHODS|METHODS?|METHODOLOGY|METODE(?: PENELITIAN)?|BAHAN DAN METODE'],
  ['results', 'RESULTS?|FINDINGS|HASIL(?: PENELITIAN)?'], ['discussion', 'DISCUSSION|PEMBAHASAN'], ['limitations', 'LIMITATIONS?|STRENGTHS AND LIMITATIONS|KETERBATASAN'],
  ['conclusion', 'CONCLUSIONS?|INTERPRETATION|KESIMPULAN|SIMPULAN'], ['references', 'REFERENCES|BIBLIOGRAPHY|DAFTAR PUSTAKA']];
function sections(raw) { const hits = [];
  for (const [key, words] of HEADINGS) { const re = new RegExp('(?:^|\\n)\\s*(?:\\d+(?:\\.\\d+)*\\.?\\s*)?(?:' + words + ')\\s*(?::|\\.|\\n)', 'gi'); let m; while ((m = re.exec(raw))) { hits.push({ key, at: m.index, start: m.index + m[0].length }); if (key !== 'abstract') break; } }
  hits.sort((a, b) => a.at - b.at); const seg = {};
  hits.forEach((h, i) => { if (seg[h.key]) return; const next = hits.slice(i + 1).find(x => x.at > h.start + 40); seg[h.key] = raw.slice(h.start, next ? next.at : h.start + 8000).trim().slice(0, 8000); });
  delete seg.references; return seg; }
const DESIGNS = [['Systematic review / meta-analysis', /systematic review|meta-analys[ie]s/i], ['Randomized controlled trial', /randomi[sz]ed (?:controlled |clinical )?trial|\bRCT\b/i], ['Cluster RCT', /cluster[- ]randomi[sz]ed/i], ['Crossover trial', /cross-?over (?:trial|design)/i], ['Prospective cohort', /prospective cohort/i], ['Retrospective cohort', /retrospective cohort/i], ['Cohort study', /cohort study/i], ['Case-control', /case[- ]control/i], ['Cross-sectional', /cross[- ]sectional|potong lintang/i], ['Quasi-experimental', /quasi[- ]experiment/i], ['Diagnostic accuracy', /sensitivity and specificity|diagnostic accuracy/i], ['Qualitative', /qualitative (?:study|research)|thematic analysis/i]];
function describe(raw, pages, meta) { const head = raw.slice(0, 12000), seg = sections(raw);
  let title = '', authors = '';
  const p1 = pages[0]?.lines || []; if (p1.length) { const top = p1.slice(0, 45).filter(l => l.text.length > 8 && !/^(original|research|article|journal|vol\.|volume|doi|http|www\.|received|accepted|copyright|©|open access)/i.test(l.text)); const max = Math.max(...top.map(l => l.size), 0);
    if (max > 0) { const idx = p1.findIndex(l => top.includes(l) && l.size >= max * .92); if (idx >= 0) { const tl = []; for (let i = idx; i < Math.min(p1.length, idx + 5) && p1[i].size >= max * .85; i++) tl.push(p1[i].text); title = tl.join(' ').replace(/\s+/g, ' ').trim(); const nx = p1.slice(idx + tl.length, idx + tl.length + 4).map(l => l.text).find(t => /[A-Z][a-z]+.*(,| and | dan )/.test(t) && !/\d{4}/.test(t) && t.length < 400); if (nx) authors = nx.replace(/[*†‡§¶\d]+(?=,|\s|$)/g, '').trim(); } } }
  if (!title || title.length < 12) title = meta?.info?.Title || head.split('\n').map(x => x.trim()).filter(x => x.length > 20 && x.length < 250 && !/^(abstract|introduction|doi|http|copyright|received)/i.test(x)).sort((a, b) => b.length - a.length)[0] || 'Untitled paper';
  const doi = ((raw.match(/\b10\.\d{4,9}\/[^\s"<>]+/i) || [])[0] || '').replace(/[.,;)\]]+$/, '');
  const year = (head.match(/(?:©|copyright|published|accepted|received)[^\n]{0,40}?\b((?:19|20)\d{2})\b/i) || head.match(/\b((?:19|20)\d{2})\b/) || [])[1] || '';
  const designs = DESIGNS.filter(([, re]) => re.test(seg.abstract || seg.method || head) || re.test(head)).map(([l]) => l).slice(0, 3);
  const sample = (raw.match(/(?:randomi[sz]ed|enrolled|included|recruited|analy[sz]ed|comprised|total of)\s+(\d{1,3}(?:,\d{3})+|\d+)\s+(?:eligible\s+)?(?:patients|participants|subjects|children|adults|women|men|individuals|infants|students|respondents|responden|pasien)/i) || [])[1] || '';
  const follow = (raw.match(/follow(?:ed)?[- ]up\s+(?:of|for|period of|duration of)?\s*(?:a\s+)?(?:median\s+(?:of\s+)?)?(\d+(?:\.\d+)?)\s*(days?|weeks?|months?|years?)/i) || []).slice(1).join(' ');
  const reg = [...new Set((raw.match(/\b(NCT\d{8}|ISRCTN\d{8}|ChiCTR[-\w]{6,}|ACTRN\d{14}|CTRI\/\d{4}\/\d+\/\d+|CRD\d{11}|DRKS\d{8})\b/g) || []))].slice(0, 5);
  const keywords = ((raw.match(/(?:key\s?words|kata kunci)\s*[:\-—]\s*([^\n]{5,300})/i) || [])[1] || '').trim();
  const funding = ((raw.match(/[^.\n]*(?:funded by|funding|grant (?:no|number)|supported by)[^.\n]*\./i) || [])[0] || '').trim().slice(0, 300);
  const gapSrc = [seg.background, seg.discussion, seg.limitations, seg.conclusion].filter(Boolean).join(' ');
  const gap = [...new Set((gapSrc.match(/[^.!?\n]*(?:further (?:studies|research)|limited (?:evidence|data)|remains? (?:unknown|unclear)|research gap|scarce|not well (?:understood|established)|future (?:research|studies)|little is known|few studies|lack of|penelitian lebih lanjut|belum diketahui|masih terbatas)[^.!?\n]*[.!?]?/gi) || []).map(s => s.trim()))].slice(0, 8);
  return { title: title.slice(0, 400), authors: authors.slice(0, 500), doi, year, segments: seg, designs, sampleSize: sample, followUp: follow, registrations: reg, keywords, funding, gap }; }

/* ---------- OCR (Tesseract.js, lazy) ---------- */
let tessPromise = null, worker = null;
function loadScript(src) { return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error('Gagal memuat ' + src)); document.head.append(s); }); }
async function ocrCanvas(canvas, lang, onProgress) { if (!window.Tesseract) { tessPromise = tessPromise || loadScript(TESSERACT_SRC); await tessPromise; }
  if (!worker) worker = await window.Tesseract.createWorker(lang || 'eng+ind', 1, { logger: m => m.status === 'recognizing text' && onProgress && onProgress(m.progress) });
  const { data } = await worker.recognize(canvas); return { text: normalize(data.text || ''), confidence: data.confidence }; }
async function endOcr() { if (worker) { await worker.terminate(); worker = null; } }
async function renderPage(doc, pageNo, canvas, scale = 1.6) { const page = await doc.getPage(pageNo), vp = page.getViewport({ scale }); canvas.width = Math.floor(vp.width); canvas.height = Math.floor(vp.height); await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise; return canvas; }

/* ---------- main PDF pipeline ---------- */
async function extractPdf(file, opt = {}) { const lib = window.pdfjsLib; if (!lib) throw new Error('PDF.js tidak termuat (periksa koneksi internet).'); lib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  const say = opt.onProgress || (() => {}), doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false }).promise;
  let meta = null; try { meta = await doc.getMetadata(); } catch (e) { }
  const limit = Math.min(doc.numPages, opt.maxPages || 200); let pages = [], tables = [], ocrPages = [], twoCol = 0;
  for (let i = 1; i <= limit; i++) { const page = await doc.getPage(i), content = await page.getTextContent(), r = reconstructPage(content, i, page.view?.[2] || 595); if (r.twoColumn) twoCol++;
    let text = r.text, engine = 'text-layer';
    if (opt.ocr && text.replace(/\s/g, '').length < 60) { say(`OCR halaman ${i}/${limit}…`); try { const cv = await renderPage(doc, i, document.createElement('canvas'), 2.2), o = await ocrCanvas(cv, opt.lang, p => say(`OCR halaman ${i}: ${Math.round(p * 100)}%`)); text = o.text; engine = 'OCR (' + Math.round(o.confidence) + '%)'; ocrPages.push(i); } catch (e) { say('OCR gagal: ' + e.message); } }
    pages.push({ page: i, text, lines: i === 1 ? r.lines : undefined, engine }); tables.push(...r.tables);
    if (i % 4 === 0) { say(`${file.name}: ${i}/${limit} halaman`); await new Promise(r2 => setTimeout(r2, 0)); } }
  if (opt.ocr) await endOcr();
  pages = stripRunningHeaders(pages); const full = pages.map(p => p.text).join('\n\n');
  if (full.replace(/\s/g, '').length < 150) throw new Error('Text layer kosong/tidak memadai. Aktifkan OCR atau gunakan backend Python.');
  return { doc, pages, tables, ocrPages, twoColumnPages: twoCol, meta, numPages: doc.numPages, truncated: doc.numPages > limit, fulltext: full }; }

async function extractTextFile(file) { let t = await file.text(); if (/\.(x?html?|xml)$/i.test(file.name)) { const d = new DOMParser().parseFromString(t, /xml$/i.test(file.name) ? 'application/xml' : 'text/html'); d.querySelectorAll('script,style').forEach(e => e.remove()); d.querySelectorAll('title,article-title,sec>title,h1,h2,h3,p,div,tr,li,abstract').forEach(e => e.append('\n')); t = d.documentElement.textContent; } return normalize(t); }

/* ---------- Crossref (DOI only is transmitted) ---------- */
async function crossref(doi) { const r = await fetch('https://api.crossref.org/works/' + encodeURIComponent(doi), { headers: { Accept: 'application/json' } }); if (!r.ok) throw new Error('Crossref HTTP ' + r.status); const m = (await r.json()).message || {};
  return { title: (m.title || [])[0] || '', authors: (m.author || []).map(a => [a.given, a.family].filter(Boolean).join(' ')).join(', '), journal: (m['container-title'] || [])[0] || '', year: String(m.issued?.['date-parts']?.[0]?.[0] || ''), volume: m.volume || '', issue: m.issue || '', pages: m.page || '', publisher: m.publisher || '', type: m.type || '', url: m.URL || '' }; }

const tableToCsv = t => (t.rows || []).map(r => r.map(c => '"' + String(c ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
return { normalize, reconstructPage, stripRunningHeaders, parseStatistics, sections, describe, extractPdf, extractTextFile, renderPage, crossref, tableToCsv };
});
