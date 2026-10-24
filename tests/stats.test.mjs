// Regression tests for js/stats.js against published metafor output (dat.bcg, Colditz et al. 1994).
// Run: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const S = createRequire(import.meta.url)('../js/stats.js');

const BCG = [[4,119,11,128,44],[6,300,29,274,55],[3,228,11,209,42],[62,13536,248,12619,52],[33,5036,47,5761,13],[180,1361,372,1079,44],[8,2537,10,619,19],[505,87886,499,87892,13],[29,7470,45,7232,27],[17,1699,65,1600,42],[186,50448,141,27197,18],[5,2493,3,2338,33],[27,16886,29,17825,33]];
const es = BCG.map(([a, b, c, d]) => S.effect({ a, b, c, d }, 'RR'));
const near = (x, y, tol = 5e-4, msg) => assert.ok(Math.abs(x - y) < tol, `${msg}: ${x} vs ${y}`);

test('REML matches metafor rma(measure="RR", method="REML")', () => {
  const p = S.pool(es, { method: 'REML' });
  near(p.mu, -0.7145, 1e-4, 'mu'); near(p.se, 0.1798, 1e-4, 'se'); near(p.tau2, 0.3132, 1e-4, 'tau2');
  near(p.I2, 92.22, 0.01, 'I2'); near(p.Q, 152.2330, 1e-3, 'Q'); near(p.tau2CI[0], 0.1197, 1e-3, 'tau2 lb'); near(p.tau2CI[1], 1.1115, 1e-3, 'tau2 ub');
});
test('DL matches metafor', () => { const p = S.pool(es, { method: 'DL' }); near(p.tau2, 0.3088, 1e-4, 'tau2'); near(p.mu, -0.7141, 1e-4, 'mu'); near(p.se, 0.1787, 1e-4, 'se'); });
test('FE closed form', () => { const p = S.pool(es, { method: 'FE' }); near(p.mu, -0.4303, 1e-4, 'mu'); near(p.se, 0.0405, 1e-4, 'se'); });
test('meta-regression on latitude (REML)', () => {
  const r = S.metareg(es.map(e => e.y), es.map(e => e.v), BCG.map(x => [1, x[4]]), { method: 'REML' });
  near(r.coef[0].b, 0.2515, 1e-3, 'b0'); near(r.coef[1].b, -0.0291, 1e-4, 'b1'); near(r.tau2, 0.0764, 2e-4, 'tau2'); near(r.QM, 16.357, 5e-3, 'QM');
});
test('distributions', () => { near(S.qnorm(.975), 1.959964, 1e-6, 'qnorm'); near(S.qt(.05, 12), 2.178813, 1e-5, 'qt'); near(S.qchisq(.975, 12), 23.33666, 1e-4, 'qchisq'); near(S.pt2(2.178813, 12), .05, 1e-6, 'pt'); });
test('Hedges g with exact J', () => { const e = S.effect({ mean1: 10, sd1: 2, n1: 20, mean0: 9, sd0: 2, n0: 20 }, 'SMD'); near(e.y, 0.49006, 1e-4, 'g'); });
test('zero-cell correction', () => { const e = S.effect({ a: 0, b: 10, c: 2, d: 8 }, 'OR'); assert.ok(e.ok && e.corrected); });
test('GENR from published CI', () => { const e = S.effect({ est: 0.74, lower: 0.61, upper: 0.89 }, 'GENR'); near(e.y, Math.log(.74), 1e-9, 'yi'); near(Math.sqrt(e.v), (Math.log(.89) - Math.log(.61)) / (2 * 1.959964), 1e-5, 'se'); });
test('Knapp–Hartung widens CI', () => { const z = S.pool(es, { method: 'REML' }), k = S.pool(es, { method: 'REML', test: 'knha' }); assert.equal(k.dist, 't'); assert.ok(k.ci[1] - k.ci[0] > z.ci[1] - z.ci[0]); });
test('trim-and-fill runs', () => { const tf = S.trimfill(S.pool(es, { method: 'REML' }), { method: 'REML' }); assert.ok(tf.k0 >= 0 && Number.isFinite(tf.pool.mu)); });
