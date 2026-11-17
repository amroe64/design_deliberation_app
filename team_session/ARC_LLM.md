# Running the Mediator on VT ARC LLMs

Research notes, November 2026. Covers:
- what ARC offers, and the limits that matter for a live class session;
- how the simulation (`design_deliberation_A-v2.1`, the `knapsack_gabm` package) calls ARC;
- how the live app does it today, and what has to change so the two match.

Nothing here has been tested from the live app with a real key yet. The timing numbers come from
the simulation's own ARC runs.

## The short version

- **The app is mostly ready.** `MEDIATOR=llm` already sends each Mediator turn to an
  OpenAI-compatible API. Most of its per-turn prompts match the simulation word for word.
- **It does not yet behave like the simulation.** There are 9 differences: model settings, memory,
  rounds, the system brief, the first question, the majority rule, and failure handling. One is a
  real bug: when the live app asks the model to fix a bad bundle, the model can't see the reply it
  is fixing.
- **The network.** The ARC API only answers from the VT network or the VT VPN. From off campus it
  says `403: API access is restricted to the VT Campus VPN`. Your own simulation runs hit the same
  error. The laptop or server running the class has to be on campus or on the VPN.
- **Speed swings a lot.** In the simulation runs, gpt-oss took about **7–8 s per call**. In the newer
  `results/` runs, the same model and code took about **18× longer**, roughly 2 minutes per call,
  with one 180 s timeout. At class time, students would wait through that every round. The live
  app gives up after 60 s and hands the turn to the stand-in. For lecture days, a dedicated model
  (Open OnDemand or vLLM) looks like the safer choice.
- **Load fits, with care.** One key can have 10 requests running per model, and 20 across all
  models. The app already queues at 8, but nothing else may use that key during class: no
  simulations, no Copilot, no notebook.
- **Models disappear.** The simulation's failed runs include `Model not found` for Gemma 4, Llama
  3.3 and Qwen 3.5. Its catalog names `DeepSeek-V4-Flash` and `GLM-5.2`, while ARC's docs now list
  `DeepSeek-V4.1-Flash` and `GLM-5.3`. Pin the model and check it is still there before every session.

## Status (2026-11-17)

**Done in the live app**, tested against a fake ARC server that sends busy errors, gateway timeouts,
empty replies, over-budget bundles, a VPN refusal and a missing model:

- **1, 2:** `gpt-oss-120b-thinking-low`, 2,400 tokens, no `reasoning_effort`, per-model budgets.
- **3:** a rolling 16-message Mediator memory per team. Repairs now see the reply they fix.
  When the stand-in answers a turn, its answer goes into the memory too.
- **8:** the majority rule is `domain.majority_bundle` (server and prototype).
- **9:** retries and back-off as in the simulation. Turns are marked `timeout`, `network` or `model`.
  `AI_TIMEOUT` is now 180 s. results.csv has `mediator_fallbacks` for excluding teams.
- **Records:** every request is saved (`ai_calls.csv`), and `all.json` carries the Mediator's settings.
- **Pre-class check:** Admin → AI status → Test the AI.
- **Model picker:** Admin → Setup → Mediator lists ARC's models live. You can test one, then use it.
  It locks once teams form, and the choice is saved with the session.
- **Key handling:** settings load from `team_session/.env` (git ignores it). There's a
  `.env.example`.

**Still open, needs a team decision:** 4 (rounds), 5 (system brief), 6 (recap wording), 7 (first
question). **Still untested:** the real ARC endpoint, which needs a key and the VPN.

## Security note

The simulation folder (`Downloads/design_deliberation_A-v2.1`) has a live ARC key in plain text in
`.env`, next to a `.venv` and results. If that folder has been zipped, emailed, or put on a shared
drive, regenerate the key at llm.arc.vt.edu. Keep keys out of anything that gets shared, and out of
git.

## What ARC offers

| | Shared API (llm-api.arc.vt.edu) | Dedicated LLM in Open OnDemand | Your own vLLM job |
|---|---|---|---|
| Who | Any VT student, faculty or staff | Needs an ARC account and allocation | Needs an ARC account and allocation |
| Cost | Free | Uses allocation hours | Uses allocation hours |
| Models | gpt-oss-120b, GLM-5.3, DeepSeek-V4.1-Flash, Kimi-K3 (used by the simulation). These change over time. | 40+ open models (llama.cpp) | Any model in `/common/data/models/`, including `openai--gpt-oss-120b` |
| Limits | 10 at once per model, 20 in flight per key, 8,000 output tokens per request unless streaming | None, it is yours alone | None, it is yours alone |
| Speed when busy | Web-chat users go first, so API calls wait. Measured: 7 s to about 2 min per call. | Steady | Steady |
| Network | VT network or VPN only | VT network or VPN only | SSH tunnel (`ssh -N -L 8000:<node>:8000 user@falcon2.arc.vt.edu`) |
| Run time | Always on | Up to 5 days, stops after 1 hour idle | Job time limit (example uses 1 day) |
| Same model every session | No guarantee | Yes | Yes |

