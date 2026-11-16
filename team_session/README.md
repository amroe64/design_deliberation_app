# Team Design Session: live server

The real version of the student app. One Python server runs the whole class session,
serves the screens to every phone, and saves every action live to SQLite.

## Run it on your laptop (5 minutes)

```bash
cd team_session
python3 -m venv .venv && source .venv/bin/activate     # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn server.app:app --host 0.0.0.0 --port 8000
```

- Students: `http://<your-laptop-IP>:8000/` (or scan the QR code on the projector page)
- Admin: `http://<your-laptop-IP>:8000/admin`. PIN **1234**; change it with `ADMIN_PIN=yourpin` before starting.
- Projector: Admin → Projector → "Open projector view"
- Data: `data/session.sqlite3` (see **DATA_LOGGED.md** for every field)

Find your laptop IP: Mac `ipconfig getifaddr en0`, Windows `ipconfig`.

**Try it alone:** open `/admin`, add 12 simulated students, then open `/?seat=1` in another tab and join as
a real student. Form teams, then press **Auto-simulate** so the simulated students move. To act as
several real phones in one browser, use `/?seat=1`, `/?seat=2`, `/?seat=3` in separate tabs.

## Before lecture day

1. **Test the hall's Wi-Fi.** Campus networks often block phones from reaching a laptop. If phones
   can't load the page, run the server somewhere they can reach (a VT server, or a cloud host such
   as Render). Ask the IRB about where student data may be stored.
2. **Load test.** Admin → add 100 simulated students → form teams → Auto-simulate. Watch the AI
   numbers (calls, average seconds, timeouts, fallbacks). Tested here: 100 students, 34 teams, all finished.
3. **Set the session** in Admin → Setup: class code, rounds, deliberation types, and the headcount rule.

## The Mediator

| Setting | What runs |
|---|---|
| `MEDIATOR=standin` (default) | Fixed rules, no AI. For testing. |
| `MEDIATOR=llm` | A real model through an OpenAI-compatible API, using the same prompts as Inan's `mediators.py` |

For the real model:

```bash
export MEDIATOR=llm
export ARC_API_BASE=https://<ARC endpoint>/v1      # from Inan's config / .env
export ARC_API_KEY=...
export MEDIATOR_MODEL=gpt-oss-120b                 # pick from Inan's results
export MEDIATOR_REASONING=low
uvicorn server.app:app --host 0.0.0.0 --port 8000
```

If the model errors or takes longer than `AI_TIMEOUT` seconds (default 60), the app uses the
stand-in for that turn, keeps going, and flags it in the log. At most `AI_CONCURRENCY` (default 8)
model calls run at once.

To match the simulation exactly, replace `LLM.SYSTEM` in `server/mediator.py` with
`briefs.mediator_brief(inst)` from Inan's code.

## Things that still differ from Inan's simulation (check with him)

- Students post at the same time each round; his agents take turns.
- 2 rounds (his code uses 3). Change it in Admin → Setup.
- The over-budget repair rule for majority votes is a placeholder (`rules.majority_set`).
  Swap in `domain.majority_bundle`.

## Files

| File | What it does |
|---|---|
| `server/app.py` | Web server: pages, API, live updates (WebSockets), downloads |
| `server/game.py` | The session: lobby, consent, teams, rounds, Mediator calls, activity log |
| `server/rules.py` | Task logic: parsing, stand-in Mediator rules, majority vote, scoring, fact funnel |
| `server/mediator.py` | Stand-in and real-model Mediator |
| `server/db.py` | SQLite tables and writes |
| `server/content.py` | Task content (features, role briefs, facts, survey items) |
| `server/static/` | The student and admin screens |
| `analysis/points_from_findings.py` | Re-scores points lost at each step from the exported CSVs, after human coders fix the codes |

Restarting the server picks up where it left off: same session, teams and seats, and any Mediator
call that was running is re-run. Students who refresh or lose Wi-Fi land back in their seat with
their draft.

## Full simulation (no clicking)

Admin → Live session → **Full simulation**. Add simulated students, pick a speed (1× = real class
pace using the step timers, up to 40×) and press **Run**. Teams form by themselves and every
simulated student plays out the whole session.

Each simulated student gets a persona (see `server/students.py`):

| Persona | Share | What they do |
|---|---|---|
| Engaged | 25% | Shares almost all findings clearly, believes teammates, on time |
| Average | 33% | Shares about 2 of 3, half of them vaguely |
| Low effort | 15% | Short messages, rarely shares, sloppy picks, fast |
| Trusts the table | 10% | Mostly ignores their own results |
| Misreads results | 9% | Shares a lot, but often states a result the wrong way |
| Slow | 8% | Good content, often runs over time |

Their messages are scored by the same rules as real messages, so vague mentions do not count
as "spoken" and wrong-way claims show up as wrong information. Simulated data is marked `bot=1`
in every export. Never mix it with real data.

## Saved sessions

On the admin page, open **Saved sessions** and press **Save as a folder**. This writes a folder
to `data/saved/<date>_<name>/` with:

- `data/consenting_only/` and `data/everyone/`: the CSV and JSON data files
- `view/`: a frozen copy of every admin screen (charts, results, each player's screen and log)
- `README.txt`: what is inside

Press **Open** on a saved session to look around it with the same tabs. It is read-only, and the
live session keeps running untouched. **Download folder (.zip)** gives you a copy to keep elsewhere.
Back up the `data/` folder to keep both the database and the saved sessions.

## AI backend tab

The admin page has an **AI backend** tab. It shows how the Mediator is set up (model, endpoint,
calls at the same time, timeout), every call with its wait time, reply time and tokens, the
busiest minute, and what a class of any size would need. With the stand-in Mediator, token and
data numbers are estimates. With `MEDIATOR=llm`, they come from the model's own usage report.
