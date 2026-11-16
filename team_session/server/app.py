"""Web server. Run from the team_session folder:

    uvicorn server.app:app --host 0.0.0.0 --port 8000

Students open  http://<this-computer>:8000/
Admin opens    http://<this-computer>:8000/admin   (PIN from ADMIN_PIN, default 1234)
"""
import asyncio
import csv
import io
import json
import os
import secrets
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles

from . import content as C
from . import rules
from .db import DB
from .game import Game

HERE = Path(__file__).parent
DB_PATH = os.environ.get("DB_PATH", str(HERE.parent / "data" / "session.sqlite3"))
Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
ADMIN_PIN = os.environ.get("ADMIN_PIN", "1234")

app = FastAPI(title="Team Design Session")
app.mount("/static", StaticFiles(directory=HERE / "static"), name="static")
db = DB(DB_PATH)
game = Game(db)
admin_tokens: set[str] = set()
sockets: dict[str, set] = {}      # pid -> websockets
admin_sockets: set = set()


# ------------------------------------------------------------------ live updates
async def push():
    """Tell the right browsers that something changed. They then re-fetch their view."""
    game.settle_clock()
    targets = set()
    if game.dirty_all:
        for ws_set in sockets.values():
            targets |= ws_set
    else:
        for pid in game.dirty:
            targets |= sockets.get(pid, set())
    send_admin = game.admin_dirty
    game.dirty, game.dirty_all, game.admin_dirty = set(), False, False
    if send_admin:
        targets |= admin_sockets
    for ws in list(targets):
        try:
            await ws.send_text('{"t":"update"}')
        except Exception:  # noqa: BLE001
            pass

game.on_change = push


@app.on_event("startup")
async def startup():
    await game.resume_pending()
    asyncio.get_running_loop().create_task(admin_ticker())
    asyncio.get_running_loop().create_task(auto_runner())


async def auto_runner():
    """Full simulation: every second, let simulated students who are 'due' take their turn."""
    while True:
        await asyncio.sleep(1)
        if not game.auto_speed:
            continue
        try:
            async with game.lock:
                game.settle_clock()
                acted = game.auto_tick()
                if acted:
                    game.check_steps()
                    game.save_session()
        except Exception:  # noqa: BLE001  keep the simulation alive; the error goes to the server log
            import traceback
            traceback.print_exc()
            acted = False
        if acted:
            await push()


async def admin_ticker():
    """Waiting timers and 'stuck' flags change with time, so nudge admin screens every 5 s."""
    while True:
        await asyncio.sleep(5)
        for ws in list(admin_sockets):
            try:
                await ws.send_text('{"t":"tick"}')
            except Exception:  # noqa: BLE001
                pass


def seat_by_token(token):
    pid = game.tokens.get(token or "")
    if not pid:
        raise HTTPException(404, "unknown token")
    return game.seats[pid]


def need_admin(request: Request):
    tok = request.headers.get("x-admin") or request.query_params.get("admin")
    if tok not in admin_tokens:
        raise HTTPException(401, "admin login required")


# ------------------------------------------------------------------ pages
@app.get("/", response_class=HTMLResponse)
@app.get("/admin", response_class=HTMLResponse)
@app.get("/watch", response_class=HTMLResponse)
@app.get("/projector", response_class=HTMLResponse)
async def page():
    return FileResponse(HERE / "static" / "index.html")


@app.get("/api/content")
async def content():
    return C.public_content()


# ------------------------------------------------------------------ students
@app.post("/api/join")
async def join(body: dict):
    async with game.lock:
        if str(body.get("code", "")).strip().upper() != game.settings["class_code"]:
            raise HTTPException(400, "That code doesn't match. Check the code on the screen.")
        s = game.join()
        v = game.student_view(s)
    await push()
    return {"token": s["token"], "view": v}


@app.get("/api/me")
async def me(token: str):
    async with game.lock:
        return game.student_view(seat_by_token(token))


@app.post("/api/act")
async def act(body: dict):
    async with game.lock:
        s = seat_by_token(body.get("token"))
        game.student_act(s, body)
        game.check_steps()
        v = game.student_view(s)
    await push()
    return v