**Data:**
- All three run on ARC's own hardware. ARC says no data leaves the university and nothing is used
  for training.
- Requests are logged and kept under VT IT Security Office (ITSO) policy. No retention period is
  stated.
- ITSO has approved the service for high-risk data. Export-controlled and CUI data are not allowed.

**Getting a key:** llm.arc.vt.edu → profile → Settings → Account → API keys. Keys are personal.

**Error codes seen or documented:**
- `429`: too many requests at once.
- `503 queue_timeout`: the request waited too long in ARC's queue.
- `400 backend '<model>' read timeout`: ARC's gateway gave up on its own backend. It comes back
  fast, so a client-side timeout never catches it. The simulation lost 28 Kimi runs to this.
- `400 Model not found`: the model was removed.
- `403 ... VT Campus VPN`: you are off the VT network.

## How the simulation calls ARC

From `knapsack_gabm/llm.py`, `config.py`, `arc_api_models.py` and `ratelimit.py`:

- **Model:** `gpt-oss-120b-thinking-low`. Reasoning is chosen by the model name. `reasoning_effort`
  is not sent (`REASONING_STYLE=none`).
- **Model settings:** `temperature=0.7`, `max_tokens=2400` (from the per-model catalog), 180 s
  timeout per request.
- **Retries:** up to 4 attempts per call. Busy errors (`429`, `502`, `503`) wait 1, 2, 4… seconds
  and lower the concurrency limit. Gateway read timeouts wait 15, 30, 45… seconds.
- **Concurrency:** one shared limiter, 8 at once with a hard cap of 10. It lowers itself after a
  rejection and recovers slowly.
- **Failures:**
  - Network problems are counted apart from model problems ("transport" vs "model behaviour").
  - A turn gets 2 repair re-asks. After that the whole run fails loudly and is excluded.
    There is never a "keep the old answer" fallback.
- **Records:** every run is stamped with mode, model, `max_tokens`, timeout and endpoint, and
  `finish_reason` is counted per model. A short pilot runs first and holds back any model with too
  many empty replies.
- **Mediator memory:** the Mediator is a chat participant. It keeps its last 16 messages, so it
  remembers earlier rounds, its own drafts, and the reply a repair request refers to.
- **Measured speed for gpt-oss-120b-thinking-low:**
  - `results_brubaker_original`: about 20 calls in sequence per run. Caucus runs took 152 s
    (median), unmediated 86 s. Repairs per run: 0.05 (caucus) to 0.60 (facilitated).
  - `results` (newer runs): caucus 2,731 s, unmediated 1,114 s. Same model, same settings, so
    the difference is ARC load or the network.

## Live app vs simulation

| # | Area | Simulation (A-v2.1) | Live app now | What to do |
|---|---|---|---|---|
| 1 | Model and reasoning | `gpt-oss-120b-thinking-low`, no `reasoning_effort` | `gpt-oss-120b` + `reasoning_effort=low` | Use `MEDIATOR_MODEL=gpt-oss-120b-thinking-low` and stop sending `reasoning_effort` |
| 2 | Output budget | `max_tokens=2400` | `1500` | Use 2,400, from a per-model table like `arc_api_models.py`. Log `finish_reason`. |
| 3 | Mediator memory | Keeps a rolling 16-message chat history | Every call is a single new message | Keep a per-team chat history for the Mediator, as the simulation does. **Bug:** live repair re-asks ("Your last reply had no valid bundle…") are sent with no context, so the model can't see what to fix. |
| 4 | Rounds | `N_ROUNDS=3` | 2 | Decide. The pre-registration freezes 3. Admin → Setup can set 3, but the timers assume about 23 minutes. |
| 5 | System brief | `mediator_brief(inst)`: shared brief, budget, full table, "help the team surface and use ALL the information in the room" | Shorter custom prompt, plus "plain sentences, never quote a member, never say which member said what" | Use the simulation's `mediator_brief` text, filled in with the live feature table. Agree as a team on the student-facing additions and record them as a deliberate difference. |
| 6 | Recap wording | Asks for "what was claimed and by whom" | Same request, but the live system prompt forbids naming members | Pick one. The simulation names speakers. The live UI says "No one's words are quoted". |
| 7 | First facilitated question | Written by the model, before round 1 | Always the stand-in's fixed question (`game.py:282`) | Ask the model for it when teams form (one extra call per facilitated team), or record it as a difference. |
| 8 | Majority vote over budget | Drop the fewest-votes item first, then the most expensive (`domain.majority_bundle`) | Drop the lowest shared value per dollar (`rules.majority_set`) | Port `majority_bundle`: it's about 10 lines. |
| 9 | When the model fails | Run fails and is excluded. Network problems are retried first. | Stand-in answers after 60 s, marked `mediator_error` | Students can't be failed mid-class, so: retry like the simulation (backoff, gateway timeouts), give it about 3 minutes, then use the stand-in, and flag and exclude those teams from the primary analysis. This matches the pre-registered exclusion rule. |

Other gaps against the simulation's tooling:

