/* Ultra Paper — publication-style SVG charts (forest, cumulative, funnel, Baujat, Galbraith, bubble, L'Abbé). */
(function () { 'use strict';
const S = window.UPStats;
const C = { green: '#709e8d', greenD: '#4d8271', coral: '#e79479', coralD: '#c9735a', ink: '#33433c', muted: '#71857a', grid: '#e3ebe5', axis: '#9aafa4', fill: '#eaf3ed' };
const FONT = 'font-family="Inter,Segoe UI,Helvetica,Arial,sans-serif"';
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fx = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d) : '—';
const ptxt = p => !Number.isFinite(p) ? '—' : p < .001 ? '< 0.001' : p.toFixed(3);
let uid = 0;
function niceStep(raw) { const e = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
function linTicks(lo, hi, n = 5) { if (!(hi > lo)) return [lo]; const st = niceStep((hi - lo) / n), out = []; for (let v = Math.ceil(lo / st) * st; v <= hi + st * 1e-9; v += st) out.push(+v.toFixed(10)); return out; }
const tickLabel = v => { const a = Math.abs(v); return a >= 100 ? v.toFixed(0) : a >= 10 ? v.toFixed(1).replace(/\.0$/, '') : +v.toFixed(a < .1 ? 3 : 2) + ''; };
/** ticks on analysis scale with labels on display scale */
function effTicks(lo, hi, metric) { const sc = S.METRICS[metric]?.scale;
  if (sc === 'log') { const cand = [.01, .02, .05, .1, .2, .25, .5, .75, 1, 1.5, 2, 3, 4, 5, 10, 20, 50, 100, 200].map(Math.log); let t = cand.filter(x => x >= lo && x <= hi); while (t.length > 7) t = t.filter((x, i) => i % 2 === 0 || Math.abs(x) < 1e-9); if (t.length >= 2) return t.map(x => ({ x, label: tickLabel(Math.exp(x)) })); }
  if (sc === 'logit' || sc === 'fisher') { const bl = S.back(metric, lo), bh = S.back(metric, hi), inv = sc === 'logit' ? p => Math.log(p / (1 - p)) : Math.atanh; return linTicks(bl, bh).filter(v => sc === 'logit' ? v > 0 && v < 1 : Math.abs(v) < 1).map(v => ({ x: inv(v), label: tickLabel(v) })); }
  return linTicks(lo, hi).map(x => ({ x, label: tickLabel(x) })); }
const dispCI = (m, y, lo, hi, d = 2) => `${fx(S.back(m, y), d)} [${fx(S.back(m, lo), d)}, ${fx(S.back(m, hi), d)}]`;
function range(vals, core) { let lo = Math.min(...vals), hi = Math.max(...vals); const cl = Math.min(...core), ch = Math.max(...core), cw = Math.max(ch - cl, .2); if (hi - lo > 5 * cw) { lo = Math.max(lo, cl - 1.6 * cw); hi = Math.min(hi, ch + 1.6 * cw); } const pad = (hi - lo) * .06 || .1; return [lo - pad, hi + pad]; }
const robColor = r => r === 'Low' ? '#5fae7f' : r === 'High' ? '#d9694f' : '#e8b64c';

/* ---------- forest ---------- */
function forest(p, meta, o = {}) { if (!p) return ''; const m = o.metric, mini = !!o.mini, W = mini ? 760 : 1080, L = mini ? 200 : 420, R = mini ? 540 : 800, TX = R + 22, rh = mini ? 26 : 28;
  let idx = [...p.y.keys()]; if (o.sort === 'year') idx.sort((a, b) => (+meta[a].year || 9e9) - (+meta[b].year || 9e9)); else if (o.sort === 'effect') idx.sort((a, b) => p.y[a] - p.y[b]); else if (o.sort === 'weight') idx.sort((a, b) => p.weights[b] - p.weights[a]);
  const z = S.qnorm(1 - (1 - p.level / 100) / 2), lo = p.y.map((y, i) => y - z * Math.sqrt(p.v[i])), hi = p.y.map((y, i) => y + z * Math.sqrt(p.v[i])), nv = S.nullValue(m);
  const [x0, x1] = range([...lo, ...hi, ...p.ci, ...(p.PI || []), ...(nv === null ? [] : [nv])], [...p.y, ...p.ci, ...(nv === null ? [] : [nv])]), X = v => L + (S.clamp(v, x0, x1) - x0) / (x1 - x0) * (R - L);
  const top = mini ? 46 : 62, yP = top + p.k * rh + 16, yPI = yP + 22, yAx = (p.PI && !mini ? yPI : yP) + 24, H = yAx + (mini ? 46 : 104), wmax = Math.max(...p.weights);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${FONT} role="img" aria-label="Forest plot ${p.k} studi"><rect width="${W}" height="${H}" fill="#fff"/>`;
  const head = (x, t, anchor = 'start') => `<text x="${x}" y="${top - 24}" font-size="12" font-weight="700" fill="${C.muted}" text-anchor="${anchor}">${esc(t)}</text>`;
  s += head(16, 'Study'); if (!mini) { s += head(290, 'Year') + head(372, 'Weight', 'end') + head(392, 'RoB', 'middle'); } s += head(TX, `${m} [${p.level}% CI]`);
  effTicks(x0, x1, m).forEach(t => { s += `<line x1="${X(t.x)}" y1="${top - 14}" x2="${X(t.x)}" y2="${yAx}" stroke="${C.grid}"/><text x="${X(t.x)}" y="${yAx + 16}" font-size="11" text-anchor="middle" fill="${C.muted}">${t.label}</text>`; });
  if (nv !== null && nv >= x0 && nv <= x1) s += `<line x1="${X(nv)}" y1="${top - 14}" x2="${X(nv)}" y2="${yAx}" stroke="#a99285" stroke-width="1.4"/>`;
  s += `<line x1="${X(p.mu)}" y1="${top - 14}" x2="${X(p.mu)}" y2="${yP}" stroke="${C.coral}" stroke-dasharray="4,4" stroke-width="1.2"/>`;
  idx.forEach((i, r) => { const y = top + r * rh, md = meta[i] || {}, sz = 5 + 11 * Math.sqrt(p.weights[i] / wmax), a = X(lo[i]), b = X(hi[i]); const name = String(md.name || 'Study').slice(0, mini ? 24 : 36);
    s += `<g class="forest-row"><title>${esc(md.name)} — ${esc(dispCI(m, p.y[i], lo[i], hi[i], 3))}; weight ${fx(p.wpct[i], 1)}%</title><text x="16" y="${y + 4}" font-size="12" fill="${C.ink}">${esc(name)}</text>`;
    if (!mini) s += `<text x="290" y="${y + 4}" font-size="12" fill="${C.muted}">${esc(md.year || '')}</text><text x="372" y="${y + 4}" font-size="12" fill="${C.muted}" text-anchor="end">${fx(p.wpct[i], 1)}%</text><circle cx="392" cy="${y}" r="5" fill="${robColor(md.rob)}"><title>RoB: ${esc(md.rob)}</title></circle>`;
    s += `<line x1="${a}" y1="${y}" x2="${b}" y2="${y}" stroke="${C.greenD}" stroke-width="1.6"/>`;
    if (lo[i] < x0) s += `<path d="M${L + 7} ${y - 4}L${L} ${y}L${L + 7} ${y + 4}" fill="none" stroke="${C.greenD}" stroke-width="1.6"/>`; if (hi[i] > x1) s += `<path d="M${R - 7} ${y - 4}L${R} ${y}L${R - 7} ${y + 4}" fill="none" stroke="${C.greenD}" stroke-width="1.6"/>`;
    s += `<rect x="${X(p.y[i]) - sz / 2}" y="${y - sz / 2}" width="${sz}" height="${sz}" fill="${C.green}" stroke="#fff" stroke-width=".8"/><text x="${TX}" y="${y + 4}" font-size="12" fill="${C.ink}">${esc(dispCI(m, p.y[i], lo[i], hi[i]))}</text></g>`; });
  s += `<line x1="12" y1="${yP - 16}" x2="${W - 12}" y2="${yP - 16}" stroke="#dce7df"/><text x="16" y="${yP + 4}" font-size="12" font-weight="800" fill="${C.greenD}">${esc(p.method === 'FE' ? 'Common effect (FE)' : 'Random effects (' + p.method + (p.dist === 't' ? ', KH' : '') + ')')}</text>`;
  if (!mini) s += `<text x="372" y="${yP + 4}" font-size="12" font-weight="700" fill="${C.muted}" text-anchor="end">100%</text>`;
  s += `<g class="pooled-row"><polygon points="${X(p.ci[0])},${yP} ${X(p.mu)},${yP - 9} ${X(p.ci[1])},${yP} ${X(p.mu)},${yP + 9}" fill="${C.coral}" stroke="${C.coralD}"/><text x="${TX}" y="${yP + 4}" font-size="12" font-weight="800" fill="${C.coralD}">${esc(dispCI(m, p.mu, p.ci[0], p.ci[1]))}</text></g>`;
  if (p.PI && !mini) s += `<text x="16" y="${yPI + 4}" font-size="11.5" fill="${C.muted}">Prediction interval</text><line x1="${X(p.PI[0])}" y1="${yPI}" x2="${X(p.PI[1])}" y2="${yPI}" stroke="${C.coralD}" stroke-width="2"/><line x1="${X(p.PI[0])}" y1="${yPI - 4}" x2="${X(p.PI[0])}" y2="${yPI + 4}" stroke="${C.coralD}"/><line x1="${X(p.PI[1])}" y1="${yPI - 4}" x2="${X(p.PI[1])}" y2="${yPI + 4}" stroke="${C.coralD}"/><text x="${TX}" y="${yPI + 4}" font-size="11.5" fill="${C.muted}">[${fx(S.back(m, p.PI[0]))}, ${fx(S.back(m, p.PI[1]))}]</text>`;
  s += `<line x1="${L}" y1="${yAx}" x2="${R}" y2="${yAx}" stroke="${C.axis}"/>`;
  if (!mini) { if (nv !== null && o.labelLeft) s += `<text x="${X(nv) - 8}" y="${yAx + 34}" font-size="11.5" fill="${C.muted}" text-anchor="end">← ${esc(o.labelLeft)}</text>`; if (nv !== null && o.labelRight) s += `<text x="${X(nv) + 8}" y="${yAx + 34}" font-size="11.5" fill="${C.muted}">${esc(o.labelRight)} →</text>`;
    const het = p.k > 1 ? `Heterogeneity: τ² = ${fx(p.tau2, 4)}; Q = ${fx(p.Q, 2)}, df = ${p.df} (p ${ptxt(p.Qp).startsWith('<') ? ptxt(p.Qp) : '= ' + ptxt(p.Qp)}); I² = ${fx(p.I2, 1)}%` : 'Heterogeneity: not applicable (k = 1)';
    s += `<text x="16" y="${yAx + 64}" font-size="11.5" fill="${C.ink}">${esc(het)}</text><text x="16" y="${yAx + 82}" font-size="11.5" fill="${C.ink}">${esc(`Test for overall effect: ${p.dist === 't' ? 't' : 'Z'} = ${fx(p.stat, 2)} (p ${ptxt(p.p).startsWith('<') ? ptxt(p.p) : '= ' + ptxt(p.p)})`)}${S.isRatio(m) ? ' · analysis on log scale' : ''}</text>`; }
  return s + '</svg>'; }

/* ---------- generic chart frame ---------- */
function chart(o) { const W = o.W || 820, H = o.H || 400, L = o.L || 72, R = W - (o.R || 26), T = o.T || 22, B = H - (o.B || 54), [x0, x1] = o.xr, [y0, y1] = o.yr, id = 'clip' + (++uid);
  const X = v => L + (v - x0) / (x1 - x0) * (R - L), Y = o.yInvert ? v => T + (v - y0) / (y1 - y0) * (B - T) : v => B - (v - y0) / (y1 - y0) * (B - T);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${FONT} role="img" aria-label="${esc(o.aria || 'chart')}"><rect width="${W}" height="${H}" fill="#fff"/><defs><clipPath id="${id}"><rect x="${L}" y="${T}" width="${R - L}" height="${B - T}"/></clipPath></defs>`;
  (o.yTicks || linTicks(Math.min(y0, y1), Math.max(y0, y1)).map(v => ({ x: v, label: tickLabel(v) }))).forEach(t => { const y = Y(t.x); if (y < T - .5 || y > B + .5) return; s += `<line x1="${L}" y1="${y}" x2="${R}" y2="${y}" stroke="${C.grid}"/><text x="${L - 8}" y="${y + 4}" font-size="11" text-anchor="end" fill="${C.muted}">${t.label}</text>`; });
  (o.xTicks || linTicks(x0, x1).map(v => ({ x: v, label: tickLabel(v) }))).forEach(t => { const x = X(t.x); if (x < L - .5 || x > R + .5) return; s += `<line x1="${x}" y1="${T}" x2="${x}" y2="${B}" stroke="${C.grid}"/><text x="${x}" y="${B + 17}" font-size="11" text-anchor="middle" fill="${C.muted}">${t.label}</text>`; });
  s += `<g clip-path="url(#${id})">${o.under ? o.under(X, Y, { L, R, T, B }) : ''}`;
  (o.points || []).forEach(pt => { s += `<circle cx="${X(pt.x)}" cy="${Y(pt.y)}" r="${pt.r || 6}" fill="${pt.hollow ? '#fff' : (pt.fill || C.green)}" fill-opacity="${pt.hollow ? 1 : (pt.alpha ?? .85)}" stroke="${pt.stroke || (pt.hollow ? C.coralD : '#fff')}" stroke-width="${pt.hollow ? 1.8 : 1.5}"><title>${esc(pt.title || '')}</title></circle>`; if (pt.label) s += `<text x="${X(pt.x) + (pt.r || 6) + 4}" y="${Y(pt.y) + 4}" font-size="10.5" fill="${C.ink}">${esc(pt.label)}</text>`; });
  s += `${o.over ? o.over(X, Y, { L, R, T, B }) : ''}</g><rect x="${L}" y="${T}" width="${R - L}" height="${B - T}" fill="none" stroke="${C.axis}"/>`;
  s += `<text x="${(L + R) / 2}" y="${H - 12}" font-size="12" fill="${C.ink}" text-anchor="middle">${esc(o.xlab || '')}</text><text x="18" y="${(T + B) / 2}" font-size="12" fill="${C.ink}" text-anchor="middle" transform="rotate(-90 18 ${(T + B) / 2})">${esc(o.ylab || '')}</text>`;
  return s + '</svg>'; }

/* ---------- funnel (contour-enhanced) ---------- */
function funnel(p, o = {}) { if (!p || p.k < 2) return ''; const m = o.metric, tf = o.trim, ses = p.v.map(Math.sqrt), maxSE = Math.max(...ses, ...(tf?.filled || []).map(f => Math.sqrt(f.v))) * 1.12;
  const ys = [...p.y, ...(tf?.filled || []).map(f => f.y)], z1 = 2.5758;
  const [x0, x1] = range([...ys, p.mu - 1.96 * maxSE, p.mu + 1.96 * maxSE, ...(o.contour ? [-z1 * maxSE * .6, z1 * maxSE * .6] : [])], [...ys, p.mu]);
  const tri = (X, Y, c, z, fill) => `<polygon points="${X(c)},${Y(0)} ${X(c - z * maxSE)},${Y(maxSE)} ${X(c + z * maxSE)},${Y(maxSE)}" fill="${fill}"/>`;
  const under = (X, Y) => { let s = ''; if (o.contour) { s += `<rect x="0" y="0" width="2000" height="2000" fill="#cfd9d2"/>` + tri(X, Y, 0, 2.5758, '#dfe7e1') + tri(X, Y, 0, 1.96, '#eef3ef') + tri(X, Y, 0, 1.6449, '#ffffff'); }
    s += `<polyline points="${X(p.mu - 1.96 * maxSE)},${Y(maxSE)} ${X(p.mu)},${Y(0)} ${X(p.mu + 1.96 * maxSE)},${Y(maxSE)}" fill="none" stroke="${C.greenD}" stroke-dasharray="6,5"/><line x1="${X(p.mu)}" y1="${Y(0)}" x2="${X(p.mu)}" y2="${Y(maxSE)}" stroke="${C.coralD}" stroke-width="1.4"/>`;
    if (tf && tf.k0) s += `<line x1="${X(tf.pool.mu)}" y1="${Y(0)}" x2="${X(tf.pool.mu)}" y2="${Y(maxSE)}" stroke="${C.coralD}" stroke-dasharray="2,3"/>`; return s; };
  const pts = p.y.map((y, i) => ({ x: y, y: ses[i], title: `${o.names?.[i] || 'Study'}: ${fx(S.back(m, y), 3)} (SE ${fx(ses[i], 3)})`, fill: C.greenD })).concat((tf?.filled || []).map(f => ({ x: f.y, y: Math.sqrt(f.v), hollow: true, title: 'Imputed (trim-and-fill)' })));
  const legend = o.contour ? `<g font-size="10.5" fill="${C.ink}"><rect x="600" y="8" width="11" height="11" fill="#fff" stroke="#bbb"/><text x="615" y="17">p &gt; 0.10</text><rect x="672" y="8" width="11" height="11" fill="#eef3ef"/><text x="687" y="17">0.05–0.10</text><rect x="600" y="24" width="11" height="11" fill="#dfe7e1"/><text x="615" y="33">0.01–0.05</text><rect x="672" y="24" width="11" height="11" fill="#cfd9d2"/><text x="687" y="33">&lt; 0.01</text></g>` : '';
  return chart({ W: 820, H: 420, T: o.contour ? 44 : 22, xr: [x0, x1], yr: [0, maxSE], yInvert: true, xTicks: effTicks(x0, x1, m), under, points: pts, xlab: `${m} (${S.isRatio(m) ? 'log scale' : 'analysis scale'})`, ylab: 'Standard error', aria: 'Funnel plot' }).replace('</svg>', legend + '</svg>'); }

function baujat(p, b, names) { if (!b.length) return ''; const xs = b.map(d => d.x), ys = b.map(d => d.y), xm = Math.max(...xs) * 1.15 || 1, ym = Math.max(...ys) * 1.15 || 1;
  return chart({ xr: [0, xm], yr: [0, ym], points: b.map(d => ({ x: d.x, y: d.y, label: String(names[d.i] || '').slice(0, 18), title: names[d.i] })), xlab: 'Kontribusi terhadap heterogeneity (Q)', ylab: 'Pengaruh terhadap pooled result', aria: 'Baujat plot' }); }
function galbraith(p, names) { if (!p || p.k < 2) return ''; const xs = p.v.map(v => 1 / Math.sqrt(v)), zs = p.y.map((y, i) => y * xs[i]), xm = Math.max(...xs) * 1.1, ext = Math.max(...zs.map(Math.abs), Math.abs(p.muFE * xm) + 2) + 1;
  const over = (X, Y) => `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(xm)}" y2="${Y(p.muFE * xm)}" stroke="${C.coralD}" stroke-width="1.5"/>` + [-2, 2].map(d => `<line x1="${X(0)}" y1="${Y(d)}" x2="${X(xm)}" y2="${Y(p.muFE * xm + d)}" stroke="${C.axis}" stroke-dasharray="5,4"/>`).join('');
  return chart({ xr: [0, xm], yr: [-ext, ext], over, points: xs.map((x, i) => ({ x, y: zs[i], title: names[i], label: Math.abs(zs[i] - p.muFE * x) > 2 ? String(names[i]).slice(0, 16) : '' })), xlab: 'Precision (1/SE)', ylab: 'Standardized effect (y/SE)', aria: 'Galbraith radial plot' }); }
function bubble(reg, xs, p, o) { if (!reg) return ''; const m = o.metric, xr = [Math.min(...xs), Math.max(...xs)], pad = (xr[1] - xr[0]) * .06 || 1, X0 = xr[0] - pad, X1 = xr[1] + pad, [y0, y1] = range(p.y, p.y), wm = Math.max(...reg.weights), b0 = reg.coef[0].b, b1 = reg.coef[1].b;
  const over = (X, Y) => `<line x1="${X(X0)}" y1="${Y(b0 + b1 * X0)}" x2="${X(X1)}" y2="${Y(b0 + b1 * X1)}" stroke="${C.coralD}" stroke-width="2"/>` + (S.nullValue(m) === 0 ? `<line x1="${X(X0)}" y1="${Y(0)}" x2="${X(X1)}" y2="${Y(0)}" stroke="#a99285" stroke-dasharray="4,4"/>` : '');
  return chart({ xr: [X0, X1], yr: [y0, y1], yTicks: effTicks(y0, y1, m), over, points: xs.map((x, i) => ({ x, y: p.y[i], r: 4 + 14 * Math.sqrt(reg.weights[i] / wm), alpha: .55, title: (o.names?.[i] || '') + ` (${fx(x, 2)}, ${fx(S.back(m, p.y[i]), 3)})` })), xlab: o.xlab || 'Moderator', ylab: m + (S.isRatio(m) ? ' (log scale)' : ''), aria: 'Bubble plot meta-regression' }); }
function labbe(rows, names) { if (!rows.length) return ''; const nm = Math.max(...rows.map(r => r.n));
  return chart({ W: 560, H: 520, xr: [0, 1], yr: [0, 1], over: (X, Y) => `<line x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}" stroke="${C.coralD}" stroke-dasharray="5,4"/>`, points: rows.map((r, i) => ({ x: r.pc, y: r.pt, r: 4 + 14 * Math.sqrt(r.n / nm), alpha: .55, title: `${names[i]}: kontrol ${fx(r.pc * 100, 1)}%, intervensi ${fx(r.pt * 100, 1)}%` })), xlab: 'Risk kelompok kontrol', ylab: 'Risk kelompok intervensi', aria: "L'Abbé plot" }); }
function cumulativeForest(list, names, o) { if (!list.length) return ''; const m = o.metric, rh = 26, top = 46, W = 980, L = 330, R = 720, all = list.flatMap(c => c.pool.ci), [x0, x1] = range([...all, 0], list.map(c => c.pool.mu)), X = v => L + (S.clamp(v, x0, x1) - x0) / (x1 - x0) * (R - L), yAx = top + list.length * rh + 4, H = yAx + 40;
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" ${FONT} role="img" aria-label="Cumulative forest plot"><rect width="${W}" height="${H}" fill="#fff"/><text x="16" y="24" font-size="12" font-weight="700" fill="${C.muted}">Ditambahkan (urut tahun)</text><text x="${R + 22}" y="24" font-size="12" font-weight="700" fill="${C.muted}">Pooled ${m} [CI] · k</text>`;
  effTicks(x0, x1, m).forEach(t => s += `<line x1="${X(t.x)}" y1="${top - 14}" x2="${X(t.x)}" y2="${yAx}" stroke="${C.grid}"/><text x="${X(t.x)}" y="${yAx + 16}" font-size="11" text-anchor="middle" fill="${C.muted}">${t.label}</text>`);
  if (S.nullValue(m) === 0 && 0 >= x0 && 0 <= x1) s += `<line x1="${X(0)}" y1="${top - 14}" x2="${X(0)}" y2="${yAx}" stroke="#a99285"/>`;
  list.forEach((c, r) => { const y = top + r * rh, q = c.pool; s += `<text x="16" y="${y + 4}" font-size="12" fill="${C.ink}">+ ${esc(String(names[c.i]).slice(0, 38))}</text><line x1="${X(q.ci[0])}" y1="${y}" x2="${X(q.ci[1])}" y2="${y}" stroke="${C.greenD}" stroke-width="1.6"/><circle cx="${X(q.mu)}" cy="${y}" r="4.5" fill="${C.coral}"/><text x="${R + 22}" y="${y + 4}" font-size="12" fill="${C.ink}">${esc(dispCI(m, q.mu, q.ci[0], q.ci[1]))} · ${q.k}</text>`; });
  return s + `<line x1="${L}" y1="${yAx}" x2="${R}" y2="${yAx}" stroke="${C.axis}"/></svg>`; }

async function svgToPng(svg, scale = 3) { const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), w = +vb[1], h = +vb[2], img = new Image(), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = url; }); const cv = document.createElement('canvas'); cv.width = w * scale; cv.height = h * scale; const ctx = cv.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); ctx.drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url); return new Promise(r => cv.toBlob(r, 'image/png')); }

window.UPPlots = { forest, funnel, baujat, galbraith, bubble, labbe, cumulativeForest, chart, effTicks, svgToPng, dispCI };
})();
