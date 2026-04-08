import { NextRequest } from 'next/server'
import OpenAI from 'openai'
import { v4 as uuidv4 } from 'uuid'
import {
  SYSTEM_ORCHESTRATOR,
  skeletonPrompt,
  chapterPrompt,
  npcPrompt,
  appendixPrompt,
  howToRunPrompt,
  qualityCheckPrompt,
} from '@/lib/prompts'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const ORCHESTRATOR_MODEL = process.env.ORCHESTRATOR_MODEL ?? 'gpt-5.4'
const AGENT_MODEL = process.env.AGENT_MODEL ?? 'gpt-5.4-mini'
const NANO_MODEL = process.env.NANO_MODEL ?? 'gpt-5.4-nano'

function parseJson(text: string) {
  const t = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  return JSON.parse(t)
}

function normalizeList(val: unknown, keys: string[]): object[] {
  if (!val) return []
  const arr = Array.isArray(val) ? val : [val]
  return arr.map((item) => {
    if (typeof item === 'object' && item !== null) return item
    if (typeof item === 'string' && keys.length >= 2) {
      const [a, ...rest] = item.split(':')
      return { [keys[0]]: a?.trim() ?? item, [keys[1]]: rest.join(':').trim() }
    }
    return { [keys[0]]: String(item) }
  })
}

function normalizeAppendix(a: Record<string, unknown>) {
  a.glossary = normalizeList(a.glossary, ['term', 'definition'])
  a.locations = normalizeList(a.locations, ['name', 'description'])
  a.magic_items = normalizeList(a.magic_items, ['name', 'description'])
  a.monsters = normalizeList(a.monsters, ['name', 'description'])
  return a
}

function normalizeNpc(npc: Record<string, unknown>) {
  if (typeof npc.dm_tips === 'string') {
    npc.dm_tips = (npc.dm_tips as string).split('\n').filter(Boolean)
  } else if (!Array.isArray(npc.dm_tips)) {
    npc.dm_tips = []
  }
  if (typeof npc.personality_traits === 'string') {
    npc.personality_traits = (npc.personality_traits as string).split(',').map((s: string) => s.trim())
  }
  return npc
}

function inferSessionCount(answers: Record<string, string>): { players: number; sessions: number } {
  let players = 4, sessions = 6
  for (const a of Object.values(answers)) {
    const l = a.toLowerCase()
    if (l.includes('2') && l.includes('player')) players = 2
    else if (l.includes('3') && l.includes('player')) players = 3
    else if (l.includes('5') && l.includes('player')) players = 5
    if (l.includes('one-shot') || l.includes('one shot') || l.includes('single')) sessions = 1
    else if (l.includes('3 session') || l.includes('three session')) sessions = 3
    else if (l.includes('10') || l.includes('twelve') || l.includes('long')) sessions = 10
  }
  return { players, sessions }
}

