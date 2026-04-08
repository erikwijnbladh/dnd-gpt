'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import type { AgentState, Campaign, AgentEvent } from '@/lib/types'
import clsx from 'clsx'

const AGENT_TYPE_CONFIG = {
  orchestrator: { color: 'text-gold', border: 'border-gold/40', bg: 'bg-gold/5', glow: 'shadow-[0_0_24px_#C9A84C22]', label: '🎲 Orchestrator' },
  chapter:      { color: 'text-blue-400', border: 'border-blue-500/40', bg: 'bg-blue-500/5', glow: 'shadow-[0_0_24px_#3B7BE022]', label: '📖 Chapter' },
  npc:          { color: 'text-emerald-400', border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', glow: 'shadow-[0_0_24px_#2D9E6E22]', label: '🧙 NPC' },
  appendix:     { color: 'text-purple-400', border: 'border-purple-500/40', bg: 'bg-purple-500/5', glow: 'shadow-[0_0_24px_#8B5CF622]', label: '📚 Appendix' },
  guide:        { color: 'text-orange-400', border: 'border-orange-500/40', bg: 'bg-orange-500/5', glow: 'shadow-[0_0_24px_#E9731622]', label: '🗺️ DM Guide' },
  qc:           { color: 'text-gold', border: 'border-gold/30', bg: 'bg-gold/5', glow: '', label: '🔍 Review' },
}

const STATUS_DOT = {
  pending:   'bg-faint',
  thinking:  'bg-gold animate-pulse',
  writing:   'bg-gold',
  reviewing: 'bg-gold animate-pulse',
  complete:  'bg-emerald-400',
  error:     'bg-crimson-bright',
}

export default function GeneratingPage() {
  const router = useRouter()
  const { currentIdea, currentAnswers, saveCampaign } = useStore()

  const [agents, setAgents] = useState<AgentState[]>([
    { id: 'orchestrator', type: 'orchestrator', label: 'Orchestrator', status: 'pending', message: 'Waiting…' },
  ])
  const [done, setDone] = useState(false)
  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const started = useRef(false)
  const startTime = useRef(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

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
            try {
              const event: AgentEvent = JSON.parse(line.slice(6))
              handleEvent(event)
            } catch { /* malformed */ }
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
    setAgents((prev) => {
      const idx = prev.findIndex((a) => a.id === patch.id)
      if (idx === -1) {
        return [...prev, { type: 'chapter', label: patch.id, status: 'pending', message: '', ...patch } as AgentState]
      }
      const next = [...prev]
      next[idx] = { ...next[idx], ...patch }
      return next
    })
  }

  const handleEvent = (event: AgentEvent) => {
    switch (event.type) {
      case 'status':
      case 'agent_update':
        upsertAgent({
          id: event.agentId!,
          type: event.agentType ?? 'chapter',
          label: event.message ?? '',
          status: (event.status as AgentState['status']) ?? 'thinking',
          message: event.message ?? '',
          preview: event.preview,
        })
        break

      case 'agent_start':
        upsertAgent({
          id: event.agentId!,
          type: event.agentType ?? 'chapter',
          label: event.message ?? event.agentId!,
          status: 'thinking',
          message: event.message ?? '',
        })
        break

      case 'agent_complete':
        upsertAgent({
          id: event.agentId!,
          status: 'complete',
          message: event.message ?? '',
          preview: event.preview,
        })
        break

      case 'complete':
        clearInterval(timerRef.current)
        if (event.campaign) {
          saveCampaign(event.campaign as Campaign)
          setCampaignId((event.campaign as Campaign).id)
        }
        setDone(true)
        break

      case 'error':
        setError(event.message ?? 'Unknown error')
        break
    }
  }

  const orchestrator = agents.find((a) => a.id === 'orchestrator')
  const subAgents = agents.filter((a) => a.id !== 'orchestrator')
  const completedCount = agents.filter((a) => a.status === 'complete').length
  const totalCount = agents.length

  return (
    <main className="min-h-screen flex flex-col">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-bg/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <span className="text-gold text-sm">⚔</span>
            <span className="font-ui text-sm text-muted">Campaign Forge</span>
          </div>
          <div className="flex items-center gap-3">
            {!done && !error && (
              <span className="text-faint text-xs font-ui tabular-nums">{elapsed}s</span>
            )}
            <span className="text-muted text-xs font-ui">
              {completedCount}/{totalCount} complete
            </span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 bg-border">
          <motion.div
            className="h-full bg-gradient-to-r from-gold to-gold-bright"
            animate={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center px-4 pt-24 pb-12 max-w-5xl mx-auto w-full">

        {/* Error state */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center mt-12"
          >
            <div className="text-crimson-bright text-4xl mb-4">⚠</div>
            <p className="font-display text-xl text-text mb-2">Something went wrong</p>
            <p className="text-muted font-ui text-sm mb-6 max-w-md">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 rounded-xl bg-gold text-bg font-ui font-medium hover:bg-gold-bright transition-colors"
            >
              Start over
            </button>
          </motion.div>
        )}

        {/* Orchestrator node */}
        {!error && orchestrator && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-sm mb-8"
          >
            <div
              className={clsx(
                'relative rounded-2xl border p-6 text-center transition-all duration-500',
                orchestrator.status === 'complete' ? 'border-gold/40 shadow-[0_0_40px_#C9A84C22]' : 'border-gold/30 shadow-[0_0_24px_#C9A84C11]',
              )}
              style={{ background: 'linear-gradient(135deg, #141208 0%, #0E0C06 100%)' }}
            >
              {/* Spinning ring */}
              {orchestrator.status !== 'complete' && (
                <div className="absolute inset-0 rounded-2xl border border-gold/20 animate-spin-slow" />
              )}

              <div className="text-3xl mb-2">🎲</div>
              <h2 className="font-display text-lg text-gold mb-1">Orchestrator</h2>
              <p className="text-xs font-ui text-muted uppercase tracking-wider mb-3">gpt-5.4</p>

              <div className="flex items-center justify-center gap-2">
                <span className={clsx('w-2 h-2 rounded-full flex-shrink-0', STATUS_DOT[orchestrator.status])} />
                <span className="text-sm font-ui text-text">{orchestrator.message}</span>
              </div>

              {orchestrator.preview && (
                <p className="mt-3 text-xs font-ui text-muted italic border-t border-border pt-3">
                  "{orchestrator.preview}"
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* Sub-agent grid */}
        {!error && subAgents.length > 0 && (
          <div className="w-full">
            <p className="text-xs text-faint font-ui uppercase tracking-wider text-center mb-4">
              Parallel agents
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              <AnimatePresence>
                {subAgents.map((agent, i) => {
                  const cfg = AGENT_TYPE_CONFIG[agent.type] ?? AGENT_TYPE_CONFIG.chapter
                  return (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, scale: 0.85, y: 12 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className={clsx(
                        'rounded-xl border p-4 transition-all duration-300',
                        cfg.border, cfg.bg,
                        agent.status === 'writing' || agent.status === 'thinking' ? cfg.glow : '',
                      )}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={clsx('w-1.5 h-1.5 rounded-full flex-shrink-0', STATUS_DOT[agent.status])} />
                        <span className={clsx('text-xs font-ui font-medium truncate', cfg.color)}>
                          {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs font-ui text-text leading-snug mb-1 line-clamp-2">
                        {agent.message || agent.label}
                      </p>
                      {agent.preview && agent.status === 'complete' && (
                        <p className="text-xs font-ui text-muted italic line-clamp-2 mt-1 pt-1 border-t border-border/50">
                          {agent.preview}
                        </p>
                      )}
                      {(agent.status === 'thinking' || agent.status === 'writing') && (
                        <div className="flex gap-1 mt-2">
                          {[0, 1, 2].map((j) => (
                            <span
                              key={j}
                              className={clsx('w-1 h-1 rounded-full', cfg.color.replace('text-', 'bg-').replace('/40', ''))}
                              style={{ animation: `blink 1.2s ease-in-out ${j * 0.2}s infinite` }}
                            />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Done panel */}
        <AnimatePresence>
          {done && campaignId && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md mt-10 rounded-2xl border border-gold/40 p-8 text-center"
              style={{ background: 'linear-gradient(135deg, #141208 0%, #0E0C06 100%)', boxShadow: '0 0 60px #C9A84C22' }}
            >
              <div className="text-4xl mb-3">📜</div>
              <h2 className="font-display text-2xl text-gold mb-1">Campaign Ready</h2>
              <p className="text-muted font-ui text-sm mb-2">Generated in {elapsed}s</p>
              <p className="text-text font-ui text-sm mb-6">
                {agents.filter((a) => a.status === 'complete').length} sections written by {agents.length} AI agents.
              </p>
              <button
                onClick={() => router.push(`/campaign/${campaignId}`)}
                className="w-full py-3 rounded-xl bg-gold text-bg font-ui font-semibold hover:bg-gold-bright active:scale-95 transition-all duration-200 text-sm"
              >
                Open Your Campaign Book →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}
