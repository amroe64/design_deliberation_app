"""Re-score points lost at each step from the exported CSVs, after human coders fix them.

Usage (from the team_session folder):
    python analysis/points_from_findings.py <session>_facts.csv <session>_results.csv  [out.csv]

1. Download "Findings CSV" and "Results CSV" from Admin -> Results.
2. Where the two coders disagree with the app, edit the 0/1 in the findings file's
   spoken / heard / integrated columns (and wrong_features_acted_on in the results file).
3. Run this. It re-applies the gate (a step only counts if the step before it happened)
   and writes points per team, plus averages per deliberation type, using the same
   knapsack code as the app.
"""
import csv
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from server import rules  # noqa: E402

STEPS = ["spoken", "heard", "integrated"]
LOSS = ["lost_not_spoken", "lost_not_heard", "lost_not_integrated", "lost_to_wrong_info", "lost_to_budget_math_or_other"]


def main(facts_csv, results_csv, out_csv=None):
    facts = list(csv.DictReader(open(facts_csv, newline="", encoding="utf-8")))
    results = {r["team"]: r for r in csv.DictReader(open(results_csv, newline="", encoding="utf-8"))}
    by_team = defaultdict(list)
    for f in facts:
        by_team[f["team"]].append(f)
    rows = []
    for team, ff in sorted(by_team.items(), key=lambda x: int(x[0])):
        res = results.get(team)
        if not res:
            continue
        known = {k: [] for k in STEPS}
        for f in ff:
            ok = True
            for k in STEPS:                      # gate: each step needs the one before it
                ok = ok and str(f[k]).strip() == "1"
                if ok:
                    known[k].append(f["feature"])
        fin = res["final_set"].split()
        v_sp, _ = rules.best_with(known["spoken"])
        v_he, _ = rules.best_with(known["heard"])
        v_in, _ = rules.best_with(known["integrated"])
        acted = res.get("wrong_features_acted_on", "").split()
        v_con = rules.best_with(known["integrated"], [f for f in acted if f in fin], [f for f in acted if f not in fin])[0] if acted else v_in
        v_fin = rules.value_of(fin)
        rows.append({"team": team, "condition": res["condition"], "final_set": " ".join(fin), "pts_final": v_fin,
                     "spoken": len(known["spoken"]), "heard": len(known["heard"]), "integrated": len(known["integrated"]),
                     "lost_not_spoken": rules.OPT_V - v_sp, "lost_not_heard": v_sp - v_he, "lost_not_integrated": v_he - v_in,
                     "lost_to_wrong_info": v_in - v_con, "lost_to_budget_math_or_other": v_con - v_fin})
    if out_csv:
        with open(out_csv, "w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, fieldnames=list(rows[0].keys()))
            w.writeheader()
            w.writerows(rows)
    print(f"Best possible {rules.OPT_V} points. Shared table only {rules.NAIVE_V}.\n")
    print(f"{'type':<14}{'teams':>6}" + "".join(f"{k.replace('lost_', ''):>24}" for k in LOSS) + f"{'final':>8}")
    for c in sorted({r["condition"] for r in rows}):
        rs = [r for r in rows if r["condition"] == c]
        avg = lambda k: sum(r[k] for r in rs) / len(rs)
        print(f"{c:<14}{len(rs):>6}" + "".join(f"{avg(k):>24.1f}" for k in LOSS) + f"{avg('pts_final'):>8.1f}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    main(*sys.argv[1:4])
