export const SYSTEM_ORCHESTRATOR = `You are a master Dungeon Master and professional campaign designer.
You are creating a complete, playable D&D 5th Edition campaign for a first-time DM.
The campaign should be structured like the official adventure books (Lost Mines of Phandelver, Curse of Strahd).
Include everything a first-time DM needs to run the game confidently.
You must return ONLY valid JSON. No markdown, no commentary.`

export const SYSTEM_PLANNER = `You are an expert Dungeon Master and campaign designer with 20 years of experience.
You are helping a first-time DM create their very first D&D campaign.
Your job right now is to ask clarifying questions so you can design the perfect campaign for them.
You must return ONLY valid JSON. No markdown, no commentary.`

export function planQuestionsPrompt(idea: string) {
  return `A first-time Dungeon Master has this campaign idea:

"${idea}"

Step 1 — Extract what is already known from the idea:
- Setting/world: is it described?
- Tone/mood: is it implied?
- Story themes: any clear themes?

Step 2 — Only ask about genuine gaps. Common gaps: player count, session length, content preferences, specific inclusions/exclusions.
Do NOT ask about anything already clear from the idea. Typically 2-4 questions for a detailed idea.

Return JSON:
{
  "already_known": {
    "setting": "what you extracted, or null",
    "tone": "what you extracted, or null",
    "themes": "what you extracted, or null"
  },
  "questions": [
    {
      "id": "q1",
      "question": "Question in plain English",
      "hint": "Optional hint or null",
      "type": "open" | "choice",
      "choices": ["option1"] | null
    }
  ]
}`
}

export function skeletonPrompt(
  idea: string,
  answers: Record<string, string>,
  playerCount: number,
  totalSessions: number
) {
  const answersText = Object.entries(answers)
    .map(([q, a]) => `Q: ${q}\nA: ${a}`)
    .join('\n\n')

  return `Design a complete campaign skeleton based on this idea and the DM's answers:

ORIGINAL IDEA: ${idea}

DM'S ANSWERS:
${answersText}

Return JSON:
{
  "title": "Campaign title",
  "tagline": "One evocative sentence",
  "premise": "2-3 paragraph overview",
  "setting": {
    "name": "Region/world name",
    "description": "2 paragraph description",
    "atmosphere": "Overall feel and mood"
  },
  "three_act_structure": {
    "act1": "What happens in act 1",
    "act2": "What happens in act 2",
    "act3": "What happens in act 3"
  },
  "chapters": [
    {
      "id": "ch1",
      "number": 1,
      "title": "Chapter title",
      "synopsis": "2-3 sentence synopsis",
      "estimated_sessions": 1,
      "key_moments": ["moment1", "moment2"]
    }
  ],
  "npcs": [
    {
      "id": "npc1",
      "name": "NPC name",
      "role": "Their role in the story",
      "first_appears": "ch1",
      "importance": "major" | "minor"
    }
  ],
  "player_count": ${playerCount},
  "total_sessions": ${totalSessions}
}`
}

export function chapterPrompt(
  campaignTitle: string,
  premise: string,
  threeAct: object,
  chapter: { id: string; number: number; title: string; synopsis: string; key_moments: string[] },
  completedChapters: { chapter_id: string; scene_setting: string; what_happens_next: string }[] = []
) {
  const priorContext = completedChapters.length > 0
    ? `\nPRIOR CHAPTERS (for narrative continuity):\n${completedChapters.map((c, i) => `Chapter ${i + 1} — Scene: ${c.scene_setting?.slice(0, 200)}… | Leads into: ${c.what_happens_next}`).join('\n')}\n`
    : ''

  return `Write the full content for this D&D campaign chapter.

CAMPAIGN: ${campaignTitle}
PREMISE: ${premise}
THREE ACT: ${JSON.stringify(threeAct)}
${priorContext}
CHAPTER:
Number: ${chapter.number}
Title: ${chapter.title}
Synopsis: ${chapter.synopsis}
Key moments: ${chapter.key_moments.join(', ')}

Return JSON:
{
  "chapter_id": "${chapter.id}",
  "scene_setting": "Full scene setting text",
  "read_aloud_boxes": [
    {
      "id": "ra1",
      "trigger": "When to read this",
      "text": "Atmospheric present-tense text to read aloud"
    }
  ],
  "dm_notes": "Detailed DM notes about what is happening behind the scenes",
  "encounters": [
    {
      "id": "enc_${chapter.id}_1",
      "name": "Encounter name",
      "type": "combat" | "social" | "exploration" | "puzzle",
      "difficulty": "easy" | "medium" | "hard",
      "setup": "How this encounter begins",
      "read_aloud": "Text to read when encounter begins",
      "dm_notes": "How to run this encounter",
      "rewards": "What players gain",
      "failure_state": "What happens if players fail"
    }
  ],
  "what_happens_next": "Bridge text to next chapter"
}`
}

