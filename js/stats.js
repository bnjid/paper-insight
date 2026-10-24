/* Ultra Paper Evidence Studio — statistical engine v3 (browser + Node).
 * Effect sizes follow metafor::escalc conventions. tau² estimators: FE, DL, HE, SJ, PM, ML, REML.
 * Inference: z, Knapp–Hartung (knha), ad-hoc KH (max(1,q)). Regression-tested against metafor (dat.bcg).
 */
(function (root, factory) { const api = factory(); if (typeof module === 'object' && module.exports) module.exports = api; root.UPStats = api; })(typeof globalThis !== 'undefined' ? globalThis : this, function () {
'use strict';
const sum = a => { let s = 0; for (const x of a) s += x; return s; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- distributions ---------- */
function logGamma(z) { const c = [.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]; if (z < .5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z); z--; let x = c[0]; for (let i = 1; i < c.length; i++) x += c[i] / (z + i); const t = z + 7.5; return .5 * Math.log(2 * Math.PI) + (z + .5) * Math.log(t) - t + Math.log(x); }
function gammaincQ(a, x) { if (a <= 0 || x < 0) return NaN; if (x === 0) return 1; const IT = 500, EPS = 1e-15, FP = 1e-300, gln = logGamma(a);
  if (x < a + 1) { let s = 1 / a, d = s, ap = a; for (let n = 1; n <= IT; n++) { ap++; d *= x / ap; s += d; if (Math.abs(d) < Math.abs(s) * EPS) break; } return clamp(1 - s * Math.exp(-x + a * Math.log(x) - gln), 0, 1); }
  let b = x + 1 - a, c = 1 / FP, d = 1 / b, h = d; for (let i = 1; i <= IT; i++) { const an = -i * (i - a); b += 2; d = an * d + b; if (Math.abs(d) < FP) d = FP; c = b + an / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break; } return clamp(Math.exp(-x + a * Math.log(x) - gln) * h, 0, 1); }
const erfc = x => x >= 0 ? gammaincQ(.5, x * x) : 2 - gammaincQ(.5, x * x);
const pnorm = z => .5 * erfc(-z / Math.SQRT2);
function qnorm(p) { if (p <= 0) return -Infinity; if (p >= 1) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00], b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01], c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00], d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  let q, r, x; if (p < .02425) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p <= 1 - .02425) { q = p - .5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  else { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const e = pnorm(x) - p, u = e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2); return x - u / (1 + x * u / 2); }
function betacf(a, b, x) { const FP = 1e-300, EPS = 1e-15; let qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap; if (Math.abs(d) < FP) d = FP; d = 1 / d; let h = d;
  for (let m = 1; m <= 500; m++) { const m2 = 2 * m; let aa = m * (b - m) * x / ((qam + m2) * (a + m2)); d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; h *= d * c; aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2)); d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < EPS) break; } return h; }
function ibeta(x, a, b) { if (x <= 0) return 0; if (x >= 1) return 1; const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log1p(-x)); return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b; }
/** two-sided p-value of t with df */
const pt2 = (t, df) => !Number.isFinite(t) || !(df > 0) ? NaN : ibeta(df / (df + t * t), df / 2, .5);
/** critical t such that two-sided tail = alpha */
function qt(alpha, df) { if (!(df > 0)) return NaN; if (df > 1e7) return qnorm(1 - alpha / 2); let lo = 0, hi = 1e4; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (pt2(m, df) > alpha) lo = m; else hi = m; if (hi - lo < 1e-12) break; } return (lo + hi) / 2; }
const pchisqU = (x, df) => x <= 0 ? 1 : gammaincQ(df / 2, x / 2);
/** lower-tail chi-square quantile */
function qchisq(p, df) { let lo = 0, hi = Math.max(10, df * 4); while (1 - pchisqU(hi, df) < p && hi < 1e8) hi *= 2; for (let i = 0; i < 250; i++) { const m = (lo + hi) / 2; if (1 - pchisqU(m, df) < p) lo = m; else hi = m; if (hi - lo < 1e-13 * Math.max(1, hi)) break; } return (lo + hi) / 2; }
const pF = (F, d1, d2) => F <= 0 ? 1 : ibeta(d2 / (d2 + d1 * F), d2 / 2, d1 / 2);

