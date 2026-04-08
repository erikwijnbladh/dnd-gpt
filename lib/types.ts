export interface PlanQuestion {
  id: string
  question: string
  hint: string | null
  type: 'open' | 'choice'
  choices: string[] | null
}

export interface PlanResult {
  already_known: {
    setting: string | null
    tone: string | null
    themes: string | null
  }
  questions: PlanQuestion[]
}

export interface AgentEvent {
  type: 'status' | 'agent_start' | 'agent_update' | 'agent_complete' | 'fanout' | 'complete' | 'error'
  agentId?: string
  agentType?: 'chapter' | 'npc' | 'appendix' | 'guide' | 'orchestrator' | 'qc'
  status?: 'thinking' | 'writing' | 'reviewing' | 'running' | 'complete' | 'error'
  message?: string
  preview?: string
  campaign?: Campaign
}

export interface AgentState {
  id: string
  type: 'chapter' | 'npc' | 'appendix' | 'guide' | 'orchestrator' | 'qc'
  label: string
  status: 'pending' | 'thinking' | 'writing' | 'reviewing' | 'complete' | 'error'
  message: string
  preview?: string
}

// ── Campaign data types ──────────────────────────────────

export interface ReadAloud {
  id: string
  trigger: string
  text: string
}

export interface Encounter {
  id: string
  name: string
  type: 'combat' | 'social' | 'exploration' | 'puzzle'
  difficulty: 'easy' | 'medium' | 'hard' | 'deadly'
  setup: string
  read_aloud?: string
  dm_notes: string
  rewards: string
  failure_state: string
}

export interface Chapter {
  chapter_id: string
  scene_setting: string
  read_aloud_boxes: ReadAloud[]
  dm_notes: string
  encounters: Encounter[]
  what_happens_next: string
}

export interface NPC {
  npc_id: string
  name: string
  race_and_class: string
  age: string
  appearance: string
  personality_traits: string[]
  ideals: string
  bonds: string
  flaws: string
  secret?: string
  speech_pattern: string
  sample_dialogue: { situation: string; line: string }[]
  role_in_story: string
  dm_tips: string[]
  stat_block_summary: {
    alignment: string
    challenge_rating?: number
    hit_points: number
    armor_class: number
    key_abilities: string[]
  }
}

export interface SkeletonChapter {
  id: string
  number: number
  title: string
  synopsis: string
  estimated_sessions: number
  key_moments: string[]
}

export interface SkeletonNPC {
  id: string
  name: string
  role: string
  first_appears: string
  importance: 'major' | 'minor'
}

export interface Skeleton {
  title: string
  tagline: string
  premise: string
  setting: {
    name: string
    description: string
    atmosphere: string
  }
  three_act_structure: {
    act1: string
    act2: string
    act3: string
  }
  chapters: SkeletonChapter[]
  npcs: SkeletonNPC[]
  player_count: number
  total_sessions: number
}

export interface HowToRun {
  before_session_1: {
    title: string
    steps: string[]
    what_to_tell_your_players: string
  }
  session_plan: {
    session_number: number
    chapters_to_cover: string[]
    goal: string
    dm_focus: string
  }[]
  running_a_session: {
    title: string
    intro: string
    steps: string[]
  }
  when_players_go_off_script: {
    title: string
    rules: string[]
  }
  quick_reference_card: {
    title: string
    items: string[]
  }
}

export interface Appendix {
  glossary: { term: string; definition: string }[]
  locations: {
    id: string
    name: string
    type: string
    description: string
    key_features: string[]
    dm_notes: string
    atmosphere: string
  }[]
  magic_items: {
    name: string
    type: string
    rarity: string
    description: string
    properties: string
    where_found: string
  }[]
  monsters: {
    name: string
    description: string
    challenge_rating: number
    hit_points: number
    armor_class: number
    speed: string
    key_attacks: string[]
    special_abilities: string[]
    tactics: string
    loot: string
  }[]
  dm_quick_reference: {
    core_rules_to_know: string[]
    combat_flow: string
    skill_checks: string
    session_tips: string[]
  }
}

export interface QualityCheck {
  overall_quality: 'excellent' | 'good' | 'needs_work'
  coherence_score: number
  beginner_friendliness: number
  issues: { severity: 'critical' | 'minor'; description: string; suggestion: string }[]
  strengths: string[]
  summary: string
}

export interface Campaign {
  id: string
  idea: string
  answers: Record<string, string>
  generatedAt: string
  skeleton: Skeleton
  chapters: Chapter[]
  npcs: NPC[]
  appendix: Appendix
  how_to_run: HowToRun
  quality_check: QualityCheck
}
