"""Task content: the same values and wording as the 10/21 pilot kit.

Everything a student may see is here, except that each student is only ever
sent THEIR OWN private facts (see game.Game.student_view).
"""

BUDGET = 57

FEATURES = [
    {"id": "F01", "name": "IP54 gasket seal", "price": 13, "shared": 21, "plain": "A rubber seal that keeps dust and splashes out of the case.", "kw": ["gasket", "seal", "ip54", "splash"]},
    {"id": "F02", "name": "Automated optical inspection", "price": 16, "shared": 29, "plain": "A factory camera that checks every circuit board for defects.", "kw": ["optical inspection", "inspection", "camera"]},
    {"id": "F03", "name": "CTE-matched optics mount", "price": 6, "shared": 13, "plain": "A holder that keeps the oxygen sensor lined up when it gets hot or cold.", "kw": ["mount", "cte", "optics"]},
    {"id": "F04", "name": "Reinforced ABS/PC housing", "price": 8, "shared": 61, "plain": "A tougher, thicker plastic case.", "kw": ["housing", "tough case", "tougher case", "reinforced", "abs"]},
    {"id": "F05", "name": "Audio-guided cuff instructions", "price": 13, "shared": 27, "plain": "A recorded voice that talks the user through putting the cuff on.", "kw": ["audio", "voice"]},
    {"id": "F06", "name": "Second transducer supplier", "price": 13, "shared": 77, "plain": "A backup company to buy the pressure sensor from.", "kw": ["supplier", "transducer", "second source", "backup company"]},
    {"id": "F07", "name": "One-button measurement", "price": 4, "shared": 15, "plain": "A full reading starts and finishes with one button press.", "kw": ["one-button", "one button", "single button", "button"]},
    {"id": "F08", "name": "Tactile cuff alignment marks", "price": 10, "shared": 52, "plain": "Raised bumps on the cuff that show where it lines up on the arm.", "kw": ["tactile", "alignment", "bumps", "marks"]},
    {"id": "F09", "name": "Third cuff size (large)", "price": 17, "shared": 45, "plain": "An extra, larger cuff for people with bigger arms.", "kw": ["large cuff", "third cuff", "bigger cuff", "cuff size", "larger cuff"]},
    {"id": "F10", "name": "Single-PCB layout", "price": 3, "shared": 22, "plain": "All the electronics on one circuit board instead of several.", "kw": ["single-pcb", "single pcb", "single board", "one board", "pcb"]},
    {"id": "F11", "name": "Conformal-coated board", "price": 8, "shared": 21, "plain": "A thin coating over the circuit board that guards against moisture.", "kw": ["conformal", "coating", "coated"]},
    {"id": "F12", "name": "Pre-calibrated sensor module", "price": 15, "shared": 15, "plain": "A sensor that arrives already adjusted, so the factory skips that step.", "kw": ["pre-calibrated", "precalibrated", "calibrat"]},
]

# Researcher only. Never sent to students.
TRUE_VAL = {"F01": 62, "F03": 73, "F04": 0, "F10": 83, "F12": 55, "F06": 5, "F05": 90, "F07": 67, "F09": 9}

ROLES = {
    "ME": {"name": "Mechanical Engineer", "short": "Mechanical", "goal": "You care most about whether the parts hold up and keep readings accurate.",
           "intro": "You look after the physical parts of the monitor: the case, the seals, and the mounts that hold parts in place."},
    "MF": {"name": "Manufacturing Engineer", "short": "Manufacturing", "goal": "You care most about how easy this is to build right, every time.",
           "intro": "You look after how the monitor is built: the circuit boards, the assembly line, and the suppliers."},
    "HF": {"name": "Human Factors Engineer", "short": "Human Factors", "goal": "You care most about whether real people can use it correctly.",
           "intro": "You look after how real people use the monitor: the instructions, the buttons, and how it fits."},
}
ROLE_KEYS = ["ME", "MF", "HF"]