/* ---------- parsing ---------- */
function num(x) { if (typeof x === 'number') return x; let s = String(x ?? '').trim().replace(/[\u2212\u2012\u2013]/g, '-').replace(/\s+/g, ''); if (!s) return NaN; if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, ''); else s = s.replace(',', '.'); return /^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s) ? Number(s) : NaN; }

/* ---------- effect sizes ---------- */
const BIN = ['a', 'b', 'c', 'd'], CONT = ['mean1', 'sd1', 'n1', 'mean0', 'sd0', 'n0'];
const METRICS = {
  RR: { label: 'Risk Ratio (RR)', kind: 'bin', scale: 'log', fields: BIN },
  OR: { label: 'Odds Ratio (OR)', kind: 'bin', scale: 'log', fields: BIN },
  RD: { label: 'Risk Difference (RD)', kind: 'bin', scale: 'identity', fields: BIN },
  MD: { label: 'Mean Difference (MD)', kind: 'cont', scale: 'identity', fields: CONT },
  SMD: { label: "Standardized Mean Difference (Hedges' g)", kind: 'cont', scale: 'identity', fields: CONT },
  GENR: { label: 'Rasio terpublikasi + 95% CI (HR / aOR / aRR)', kind: 'genr', scale: 'log', fields: ['est', 'lower', 'upper'] },
  GEN: { label: 'Generic inverse-variance (yi + SE)', kind: 'gen', scale: 'identity', fields: ['effect', 'se'] },
  PLO: { label: 'Proporsi / prevalensi (logit)', kind: 'prop', scale: 'logit', fields: ['xi', 'ni'] },
  ZCOR: { label: 'Korelasi r (Fisher z)', kind: 'cor', scale: 'fisher', fields: ['ri', 'ni'] }
};
const isRatio = m => METRICS[m]?.scale === 'log';
const back = (m, y) => { const s = METRICS[m]?.scale; return s === 'log' ? Math.exp(y) : s === 'logit' ? 1 / (1 + Math.exp(-y)) : s === 'fisher' ? Math.tanh(y) : y; };
const nullValue = m => m === 'PLO' ? null : 0;
const bad = msg => ({ ok: false, msg });
const isCount = x => Number.isSafeInteger(x) && x >= 0;

