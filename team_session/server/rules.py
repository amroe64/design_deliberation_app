"""Pure task logic: feature parsing, the stand-in mediator rules, majority vote,
scoring, and the spoken -> heard -> integrated -> actioned fact funnel.

No state lives here. Everything takes plain dicts/lists so it is easy to test.
"""
import re
from . import content as C

BUDGET = C.BUDGET
FEAT = {f["id"]: f for f in C.FEATURES}
FIDS = [f["id"] for f in C.FEATURES]
FACT = {x["id"]: x for x in C.FACTS}
GEMS = [x["f"] for x in C.FACTS if x["dir"] > 0]
DECOYS = [x["f"] for x in C.FACTS if x["dir"] < 0]


def cost(ids):
    return sum(FEAT[i]["price"] for i in ids)


def sort_ids(ids):
    return sorted(set(ids))


# All 4,096 bundles, kept in the same order as the browser prototype so ties break the same way.
_ALL = [[FIDS[i] for i in range(12) if m >> i & 1] for m in range(1 << 12)]
FEASIBLE = [s for s in _ALL if cost(s) <= BUDGET]


def best_set(valfn):
    vals = {i: valfn(i) for i in FIDS}
    best, bv = [], float("-inf")
    for s in FEASIBLE:
        v = sum(vals[i] for i in s)
        if v > bv:
            best, bv = s, v
    return best, bv


def true_val(i):
    return C.TRUE_VAL.get(i, FEAT[i]["shared"])


def value_of(s):
    return sum(true_val(i) for i in s)


OPT_SET, OPT_V = best_set(true_val)
NAIVE_SET, _ = best_set(lambda i: FEAT[i]["shared"])
NAIVE_V = value_of(NAIVE_SET)


def pooling_index(s):
    return (value_of(s) - NAIVE_V) / (OPT_V - NAIVE_V)


# ---------------------------------------------------------------- parsing
DOWN = re.compile(r"(didn'?t (pick|choose|include|take)|did not (pick|choose|include)|won'?t (pick|choose)|not (picking|choosing|including)|leaving (it |that )?out|left (it |that )?out|worth less|less than|overrat|don'?t (really )?(think we )?need|do not need|not worth|not (really )?(needed|necessary|important|useful)|no need|skip|\bdrop\b(?!\s*(test|tests|testing))|can go|waste|probably not|"
                  r"isn'?t (really )?(needed|worth|necessary|important)|leave (it )?out|remove|cut (it|that|this|f ?\d)|pointless|useless|unnecessary|overkill|"
                  r"(barely|hardly|nobody|no one|almost no one|few people) (\w+ )?(need|use|want)|doesn'?t (really )?(matter|help|change)|didn'?t (matter|help|change))")
UP = re.compile(r"(worth more|more than|undervalu|important|need|keep|must|help|matter|valuable|cheap|stays|add|want|huge|big deal|crucial|essential|critical|worth it|"
                r"game ?changer|(cut|cuts|reduced?|fewer|less|lower(ed)?) (\w+ )?(mistakes|errors|failures|fails|rework|problems|drift))")


def find_features(s):
    s = (s or "").lower()
    ids = set()
    for m in re.finditer(r"\bf ?0?(\d{1,2})\b", s):
        n = int(m.group(1))
        if 1 <= n <= 12:
            ids.add(f"F{n:02d}")
    for role, d in re.findall(r"\[(me|mf|hf)(\d)\]", s):
        fc = FACT.get(f"{role.upper()}{d}")
        if fc:
            ids.add(fc["f"])
    for f in C.FEATURES:
        if any(k in s for k in f["kw"]):
            ids.add(f["id"])
    return sorted(ids)


def mentions(text, fid):
    return fid in find_features(text)


def fact_tags(text):
    return [t.upper() for t in re.findall(r"\[((?:ME|MF|HF)\d)\]", text or "", flags=re.I)]


def analyze(msgs):
    up, down, mention, picks = {}, {}, {}, {}
    for m in msgs:
        for sent in re.split(r"[.!?\n;]+", m.get("text") or ""):
            s = sent.lower()
            ids = find_features(s)
            if not ids:
                continue
            dn = bool(DOWN.search(s))
            u = (not dn) and bool(UP.search(s))
            b = down if dn else up if u else mention
            for i in ids:
                b[i] = b.get(i, 0) + 1
        for i in m.get("set") or []:
            picks[i] = picks.get(i, 0) + 1
    return up, down, mention, picks