# Private facts. IDs ME1-3 / MF1-3 / HF1-3 (the spec's "F1" would clash with F01-F12).
FACTS = [
    {"id": "ME1", "raw": "Splash test: you spilled a cup of water on 10 prototypes without the seal and 10 with it. 4 of the 10 without the seal stopped working or gave wrong readings. 0 of the 10 with the seal did.", "role": "ME", "f": "F01", "dir": 1, "head": "Your splash testing suggests this is worth more than the table shows.", "detail": "Several unsealed prototypes had problems after ordinary kitchen and bathroom spills."},
    {"id": "ME2", "raw": "Hot-and-cold test (20 cycles between 5°C and 35°C): 6 of 10 prototypes with the ordinary mount drifted more than 5 mmHg from the reference device. 1 of 10 with the matched mount did.", "role": "ME", "f": "F03", "dir": 1, "head": "Your hot-and-cold testing suggests the table undervalues this.", "detail": "Prototypes with ordinary mounts sometimes drifted and gave readings that did not match the reference device."},
    {"id": "ME3", "raw": "Drop test (10 drops from 1 m onto tile): 0 of 10 standard cases cracked or stopped working. 0 of 10 reinforced cases did.", "role": "ME", "f": "F04", "dir": -1, "head": "Your drop testing suggests this may be worth less than the table shows.", "detail": "The standard case held up in your household drop tests."},
    {"id": "MF1", "raw": "Trial build of 50 units each: 9 multi-board units had connector errors and needed rework. 1 single-board unit did.", "role": "MF", "f": "F10", "dir": 1, "head": "Your trial builds suggest this is worth more than the table shows.", "detail": "The multi-board batch had more assembly errors at the connectors and more units needing rework."},
    {"id": "MF2", "raw": "Line trial of 60 units each: hand calibration took about 4 minutes per unit and 3 of 60 failed the final accuracy check. Pre-calibrated modules took under 1 minute and 0 of 60 failed.", "role": "MF", "f": "F12", "dir": 1, "head": "Your line calibration trial suggests this may be worth more than the table shows.", "detail": "Hand calibration slowed the line and sometimes let a poorly calibrated unit through."},
    {"id": "MF3", "raw": "Supplier review: your current transducer supplier delivered 24 of its last 24 orders on time, had a 0.2% defect rate, and has about 40% spare capacity.", "role": "MF", "f": "F06", "dir": -1, "head": "Your supplier review suggests this may be worth less than the table shows.", "detail": "The current supplier has a good delivery and quality record and has spare capacity."},
    {"id": "HF1", "raw": "User test with 20 adults over 65: with printed instructions only, 11 of 20 put the cuff on wrong. With voice guidance, 3 of 20 did.", "role": "HF", "f": "F05", "dir": 1, "head": "Your user testing suggests the table undervalues this.", "detail": "Many participants put the cuff on incorrectly with printed instructions alone; with voice guidance, most got it right."},
    {"id": "HF2", "raw": "User test with 20 adults over 65: with the multi-step menu, 8 of 20 could not take a reading without help. With one button, 1 of 20 needed help.", "role": "HF", "f": "F07", "dir": 1, "head": "Your user testing suggests this is worth more than the table shows.", "detail": "Some older participants struggled with multi-step menus but managed with a single button."},
    {"id": "HF3", "raw": "Fit test with 60 adults: the two standard cuff sizes fit 59 of 60 people. 1 person needed the large size.", "role": "HF", "f": "F09", "dir": -1, "head": "Your fit testing suggests this may be worth less than the table shows.", "detail": "The two standard cuff sizes fit most of the people you tested."},
]

DECOYS_RECALL = [
    {"id": "D1", "text": "F02 Automated optical inspection is worth more than the table shows"},
    {"id": "D2", "text": "F11 Conformal-coated board is worth less than the table shows"},
    {"id": "D3", "text": "F08 Tactile cuff alignment marks is worth less than the table shows"},
]

