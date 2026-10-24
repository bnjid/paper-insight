/* Ultra Paper — automatic interpretation, indicative certainty (GRADE-style) & conclusion (window.UPInsight). */
(function () { 'use strict';
const S = window.UPStats;
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (x, d = 2) => Number.isFinite(x) ? x.toFixed(d).replace('.', ',') : '—';
const ptxt = p => !Number.isFinite(p) ? '—' : p < .001 ? '< 0,001' : '= ' + f(p, 3);
const LEVELS = ['Sangat rendah', 'Rendah', 'Sedang', 'Tinggi'];
const i2cat = i => i < 30 ? 'rendah (mungkin tidak penting)' : i < 50 ? 'moderat' : i < 75 ? 'substansial' : 'sangat besar';

function magnitude(m, p) { const B = y => S.back(m, y), est = B(p.mu), sc = S.METRICS[m].scale, kind = S.METRICS[m].kind;
  if (sc === 'log') { const word = m === 'OR' ? 'odds' : m === 'GENR' ? 'rasio (hazard/odds/risiko sesuai laporan)' : 'risiko', pct = Math.abs(est - 1) * 100; if (pct < .5) return { text: 'hampir tidak ada perbedaan', short: 'tidak berbeda' }; return { text: `${word} ${f(pct, 0)}% lebih ${est < 1 ? 'rendah' : 'tinggi'} pada kelompok intervensi dibanding kontrol`, short: `${f(pct, 0)}% lebih ${est < 1 ? 'rendah' : 'tinggi'}` }; }
  if (m === 'RD') { const n = Math.ceil(1 / Math.abs(est)); return { text: `selisih risiko absolut ${f(est * 100, 1)} poin persen${Number.isFinite(n) && est !== 0 ? ` (≈ 1 kejadian ${est < 0 ? 'tercegah' : 'tambahan'} per ${n} orang yang mendapat intervensi; ${est < 0 ? 'NNT' : 'NNH'} ≈ ${n})` : ''}`, short: `${f(est * 100, 1)} poin persen` }; }
  if (m === 'MD') return { text: `rerata outcome ${f(Math.abs(est), 2)} satuan lebih ${est < 0 ? 'rendah' : 'tinggi'} pada kelompok intervensi`, short: `selisih rerata ${f(est, 2)}` };
  if (m === 'SMD') { const a = Math.abs(est), size = a < .2 ? 'sangat kecil (trivial)' : a < .5 ? 'kecil' : a < .8 ? 'sedang' : 'besar'; return { text: `efek berukuran ${size} menurut patokan Cohen (g = ${f(est, 2)}; ${est < 0 ? 'skor intervensi lebih rendah' : 'skor intervensi lebih tinggi'})`, short: `efek ${size}` }; }
  if (m === 'PLO') return { text: `proporsi/prevalensi gabungan ${f(est * 100, 1)}% (${f(B(p.ci[0]) * 100, 1)}–${f(B(p.ci[1]) * 100, 1)}%)`, short: `prevalensi ${f(est * 100, 1)}%` };
  if (m === 'ZCOR') { const a = Math.abs(est), size = a < .1 ? 'sangat lemah' : a < .3 ? 'lemah' : a < .5 ? 'sedang' : 'kuat'; return { text: `korelasi ${est < 0 ? 'negatif' : 'positif'} ${size} (r = ${f(est, 2)})`, short: `korelasi ${size}` }; }
  return { text: `estimasi gabungan ${f(est, 3)} pada skala yang dimasukkan`, short: f(est, 3) }; }

function interpret(c) { const p = c.p, m = c.metric; if (!p) return null; const B = y => S.back(m, y), nv = S.nullValue(m), nullTxt = S.isRatio(m) ? '1' : '0', items = [], reasons = [], opt = c.opt;
  const sig = nv !== null && (p.ci[0] > 0 || p.ci[1] < 0), mag = magnitude(m, p), side = p.mu < 0 ? c.labelLeft : c.labelRight;
  items.push({ tone: nv === null ? 'info' : sig ? 'good' : 'neutral', icon: '◆', title: 'Besar & arah efek', text: `Pooled ${m} = <b>${f(B(p.mu))}</b> (${p.level}% CI ${f(B(p.ci[0]))} – ${f(B(p.ci[1]))}): ${esc(mag.text)}.` });
  if (nv !== null) items.push({ tone: sig ? 'good' : 'neutral', icon: '✓', title: 'Signifikansi statistik', text: sig ? `CI tidak mencakup nilai null (${nullTxt}); p ${ptxt(p.p)}. Hasil bermakna secara statistik${side ? `, arah efek: <b>${esc(side)}</b>` : ''}.` : `CI mencakup nilai null (${nullTxt}); p ${ptxt(p.p)}. Belum ada bukti statistik yang cukup — ini <i>bukan</i> bukti bahwa efeknya nol.` });
  let inconsistent = false;
  if (p.k > 1) { const piNull = p.PI && nv !== null && p.PI[0] < 0 && p.PI[1] > 0; inconsistent = p.I2 >= 50 && (piNull || p.Qp < .10);
    items.push({ tone: p.I2 >= 75 ? 'bad' : p.I2 >= 50 ? 'warn' : 'good', icon: '◎', title: 'Heterogenitas', text: `I² = ${f(p.I2, 1)}% — ${i2cat(p.I2)}; τ² = ${f(p.tau2, 3)}; Q p ${ptxt(p.Qp)}.${p.PI ? ` Prediction interval ${f(B(p.PI[0]))} – ${f(B(p.PI[1]))}${nv !== null ? (piNull ? ': efek pada setting baru bisa berbeda arah.' : ': arah efek cenderung konsisten pada setting baru.') : '.'}` : ''}${p.I2 >= 50 ? ' Telusuri sumbernya dengan subgrup/meta-regresi.' : ''}` }); }
  const N = p.n, smallN = Number.isFinite(N) && ['bin', 'cont'].includes(S.METRICS[m].kind) && N < 400, imprecise = nv !== null && !sig;
  items.push({ tone: p.k < 5 || smallN ? 'warn' : 'good', icon: '▦', title: 'Jumlah & presisi bukti', text: `${p.k} studi${Number.isFinite(N) ? `, ${N.toLocaleString('id-ID')} partisipan` : ''}.${p.k < 5 ? ' Jumlah studi sedikit: estimasi τ² dan CI kurang stabil' + (p.dist === 'z' && p.method !== 'FE' ? ' — pertimbangkan Knapp–Hartung.' : '.') : ''}${smallN ? ' Total sampel < 400 (di bawah ukuran informasi optimal kasar).' : ''}` });
  let pubBias = false;
  if (p.k >= 3) { const eg = S.egger(p), tf = S.trimfill(p, opt), tfSig = tf && nv !== null && (tf.pool.ci[0] > 0 || tf.pool.ci[1] < 0); pubBias = (p.k >= 10 && eg && eg.p < .10) || (tf && tf.k0 > 0 && tfSig !== sig);
    items.push({ tone: pubBias ? 'warn' : p.k < 10 ? 'neutral' : 'good', icon: '◌', title: 'Small-study effects / bias publikasi', text: `${p.k < 10 ? 'k < 10: uji asimetri kurang andal. ' : ''}Egger p ${eg ? ptxt(eg.p) : '—'}${eg && p.k >= 10 ? (eg.p < .10 ? ' (indikasi asimetri)' : ' (tidak ada indikasi kuat)') : ''}. Trim-and-fill: ${tf ? `${tf.k0} studi diimputasi → ${m} ${f(B(tf.pool.mu))}${tf.k0 && tfSig !== sig ? ' — <b>kesimpulan berubah</b>' : tf.k0 ? ' — kesimpulan tetap' : ''}` : '—'}.` }); }
  if (p.k >= 3) { const loo = S.leaveOneOut(p, opt), flips = loo.filter(l => nv !== null && ((l.pool.ci[0] > 0 || l.pool.ci[1] < 0) !== sig)), dir = loo.filter(l => Math.sign(l.pool.mu) !== Math.sign(p.mu)), out = loo.filter(l => Math.abs(l.rstudent) > 1.96), names = c.names;
    items.push({ tone: flips.length || dir.length ? 'warn' : 'good', icon: '↗', title: 'Robustnes (leave-one-out)', text: flips.length || dir.length ? `Kesimpulan berubah bila salah satu studi berikut dikeluarkan: ${esc([...new Set([...flips, ...dir].map(l => names[l.i]))].join(', '))}. Hasil bergantung pada studi tertentu.` : `Mengeluarkan studi mana pun tidak mengubah kesimpulan (rentang ${m}: ${f(B(Math.min(...loo.map(l => l.pool.mu))))} – ${f(B(Math.max(...loo.map(l => l.pool.mu))))}).${out.length ? ` Potensi outlier (|rstudent| > 1,96): ${esc(out.map(l => names[l.i]).join(', '))}.` : ''}` }); }
  const highW = c.meta.reduce((s, r, i) => s + (r.rob === 'High' ? p.wpct[i] : 0), 0), lowW = c.meta.reduce((s, r, i) => s + (r.rob === 'Low' ? p.wpct[i] : 0), 0), unv = c.meta.filter(r => !r.verified).length;
  items.push({ tone: highW >= 50 ? 'bad' : highW > 25 ? 'warn' : 'good', icon: '🛡', title: 'Risiko bias & verifikasi', text: `${f(highW, 0)}% bobot dari studi RoB tinggi, ${f(lowW, 0)}% dari RoB rendah.${unv ? ` ${unv} studi belum Verified — kesimpulan masih eksploratif.` : ' Semua studi telah Verified.'}` });
  // indicative certainty
  let down = 0; if (highW >= 50) { down++; reasons.push('risiko bias (≥ 50% bobot dari studi RoB tinggi)'); }
  if (inconsistent) { down++; reasons.push('inkonsistensi (I² tinggi)'); }
  if (imprecise || smallN) { const d = imprecise && smallN ? 2 : 1; down += d; reasons.push('imprecision (' + [imprecise && 'CI mencakup null', smallN && 'sampel kecil'].filter(Boolean).join(', ') + ')'); }
  if (pubBias) { down++; reasons.push('dugaan bias publikasi'); }
  const level = LEVELS[Math.max(0, 3 - down)];
  // conclusion
  const outcome = c.outcome && c.outcome !== 'Outcome utama' ? `“${c.outcome}”` : 'outcome ini';
  const het = p.k > 1 ? ` Heterogenitas ${i2cat(p.I2).split(' (')[0]} (I² = ${f(p.I2, 0)}%).` : '';
  const main = nv === null ? `Berdasarkan ${p.k} studi, ${mag.text} untuk ${outcome}.` : sig ? `Berdasarkan ${p.k} studi${Number.isFinite(N) ? ` (${N.toLocaleString('id-ID')} partisipan)` : ''}, intervensi berhubungan dengan ${mag.text} pada ${outcome} (${m} ${f(B(p.mu))}; ${p.level}% CI ${f(B(p.ci[0]))}–${f(B(p.ci[1]))}).` : `Berdasarkan ${p.k} studi${Number.isFinite(N) ? ` (${N.toLocaleString('id-ID')} partisipan)` : ''}, belum terdapat bukti yang meyakinkan bahwa intervensi memengaruhi ${outcome} (${m} ${f(B(p.mu))}; ${p.level}% CI ${f(B(p.ci[0]))}–${f(B(p.ci[1]))}); data kompatibel dengan manfaat maupun kerugian.`;
  const cert = ` Kepastian bukti (indikatif, gaya GRADE): <b>${level}</b>${reasons.length ? ' — diturunkan karena ' + reasons.join('; ') : ''}.`;
  const advice = level === 'Tinggi' || level === 'Sedang' ? ' Penelitian lanjutan kemungkinan kecil/sedang mengubah kesimpulan.' : ' Penelitian lanjutan berkualitas tinggi kemungkinan besar mengubah estimasi ini.';
  const conclusion = main + het + cert + advice;
  const en = `Based on ${p.k} studies, the pooled ${m} was ${B(p.mu).toFixed(2)} (${p.level}% CI ${B(p.ci[0]).toFixed(2)} to ${B(p.ci[1]).toFixed(2)}; p ${p.p < .001 ? '< 0.001' : '= ' + p.p.toFixed(3)})${p.k > 1 ? `, with I² = ${p.I2.toFixed(0)}%` : ''}. ${nv === null ? '' : sig ? 'The effect was statistically significant.' : 'The confidence interval included no effect.'} Indicative certainty of evidence: ${['very low', 'low', 'moderate', 'high'][Math.max(0, 3 - down)]}.`;
  return { items, level, reasons, conclusion, conclusionText: conclusion.replace(/<[^>]+>/g, ''), en, sig, startNote: 'Asumsi awal "Tinggi" untuk RCT; mulailah dari "Rendah" bila studi observasional. Domain indirectness tidak dinilai otomatis.' }; }

function render(r) { if (!r) return '<div class="plot-message">◈ Interpretasi muncul setelah ada studi valid.</div>';
  return `<div class="insight-conclusion"><div class="panel-head"><span class="eyebrow">KESIMPULAN OTOMATIS</span><span class="certainty c-${r.level.replace(/\s/g, '-').toLowerCase()}">Kepastian: ${esc(r.level)}</span></div><p>${r.conclusion}</p><div class="head-actions"><button class="mini-act" data-copy-conclusion="id">⧉ Salin (ID)</button><button class="mini-act" data-copy-conclusion="en">⧉ Copy (EN)</button></div></div>
  <div class="insight-grid">${r.items.map(i => `<div class="insight-card tone-${i.tone}"><b><span>${i.icon}</span> ${esc(i.title)}</b><p>${i.text}</p></div>`).join('')}</div><p class="smallprint">${esc(r.startNote)} Interpretasi dibangkitkan dari aturan statistik baku (Cochrane Handbook, GRADE) dan wajib ditelaah peneliti.</p>`; }

function metaregText(reg, labels, m) { if (!reg) return ''; const out = []; reg.coef.slice(1).forEach((c, j) => { const sig = c.p < .05, lab = labels[j + 1];
  out.push(`${lab}: ${S.isRatio(m) ? `setiap kenaikan 1 unit, ${m} dikalikan ${f(Math.exp(c.b), 3)}` : `setiap kenaikan 1 unit, effect berubah ${f(c.b, 3)}`} (p ${ptxt(c.p)}) — ${sig ? 'asosiasi bermakna' : 'tidak ada asosiasi bermakna'}.`); });
  out.push(`Moderator menjelaskan ${Number.isFinite(reg.R2) ? f(reg.R2, 0) + '%' : '—'} heterogenitas; heterogenitas residual ${reg.QEp < .10 ? 'masih bermakna' : 'tidak bermakna'} (QE p ${ptxt(reg.QEp)}).`, 'Ingat: asosiasi antarstudi bersifat observasional (rawan ecological bias/confounding).');
  return out.map(x => `<p>${esc(x)}</p>`).join(''); }

window.UPInsight = { interpret, render, metaregText };
})();