- **Records:**
  - The live app saves only the Mediator's final text.
  - Add: the prompt, the raw reply, `finish_reason`, the model name the reply carries, tokens,
    repairs, retries, and whether a failure was network or model.
  - Add the simulation's provenance stamp (mode, model, `max_tokens`, timeout, endpoint) to each
    session. Live practice data already stays separate (simulated students are marked `bot=1`).
- **Pre-class check.** Something like the simulation's pilot gate: one real call from the AI
  backend tab, on the lecture-day network, showing model, reply time and `finish_reason`. Refuse
  to start the session if the model is missing.
- **Limiter.**
  - The live app's fixed limit of 8 is fine.
  - The simulation's adaptive limiter is better under `429`s. Port it if the pilot shows rejections.
- **Instance check.** Live uses one fixed feature table (`content.py`, budget $57, best 448 points).
  The simulation generates and certifies a new instance per run: at least one gem from every
  discipline, no decoys in the best set, shared-only team at 45–78%, no single engineer above 93%.
  Run the live table through the simulation's certification checks once, so live results fit the
  same ladder.

## How the live app works today

The flow is in `server/game.py` (`_close_round` → `_ai_round`) and `server/mediator.py` (`LLM`).

- When all 3 teammates have posted, the team waits.
- One Mediator call goes on a queue, with at most `AI_CONCURRENCY=8` running at once.
- The turn gets `AI_TIMEOUT=180` seconds in total, including retries and repairs.
- On a timeout or failure, the stand-in answers and the turn is marked (before 2026-11-17: 60 s, no
  retries, no memory).
- The API key stays on the server and is never sent to phones.

## Load and wait times for a class of 100

- About 33 teams. With 3 of 4 conditions mediated, about 25 teams call the Mediator each round.
- Up to 25 calls can arrive together. At 8 at a time, that's about 4 waves.
- **If ARC is quick (about 8 s per call):** the last team waits about 30 s. Fine.
- **If ARC is busy (about 2 min per call, as in the newer runs):** waits could reach 8 minutes, or
  most turns hit the 60 s limit and go to the stand-in. Not usable for a class.
- So the plan has to cover the slow case. Either use a dedicated model on lecture days, or measure
  the shared API at the class's actual day and hour first.

## Questions to settle

**For ARC (4help):**
- Can a class app run on one person's key, or is there a project or service key?
- Is eduroam in our lecture hall on the network the API accepts?
- Can we reserve capacity, or should we use Open OnDemand or vLLM for scheduled class sessions?
- How long are logged prompts kept?
- Is `gpt-oss-120b-thinking-low` staying through the end of the study?

**For the team:**
- 2 or 3 rounds live? The pre-registration says 3.
- Should the recap name who said what?
- Policy for stand-in turns: exclude those teams?
- Should the live Mediator brief match the simulation word for word, and which student-facing lines
  are we adding on purpose?

**For the IRB:** the protocol should name ARC as where student messages are processed, note that
ARC/ITSO logs them, and cover students who said no but still get a Mediator.

## Suggested order

1. Regenerate the ARC key if the simulation folder has been shared.
2. Make the code changes:
   - model settings (1, 2);
   - Mediator memory and the repair bug (3);
   - the majority rule (8);
   - retries, time limits and failure classes (9);
   - full call records;
   - the "Test the AI" button.
3. Settle rounds, brief, recap wording and the first question (4–7) with the team, then apply.
4. Check the live feature table with the simulation's certification code.
5. On the VPN, run a full simulation in the app with `MEDIATOR=llm` at 1× speed with about 30
   simulated students. Do it at the same weekday and hour as the class. Read reply times, `429`s
   and fallbacks in the AI status tab.
6. If the shared API is too slow at that hour, set up Open OnDemand or vLLM and repeat step 5.
7. Dry run in the real room on the real network, with phones.

## Sources

- [ARC: llm-api.arc.vt.edu (API, models, limits, errors)](https://docs.arc.vt.edu/ai/011_llm_api_arc_vt_edu.html)
- [ARC: llm.arc.vt.edu (web interface, API keys, data approval)](https://docs.arc.vt.edu/ai/010_llm_arc_vt_edu.html)
- [ARC: LLMs via Open OnDemand](https://docs.arc.vt.edu/ai/020_ood_arc_vt_edu.html)
- [ARC: vLLM](https://docs.arc.vt.edu/ai/030_vllm.html)
- [VT News: ARC expands LLM access (Nov 2025)](https://news.vt.edu/articles/2025/11/it-arc-llm-expansion.html)
- [VT: AI tools and approved data levels](https://ai.vt.edu/tools)
- [Hugging Face: gpt-oss-120b empty reply at low max_tokens](https://huggingface.co/openai/gpt-oss-120b/discussions/67)
- [vLLM: reasoning outputs](https://docs.vllm.ai/features/reasoning_outputs.html)
- Simulation code and results: `design_deliberation_A-v2.1` (`knapsack_gabm/`, `results/`,
  `results_brubaker_original/`, `CHANGES_A-v2*.md`, `PREREGISTRATION_A.md`)