def posts(log, rnd=None):
    return [e for e in log if e["kind"] == "message" and (rnd is None or e["round"] == rnd)]


# ---------------------------------------------------------------- stand-in mediator
def synthesize(log, drafts, kind):
    up, down, mention, picks = analyze(posts(log))

    def belief(i):
        sh, u, d = FEAT[i]["shared"], up.get(i, 0), down.get(i, 0)
        v = sh
        if d > u:
            v = sh * 0.15
        elif u > d:
            v = sh * (1 + 1.5 * min(u - d, 2))
        return v + 2 * picks.get(i, 0) + (1 if mention.get(i) else 0)

    s, _ = best_set(belief)
    s = sort_ids(s)
    heard_up = [i for i in FIDS if up.get(i, 0) > down.get(i, 0)]
    heard_down = [i for i in FIDS if down.get(i, 0) > up.get(i, 0)]
    t = ""
    if kind == "caucus2" and drafts:
        prev = drafts[-1]["set"]
        added = [x for x in s if x not in prev]
        removed = [x for x in prev if x not in s]
        if added or removed:
            parts = []
            if added:
                parts.append("added " + ", ".join(added))
            if removed:
                parts.append("removed " + ", ".join(removed))
            t += "Changes from the last draft: " + "; ".join(parts) + ".\n\n"
        else:
            t += "No changes from the last draft. Nobody asked for a change that fits the budget.\n\n"
    if heard_up or heard_down:
        t += "What the team knows:\n"
        for i in heard_up:
            t += f"• {i} {FEAT[i]['name']} is worth more than the table shows.\n"
        for i in heard_down:
            t += f"• {i} {FEAT[i]['name']} is worth less than the table shows.\n"
        t += "\n"
    out = [i for i in FIDS if i not in s]
    od = [i for i in out if i in heard_down]
    ob = [i for i in out if i in heard_up]
    if od:
        t += f"Left out {', '.join(od)}, since they seem worth less than the table shows.\n"
    if ob:
        t += f"Left out {', '.join(ob)}, since {'it' if len(ob) == 1 else 'they'} didn't fit the budget.\n"
    return {"text": t.strip() or "Based on what was shared, here is the best set I can find within $57.", "set": s}


def facilitator_question(log, rnd):
    if rnd == 1:
        return "What did your own testing show that the shared table gets wrong? Please name the features."
    said = set()
    for m in posts(log):
        said.update(find_features(m["text"]))
    quiet = [i for i in FIDS if i not in said]
    q = ""
    if quiet:
        q += f"Nobody has talked about {', '.join(quiet)} yet. Does anyone know anything about {'them' if len(quiet) > 1 else 'it'}? "
    q += "If the team had to drop one feature to stay under $57, which would you drop, and why?"
    return q


def neutral_recap(log, rnd, active_roles):
    lines = []
    for r in active_roles:
        m = next((e for e in posts(log, rnd) if e["who"] == r), None)
        if not m:
            continue
        up, down, _, _ = analyze([{"text": m["text"]}])
        u, d = sorted(up), sorted(down)
        parts = []
        if u:
            parts.append(f"says {', '.join(u)} {'are' if len(u) > 1 else 'is'} worth more")
        if d:
            parts.append(f"says {', '.join(d)} {'are' if len(d) > 1 else 'is'} worth less")
        lines.append(f"• {C.ROLES[r]['short']}: {'; '.join(parts) if parts else 'shared a view without naming features'}. "
                     f"Picks {', '.join(m['set']) or 'none'} (${cost(m['set'])}).")
    return "\n".join(lines)


def majority_set(log, rounds, n_active):
    """Features at least 2 of 3 picked in the last round. Over budget -> drop the lowest
    table value per dollar until it fits. (Prototype rule: match domain.majority_bundle.)"""
    need = min(2, n_active)
    count = {}
    for m in posts(log, rounds):
        for i in m["set"]:
            count[i] = count.get(i, 0) + 1
    s = sort_ids([i for i, c in count.items() if c >= need])
    while cost(s) > BUDGET:
        worst = sorted(s, key=lambda i: FEAT[i]["shared"] / FEAT[i]["price"])[0]
        s = [x for x in s if x != worst]
    return s


