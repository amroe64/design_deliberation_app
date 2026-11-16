"""The Mediator.

Two versions, picked with the MEDIATOR environment variable:

  MEDIATOR=standin  (default) fixed rules, no AI. Good for testing the app.
  MEDIATOR=llm      a real model through an OpenAI-compatible API (e.g. VT ARC),
                    using the same prompts as run_caucus / run_facilitated /
                    run_summary_only in Inan's mediators.py.

Both return the same shapes, so the rest of the app does not care which one runs.
If the real model fails or is too slow, the app falls back to the stand-in and
logs it (see game.Game._ai_round).
"""
import asyncio
import contextvars
import json
import os
import random
import re

from . import content as C
from . import rules

# The game sets this to a dict before each Mediator call; the real model adds what it used (tokens, bytes).
USAGE = contextvars.ContextVar("mediator_usage", default=None)

PROPOSE_SUFFIX = '\nEnd your reply with your current proposed bundle as JSON: {"bundle": [...]}.'


class StandIn:
    name = "stand-in v0.3 (rule-based)"

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


class LLM:
    """Real model. Prompts mirror mediators.py. For an exact match, replace SYSTEM with
    briefs.mediator_brief(inst) from Inan's code."""

    def __init__(self):
        from openai import AsyncOpenAI
        self.model = os.environ.get("MEDIATOR_MODEL", "gpt-oss-120b")
        self.client = AsyncOpenAI(base_url=os.environ["ARC_API_BASE"], api_key=os.environ["ARC_API_KEY"], max_retries=1)
        self.effort = os.environ.get("MEDIATOR_REASONING", "low")
        self.name = f"llm:{self.model}"
        table = "\n".join(f"  {f['id']} {f['name']}: ${f['price']}, shared value {f['shared']}" for f in C.FEATURES)
        self.SYSTEM = (
            "ROLE: MEDIATOR. You help a team of three engineers (Mechanical, Manufacturing, Human Factors) choose "
            "features for a low-cost home blood-pressure and blood-oxygen monitor. The team may spend at most "
            f"${C.BUDGET}. You only know the shared table below; some of its values are wrong, and each member may "
            "hold private test findings. Use only what members tell you.\n\nShared table:\n" + table +
            "\n\nThe team members are university students. Write in plain, short sentences. Never quote a member, "
            "and never say which member said what.")

    async def _chat(self, prompt):
        r = await self.client.chat.completions.create(
            model=self.model, temperature=0.7, max_tokens=1500,
            messages=[{"role": "system", "content": self.SYSTEM}, {"role": "user", "content": prompt}],
            extra_body={"reasoning_effort": self.effort} if self.effort else None)
        text = r.choices[0].message.content or ""
        u = USAGE.get()
        if u is not None:                       # what this call cost, for the admin "AI backend" tab
            us = getattr(r, "usage", None)
            u["n"] += 1
            u["in"] += getattr(us, "prompt_tokens", 0) or 0
            u["out"] += getattr(us, "completion_tokens", 0) or 0
            u["req_bytes"] += len((self.SYSTEM + prompt).encode("utf-8"))
            u["resp_bytes"] += len(text.encode("utf-8"))
        return text

    @staticmethod
    def _bundle(text):
        for m in re.finditer(r"\{[^{}]*\"bundle\"[^{}]*\}", text, flags=re.S):
            try:
                ids = [str(x).strip().upper() for x in json.loads(m.group(0))["bundle"]]
                if all(i in rules.FEAT for i in ids):
                    return rules.sort_ids(ids)
            except Exception:  # noqa: BLE001
                continue
        return None

    @staticmethod
    def _clean(text):
        text = re.sub(r"```(?:json)?\s*\{[^{}]*\"bundle\"[^{}]*\}\s*```", "", text, flags=re.S)
        return re.sub(r"\{[^{}]*\"bundle\"[^{}]*\}", "", text).strip()

    async def _propose(self, prompt):
        ask = prompt + PROPOSE_SUFFIX
        for _ in range(3):  # first try + 2 repairs, like agents.py
            reply = await self._chat(ask)
            b = self._bundle(reply)
            if b is None:
                ask = 'Your last reply had no valid bundle. Reply again with a short statement and JSON like {"bundle": ["F01", "F04"]}.'
                continue
            if rules.cost(b) > C.BUDGET:
                ask = (f"PROGRAM OFFICE: bundle rejected. It costs ${rules.cost(b)}, which is ${rules.cost(b) - C.BUDGET} over the "
                       f"${C.BUDGET} budget. Remove items and resubmit the JSON bundle.")
                continue
            return {"text": self._clean(reply), "set": b}
        raise RuntimeError("mediator could not produce a valid bundle")

    @staticmethod
    def _transcript(T, rounds=None):
        lines = []
        for e in T["log"]:
            if e["kind"] == "message" and (rounds is None or e["round"] in rounds):
                lines.append(f"[round {e['round']}] {C.ROLES[e['who']]['name']}:\n{e['text']}  -> bundle {e['set']}")
            elif e["kind"] in ("question", "recap"):
                lines.append(f"[round {e['round']}] MEDIATOR:\n{e['text']}")
        return "\n\n".join(lines)[-6000:]

    async def caucus_draft(self, T, rnd, last, rounds):
        views = [e for e in T["log"] if e["kind"] == "message" and e["round"] == rnd]
        packed = "\n\n".join(f"{C.ROLES[e['who']]['name']}:\n{e['text']}\n-> bundle {e['set']}" for e in views)
        return await self._propose(
            f"Private statements this round:\n\n{packed}\n\nDraft a group statement that uses ALL evidence shared with you "
            f"— especially data only one member holds — and propose one feasible bundle.")

    async def facilitator_question(self, T, rnd, rounds):
        return (await self._chat(
            f"Shared discussion, round {rnd} of {rounds}. Transcript so far:\n{self._transcript(T)}\n\nPose ONE focused "
            f"question to the team that will surface information members have not yet shared (do not propose a bundle "
            f"yourself yet).")).strip()

    async def facilitated_final(self, T, rounds):
        return await self._propose(
            f"The discussion is complete. Full transcript:\n{self._transcript(T)}\n\nSynthesize the team's decision into one "
            f"group statement and one feasible bundle, using all evidence shared.")

    async def recap(self, T, rnd, rounds):
        return (await self._chat(
            f"Post a NEUTRAL recap of round {rnd} (no opinions, no proposals — just what was claimed and by whom):\n"
            f"{self._transcript(T, rounds={rnd})}")).strip()


def make():
    return LLM() if os.environ.get("MEDIATOR", "standin").lower() == "llm" else StandIn()
