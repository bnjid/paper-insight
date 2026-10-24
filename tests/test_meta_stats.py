"""pytest: backend engine vs published metafor results (dat.bcg)."""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend import meta_stats  # noqa: E402
from backend.extract_pdf import parse_statistics  # noqa: E402

BCG = [(4, 119, 11, 128), (6, 300, 29, 274), (3, 228, 11, 209), (62, 13536, 248, 12619), (33, 5036, 47, 5761), (180, 1361, 372, 1079),
       (8, 2537, 10, 619), (505, 87886, 499, 87892), (29, 7470, 45, 7232), (17, 1699, 65, 1600), (186, 50448, 141, 27197),
       (5, 2493, 3, 2338), (27, 16886, 29, 17825)]
YI, VI = meta_stats.escalc_rr(*zip(*BCG))


def test_reml():
    r = meta_stats.pool(YI, VI, "REML")
    assert abs(r.mu + 0.7145) < 1e-4 and abs(r.se - 0.1798) < 1e-4 and abs(r.tau2 - 0.3132) < 1e-4
    assert abs(r.I2 - 92.22) < 0.01 and abs(r.tau2_ci[1] - 1.1115) < 1e-3


def test_dl_and_fe():
    assert abs(meta_stats.pool(YI, VI, "DL").tau2 - 0.3088) < 1e-4
    assert abs(meta_stats.pool(YI, VI, "FE").mu + 0.4303) < 1e-4


def test_knha_and_json():
    r = meta_stats.pool(YI, VI, "REML", "knha")
    assert r.ci[1] - r.ci[0] > 0.7
    d = meta_stats.pool(YI[:1], VI[:1]).to_dict()
    assert d["Qp"] is None and not any(isinstance(v, float) and math.isnan(v) for v in d.values())


def test_parser():
    s = parse_statistics("adjusted HR 0.74 (95% CI 0.61-0.89); deaths 12/140 (8.6%) vs 25/130 (19.2%)")
    assert any(x["type"] == "ratio" and x["est"] == 0.74 for x in s)
    assert sum(x["type"] == "events" for x in s) == 2