function effect(r, metric) { const W = [], f = k => num(r[k]); let y, v, n = NaN, corrected = false;
  switch (METRICS[metric]?.kind) {
    case 'bin': { let a = f('a'), b = f('b'), c = f('c'), d = f('d'); if (![a, b, c, d].every(isCount)) return bad('Isi a, b, c, d sebagai bilangan bulat ≥ 0.'); const n1 = a + b, n0 = c + d; if (!n1 || !n0) return bad('Ukuran kedua arm harus > 0.'); n = n1 + n0;
      if (metric === 'RD') { const p1 = a / n1, p0 = c / n0; y = p1 - p0; v = p1 * (1 - p1) / n1 + p0 * (1 - p0) / n0; if (!(v > 0)) return bad('Varians RD = 0 (proporsi 0/1 di kedua arm).'); }
      else { if (a + c === 0 || b + d === 0) W.push('Double-zero study: hampir tanpa informasi efek relatif; pertimbangkan eksklusi atau Mantel–Haenszel/Peto (R).'); if ([a, b, c, d].some(x => x === 0)) { a += .5; b += .5; c += .5; d += .5; corrected = true; W.push('Continuity correction 0.5 (zero cell).'); }
        if (metric === 'RR') { y = Math.log((a / (a + b)) / (c / (c + d))); v = 1 / a - 1 / (a + b) + 1 / c - 1 / (c + d); } else { y = Math.log(a * d / (b * c)); v = 1 / a + 1 / b + 1 / c + 1 / d; } }
      break; }
    case 'cont': { const m1 = f('mean1'), s1 = f('sd1'), n1 = f('n1'), m0 = f('mean0'), s0 = f('sd0'), n0 = f('n0'); if (![m1, s1, m0, s0].every(Number.isFinite) || !isCount(n1) || !isCount(n0) || n1 < 2 || n0 < 2 || s1 < 0 || s0 < 0) return bad('Isi mean, SD ≥ 0, dan n ≥ 2 untuk kedua arm.'); n = n1 + n0;
      if (metric === 'MD') { y = m1 - m0; v = s1 * s1 / n1 + s0 * s0 / n0; }
      else { const m = n1 + n0 - 2, sp = Math.sqrt(((n1 - 1) * s1 * s1 + (n0 - 1) * s0 * s0) / m); if (!(sp > 0)) return bad('Pooled SD harus > 0.'); const J = Math.exp(logGamma(m / 2) - .5 * Math.log(m / 2) - logGamma((m - 1) / 2)); y = J * (m1 - m0) / sp; v = 1 / n1 + 1 / n0 + y * y / (2 * (n1 + n0)); }
      break; }
    case 'gen': { y = f('effect'); const se = f('se'); if (!Number.isFinite(y) || !(se > 0)) return bad('Isi effect (skala analisis) dan SE > 0.'); v = se * se; break; }
    case 'genr': { const e = f('est'), lo = f('lower'), hi = f('upper'); if (!(e > 0 && lo > 0 && hi > 0) || lo > e || e > hi || lo === hi) return bad('Butuh 0 < lower ≤ estimate ≤ upper (95% CI).'); y = Math.log(e); const half = (Math.log(hi) - Math.log(lo)) / 2, se = half / qnorm(.975); v = se * se; const asym = Math.abs((Math.log(hi) + Math.log(lo)) / 2 - y) / half; if (asym > .15) W.push('CI tidak simetris pada skala log (' + Math.round(asym * 100) + '%): periksa angka/pembulatan atau level CI.'); break; }
    case 'prop': { let x = f('xi'), m = f('ni'); if (!isCount(x) || !isCount(m) || m < 1 || x > m) return bad('Butuh 0 ≤ events ≤ n.'); n = m; if (x === 0 || x === m) { x += .5; m += 1; corrected = true; W.push('Continuity correction 0.5 (proporsi 0 atau 1).'); } y = Math.log(x / (m - x)); v = 1 / x + 1 / (m - x); break; }
    case 'cor': { const r0 = f('ri'), m = f('ni'); if (!(Math.abs(r0) < 1) || !isCount(m) || m < 4) return bad('Butuh −1 < r < 1 dan n ≥ 4.'); n = m; y = Math.atanh(r0); v = 1 / (m - 3); break; }
    default: return bad('Metric tidak dikenal.');
  }
  if (!Number.isFinite(y) || !(v > 0)) return bad('Effect/varians tidak valid.'); return { ok: true, y, v, n, corrected, warn: W }; }

/* ---------- heterogeneity ---------- */
const wmean = (y, w) => { let s = 0, t = 0; for (let i = 0; i < y.length; i++) { s += w[i] * y[i]; t += w[i]; } return s / t; };
function rootDec(f, start) { let lo = 0, hi = Math.max(start, 1e-4), i = 0; while (f(hi) > 0 && i++ < 300) hi *= 2; for (let j = 0; j < 300; j++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; if (hi - lo < 1e-13 * Math.max(1e-6, hi)) break; } return (lo + hi) / 2; }
const genQ = (y, v, t) => { const w = v.map(x => 1 / (x + t)), m = wmean(y, w); return { w, m, Q: sum(y.map((yi, i) => w[i] * (yi - m) ** 2)) }; };
function tau2(y, v, method) { const k = y.length; if (k < 2 || method === 'FE') return 0;
  const w = v.map(x => 1 / x), sw = sum(w), mu = wmean(y, w), Q = sum(y.map((yi, i) => w[i] * (yi - mu) ** 2)), C = sw - sum(w.map(x => x * x)) / sw, dl = Math.max(0, (Q - (k - 1)) / C);
  if (method === 'DL') return dl;
  const yb = sum(y) / k, ss = sum(y.map(x => (x - yb) ** 2));
  if (method === 'HE') return Math.max(0, ss / (k - 1) - sum(v) / k);
  if (method === 'SJ') { let t0 = ss / k; if (!(t0 > 0)) t0 = 1e-4; const g = genQ(y, v, t0); return t0 * g.Q / (k - 1); }
  if (method === 'PM') { const f = t => genQ(y, v, t).Q - (k - 1); return f(0) <= 0 ? 0 : rootDec(f, dl); }
  if (method === 'ML') { const f = t => { const g = genQ(y, v, t); return sum(y.map((yi, i) => g.w[i] ** 2 * (yi - g.m) ** 2)) - sum(g.w); }; return f(0) <= 0 ? 0 : rootDec(f, dl); }
  const f = t => { const g = genQ(y, v, t), S = sum(g.w); return sum(y.map((yi, i) => g.w[i] ** 2 * (yi - g.m) ** 2)) - S + sum(g.w.map(x => x * x)) / S; };
  return f(0) <= 0 ? 0 : rootDec(f, dl); }

