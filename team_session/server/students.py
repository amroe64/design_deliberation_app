"""Realistic simulated students.

Each simulated student gets a persona when they join. The persona decides how much of their
brief they share, how clearly, whether they believe what teammates say, how fast they work,
and how they answer the surveys. The point is to make test runs look like a real class:
uneven effort, vague or wrong claims, people who never read the brief, and people who run late.

Messages are written to be scored by the same rules as real messages (rules.claims), so a
"vague" mention does NOT count as spoken, and a "wrong way" claim counts as a wrong claim.
"""
from __future__ import annotations

import random

from . import content as C
from . import rules

# share: chance each of my findings makes it into my round-1 message
# clear: chance a shared finding is stated clearly (with direction) instead of vaguely
# wrong: chance a clear claim points the wrong way (misread the result)
# trust_own: chance I use my own result when I pick
# believe: chance I believe a teammate's (or the Mediator's) claim and use it
# speed: how long I take, as a share of the step's target time (min, max)
# late: chance I drift off for a while in a step (runs over time)
PERSONAS = {
    "engaged":  {"w": 25, "share": .92, "clear": .9, "wrong": .03, "trust_own": 1.0, "believe": .85, "speed": (.55, .95), "late": .02, "sat": (4, 5)},
    "average":  {"w": 33, "share": .62, "clear": .6, "wrong": .06, "trust_own": .85, "believe": .6, "speed": (.7, 1.15), "late": .06, "sat": (3, 5)},
    "minimal":  {"w": 15, "share": .3, "clear": .35, "wrong": .05, "trust_own": .5, "believe": .3, "speed": (.3, .7), "late": .04, "sat": (2, 4)},
    "anchored": {"w": 10, "share": .45, "clear": .3, "wrong": .05, "trust_own": .3, "believe": .25, "speed": (.6, 1.0), "late": .05, "sat": (3, 4)},
    "confused": {"w": 9,  "share": .75, "clear": .8, "wrong": .45, "trust_own": .9, "believe": .5, "speed": (.9, 1.4), "late": .1, "sat": (2, 4)},
    "slow":     {"w": 8,  "share": .7, "clear": .7, "wrong": .05, "trust_own": .9, "believe": .65, "speed": (1.1, 1.7), "late": .25, "sat": (3, 4)},
}
PERSONA_LABEL = {"engaged": "Engaged", "average": "Average", "minimal": "Low effort", "anchored": "Trusts the table",
                 "confused": "Misreads results", "slow": "Slow"}


def pick_persona(rng=random):
    keys = list(PERSONAS)
    return rng.choices(keys, weights=[PERSONAS[k]["w"] for k in keys])[0]