@app.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await ws.accept()
    token, admin = ws.query_params.get("token"), ws.query_params.get("admin")
    pid = game.tokens.get(token or "")
    is_admin = admin in admin_tokens
    if not pid and not is_admin:
        await ws.close()
        return
    (admin_sockets.add(ws) if is_admin else sockets.setdefault(pid, set()).add(ws))
    try:
        while True:
            await ws.receive_text()      # keep-alive pings from the browser
    except WebSocketDisconnect:
        pass
    finally:
        if is_admin:
            admin_sockets.discard(ws)
        else:
            sockets.get(pid, set()).discard(ws)


# ------------------------------------------------------------------ admin
@app.post("/api/admin/login")
async def admin_login(body: dict):
    if str(body.get("pin")) != ADMIN_PIN:
        raise HTTPException(401, "Wrong PIN.")
    t = secrets.token_urlsafe(16)
    admin_tokens.add(t)
    return {"admin": t}


@app.get("/api/admin/state")
async def admin_state(request: Request):
    need_admin(request)
    async with game.lock:
        return game.admin_state()


@app.post("/api/admin/act")
async def admin_act(request: Request, body: dict):
    need_admin(request)
    msg = ""
    async with game.lock:
        typ = body.get("type")
        if typ == "addbots":
            game.add_bots(int(body.get("n", 12)))
            msg = f"Added {body.get('n')} simulated students."
        elif typ in ("undobots", "clearbots"):
            n = game.remove_bots(last_only=(typ == "undobots"))
            msg = f"Removed {n} simulated students." if n else "Nothing to remove."
        elif typ == "autorun":
            game.auto_speed = max(0, min(120, float(body.get("speed", 0))))
            if game.auto_speed and game.lobby_open and game.seats:
                n, conds = game.form_teams()
                msg = f"Formed {len(game.teams)} teams from {n} students and started the simulation at {game.auto_speed:g}x."
            else:
                msg = f"Simulation running at {game.auto_speed:g}x." if game.auto_speed else "Simulation stopped."
            game.admin_dirty = True
        elif typ == "form" and game.lobby_open:
            n, conds = game.form_teams()
            msg = f"Formed {len(game.teams)} teams from {n} students" + (
                f" (fewer than {game.settings['threshold']} joined, so using {len(conds)} types)." if len(conds) < len(game.settings["conds"]) else ".")
        elif typ == "pause":
            game.paused = not game.paused
            if game.paused:
                game.pause_at = time.time()
            elif game.pause_at:
                game.shift_timers(time.time() - game.pause_at)
                game.pause_at = None
            game.dirty_all = True
        elif typ == "broadcast":
            game.broadcast = str(body.get("msg", ""))[:300]
            game.dirty_all = True
        elif typ == "close":
            game.force_close(game.teams[int(body["team"])])
        elif typ == "solo":
            game.give_solo(body["pid"])
        elif typ == "resolve":
            s = game.seats[body["pid"]]
            s["help"] = False
            game.track(s, "help_resolved_by_researcher")
            game.save_seat(s)
            game.dirty.add(s["pid"])
        elif typ == "sim":
            game.simulate_step(float(body.get("p", 0.75)), team_id=body.get("team"), skip_pid=body.get("skip"))
        elif typ == "settings" and game.lobby_open:
            st = game.settings
            st["class_code"] = str(body.get("class_code", st["class_code"])).strip().upper() or "SD26"
            st["rounds"] = max(1, min(4, int(body.get("rounds", st["rounds"]))))
            st["threshold"] = max(0, int(body.get("threshold", st["threshold"])))
            if body.get("conds"):
                st["conds"] = [c for c in body["conds"] if c in C.COND]
            if "fallback" in body:
                st["fallback"] = [c for c in body["fallback"] if c in C.COND]
            msg = "Saved."
        elif typ == "timers":
            t = game.settings.setdefault("timers", {})
            t["on"] = bool(body.get("on", True))
            for k in ("card", "round1", "round", "final", "survey"):
                if k in body:
                    t[k] = max(0.5, min(30, float(body[k])))
            game.dirty_all = True
            msg = "Timers saved. Players see the new times right away."
        elif typ == "new_session":
            game.new_session(dict(game.settings))
            msg = f"Started a new session: {game.sid}. Old data stays in the database."
        game.check_steps()
        game.save_session()
        game.admin_dirty = True
    await push()
    return {"ok": True, "msg": msg}


