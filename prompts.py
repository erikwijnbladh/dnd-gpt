"""All prompts used by the campaign generator."""

SYSTEM_PLANNER = """You are an expert Dungeon Master and campaign designer with 20 years of experience.
You are helping a first-time DM create their very first D&D campaign.
Your job right now is to ask clarifying questions so you can design the perfect campaign for them.

The questions you ask should be:
- Written in plain English, zero D&D jargon
- Short and easy to understand for someone who has never played D&D
- Designed to uncover: setting, tone, player count, desired length, content preferences

You must return ONLY valid JSON. No markdown, no commentary.
"""

PLAN_QUESTIONS_PROMPT = """A first-time Dungeon Master has this campaign idea:

"{idea}"

Your job is to figure out what is ALREADY CLEAR from the idea, and only ask about what is GENUINELY MISSING.

Step 1 — Extract what is already known:
- Setting/world: is it described? (e.g. cosmic horror, dying world, fused flesh/machine = YES, clearly established)
- Tone/mood: is it implied? (e.g. "screaming engine", "corrupting force" = dark/horror tone is obvious)
- Story themes: any clear themes already?
- Specific elements they clearly want included?

Step 2 — Identify only the true gaps. Common gaps for a first-time DM:
- How many people are playing (almost never in the idea)
- How long they want the campaign to last (almost never in the idea)
- Content limits or preferences (gore, humor, romance, etc.)
- Any specific things they want included or excluded beyond what's in the idea

Step 3 — Generate ONLY questions about the genuine gaps. Do NOT ask about anything already clear from the idea.
- If the setting is obvious, do not ask about setting.
- If the tone is obvious, do not ask about tone.
- Typically 2-4 questions is right for a detailed idea. Only ask more if there are more real gaps.
- Every question must be in plain English. No D&D jargon.

Return JSON in this exact format:
{{
  "already_known": {{
    "setting": "what you extracted about setting, or null",
    "tone": "what you extracted about tone, or null",
    "themes": "what you extracted about themes, or null"
  }},
  "questions": [
    {{
      "id": "q1",
      "question": "Question text here",
      "hint": "Optional one-line hint or example answers (or null)",
      "type": "open" | "choice",
      "choices": ["option1", "option2"] | null
    }}
  ]
}}
"""

SYSTEM_ORCHESTRATOR = """You are a master Dungeon Master and professional campaign designer.
You are creating a complete, playable D&D 5th Edition campaign for a first-time DM.
The campaign should be structured like the official adventure books (Lost Mines of Phandelver, Curse of Strahd).
Include everything a first-time DM needs to run the game confidently.

You must return ONLY valid JSON. No markdown, no commentary.
"""

SKELETON_PROMPT = """Design a complete campaign skeleton based on this idea and the DM's answers:

ORIGINAL IDEA: {idea}

DM'S ANSWERS:
{answers}

Create a campaign skeleton. Think carefully about pacing, difficulty curve, and first-time DM friendliness.

Return JSON in this exact format:
{{
  "title": "Campaign title",
  "tagline": "One evocative sentence",
  "premise": "2-3 paragraph overview of the campaign story",
  "setting": {{
    "name": "Name of the region/world",
    "description": "2 paragraph description of the setting",
    "atmosphere": "The overall feel and mood"
  }},
  "three_act_structure": {{
    "act1": "What happens in act 1 (setup)",
    "act2": "What happens in act 2 (confrontation)",
    "act3": "What happens in act 3 (resolution)"
  }},
  "chapters": [
    {{
      "id": "ch1",
      "number": 1,
      "title": "Chapter title",
      "synopsis": "2-3 sentence synopsis",
      "estimated_sessions": 1,
      "key_moments": ["moment1", "moment2", "moment3"]
    }}
  ],
  "npcs": [
    {{
      "id": "npc1",
      "name": "NPC name",
      "role": "Their role in the story",
      "first_appears": "ch1",
      "importance": "major" | "minor"
    }}
  ],
  "encounters": [
    {{
      "id": "enc1",
      "name": "Encounter name",
      "type": "combat" | "social" | "exploration" | "puzzle",
      "difficulty": "easy" | "medium" | "hard" | "deadly",
      "chapter": "ch1"
    }}
  ],
  "player_count": {player_count},
  "total_sessions": {total_sessions}
}}
"""

