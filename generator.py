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


async def _review_chapter(
    client: AsyncOpenAI,
    chapter_json: dict,
    skeleton: dict,
    chapter_meta: dict,
    npc_names: list[str],
    prompt: str,
    on_progress,
) -> dict:
    """
    Cheap verdict check on a generated chapter.
    If it fails, the more capable model rewrites the whole thing.
    """
    title = chapter_meta.get("title", chapter_meta.get("id", "?"))
    ch_num = chapter_meta.get("number", "?")

    # Build a compact summary of the chapter for the reviewer
    scene = chapter_json.get("scene_setting", "")[:400]
    dm = chapter_json.get("dm_notes", "")[:400]
    enc_names = [e.get("name", "") for e in chapter_json.get("encounters", [])]
    next_txt = chapter_json.get("what_happens_next", "")[:200]

    verdict_prompt = (
        f"You are reviewing Chapter {ch_num} ('{title}') of the campaign '{skeleton['title']}'.\n\n"
        f"Required NPCs that MUST be named in this chapter (those active by ch{ch_num}):\n"
        + "\n".join(f"- {n}" for n in npc_names)
        + f"\n\nChapter content submitted:\n"
        f"Scene setting: {scene}\n"
        f"DM notes: {dm}\n"
        f"Encounters: {', '.join(enc_names)}\n"
        f"What happens next: {next_txt}\n\n"
        "Grade this chapter. It PASSES only if ALL of the following are true:\n"
        "1. At least one required NPC is referenced BY EXACT NAME in scene_setting or dm_notes\n"
        "2. dm_notes explains what the active NPCs are doing and why — not generic DM advice\n"
        "3. what_happens_next names a specific NPC or location — not a vague transition\n"
        "4. Content is specific to this campaign — not generic D&D filler\n\n"
        "Reply with a single word: APPROVED or REVISE"
    )

    verdict_resp = await client.chat.completions.create(
        model=NANO_MODEL,
        messages=[{"role": "user", "content": verdict_prompt}],
        max_tokens=10,
        temperature=0,
    )
    verdict = verdict_resp.choices[0].message.content.strip().upper()

    if "APPROVED" in verdict:
        await on_progress(f"chapter_{chapter_meta['id']}", "approved", f"✓ Ch.{ch_num} review passed")
        return chapter_json

    # Failed — rewrite with the orchestrator model for higher quality
    await on_progress(f"chapter_{chapter_meta['id']}", "revising", f"↺ Ch.{ch_num} rewriting (NPCs missing or too generic)…")

    rewrite_resp = await client.chat.completions.create(
        model=ORCHESTRATOR_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_ORCHESTRATOR},
            {
                "role": "user",
                "content": (
                    f"The following chapter draft failed quality review because it was too generic "
                    f"or did not reference the required NPCs by name.\n\n"
                    f"Required NPCs: {', '.join(npc_names)}\n\n"
                    f"Poor draft:\n{json.dumps(chapter_json, indent=2)[:3000]}\n\n"
                    f"Original instructions:\n{prompt}\n\n"
                    f"Rewrite the full chapter JSON. Every active NPC MUST appear by exact name. "
                    f"Be specific — real character names, real locations, concrete events."
                ),
            },
        ],
        temperature=0.7,
        response_format={"type": "json_object"},
    )

    await on_progress(f"chapter_{chapter_meta['id']}", "complete", f"✓ Ch.{ch_num} rewritten")
    return _parse_json(rewrite_resp.choices[0].message.content)


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


def _ch_num(ch_id: str) -> int:
    """Extract numeric order from a chapter id like 'ch3'."""
    try:
        return int("".join(filter(str.isdigit, ch_id)))
    except (ValueError, TypeError):
        return 1


