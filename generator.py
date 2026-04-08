"""
Campaign generator — orchestrator + parallel sub-agents.
"""
import asyncio
import json
import os
from typing import Any
from openai import AsyncOpenAI
from prompts import (
    SYSTEM_ORCHESTRATOR,
    SKELETON_PROMPT,
    CHAPTER_PROMPT,
    NPC_PROMPT,
    APPENDIX_PROMPT,
    QUALITY_CHECK_PROMPT,
    HOW_TO_RUN_PROMPT,
)

ORCHESTRATOR_MODEL = os.getenv("ORCHESTRATOR_MODEL", "gpt-5.4")
AGENT_MODEL = os.getenv("AGENT_MODEL", "gpt-5.4-mini")
NANO_MODEL = os.getenv("NANO_MODEL", "gpt-5.4-nano")


def _normalize_list_of_dicts(val: Any, keys: list[str]) -> list[dict]:
    """
    Coerce a value that should be a list of dicts into exactly that.
    Handles: already correct, list of strings, single dict, single string.
    `keys` = the expected keys, used to parse 'key: value' strings as a fallback.
    """
    if not val:
        return []
    if isinstance(val, dict):
        val = [val]
    if not isinstance(val, list):
        val = [val]
    result = []
    for item in val:
        if isinstance(item, dict):
            result.append(item)
        elif isinstance(item, str):
            # Best-effort: try to split "Term: Definition" style strings
            if ":" in item and len(keys) >= 2:
                parts = item.split(":", 1)
                result.append({keys[0]: parts[0].strip(), keys[1]: parts[1].strip()})
            else:
                result.append({keys[0]: item})
    return result


def _normalize_appendix(appendix: dict) -> dict:
    """Ensure appendix arrays are always lists of dicts, never lists of strings."""
    appendix["glossary"] = _normalize_list_of_dicts(
        appendix.get("glossary", []), ["term", "definition"]
    )
    appendix["locations"] = _normalize_list_of_dicts(
        appendix.get("locations", []), ["name", "description"]
    )
    appendix["magic_items"] = _normalize_list_of_dicts(
        appendix.get("magic_items", []), ["name", "description"]
    )
    appendix["monsters"] = _normalize_list_of_dicts(
        appendix.get("monsters", []), ["name", "description"]
    )
    return appendix


def _normalize_npc(npc: dict) -> dict:
    """Ensure NPC fields are the expected types."""
    # dm_tips must be a list of strings
    tips = npc.get("dm_tips", [])
    if isinstance(tips, str):
        npc["dm_tips"] = [t.strip() for t in tips.split("\n") if t.strip()]
    elif isinstance(tips, list):
        npc["dm_tips"] = [str(t) for t in tips]
    # personality_traits must be a list
    traits = npc.get("personality_traits", [])
    if isinstance(traits, str):
        npc["personality_traits"] = [t.strip() for t in traits.split(",") if t.strip()]
    return npc


def _parse_json(text: str) -> Any:
    """Robustly parse JSON from a model response."""
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1]) if lines[-1].strip() == "```" else "\n".join(lines[1:])
    return json.loads(text)


async def generate_skeleton(
    client: AsyncOpenAI,
    idea: str,
    answers: dict[str, str],
    on_progress,
) -> dict:
    """Orchestrator call: produce campaign skeleton from idea + answers."""
    await on_progress("orchestrator", "thinking", "Designing your campaign world…")

    # Build formatted answers string
    answers_text = "\n".join(
        f"Q: {q}\nA: {a}" for q, a in answers.items()
    )

    # Infer player count and session count from answers
    player_count = 4
    total_sessions = 6
    for a in answers.values():
        low = a.lower()
        if "2" in low and "player" in low:
            player_count = 2
        elif "3" in low and "player" in low:
            player_count = 3
        elif "5" in low and "player" in low:
            player_count = 5
        elif "6" in low and "player" in low:
            player_count = 6
        if "one-shot" in low or "one shot" in low or "single session" in low:
            total_sessions = 1
        elif "short" in low or "3 session" in low or "three session" in low:
            total_sessions = 3
        elif "long" in low or "10" in low or "twelve" in low:
            total_sessions = 10

    prompt = SKELETON_PROMPT.format(
        idea=idea,
        answers=answers_text,
        player_count=player_count,
        total_sessions=total_sessions,
    )

    response = await client.chat.completions.create(
        model=ORCHESTRATOR_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_ORCHESTRATOR},
            {"role": "user", "content": prompt},
        ],
        temperature=0.8,
        response_format={"type": "json_object"},
    )

    skeleton = _parse_json(response.choices[0].message.content)
    await on_progress("orchestrator", "complete", f"Campaign '{skeleton['title']}' designed!")
    return skeleton