export async function POST(req: NextRequest) {
  const { idea, answers } = await req.json()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch { /* stream closed */ }
      }

      try {
        // ── 1. Skeleton ──────────────────────────────────────────────
        send({ type: 'status', agentId: 'orchestrator', agentType: 'orchestrator', status: 'thinking', message: 'Designing your campaign world…' })

        const { players, sessions } = inferSessionCount(answers ?? {})
        const skeletonRes = await client.chat.completions.create({
          model: ORCHESTRATOR_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_ORCHESTRATOR },
            { role: 'user', content: skeletonPrompt(idea, answers ?? {}, players, sessions) },
          ],
          temperature: 0.8,
          response_format: { type: 'json_object' },
        })
        const skeleton = parseJson(skeletonRes.choices[0].message.content ?? '{}')

        send({
          type: 'agent_complete',
          agentId: 'orchestrator',
          status: 'complete',
          message: `"${skeleton.title}" designed`,
          preview: skeleton.tagline,
        })

        // Announce fanout
        const chapterCount = skeleton.chapters?.length ?? 0
        const npcCount = skeleton.npcs?.length ?? 0
        send({
          type: 'fanout',
          agentId: 'fanout',
          status: 'running',
          message: `Spawning ${chapterCount} chapter agents + ${npcCount} NPC agents…`,
        })

        // Pre-announce all agents so UI can render them immediately
        for (const ch of skeleton.chapters ?? []) {
          send({ type: 'agent_start', agentId: `chapter_${ch.id}`, agentType: 'chapter', message: ch.title, status: 'thinking' })
        }
        for (const npc of skeleton.npcs ?? []) {
          send({ type: 'agent_start', agentId: `npc_${npc.id}`, agentType: 'npc', message: npc.name, status: 'thinking' })
        }
        send({ type: 'agent_start', agentId: 'appendix', agentType: 'appendix', message: 'Appendix', status: 'thinking' })
        send({ type: 'agent_start', agentId: 'how_to_run', agentType: 'guide', message: 'DM Guide', status: 'thinking' })

        // ── 2. Parallel sub-agents ───────────────────────────────────
        const chapterTasks = (skeleton.chapters ?? []).map(async (ch: Record<string, unknown>) => {
          send({ type: 'agent_update', agentId: `chapter_${ch.id}`, status: 'writing', message: `Writing ${ch.title}…` })
          const res = await client.chat.completions.create({
            model: AGENT_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_ORCHESTRATOR },
              { role: 'user', content: chapterPrompt(skeleton.title, skeleton.premise, skeleton.three_act_structure, ch as any) },
            ],
            temperature: 0.85,
            response_format: { type: 'json_object' },
          })
          const result = parseJson(res.choices[0].message.content ?? '{}')
          send({ type: 'agent_complete', agentId: `chapter_${ch.id}`, status: 'complete', message: `✓ ${ch.title}`, preview: result.scene_setting?.slice(0, 120) + '…' })
          return result
        })

        const npcTasks = (skeleton.npcs ?? []).map(async (npc: Record<string, unknown>) => {
          send({ type: 'agent_update', agentId: `npc_${npc.id}`, status: 'writing', message: `Creating ${npc.name}…` })
          const res = await client.chat.completions.create({
            model: AGENT_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_ORCHESTRATOR },
              { role: 'user', content: npcPrompt(skeleton.title, skeleton.premise, skeleton.setting, npc as any) },
            ],
            temperature: 0.85,
            response_format: { type: 'json_object' },
          })
          const result = normalizeNpc(parseJson(res.choices[0].message.content ?? '{}')) as Record<string, unknown>
          const preview = typeof result.appearance === 'string' ? result.appearance.slice(0, 100) + '…' : undefined
          send({ type: 'agent_complete', agentId: `npc_${npc.id}`, status: 'complete', message: `✓ ${npc.name}`, preview })
          return result
        })

        const appendixTask = async () => {
          send({ type: 'agent_update', agentId: 'appendix', status: 'writing', message: 'Compiling appendix…' })
          const chStr = (skeleton.chapters ?? []).map((c: any) => `Ch${c.number}: ${c.title}`).join('; ')
          const nStr = (skeleton.npcs ?? []).map((n: any) => `${n.name} (${n.role})`).join('; ')
          const res = await client.chat.completions.create({
            model: NANO_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_ORCHESTRATOR },
              { role: 'user', content: appendixPrompt(skeleton.title, skeleton.premise, chStr, nStr) },
            ],
            temperature: 0.7,
            response_format: { type: 'json_object' },
          })
          const result = normalizeAppendix(parseJson(res.choices[0].message.content ?? '{}'))
          send({ type: 'agent_complete', agentId: 'appendix', status: 'complete', message: '✓ Appendix compiled' })
          return result
        }

        const howToRunTask = async () => {
          send({ type: 'agent_update', agentId: 'how_to_run', status: 'writing', message: 'Writing DM guide…' })
          const chList = (skeleton.chapters ?? []).map((c: any) => `Chapter ${c.number}: ${c.title}`).join('; ')
          const nList = (skeleton.npcs ?? []).map((n: any) => n.name).join(', ')
          const res = await client.chat.completions.create({
            model: NANO_MODEL,
            messages: [
              { role: 'system', content: SYSTEM_ORCHESTRATOR },
              { role: 'user', content: howToRunPrompt(skeleton.title, skeleton.premise, skeleton.chapters?.length ?? 0, skeleton.total_sessions ?? 6, skeleton.player_count ?? 4, chList, nList) },
            ],
            temperature: 0.5,
            response_format: { type: 'json_object' },
          })
          const result = parseJson(res.choices[0].message.content ?? '{}')
          send({ type: 'agent_complete', agentId: 'how_to_run', status: 'complete', message: '✓ DM guide ready' })
          return result
        }

        const [chapters, npcs, appendix, how_to_run] = await Promise.all([
          Promise.all(chapterTasks),
          Promise.all(npcTasks),
          appendixTask(),
          howToRunTask(),
        ] as const)

        // ── 3. Quality check ─────────────────────────────────────────
        send({ type: 'agent_start', agentId: 'qc', agentType: 'qc', status: 'reviewing', message: 'Quality check…' })
        send({ type: 'agent_update', agentId: 'orchestrator', status: 'reviewing', message: 'Reviewing for coherence…' })

        const chSummaries = (skeleton.chapters ?? []).map((c: any) => `Ch${c.number}: ${c.title}`).join('; ')
        const qcRes = await client.chat.completions.create({
          model: ORCHESTRATOR_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_ORCHESTRATOR },
            { role: 'user', content: qualityCheckPrompt(skeleton.title, chSummaries) },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        })
        const quality_check = parseJson(qcRes.choices[0].message.content ?? '{}')
        send({ type: 'agent_complete', agentId: 'qc', status: 'complete', message: `Quality: ${quality_check.overall_quality}` })

        // ── 4. Done ──────────────────────────────────────────────────
        const campaign = {
          id: uuidv4(),
          idea,
          answers: answers ?? {},
          generatedAt: new Date().toISOString(),
          skeleton,
          chapters,
          npcs,
          appendix,
          how_to_run,
          quality_check,
        }

        send({ type: 'complete', campaign })
      } catch (err) {
        console.error('Generation error:', err)
        send({ type: 'error', message: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
