'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import type { AgentState, Campaign, AgentEvent } from '@/lib/types'
import AtmosphericLoader from '@/components/AtmosphericLoader'
import clsx from 'clsx'

// ── Config ───────────────────────────────────────────────────────────────────

const TYPE_CFG: Record<string, { label: string; icon: string; color: string; dimColor: string }> = {
  orchestrator: { label: 'Orchestrator', icon: '🎲', color: '#C9A84C', dimColor: '#C9A84C22' },
  chapter:      { label: 'Chapter',      icon: '📖', color: '#60A5FA', dimColor: '#3B7BE022' },
  npc:          { label: 'NPC',          icon: '🧙', color: '#34D399', dimColor: '#2D9E6E22' },
  appendix:     { label: 'Appendix',     icon: '📚', color: '#A78BFA', dimColor: '#8B5CF622' },
  guide:        { label: 'DM Guide',     icon: '🗺️', color: '#FB923C', dimColor: '#E9731622' },
  qc:           { label: 'Review',       icon: '🔍', color: '#C9A84C', dimColor: '#C9A84C22' },
}

const STATUS_ICON: Record<string, string> = {
  pending:   '○',
  thinking:  '◐',
  writing:   '●',
  reviewing: '◑',
  complete:  '✓',
  error:     '✗',
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function GeneratingPage() {
  const router = useRouter()
  const { currentIdea, currentAnswers, saveCampaign } = useStore()

  const [agents, setAgents] = useState<AgentState[]>([])
  const [orchestratorMsg, setOrchestratorMsg] = useState('Designing your campaign world…')
  const [orchestratorDone, setOrchestratorDone] = useState(false)
  const [campaignTitle, setCampaignTitle] = useState<string | null>(null)
  const [campaignTagline, setCampaignTagline] = useState<string | null>(null)
  const [agentsSpawned, setAgentsSpawned] = useState(false)
  const [done, setDone] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const started = useRef(false)
  const startTime = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  // Track existing agent types so update events don't clobber them
  const agentTypes = useRef<Record<string, AgentState['type']>>({})

  useEffect(() => {
    if (!currentIdea) { router.replace('/'); return }
    if (started.current) return
    started.current = true

    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000))
    }, 1000)

    const run = async () => {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idea: currentIdea, answers: currentAnswers }),
        })
        if (!res.ok || !res.body) {
          setError('Generation failed. Check your API key and try again.')
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try { handleEvent(JSON.parse(line.slice(6))) } catch { /* skip */ }
          }
        }
      } catch (e) {
        setError(String(e))
      }
    }

    run()
    return () => clearInterval(timerRef.current)
  }, [])

  const upsertAgent = (patch: Partial<AgentState> & { id: string }) => {
    // Preserve existing type — update events don't carry agentType
    if (patch.type) agentTypes.current[patch.id] = patch.type

    setAgents((prev) => {
      const idx = prev.findIndex((a) => a.id === patch.id)
      if (idx === -1) {
        const newAgent: AgentState = {
          type: agentTypes.current[patch.id] ?? 'chapter',
          label: patch.label ?? patch.id,
          status: 'pending',
          message: '',
          ...patch,
        }
        return [...prev, newAgent]
      }
      const next = [...prev]
      // Never overwrite type from an event that doesn't specify it
      const resolvedType = patch.type ?? next[idx].type
      next[idx] = { ...next[idx], ...patch, type: resolvedType }
      return next
    })
  }

  const handleEvent = (event: AgentEvent) => {
    switch (event.type) {
      case 'status':
        if (event.agentId === 'orchestrator') {
          setOrchestratorMsg(event.message ?? '')
        }
        break

      case 'agent_start':
        if (event.agentId === 'orchestrator') break
        setAgentsSpawned(true)
        upsertAgent({
          id: event.agentId!,
          type: event.agentType ?? 'chapter',
          label: event.message ?? event.agentId!,
          status: 'thinking',
          message: event.message ?? '',
        })
        break

      case 'agent_update':
        if (event.agentId === 'orchestrator') {
          setOrchestratorMsg(event.message ?? '')
          break
        }
        upsertAgent({
          id: event.agentId!,
          status: (event.status as AgentState['status']) ?? 'writing',
          message: event.message ?? '',
        })
        break

      case 'agent_complete':
        if (event.agentId === 'orchestrator') {
          setOrchestratorDone(true)
          setOrchestratorMsg(event.message ?? '')
          // Extract title from message like '"Title" designed'
          const match = event.message?.match(/"([^"]+)"/)
          if (match) setCampaignTitle(match[1])
          if (event.preview) setCampaignTagline(event.preview)
          break
        }
        upsertAgent({
          id: event.agentId!,
          status: 'complete',
          message: event.message ?? '',
          preview: event.preview,
        })
        break

      case 'fanout':
        setAgentsSpawned(true)
        break

      case 'complete':
        clearInterval(timerRef.current)
        if (event.campaign) {
          saveCampaign(event.campaign as Campaign)
          setCampaignId((event.campaign as Campaign).id)
          if (!campaignTitle) setCampaignTitle((event.campaign as Campaign).skeleton?.title)
        }
        setDone(true)
        break

      case 'error':
        setError(event.message ?? 'Unknown error')
        break
    }
  }

  const subAgents = agents.filter((a) => a.id !== 'orchestrator')
  const chapters = subAgents.filter((a) => a.type === 'chapter')
  const npcs = subAgents.filter((a) => a.type === 'npc')
  const support = subAgents.filter((a) => a.type === 'appendix' || a.type === 'guide' || a.type === 'qc')
  const completedCount = subAgents.filter((a) => a.status === 'complete').length
  const totalCount = subAgents.length
  const progressPct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0

  return (
    <main className="min-h-screen flex flex-col bg-bg">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-gold text-sm">⚔</span>
            <span className="font-ui text-sm text-muted">Campaign Forge</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-ui text-faint tabular-nums">
            {agentsSpawned && <span>{completedCount}/{totalCount} sections</span>}
            <span>{elapsed}s</span>
          </div>
        </div>
        <div className="h-px bg-border">
          <motion.div
            className="h-full bg-gradient-to-r from-gold/60 to-gold"
            animate={{ width: agentsSpawned ? `${progressPct}%` : '8%' }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex-1 flex items-center justify-center pt-16">
          <div className="text-center">
            <p className="text-4xl mb-4">⚠️</p>
            <p className="font-display text-xl text-text mb-2">Something went wrong</p>
            <p className="text-muted font-ui text-sm mb-6 max-w-sm">{error}</p>
            <button onClick={() => router.push('/')} className="px-5 py-2.5 rounded-xl bg-gold text-bg font-ui font-medium hover:bg-gold-bright transition-colors">
              Start over
            </button>
          </div>
        </div>
      )}

      {/* Phase 1: Atmospheric loader */}
      <AnimatePresence>
        {!error && !agentsSpawned && (
          <motion.div
            key="loader"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.5 }}
            className="flex-1 flex flex-col pt-16"
          >
            <AtmosphericLoader idea={currentIdea ?? ''} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 2: Agent dashboard */}
      <AnimatePresence>
        {!error && agentsSpawned && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="flex-1 flex flex-col pt-16 px-4 md:px-8 pb-12 max-w-6xl mx-auto w-full"
          >
            {/* Campaign header */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="pt-6 pb-5 border-b border-border mb-6"
            >
              {campaignTitle ? (
                <div>
                  <h1 className="font-display text-2xl md:text-3xl text-gold">{campaignTitle}</h1>
                  {campaignTagline && (
                    <p className="text-muted font-ui text-sm italic mt-1">{campaignTagline}</p>
                  )}
                </div>
              ) : (
                <div className="h-8 w-64 rounded bg-surface animate-pulse" />
              )}
              <div className="flex items-center gap-2 mt-3">
                <span className={clsx(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-ui border',
                  orchestratorDone
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-gold/10 border-gold/30 text-gold'
                )}>
                  <span className={orchestratorDone ? '' : 'animate-pulse'}>
                    {orchestratorDone ? '✓' : '◐'}
                  </span>
                  {orchestratorMsg}
                </span>
              </div>
            </motion.div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Chapters — left, 2/3 width */}
              {chapters.length > 0 && (
                <div className="lg:col-span-2">
                  <SectionHeader icon="📖" label="Chapters" color="#60A5FA" count={chapters.filter(a => a.status === 'complete').length} total={chapters.length} />
                  <div className="space-y-2 mt-3">
                    {chapters.map((agent, i) => (
                      <AgentRow key={agent.id} agent={agent} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Right column: NPCs + support */}
              <div className="space-y-6">
                {npcs.length > 0 && (
                  <div>
                    <SectionHeader icon="🧙" label="NPCs" color="#34D399" count={npcs.filter(a => a.status === 'complete').length} total={npcs.length} />
                    <div className="space-y-2 mt-3">
                      {npcs.map((agent, i) => (
                        <AgentRow key={agent.id} agent={agent} index={i} compact />
                      ))}
                    </div>
                  </div>
                )}
                {support.length > 0 && (
                  <div>
                    <SectionHeader icon="✦" label="Finishing" color="#C9A84C" count={support.filter(a => a.status === 'complete').length} total={support.length} />
                    <div className="space-y-2 mt-3">
                      {support.map((agent, i) => (
                        <AgentRow key={agent.id} agent={agent} index={i} compact />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Done panel */}
            <AnimatePresence>
              {done && campaignId && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-10 rounded-2xl border border-gold/40 p-8 text-center"
                  style={{ background: 'linear-gradient(135deg, #141208 0%, #0E0C06 100%)', boxShadow: '0 0 60px #C9A84C1A' }}
                >
                  <div className="text-4xl mb-3">📜</div>
                  <h2 className="font-display text-2xl text-gold mb-1">{campaignTitle} is ready</h2>
                  <p className="text-muted font-ui text-sm mb-6">
                    {totalCount} sections written in {elapsed}s
                  </p>
                  <button
                    onClick={() => router.push(`/campaign/${campaignId}`)}
                    className="px-8 py-3 rounded-xl bg-gold text-bg font-ui font-semibold hover:bg-gold-bright active:scale-95 transition-all duration-200"
                  >
                    Open Campaign Book →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, label, color, count, total }: {
  icon: string; label: string; color: string; count: number; total: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <span className="font-display text-sm tracking-wide" style={{ color }}>{label}</span>
      <span className="text-xs font-ui text-faint ml-auto">{count}/{total}</span>
      <div className="w-16 h-1 rounded-full bg-border overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          animate={{ width: total > 0 ? `${(count / total) * 100}%` : '0%' }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  )
}

function AgentRow({ agent, index, compact = false }: {
  agent: AgentState; index: number; compact?: boolean
}) {
  const cfg = TYPE_CFG[agent.type] ?? TYPE_CFG.chapter
  const isDone = agent.status === 'complete'
  const isActive = agent.status === 'writing' || agent.status === 'thinking' || agent.status === 'reviewing'

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        'rounded-xl border px-4 py-3 transition-all duration-300',
        isDone ? 'border-border bg-surface/50' : '',
        isActive ? 'bg-surface' : 'bg-surface/30',
      )}
      style={{
        borderColor: isActive ? cfg.color + '44' : isDone ? '' : '#1C2030',
        boxShadow: isActive ? `0 0 16px ${cfg.dimColor}` : 'none',
      }}
    >
      <div className="flex items-start gap-3">
        {/* Status indicator */}
        <span
          className={clsx('font-ui text-sm mt-0.5 flex-shrink-0 w-4 text-center transition-colors', isActive && 'animate-pulse')}
          style={{ color: isDone ? '#34D399' : isActive ? cfg.color : '#3D4155' }}
        >
          {STATUS_ICON[agent.status] ?? '○'}
        </span>

        <div className="min-w-0 flex-1">
          {/* Label */}
          <p className={clsx(
            'font-ui text-sm font-medium leading-snug truncate',
            isDone ? 'text-text' : isActive ? 'text-text' : 'text-muted'
          )}>
            {agent.label || agent.message}
          </p>

          {/* Preview — only when done, only for non-compact */}
          {!compact && isDone && agent.preview && (
            <p className="text-xs font-ui text-faint mt-1 leading-relaxed line-clamp-2 italic">
              {agent.preview}
            </p>
          )}

          {/* Writing indicator */}
          {isActive && (
            <div className="flex gap-1 mt-1.5">
              {[0, 1, 2].map((j) => (
                <motion.span
                  key={j}
                  className="w-1 h-1 rounded-full"
                  style={{ background: cfg.color }}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, delay: j * 0.2, repeat: Infinity }}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