@app.get("/api/admin/results")
async def admin_results(request: Request, consent_only: int = 1):
    need_admin(request)
    async with game.lock:
        return game.results(bool(consent_only))


@app.get("/api/admin/charts")
async def admin_charts(request: Request, consent_only: int = 1):
    need_admin(request)
    async with game.lock:
        return game.charts(bool(consent_only))


@app.get("/api/admin/team/{tid}")
async def admin_team(request: Request, tid: int):
    need_admin(request)
    async with game.lock:
        return game.team_detail(tid)


@app.get("/api/admin/view/{pid}")
async def admin_view(pid: str, request: Request):
    need_admin(request)
    async with game.lock:
        if pid not in game.seats:
            raise HTTPException(404, "No such participant.")
        return game.watch_view(pid)


@app.get("/api/admin/watch/{pid}")
async def admin_watch(pid: str, request: Request):
    need_admin(request)
    async with game.lock:
        if pid not in game.seats:
            raise HTTPException(404, "No such participant.")
        out = game.watch_stats(pid)
        out["online"] = bool(sockets.get(pid))
        return out


@app.get("/api/admin/wall")
async def admin_wall(request: Request):
    need_admin(request)
    async with game.lock:
        out = game.wall()
        for row in out["players"]:
            row["online"] = bool(sockets.get(row["pid"]))
        return out


@app.get("/api/admin/ai")
async def admin_ai(request: Request):
    need_admin(request)
    async with game.lock:
        return game.ai_view()


@app.get("/api/admin/feed")
async def admin_feed(request: Request):
    need_admin(request)
    async with game.lock:
        return game.feed()


@app.get("/api/admin/people")
async def admin_people(request: Request):
    need_admin(request)
    async with game.lock:
        return game.people()


@app.get("/api/admin/person/{pid}")
async def admin_person(request: Request, pid: str):
    need_admin(request)
    async with game.lock:
        if pid not in game.seats:
            raise HTTPException(404)
        return game.person(pid)


def csv_response(rows, name):
    buf = io.StringIO()
    if rows:
        w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return Response(buf.getvalue(), media_type="text/csv",
                    headers={"Content-Disposition": f'attachment; filename="{game.sid}_{name}.csv"'})


@app.get("/api/admin/export/{name}")
async def export(request: Request, name: str, consent_only: int = 1):
    need_admin(request)
    co = bool(consent_only)
    async with game.lock:
        ok = lambda T: not co or not T.get("nonconsent")
        if name == "results.csv":
            return csv_response(game.results(co)["teams"], "results")
        if name == "facts.csv":
            return csv_response([r for T in game.teams.values() if T["final"] is not None and ok(T)
                                 for r in rules.fact_funnel(T, game.sid, game.pid_of)], "facts")
        if name == "messages.csv":
            rows = []
            for T in game.teams.values():
                if not ok(T):
                    continue
                for e in T["log"]:
                    if e["kind"] in ("message", "question", "recap", "draft", "final"):
                        rows.append({"session": game.sid, "team": T["id"], "condition": T["cond"], "id": e["id"], "time": e["t"],
                                     "round": e["round"], "who": e["who"], "pid": e.get("pid") or "", "kind": e["kind"],
                                     "channel": ("private" if e.get("private") else "team") if e["kind"] == "message" else ("team" if C.COND[T["cond"]]["shared"] else "private"),
                                     "text": e["text"], "set": " ".join(e.get("set") or []), "facts_tagged": " ".join(e.get("facts_tagged") or []),
                                     "seen_by": " ".join(game.pid_of(T, x) for x in T["seen"].get(e["id"], [])),
                                     "mediator": e.get("mediator", "")})
            return csv_response(rows, "messages")
        if name in ("coding_sample.csv", "coding_all.csv"):
            rows = [r for T in sorted(game.teams.values(), key=lambda t: t["id"]) if ok(T) and not T.get("spare")
                    for r in rules.coding_rows(T, game.sid, game.pid_of)]
            if name == "coding_sample.csv":
                import random as _r
                rng = _r.Random(game.sid)                      # same 20% every time for this session
                rows = sorted(rng.sample(rows, max(1, round(len(rows) * 0.2))) if rows else [], key=lambda x: (x["team"], x["item_id"]))
            return csv_response(rows, name[:-4])
        if name == "participants.csv":
            return csv_response(game.participants_rows(co), "participants")
        if name == "events.csv":
            keep = {s["pid"] for s in game.seats.values() if not co or s["consent"]}
            return csv_response([{**{k: v for k, v in e.items() if k != "details"}, "details": json.dumps(e["details"])}
                                 for e in db.events(game.sid) if e["pid"] in keep], "events")
        if name == "all.json":
            data = {"session": game.sid, "settings": game.settings, "teams": [T for T in game.teams.values() if ok(T)],
                    "participants": game.participants_rows(co)}
            return Response(json.dumps(data, indent=1), media_type="application/json",
                            headers={"Content-Disposition": f'attachment; filename="{game.sid}_all.json"'})
        if name == "database.sqlite3":
            db.checkpoint()
            return FileResponse(DB_PATH, filename=f"{game.sid}_database.sqlite3")
    raise HTTPException(404)


