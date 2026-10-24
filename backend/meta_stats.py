"""Ultra Paper — independent meta-analysis engine (NumPy/SciPy).

Mirrors js/stats.js so the browser results can be cross-validated:
tau² estimators FE, DL, HE, SJ, PM, ML, REML; inference z / Knapp–Hartung / ad-hoc KH;
Q-profile CI for tau²; Higgins prediction interval; Egger test; leave-one-out.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Sequence

import numpy as np
from scipy import optimize, stats

METHODS = ("FE", "DL", "HE", "SJ", "PM", "ML", "REML")
TESTS = ("z", "knha", "knha-adhoc")


def _wmean(y: np.ndarray, w: np.ndarray) -> float:
    return float(np.sum(w * y) / np.sum(w))


def _gen_q(y: np.ndarray, v: np.ndarray, t: float) -> float:
    w = 1.0 / (v + t)
    m = _wmean(y, w)
    return float(np.sum(w * (y - m) ** 2))


def _root(f, start: float) -> float:
    hi = max(start, 1e-4)
    for _ in range(300):
        if f(hi) <= 0:
            break
        hi *= 2
    return float(optimize.brentq(f, 0.0, hi, xtol=1e-14, rtol=1e-12, maxiter=500))


def tau2(y: Sequence[float], v: Sequence[float], method: str = "REML") -> float:
    y, v = np.asarray(y, float), np.asarray(v, float)
    k = len(y)
    if k < 2 or method == "FE":
        return 0.0
    w = 1 / v
    mu = _wmean(y, w)
    q = float(np.sum(w * (y - mu) ** 2))
    c = w.sum() - np.sum(w ** 2) / w.sum()
    dl = max(0.0, (q - (k - 1)) / c)
    if method == "DL":
        return dl
    ss = float(np.sum((y - y.mean()) ** 2))
    if method == "HE":
        return max(0.0, ss / (k - 1) - v.sum() / k)
    if method == "SJ":
        t0 = ss / k if ss > 0 else 1e-4
        return t0 * _gen_q(y, v, t0) / (k - 1)
    if method == "PM":
        f = lambda t: _gen_q(y, v, t) - (k - 1)
        return 0.0 if f(0) <= 0 else _root(f, dl)

    def score(t: float) -> float:
        ww = 1 / (v + t)
        m = _wmean(y, ww)
        s = float(np.sum(ww ** 2 * (y - m) ** 2) - ww.sum())
        if method == "REML":
            s += float(np.sum(ww ** 2) / ww.sum())
        return s

    if method not in ("ML", "REML"):
        raise ValueError(f"unknown method {method}")
    return 0.0 if score(0) <= 0 else _root(score, dl)


@dataclass
class MetaResult:
    k: int
    method: str
    test: str
    mu: float
    se: float
    ci: list
    p: float
    tau2: float
    tau2_ci: list | None
    Q: float
    Qp: float
    I2: float
    I2_Q: float
    H2: float
    PI: list | None
    weights_pct: list

    def to_dict(self) -> dict:
        """JSON-safe dict (NaN/inf → None)."""
        def clean(x):
            if isinstance(x, (list, tuple)):
                return [clean(i) for i in x]
            if isinstance(x, (float, np.floating)):
                return float(x) if np.isfinite(x) else None
            return x
        return {k: clean(v) for k, v in asdict(self).items()}


def pool(y: Sequence[float], v: Sequence[float], method: str = "REML", test: str = "z", level: float = 95) -> MetaResult:
    y, v = np.asarray(y, float), np.asarray(v, float)
    if method not in METHODS or test not in TESTS:
        raise ValueError("invalid method/test")
    if len(y) == 0 or np.any(v <= 0) or not np.all(np.isfinite(y)):
        raise ValueError("need finite yi and vi > 0")
    k, alpha = len(y), 1 - level / 100
    wf = 1 / v
    mu_fe = _wmean(y, wf)
    q = float(np.sum(wf * (y - mu_fe) ** 2))
    df = k - 1
    qp = float(stats.chi2.sf(q, df)) if k > 1 else float("nan")
    re = method != "FE" and k > 1
    t2 = tau2(y, v, method) if re else 0.0
    w = 1 / (v + t2)
    mu = _wmean(y, w)
    se = float(np.sqrt(1 / w.sum()))
    crit, dist = stats.norm.ppf(1 - alpha / 2), "z"
    if re and test != "z":
        qs = float(np.sum(w * (y - mu) ** 2) / (k - 1))
        se *= np.sqrt(max(1.0, qs) if test == "knha-adhoc" else qs)
        crit, dist = stats.t.ppf(1 - alpha / 2, k - 1), "t"
    z = mu / se
    p = float(2 * (stats.t.sf(abs(z), k - 1) if dist == "t" else stats.norm.sf(abs(z))))
    s2 = (k - 1) * wf.sum() / (wf.sum() ** 2 - np.sum(wf ** 2)) if k > 1 else float("nan")
    i2q = max(0.0, (q - df) / q) * 100 if k > 1 and q > 0 else 0.0
    i2 = 100 * t2 / (t2 + s2) if re else i2q
    h2 = (t2 + s2) / s2 if re else (q / df if k > 1 else float("nan"))
    t_ci = None
    if re:
        q0 = _gen_q(y, v, 0.0)

        def solve(target: float) -> float:
            return 0.0 if q0 < target else _root(lambda t: _gen_q(y, v, t) - target, max(t2, 0.01))

        t_ci = [solve(stats.chi2.ppf(1 - alpha / 2, df)), solve(stats.chi2.ppf(alpha / 2, df))]
    pi = None
    if re and k >= 3:
        b = stats.t.ppf(1 - alpha / 2, k - 2) * np.sqrt(t2 + se ** 2)
        pi = [mu - b, mu + b]
    return MetaResult(k, method if re else "FE", test if re else "z", mu, se, [mu - crit * se, mu + crit * se], p, t2, t_ci,
                      q, qp, i2, i2q, h2, pi, list(100 * w / w.sum()))


def egger(y: Sequence[float], v: Sequence[float]) -> dict:
    y, v = np.asarray(y, float), np.asarray(v, float)
    se = np.sqrt(v)
    r = stats.linregress(1 / se, y / se)
    t = r.intercept / r.intercept_stderr
    return {"intercept": r.intercept, "se": r.intercept_stderr, "t": t, "p": float(2 * stats.t.sf(abs(t), len(y) - 2))}


def leave_one_out(y, v, method="REML", test="z", level=95) -> list[dict]:
    y, v = np.asarray(y, float), np.asarray(v, float)
    out = []
    for i in range(len(y)):
        m = np.arange(len(y)) != i
        r = pool(y[m], v[m], method, test, level)
        out.append({"omitted": i, "mu": r.mu, "ci": r.ci, "I2": r.I2, "tau2": r.tau2})
    return out


def escalc_rr(ai, bi, ci, di) -> tuple[np.ndarray, np.ndarray]:
    """log risk ratio with 0.5 correction for studies with a zero cell (metafor default)."""
    a, b, c, d = (np.asarray(x, float).copy() for x in (ai, bi, ci, di))
    z = (a == 0) | (b == 0) | (c == 0) | (d == 0)
    for arr in (a, b, c, d):
        arr[z] += 0.5
    yi = np.log((a / (a + b)) / (c / (c + d)))
    vi = 1 / a - 1 / (a + b) + 1 / c - 1 / (c + d)
    return yi, vi