# The four deliberation types, matching mediators.py
COND = {
    "caucus": {"label": "Caucus", "shared": False, "mediator": True, "final": "mediator",
               "about": "Each person chats privately with the Mediator. The Mediator writes a draft decision, everyone gives private feedback, and the Mediator writes the final decision."},
    "facilitated": {"label": "Guided discussion", "shared": True, "mediator": True, "final": "mediator",
                    "about": "Team chat. Each round the Mediator asks one question to bring out information people have not shared. At the end, the Mediator writes the team decision."},
    "summary_only": {"label": "Summary only", "shared": True, "mediator": True, "final": "majority",
                     "about": "Team chat. After each round the Mediator posts a neutral recap of who said what. The decision is the features at least 2 of 3 people pick in the last round."},
    "unmediated": {"label": "Unmediated", "shared": True, "mediator": False, "final": "majority",
                   "about": "Team chat with no mediator. The decision is the features at least 2 of 3 people pick in the last round."},
}
COND_KEYS = list(COND)

PRE = [["ai_att", "AI tools usually help teams make better decisions."], ["exp", "I have worked on product design before."]]
POST_COMMON = [["sat", "I am satisfied with how the discussion went."], ["heard", "I felt heard by my team."],
               ["fair", "The process was fair."], ["quality", "Our final design is a good one."]]
POST_AI = [["trust", "I trusted the Mediator."], ["useful", "The Mediator was useful."], ["rep", "The Mediator represented my view fairly."]]

ANIMALS = ["Otter", "Heron", "Lynx", "Falcon", "Badger", "Koala", "Panda", "Moose", "Gecko", "Bison", "Raven", "Tiger",
           "Walrus", "Bobcat", "Puffin", "Marten", "Ibex", "Crane"]

MSG_MAX = 300  # characters per message

# Sample replies for simulated students (load tests and demos)
SAMPLE = {
    "ME": {"r1": {"text": "I think we need F01, the seal. Splash tests showed spills caused problems. F03, the mount, is worth more too, ordinary mounts drifted in hot and cold tests. F04 the tougher case is worth less than the table says, the normal case held up.", "picks": ["F01", "F03", "F08", "F10"]},
           "r2": {"text": "I still want F01 and F03. Happy to add F05 and F07 based on what I heard.", "picks": ["F01", "F03", "F05", "F07", "F08", "F10"]}},
    "MF": {"r1": {"text": "F10, the single board, is cheap and my trial builds had fewer errors with it, so it's worth more. F12, the pre-calibrated sensor, also looks worth more. I don't think we need F06, our current supplier is reliable.", "picks": ["F10", "F12", "F08", "F07"]},
           "r2": {"text": "I'm fine as long as F10 stays. F12 can go if we need the money.", "picks": ["F01", "F03", "F05", "F07", "F08", "F10"]}},
    "HF": {"r1": {"text": "Audio instructions (F05) helped people put the cuff on right, so it's worth more than the table says. One-button (F07) helped older users too. The large cuff F09 is probably worth less, most people fit the normal sizes.", "picks": ["F05", "F07", "F08", "F10"]},
           "r2": {"text": "Keep F05 and F07, those matter most from my testing.", "picks": ["F01", "F03", "F05", "F07", "F08", "F10", "F11"]}},
}
SAMPLE_CAUCUS_R2 = {"ME": "Looks good to me. Please keep F01 and F03.", "MF": "I'm fine with this as long as F10 stays.",
                    "HF": "Keep F05 and F07, those matter most from my testing."}


def public_content():
    """What every browser may load: no private facts, no true values."""
    return {"msg_max": MSG_MAX, "budget": BUDGET, "features": [{k: f[k] for k in ("id", "name", "price", "shared", "plain")} for f in FEATURES],
            "roles": ROLES, "role_keys": ROLE_KEYS, "pre": PRE, "post_common": POST_COMMON, "post_ai": POST_AI,
            "cond": {k: {kk: v[kk] for kk in ("shared", "mediator", "final")} for k, v in COND.items()}}
