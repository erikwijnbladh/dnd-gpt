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

Generate 6 clarifying questions you'd ask them before designing the campaign.
These questions should help you understand: setting/world, tone/mood, player count and experience,
campaign length, content preferences (dark themes, humor, romance, etc.), and any specific elements
they want included or excluded.

Write every question in plain English. Assume the person has never played D&D before.
If a question needs a concept explained, include a one-sentence explanation in parentheses.

Return JSON in this exact format:
{{
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

CHAPTER_PROMPT = """Write the full content for this chapter of the D&D campaign.

CAMPAIGN TITLE: {campaign_title}
CAMPAIGN PREMISE: {premise}
THREE ACT STRUCTURE: {three_act}

CHAPTER TO WRITE:
Number: {chapter_number}
Title: {chapter_title}
Synopsis: {chapter_synopsis}
Key moments that must happen: {key_moments}

Write the complete chapter content. Include:
1. A "Scene Setting" section explaining what has happened and where the players are
2. 2-4 "Read-Aloud" text boxes (text the DM reads directly to players, 2-4 sentences each, atmospheric)
3. Detailed "DM Notes" explaining what is happening behind the scenes
4. At least 2 encounters (can be combat, social, exploration, or puzzle)
5. "What Happens Next" - how this chapter leads to the next

Format as a structured JSON:
{{
  "chapter_id": "{chapter_id}",
  "scene_setting": "Full scene setting text",
  "read_aloud_boxes": [
    {{
      "id": "ra1",
      "trigger": "When to read this (e.g., 'When players first enter the village')",
      "text": "The atmospheric text to read aloud. Written in present tense, second person. Vivid and evocative."
    }}
  ],
  "dm_notes": "Detailed notes for the DM about what is really happening, NPC motivations, secrets",
  "encounters": [
    {{
      "id": "enc_ch{chapter_number}_1",
      "name": "Encounter name",
      "type": "combat" | "social" | "exploration" | "puzzle",
      "difficulty": "easy" | "medium" | "hard",
      "setup": "How this encounter begins",
      "read_aloud": "Text to read when encounter begins",
      "dm_notes": "How to run this encounter, tactics, outcomes",
      "rewards": "What players gain from this encounter",
      "failure_state": "What happens if players fail or avoid this"
    }}
  ],
  "what_happens_next": "Bridge text explaining how this leads to the next chapter"
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

Write a complete NPC profile that will help a first-time DM bring this character to life.

Return JSON:
{{
  "npc_id": "{npc_id}",
  "name": "{npc_name}",
  "race_and_class": "e.g., 'Human merchant' or 'Dwarf warrior'",
  "age": "approximate age",
  "appearance": "3-4 sentence vivid physical description",
  "personality_traits": ["trait1", "trait2", "trait3"],
  "ideals": "What they believe in most deeply",
  "bonds": "Who or what they care about",
  "flaws": "Their greatest weakness or blind spot",
  "secret": "Something they are hiding (or null if none)",
  "speech_pattern": "How they talk — accent, vocabulary, habits",
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
  "role_in_story": "Detailed explanation of their story function",
  "dm_tips": "3-4 tips for a first-time DM on how to play this NPC effectively",
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
2. Are the NPCs consistent throughout?
3. Is the difficulty appropriate for new players?
4. Are there any plot holes or unanswered questions?
5. Is there enough guidance for a first-time DM?

Campaign title: {campaign_title}
Chapter summaries: {chapter_summaries}

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