# ---------------------------------------------------------------- views + scoring
def visible_items(T, r, rounds):
    """What a role can see in its chat: own messages, teammates' messages from closed rounds
    (shared conditions only), and Mediator / vote cards."""
    R = T["roles"][r]
    shared = C.COND[T["cond"]]["shared"]
    step = R["step"]
    if step in ("final", "survey", "done"):
        closed = rounds
    else:
        m = re.search(r"\d+", step)
        closed = max(0, (int(m.group()) if m else 0) - 1)
    out = []
    for e in T["log"]:
        if e["kind"] == "message":
            if e["who"] == r or (shared and e["round"] <= closed):
                out.append(e)
        elif e["kind"] in ("question", "recap", "draft") or (e["kind"] == "final" and C.COND[T["cond"]]["final"] == "majority"):
            out.append(e)
    return out


def recall_items(T, r):
    items = [{"id": fc["id"], "text": f"{fc['f']} {FEAT[fc['f']]['name']} is worth {'more' if fc['dir'] > 0 else 'less'} than the table shows", "decoy": False}
             for fc in C.FACTS if fc["role"] != r and T["roles"].get(fc["role"])]
    items += [{**d, "decoy": True} for d in C.DECOYS_RECALL]
    return sorted(items, key=lambda x: x["id"] + r, reverse=(r == "MF"))


TRUE_DIR = {x["f"]: x["dir"] for x in C.FACTS}     # +1 = really worth more, -1 = really worth less


def _dir(s):
    if DOWN.search(s):
        return -1
    return 1 if UP.search(s) else 0


def claims(text):
    """(feature, direction) pairs stated in a text. Direction comes from the same sentence:
    +1 = 'worth more / keep / need ...', -1 = 'worth less / drop / don't need ...'.
    A bare mention with no direction is NOT a claim.
    When a sentence names more than one feature, it is split at commas / and / but / while,
    and each feature takes the direction of its own part ("F05 is worth more, skip F04").
    A short part that only lists features ("keep F01 and F03") takes the direction just before it."""
    out = []
    for sent in re.split(r"[.!?\n;]+", text or ""):
        s = sent.lower()
        ids = find_features(s)
        if not ids:
            continue
        if len(ids) == 1:
            d = _dir(s)
            if d:
                out.append((next(iter(ids)), d))
            continue
        pending, pending_list, last = set(), set(), 0
        for c in re.split(r",|\bbut\b|\band\b|\bwhile\b|\bwhereas\b|\bplus\b|\bthen\b", s):
            cid, d = find_features(c), _dir(c)
            if cid and d:
                out += [(i, d) for i in sorted(set(cid) | pending_list)]
                pending, pending_list, last = set(), set(), d
            elif cid and not d:
                if last and len(c.split()) <= 4:
                    out += [(i, last) for i in sorted(cid)]
                elif not re.sub(r"\bf ?0?\d{1,2}\b|\b(the|both|also|too|or|and|plus)\b|[^a-z0-9]", "", c):
                    pending_list |= set(cid)      # a bare list ("F03 and F10 matter") takes the direction that follows
                else:
                    pending = cid
            elif d and pending:
                out += [(i, d) for i in sorted(pending)]
                pending, last = set(), d
            elif d:
                last = d
    seen, res = set(), []
    for x in out:
        if x not in seen:
            seen.add(x); res.append(x)
    return res


def states(text, fid, d):
    return (fid, d) in claims(text)


INF = float("inf")