export function npcPrompt(
  campaignTitle: string,
  premise: string,
  setting: object,
  npc: { id: string; name: string; role: string; importance: string }
) {
  return `Write a complete NPC profile for this D&D campaign character.

CAMPAIGN: ${campaignTitle}
PREMISE: ${premise}
SETTING: ${JSON.stringify(setting)}

NPC:
Name: ${npc.name}
Role: ${npc.role}
Importance: ${npc.importance}

Return JSON:
{
  "npc_id": "${npc.id}",
  "name": "${npc.name}",
  "race_and_class": "e.g. Human merchant",
  "age": "approximate age",
  "appearance": "3-4 sentence vivid description",
  "personality_traits": ["trait1", "trait2", "trait3"],
  "ideals": "What they believe in",
  "bonds": "Who or what they care about",
  "flaws": "Their greatest weakness",
  "secret": "Something they are hiding or null",
  "speech_pattern": "How they talk",
  "sample_dialogue": [
    { "situation": "When players first meet them", "line": "Example dialogue" },
    { "situation": "When asked for help", "line": "Example dialogue" },
    { "situation": "When angry or threatened", "line": "Example dialogue" }
  ],
  "role_in_story": "Detailed story function explanation",
  "dm_tips": ["tip1", "tip2", "tip3"],
  "stat_block_summary": {
    "alignment": "e.g. Lawful Good",
    "challenge_rating": 1,
    "hit_points": 20,
    "armor_class": 12,
    "key_abilities": ["ability1", "ability2"]
  }
}`
}

export function appendixPrompt(
  campaignTitle: string,
  premise: string,
  chaptersStr: string,
  npcsStr: string
) {
  return `Write the complete appendix for this D&D campaign.

CAMPAIGN: ${campaignTitle}
PREMISE: ${premise}
CHAPTERS: ${chaptersStr}
NPCS: ${npcsStr}

Return JSON:
{
  "glossary": [{ "term": "Term", "definition": "Plain English definition" }],
  "locations": [{
    "id": "loc1",
    "name": "Location name",
    "type": "town | dungeon | wilderness | building",
    "description": "2-3 paragraph description",
    "key_features": ["feature1", "feature2"],
    "dm_notes": "Notes for running scenes here",
    "atmosphere": "The feel of this place"
  }],
  "magic_items": [{
    "name": "Item name",
    "type": "weapon | armor | wondrous item",
    "rarity": "common | uncommon | rare | very rare",
    "description": "What it looks like and its lore",
    "properties": "What it does mechanically",
    "where_found": "Where players find this"
  }],
  "monsters": [{
    "name": "Monster name",
    "description": "What it looks like",
    "challenge_rating": 1,
    "hit_points": 20,
    "armor_class": 12,
    "speed": "30 ft",
    "key_attacks": ["attack1"],
    "special_abilities": ["ability1"],
    "tactics": "How this creature fights",
    "loot": "What players find if they defeat it"
  }],
  "dm_quick_reference": {
    "core_rules_to_know": ["rule1", "rule2"],
    "combat_flow": "Step by step combat summary",
    "skill_checks": "When and how to call for skill checks",
    "session_tips": ["tip1", "tip2"]
  }
}`
}

export function howToRunPrompt(
  campaignTitle: string,
  premise: string,
  chapterCount: number,
  totalSessions: number,
  playerCount: number,
  chapterList: string,
  npcList: string
) {
  return `Write a "How to Run This Campaign" guide for a first-time Dungeon Master.
They just received a full campaign book and need to know exactly what to do.

Campaign: ${campaignTitle}
Premise: ${premise}
Chapters: ${chapterCount}
Sessions: ${totalSessions}
Players: ${playerCount}
Chapter list: ${chapterList}
Major NPCs: ${npcList}

Return JSON:
{
  "before_session_1": {
    "title": "Before Your First Session",
    "steps": ["Step 1 specific to this campaign", "Step 2", "Step 3", "Step 4", "Step 5"],
    "what_to_tell_your_players": "2-3 sentences to set the scene. No spoilers."
  },
  "session_plan": [
    {
      "session_number": 1,
      "chapters_to_cover": ["Chapter 1: Title"],
      "goal": "What should happen by end of session",
      "dm_focus": "One thing to focus on as DM"
    }
  ],
  "running_a_session": {
    "title": "How to Run a Session: The Basic Loop",
    "intro": "One sentence explaining what a session is",
    "steps": ["Step 1", "Step 2", "Step 3", "Step 4", "Step 5"]
  },
  "when_players_go_off_script": {
    "title": "When Players Do Something Unexpected",
    "rules": ["Rule 1 — simple and reassuring", "Rule 2", "Rule 3"]
  },
  "quick_reference_card": {
    "title": "Keep This Next to You While Playing",
    "items": ["Item 1 specific to this campaign", "Item 2", "Item 3", "Item 4", "Item 5", "Item 6"]
  }
}`
}

export function qualityCheckPrompt(campaignTitle: string, chapterSummaries: string) {
  return `Review this D&D campaign for a first-time DM for coherence and quality.

Campaign: ${campaignTitle}
Chapters: ${chapterSummaries}

Return JSON:
{
  "overall_quality": "excellent" | "good" | "needs_work",
  "coherence_score": 8,
  "beginner_friendliness": 9,
  "issues": [{ "severity": "minor", "description": "Issue", "suggestion": "Fix" }],
  "strengths": ["strength1", "strength2"],
  "summary": "2-3 sentence assessment"
}`
}