def _npc_roster_text(npcs: list[dict], up_to_chapter: int) -> str:
    """Build NPC roster string for chapters, including full profiles for active NPCs."""
    lines = []
    for n in npcs:
        first = _ch_num(n.get("first_appears", "ch1"))
        if first > up_to_chapter:
            continue
        name = n.get("name", "?")
        role = n.get("role", n.get("npc_role", "?"))
        traits = n.get("personality_traits", [])
        traits_str = ", ".join(traits[:3]) if traits else ""
        arc = n.get("campaign_arc", "")
        secret = n.get("secret", "")
        lines.append(
            f"• {name} — {role}\n"
            f"  Personality: {traits_str}\n"
            f"  Arc: {arc}\n"
            f"  Secret: {secret}"
        )
    return "\n\n".join(lines) if lines else "No named NPCs introduced yet in this chapter."


def _prior_chapters_context(completed_chapters: list[dict], skeleton_chapters: list[dict]) -> str:
    """Build a narrative summary of all previously written chapters."""
    if not completed_chapters:
        return "This is the first chapter — no prior events."
    lines = []
    sk_map = {ch["id"]: ch for ch in skeleton_chapters}
    for ch in completed_chapters:
        ch_id = ch.get("chapter_id", "?")
        sk = sk_map.get(ch_id, {})
        title = sk.get("title", ch_id)
        number = sk.get("number", "?")
        scene = ch.get("scene_setting", "")[:200]
        next_txt = ch.get("what_happens_next", "")
        enc_names = [e.get("name", "") for e in ch.get("encounters", [])]
        lines.append(
            f"Chapter {number}: {title}\n"
            f"  Summary: {scene}…\n"
            f"  Encounters: {', '.join(enc_names)}\n"
            f"  Leads into: {next_txt}"
        )
    return "\n\n".join(lines)


