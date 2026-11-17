"""The Mediator.

Two versions, picked with the MEDIATOR environment variable:

  MEDIATOR=standin  (default) fixed rules, no AI. Good for testing the app.
  MEDIATOR=llm      a real model through an OpenAI-compatible API (VT ARC), set up to behave
                    like the simulation (design_deliberation_A-v2.1, knapsack_gabm):
                      - same model id and token budget (arc_api_models.py)
                      - the Mediator keeps a rolling chat memory per team (agents.Participant)
                      - same retry and back-off rules (llm.VLLMChatClient)
                      - network problems and model problems are told apart (agents.py)

Both return the same shapes, so the rest of the app does not care which one runs.
If the real model fails or is too slow, the app falls back to the stand-in and
logs it (see game.Game._ai_round). Every real request is recorded (see USAGE).
"""
import asyncio
import contextvars
import json
import os
import random
import re
import time

from . import content as C
from . import rules

# The game sets this to a dict before each Mediator turn. The real model adds token counts and one
# record per request ("calls"), which the game saves with the team.
USAGE = contextvars.ContextVar("mediator_usage", default=None)

PROPOSE_SUFFIX = '\nEnd your reply with your current proposed bundle as JSON: {"bundle": [...]}.'

# Per-model budget, same as knapsack_gabm/arc_api_models.py: (max_tokens, per-request timeout in seconds).
# Reasoning tokens count toward max_tokens, so a budget that is too small returns an empty reply.
MODELS = {
    "gpt-oss-120b": (2400, 240),
    "gpt-oss-120b-thinking-low": (2400, 180),          # the simulation's main arm
    "gpt-oss-120b-thinking-high": (4000, 400),
    "GLM-5.3": (5000, 600), "GLM-5.3-thinking-high": (6000, 900), "GLM-5.3-non-thinking": (2400, 240),
    "GLM-5.2": (5000, 600), "GLM-5.2-thinking-high": (6000, 900), "GLM-5.2-non-thinking": (2400, 240),
    "Kimi-K3": (5000, 600), "Kimi-K3-thinking-low": (3200, 900), "Kimi-K3-thinking-high": (6000, 900),
    "DeepSeek-V4.1-Flash": (5000, 600), "DeepSeek-V4.1-Flash-thinking-low": (4000, 900), "DeepSeek-V4.1-Flash-thinking-max": (6000, 900),
    "DeepSeek-V4-Flash": (5000, 600), "DeepSeek-V4-Flash-thinking-low": (4000, 900), "DeepSeek-V4-Flash-thinking-max": (6000, 900),
}
# Models the simulation ran with this task. Others work but have not been tried on it.
SIMULATED = {"gpt-oss-120b-thinking-low", "Kimi-K3-thinking-low", "DeepSeek-V4-Flash-thinking-low"}


def budget(model):
    """(max_tokens, per-request timeout) for a model. MEDIATOR_MAX_TOKENS / MEDIATOR_REQUEST_TIMEOUT override every model."""
    tok, tmo = MODELS.get(model, UNKNOWN_MODEL)
    return int(os.environ.get("MEDIATOR_MAX_TOKENS") or tok), float(os.environ.get("MEDIATOR_REQUEST_TIMEOUT") or tmo)


def available():
    """Can this server call ARC at all? (needs ARC_API_BASE and ARC_API_KEY)"""
    return bool(os.environ.get("ARC_API_BASE") and os.environ.get("ARC_API_KEY"))
UNKNOWN_MODEL = (4000, 240)      # generous: under-budgeting is what produces silent empty replies
HISTORY = 16                     # messages of chat memory the Mediator keeps per team (agents.Participant)
MAX_REPAIRS = 2                  # re-asks for a missing or over-budget bundle (config.max_repairs)
ATTEMPTS = 4                     # tries per request on network and busy errors (config.max_retries)

