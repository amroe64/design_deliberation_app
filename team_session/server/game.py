"""The live session: lobby, consent, team forming, rounds, the Mediator, surveys,
and the activity log. The server holds all state; browsers only ever see their
own slice of it (student_view / admin_*). Every change is written to SQLite.
"""
import asyncio
import os
import random
import re
import secrets
import string
import time

from . import content as C
from . import rules
from . import mediator as M
from . import students as SIM

AI_TIMEOUT = float(os.environ.get("AI_TIMEOUT", "180"))  # seconds for a whole Mediator turn (retries included) before the stand-in answers
AI_CONCURRENCY = int(os.environ.get("AI_CONCURRENCY", "8"))
STUCK_S = 120
PID_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"


TIMER_DEFAULTS = {"on": True, "card": 5, "round1": 6, "round": 5, "final": 1, "survey": 4}   # minutes per step


def now():
    return time.time()


def fmt_t(sec):
    sec = max(0, int(sec))
    return f"{sec // 60}:{sec % 60:02d}"


def round_of(step):
    m = re.search(r"\d+", step or "")
    return int(m.group()) if m else 0


class Game:
    def __init__(self, db):
        self.db = db
        self.lock = asyncio.Lock()
        self.mediator = M.make()
        self.llm = self.mediator if self.mediator.real else None     # one ARC client, reused when the model changes
        self.fallback = M.StandIn()
        self.sem = asyncio.Semaphore(AI_CONCURRENCY)
        self.dirty, self.dirty_all, self.admin_dirty = set(), False, False
        self.on_change = None           # set by app.py: async callback that pushes updates
        row = db.latest_session()
        if row:
            self._load(row)
        else:
            self.new_session()
        self.mediator_note = ""
        if self.settings.get("mediator_model"):               # the model picked on the Setup tab, kept across restarts
            try:
                self.choose_mediator(self.settings["mediator_model"])
            except ValueError as e:
                self.mediator_note = str(e)

    # ------------------------------------------------------------ Mediator choice (admin Setup tab)
    def get_llm(self):
        if self.llm is None and M.available():
            self.llm = M.LLM()
        return self.llm

    def mediator_choice(self):
        return self.mediator.model if self.mediator.real else M.STANDIN

    def mediator_locked(self):
        """The model may only change before teams exist, so one session never mixes two Mediators."""
        return bool(self.teams) or not self.lobby_open

    def choose_mediator(self, choice):
        if choice == M.STANDIN:
            self.mediator = M.StandIn()
        else:
            llm = self.get_llm()
            if llm is None:
                raise ValueError("This server has no ARC key, so only the stand-in can run. Add ARC_API_KEY and ARC_API_BASE to team_session/.env and restart.")
            llm.set_model(choice)
            self.mediator = llm
        self.settings["mediator_model"] = choice

    # ------------------------------------------------------------ session
    def new_session(self, settings=None):
        self.sid = "S-" + time.strftime("%Y-%m-%d") + "-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=4))
        self.created = now()
        self.settings = settings or {"class_code": "SD26", "conds": list(C.COND_KEYS), "rounds": 2, "threshold": 60,
                                     "fallback": ["caucus", "facilitated", "unmediated"],
                                     "timers": dict(TIMER_DEFAULTS)}
        self.settings.setdefault("timers", dict(TIMER_DEFAULTS))
        self.lobby_open, self.paused, self.broadcast, self.pause_at = True, False, "", None
        self.auto_speed = 0          # 0 = off; otherwise how many times faster than a real class the simulated students work
        self.session_start, self.used_conds, self.next_team = None, None, 1
        self.clock_acc, self.clock_at, self.clock_rate = 0.0, None, 0.0
        self.stats = {"calls": 0, "lat": [], "queue": 0, "timeouts": 0, "fallbacks": 0}
        self.bot_batches = []
        self.seats, self.tokens, self.teams = {}, {}, {}
        self.save_session()
        self.dirty_all = self.admin_dirty = True

    def _load(self, row):
        import json
        st = json.loads(row["state_json"])
        self.sid, self.created = row["id"], row["created_at"]
        for k in ("settings", "lobby_open", "paused", "broadcast", "session_start", "used_conds", "next_team", "stats", "clock_acc"):
            setattr(self, k, st[k])
        self.bot_batches = st.get("bot_batches", [])
        self.auto_speed = st.get("auto_speed", 0)
        self.pause_at = st.get("pause_at")
        self.seats = {s["pid"]: s for s in self.db.seats(self.sid)}
        self.tokens = {s["token"]: s["pid"] for s in self.seats.values()}
        self.teams = {T["id"]: T for T in self.db.teams(self.sid)}
        self._resume = [T["id"] for T in self.teams.values() if T.get("pending")]
        # The clock restarts from the banked time; the time the server was down does not count.
        self.clock_at, self.clock_rate = None, 0.0
        self.settle_clock()

    async def resume_pending(self):
        """After a restart: re-run any Mediator call that was in flight."""
        for tid in getattr(self, "_resume", []):
            T = self.teams[tid]
            T["pending"] = False
            n = max(round_of(T["roles"][r]["step"]) for r in self.active(T))
            self._close_round(T, n)
        self._resume = []

    def save_session(self):
        self.db.save_session(self.sid, self.created, self.settings["class_code"], {
            "settings": self.settings, "lobby_open": self.lobby_open, "paused": self.paused, "broadcast": self.broadcast,
            "session_start": self.session_start, "clock_acc": self.clock_now(), "used_conds": self.used_conds, "next_team": self.next_team, "bot_batches": self.bot_batches,
            "auto_speed": self.auto_speed, "pause_at": self.pause_at,
            "stats": {**self.stats, "lat": self.stats["lat"][-200:]}})

    def save_seat(self, s):
        T = self.teams.get(s["team"]) if s["team"] is not None else None
        nick = T["roles"][s["role"]]["pseudo"] if T and s["role"] else None
        self.db.save_seat(self.sid, s, nick)

    def stamp_steps(self, T):
        """Remember when each person's step started, for their step timer."""
        for R in T["roles"].values():
            if R and R.get("step_mark") != R["step"]:
                R["step_mark"], R["step_at"] = R["step"], now()

    def shift_timers(self, secs):
        """After a pause, push every step start forward so time spent paused doesn't count."""
        for T in self.teams.values():
            for R in T["roles"].values():
                if R and R.get("step_at"):
                    R["step_at"] += secs
            self.db.save_team(self.sid, T)

    def save_team(self, T):
        self.stamp_steps(T)
        self.db.save_team(self.sid, T)
        self.touch(T)

    def touch(self, T):
        self.dirty.update(T["roles"][r]["pid"] for r in self.active(T))
        self.admin_dirty = True

    # ------------------------------------------------------------ helpers
    @staticmethod
    def active(T):
        return [r for r in C.ROLE_KEYS if T["roles"].get(r)]

    def pid_of(self, T, r):
        return T["roles"][r]["pid"] if T["roles"].get(r) else None

    def seat_of(self, T, r):
        return self.seats.get(self.pid_of(T, r))

    def label(self, T, r):
        return f"{C.ROLES[r]['short']} — {T['roles'][r]['pseudo']}"

    # ------------------------------------------------------------ activity log
    def track(self, seat, typ, d=None):
        if not seat:
            return
        T = self.teams.get(seat["team"]) if seat["team"] is not None else None
        R = T["roles"][seat["role"]] if T else None
        step = R["step"] if R else ("consent" if seat["consent"] is None else ("late" if seat["late"] else "lobby"))
        self.db.add_event(self.sid, {"ts": now(), "pid": seat["pid"], "bot": seat["bot"], "team": seat["team"], "role": seat["role"],
                                     "condition": T["cond"] if T else None, "step": step, "type": typ, "d": d or {}})
        self.admin_dirty = True

    # ------------------------------------------------------------ session clock
    # The clock shows how far the SESSION has got, not wall time: it runs at 1x with real students,
    # at the simulation speed while the full simulation runs, and stops when paused, when the
    # simulation is stopped with only simulated students left, or when every team is done.
    def target_rate(self):
        if not self.session_start or self.paused or not self.teams:
            return 0.0
        live = [T for T in self.teams.values() if any(T["roles"][r]["step"] != "done" for r in self.active(T))]
        if not live:
            return 0.0
        if self.auto_speed:
            return float(self.auto_speed)
        real = any(not self.seat_of(T, r)["bot"] for T in live for r in self.active(T) if T["roles"][r]["step"] != "done")
        return 1.0 if real else 0.0

    def clock_now(self):
        acc = getattr(self, "clock_acc", 0.0) or 0.0
        if getattr(self, "clock_at", None) is None:
            return acc
        return acc + (now() - self.clock_at) * self.clock_rate

    def settle_clock(self):
        """Bank the time so far at the old rate, then switch to the rate that fits what's happening now."""
        self.clock_acc = self.clock_now()
        self.clock_at = now()
        self.clock_rate = self.target_rate()
        for T in self.teams.values():
            T.setdefault("clock_start", 0.0)
            done = all(T["roles"][r]["step"] == "done" for r in self.active(T))
            if done and T.get("clock_end") is None:
                T["clock_end"] = self.clock_acc
            elif not done:
                T["clock_end"] = None

    def team_clock(self, T):
        end = T.get("clock_end")
        return (end if end is not None else self.clock_now()) - T.get("clock_start", 0.0)

    def log_ev(self, T, e):
        pid = self.pid_of(T, e["who"]) if e.get("who") in C.ROLES else None
        ev = {"id": f"T{T['id']}-{len(T['log']) + 1}", "seq": len(T["log"]), "ts": now(),
              "t": fmt_t(self.team_clock(T)), "clock": round(self.clock_now(), 1), "session": self.sid, "team": T["id"], "condition": T["cond"], "pid": pid, **e}
        T["log"].append(ev)
        self.db.add_log(self.sid, ev)
        if pid:
            keep = {k: ev.get(k) for k in ("id", "round", "text", "set", "card", "msg", "answers", "recall", "private", "accepted")
                    if ev.get(k) is not None}
            self.track(self.seats[pid], e["kind"], {**keep, **(ev.get("compose") or {})})
        return ev

    def check_steps(self):
        for T in self.teams.values():
            for r in self.active(T):
                s = self.seat_of(T, r)
                st = T["roles"][r]["step"]
                if s.get("_step") != st:
                    self.track(s, "step_start", {"step": st, "from": s.get("_step")})
                    s["_step"] = st
                    if st.startswith("wait"):
                        T["roles"][r]["wait_since"] = now()
                    self.save_seat(s)

    # ------------------------------------------------------------ joining
    def new_pid(self):
        while True:
            p = "P-" + "".join(random.choices(PID_ALPHABET, k=5))
            if p not in self.seats:
                return p

    def join(self, bot=False):
        pid = self.new_pid()
        s = {"pid": pid, "token": secrets.token_urlsafe(16), "bot": bot, "consent": None, "consent_shown_at": now(),
             "joined_at": now(), "team": None, "role": None, "late": not self.lobby_open, "help": False, "_step": None}
        if bot:
            s["consent"] = random.random() < 0.9
        self.seats[pid] = s
        self.tokens[s["token"]] = pid
        self.track(s, "join", {"late": s["late"]})
        if bot:
            self.track(s, "consent", {"yes": s["consent"], "ms_on_screen": 0})
        self.save_seat(s)
        self.dirty_all = self.admin_dirty = True   # lobby counts change for everyone
        return s

    def add_bots(self, n):
        self.bot_batches.append([self.join(bot=True)["pid"] for _ in range(n)])
        self.save_session()

    def remove_bots(self, last_only=True):
        """Undo simulated students. Only while the lobby is open (after teams form they are part of teams)."""
        if not self.lobby_open:
            return 0
        if last_only:
            pids = self.bot_batches.pop() if self.bot_batches else []
        else:
            pids = [p for p, s in self.seats.items() if s["bot"]]
            self.bot_batches = []
        pids = [p for p in pids if p in self.seats and self.seats[p]["bot"] and self.seats[p]["team"] is None]
        for p in pids:
            self.tokens.pop(self.seats[p]["token"], None)
            del self.seats[p]
        self.db.delete_people(self.sid, pids)
        self.save_session()
        self.dirty_all = self.admin_dirty = True
        return len(pids)

    def new_team(self, cond, pids, **flags):
        tid = self.next_team
        self.next_team += 1
        names = random.sample(C.ANIMALS, 3)
        roles = {}
        for i, r in enumerate(C.ROLE_KEYS):
            if i >= len(pids):
                roles[r] = None
                continue
            roles[r] = {"pid": pids[i], "pseudo": names[i], "step": "card", "picks": [], "text": "", "comment": "", "endorse": None,
                        "wait_since": None, "chk": {}, "pre": {}, "sv": {}, "recall": [], "ratings": {}, "rdraft": {}}
            self.seats[pids[i]].update(team=tid, role=r)
        T = {"id": tid, "cond": cond, "roles": roles, "log": [], "drafts": [], "pending": False, "final": None,
             "start": now(), "clock_start": self.clock_now(), "clock_end": None, "seen": {}, **flags}
        self.teams[tid] = T
        if cond == "facilitated":
            self.log_ev(T, {"round": 1, "who": "Mediator", "kind": "question", "text": rules.facilitator_question([], 1), "set": None})
        for r in self.active(T):
            s = self.seat_of(T, r)
            self.track(s, "placed", {"team": tid, "role": r, "nickname": roles[r]["pseudo"], "condition": cond, **flags})
            self.save_seat(s)
        self.save_team(T)
        return T

    def form_teams(self):
        ready = [s for s in self.seats.values() if s["team"] is None and not s["late"] and s["consent"] is not None]
        conds = self.settings["fallback"] if len(ready) < self.settings["threshold"] and self.settings["fallback"] else self.settings["conds"]
        for nonconsent in (False, True):
            group = [s["pid"] for s in ready if bool(s["consent"]) != nonconsent]
            random.shuffle(group)
            full, left = divmod(len(group), 3)
            order = [conds[i % len(conds)] for i in range(full + (1 if left else 0))]
            random.shuffle(order)
            for i in range(full):
                self.new_team(order[i], group[i * 3:i * 3 + 3], spare=False, nonconsent=nonconsent)
            if left:
                self.new_team(order[full], group[full * 3:], spare=True, nonconsent=nonconsent)
        # anyone who hadn't answered consent yet is treated as late
        for s in self.seats.values():
            if s["team"] is None and s["consent"] is None:
                s["late"] = True
                self.save_seat(s)
        self.lobby_open, self.session_start, self.used_conds = False, now(), conds
        self.clock_acc, self.clock_at = 0.0, now()
        self.save_session()
        self.dirty_all = True
        return len(ready), conds

    def give_solo(self, pid):
        s = self.seats[pid]
        cond = random.choice(self.used_conds or self.settings["conds"])
        s["late"] = False
        self.new_team(cond, [pid], spare=True, late=True, nonconsent=not s["consent"])

    # ------------------------------------------------------------ rounds
    def submit_post(self, T, r, n, text, picks, compose=None, closed_by=False):
        R = T["roles"][r]
        self.log_ev(T, {"round": n, "who": r, "kind": "message", "text": text, "set": rules.sort_ids(picks),
                        "private": not C.COND[T["cond"]]["shared"], "facts_tagged": rules.fact_tags(text),
                        "compose": compose or {}, **({"closed_by_researcher": True} if closed_by else {})})
        R["text"], R["step"] = "", f"wait{n}"
        if all(T["roles"][k]["step"] == f"wait{n}" for k in self.active(T)):
            self._close_round(T, n)
        self.save_team(T)

    def _close_round(self, T, n):
        if not C.COND[T["cond"]]["mediator"]:
            self._apply_round(T, n, None)
            return
        T["pending"] = True
        self.stats["queue"] += 1
        self.stats["calls"] += 1
        asyncio.get_running_loop().create_task(self._ai_round(T["id"], n, time.time()))

    async def _ai_round(self, tid, n, t_enq=None):
        T = self.teams[tid]
        rounds, last, c = self.settings["rounds"], n == self.settings["rounds"], T["cond"]

        async def call(med):
            if c == "caucus":
                return await med.caucus_draft(T, n, last, rounds)
            if c == "facilitated":
                return await (med.facilitated_final(T, rounds) if last else med.facilitator_question(T, n + 1, rounds))
            return await med.recap(T, n, rounds)

        t0, err, status = time.time(), None, "ok"
        t_enq = t_enq or t0
        use = {"n": 0, "in": 0, "out": 0, "req_bytes": 0, "resp_bytes": 0, "calls": []}
        M.USAGE.set(use)
        prompt_chars = 1400 + sum(len(e.get("text") or "") for e in T["log"])      # rough size of what a model is sent
        async with self.sem:
            t_run = time.time()
            self.stats["flight"] = self.stats.get("flight", 0) + 1
            self.stats["peak_flight"] = max(self.stats.get("peak_flight", 0), self.stats["flight"])
            try:
                out = await asyncio.wait_for(call(self.mediator), AI_TIMEOUT)
            except Exception as e:  # noqa: BLE001  (timeout, network, bad reply)
                err = f"{type(e).__name__}: {e}"[:500]
                # timeout: the whole turn ran past AI_TIMEOUT. network: ARC/VPN/busy/setup. model: no usable bundle.
                status = "timeout" if isinstance(e, asyncio.TimeoutError) else M.failure_kind(e)
                if isinstance(e, asyncio.TimeoutError):
                    self.stats["timeouts"] += 1
                self.stats["fallbacks"] += 1
                out = await call(self.fallback)
                if hasattr(self.mediator, "remember_fallback"):
                    self.mediator.remember_fallback(T, (out.get("text") or "") if isinstance(out, dict) else str(out or ""))
            finally:
                self.stats["flight"] = max(0, self.stats.get("flight", 1) - 1)
            t_done = time.time()
        async with self.lock:
            self.stats["queue"] -= 1
            self.stats["lat"].append(round(time.time() - t0, 2))
            self.stats["lat"] = self.stats["lat"][-200:]
            reply = (out.get("text") or out.get("question") or "") if isinstance(out, dict) else str(out or "")
            real = use["n"] > 0 and status == "ok"
            kind = ("Final design" if last else "Draft") if c == "caucus" else ("Final design" if last else "Question") if c == "facilitated" else "Recap"
            log = self.stats.setdefault("log", [])
            log.append({"i": len(log) + 1, "ts": round(t_enq, 2), "clock": round(self.team_clock(T), 1) if hasattr(self, "team_clock") else None, "team": tid, "cond": c, "round": n, "kind": kind,
                        "model": self.mediator.name, "status": status, "error": err, "wait_s": round(t_run - t_enq, 2), "model_s": round(t_done - t_run, 2),
                        "tok_in": use["in"] if real else round(prompt_chars / 4), "tok_out": use["out"] if real else round(len(reply) / 4), "est": not real,
                        "bytes_out": use["req_bytes"] if real else prompt_chars, "bytes_in": use["resp_bytes"] if real else len(reply.encode("utf-8")),
                        # what this turn took at the model: requests sent, network/busy retries, bundle repairs, empty replies
                        "requests": len(use["calls"]), "retries": sum(1 for x in use["calls"] if x.get("attempt", 1) > 1),
                        "repairs": sum(1 for x in use["calls"] if "(repair)" in x.get("purpose", "") and x.get("attempt", 1) == 1),
                        "empty": sum(1 for x in use["calls"] if "reply" in x and not (x["reply"] or "").strip()),
                        "finish": next((x.get("finish_reason") for x in reversed(use["calls"]) if x.get("finish_reason")), None)})
            self.stats["log"] = log[-600:]
            for rec in use["calls"]:                   # every real request, kept with the team (exports: ai_calls.csv)
                T.setdefault("ai_calls", []).append({"turn": log[-1]["i"], "round": n, "kind": kind, **rec})
            self._apply_round(T, n, out, err, status)
            self.check_steps()
            self.save_team(T)
            self.save_session()
        if self.on_change:
            await self.on_change()

    def _apply_round(self, T, n, out, err=None, status=None):
        rounds, c = self.settings["rounds"], T["cond"]
        last = n == rounds
        by = ", ".join(C.ROLES[r]["short"] for r in self.active(T))
        meta = {"mediator": (self.fallback.name if err else self.mediator.name)} if out is not None else {}
        if err:
            meta["mediator_error"] = err
            meta["mediator_failure"] = status          # timeout / network / model: the stand-in answered this turn
        if c == "caucus":
            d = {"round": n, **out}
            T["drafts"].append(d)
            self.log_ev(T, {"round": n, "who": "Mediator", "kind": "draft", "text": d["text"], "set": d["set"],
                            "version": "Final" if last else f"Draft {n}", "based_on": by, **meta})
            if last:
                T["final"] = d["set"]
            else:
                for k in self.active(T):
                    T["roles"][k]["picks"] = list(d["set"])
        elif c == "facilitated":
            if last:
                T["final"] = out["set"]
                self.log_ev(T, {"round": n, "who": "Mediator", "kind": "draft", "text": out["text"], "set": out["set"],
                                "version": "Team decision", "based_on": by, **meta})
            else:
                self.log_ev(T, {"round": n + 1, "who": "Mediator", "kind": "question", "text": out, "set": None, **meta})
        elif c == "summary_only":
            self.log_ev(T, {"round": n, "who": "Mediator", "kind": "recap", "text": out, "set": None,
                            "version": f"Recap {n}", "based_on": by, **meta})
        if last and C.COND[c]["final"] == "majority":
            T["final"] = rules.majority_set(T["log"], rounds, len(self.active(T)))
        if last:
            self.log_ev(T, {"round": "end", "who": "Majority vote" if C.COND[c]["final"] == "majority" else "Mediator",
                            "kind": "final", "text": "Final team decision", "set": T["final"]})
        T["pending"] = False
        for k in self.active(T):
            T["roles"][k]["step"] = "final" if last else f"post{n + 1}"

    def mark_seen(self, T, mid, r):
        lst = T["seen"].setdefault(mid, [])
        if r not in lst:
            lst.append(r)
            self.log_ev(T, {"round": "-", "who": r, "kind": "seen", "msg": mid, "text": "On screen 2s or more", "set": None})

    def force_close(self, T):
        if T["pending"]:
            return
        steps = [T["roles"][k]["step"] for k in self.active(T)]
        if any(s in ("final", "survey") for s in steps):
            for k in self.active(T):
                R = T["roles"][k]
                if R["step"] in ("final", "survey"):
                    R["step"] = "done"
                    self.log_ev(T, {"round": "end", "who": k, "kind": "skipped", "text": "Final/survey closed by researcher",
                                    "set": None, "closed_by_researcher": True})
            self.save_team(T)
            return
        n = max([1] + [round_of(s) for s in steps])
        for k in self.active(T):
            if T["roles"][k]["step"] != f"wait{n}":
                T["roles"][k]["step"] = f"post{n}"
        for k in self.active(T):
            if T["roles"][k]["step"] == f"post{n}":
                self.track(self.seat_of(T, k), "round_closed_by_researcher", {"round": n})
                self.submit_post(T, k, n, "(no message: round closed by researcher)", T["roles"][k]["picks"], closed_by=True)
        self.save_team(T)

    # ------------------------------------------------------------ student actions
    def student_act(self, s, a):
        typ = a.get("type")
        T = self.teams.get(s["team"]) if s["team"] is not None else None
        r = s["role"]
        R = T["roles"][r] if T else None
        if typ == "consent" and s["consent"] is None:
            s["consent"] = bool(a.get("yes"))
            self.track(s, "consent", {"yes": s["consent"], "ms_on_screen": int((now() - s["consent_shown_at"]) * 1000)})
            self.save_seat(s)
            self.admin_dirty = True
            return
        if typ == "help":
            s["help"] = not s["help"]
            self.track(s, "help", {"on": s["help"]})
            self.save_seat(s)
            return
        # light-weight events that only go to the activity log
        if typ in ("tab", "left_app", "returned_to_app", "paste", "paste_blocked", "copy_blocked", "time_warning", "typing_start", "insert_fact", "send_click", "card_comment_snapshot", "accept_comment_snapshot"):
            self.track(s, typ, {k: v for k, v in a.items() if k not in ("type", "token")})
            return
        if not T:
            return
        if typ == "draft_snapshot":
            R["text"] = str(a.get("text", ""))[:C.MSG_MAX]
            self.track(s, "draft_snapshot", {"field": "message", "text": R["text"], "chars": len(R["text"])})
            self.save_team(T)
            return
        if typ == "seen":
            mid = a.get("msg")
            if any(e["id"] == mid for e in rules.visible_items(T, r, self.settings["rounds"])) and not mid.startswith("x"):
                self.mark_seen(T, mid, r)
                self.save_team(T)
            return
        if self.paused and typ in ("ready", "send", "endorse", "survey"):
            return
        if typ == "chk" and R["step"] == "card":
            k, v = a["k"], a["v"]
            R["chk"][k] = v
            self.track(s, "answer", {"block": "brief_check", "item": k, "value": v, "correct": (v == r) if k == "role" else (v == "no")})
        elif typ == "lik":
            blk = R["pre"] if a["g"] == "pre" else R["sv"]
            blk[a["k"]] = int(a["v"])
            self.track(s, "answer", {"block": "pre_survey" if a["g"] == "pre" else "post_survey", "item": a["k"], "value": int(a["v"])})
        elif typ == "leak":
            R["sv"]["leak"] = a["v"]
            self.track(s, "answer", {"block": "post_survey", "item": "leak", "value": a["v"]})
        elif typ == "recall":
            rid, on = a["id"], bool(a["on"])
            R["recall"] = sorted(set(R["recall"]) | {rid}) if on else [x for x in R["recall"] if x != rid]
            self.track(s, "answer", {"block": "recall", "item": rid, "value": on})
        elif typ == "ready" and R["step"] == "card":
            if not (R["chk"].get("role") and R["chk"].get("see") and all(R["pre"].get(k) for k, _ in C.PRE)):
                return
            self.log_ev(T, {"round": 0, "who": r, "kind": "check", "set": None,
                            "text": f"Brief check: role {'correct' if R['chk']['role'] == r else 'wrong'}, privacy {'correct' if R['chk']['see'] == 'no' else 'wrong'}"})
            self.log_ev(T, {"round": 0, "who": r, "kind": "pre", "answers": dict(R["pre"]), "text": "Pre-survey", "set": None})
            R["step"] = "post1"
        elif typ == "pick" and R["step"].startswith("post"):
            fid, on = a["id"], bool(a["on"])
            if fid in rules.FEAT:
                picks = rules.sort_ids(R["picks"] + [fid]) if on else [x for x in R["picks"] if x != fid]
                if rules.cost(picks) <= C.BUDGET or not on:
                    R["picks"] = picks
                self.track(s, "pick", {"feature": fid, "on": on, "picks": " ".join(R["picks"]), "cost": rules.cost(R["picks"])})
        elif typ == "send" and R["step"].startswith("post"):
            text = str(a.get("text", "")).strip()[:C.MSG_MAX]
            if not text or rules.cost(R["picks"]) > C.BUDGET:
                return
            n = round_of(R["step"])
            if n != int(a.get("n", n)):
                return
            comp = {k: a.get(k) for k in ("compose_ms", "keys", "backspaces", "pastes", "tapped") if a.get(k) is not None}
            self.submit_post(T, r, n, text, R["picks"], compose=comp)
        elif typ == "rate":
            mid, v = a["msg"], a["v"]
            R["ratings"][mid] = v
            if a.get("comment") is not None:
                R["rdraft"][mid] = str(a["comment"])[:1000]
            self.log_ev(T, {"round": "-", "who": r, "kind": "rating", "card": mid,
                            "text": v + (f": {R['rdraft'][mid]}" if R["rdraft"].get(mid) else ""), "set": None})
        elif typ == "rdraft":
            R["rdraft"][a["msg"]] = str(a.get("text", ""))[:1000]
            self.track(s, "draft_snapshot", {"field": f"card_comment:{a['msg']}", "text": R["rdraft"][a["msg"]], "chars": len(R["rdraft"][a["msg"]])})
        elif typ == "comment":
            R["comment"] = str(a.get("text", ""))[:1000]
            self.track(s, "draft_snapshot", {"field": "accept_comment", "text": R["comment"], "chars": len(R["comment"])})
        elif typ == "endorse" and R["step"] == "final":
            yes = bool(a.get("yes"))
            R["endorse"], R["step"] = yes, "survey"
            self.log_ev(T, {"round": "end", "who": r, "kind": "endorse", "accepted": yes, "set": None,
                            "text": ("Accepts" if yes else "Does not accept") + (f": {R['comment']}" if R["comment"] else "")})
        elif typ == "survey" and R["step"] == "survey":
            items = C.POST_COMMON + (C.POST_AI if C.COND[T["cond"]]["mediator"] else [])
            if not (all(R["sv"].get(k) for k, _ in items) and R["sv"].get("leak")):
                return
            R["step"] = "done"
            self.log_ev(T, {"round": "end", "who": r, "kind": "survey", "text": "Post-survey submitted",
                            "answers": dict(R["sv"]), "recall": list(R["recall"]), "set": None})
        else:
            return
        self.save_team(T)

    # ------------------------------------------------------------ simulated students
    def bot_sim(self, T, r):
        R = T["roles"][r]
        if "sim" not in R:
            s = self.seat_of(T, r)
            SIM.setup(R, r, s.get("persona"))
            s["persona"] = R["sim"]["persona"]
        return R["sim"]

    def bot_act(self, T, r):
        """One simulated student does whatever their current step needs, the way their persona would."""
        R = T["roles"][r]
        if not R or T["pending"]:
            return
        sim, rounds, rng = self.bot_sim(T, r), self.settings["rounds"], random
        P = SIM.PERSONAS[sim["persona"]]
        for e in rules.visible_items(T, r, rounds):
            if e.get("who") != r and e["kind"] != "final" and rng.random() < (.95 if sim["persona"] != "minimal" else .7):
                self.mark_seen(T, e["id"], r)
        s = self.seat_of(T, r)
        speed = max(self.auto_speed, 1)
        if R["step"] == "card":
            wrong_role = sim["persona"] in ("minimal", "confused") and rng.random() < .15
            R["chk"] = {"role": rng.choice([k for k in C.ROLE_KEYS if k != r]) if wrong_role else r, "see": "no" if rng.random() > .05 else "yes"}
            R["pre"] = {"ai_att": rng.randint(2, 5), "exp": rng.randint(1, 4)}
            self.student_act(s, {"type": "ready"})
        elif R["step"].startswith("post"):
            n = round_of(R["step"])
            SIM.listen(T, r, R, rounds, rng)
            for e in T["log"]:
                if e["kind"] in ("draft", "recap") and e["id"] not in R["ratings"] and e["id"] in [x["id"] for x in rules.visible_items(T, r, rounds)]:
                    v = rng.choices(["Agree", "Partly", "Disagree"], weights={"engaged": (6, 3, 1), "minimal": (5, 2, 1), "confused": (3, 4, 2)}.get(sim["persona"], (5, 3, 1)))[0]
                    self.student_act(s, {"type": "rate", "msg": e["id"], "v": v})
            picks = SIM.best_pick(SIM.believed_values(T, r, R, rounds))
            if n == 1:
                text = SIM.first_message(T, r, R, rng)
            else:
                draft = next((e for e in reversed(T["log"]) if e["kind"] == "draft"), None) if T["cond"] == "caucus" else None
                if draft and draft.get("set") and rng.random() < {"engaged": .35, "minimal": .8, "anchored": .6}.get(sim["persona"], .5):
                    picks = list(draft["set"])       # just goes along with the AI draft
                text = SIM.later_message(T, r, R, n, picks, rng, draft_set=(draft or {}).get("set"))
            R["picks"] = list(picks)
            sim["last_picks"] = list(picks)
            due = sim.get("due", 60)
            self.submit_post(T, r, n, text, picks, compose={"compose_ms": int(due * speed * 1000 * rng.uniform(.5, .9)),
                                                           "keys": len(text) + rng.randint(0, 40), "backspaces": rng.randint(0, 25),
                                                           "simulated": True, "persona": sim["persona"]})
        elif R["step"] == "final":
            mine = set(SIM.best_pick(SIM.believed_values(T, r, R, rounds)))
            fin = set(T.get("final") or [])
            overlap = len(mine & fin) / max(1, len(mine | fin))
            yes = rng.random() < (.92 if overlap >= .6 else .6 if overlap >= .35 else .3)
            if not yes and sim["persona"] != "minimal" and rng.random() < .6:
                R["comment"] = rng.choice(["it leaves out stuff my tests showed matters", "we ignored the seal data", "i still think the table was off on a few"])
            self.student_act(s, {"type": "endorse", "yes": yes})
        elif R["step"] == "survey":
            lo, hi = P["sat"]
            for k, _ in C.POST_COMMON + (C.POST_AI if C.COND[T["cond"]]["mediator"] else []):
                R["sv"][k] = max(1, min(5, rng.randint(lo, hi) + (rng.choice([-1, 0, 0, 1]))))
            R["sv"]["leak"] = "No" if rng.random() < .85 else rng.choice(["A little", "A little", "A lot"])
            heard = sim.get("heard", {})
            rec = []
            for x in rules.recall_items(T, r):
                fid = (rules.FACT.get(x["id"]) or {}).get("f")
                p = .1 if x["decoy"] else (.85 if fid in heard else .3)
                if sim["persona"] == "minimal":
                    p *= .6
                if rng.random() < p:
                    rec.append(x["id"])
            R["recall"] = rec
            self.student_act(s, {"type": "survey"})

    def auto_tick(self):
        """Called every second while the full simulation runs. Each simulated student acts once their
        persona's time for the step has passed (scaled by the chosen speed)."""
        if not self.auto_speed or self.paused:
            return False
        t, acted = now(), False
        timers = self.settings.get("timers", TIMER_DEFAULTS)
        for T in list(self.teams.values()):
            if T["pending"]:
                continue
            for r in self.active(T):
                s, R = self.seat_of(T, r), T["roles"][r]
                if not s["bot"] or R["step"] == "done" or R["step"].startswith("wait"):
                    continue
                sim = self.bot_sim(T, r)
                if sim.get("due_for") != R["step"]:
                    sim["due_for"], sim["due"] = R["step"], SIM.step_due(R, R["step"], timers, self.auto_speed, random)
                if t >= (R.get("step_at") or t) + sim["due"]:
                    self.bot_act(T, r)
                    acted = True
        return acted

    def simulate_step(self, prob=0.75, team_id=None, skip_pid=None):
        for T in list(self.teams.values()):
            if team_id is not None and T["id"] != team_id:
                continue
            for r in self.active(T):
                s = self.seat_of(T, r)
                if s["bot"] and s["pid"] != skip_pid and random.random() < prob:
                    self.bot_act(T, r)

    # ------------------------------------------------------------ views
    def student_view(self, s):
        v = {"pid": s["pid"], "consent": s["consent"], "late": s["late"], "help": s["help"],
             "session": {"id": self.sid, "paused": self.paused, "broadcast": self.broadcast, "rounds": self.settings["rounds"],
                         "timers": self.settings.get("timers", TIMER_DEFAULTS),
                         "lobby_open": self.lobby_open, "joined": len(self.seats)},
             "team": None}
        if s["team"] is None:
            return v
        T, r = self.teams[s["team"]], s["role"]
        R = T["roles"][r]
        if not R.get("step_at"):
            self.stamp_steps(T)
        mates = {k: {"label": self.label(T, k), "step": T["roles"][k]["step"]} for k in self.active(T)}
        items = [{k: e.get(k) for k in ("id", "kind", "round", "who", "text", "set", "t", "version", "based_on", "private")}
                 for e in rules.visible_items(T, r, self.settings["rounds"])]
        v["team"] = {"id": T["id"], "cond": T["cond"], "pending": T["pending"], "final": T["final"], "mates": mates,
                     "role": r, "label": self.label(T, r), "me": {k: R[k] for k in ("step", "picks", "text", "comment", "endorse", "chk", "pre", "sv", "recall", "ratings", "rdraft")},
                     "facts": [{"id": fc["id"], "f": fc["f"], "raw": fc["raw"]} for fc in C.FACTS if fc["role"] == r],       # ONLY this person's private facts
                     "timer": {"start": R.get("step_at"), "server_now": now()},
                     "items": items, "recall_items": [{"id": x["id"], "text": x["text"]} for x in rules.recall_items(T, r)] if R["step"] == "survey" else []}
        return v

    def role_status(self, T, r):
        R = T["roles"].get(r)
        if not R:
            return ["Empty seat", "gray"]
        st = R["step"]
        if st == "card":
            return ["Reading brief", "blue"]
        if st.startswith("post"):
            return [f"Writing · R{round_of(st)}", "blue"]
        if st.startswith("wait"):
            w = now() - (R["wait_since"] or now())
            return [f"Sent R{round_of(st)} · {fmt_t(w)}", "warn" if w > STUCK_S else "ok"]
        if st == "final":
            return ["Deciding", "blue"]
        if st == "survey":
            return ["Survey", "blue"]
        return [{True: "Done · accepted", False: "Done · rejected"}.get(R["endorse"], "Done"), "bad" if R["endorse"] is False else "ok"]

    def team_phase(self, T):
        st = [T["roles"][k]["step"] for k in self.active(T)]
        if T["pending"]:
            return ["Mediator thinking…", "blue"]
        if all(x == "done" for x in st):
            return ["Finished", "ok"]
        if any(x in ("final", "survey") for x in st):
            return ["Final + survey", "blue"]
        if all(x == "card" for x in st):
            return ["Reading briefs", "blue"]
        return [f"Round {max([1] + [round_of(x) for x in st])} of {self.settings['rounds']}", "blue"]

    def stuck_note(self, T):
        if T["pending"]:
            return ""
        waiting = [k for k in self.active(T) if T["roles"][k]["step"].startswith("wait") and now() - (T["roles"][k]["wait_since"] or now()) > STUCK_S]
        if not waiting:
            return ""
        n = round_of(T["roles"][waiting[0]]["step"])
        behind = [C.ROLES[k]["short"] for k in self.active(T) if T["roles"][k]["step"] != f"wait{n}"]
        return f"Waiting on {', '.join(behind)}" if behind else ""

    def _ai_requests(self):
        """Every request sent to the real model this session (from each team's ai_calls)."""
        calls = [c for T in self.teams.values() for c in T.get("ai_calls", [])]
        errs = [(c.get("error") or "").lower() for c in calls if c.get("error")]
        kind = lambda t: ("gateway" if "read timeout" in t else "vpn" if "vpn" in t else "busy" if any(m in t for m in ("429", "concurrent", "queue", "503", "502"))
                          else "timeout" if "timed out" in t or "timeout" in t else "setup" if any(m in t for m in ("401", "403", "not found")) else "other")
        fin, models, errk = {}, {}, {}
        for c in calls:
            if c.get("finish_reason"):
                fin[c["finish_reason"]] = fin.get(c["finish_reason"], 0) + 1
            if c.get("model_returned"):
                models[c["model_returned"]] = models.get(c["model_returned"], 0) + 1
        for t in errs:
            errk[kind(t)] = errk.get(kind(t), 0) + 1
        return {"n": len(calls), "answered": sum(1 for c in calls if "reply" in c), "errors": len(errs), "error_kinds": errk,
                "retries": sum(1 for c in calls if c.get("attempt", 1) > 1),
                "repairs": sum(1 for c in calls if "(repair)" in c.get("purpose", "") and c.get("attempt", 1) == 1),
                "empty": sum(1 for c in calls if "reply" in c and not (c["reply"] or "").strip()),
                "finish": fin, "models": models}

    def ai_view(self):
        """Everything about the Mediator backend, for the admin "AI status" tab."""
        med = self.mediator
        real = getattr(med, "real", False)
        base = os.environ.get("ARC_API_BASE", "") if real else ""
        host = re.sub(r"^https?://", "", base).split("/")[0] if base else ""
        conds = self.settings["conds"]
        teams = [T for T in self.teams.values()]
        flight = self.stats.get("flight", 0)
        return {"config": {"mediator": med.name, "real": real, "model": getattr(med, "model", None), "endpoint": host, "timeout_s": AI_TIMEOUT, "concurrency": AI_CONCURRENCY,
                           "reasoning": getattr(med, "effort", None) or None, "max_tokens": getattr(med, "max_tokens", None), "request_timeout_s": getattr(med, "req_timeout", None),
                           "temperature": getattr(med, "temperature", None), "fallback": self.fallback.name, "test": self.stats.get("ai_test"),
                           "arc_model_cap": 10, "arc_key_cap": 20, "arc": "arc.vt.edu" in base},
                "now": {"flight": flight, "waiting": max(0, self.stats["queue"] - flight)},
                "totals": {"calls": self.stats["calls"], "timeouts": self.stats["timeouts"], "fallbacks": self.stats["fallbacks"], "peak_flight": self.stats.get("peak_flight", 0),
                           "by_failure": {k: sum(1 for x in self.stats.get("log", []) if x["status"] == k) for k in ("timeout", "network", "model")}},
                "log": self.stats.get("log", []),
                "requests": self._ai_requests(),
                "session": {"rounds": self.settings["rounds"], "joined": len(self.seats), "teams": len(teams), "mediated_teams": sum(1 for T in teams if C.COND[T["cond"]]["mediator"]),
                            "mediated_share": (sum(1 for c in conds if C.COND[c]["mediator"]) / len(conds)) if conds else 0, "start": self.session_start}}

    def admin_state(self):
        lat = self.stats["lat"]
        teams = []
        for T in sorted(self.teams.values(), key=lambda t: t["id"]):
            done = all(T["roles"][r]["step"] == "done" for r in self.active(T))
            teams.append({"id": T["id"], "cond": T["cond"], "spare": bool(T.get("spare")), "nonconsent": bool(T.get("nonconsent")),
                          "steps": [T["roles"][r]["step"] for r in self.active(T)], "elapsed": self.team_clock(T), "done": done,
                          "late": bool(T.get("late")), "phase": self.team_phase(T), "note": self.stuck_note(T), "pending": T["pending"],
                          "members": {r: ({"pid": T["roles"][r]["pid"], "pseudo": T["roles"][r]["pseudo"], "status": self.role_status(T, r),
                                           "help": self.seats[T["roles"][r]["pid"]]["help"], "bot": self.seats[T["roles"][r]["pid"]]["bot"],
                                           "persona": SIM.PERSONA_LABEL.get((T["roles"][r].get("sim") or {}).get("persona"), "")}
                                          if T["roles"].get(r) else {"status": ["Empty seat", "gray"]}) for r in C.ROLE_KEYS}})
        seats = list(self.seats.values())
        return {"session": self.sid, "settings": self.settings, "lobby_open": self.lobby_open, "paused": self.paused, "auto_speed": self.auto_speed,
                "broadcast": self.broadcast, "clock": self.clock_now() if self.session_start else None, "clock_rate": self.clock_rate,
                "mediator": self.mediator.name, "used_conds": self.used_conds,
                "stats": {"calls": self.stats["calls"], "avg_s": round(sum(lat) / len(lat), 1) if lat else None,
                          "queue": self.stats["queue"], "timeouts": self.stats["timeouts"], "fallbacks": self.stats["fallbacks"]},
                "bots": sum(1 for s in seats if s["bot"]), "last_batch": len(self.bot_batches[-1]) if self.bot_batches else 0,
                "joined": len(seats), "yes": sum(1 for s in seats if s["consent"] is True), "no": sum(1 for s in seats if s["consent"] is False),
                "answered": sum(1 for s in seats if s["consent"] is not None),
                "helps": [{"pid": s["pid"], "team": s["team"], "label": self.label(self.teams[s["team"]], s["role"]) if s["team"] is not None else ""} for s in seats if s["help"]],
                "late": [{"pid": s["pid"], "consent": s["consent"]} for s in seats if s["late"] and s["team"] is None],
                "teams": teams, "finished": sum(1 for t in teams if t["phase"][0] == "Finished"),
                "stuck": sum(1 for t in teams if t["note"])}

    def analysed(self, consent_only=True):
        return [T for T in sorted(self.teams.values(), key=lambda t: t["id"]) if not T.get("spare") and (not consent_only or not T.get("nonconsent"))]

    def results(self, consent_only=True):
        Ts = self.analysed(consent_only)
        res = [x for x in (rules.team_result(T, self.sid, self.pid_of) for T in Ts) if x]
        facts = [row for T in Ts if T["final"] is not None for row in rules.fact_funnel(T, self.sid, self.pid_of)]
        conds = [c for c in C.COND_KEYS if any(T["cond"] == c for T in self.teams.values())]
        by = []
        for c in conds:
            r = [x for x in res if x["condition"] == c]
            f = [x for x in facts if x["condition"] == c]
            m = lambda k: (sum(x[k] for x in r) / len(r)) if r else None
            sm = lambda k: sum(int(x[k] or 0) for x in f)
            by.append({"cond": c, "label": C.COND[c]["label"], "done": len(r), "teams": sum(1 for T in Ts if T["cond"] == c),
                       "pct_best": m("pct_best"), "pooling": m("pooling_index"), "gems": m("gems"), "decoys": m("decoys"), "accepts": m("accepts"),
                       "facts": len(f), **{k: sm(k) for k in ("mentioned", "spoken", "disclosed_to_mediator", "relayed_by_ai", "heard",
                                                               "heard_and_recalled", "recalled", "integrated", "actioned", "final_follows")},
                       **{k: m(k) for k in ("lost_not_spoken", "lost_not_heard", "lost_not_integrated", "lost_at_final_pick",
                                            "lost_to_wrong_info", "lost_to_budget_math_or_other", "pts_final", "wrong_claims_acted_on")},
                       "talked_outside_app": sum(x["talked_outside_app"] for x in r)})
        return {"by_condition": by, "teams": res, "opt": {"set": rules.OPT_SET, "v": rules.OPT_V}, "naive": {"set": rules.NAIVE_SET, "v": rules.NAIVE_V},
                "excluded_leak": sum(1 for x in res if x["talked_outside_app"])}

    def team_detail(self, tid):
        T = self.teams[tid]
        return {"id": T["id"], "cond": T["cond"], "about": C.COND[T["cond"]]["about"], "spare": T.get("spare"), "nonconsent": T.get("nonconsent"),
                "log": [{k: e.get(k) for k in ("id", "t", "round", "who", "pid", "kind", "text", "set", "private", "mediator", "mediator_error")}
                        | {"label": self.label(T, e["who"]) if e.get("who") in C.ROLES and T["roles"].get(e["who"]) else e.get("who"),
                           "seen_by": [self.pid_of(T, x) for x in T["seen"].get(e["id"], [])]}
                        for e in T["log"] if e["kind"] != "seen"],
                "facts": rules.fact_funnel(T, self.sid, self.pid_of)}

    FEED_KINDS = {"message", "check", "pre", "rating", "endorse", "survey", "draft", "question", "recap", "final"}

    def feed(self, limit=400):
        """Every entry people (and the Mediator) have sent, newest first, plus unsent drafts being typed now."""
        items, typing = [], []
        t0 = self.session_start or 0
        for T in self.teams.values():
            for e in T["log"]:
                if e["kind"] not in self.FEED_KINDS:
                    continue
                who = e.get("who")
                person = who in C.ROLES and T["roles"].get(who)
                seat = self.seats.get(e.get("pid")) if person else None
                items.append({"id": e["id"], "ts": e["ts"], "clock": e["clock"] if e.get("clock") is not None else (e["ts"] - t0 if t0 else None), "t": e.get("t"),
                              "team": T["id"], "cond": T["cond"], "spare": bool(T.get("spare")), "round": e.get("round"),
                              "kind": e["kind"], "who": who, "pid": e.get("pid"), "bot": bool(seat and seat["bot"]),
                              "label": self.label(T, who) if person else who, "text": e.get("text"), "set": e.get("set"),
                              "cost": rules.cost(e["set"]) if e.get("set") else None, "private": e.get("private"),
                              "facts": e.get("facts_tagged") or [], "answers": e.get("answers"), "recall": e.get("recall"),
                              "accepted": e.get("accepted"), "version": e.get("version"),
                              "compose_s": round((e.get("compose") or {}).get("compose_ms", 0) / 1000) or None})
            for r in self.active(T):
                R = T["roles"][r]
                if R["step"].startswith("post") and (R.get("text") or "").strip():
                    seat = self.seats[R["pid"]]
                    typing.append({"team": T["id"], "cond": T["cond"], "pid": R["pid"], "bot": seat["bot"],
                                   "label": self.label(T, r), "who": r, "round": round_of(R["step"]), "text": R["text"]})
        items.sort(key=lambda x: x["ts"], reverse=True)
        return {"items": items[:limit], "total": len(items), "typing": typing}

    def people(self):
        counts = self.db.event_counts(self.sid)
        out = []
        for s in self.seats.values():
            T = self.teams.get(s["team"]) if s["team"] is not None else None
            n, msgs = counts.get(s["pid"], (0, 0))
            out.append({"pid": s["pid"], "bot": s["bot"], "persona": SIM.PERSONA_LABEL.get(s.get("persona"), "") if s["bot"] else "", "team": s["team"], "role": s["role"],
                        "label": self.label(T, s["role"]) if T else None, "cond": T["cond"] if T else None, "consent": s["consent"],
                        "step": T["roles"][s["role"]]["step"] if T else ("late" if s["late"] else "lobby"),
                        "events": n, "msgs": msgs or 0, "in_app": now() - s["joined_at"]})
        return sorted(out, key=lambda x: x["pid"])

    # ------------------------------------------------------------ admin "Watch"
    def watch_view(self, pid):
        """Exactly what this player's phone shows, plus the draft they are typing right now (read-only for admins)."""
        s = self.seats[pid]
        v = self.student_view(s)
        if v.get("team"):
            T = self.teams[s["team"]]
            v["team"]["me"]["draft"] = T["roles"][s["role"]].get("text") or ""
        return v

    def _target_mins(self, step):
        t = self.settings.get("timers", TIMER_DEFAULTS)
        if step == "card":
            return t.get("card", 5)
        if step.startswith("post"):
            return t.get("round1", 6) if step == "post1" else t.get("round", 5)
        return {"final": t.get("final", 1), "survey": t.get("survey", 4)}.get(step)

    def watch_stats(self, pid):
        s = self.seats[pid]
        out = {"pid": pid, "bot": s["bot"], "persona": SIM.PERSONA_LABEL.get(s.get("persona"), "") if s["bot"] else "",
               "consent": s["consent"], "help": s.get("help"), "team": s["team"], "online": None}
        evs = self.db.events(self.sid, pid)
        cnt = lambda t: sum(1 for e in evs if e["type"] == t)
        out["counts"] = {"paste_blocked": cnt("paste_blocked"), "copy_blocked": cnt("copy_blocked"), "left_app": cnt("left_app"),
                         "time_warning": cnt("time_warning"), "help": cnt("help"), "tab": cnt("tab"), "pick": cnt("pick"),
                         "keys": sum(int((e.get("details") or {}).get("keys") or 0) for e in evs if e["type"] == "message")}
        out["events"] = evs[-40:]
        out["joined_at"] = s["joined_at"]
        out["rate"] = 0.0 if self.paused else float(self.auto_speed or 1.0)
        if s["team"] is None:
            out["step"] = "lobby" if s["consent"] is not None else "consent"
            return out
        T = self.teams[s["team"]]
        r = s["role"]; R = T["roles"][r]
        rate = self.clock_rate or 1.0
        on_step_real = now() - (R.get("step_at") or now())
        out.update({"cond": T["cond"], "cond_label": C.COND[T["cond"]]["label"], "role": r, "label": self.label(T, r),
                    "spare": bool(T.get("spare")), "nonconsent": bool(T.get("nonconsent")),
                    "step": R["step"], "on_step": on_step_real * (self.auto_speed or 1.0),
                    "target_mins": self._target_mins(R["step"]), "picks": sorted(R.get("picks") or []),
                    "cost": rules.cost(R.get("picks") or []), "budget": C.BUDGET, "draft": R.get("text") or "",
                    "endorse": R.get("endorse"), "survey": {k: v for k, v in (R.get("sv") or {}).items()}, "recall": R.get("recall") or [],
                    "pre": R.get("pre") or {}, "chk": R.get("chk") or {}, "team_elapsed": self.team_clock(T), "final": T.get("final"),
                    "ratings": {e["msg"]: (e.get("text") or "").split(":")[0] for e in T["log"] if e["kind"] == "rating" and e.get("who") == r and e.get("msg")}})
        msgs = [e for e in T["log"] if e["kind"] == "message" and e.get("who") == r]
        out["messages"] = [{"round": e.get("round"), "text": e.get("text"), "set": e.get("set"), "private": e.get("private"), "t": e.get("t"),
                            "facts": e.get("facts_tagged") or []} for e in msgs]
        out["words"] = sum(len((e.get("text") or "").split()) for e in msgs)
        ff = {row["fact"]: row for row in rules.fact_funnel(T, self.sid, self.pid_of)}
        out["findings"] = [{"id": fc["id"], "f": fc["f"], "name": next((f["name"] for f in C.FEATURES if f["id"] == fc["f"]), fc["f"]),
                            "dir": fc["dir"], "raw": fc.get("raw", ""),
                            **{k: bool((ff.get(fc["id"]) or {}).get(k)) for k in ("mentioned", "spoken", "heard", "integrated", "actioned")}}
                           for fc in C.FACTS if fc["role"] == r]
        out["claims"] = {e["id"]: rules.claims(e.get("text") or "") for e in T["log"] if e["kind"] in ("message", "draft", "recap", "question")}
        out["true"] = {f["id"]: rules.true_val(f["id"]) for f in C.FEATURES}
        out["opt"] = rules.OPT_V
        out["final_value"] = rules.value_of(T["final"]) if T.get("final") else None
        out["picks_value"] = rules.value_of(R.get("picks") or [])
        out["mates"] = [{"role": k, "label": self.label(T, k), "step": T["roles"][k]["step"], "bot": self.seat_of(T, k)["bot"], "pid": T["roles"][k]["pid"],
                         "persona": SIM.PERSONA_LABEL.get((T["roles"][k].get("sim") or {}).get("persona"), "")} for k in self.active(T) if k != r]
        return out

    def wall(self):
        """One small live card per placed player."""
        rows = []
        for T in sorted(self.teams.values(), key=lambda t: t["id"]):
            for r in self.active(T):
                R = T["roles"][r]; s = self.seat_of(T, r)
                last = next((e for e in reversed(T["log"]) if e["kind"] == "message" and e.get("who") == r), None)
                rows.append({"pid": R["pid"], "team": T["id"], "cond": T["cond"], "role": r, "label": self.label(T, r), "bot": s["bot"],
                             "persona": SIM.PERSONA_LABEL.get((R.get("sim") or {}).get("persona"), "") if s["bot"] else "",
                             "step": R["step"], "on_step": (now() - (R.get("step_at") or now())) * (self.auto_speed or 1.0), "target_mins": self._target_mins(R["step"]),
                             "draft": R.get("text") or "" if R["step"].startswith("post") else "", "picks": sorted(R.get("picks") or []),
                             "cost": rules.cost(R.get("picks") or []), "last": (last or {}).get("text"), "help": s.get("help"),
                             "spare": bool(T.get("spare")), "nonconsent": bool(T.get("nonconsent"))})
        lobby = [{"pid": s["pid"], "bot": s["bot"], "consent": s["consent"]} for s in self.seats.values() if s["team"] is None]
        return {"players": rows, "lobby": lobby, "auto_speed": self.auto_speed, "rate": 0.0 if self.paused else float(self.auto_speed or 1.0)}

    def person(self, pid):
        s = self.seats[pid]
        T = self.teams.get(s["team"]) if s["team"] is not None else None
        return {"pid": pid, "bot": s["bot"], "persona": SIM.PERSONA_LABEL.get(s.get("persona"), "") if s["bot"] else "", "consent": s["consent"], "joined_at": s["joined_at"], "team": s["team"],
                "label": self.label(T, s["role"]) if T else None, "cond": T["cond"] if T else None,
                "step": T["roles"][s["role"]]["step"] if T else None, "events": self.db.events(self.sid, pid)}

    def participants_rows(self, consent_only=True):
        rows = []
        for s in self.seats.values():
            if consent_only and not s["consent"]:
                continue
            T = self.teams.get(s["team"]) if s["team"] is not None else None
            R = T["roles"][s["role"]] if T else None
            rows.append({"session": self.sid, "pid": s["pid"], "simulated": int(s["bot"]), "consent": "" if s["consent"] is None else int(s["consent"]),
                         "team": s["team"] if s["team"] is not None else "", "role": s["role"] or "", "nickname": R["pseudo"] if R else "",
                         "condition": T["cond"] if T else "", "spare": int(bool(T.get("spare"))) if T else "", "late": int(bool(T.get("late"))) if T else int(s["late"]),
                         "brief_check_role": int(R["chk"].get("role") == s["role"]) if R and R["chk"] else "",
                         "brief_check_privacy": int(R["chk"].get("see") == "no") if R and R["chk"] else "",
                         **{f"pre_{k}": (R["pre"].get(k, "") if R else "") for k, _ in C.PRE},
                         **{f"post_{k}": (R["sv"].get(k, "") if R else "") for k, _ in C.POST_COMMON + C.POST_AI},
                         "post_leak": R["sv"].get("leak", "") if R else "", "recall": " ".join(R["recall"]) if R else "",
                         "accepted": "" if not R or R["endorse"] is None else int(R["endorse"]), "finished": int(bool(R) and R["step"] == "done")})
        return rows


    # ------------------------------------------------------------ live charts
    def charts(self, consent_only=True):
        colors = {"caucus": "#332288", "facilitated": "#44AA99", "summary_only": "#117733", "unmediated": "#CC6677"}
        Ts = self.analysed(consent_only)
        keys = [c for c in (self.used_conds or self.settings["conds"]) if c in C.COND]
        keys += [c for c in C.COND_KEYS if c not in keys and any(T["cond"] == c for T in Ts)]
        out = []
        for c in keys:
            mine = [T for T in Ts if T["cond"] == c]
            teams, prog = [], {k: 0 for k in ("card", "writing", "waiting", "final", "survey", "done")}
            ratings = {"Agree": 0, "Partly": 0, "Disagree": 0}
            n_msg = words = people = 0
            secs = []
            for T in mine:
                act = self.active(T)
                people += len(act)
                for r in act:
                    st = T["roles"][r]["step"]
                    prog["writing" if st.startswith("post") else "waiting" if st.startswith("wait") else st] += 1
                for e in T["log"]:
                    if e["kind"] == "rating":
                        v = (e.get("text") or "").split(":")[0]
                        if v in ratings:
                            ratings[v] += 1
                    if e["kind"] == "message" and not e.get("closed_by_researcher"):
                        n_msg += 1
                        words += len((e.get("text") or "").split())
                        cp = e.get("compose") or {}
                        if cp.get("compose_ms") and not cp.get("simulated"):
                            secs.append(cp["compose_ms"] / 1000)
                if T["final"] is None:
                    continue
                ff = rules.fact_funnel(T, self.sid, self.pid_of)
                pts = rules.points(T, ff)
                gems = {}
                for r in C.ROLE_KEYS:
                    g = [fc["f"] for fc in C.FACTS if fc["role"] == r and fc["dir"] > 0]
                    gems[r] = (sum(1 for f in g if f in T["final"]) / len(g)) if T["roles"].get(r) else None
                sv = [T["roles"][r]["sv"] for r in act if T["roles"][r]["sv"].get("sat")]
                teams.append({"id": T["id"], "frac": rules.value_of(T["final"]) / rules.OPT_V, "pts": rules.value_of(T["final"]),
                              "pooling": rules.pooling_index(T["final"]),
                              "steps": {k: sum(int(x[k] or 0) for x in ff) for k in ("spoken", "heard", "integrated", "actioned")},
                              "facts": len(ff), "gems": gems, "decoys": sum(1 for f in rules.DECOYS if f in T["final"]),
                              "lost": {"ns": pts["lost_not_spoken"], "nh": pts["lost_not_heard"], "ni": pts["lost_not_integrated"],
                                       "wrong": pts["lost_to_wrong_info"], "other": pts["lost_to_budget_math_or_other"]},
                              "sat": (sum(x["sat"] for x in sv) / len(sv)) if sv else None,
                              "felt_heard": (sum(1 for x in sv if x.get("heard", 0) >= 4) / len(sv)) if sv else None,
                              "accepts": sum(1 for r in act if T["roles"][r]["endorse"] is True)})
            out.append({"key": c, "label": C.COND[c]["label"], "color": colors[c], "teams": teams, "progress": prog, "ratings": ratings,
                        "msgs": {"count": n_msg, "per_person": n_msg / people if people else 0, "words": words / n_msg if n_msg else 0,
                                 "secs": sum(secs) / len(secs) if secs else 0}})
        studs = [r for T in Ts for r in self.active(T)]
        return {"updated": now() * 1000, "consent_only": consent_only, "opt": rules.OPT_V, "opt_set": list(rules.OPT_SET), "naive_pts": rules.NAIVE_V,
                "session": self.sid, "mediator": self.mediator.name, "rounds": self.settings["rounds"], "single_pts": rules.SINGLE_V,
                "simulated_students": sum(1 for T in Ts for r in self.active(T) if self.seat_of(T, r)["bot"]),
                "excluded": {"spare": sum(1 for T in self.teams.values() if T.get("spare")),
                             "nonconsent": sum(1 for T in self.teams.values() if T.get("nonconsent") and not T.get("spare")) if consent_only else 0},
                "naive_frac": rules.NAIVE_V / rules.OPT_V, "single_frac": rules.SINGLE_V / rules.OPT_V,
                "totals": {"teams": len(Ts), "finished": sum(1 for T in Ts if T["final"] is not None and all(T["roles"][r]["step"] == "done" for r in self.active(T))),
                           "students": len(studs), "done_students": sum(1 for T in Ts for r in self.active(T) if T["roles"][r]["step"] == "done")},
                "conds": out}
