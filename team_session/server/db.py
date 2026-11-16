"""SQLite storage. Every write is committed right away, so the file is always current
and a crash loses nothing. WAL mode lets you open the file read-only (e.g. in DB Browser
for SQLite or pandas) while a session is running.

Tables
  sessions      one row per class session (settings + live state as JSON)
  participants  one row per person: pid, consent, team, role, nickname, ...
  teams         one row per team: condition, flags, final set, full live state as JSON
  events        EVERY action a person takes (taps, answers, typing pauses, sends, tab switches...)
  team_log      every message, Mediator card, vote and decision, in team order
"""
import json
import sqlite3
import threading
import time

SCHEMA = """
CREATE TABLE IF NOT EXISTS sessions(
  id TEXT PRIMARY KEY, created_at REAL, class_code TEXT, state_json TEXT);
CREATE TABLE IF NOT EXISTS participants(
  pid TEXT PRIMARY KEY, session_id TEXT, token TEXT UNIQUE, bot INTEGER, joined_at REAL,
  consent INTEGER, team_id INTEGER, role TEXT, nickname TEXT, late INTEGER, help INTEGER, seat_json TEXT);
CREATE TABLE IF NOT EXISTS teams(
  session_id TEXT, id INTEGER, condition TEXT, spare INTEGER, nonconsent INTEGER, late INTEGER,
  final_set TEXT, state_json TEXT, PRIMARY KEY(session_id, id));
CREATE TABLE IF NOT EXISTS events(
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, ts REAL, time_iso TEXT, pid TEXT, bot INTEGER,
  team_id INTEGER, role TEXT, condition TEXT, step TEXT, type TEXT, details TEXT);
CREATE TABLE IF NOT EXISTS team_log(
  session_id TEXT, team_id INTEGER, log_id TEXT, seq INTEGER, ts REAL, round TEXT, who TEXT, pid TEXT,
  kind TEXT, text TEXT, picks TEXT, private INTEGER, extra TEXT, PRIMARY KEY(session_id, log_id));
CREATE INDEX IF NOT EXISTS events_pid ON events(session_id, pid);
CREATE INDEX IF NOT EXISTS events_team ON events(session_id, team_id);
CREATE INDEX IF NOT EXISTS log_team ON team_log(session_id, team_id);
"""


def iso(ts):
    return time.strftime("%Y-%m-%dT%H:%M:%S", time.localtime(ts)) + f".{int(ts * 1000) % 1000:03d}"


class DB:
    def __init__(self, path):
        self.path = path
        self.lock = threading.Lock()
        self.conn = sqlite3.connect(path, check_same_thread=False, isolation_level=None)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL")
        self.conn.execute("PRAGMA synchronous=NORMAL")
        self.conn.executescript(SCHEMA)

    def x(self, sql, args=()):
        with self.lock:
            return self.conn.execute(sql, args)

    def q(self, sql, args=()):
        with self.lock:
            return [dict(r) for r in self.conn.execute(sql, args).fetchall()]

    # ---- writes
    def save_session(self, sid, created, code, state):
        self.x("INSERT INTO sessions(id, created_at, class_code, state_json) VALUES(?,?,?,?) "
               "ON CONFLICT(id) DO UPDATE SET class_code=excluded.class_code, state_json=excluded.state_json",
               (sid, created, code, json.dumps(state)))

    def save_seat(self, sid, s, nickname):
        self.x("INSERT INTO participants VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(pid) DO UPDATE SET "
               "consent=excluded.consent, team_id=excluded.team_id, role=excluded.role, nickname=excluded.nickname, "
               "late=excluded.late, help=excluded.help, seat_json=excluded.seat_json",
               (s["pid"], sid, s["token"], int(s["bot"]), s["joined_at"], None if s["consent"] is None else int(s["consent"]),
                s["team"], s["role"], nickname, int(s["late"]), int(s["help"]), json.dumps(s)))

    def save_team(self, sid, T):
        self.x("INSERT INTO teams VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(session_id, id) DO UPDATE SET "
               "final_set=excluded.final_set, state_json=excluded.state_json",
               (sid, T["id"], T["cond"], int(bool(T.get("spare"))), int(bool(T.get("nonconsent"))), int(bool(T.get("late"))),
                None if T.get("final") is None else " ".join(T["final"]), json.dumps(T)))

    def add_event(self, sid, ev):
        self.x("INSERT INTO events(session_id, ts, time_iso, pid, bot, team_id, role, condition, step, type, details) "
               "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
               (sid, ev["ts"], iso(ev["ts"]), ev["pid"], int(ev["bot"]), ev["team"], ev["role"], ev["condition"],
                ev["step"], ev["type"], json.dumps(ev["d"])))

    def add_log(self, sid, e):
        core = {"id", "seq", "ts", "round", "who", "pid", "kind", "text", "set", "private", "t", "session", "team", "condition"}
        self.x("INSERT INTO team_log VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
               (sid, e["team"], e["id"], e["seq"], e["ts"], str(e.get("round")), e.get("who"), e.get("pid"), e["kind"],
                e.get("text"), " ".join(e.get("set") or []), int(bool(e.get("private"))),
                json.dumps({k: v for k, v in e.items() if k not in core})))

    # ---- reads
    def latest_session(self):
        r = self.q("SELECT * FROM sessions ORDER BY created_at DESC LIMIT 1")
        return r[0] if r else None

    def seats(self, sid):
        return [json.loads(r["seat_json"]) for r in self.q("SELECT seat_json FROM participants WHERE session_id=?", (sid,))]

    def teams(self, sid):
        return [json.loads(r["state_json"]) for r in self.q("SELECT state_json FROM teams WHERE session_id=? ORDER BY id", (sid,))]

    def events(self, sid, pid=None):
        if pid:
            rows = self.q("SELECT * FROM events WHERE session_id=? AND pid=? ORDER BY id", (sid, pid))
        else:
            rows = self.q("SELECT * FROM events WHERE session_id=? ORDER BY id", (sid,))
        for r in rows:
            r["details"] = json.loads(r["details"])
        return rows

    def event_counts(self, sid):
        return {r["pid"]: (r["n"], r["msgs"]) for r in self.q(
            "SELECT pid, COUNT(*) n, SUM(type='message') msgs FROM events WHERE session_id=? GROUP BY pid", (sid,))}

    def delete_people(self, sid, pids):
        """Remove people completely (used to undo simulated students before teams are formed)."""
        if not pids:
            return
        marks = ",".join("?" * len(pids))
        self.x(f"DELETE FROM events WHERE session_id=? AND pid IN ({marks})", (sid, *pids))
        self.x(f"DELETE FROM participants WHERE session_id=? AND pid IN ({marks})", (sid, *pids))

    def checkpoint(self):
        self.x("PRAGMA wal_checkpoint(FULL)")
