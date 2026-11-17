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
| `MEDIATOR=llm` | A real model on VT ARC (`llm-api.arc.vt.edu`), set up like Inan's simulation (A-v2.1) |

For the real model, copy `.env.example` to `.env` (it stays out of git) and add your ARC key:

```bash
cp .env.example .env        # then edit ARC_API_KEY
uvicorn server.app:app --host 0.0.0.0 --port 8000
```

- **Network:** the ARC API only answers from the VT network or the VT VPN. Run the server on campus or
  on the VPN. Cloud hosting such as Render can't reach it.
- **Settings match the simulation:**
  - `gpt-oss-120b-thinking-low`, with reasoning set by the model name;
  - 2,400 output tokens, `temperature=0.7`;
  - a rolling 16-message Mediator memory per team, so repairs see the reply they fix;
  - 2 repair re-asks for a missing or over-budget bundle.
- **Busy or flaky ARC:** each request is tried up to 4 times. Busy errors wait 1, 2, 4… s. ARC's
  "backend read timeout" waits 15, 30, 45… s. A missing model or a bad key stops right away.
- **Time limit:** if a whole turn takes longer than `AI_TIMEOUT` seconds (default 180), the stand-in
  answers, the game keeps going, and the turn is marked: `timeout`, `network` (ARC, VPN, setup) or
  `model` (no valid bundle). Teams with any stand-in turn get `mediator_fallbacks > 0` in
  results.csv. Exclude them from the primary analysis, as the simulation excludes failed runs.
- **Concurrency:** at most `AI_CONCURRENCY` (default 8) turns run at once. ARC allows 10 per key, so
  nothing else may use the same key during class.
- **Records:** every request is saved: prompt, reply, reasoning, model, `finish_reason`, tokens,
  time and error. Download them under Results → AI calls CSV.
- **Picking the model:** Admin → Setup → **Mediator**. The list shows the models ARC offers right now,
  plus "Stand-in (no AI)". **Test this model** sends one request without switching. **Use this model**
  switches. Each model gets the token budget and time limit from the table in `server/mediator.py`
  (the same values as the simulation's catalog). The choice is saved with the session and kept after
  a restart. It locks once teams are formed, so one session never mixes two Mediators.
  `MEDIATOR_MODEL` in `.env` is only the starting choice.
- **Before class:** Admin → AI status → **Test the AI** sends one real request, checks that the
  model is listed, and shows the reply time.

See `ARC_LLM.md` for ARC's limits and the comparison with the simulation.

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

## AI status tab

The admin page has an **AI status** tab. It shows how the Mediator is set up (model, endpoint,
calls at the same time, timeout), every call with its wait time, reply time and tokens, the
busiest minute, and what a class of any size would need. With the stand-in Mediator, token and
data numbers are estimates. With `MEDIATOR=llm`, they come from the model's own usage report.
