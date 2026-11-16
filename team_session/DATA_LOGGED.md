# What the app records, and how

Everything is written to one SQLite file (`data/session.sqlite3`) **the moment it happens**.
Nothing waits until the end, so a crash or dead laptop loses nothing.

Every row carries the **session ID** (`S-2026-11-06-8A3Q`) and, when it is about a person,
their **participant ID** (`P-HSKYA`). No names, emails or student IDs are ever asked for or stored.

## 1. How it is captured

| Method | What it catches |
|---|---|
| **Server-side** | Anything that changes the session (joining, consent, team placement, sending, picking, ratings, decisions, survey answers, researcher actions). The server records it as it applies the change, so it can't be skipped or faked by the browser. |
| **Browser → server** | Things only the phone can see: typing pauses, keys and backspaces, pastes, tab switches, leaving the app, and how long a message is on screen. The phone sends each one to the server, which logs it. |
| **Timestamps** | Server clock, to the millisecond, for every row (`ts` = Unix seconds, `time_iso` = readable). |

## 2. Everything that is logged (`events` table: one row per action)

| When | Event type | Details saved |
|---|---|---|
| Joining | `join` | Whether they joined late (after the lobby closed) |
| Consent | `consent` | Yes / No, and how long they spent on the consent screen |
| Team forming | `placed` | Team, role, nickname, deliberation type, spare / non-consent flags |
| Any step change | `step_start` | New step and the step before it (reading → round 1 → waiting → round 2 → final → survey → done). **Time on each step comes from these.** |
| Brief check | `answer` (block `brief_check`) | Every tap, including changed answers, and whether each was right |
| Pre-survey | `answer` (block `pre_survey`) | Every tap (1–5), including changes |
| | `check`, `pre` | Final brief-check result and pre-survey answers when they press "I'm ready" |
| Using the brief | `insert_fact` | Which private fact they tapped "+ Add" on (ME1, MF2, …) |
| Typing | `typing_start` | When they first started typing a message |
| | `draft_snapshot` | **The full text in the box each time they pause for 1.5 s.** Shows drafts they changed or never sent. Also for card comments and the "why?" box on the final decision. |
| | `paste` | Pasted text and its length, and which box |
| Picking features | `pick` | Feature, on/off, full set after the change, and cost |
| Sending | `send_click` | They pressed send (and message length) |
| | `message` | Full text, round, picks sent with it, private or team, fact tags used, **time spent writing, keys typed, backspaces, pastes** |
| Reading | `seen` | A teammate's message or a Mediator card was **on their screen for 2+ seconds** (the "heard" measure) |
| Mediator cards | `rating` | Agree / Partly / Disagree on a draft or recap card, plus their comment |
| Final decision | `endorse` | Accept or not, plus their reason if they gave one |
| Post-survey | `answer` (block `post_survey`) | Every tap, including the leak question ("talked outside the app?") |
| Recall check | `answer` (block `recall`) | Each box they checked or unchecked (real facts and decoys) |
| | `survey` | All final survey answers and recall picks when they submit |
| Screen use | `tab` | Every switch between Brief / Team / Guide, with time spent on the tab they left, and whether the app moved them or they tapped |
| | `left_app` / `returned_to_app` | Switched apps or locked the phone, and how long they were away |
| Help | `help` | Pressed or cancelled "Need help" |
| Researcher actions on them | `help_resolved_by_researcher`, `round_closed_by_researcher`, `skipped` | Flags anything you did that changed their path |

## 3. Team-level record (`team_log` table: one row per item in the team's thread)

Every message, Mediator question, draft, recap, majority vote and final decision, in order, with:
round, who, participant ID, text, picks, private or team, and for Mediator output **which mediator
produced it** (stand-in or model name), and whether it fell back to the stand-in after an error.

## 4. Other tables

| Table | One row per | Holds |
|---|---|---|
| `sessions` | class session | Settings (class code, rounds, deliberation types, headcount rule) and live state |
| `participants` | person | Participant ID, consent, team, role, nickname, late / help flags |
| `teams` | team | Deliberation type, spare / non-consent / late flags, final set, and the full team state |

## 5. Scores the app works out from the log

Follows the 4-Step Coding Plan. **Each step only counts if the step before it happened**, so
counts can only go down from Spoken to Actioned.

| Step | Counts as "yes" when |
|---|---|
| **1. Spoken** | Its owner states the feature **with the right direction** ("worth more / keep / need" for a worth-more finding, "worth less / drop / don't need" for a worth-less one), to the team or the Mediator. A bare mention doesn't count. |
| **2. Heard** | A message or Mediator card that states it correctly was on a **teammate's** screen 2+ seconds. In caucus only Mediator cards count, because the owner's chat is private. |
| **3. Integrated** | After hearing it, a teammate states it correctly, or moves their picks its way (adds a worth-more feature, drops a worth-less one), or a Mediator draft or recap states it. |
| **4. Actioned** | The final set follows it (worth-more kept in, worth-less left out). |

Extra columns that don't gate: **mentioned** (named at all), **to Mediator**, **relayed by AI**,
**recalled** (a teammate ticked it in the survey), **heard + recalled** (a stricter "heard",
because 2 seconds on screen is not proof of reading), **final follows** (ignores the gate).

**Points (the plan's method).** Best possible = 448; shared table only = 216. At each step the app
finds the best answer using only the findings that made it that far; the drop is what that step lost:
lost not spoken, lost not heard, lost not integrated. **Lost at the final pick** = best answer with
what the team had minus its real score, split into:
- **wrong info**: claims that point the wrong way on a tested feature (e.g. calling F05 worth less)
  that the final set followed. Cost = how much worse the best answer gets when forced to follow them.
- **budget math or other**: the rest. It can be negative when a team lands a good set by luck
  without the steps showing why.

Also per team: pooling index, % of best, gems and decoys kept, and a **"talked out loud" flag**
when any member answered "a little" or "a lot" to the leak question. The chat log may be missing
part of those teams' conversation, so decide in advance whether to drop or keep them.

**Checking the codes.** Keyword matching is rough. Admin → Results → "Coding sheet: random 20%"
gives the app's codes next to blank columns for two coders (same 20% every download). Where the
coders disagree with the app, fix the Findings CSV, then run
`python analysis/points_from_findings.py facts.csv results.csv out.csv` to re-score points with
the gate re-applied. Report how often the coders agreed with each other and with the app.

## 6. What is NOT recorded

- Names, emails, student IDs, IP addresses, device type, location.
- Anything typed outside this app, and anything said out loud (only the leak question asks about it).
- Every single keystroke as it happens. Keys and backspaces are **counted**, and the text is saved at each **pause**, not letter by letter.

## 7. Where to find it

- **Admin → People** → click any ID: that person's full timeline, time per step, and totals.
- **Admin → Results → Downloads:** results, facts, messages, participants and all-events CSVs, everything as JSON, and the whole `.sqlite3` file.
- Or open `data/session.sqlite3` directly, for example in DB Browser for SQLite or with `pandas.read_sql`.