# ------------------------------------------------------------------ saved sessions (one folder each)
# "Save this session" writes a folder under data/saved/. It holds a frozen copy of every admin screen
# (view/) and every data download (data/). The admin page can open a folder later and browse it with
# the same tabs, read-only. The live session is never changed by opening a saved one.
import re as _re, shutil as _shutil, zipfile as _zipfile, pathlib as _pathlib
SAVED_DIR = _pathlib.Path(DB_PATH).parent / "saved"
_SAFE = _re.compile(r"^[A-Za-z0-9_\-]+$")
_EXPORTS = ["results.csv", "facts.csv", "messages.csv", "participants.csv", "events.csv", "coding_all.csv", "coding_sample.csv", "all.json"]


def _saved_dir(sid):
    if not _SAFE.match(sid or ""):
        raise HTTPException(404, "No such saved session.")
    d = SAVED_DIR / sid
    if not d.is_dir():
        raise HTTPException(404, "No such saved session.")
    return d


def _dump(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj), encoding="utf-8")


@app.get("/api/admin/saved")
async def saved_list(request: Request):
    need_admin(request)
    out = []
    if SAVED_DIR.is_dir():
        for d in SAVED_DIR.iterdir():
            try:
                out.append(json.loads((d / "meta.json").read_text(encoding="utf-8")))
            except Exception:
                pass
    return sorted(out, key=lambda m: -m.get("saved_at", 0))