# --------------------------------------------------------------------- phrasing
# clear = right direction with a bit of evidence. vague = names it, no direction (does not count).
# wrong = clear claim the wrong way.
SAY = {
    "ME1": {"clear": ["F01 the seal is worth more than the table says. 4/10 unsealed ones broke after a spill, 0 sealed did",
                      "we need the F01 seal, my splash test had 4 of 10 fail without it and none with it"],
            "vague": ["F01 seal maybe?", "i was looking at the seal (F01)"],
            "wrong": ["F01 seal probably isn't worth it, most of mine were fine"]},
    "ME2": {"clear": ["F03 mount matters a lot, 6/10 ordinary mounts drifted in hot/cold and only 1/10 matched ones did",
                      "keep F03, the mount is worth way more than 13. ordinary mounts drifted"],
            "vague": ["the F03 mount thing", "F03 is only $6"],
            "wrong": ["F03 mount isn't needed, the drift was small"]},
    "ME3": {"clear": ["F04 tougher case is not worth it. 0/10 standard cases broke in my drop test, same as reinforced",
                      "skip F04, the standard case held up fine in drop tests"],
            "vague": ["F04 housing idk", "the case (F04) is expensive-ish"],
            "wrong": ["F04 case is important, drop tests matter"]},
    "MF1": {"clear": ["F10 single board is worth more than 22. multi-board had 9 rework units vs 1",
                      "we should keep F10, it's $3 and the single board cut assembly errors a lot"],
            "vague": ["F10 is only $3", "single board F10?"],
            "wrong": ["F10 doesn't matter much honestly"]},
    "MF2": {"clear": ["F12 pre-calibrated is worth more. hand calibration failed 3/60 and took 4 min each, pre-cal 0/60",
                      "need F12, hand calibration is slow and let bad units through"],
            "vague": ["F12 calibration thing", "F12?"],
            "wrong": ["F12 is not worth $15"]},
    "MF3": {"clear": ["F06 second supplier is not worth it, our current supplier was 24/24 on time with spare capacity",
                      "drop F06, we don't need a backup supplier. current one is reliable"],
            "vague": ["F06 supplier is pricey", "not sure about F06"],
            "wrong": ["F06 backup supplier is important"]},
    "HF1": {"clear": ["F05 voice guidance is worth way more than 27. 11/20 older users put the cuff on wrong with printed only, 3/20 with voice",
                      "we need F05, audio instructions fixed most cuff mistakes in my user test"],
            "vague": ["F05 audio could be nice", "the voice thing F05"],
            "wrong": ["F05 audio isn't really needed"]},
    "HF2": {"clear": ["F07 one button is worth more. 8/20 couldn't use the menu without help, 1/20 with one button",
                      "keep F07, it's only $4 and older users needed way less help"],
            "vague": ["F07 one button seems fine", "F07?"],
            "wrong": ["F07 doesn't matter much"]},
    "HF3": {"clear": ["F09 large cuff is not worth it, the 2 standard sizes fit 59 of 60 people",
                      "skip F09, almost nobody needed the large size"],
            "vague": ["F09 large cuff hmm", "the third cuff (F09)"],
            "wrong": ["we need F09, people have different arm sizes"]},
}
OPEN = {
    "engaged": ["Here's what my tests showed.", "ok so from my testing:", "My data says:"],
    "average": ["", "so", "from my brief,", "ok"],
    "minimal": ["", "idk", "lol ok", "honestly"],
    "anchored": ["the table seems pretty reasonable to me.", "i mostly went with the table.", ""],
    "confused": ["I think", "so from my results", ""],
    "slow": ["Sorry, still reading. ", "ok", ""],
}
TAIL = {
    "engaged": ["", "Happy to change if someone has better data."],
    "average": ["", "open to other ideas"],
    "minimal": ["", "whatever works", "im fine w whatever"],
    "anchored": ["went with the highest values per dollar.", "just picked best value for the money"],
    "confused": ["", "not 100% sure tho"],
    "slow": ["", "sorry if this is late"],
}


def _casual(s, persona, rng):
    if persona in ("minimal", "average") and rng.random() < .5:
        s = s[0].lower() + s[1:] if s else s
    if persona == "minimal" and rng.random() < .3:
        s = s.replace("you", "u").replace("because", "bc")
    return s


def _fit(parts, limit):
    out = ""
    for p in parts:
        p = p.strip()
        if not p:
            continue
        nxt = (out + (" " if out else "") + p).strip()
        if len(nxt) > limit:
            break
        out = nxt
    return out


# --------------------------------------------------------------------- beliefs
FEAT = {f["id"]: f for f in C.FEATURES}


def believed_values(T, r, R, rounds):
    """What this student thinks each feature is worth right now."""
    sim = R["sim"]
    P = PERSONAS[sim["persona"]]
    vals = {i: FEAT[i]["shared"] for i in FEAT}
    for fid, d in sim.get("heard", {}).items():
        vals[fid] = FEAT[fid]["shared"] + 45 if d > 0 else 3
    for fc in C.FACTS:
        if fc["role"] != r or not sim["use_own"].get(fc["id"]):
            continue
        d = -fc["dir"] if sim["misread"].get(fc["id"]) else fc["dir"]
        vals[fc["f"]] = rules.true_val(fc["f"]) if d == fc["dir"] else (FEAT[fc["f"]]["shared"] + 45 if d > 0 else 3)
    if sim["persona"] == "minimal":   # sloppy: doesn't really compare
        vals = {i: v * sim["noise"][i] for i, v in vals.items()}
    return vals


def best_pick(vals):
    best, bv = [], float("-inf")
    for s_ in rules.FEASIBLE:
        v = sum(vals[i] for i in s_)
        if v > bv:
            best, bv = s_, v
    return sorted(best)


def listen(T, r, R, rounds, rng):
    """Read what's on my screen and decide, once per claim, whether I believe it."""
    sim = R["sim"]
    P = PERSONAS[sim["persona"]]
    seen = sim.setdefault("judged", {})
    heard = sim.setdefault("heard", {})
    for e in rules.visible_items(T, r, rounds):
        if e.get("who") == r or e["kind"] not in ("message", "draft", "recap", "question", "final"):
            continue
        for fid, d in rules.claims(e.get("text") or ""):
            k = f"{fid}{d}"
            if k in seen:
                continue
            p = P["believe"] + (.1 if e["kind"] in ("draft", "recap") else 0)
            seen[k] = rng.random() < p
            if seen[k]:
                heard[fid] = d