_TRANSPORT = ("timed out", "timeout", "connection", "connect error", "reset by peer", "broken pipe",
              "temporarily unavailable", "bad gateway", "service unavailable", "gateway timeout", "vpn",
              "ssl", "eof occurred", "remote end closed", "502", "503", "504")
_BUSY = ("429", "rate limit", "rate_limit", "too many requests", "concurrent", "capacity", "overloaded",
         "queue_full", "queue_timeout", "503", "502")


class TransportError(Exception):
    """The request never got a usable answer: network, VPN, ARC busy or timing out, setup errors.
    Says nothing about whether the model can do the task."""


class ModelError(Exception):
    """The model answered, but not with a valid, affordable bundle within the repair budget."""


def _is_gateway_timeout(t):
    """ARC's gateway giving up on its own backend, returned fast as HTTP 400 ('backend ... read timeout')."""
    return "read timeout" in t and ("backend" in t or "400" in t)


def _err_text(e):
    """Error type, HTTP status and ARC's response body in one string. Some openai versions print only
    'Error code: 400', which hides ARC's 'backend ... read timeout' detail, so read the body directly."""
    parts = [f"{type(e).__name__}: {e}"]
    code = getattr(e, "status_code", None)
    if code:
        parts.append(f"HTTP {code}")
    body = getattr(e, "body", None)
    if body and str(body) not in parts[0]:
        parts.append(json.dumps(body) if isinstance(body, (dict, list)) else str(body))
    elif getattr(e, "response", None) is not None and not body:
        try:
            parts.append(e.response.text[:300])
        except Exception:  # noqa: BLE001
            pass
    return " | ".join(parts)


def failure_kind(exc):
    """'network' or 'model', for the AI log and the exports."""
    if isinstance(exc, ModelError):
        return "model"
    return "network"


class StandIn:
    name = "stand-in v0.3 (rule-based)"
    real = False

    async def _wait(self):
        await asyncio.sleep(random.uniform(1.2, 2.4))

    async def caucus_draft(self, T, rnd, last, rounds):
        await self._wait()
        return rules.synthesize(T["log"], T["drafts"], "caucus2" if last and rnd > 1 else "caucus1")

    async def facilitator_question(self, T, rnd, rounds):
        await self._wait()
        return rules.facilitator_question(T["log"], rnd)

    async def facilitated_final(self, T, rounds):
        await self._wait()
        return rules.synthesize(T["log"], T["drafts"], "facilitated")

    async def recap(self, T, rnd, rounds):
        await self._wait()
        return rules.neutral_recap(T["log"], rnd, [r for r in C.ROLE_KEYS if T["roles"].get(r)])

    async def test(self):
        return {"ok": True, "standin": True, "model": self.name, "seconds": 0,
                "note": "The stand-in is running, so no real AI is called. Set MEDIATOR=llm to use ARC."}


