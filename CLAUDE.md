# Team Design Session

Research tool for a Virginia Tech ISE study on LLM mediators in engineering design teams
(Amr Elamin, Inan Hashem, Dr. Eric Brubaker). Students join on phones, work a hidden-profile
design task in teams of 3 under one of four deliberation types, and a researcher runs it all
from an admin page.

## Two versions, kept in sync

- `team_session/` — the real app. FastAPI + uvicorn + WebSockets, SQLite. Run with
  `pip install -r requirements.txt` then `uvicorn server.app:app --reload`. Admin PIN 1234,
  class code SD26. Frontend is plain JS in `server/static/` (`app.js`, `charts.js`,
  `export.js`, `index.html`). Personas for simulated students are in `server/students.py`,
  scoring rules in `server/rules.py`, the task content in `server/content.py`.
- `prototype/index.html` — a single-file, no-server copy of the same interface with a
  simulated backend, for sharing and quick play-testing. Any UI change goes in both files.

## Conventions the owner cares about

- Plain, simple language in every label and message. No fluff.
- No emoji in the UI. Line icons only (`.ic .ic-{name}`, CSS-mask SVGs defined in the stylesheet).
- No iOS system blue. Theme: ASME green #255E4B, mediator dark #2A2E3B, backgrounds #EFF1F5.
  Condition colors: caucus #332288, facilitated #44AA99, summary_only #117733, unmediated #CC6677.
- Rows, not tables, for teams and people. Rounded "profile" rows with icons.
- Players cannot copy/paste; admins can. Admin-only info is never sent to player phones.
- Simulated data is always marked and never mixed with real data.
- In `prototype/index.html`, insert new CSS before the FIRST `</style>` (the embedded
  export code contains a `</style>` string). In the server `index.html`, the last one is fine.
- `html,body{overflow-x:clip}` not `hidden`, so sticky elements keep working.

## Testing

Playwright (Chromium) scripts were used throughout: log in as admin, start a practice run
(welcome guide → "Start a practice run"), speed to 40×, wait for all teams to finish, then
click through tabs and assert on the DOM. Keep doing that for any change that touches a tab.