def fact_funnel(T, session_id, pid_of):
    """Each private finding through the plan's four steps. Each step only counts if the step
    before it happened (so counts can only go down from Spoken to Actioned).

      Spoken      its owner states it WITH the right direction (to the team or the Mediator)
      Heard       a message or Mediator card that states it correctly was on a teammate's
                  screen 2+ s (caucus: only Mediator cards count, the owner's chat is private)
      Integrated  after hearing it, a teammate states it correctly, or a teammate's picks move
                  its way (gem added / decoy dropped), or a Mediator draft or recap states it
      Actioned    the final set follows it (gem kept in, decoy left out)
    Extra columns that do not gate: mentioned (any mention), relayed_by_ai, recalled
    (a teammate ticked it in the survey), heard_and_recalled, final_follows (ignores the gate)."""
    fin = T.get("final")
    log = T["log"]
    msgs = [e for e in log if e["kind"] == "message"]
    ai = [e for e in log if e["kind"] in ("draft", "question", "recap")]
    active = [r for r in C.ROLE_KEYS if T["roles"].get(r)]
    seen_at = {}
    for e in log:
        if e["kind"] == "seen":
            seen_at.setdefault((e["msg"], e["who"]), e["seq"])
    rows = []
    for fc in C.FACTS:
        owner, f, d = fc["role"], fc["f"], fc["dir"]
        if not T["roles"].get(owner):
            continue
        mentioned = any(m["who"] == owner and mentions(m["text"], f) for m in msgs)
        said = [m for m in msgs if m["who"] == owner and states(m["text"], f, d)]
        spoken = bool(said)
        first = said[0]["seq"] if said else INF
        ai_rel = [a for a in ai if a["seq"] > first and states(a["text"], f, d)]
        carriers = [m for m in said if not m.get("private")] + ai_rel
        heard_by = {}
        for c in carriers:
            for r in active:
                if r != owner and (c["id"], r) in seen_at:
                    heard_by[r] = min(heard_by.get(r, INF), seen_at[(c["id"], r)])
        heard = spoken and bool(heard_by)
        integrated = False
        if heard:
            if any(a["kind"] in ("draft", "recap") for a in ai_rel):
                integrated = True
            for r, ts in heard_by.items():
                mine = [m for m in msgs if m["who"] == r]
                if any(m["seq"] > ts and states(m["text"], f, d) for m in mine):
                    integrated = True
                before = [m for m in mine if m["seq"] < ts]
                after = [m for m in mine if m["seq"] > ts]
                if after:
                    prev, nxt = (before[-1]["set"] if before else []), after[0]["set"]
                    if (d > 0 and f in nxt and f not in prev) or (d < 0 and f in prev and f not in nxt):
                        integrated = True
        follows = None if fin is None else (f in fin if d > 0 else f not in fin)
        recalled = any(fc["id"] in T["roles"][x].get("recall", []) for x in active if x != owner)
        rows.append({"session": session_id, "team": T["id"], "condition": T["cond"], "fact": fc["id"], "role": owner,
                     "owner_pid": pid_of(T, owner), "feature": f, "direction": "more" if d > 0 else "less",
                     "mentioned": int(mentioned), "spoken": int(spoken), "disclosed_to_mediator": int(any(m.get("private") for m in said)),
                     "relayed_by_ai": int(bool(ai_rel)), "heard": int(heard), "recalled": int(recalled),
                     "heard_and_recalled": int(heard and recalled), "integrated": int(integrated),
                     "actioned": "" if fin is None else int(integrated and follows),
                     "final_follows": "" if fin is None else int(follows)})
    return rows


def best_with(known_features, must_in=(), must_out=()):
    """True value of the best set a team would pick if it knew the true value of
    `known_features` and believed the shared table for everything else."""
    known = set(known_features)
    vals = {i: (true_val(i) if i in known else FEAT[i]["shared"]) for i in FIDS}
    best, bv = [], float("-inf")
    for s_ in FEASIBLE:
        if any(i not in s_ for i in must_in) or any(i in s_ for i in must_out):
            continue
        v = sum(vals[i] for i in s_)
        if v > bv:
            best, bv = s_, v
    return value_of(best), best


def wrong_claims(T):
    """Claims people made that point the WRONG way on a tested feature
    (a 'worth more' feature called worth less, or the reverse)."""
    out = []
    for m in T["log"]:
        if m["kind"] != "message":
            continue
        for f, d in claims(m["text"]):
            if f in TRUE_DIR and d != TRUE_DIR[f]:
                out.append({"msg": m["id"], "who": m["who"], "feature": f, "claimed": "more" if d > 0 else "less"})
    return out