async def generate_chapter(
    client: AsyncOpenAI,
    skeleton: dict,
    chapter: dict,
    on_progress,
) -> dict:
    """Sub-agent: write one chapter."""
    await on_progress(
        f"chapter_{chapter['id']}",
        "writing",
        f"Writing {chapter['title']}…",
    )

    prompt = CHAPTER_PROMPT.format(
        campaign_title=skeleton["title"],
        premise=skeleton["premise"],
        three_act=json.dumps(skeleton["three_act_structure"]),
        chapter_number=chapter["number"],
        chapter_title=chapter["title"],
        chapter_synopsis=chapter["synopsis"],
        key_moments=", ".join(chapter.get("key_moments", [])),
        chapter_id=chapter["id"],
    )

    response = await client.chat.completions.create(
        model=AGENT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_ORCHESTRATOR},
            {"role": "user", "content": prompt},
        ],
        temperature=0.85,
        response_format={"type": "json_object"},
    )

    result = _parse_json(response.choices[0].message.content)
    await on_progress(f"chapter_{chapter['id']}", "complete", f"✓ {chapter['title']} done")
    return result


async def generate_npc(
    client: AsyncOpenAI,
    skeleton: dict,
    npc: dict,
    on_progress,
) -> dict:
    """Sub-agent: write one NPC profile."""
    await on_progress(f"npc_{npc['id']}", "writing", f"Creating {npc['name']}…")

    prompt = NPC_PROMPT.format(
        campaign_title=skeleton["title"],
        premise=skeleton["premise"],
        setting=json.dumps(skeleton["setting"]),
        npc_name=npc["name"],
        npc_role=npc["role"],
        npc_importance=npc.get("importance", "minor"),
        npc_id=npc["id"],
    )

    response = await client.chat.completions.create(
        model=AGENT_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_ORCHESTRATOR},
            {"role": "user", "content": prompt},
        ],
        temperature=0.85,
        response_format={"type": "json_object"},
    )

    result = _normalize_npc(_parse_json(response.choices[0].message.content))
    await on_progress(f"npc_{npc['id']}", "complete", f"✓ {npc['name']} ready")
    return result


async def generate_appendix(
    client: AsyncOpenAI,
    skeleton: dict,
    chapters: list[dict],
    npcs: list[dict],
    on_progress,
) -> dict:
    """Sub-agent: write the full appendix."""
    await on_progress("appendix", "writing", "Compiling appendix…")

    chapters_summary = "; ".join(
        f"Ch{c.get('number', '?')}: {c.get('title', '?')}" for c in skeleton.get("chapters", [])
    )
    npcs_summary = "; ".join(
        f"{n['name']} ({n['role']})" for n in skeleton.get("npcs", [])
    )

    prompt = APPENDIX_PROMPT.format(
        campaign_title=skeleton["title"],
        premise=skeleton["premise"],
        chapters_summary=chapters_summary,
        npcs_summary=npcs_summary,
    )

    response = await client.chat.completions.create(
        model=NANO_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_ORCHESTRATOR},
            {"role": "user", "content": prompt},
        ],
        temperature=0.7,
        response_format={"type": "json_object"},
    )

    result = _normalize_appendix(_parse_json(response.choices[0].message.content))
    await on_progress("appendix", "complete", "✓ Appendix compiled")
    return result