class LLM:
    """Real model. Per-turn prompts are the ones in knapsack_gabm/mediators.py."""
    real = True

    def __init__(self):
        from openai import AsyncOpenAI
        self.model = os.environ.get("MEDIATOR_MODEL", "gpt-oss-120b-thinking-low")
        self.max_tokens, self.req_timeout = budget(self.model)
        self.temperature = float(os.environ.get("MEDIATOR_TEMPERATURE") or 0.7)
        # The simulation picks reasoning by model id (…-thinking-low) and sends no reasoning_effort.
        # Set MEDIATOR_REASONING only to override that on purpose.
        self.effort = os.environ.get("MEDIATOR_REASONING", "")
        self.base = os.environ["ARC_API_BASE"]
        self.client = AsyncOpenAI(base_url=self.base, api_key=os.environ["ARC_API_KEY"], max_retries=0)
        self.name = f"llm:{self.model}"
        table = "\n".join(f"  {f['id']} {f['name']}: ${f['price']}, shared value {f['shared']}" for f in C.FEATURES)
        self.SYSTEM = (
            "ROLE: MEDIATOR. You help a team of three engineers (Mechanical, Manufacturing, Human Factors) choose "
            "features for a low-cost home blood-pressure and blood-oxygen monitor. The team may spend at most "
            f"${C.BUDGET}. You only know the shared table below; some of its values are wrong, and each member may "
            "hold private test findings. Use only what members tell you.\n\nShared table:\n" + table +
            "\n\nThe team members are university students. Write in plain, short sentences. Never quote a member, "
            "and never say which member said what.")

    def set_model(self, model):
        """Switch models (admin Setup tab; only allowed before teams are formed)."""
        self.model = model
        self.max_tokens, self.req_timeout = budget(model)
        self.name = f"llm:{model}"

    async def list_models(self):
        return [m.id async for m in self.client.models.list()]

    def settings(self):
        """What goes in the provenance stamp and the AI status tab."""
        return {"model": self.model, "max_tokens": self.max_tokens, "request_timeout": self.req_timeout,
                "temperature": self.temperature, "reasoning_effort": self.effort or None, "endpoint": self.base,
                "history": HISTORY, "max_repairs": MAX_REPAIRS, "attempts": ATTEMPTS}

    # ---------------------------------------------------------------- one request, with retries
    async def _create(self, messages, model=None):
        """One request. `model` lets a test try another model without touching the session's settings."""
        extra = {"extra_body": {"reasoning_effort": self.effort}} if self.effort else {}
        m = model or self.model
        tok, tmo = budget(m) if model else (self.max_tokens, self.req_timeout)
        return await self.client.chat.completions.create(
            model=m, temperature=self.temperature, max_tokens=tok, messages=messages, timeout=tmo, **extra)

    async def _chat(self, T, prompt, purpose):
        """Send one user turn with the team's chat memory, like agents.Participant._chat."""
        hist = T.setdefault("med_hist", [])
        T["med_pending"] = prompt               # so a stand-in answer can be remembered in its place
        msgs = [{"role": "system", "content": self.SYSTEM}, *hist, {"role": "user", "content": prompt}]
        u = USAGE.get()
        last = None
        for attempt in range(ATTEMPTS):
            t0 = time.time()
            rec = {"ts": round(t0, 3), "purpose": purpose, "attempt": attempt + 1, "model": self.model,
                   "max_tokens": self.max_tokens, "temperature": self.temperature, "history_msgs": len(hist),
                   "prompt": prompt}
            try:
                r = await self._create(msgs)
            except Exception as e:  # noqa: BLE001
                last = e
                t = _err_text(e)
                rec.update(seconds=round(time.time() - t0, 2), error=t[:500])
                t = t.lower()
                if u is not None:
                    u.setdefault("calls", []).append(rec)
                if _is_gateway_timeout(t):
                    await asyncio.sleep(min(15 * (attempt + 1), 90))     # backend already behind: give it room
                elif any(m in t for m in _BUSY):
                    await asyncio.sleep(min(2 ** attempt, 30))
                elif any(m in t for m in _TRANSPORT):
                    await asyncio.sleep(min(2 ** attempt, 15))
                else:
                    break                                               # 400 model not found, 401 bad key: retrying won't help
                continue
            choice = r.choices[0]
            msg = choice.message
            text = msg.content or ""
            reasoning = getattr(msg, "reasoning_content", None) or getattr(msg, "reasoning", None)
            us = getattr(r, "usage", None)
            rec.update(seconds=round(time.time() - t0, 2), reply=text, reasoning=reasoning,
                       finish_reason=getattr(choice, "finish_reason", None), model_returned=getattr(r, "model", None),
                       tokens_in=getattr(us, "prompt_tokens", None), tokens_out=getattr(us, "completion_tokens", None))
            if u is not None:
                u.setdefault("calls", []).append(rec)
                u["n"] += 1
                u["in"] += rec["tokens_in"] or 0
                u["out"] += rec["tokens_out"] or 0
                u["req_bytes"] += sum(len(m["content"].encode("utf-8")) for m in msgs)
                u["resp_bytes"] += len(text.encode("utf-8"))
            self._remember(T, prompt, text)
            return text
        raise TransportError(f"no answer after {attempt + 1} of {ATTEMPTS} tries: {_err_text(last)}"[:500])

    @staticmethod
    def _remember(T, prompt, text):
        hist = T.setdefault("med_hist", [])
        hist += [{"role": "user", "content": prompt}, {"role": "assistant", "content": text}]
        del hist[:-HISTORY]
        T.pop("med_pending", None)

    def remember_fallback(self, T, text):
        """The stand-in answered this turn. Put its answer in the Mediator's memory, so the next real turn
        knows what the team actually saw."""
        if T.get("med_pending") is not None:
            self._remember(T, T["med_pending"], text)

    # ---------------------------------------------------------------- bundles (llm.extract_bundle)
    @staticmethod
    def _bundle(text):
        """Return (ids, None) or (None, hint for the re-ask)."""
        if not text or not text.strip():
            return None, 'your reply was empty; state your bundle as JSON like {"bundle": ["F01", "F04"]}'
        cands = [m.group(1) for m in re.finditer(r"```(?:json)?\s*(.*?)```", text, flags=re.S)] + [text]
        found = None
        for cand in cands:
            for m in re.finditer(r"\{[^{}]*\"bundle\"[^{}]*\}", cand, flags=re.S):
                try:
                    obj = json.loads(m.group(0))
                except json.JSONDecodeError:
                    continue
                if isinstance(obj.get("bundle"), list):
                    found = obj["bundle"]
                    break
            if found is None:
                for m in re.finditer(r"\[[^\[\]]*\]", cand, flags=re.S):
                    try:
                        arr = json.loads(m.group(0))
                    except json.JSONDecodeError:
                        continue
                    if isinstance(arr, list) and arr and all(isinstance(x, str) and re.fullmatch(r"F\d{2}", x.strip().upper()) for x in arr):
                        found = arr
                        break
            if found is not None:
                break
        if found is None:
            lines = [ln for ln in text.splitlines() if len(re.findall(r"\bF\d{2}\b", ln)) >= 2]
            if lines:
                found = re.findall(r"\bF\d{2}\b", lines[-1])
        if found is None:
            return None, 'no bundle found in your reply; end with JSON like {"bundle": ["F01", "F04", "F09"]}'
        ids = []
        for x in found:
            fid = str(x).strip().upper()
            if fid not in rules.FEAT:
                return None, f'"{x}" is not a feature id in this task; valid ids are {", ".join(f["id"] for f in C.FEATURES)}'
            ids.append(fid)
        return rules.sort_ids(list(dict.fromkeys(ids))), None

    @staticmethod
    def _clean(text):
        text = re.sub(r"```(?:json)?\s*\{[^{}]*\"bundle\"[^{}]*\}\s*```", "", text, flags=re.S)
        return re.sub(r"\{[^{}]*\"bundle\"[^{}]*\}", "", text).strip()

    async def _propose(self, T, prompt, purpose):
        """agents.Participant.propose: the text students see is the FIRST reply; the bundle is the repaired one."""
        ask, text0 = prompt + PROPOSE_SUFFIX, None
        for attempt in range(1 + MAX_REPAIRS):
            reply = await self._chat(T, ask, purpose if attempt == 0 else purpose + " (repair)")
            if text0 is None and reply.strip():
                text0 = reply
            b, hint = self._bundle(reply)
            if b is None:
                ask = f"Your last reply could not be used: {hint}. Reply again with ONLY a short justification and the JSON bundle."
                continue
            over = rules.cost(b) - C.BUDGET
            if over > 0:
                items = ", ".join(f"{i}=${rules.FEAT[i]['price']}" for i in b)
                ask = (f"PROGRAM OFFICE: bundle rejected — it costs ${rules.cost(b)}, which is ${over} over the "
                       f"${C.BUDGET} budget ({items}). Remove items and resubmit the JSON bundle.")
                continue
            return {"text": self._clean(text0 or reply), "set": b}
        raise ModelError(f"no valid, affordable bundle after {MAX_REPAIRS} repairs ({ask[:160]})")

    @staticmethod
    def _transcript(T, rounds=None):
        lines = []
        for e in T["log"]:
            if e["kind"] == "message" and (rounds is None or e["round"] in rounds):
                lines.append(f"[round {e['round']}] {C.ROLES[e['who']]['name']}:\n{e['text']}  -> bundle {e['set']}")
            elif e["kind"] in ("question", "recap"):
                lines.append(f"[round {e['round']}] MEDIATOR:\n{e['text']}")
        return "\n\n".join(lines)[-6000:]

    # ---------------------------------------------------------------- the four turns (mediators.py)
    async def caucus_draft(self, T, rnd, last, rounds):
        views = [e for e in T["log"] if e["kind"] == "message" and e["round"] == rnd]
        packed = "\n\n".join(f"{C.ROLES[e['who']]['name']}:\n{e['text']}\n-> bundle {e['set']}" for e in views)
        return await self._propose(T,
            f"Private statements this round:\n\n{packed}\n\nDraft a group statement that uses ALL evidence shared with you "
            f"— especially data only one member holds — and propose one feasible bundle.", "caucus draft")

    async def facilitator_question(self, T, rnd, rounds):
        return (await self._chat(T,
            f"Shared discussion, round {rnd} of {rounds}. Transcript so far:\n{self._transcript(T)}\n\nPose ONE focused "
            f"question to the team that will surface information members have not yet shared (do not propose a bundle "
            f"yourself yet).", "question")).strip()

    async def facilitated_final(self, T, rounds):
        return await self._propose(T,
            f"The discussion is complete. Full transcript:\n{self._transcript(T)}\n\nSynthesize the team's decision into one "
            f"group statement and one feasible bundle, using all evidence shared.", "final synthesis")

    async def recap(self, T, rnd, rounds):
        return (await self._chat(T,
            f"Post a NEUTRAL recap of round {rnd} (no opinions, no proposals — just what was claimed and by whom):\n"
            f"{self._transcript(T, rounds={rnd})}", "recap")).strip()

    # ---------------------------------------------------------------- pre-class check
    async def test(self, model=None):
        """One real round trip: is the model on the server, and how long does a short reply take?
        With `model`, tries that model without switching to it."""
        model = model or self.model
        out = {"ok": False, "standin": False, "model": model, "endpoint": self.base}
        t0 = time.time()
        try:
            ids = [m.id async for m in self.client.models.list()]
            out["model_listed"] = model in ids
            out["models"] = ids[:40]
        except Exception as e:  # noqa: BLE001
            out.update(seconds=round(time.time() - t0, 2), error=f"Could not list models: {_err_text(e)}"[:400])
            return out
        t1 = time.time()
        try:
            r = await asyncio.wait_for(self._create(
                [{"role": "system", "content": self.SYSTEM},
                 {"role": "user", "content": 'Connection check. Reply with one short sentence, then {"bundle": ["F01"]}.'}], model=model),
                budget(model)[1])
            ch = r.choices[0]
            out.update(ok=bool((ch.message.content or "").strip()), reply=(ch.message.content or "")[:300],
                       finish_reason=getattr(ch, "finish_reason", None), model_returned=getattr(r, "model", None),
                       tokens_out=getattr(getattr(r, "usage", None), "completion_tokens", None))
            if not out["ok"]:
                out["error"] = "The model sent back an empty reply. Its reasoning may have used up max_tokens."
        except Exception as e:  # noqa: BLE001
            out["error"] = _err_text(e)[:400]
        out["seconds"] = round(time.time() - t1, 2)
        if out.get("model_listed") is False:
            out["ok"] = False
            out["error"] = (out.get("error") or "") + f" The server does not list {model}."
        return out


def make():
    return LLM() if os.environ.get("MEDIATOR", "standin").lower() == "llm" else StandIn()


STANDIN = "standin"     # the choice value for "no AI" in the Setup picker