async def generate_chapter(
    client: AsyncOpenAI,
    skeleton: dict,
    chapter: dict,
    npcs: list[dict],
    completed_chapters: list[dict],
    on_progress,
) -> dict:
    """Sub-agent: write one chapter with full prior context."""
    await on_progress(
        f"chapter_{chapter['id']}",
        "writing",
        f"Writing Ch.{chapter['number']}: {chapter['title']}…",
    )

    this_ch_num = _ch_num(chapter["id"])

    npc_roster = _npc_roster_text(npcs, this_ch_num)
    prior_context = _prior_chapters_context(completed_chapters, skeleton.get("chapters", []))

    all_chapters_plan = "\n".join(
        f"Ch{c['number']}: {c['title']} — {c['synopsis']}"
        for c in skeleton.get("chapters", [])
    )

    prompt = CHAPTER_PROMPT.format(
        campaign_title=skeleton["title"],
        premise=skeleton["premise"],
        three_act=json.dumps(skeleton["three_act_structure"]),
        all_chapters_plan=all_chapters_plan,
        chapter_number=chapter["number"],
        chapter_title=chapter["title"],
        chapter_synopsis=chapter["synopsis"],
        key_moments=", ".join(chapter.get("key_moments", [])),
        chapter_id=chapter["id"],
        npc_roster=npc_roster,
        prior_chapters_context=prior_context,
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

    # Review gate: verify NPCs are named and content is specific; rewrite if not
    active_npc_names = [n["name"] for n in npcs if _ch_num(n.get("first_appears", "ch1")) <= this_ch_num]
    result = await _review_chapter(
        client, result, skeleton, chapter, active_npc_names, prompt, on_progress
    )

    await on_progress(f"chapter_{chapter['id']}", "complete", f"✓ Ch.{chapter['number']} done")
    return result


async def generate_npc(
    client: AsyncOpenAI,
    skeleton: dict,
    npc: dict,
    on_progress,
) -> dict:
    """Sub-agent: write one NPC profile."""
    await on_progress(f"npc_{npc['id']}", "writing", f"Creating {npc['name']}…")

    # Build context for which chapters this NPC is active in
    first_ch = _ch_num(npc.get("first_appears", "ch1"))
    npc_chapters = [
        f"Chapter {ch['number']}: {ch['title']} — {ch['synopsis']}"
        for ch in skeleton.get("chapters", [])
        if _ch_num(ch["id"]) >= first_ch
    ]
    npc_chapter_context = "\n".join(npc_chapters) if npc_chapters else "All chapters"

    prompt = NPC_PROMPT.format(
        campaign_title=skeleton["title"],
        premise=skeleton["premise"],
        setting=json.dumps(skeleton["setting"]),
        npc_name=npc["name"],
        npc_role=npc["role"],
        npc_importance=npc.get("importance", "minor"),
        npc_id=npc["id"],
        npc_first_appears=npc.get("first_appears", "ch1"),
        npc_chapter_context=npc_chapter_context,
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
    npcs: list[dict],
    on_progress,
) -> dict:
    """Orchestrator reviews the full campaign for coherence."""
    await on_progress("orchestrator", "reviewing", "Reviewing campaign for coherence…")

    npc_list = ", ".join(n["name"] for n in npcs) if npcs else "None"

    # Build meaningful content excerpts for each chapter
    chapter_content_parts = []
    for ch in chapters:
        ch_id = ch.get("chapter_id", "?")
        scene = ch.get("scene_setting", "")[:300]
        dm = ch.get("dm_notes", "")[:300]
        enc_names = [e.get("name", "") for e in ch.get("encounters", [])]
        chapter_content_parts.append(
            f"{ch_id}:\n  Scene: {scene}\n  DM notes: {dm}\n  Encounters: {', '.join(enc_names)}"
        )
    chapter_content = "\n\n".join(chapter_content_parts)

    prompt = QUALITY_CHECK_PROMPT.format(
        campaign_title=skeleton["title"],
        npc_list=npc_list,
        chapter_content=chapter_content,
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
    2. NPC agents run in parallel (only need skeleton)
    3. Chapter agents run SEQUENTIALLY — each gets full NPC profiles + prior chapter summaries
    4. Appendix + DM guide in parallel
    5. Orchestrator quality-checks with real content
    Returns the assembled campaign dict.
    """
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # Step 1: Skeleton
    skeleton = await generate_skeleton(client, idea, answers, on_progress)

    errors = []

    # Step 2: NPCs in parallel — they only need the skeleton
    skeleton_npcs = skeleton.get("npcs", [])
    await on_progress("fanout", "running", f"Creating {len(skeleton_npcs)} NPCs in parallel…")
    npc_results = await asyncio.gather(
        *[generate_npc(client, skeleton, npc, on_progress) for npc in skeleton_npcs],
        return_exceptions=True,
    )
    npcs = []
    for r in npc_results:
        if isinstance(r, Exception):
            errors.append(str(r))
        else:
            npcs.append(r)

    # Step 3: Chapters sequentially — each one gets prior chapters + full NPC profiles
    # Sequential is required for narrative coherence: ch5 must know what happened in ch4.
    skeleton_chapters = skeleton.get("chapters", [])
    chapters: list[dict] = []
    for ch in skeleton_chapters:
        try:
            result = await generate_chapter(
                client, skeleton, ch, npcs, chapters, on_progress
            )
            chapters.append(result)
        except Exception as e:
            errors.append(str(e))
            await on_progress("warning", "error", f"Chapter {ch.get('number')} failed: {e}")

    if errors:
        await on_progress("warning", "error", f"Some agents had issues: {'; '.join(errors[:3])}")

    # Step 4: Appendix + DM guide in parallel (both independent of each other)
    appendix, how_to_run = await asyncio.gather(
        generate_appendix(client, skeleton, chapters, npcs, on_progress),
        generate_how_to_run(client, skeleton, on_progress),
    )

    # Step 5: Quality check with real content
    qc = await quality_check(client, skeleton, chapters, npcs, on_progress)

    return {
        "skeleton": skeleton,
        "chapters": chapters,
        "npcs": npcs,
        "appendix": appendix,
        "how_to_run": how_to_run,
        "quality_check": qc,
    }