/* ---------- pooling ---------- */
function pool(studies, opt = {}) { const method = opt.method || 'REML', test = opt.test || 'z', level = Number(opt.level || 95), alpha = 1 - level / 100;
  const s = studies.filter(x => x && x.ok !== false && Number.isFinite(x.y) && x.v > 0), k = s.length; if (!k) return null;
  const y = s.map(x => x.y), v = s.map(x => x.v), wF = v.map(x => 1 / x), swF = sum(wF), muFE = wmean(y, wF), Q = sum(y.map((yi, i) => wF[i] * (yi - muFE) ** 2)), df = k - 1, Qp = k > 1 ? pchisqU(Q, df) : NaN;
  const re = method !== 'FE' && k > 1, t2 = re ? tau2(y, v, method) : 0, w = v.map(x => 1 / (x + t2)), sw = sum(w), mu = wmean(y, w);
  let se = Math.sqrt(1 / sw), dist = 'z', crit = qnorm(1 - alpha / 2), qScale = NaN;
  if (re && (test === 'knha' || test === 'knha-adhoc')) { qScale = sum(y.map((yi, i) => w[i] * (yi - mu) ** 2)) / (k - 1); se *= Math.sqrt(test === 'knha-adhoc' ? Math.max(1, qScale) : qScale); dist = 't'; crit = qt(alpha, k - 1); }
  const stat = mu / se, p = dist === 't' ? pt2(stat, k - 1) : 2 * pnorm(-Math.abs(stat));
  const s2 = k > 1 ? (k - 1) * swF / (swF * swF - sum(wF.map(x => x * x))) : NaN, I2Q = k > 1 ? (Q > 0 ? Math.max(0, (Q - df) / Q) * 100 : 0) : NaN;
  const I2 = re ? 100 * t2 / (t2 + s2) : I2Q, H2 = re ? (t2 + s2) / s2 : (k > 1 ? Q / df : NaN);
  let tau2CI = null, I2CI = null; if (re) { const Q0 = genQ(y, v, 0).Q, solve = target => Q0 < target ? 0 : rootDec(t => genQ(y, v, t).Q - target, Math.max(t2, .01)); tau2CI = [solve(qchisq(1 - alpha / 2, df)), solve(qchisq(alpha / 2, df))]; I2CI = tau2CI.map(t => 100 * t / (t + s2)); }
  let PI = null, PImeta = null; if (re) { if (k >= 3) { const b = qt(alpha, k - 2) * Math.sqrt(t2 + se * se); PI = [mu - b, mu + b]; } const b2 = (dist === 't' ? qt(alpha, k - 1) : qnorm(1 - alpha / 2)) * Math.sqrt(t2 + se * se); PImeta = [mu - b2, mu + b2]; }
  const n = s.every(x => Number.isFinite(x.n)) ? sum(s.map(x => x.n)) : NaN;
  return { k, studies: s, y, v, mu, se, ci: [mu - crit * se, mu + crit * se], stat, p, dist, crit, qScale, tau2: t2, tau: Math.sqrt(t2), tau2CI, Q, df, Qp, I2, I2Q, I2CI, H2, s2, PI, PImeta, weights: w, wpct: w.map(x => 100 * x / sw), muFE, method: re ? method : 'FE', test: re ? test : 'z', level, n }; }