CHAPTER_PROMPT = """You are writing Chapter {chapter_number} of a D&D campaign book. You are a professional campaign author.

═══════════════════════════════════════
CAMPAIGN OVERVIEW
═══════════════════════════════════════
Title: {campaign_title}
Premise: {premise}
Three-act structure: {three_act}

Full chapter plan (all chapters, for context):
{all_chapters_plan}

═══════════════════════════════════════
NAMED NPCs — USE EXACT NAMES ONLY
═══════════════════════════════════════
These are the ONLY major characters in this campaign. Do not invent new named characters.
Every social encounter must involve at least one of these NPCs.
DM Notes must explicitly describe each relevant NPC's actions and motivations in this chapter.

{npc_roster}

═══════════════════════════════════════
STORY SO FAR (what happened in previous chapters)
═══════════════════════════════════════
{prior_chapters_context}

═══════════════════════════════════════
THIS CHAPTER
═══════════════════════════════════════
Number: {chapter_number}
Title: {chapter_title}
Synopsis: {chapter_synopsis}
Key moments that must happen: {key_moments}

═══════════════════════════════════════
WRITING RULES
═══════════════════════════════════════
1. Every NPC listed above who is active in this chapter MUST appear by exact name in dm_notes and relevant encounters.
2. Scene_setting must explicitly reference what happened in the previous chapter to create continuity.
3. Each encounter's setup and dm_notes must name which NPC is involved.
4. What_happens_next must name the specific NPCs and locations the players will encounter next.
5. Treat this as one chapter of a coherent novel — events and NPC states carry over from prior chapters.

Return JSON:
{{
  "chapter_id": "{chapter_id}",
  "scene_setting": "2-3 paragraphs. Open by referencing what just happened (previous chapter outcome). Set the scene vividly.",
  "read_aloud_boxes": [
    {{
      "id": "ra1",
      "trigger": "Specific trigger condition",
      "text": "Atmospheric text read aloud to players. Present tense, 3-5 sentences."
    }}
  ],
  "dm_notes": "Detailed behind-the-scenes notes. Must include: (a) what each active NPC is doing and why, (b) secrets the players don't know yet, (c) how this chapter's events change the NPC relationships going forward.",
  "encounters": [
    {{
      "id": "enc_ch{chapter_number}_1",
      "name": "Encounter name",
      "type": "combat | social | exploration | puzzle",
      "difficulty": "easy | medium | hard",
      "setup": "How this encounter begins. Name the NPC involved if social.",
      "read_aloud": "Text to read when the encounter begins.",
      "dm_notes": "How to run it. NPC tactics and dialogue cues. Branching outcomes.",
      "rewards": "Concrete rewards — information, items, NPC trust, story advancement.",
      "failure_state": "What happens if players fail or skip this."
    }}
  ],
  "what_happens_next": "2-3 sentences. Name the specific NPCs and location the players move toward. Set up the next chapter's opening situation explicitly."
}}
"""

NPC_PROMPT = """Write a complete NPC profile for this character in the campaign.

CAMPAIGN: {campaign_title}
PREMISE: {premise}
SETTING: {setting}

NPC TO WRITE:
Name: {npc_name}
Role in story: {npc_role}
Importance: {npc_importance}
First appears in: {npc_first_appears}

Chapters they are active in (use these to make the NPC's arc specific and concrete):
{npc_chapter_context}

Write a complete NPC profile. Their arc, goals, and behaviour must be grounded in the specific chapters listed above — not generic.

Return JSON:
{{
  "npc_id": "{npc_id}",
  "name": "{npc_name}",
  "race_and_class": "e.g., 'Human merchant' or 'Dwarf warrior'",
  "age": "approximate age",
  "appearance": "3-4 sentence vivid physical description",
  "personality_traits": ["trait1", "trait2", "trait3"],
  "ideals": "What they believe in most deeply",
  "bonds": "Who or what they care about most (must reference campaign-specific people/places)",
  "flaws": "Their greatest weakness or blind spot",
  "secret": "Something they are hiding that is directly relevant to the campaign plot (not generic)",
  "speech_pattern": "How they talk — accent, vocabulary, verbal habits",
  "campaign_arc": "2-3 sentences describing how this NPC changes across the campaign — their journey from first appearance to the end",
  "chapter_roles": [
    {{
      "chapter": "ch1",
      "role": "Exactly what this NPC is doing in this chapter and why"
    }}
  ],
  "sample_dialogue": [
    {{
      "situation": "When players first meet them",
      "line": "Example line of dialogue"
    }},
    {{
      "situation": "When asked for help",
      "line": "Example line of dialogue"
    }},
    {{
      "situation": "When they are angry or threatened",
      "line": "Example line of dialogue"
    }}
  ],
  "dm_tips": ["tip1 — specific to how this NPC behaves across the campaign", "tip2", "tip3", "tip4"],
  "stat_block_summary": {{
    "alignment": "e.g., Lawful Good",
    "challenge_rating": "number or null",
    "hit_points": "number",
    "armor_class": "number",
    "key_abilities": ["ability1", "ability2"]
  }}
}}
"""

