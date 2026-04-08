"""
Renders the assembled campaign dict to a beautiful Markdown file.
"""
import json
from pathlib import Path


def _slug(text: str) -> str:
    return text.lower().replace(" ", "-").replace("'", "").replace('"', "")[:40]


def render_campaign(campaign: dict, output_dir: Path = Path(".")) -> Path:
    skeleton = campaign["skeleton"]
    chapters = campaign["chapters"]
    npcs = campaign["npcs"]
    appendix = campaign["appendix"]
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
        for tip in npc.get("dm_tips", "").split("\n") if isinstance(npc.get("dm_tips"), str) else [npc.get("dm_tips", "")]:
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
    glossary = appendix.get("glossary", [])
    if glossary:
        lines += ["### Glossary", ""]
        for entry in glossary:
            lines.append(f"**{entry.get('term', '')}** — {entry.get('definition', '')}")
            lines.append("")

    # Locations
    locations = appendix.get("locations", [])
    if locations:
        lines += ["### Key Locations", ""]
        for loc in locations:
            lines += [
                f"#### {loc.get('name', 'Unknown Location')} `{loc.get('type', '').upper()}`",
                "",
                loc.get("description", ""),
                "",
                f"*Atmosphere:* {loc.get('atmosphere', '')}",
                "",
            ]
            for feat in loc.get("key_features", []):
                lines.append(f"- {feat}")
            lines += ["", f"**DM Notes:** {loc.get('dm_notes', '')}", ""]

    # Magic Items
    items = appendix.get("magic_items", [])
    if items:
        lines += ["### Magic Items", ""]
        for item in items:
            lines += [
                f"#### {item.get('name', 'Unknown Item')} *(Rarity: {item.get('rarity', '').title()})*",
                "",
                item.get("description", ""),
                "",
                f"**Properties:** {item.get('properties', '')}",
                "",
                f"**Found:** {item.get('where_found', '')}",
                "",
            ]

    # Monsters
    monsters = appendix.get("monsters", [])
    if monsters:
        lines += ["### Monsters & Enemies", ""]
        for m in monsters:
            lines += [
                f"#### {m.get('name', 'Unknown')} CR {m.get('challenge_rating', '?')}",
                "",
                m.get("description", ""),
                "",
                f"| HP | AC | Speed |",
                f"|----|----|----|",
                f"| {m.get('hit_points', '—')} | {m.get('armor_class', '—')} | {m.get('speed', '—')} |",
                "",
                f"**Tactics:** {m.get('tactics', '')}",
                "",
                f"**Loot:** {m.get('loot', 'Nothing special')}",
                "",
            ]

    # DM Quick Reference
    qref = appendix.get("dm_quick_reference", {})
    if qref:
        lines += [
            "### DM Quick Reference",
            "",
            "**Core Rules to Know:**",
            "",
        ]
        for rule in qref.get("core_rules_to_know", []):
            lines.append(f"- {rule}")
        lines += [
            "",
            f"**Combat Flow:** {qref.get('combat_flow', '')}",
            "",
            f"**Skill Checks:** {qref.get('skill_checks', '')}",
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