/* ---------- small-study effects ---------- */
function egger(p) { if (!p || p.k < 3) return null; const xs = p.v.map(v => 1 / Math.sqrt(v)), ys = p.y.map((y, i) => y * xs[i]), k = p.k, mx = sum(xs) / k, my = sum(ys) / k, Sxx = sum(xs.map(x => (x - mx) ** 2)); if (Sxx <= 1e-14) return null;
  const slope = sum(xs.map((x, i) => (x - mx) * (ys[i] - my))) / Sxx, intercept = my - slope * mx, rss = sum(ys.map((y, i) => (y - intercept - slope * xs[i]) ** 2)), se = Math.sqrt(rss / (k - 2) * (1 / k + mx * mx / Sxx)), t = intercept / se; return { intercept, slope, se, t, df: k - 2, p: pt2(t, k - 2) }; }
function begg(p) { if (!p || p.k < 3) return null; const sw = sum(p.v.map(v => 1 / v)), ys = p.y.map((y, i) => (y - p.muFE) / Math.sqrt(Math.max(1e-12, p.v[i] - 1 / sw))); let C = 0, D = 0; for (let i = 0; i < p.k; i++) for (let j = i + 1; j < p.k; j++) { const s = Math.sign(ys[i] - ys[j]) * Math.sign(p.v[i] - p.v[j]); if (s > 0) C++; else if (s < 0) D++; } const k = p.k, tau = (C - D) / (k * (k - 1) / 2), z = (C - D) / Math.sqrt(k * (k - 1) * (2 * k + 5) / 18); return { tau, z, p: 2 * pnorm(-Math.abs(z)) }; }
function trimfill(p, opt) { if (!p || p.k < 3) return null; const eg = egger(p), side = eg && eg.intercept < 0 ? 'right' : 'left', s = side === 'left' ? 1 : -1, k = p.k, ys = p.y.map(x => s * x), idx = [...ys.keys()].sort((a, b) => ys[a] - ys[b]);
  let k0 = 0, prev = -1, mu = 0, it = 0;
  while (k0 !== prev && it++ < 100) { prev = k0; const fit = pool(idx.slice(0, k - k0).map(i => ({ y: ys[i], v: p.v[i] })), opt); mu = fit.mu; const dev = ys.map(x => x - mu), ord = [...dev.keys()].sort((a, b) => Math.abs(dev[a]) - Math.abs(dev[b])), rank = []; ord.forEach((i, r) => rank[i] = r + 1); const Tn = sum(dev.map((d, i) => d > 0 ? rank[i] : 0)); k0 = clamp(Math.round((4 * Tn - k * (k + 1)) / (2 * k - 1)), 0, k - 2); }
  const filled = idx.slice(k - k0).map(i => ({ y: s * (2 * mu - ys[i]), v: p.v[i], src: i }));
  return { k0, side, filled, pool: pool([...p.y.map((y, i) => ({ y, v: p.v[i] })), ...filled], opt) }; }