@app.post("/api/admin/saved")
async def saved_create(request: Request, body: dict):
    need_admin(request)
    st = dict(await admin_state(request))
    if not st.get("joined"):
        raise HTTPException(400, "Nothing to save yet. Students need to join first.")
    name = (str(body.get("name") or "").strip() or st["session"])[:60]
    slug = _re.sub(r"[^A-Za-z0-9]+", "-", name).strip("-")[:40] or "session"
    sid = time.strftime("%Y%m%d-%H%M%S") + "_" + slug
    d = SAVED_DIR / sid
    v = d / "view"
    try:
        st.update(auto_speed=0, clock_rate=0, paused=False)       # frozen: clocks do not run in a saved copy
        _dump(v / "state.json", st)
        for co in (1, 0):
            _dump(v / f"results_{co}.json", await admin_results(request, co))
            _dump(v / f"charts_{co}.json", await admin_charts(request, co))
        _dump(v / "feed.json", await admin_feed(request))
        ai = await admin_ai(request)
        ai["now"] = {"flight": 0, "waiting": 0}
        _dump(v / "ai.json", ai)
        _dump(v / "people.json", await admin_people(request))
        wall = await admin_wall(request)
        wall.update(rate=0.0, auto_speed=0)
        for row in wall["players"]:
            row["online"] = False
        _dump(v / "wall.json", wall)
        for pid in list(game.seats):
            _dump(v / "person" / f"{pid}.json", await admin_person(request, pid))
            w = await admin_watch(pid, request)
            w.update(rate=0.0, online=False)
            _dump(v / "watch" / f"{pid}.json", w)
            _dump(v / "view" / f"{pid}.json", await admin_view(pid, request))
        for tid in list(game.teams):
            _dump(v / "team" / f"{tid}.json", await admin_team(request, tid))
        for co, folder in ((1, "consenting_only"), (0, "everyone")):
            (d / "data" / folder).mkdir(parents=True, exist_ok=True)
            for nm in _EXPORTS:
                try:
                    r = await export(request, nm, co)
                    (d / "data" / folder / nm).write_bytes(r.body)
                except Exception:
                    pass
        meta = {"id": sid, "name": name, "session": st["session"], "saved_at": time.time(), "joined": st["joined"],
                "bots": st.get("bots", 0), "teams": len(st["teams"]), "finished": st.get("finished", 0)}
        (d / "README.txt").write_text(
            f"Team Design Session - saved session\n\nName: {name}\nSession: {st['session']}\nSaved: {time.strftime('%Y-%m-%d %H:%M')}\n"
            f"Students: {meta['joined']} ({meta['bots']} simulated)\nTeams: {meta['teams']} ({meta['finished']} finished)\n\n"
            "data/consenting_only/  data files with only students who said yes to research use\n"
            "data/everyone/         the same files with every student\n"
            "  results.csv       one row per team: final design, score, the four steps\n"
            "  facts.csv         one row per private finding per team\n"
            "  messages.csv      every message and Mediator card\n"
            "  participants.csv  one row per student\n"
            "  events.csv        everything every student did, with times\n"
            "  coding_all.csv / coding_sample.csv  messages set up for hand coding\n"
            "  all.json          everything in one file\n"
            "view/                 a frozen copy of every admin screen (charts, results, each player's screen and log).\n"
            "                      The admin page reads this when you open the saved session.\n", encoding="utf-8")
        _dump(d / "meta.json", meta)
    except Exception:
        _shutil.rmtree(d, ignore_errors=True)
        raise
    return meta


@app.get("/api/admin/saved/{sid}/api/{path:path}")
async def saved_api(request: Request, sid: str, path: str, consent_only: int = 1):
    need_admin(request)
    d = _saved_dir(sid) / "view"
    parts = path.strip("/").split("/")
    if len(parts) > 2 or any(not _SAFE.match(p) for p in parts):
        raise HTTPException(404)
    if len(parts) == 1:
        nm = parts[0] + (f"_{1 if consent_only else 0}" if parts[0] in ("results", "charts") else "")
        f = d / f"{nm}.json"
    else:
        f = d / parts[0] / f"{parts[1]}.json"
    if not f.is_file():
        raise HTTPException(404, "Not in this saved session.")
    return Response(f.read_bytes(), media_type="application/json")


@app.get("/api/admin/saved/{sid}/export/{name}")
async def saved_export(request: Request, sid: str, name: str, consent_only: int = 1):
    need_admin(request)
    d = _saved_dir(sid)
    if name not in _EXPORTS:
        raise HTTPException(404, "That file is not kept in saved sessions.")
    f = d / "data" / ("consenting_only" if consent_only else "everyone") / name
    if not f.is_file():
        raise HTTPException(404)
    return FileResponse(str(f), filename=f"{sid}_{name}")


@app.get("/api/admin/saved/{sid}/zip")
async def saved_zip(request: Request, sid: str):
    need_admin(request)
    d = _saved_dir(sid)
    buf = io.BytesIO()
    with _zipfile.ZipFile(buf, "w", _zipfile.ZIP_DEFLATED) as z:
        for f in sorted(d.rglob("*")):
            if f.is_file():
                z.write(f, f"{sid}/{f.relative_to(d).as_posix()}")
    return Response(buf.getvalue(), media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{sid}.zip"'})


@app.delete("/api/admin/saved/{sid}")
async def saved_delete(request: Request, sid: str):
    need_admin(request)
    _shutil.rmtree(_saved_dir(sid), ignore_errors=True)
    return {"ok": True}