APPENDIX_PROMPT = """Write the appendix for this D&D campaign, including all reference materials a first-time DM needs.

CAMPAIGN: {campaign_title}
PREMISE: {premise}
CHAPTERS SUMMARY: {chapters_summary}
NPCS: {npcs_summary}

Write a complete appendix. Include:
1. Glossary of terms (explain D&D terms used in the campaign in plain English)
2. Key locations (each location players will visit)
3. Magic items (any special items in the campaign)
4. Monsters and enemies (stats and flavor for creatures encountered)
5. DM Quick Reference (cheat sheet of the most important rules for running this campaign)

Return JSON:
{{
  "glossary": [
    {{
      "term": "Term",
      "definition": "Plain English definition"
    }}
  ],
  "locations": [
    {{
      "id": "loc1",
      "name": "Location name",
      "type": "town | dungeon | wilderness | building",
      "description": "Vivid 2-3 paragraph description",
      "key_features": ["feature1", "feature2"],
      "dm_notes": "Things to know when running scenes here",
      "atmosphere": "The feel of this place"
    }}
  ],
  "magic_items": [
    {{
      "name": "Item name",
      "type": "weapon | armor | wondrous item | etc",
      "rarity": "common | uncommon | rare | very rare",
      "description": "What it looks like and its lore",
      "properties": "What it does mechanically",
      "where_found": "Where players can find this"
    }}
  ],
  "monsters": [
    {{
      "name": "Monster name",
      "description": "What it looks like, its nature",
      "challenge_rating": "number",
      "hit_points": "number",
      "armor_class": "number",
      "speed": "number ft",
      "key_attacks": ["attack1", "attack2"],
      "special_abilities": ["ability1"],
      "tactics": "How this creature fights",
      "loot": "What players find if they defeat it"
    }}
  ],
  "dm_quick_reference": {{
    "core_rules_to_know": ["rule1", "rule2", "rule3"],
    "combat_flow": "Step by step combat summary",
    "skill_checks": "When and how to call for skill checks",
    "session_tips": ["tip1", "tip2", "tip3"]
  }}
}}
"""

QUALITY_CHECK_PROMPT = """You are reviewing a complete D&D campaign for a first-time Dungeon Master.
Check the following:
1. Is the campaign coherent? Do the chapters connect logically?
2. Are the named NPCs referenced consistently across chapters by their exact names?
3. Is the difficulty appropriate for new players?
4. Are there any plot holes or unanswered questions?
5. Is there enough guidance for a first-time DM?

Campaign title: {campaign_title}
Named NPCs: {npc_list}

Chapter content (scene setting + DM notes excerpts):
{chapter_content}

Return a JSON report:
{{
  "overall_quality": "excellent" | "good" | "needs_work",
  "coherence_score": 1-10,
  "beginner_friendliness": 1-10,
  "issues": [
    {{
      "severity": "critical" | "minor",
      "description": "Issue description",
      "suggestion": "How to fix it"
    }}
  ],
  "strengths": ["strength1", "strength2"],
  "summary": "2-3 sentence overall assessment"
}}
"""

HOW_TO_RUN_PROMPT = """You are writing the very first page of a D&D campaign book for a first-time Dungeon Master.
This person has never run a game before. They just received a full campaign book and their first question is:
"What do I actually DO with this? Where do I start?"

Write them a clear, friendly, numbered guide. Use plain English only. No jargon unless you immediately explain it.
Think of it like a friend who has run D&D a hundred times is sitting next to them explaining exactly what to do.

Campaign details:
Title: {campaign_title}
Premise: {premise}
Number of chapters: {chapter_count}
Estimated sessions: {total_sessions}
Player count: {player_count}
Chapter list: {chapter_list}
Major NPCs: {npc_list}

Write the guide in this JSON format:
{{
  "before_session_1": {{
    "title": "Before Your First Session",
    "steps": [
      "Step 1 text — concrete and specific to this campaign",
      "Step 2 text",
      "Step 3 text",
      "Step 4 text",
      "Step 5 text"
    ],
    "what_to_tell_your_players": "2-3 sentences to read or paraphrase to your players before session 1 to set the scene. No spoilers."
  }},
  "session_plan": [
    {{
      "session_number": 1,
      "chapters_to_cover": ["Chapter 1: Title"],
      "goal": "What should happen by the end of this session (1-2 sentences)",
      "dm_focus": "The one thing to focus on as DM this session (1 sentence)"
    }}
  ],
  "running_a_session": {{
    "title": "How to Run a Session: The Basic Loop",
    "intro": "One sentence explaining what a session is",
    "steps": [
      "Step 1: ...",
      "Step 2: ...",
      "Step 3: ...",
      "Step 4: ...",
      "Step 5: ..."
    ]
  }},
  "when_players_go_off_script": {{
    "title": "When Players Do Something Unexpected",
    "rules": [
      "Rule 1 — simple and reassuring",
      "Rule 2",
      "Rule 3"
    ]
  }},
  "quick_reference_card": {{
    "title": "Keep This Next to You While Playing",
    "items": [
      "Item 1 — a short fact or reminder specific to this campaign",
      "Item 2",
      "Item 3",
      "Item 4",
      "Item 5",
      "Item 6"
    ]
  }}
}}
"""