async def generate_how_to_run(
    client: AsyncOpenAI,
    skeleton: dict,
    on_progress,
) -> dict:
    """Nano agent: write the first-time DM guide for this specific campaign."""
    await on_progress("how_to_run", "writing", "Writing first-time DM guide…")

    chapter_list = "; ".join(
        f"Chapter {c['number']}: {c['title']}" for c in skeleton.get("chapters", [])
    )
    npc_list = ", ".join(n["name"] for n in skeleton.get("npcs", []))
    total_sessions = skeleton.get("total_sessions", len(skeleton.get("chapters", [])))
    player_count = skeleton.get("player_count", 4)

    prompt = HOW_TO_RUN_PROMPT.format(
        campaign_title=skeleton["title"],
        premise=skeleton["premise"],
        chapter_count=len(skeleton.get("chapters", [])),
        total_sessions=total_sessions,
        player_count=player_count,
        chapter_list=chapter_list,
        npc_list=npc_list,
    )

    response = await client.chat.completions.create(
        model=NANO_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_ORCHESTRATOR},
            {"role": "user", "content": prompt},
        ],
        temperature=0.5,
        response_format={"type": "json_object"},
    )

    result = _parse_json(response.choices[0].message.content)
    await on_progress("how_to_run", "complete", "✓ DM guide ready")
    return result


async def quality_check(
    client: AsyncOpenAI,
    skeleton: dict,
    chapters: list[dict],
    on_progress,
) -> dict:
    """Orchestrator reviews the full campaign for coherence."""
    await on_progress("orchestrator", "reviewing", "Reviewing campaign for coherence…")

    chapter_summaries = "; ".join(
        f"Ch{c.get('number', '?')}: {c.get('title', c.get('chapter_id', '?'))}"
        for c in chapters
    )

    prompt = QUALITY_CHECK_PROMPT.format(
        campaign_title=skeleton["title"],
        chapter_summaries=chapter_summaries,
    )

    response = await client.chat.completions.create(
        model=ORCHESTRATOR_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_ORCHESTRATOR},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        response_format={"type": "json_object"},
    )

    result = _parse_json(response.choices[0].message.content)
    await on_progress("orchestrator", "complete", "Campaign review complete!")
    return result


async def generate_campaign(
    idea: str,
    answers: dict[str, str],
    on_progress,
) -> dict:
    """
    Full orchestration pipeline:
    1. Orchestrator designs skeleton
    2. Sub-agents write chapters + NPCs in parallel
    3. Sub-agent writes appendix
    4. Orchestrator quality-checks
    Returns the assembled campaign dict.
    """
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # Step 1: Skeleton
    skeleton = await generate_skeleton(client, idea, answers, on_progress)

    # Step 2: Fan out — chapters and NPCs in parallel
    chapter_tasks = [
        generate_chapter(client, skeleton, ch, on_progress)
        for ch in skeleton.get("chapters", [])
    ]
    npc_tasks = [
        generate_npc(client, skeleton, npc, on_progress)
        for npc in skeleton.get("npcs", [])
    ]

    await on_progress(
        "fanout",
        "running",
        f"Spawning {len(chapter_tasks)} chapter agents + {len(npc_tasks)} NPC agents in parallel…",
    )

    results = await asyncio.gather(*chapter_tasks, *npc_tasks, return_exceptions=True)

    chapters = []
    npcs = []
    errors = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            errors.append(str(r))
        elif i < len(chapter_tasks):
            chapters.append(r)
        else:
            npcs.append(r)

    if errors:
        await on_progress("warning", "error", f"Some agents had issues: {'; '.join(errors[:3])}")

    # Step 3: Appendix + DM guide in parallel (both independent of each other)
    appendix, how_to_run = await asyncio.gather(
        generate_appendix(client, skeleton, chapters, npcs, on_progress),
        generate_how_to_run(client, skeleton, on_progress),
    )

    # Step 4: Quality check
    qc = await quality_check(client, skeleton, chapters, on_progress)

    return {
        "skeleton": skeleton,
        "chapters": chapters,
        "npcs": npcs,
        "appendix": appendix,
        "how_to_run": how_to_run,
        "quality_check": qc,
    }
