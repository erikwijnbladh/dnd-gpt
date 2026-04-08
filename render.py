"""
Renders the assembled campaign dict to a beautiful Markdown file.
"""
import json
from pathlib import Path


def _slug(text: str) -> str:
    return text.lower().replace(" ", "-").replace("'", "").replace('"', "")[:40]


def _g(obj, key: str, default="") -> str:
    """Safely get a value from a dict that might actually be a string."""
    if isinstance(obj, dict):
        return obj.get(key, default)
    return default


def _as_list(val) -> list:
    """Ensure a value that should be a list actually is one."""
    if isinstance(val, list):
        return val
    if val:
        return [val]
    return []


def render_campaign(campaign: dict, output_dir: Path = Path(".")) -> Path:
    skeleton = campaign["skeleton"]
    chapters = campaign["chapters"]
    npcs = campaign["npcs"]
    appendix = campaign["appendix"]
    how_to_run = campaign.get("how_to_run", {})
    qc = campaign.get("quality_check", {})

    title = skeleton.get("title", "My Campaign")
    slug = _slug(title)
    output_path = output_dir / f"{slug}.md"

    lines = []

    # ─── Cover ───────────────────────────────────────────────────────────
    lines += [
        f"# {title}",
        "",
        f"*{skeleton.get('tagline', '')}*",
        "",
        "---",
        "",
    ]

    # ─── How to Run This Campaign ────────────────────────────────────────
    if how_to_run:
        lines += [
            "---",
            "",
            "## How to Run This Campaign",
            "",
            "> This section is for you, the Dungeon Master. Read this before anything else.",
            "",
        ]

        # Before session 1
        bef = how_to_run.get("before_session_1", {})
        if bef:
            lines += [f"### {bef.get('title', 'Before Your First Session')}", ""]
            for i, step in enumerate(_as_list(bef.get("steps", [])), 1):
                lines.append(f"{i}. {step}")
            lines.append("")
            if bef.get("what_to_tell_your_players"):
                lines += [
                    "**What to tell your players before you begin:**",
                    "",
                    f"> {bef['what_to_tell_your_players']}",
                    "",
                ]

        # Session plan
        session_plan = _as_list(how_to_run.get("session_plan", []))
        if session_plan:
            lines += ["### Session-by-Session Plan", ""]
            for s in session_plan:
                if not isinstance(s, dict):
                    continue
                chapters_covered = ", ".join(_as_list(s.get("chapters_to_cover", [])))
                lines += [
                    f"**Session {s.get('session_number', '?')}** — {chapters_covered}",
                    "",
                    f"- *Goal:* {s.get('goal', '')}",
                    f"- *Focus on:* {s.get('dm_focus', '')}",
                    "",
                ]

        # Running a session loop
        loop = how_to_run.get("running_a_session", {})
        if loop:
            lines += [f"### {loop.get('title', 'How to Run a Session')}", ""]
            if loop.get("intro"):
                lines += [loop["intro"], ""]
            for i, step in enumerate(_as_list(loop.get("steps", [])), 1):
                lines.append(f"{i}. {step}")
            lines.append("")

        # Off script
        off = how_to_run.get("when_players_go_off_script", {})
        if off:
            lines += [f"### {off.get('title', 'When Players Go Off Script')}", ""]
            for rule in _as_list(off.get("rules", [])):
                lines.append(f"- {rule}")
            lines.append("")

        # Quick reference card
        qrc = how_to_run.get("quick_reference_card", {})
        if qrc:
            lines += [
                f"### {qrc.get('title', 'Quick Reference')}",
                "",
            ]
            for item in _as_list(qrc.get("items", [])):
                lines.append(f"- {item}")
            lines.append("")

        lines += ["---", ""]

    # ─── Table of Contents ───────────────────────────────────────────────
    lines += ["## Table of Contents", ""]
    lines.append("- [Introduction](#introduction)")
    for ch in skeleton.get("chapters", []):
        anchor = _slug(ch["title"])
        lines.append(f"- [Chapter {ch['number']}: {ch['title']}](#{anchor})")
    lines.append("- [NPC Roster](#npc-roster)")
    lines.append("- [Appendix](#appendix)")
    lines += ["", "---", ""]

    # ─── Introduction ────────────────────────────────────────────────────
    lines += [
        "## Introduction",
        "",
        "### What Is This Campaign?",
        "",
        skeleton.get("premise", ""),
        "",
        "### The Setting",
        "",
        f"**{skeleton['setting']['name']}** — {skeleton['setting']['description']}",
        "",
        f"*Atmosphere:* {skeleton['setting']['atmosphere']}",
        "",
        "### Story Overview",
        "",
    ]
    act = skeleton.get("three_act_structure", {})
    lines += [
        f"**Act I — The Beginning:** {act.get('act1', '')}",
        "",
        f"**Act II — The Middle:** {act.get('act2', '')}",
        "",
        f"**Act III — The End:** {act.get('act3', '')}",
        "",
        "---",
        "",
    ]

    # ─── Chapters ────────────────────────────────────────────────────────
    for ch_data in chapters:
        ch_id = ch_data.get("chapter_id", "")
        # Find the skeleton entry for this chapter
        skel_ch = next(
            (c for c in skeleton.get("chapters", []) if c["id"] == ch_id),
            {},
        )
        ch_num = skel_ch.get("number", "?")
        ch_title = skel_ch.get("title", ch_id)
        anchor = _slug(ch_title)

        lines += [
            f"## Chapter {ch_num}: {ch_title}",
            f"<a name='{anchor}'></a>",
            "",
        ]

        lines += [
            "### Scene Setting",
            "",
            ch_data.get("scene_setting", ""),
            "",
        ]

        for ra in ch_data.get("read_aloud_boxes", []):
            lines += [
                f"> **📖 Read Aloud** *(when: {ra.get('trigger', '')})*",
                ">",
            ]
            for line in ra.get("text", "").split("\n"):
                lines.append(f"> *{line}*")
            lines += [">", ""]

        lines += [
            "### DM Notes",
            "",
            ch_data.get("dm_notes", ""),
            "",
            "### Encounters",
            "",
        ]

        for enc in ch_data.get("encounters", []):
            diff_emoji = {
                "easy": "🟢",
                "medium": "🟡",
                "hard": "🟠",
                "deadly": "🔴",
            }.get(enc.get("difficulty", ""), "⚪")
            type_emoji = {
                "combat": "⚔️",
                "social": "💬",
                "exploration": "🗺️",
                "puzzle": "🧩",
            }.get(enc.get("type", ""), "❓")

            lines += [
                f"#### {type_emoji} {enc.get('name', 'Encounter')} {diff_emoji} `{enc.get('difficulty', '').upper()}`",
                "",
                f"**Setup:** {enc.get('setup', '')}",
                "",
            ]
            if enc.get("read_aloud"):
                lines += [
                    f"> **📖 Read Aloud**",
                    ">",
                    f"> *{enc['read_aloud']}*",
                    "",
                ]
            lines += [
                f"**DM Notes:** {enc.get('dm_notes', '')}",
                "",
                f"**Rewards:** {enc.get('rewards', 'None specified')}",
                "",
                f"**If players fail or skip:** {enc.get('failure_state', 'The story continues.')}",
                "",
            ]

        if ch_data.get("what_happens_next"):
            lines += [
                "### What Happens Next",
                "",
                ch_data["what_happens_next"],
                "",
            ]

        lines += ["---", ""]

    # ─── NPC Roster ──────────────────────────────────────────────────────
    lines += [
        "## NPC Roster",
        "<a name='npc-roster'></a>",
        "",
    ]

    for npc in npcs:
        lines += [
            f"### {npc.get('name', 'Unknown')}",
            "",
            f"*{npc.get('race_and_class', '')} · {npc.get('age', '')} · {npc.get('stat_block_summary', {}).get('alignment', '')}*",
            "",
            f"**Appearance:** {npc.get('appearance', '')}",
            "",
        ]

        traits = npc.get("personality_traits", [])
        if traits:
            lines.append(f"**Personality:** {' · '.join(traits)}")
            lines.append("")

        lines += [
            f"**Ideal:** {npc.get('ideals', '')}",
            "",
            f"**Bond:** {npc.get('bonds', '')}",
            "",
            f"**Flaw:** {npc.get('flaws', '')}",
            "",
        ]

        if npc.get("secret"):
            lines += [f"**🔒 Secret:** {npc['secret']}", ""]

        lines += [
            f"**How They Speak:** {npc.get('speech_pattern', '')}",
            "",
            "**Sample Dialogue:**",
            "",
        ]
        for dlg in npc.get("sample_dialogue", []):
            lines += [
                f"> *{dlg.get('situation', '')}:*",
                f"> \"{dlg.get('line', '')}\"",
                "",
            ]

        lines += [
            "**DM Tips:**",
            "",
        ]
        raw_tips = npc.get("dm_tips", "")
        if isinstance(raw_tips, list):
            tips = [str(t) for t in raw_tips]
        else:
            tips = str(raw_tips).split("\n")
        for tip in tips:
            if tip.strip():
                lines.append(f"- {tip.strip()}")
        lines += ["", ""]

        stats = npc.get("stat_block_summary", {})
        if stats:
            lines += [
                "<details>",
                "<summary>Stat Block Summary</summary>",
                "",
                f"| HP | AC | CR | Alignment |",
                f"|----|----|----|-----------| ",
                f"| {stats.get('hit_points', '—')} | {stats.get('armor_class', '—')} | {stats.get('challenge_rating', '—')} | {stats.get('alignment', '—')} |",
                "",
                "</details>",
                "",
            ]

        lines += ["---", ""]

    # ─── Appendix ────────────────────────────────────────────────────────
    lines += [
        "## Appendix",
        "<a name='appendix'></a>",
        "",
    ]

    # Glossary
    glossary = _as_list(appendix.get("glossary", []))
    if glossary:
        lines += ["### Glossary", ""]
        for entry in glossary:
            if isinstance(entry, dict):
                lines.append(f"**{_g(entry, 'term')}** — {_g(entry, 'definition')}")
            else:
                lines.append(str(entry))
            lines.append("")

    # Locations
    locations = _as_list(appendix.get("locations", []))
    if locations:
        lines += ["### Key Locations", ""]
        for loc in locations:
            if not isinstance(loc, dict):
                lines += [str(loc), ""]
                continue
            lines += [
                f"#### {_g(loc, 'name', 'Unknown Location')} `{_g(loc, 'type').upper()}`",
                "",
                _g(loc, "description"),
                "",
                f"*Atmosphere:* {_g(loc, 'atmosphere')}",
                "",
            ]
            for feat in _as_list(loc.get("key_features", [])):
                lines.append(f"- {feat}")
            lines += ["", f"**DM Notes:** {_g(loc, 'dm_notes')}", ""]

    # Magic Items
    items = _as_list(appendix.get("magic_items", []))
    if items:
        lines += ["### Magic Items", ""]
        for item in items:
            if not isinstance(item, dict):
                lines += [str(item), ""]
                continue
            lines += [
                f"#### {_g(item, 'name', 'Unknown Item')} *(Rarity: {_g(item, 'rarity').title()})*",
                "",
                _g(item, "description"),
                "",
                f"**Properties:** {_g(item, 'properties')}",
                "",
                f"**Found:** {_g(item, 'where_found')}",
                "",
            ]

    # Monsters
    monsters = _as_list(appendix.get("monsters", []))
    if monsters:
        lines += ["### Monsters & Enemies", ""]
        for m in monsters:
            if not isinstance(m, dict):
                lines += [str(m), ""]
                continue
            lines += [
                f"#### {_g(m, 'name', 'Unknown')} CR {_g(m, 'challenge_rating', '?')}",
                "",
                _g(m, "description"),
                "",
                f"| HP | AC | Speed |",
                f"|----|----|----|",
                f"| {_g(m, 'hit_points', '—')} | {_g(m, 'armor_class', '—')} | {_g(m, 'speed', '—')} |",
                "",
                f"**Tactics:** {_g(m, 'tactics')}",
                "",
                f"**Loot:** {_g(m, 'loot', 'Nothing special')}",
                "",
            ]

    # DM Quick Reference
    qref = appendix.get("dm_quick_reference", {})
    if qref and isinstance(qref, dict):
        lines += [
            "### DM Quick Reference",
            "",
            "**Core Rules to Know:**",
            "",
        ]
        for rule in _as_list(qref.get("core_rules_to_know", [])):
            lines.append(f"- {rule}")
        lines += [
            "",
            f"**Combat Flow:** {_g(qref, 'combat_flow')}",
            "",
            f"**Skill Checks:** {_g(qref, 'skill_checks')}",
            "",
            "**Session Tips:**",
            "",
        ]
        for tip in qref.get("session_tips", []):
            lines.append(f"- {tip}")
        lines.append("")

    # Quality Check Note
    if qc:
        lines += [
            "---",
            "",
            "### Campaign Review *(AI Quality Check)*",
            "",
            f"**Overall:** {qc.get('overall_quality', '').title()} · "
            f"Coherence: {qc.get('coherence_score', '?')}/10 · "
            f"Beginner Friendly: {qc.get('beginner_friendliness', '?')}/10",
            "",
            qc.get("summary", ""),
            "",
        ]
        for s in qc.get("strengths", []):
            lines.append(f"✅ {s}")
        for issue in qc.get("issues", []):
            sev = "⚠️" if issue.get("severity") == "minor" else "🚨"
            lines.append(f"{sev} {issue.get('description', '')} → *{issue.get('suggestion', '')}*")
        lines.append("")

    output_path.write_text("\n".join(lines), encoding="utf-8")
    return output_path
