"""Ultra Paper — publication figures & Markdown report from the "Data CSV" export.

Usage:
    python -m backend.report ultra-paper-analysis-data.csv --method REML --test knha --ratio --out report/
Produces forest_plot.png, funnel_plot.png (300 dpi) and report.md.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402

from . import meta_stats  # noqa: E402

GREEN, CORAL, INK = "#4d8271", "#e79479", "#33433c"


def forest(df: pd.DataFrame, r: meta_stats.MetaResult, ratio: bool, path: Path) -> None:
    k = len(df)
    back = np.exp if ratio else (lambda x: x)
    se = np.sqrt(df.vi.to_numpy())
    fig, ax = plt.subplots(figsize=(9, 0.42 * k + 2.4))
    for i, (y, s) in enumerate(zip(df.yi, se)):
        ax.plot(back(np.array([y - 1.96 * s, y + 1.96 * s])), [k - i] * 2, color=GREEN, lw=1.4)
        ax.scatter(back(y), k - i, marker="s", s=20 + 220 * r.weights_pct[i] / max(r.weights_pct), color=GREEN, zorder=3)
    ax.fill([back(r.ci[0]), back(r.mu), back(r.ci[1]), back(r.mu)], [0, 0.32, 0, -0.32], color=CORAL)
    if r.PI:
        ax.plot(back(np.array(r.PI)), [-0.8, -0.8], color=CORAL, lw=2)
    labels = list(df.study) + [f"Pooled ({r.method})"] + (["Prediction interval"] if r.PI else [])
    ax.set_yticks(list(range(k, 0, -1)) + [0] + ([-0.8] if r.PI else []), labels)
    if ratio:
        ax.set_xscale("log")
    ax.axvline(1 if ratio else 0, color="grey", lw=0.8)
    ax.set_title(f"I² = {r.I2:.1f}%, τ² = {r.tau2:.4f}, p = {r.p:.3g}", fontsize=10, color=INK)
    ax.spines[["top", "right"]].set_visible(False)
    fig.tight_layout()
    fig.savefig(path, dpi=300)
    plt.close(fig)


def funnel(df: pd.DataFrame, r: meta_stats.MetaResult, path: Path) -> None:
    se = np.sqrt(df.vi.to_numpy())
    s = np.linspace(0, se.max() * 1.1, 60)
    fig, ax = plt.subplots(figsize=(6.5, 5.2))
    for z, c in ((2.576, "#cfd9d2"), (1.96, "#dfe7e1"), (1.645, "#eef3ef")):
        ax.fill_betweenx(s, -z * s, z * s, color=c, lw=0)
    ax.plot(r.mu - 1.96 * s, s, "--", color=GREEN, lw=1)
    ax.plot(r.mu + 1.96 * s, s, "--", color=GREEN, lw=1)
    ax.axvline(r.mu, color=CORAL)
    ax.scatter(df.yi, se, color=GREEN, edgecolor="white", zorder=3)
    ax.invert_yaxis()
    ax.set_xlabel("Effect (analysis scale)")
    ax.set_ylabel("Standard error")
    fig.tight_layout()
    fig.savefig(path, dpi=300)
    plt.close(fig)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("csv")
    ap.add_argument("--method", default="REML", choices=meta_stats.METHODS)
    ap.add_argument("--test", default="z", choices=meta_stats.TESTS)
    ap.add_argument("--level", type=float, default=95)
    ap.add_argument("--ratio", action="store_true", help="yi are log ratios (RR/OR/HR)")
    ap.add_argument("--out", default="report")
    a = ap.parse_args()
    df = pd.read_csv(a.csv, encoding="utf-8-sig")
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    r = meta_stats.pool(df.yi, df.vi, a.method, a.test, a.level)
    eg = meta_stats.egger(df.yi, df.vi) if len(df) >= 3 else None
    forest(df, r, a.ratio, out / "forest_plot.png")
    funnel(df, r, out / "funnel_plot.png")
    b = np.exp if a.ratio else (lambda x: x)
    pi_txt = "n/a" if not r.PI else f"[{b(r.PI[0]):.3f}, {b(r.PI[1]):.3f}]"
    eg_txt = "n/a" if not eg else f"intercept {eg['intercept']:.3f}, p = {eg['p']:.3g}"
    md = [f"# Meta-analysis report\n", f"- k = {r.k}; model {r.method}, test {r.test}",
          f"- Pooled effect: **{b(r.mu):.3f}** [{b(r.ci[0]):.3f}, {b(r.ci[1]):.3f}], p = {r.p:.3g}",
          f"- Q = {r.Q:.2f} (p = {r.Qp:.3g}); I² = {r.I2:.1f}%; τ² = {r.tau2:.4f}",
          f"- Prediction interval: {pi_txt}",
          f"- Egger: {eg_txt}",
          "\n![Forest](forest_plot.png)\n\n![Funnel](funnel_plot.png)\n"]
    (out / "report.md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