def setup(R, r, persona=None, rng=random):
    persona = persona or pick_persona(rng)
    P = PERSONAS[persona]
    mine = [fc for fc in C.FACTS if fc["role"] == r]
    R["sim"] = {
        "persona": persona,
        "use_own": {fc["id"]: rng.random() < P["trust_own"] for fc in mine},
        "misread": {fc["id"]: rng.random() < P["wrong"] for fc in mine},
        "noise": {i: rng.uniform(.75, 1.25) for i in FEAT},
        "said": [],
    }
    return R["sim"]


# --------------------------------------------------------------------- writing
def first_message(T, r, R, rng):
    sim, persona = R["sim"], R["sim"]["persona"]
    P = PERSONAS[persona]
    parts = [rng.choice(OPEN[persona])]
    mine = [fc for fc in C.FACTS if fc["role"] == r]
    rng.shuffle(mine)
    for fc in mine:
        if rng.random() > P["share"]:
            continue
        if sim["misread"].get(fc["id"]):
            how = "wrong"
        elif rng.random() < P["clear"]:
            how = "clear"
        else:
            how = "vague"
        parts.append(_casual(rng.choice(SAY[fc["id"]][how]) + ".", persona, rng))
        sim["said"].append(fc["id"])
    if len(parts) == 1:
        parts.append(rng.choice(["i picked what looked like the best value.", "went with the table mostly.", "not much to add from my brief."]))
    parts.append(rng.choice(TAIL[persona]))
    return _fit(parts, C.MSG_MAX)


def later_message(T, r, R, n, picks, rng, draft_set=None):
    """Round 2+: react to what I heard, push anything I still think is missing."""
    sim, persona = R["sim"], R["sim"]["persona"]
    P = PERSONAS[persona]
    parts = []
    heard = sim.get("heard", {})
    before = set(sim.get("last_picks") or [])
    took = [f for f, d in heard.items() if (d > 0 and f in picks and f not in before) or (d < 0 and f not in picks and f in before)]
    if took and persona != "minimal":
        parts.append(_casual(rng.choice(["ok, after reading the others", "ok that makes sense", "good points", "after the recap"]) +
                     f" i changed my picks for {', '.join(sorted(took)[:3])}.", persona, rng))
    if draft_set is not None:
        add = [f for f in picks if f not in draft_set]
        drop = [f for f in draft_set if f not in picks]
        if not add and not drop:
            parts.append(rng.choice(["The draft looks good to me.", "draft is fine", "agree with the draft"]))
        else:
            if add:
                parts.append(f"I'd add {', '.join(add[:2])}" + (" because it matters more than the table says." if persona == "engaged" else "."))
            if drop:
                vals = believed_values(T, r, R, None)
                low = [f for f in drop if vals[f] < FEAT[f]["shared"] * .5]      # only say "not worth it" if I believe it
                rest = [f for f in drop if f not in low]
                if low:
                    parts.append(f"I'd drop {', '.join(low[:2])}, not worth it.")
                if rest:
                    parts.append(f"I'd swap out {', '.join(rest[:2])} to stay in budget.")
    # repeat one finding the team hasn't picked up yet (engaged / slow mostly)
    mine = [fc for fc in C.FACTS if fc["role"] == r and sim["use_own"].get(fc["id"]) and not sim["misread"].get(fc["id"])]
    missing = [fc for fc in mine if fc["f"] not in heard]
    if missing and rng.random() < {"engaged": .8, "slow": .5, "average": .4}.get(persona, .15):
        fc = rng.choice(missing)
        parts.append(_casual(rng.choice(SAY[fc["id"]]["clear"] if fc["id"] in sim["said"] or rng.random() < P["clear"] else SAY[fc["id"]]["vague"]) + ".", persona, rng))
        sim["said"].append(fc["id"])
    if not parts:
        parts.append(rng.choice(["im good with this", "no changes from me", "same picks as before", "sounds good"]))
    return _fit(parts, C.MSG_MAX)


# --------------------------------------------------------------------- timing
def step_due(R, step, timers, sim_speed, rng):
    """Seconds after the step starts when I will act, at the chosen simulation speed."""
    P = PERSONAS[R["sim"]["persona"]]
    t = {"card": timers.get("card", 5), "final": timers.get("final", 1), "survey": timers.get("survey", 4)}
    if step.startswith("post"):
        mins = timers.get("round1", 6) if step == "post1" else timers.get("round", 5)
    else:
        mins = t.get(step, 1)
    f = rng.uniform(*P["speed"])
    if rng.random() < P["late"]:
        f *= rng.uniform(1.4, 2.2)
    return max(1.0, mins * 60 * f / max(sim_speed, 0.1))