def points(T, funnel=None):
    """The plan's points method. Start from the best possible answer (448). At each step, find
    the best answer using only the findings that made it that far; the drop is what that step
    lost. 'Lost at the final pick' = best answer with the info the team had (after Integrated)
    minus its real final set; it is split into wrong info acted on, and budget math / other."""
    fin = T.get("final")
    ff = funnel if funnel is not None else fact_funnel(T, "", lambda *_: "")
    feats = lambda k: [FACT[r["fact"]]["f"] for r in ff if r[k] == 1]
    v_all = OPT_V
    v_sp, _ = best_with(feats("spoken"))
    v_he, _ = best_with(feats("heard"))
    v_in, _ = best_with(feats("integrated"))
    out = {"pts_start_shared_only": NAIVE_V, "pts_best_possible": v_all, "pts_best_after_spoken": v_sp,
           "pts_best_after_heard": v_he, "pts_best_after_integrated": v_in,
           "lost_not_spoken": v_all - v_sp, "lost_not_heard": v_sp - v_he, "lost_not_integrated": v_he - v_in}
    if fin is None:
        return out
    v_fin = value_of(fin)
    wrong = wrong_claims(T)
    acted = sorted({w["feature"] for w in wrong
                    if (w["claimed"] == "less" and w["feature"] not in fin) or (w["claimed"] == "more" and w["feature"] in fin)})
    must_in = [f for f in acted if f in fin]
    must_out = [f for f in acted if f not in fin]
    v_con, _ = best_with(feats("integrated"), must_in, must_out) if acted else (v_in, None)
    out.update({"pts_final": v_fin, "lost_at_final_pick": v_in - v_fin,
                "wrong_claims": len(wrong), "wrong_claims_acted_on": len(acted), "wrong_features_acted_on": " ".join(acted),
                "lost_to_wrong_info": v_in - v_con, "lost_to_budget_math_or_other": v_con - v_fin})
    return out


def team_result(T, session_id, pid_of):
    if T.get("final") is None:
        return None
    fin = T["final"]
    v = value_of(fin)
    ff = fact_funnel(T, session_id, pid_of)
    active = [r for r in C.ROLE_KEYS if T["roles"].get(r)]
    s = lambda k: sum(int(x[k] or 0) for x in ff)
    leak = [T["roles"][r].get("sv", {}).get("leak") for r in active]
    return {"session": session_id, "team": T["id"], "pids": " ".join(pid_of(T, r) for r in active), "condition": T["cond"],
            "spare": int(bool(T.get("spare"))), "consent": int(not T.get("nonconsent")), "final_set": " ".join(fin),
            "cost": cost(fin), "true_value": v, "pct_best": round(v / OPT_V * 100), "pooling_index": round(pooling_index(fin), 3),
            "gems": sum(1 for i in GEMS if i in fin), "decoys": sum(1 for i in DECOYS if i in fin),
            "facts": len(ff), "mentioned": s("mentioned"), "spoken": s("spoken"), "heard": s("heard"), "heard_and_recalled": s("heard_and_recalled"),
            "integrated": s("integrated"), "actioned": s("actioned"),
            **points(T, ff),
            "accepts": sum(1 for r in active if T["roles"][r].get("endorse") is True),
            "talked_outside_app": int(any(x in ("A little", "A lot") for x in leak)),
            "closed_by_researcher": int(any(e.get("closed_by_researcher") for e in T["log"]))}


def coding_rows(T, session_id, pid_of):
    """One row per message or Mediator card, for two human coders to check the app's codes."""
    rows = []
    for e in T["log"]:
        if e["kind"] not in ("message", "draft", "recap", "question"):
            continue
        cl = claims(e["text"])
        rows.append({"session": session_id, "team": T["id"], "condition": T["cond"], "item_id": e["id"], "round": e["round"],
                     "who": e["who"], "pid": pid_of(T, e["who"]) if e["who"] in C.ROLES else "", "kind": e["kind"],
                     "channel": "private" if e.get("private") or (e["kind"] != "message" and not C.COND[T["cond"]]["shared"]) else "team",
                     "text": e["text"],
                     "app_claims": "; ".join(f"{f} {'more' if d > 0 else 'less'}" for f, d in cl),
                     "app_findings_stated_correctly": " ".join(fc["id"] for fc in C.FACTS if (fc["f"], fc["dir"]) in cl),
                     "app_wrong_claims": " ".join(f"{f} {'more' if d > 0 else 'less'}" for f, d in cl if f in TRUE_DIR and d != TRUE_DIR[f]),
                     "coder1_claims": "", "coder1_findings": "", "coder2_claims": "", "coder2_findings": "", "notes": ""})
    return rows


def best_single_engineer():
    """Best score any ONE engineer could reach alone (knowing only their own findings)."""
    return max(best_with([fc["f"] for fc in C.FACTS if fc["role"] == r])[0] for r in C.ROLE_KEYS)


SINGLE_V = best_single_engineer()