/* ---------- influence / sensitivity ---------- */
const subset = (p, keep) => p.y.map((y, i) => ({ y, v: p.v[i], n: p.studies[i].n })).filter((_, i) => keep(i));
function leaveOneOut(p, opt) { if (!p || p.k < 2) return []; return p.y.map((y, i) => { const q = pool(subset(p, j => j !== i), opt); return { i, pool: q, rstudent: (y - q.mu) / Math.sqrt(p.v[i] + q.tau2 + q.se * q.se), dTau2: p.tau2 - q.tau2 }; }); }
function baujat(p) { if (!p || p.k < 2) return []; return p.y.map((y, i) => { const q = pool(subset(p, j => j !== i), { method: 'FE' }); return { i, x: (y - p.muFE) ** 2 / p.v[i], y: (p.muFE - q.mu) ** 2 / (q.se * q.se) }; }); }
function cumulative(p, order, opt) { return order.map((_, n) => ({ i: order[n], pool: pool(order.slice(0, n + 1).map(i => ({ y: p.y[i], v: p.v[i] })), opt) })); }
function subgroups(p, labels, opt) { const map = new Map(); p.y.forEach((y, i) => { const g = String(labels[i] ?? '').trim() || '—'; if (!map.has(g)) map.set(g, []); map.get(g).push({ y, v: p.v[i], n: p.studies[i].n }); });
  const groups = [...map].map(([g, st]) => ({ group: g, pool: pool(st, opt) })), dfb = groups.length - 1; let Qb = NaN, pb = NaN;
  if (dfb > 0) { const W = groups.map(g => 1 / g.pool.se ** 2), m = wmean(groups.map(g => g.pool.mu), W); Qb = sum(groups.map((g, i) => W[i] * (g.pool.mu - m) ** 2)); pb = pchisqU(Qb, dfb); } return { groups, Qb, dfb, pb }; }

/* ---------- meta-regression (mixed-effects, REML Fisher scoring / MoM) ---------- */
function inv(M) { const n = M.length, A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => i === j ? 1 : 0)]); for (let c = 0; c < n; c++) { let pv = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[pv][c])) pv = r; if (Math.abs(A[pv][c]) < 1e-12) return null; [A[c], A[pv]] = [A[pv], A[c]]; const d = A[c][c]; for (let j = 0; j < 2 * n; j++) A[c][j] /= d; for (let r = 0; r < n; r++) if (r !== c) { const f = A[r][c]; if (f) for (let j = 0; j < 2 * n; j++) A[r][j] -= f * A[c][j]; } } return A.map(r => r.slice(n)); }
function wls(X, y, w) { const p = X[0].length, XtWX = Array.from({ length: p }, (_, a) => Array.from({ length: p }, (_, b) => sum(X.map((x, i) => w[i] * x[a] * x[b])))), V = inv(XtWX); if (!V) return null; const XtWy = Array.from({ length: p }, (_, a) => sum(X.map((x, i) => w[i] * x[a] * y[i]))), b = V.map(r => sum(r.map((c, j) => c * XtWy[j]))), fit = X.map(x => sum(x.map((c, j) => c * b[j]))); return { b, V, fit, rss: sum(y.map((yi, i) => w[i] * (yi - fit[i]) ** 2)) }; }
const quad = (x, V, z) => sum(x.map((xa, a) => sum(z.map((zb, b) => xa * V[a][b] * zb))));
function trP(X, w) { const r = wls(X, X.map(() => 0), w); return sum(w) - sum(X.map((x, i) => w[i] * w[i] * quad(x, r.V, x))); }
function metareg(y, v, X, opt = {}) { const k = y.length, p = X[0].length, level = Number(opt.level || 95), alpha = 1 - level / 100, test = opt.test || 'z'; if (k < p + 1) return null;
  const fe = wls(X, y, v.map(x => 1 / x)); if (!fe) return null; const QE = fe.rss, dfE = k - p; let t2 = 0, est = opt.method || 'REML';
  if (est !== 'FE') { t2 = Math.max(0, (QE - dfE) / trP(X, v.map(x => 1 / x)));
    if (est !== 'DL' && k <= 500) { est = 'REML'; for (let it = 0; it < 300; it++) { const w = v.map(x => 1 / (x + t2)), r = wls(X, y, w); if (!r) break; const P = X.map((xi, i) => X.map((xj, j) => (i === j ? w[i] : 0) - w[i] * w[j] * quad(xi, r.V, xj))), Py = P.map(row => sum(row.map((c, j) => c * y[j]))), yPPy = sum(Py.map(x => x * x)), tr = sum(P.map((row, i) => row[i])), trPP = sum(P.map(row => sum(row.map(c => c * c)))); let nt = Math.max(0, t2 + (yPPy - tr) / trPP); if (Math.abs(nt - t2) < 1e-10) { t2 = nt; break; } t2 = nt; } } }
  const w = v.map(x => 1 / (x + t2)), r = wls(X, y, w); if (!r) return null; let V = r.V, dist = 'z', df = Infinity;
  if (est !== 'FE' && (test === 'knha' || test === 'knha-adhoc')) { const s2 = r.rss / dfE, sc = test === 'knha-adhoc' ? Math.max(1, s2) : s2; V = V.map(row => row.map(c => c * sc)); dist = 't'; df = dfE; }
  const crit = dist === 't' ? qt(alpha, df) : qnorm(1 - alpha / 2), coef = r.b.map((b, j) => { const se = Math.sqrt(V[j][j]), z = b / se; return { b, se, z, p: dist === 't' ? pt2(z, df) : 2 * pnorm(-Math.abs(z)), ci: [b - crit * se, b + crit * se] }; });
  let QM = NaN, QMp = NaN; if (p > 1) { const idx = [...Array(p).keys()].slice(1), Vs = inv(idx.map(a => idx.map(b => V[a][b]))), bs = idx.map(j => r.b[j]); QM = quad(bs, Vs, bs); QMp = dist === 't' ? pF(QM / (p - 1), p - 1, df) : pchisqU(QM, p - 1); if (dist === 't') QM /= (p - 1); }
  const base = est === 'FE' ? 0 : tau2(y, v, est === 'REML' ? 'REML' : est), R2 = base > 0 ? Math.max(0, (base - t2) / base) * 100 : NaN;
  return { k, p, coef, tau2: t2, QE, dfE, QEp: pchisqU(QE, dfE), QM, QMp, QMdist: dist === 't' ? 'F' : 'chi2', R2, method: est, dist, fit: r.fit, weights: w }; }

/* ---------- conversions (Cochrane Handbook ch. 6; Wan 2014; Luo 2018) ---------- */
const conv = {
  medianIQR(q1, m, q3, n) { return { mean: (.7 + .39 / n) * (q1 + q3) / 2 + (.3 - .39 / n) * m, sd: (q3 - q1) / (2 * qnorm((.75 * n - .125) / (n + .25))) }; },
  medianRange(a, m, b, n) { const w = 4 / (4 + Math.pow(n, .75)); return { mean: w * (a + b) / 2 + (1 - w) * m, sd: (b - a) / (2 * qnorm((n - .375) / (n + .25))) }; },
  seToSd: (se, n) => se * Math.sqrt(n),
  ciToSd(lo, hi, n, level = 95) { const a = 1 - level / 100, c = n < 60 ? qt(a, n - 1) : qnorm(1 - a / 2); return Math.sqrt(n) * (hi - lo) / (2 * c); },
  ratioCI(est, lo, hi, level = 95) { const yi = Math.log(est), se = (Math.log(hi) - Math.log(lo)) / (2 * qnorm(1 - (1 - level / 100) / 2)); return { yi, se, vi: se * se, z: yi / se, p: 2 * pnorm(-Math.abs(yi / se)) }; },
  pToSe: (estAnalysisScale, p) => Math.abs(estAnalysisScale) / qnorm(1 - p / 2),
  orToSmd: (lnor, vlnor) => ({ d: lnor * Math.sqrt(3) / Math.PI, v: vlnor * 3 / Math.PI ** 2 }),
  smdToOr: (d, vd) => ({ lnor: d * Math.PI / Math.sqrt(3), v: vd * Math.PI ** 2 / 3 }),
  combineArms(n1, m1, s1, n2, m2, s2) { const N = n1 + n2, M = (n1 * m1 + n2 * m2) / N; return { n: N, mean: M, sd: Math.sqrt(((n1 - 1) * s1 * s1 + (n2 - 1) * s2 * s2 + n1 * n2 / N * (m1 - m2) ** 2) / (N - 1)) }; }
};

return { sum, clamp, logGamma, gammaincQ, pnorm, qnorm, pt2, qt, pchisqU, qchisq, pF, num, METRICS, isRatio, back, nullValue, effect, tau2, pool, egger, begg, trimfill, leaveOneOut, baujat, cumulative, subgroups, metareg, wls, conv, version: '3.0.0' };
});
