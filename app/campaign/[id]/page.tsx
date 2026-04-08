'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '@/lib/store'
import { createClient } from '@/lib/supabase/client'
import type { Campaign, Chapter, NPC } from '@/lib/types'
import clsx from 'clsx'
import { ChevronRight, ChevronLeft, Menu, X } from 'lucide-react'

type Section = 'how-to-run' | 'intro' | string

export default function CampaignPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { getCampaign } = useStore()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [activeSection, setActiveSection] = useState<Section>('how-to-run')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Try local store first (just generated), then fall back to Supabase
    const local = getCampaign(id)
    if (local) { setCampaign(local); return }

    const supabase = createClient()
    supabase
      .from('campaigns')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { router.replace('/'); return }
        // Reconstruct campaign shape from flat DB row
        setCampaign({
          id: data.id,
          idea: data.idea,
          answers: data.answers,
          generatedAt: data.created_at,
          skeleton: data.skeleton,
          chapters: data.chapters,
          npcs: data.npcs,
          appendix: data.appendix,
          how_to_run: data.how_to_run,
          quality_check: data.quality_check,
        } as Campaign)
      })
  }, [id])

  if (!campaign) return null

  const { skeleton, chapters, npcs, how_to_run, appendix, quality_check } = campaign

  const navTo = (section: Section) => {
    setActiveSection(section)
    setSidebarOpen(false)
    mainRef.current?.scrollTo({ top: 0 })
  }

  // Sidebar items
  const navItems = [
    { id: 'how-to-run', label: 'How to Run This', icon: '🗺️' },
    { id: 'intro', label: 'Introduction', icon: '📜' },
    ...skeleton.chapters.map((ch) => ({
      id: ch.id,
      label: `Ch. ${ch.number}: ${ch.title}`,
      icon: '📖',
    })),
    { id: 'npcs', label: 'NPC Roster', icon: '🧙' },
    { id: 'appendix', label: 'Appendix', icon: '📚' },
  ]

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar overlay on mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed top-0 left-0 h-full w-72 border-r border-border bg-bg flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 lg:relative lg:flex-shrink-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="px-5 py-5 border-b border-border flex-shrink-0">
          <button onClick={() => router.push('/')} className="flex items-center gap-2 mb-4">
            <span className="text-gold text-sm">⚔</span>
            <span className="font-ui text-xs text-muted">Campaign Forge</span>
          </button>
          <h1 className="font-display text-base text-gold leading-tight">{skeleton.title}</h1>
          <p className="text-xs text-muted font-ui mt-1 italic">{skeleton.tagline}</p>

          <div className="flex items-center gap-3 mt-3">
            <span className="text-xs font-ui text-faint">
              {skeleton.chapters.length} chapters · {skeleton.total_sessions} sessions · {skeleton.player_count} players
            </span>
          </div>

          {quality_check && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className={clsx('w-1.5 h-1.5 rounded-full', quality_check.overall_quality === 'excellent' ? 'bg-emerald-400' : 'bg-gold')} />
              <span className="text-xs font-ui text-faint capitalize">{quality_check.overall_quality}</span>
              <span className="text-faint text-xs">· {quality_check.coherence_score}/10 coherence</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => navTo(item.id)}
              className={clsx(
                'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all duration-150 mb-0.5',
                activeSection === item.id
                  ? 'bg-gold/10 text-gold'
                  : 'text-muted hover:text-text hover:bg-elevated'
              )}
            >
              <span className="text-sm flex-shrink-0">{item.icon}</span>
              <span className="font-ui text-sm leading-snug truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Close on mobile */}
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden absolute top-4 right-4 text-muted hover:text-text"
        >
          <X className="w-5 h-5" />
        </button>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-sm flex items-center gap-3 px-4 py-3 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-muted hover:text-text"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-ui text-sm text-muted truncate">
            {navItems.find((n) => n.id === activeSection)?.label}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => {
                const idx = navItems.findIndex((n) => n.id === activeSection)
                if (idx > 0) navTo(navItems[idx - 1].id)
              }}
              disabled={navItems.findIndex((n) => n.id === activeSection) === 0}
              className="p-1.5 rounded-lg text-faint hover:text-muted disabled:opacity-30 hover:bg-elevated transition-colors"
              aria-label="Previous section"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const idx = navItems.findIndex((n) => n.id === activeSection)
                if (idx < navItems.length - 1) navTo(navItems[idx + 1].id)
              }}
              disabled={navItems.findIndex((n) => n.id === activeSection) === navItems.length - 1}
              className="p-1.5 rounded-lg text-faint hover:text-muted disabled:opacity-30 hover:bg-elevated transition-colors"
              aria-label="Next section"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content area — parchment for book content */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto"
          style={{ background: activeSection === 'how-to-run' ? undefined : '#F4ECD8' }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {activeSection === 'how-to-run' && how_to_run && (
                <HowToRunSection htr={how_to_run} onStart={() => navTo('intro')} />
              )}
              {activeSection === 'intro' && (
                <IntroSection skeleton={skeleton} />
              )}
              {skeleton.chapters.map((ch) =>
                activeSection === ch.id ? (
                  <ChapterSection
                    key={ch.id}
                    skeletonChapter={ch}
                    chapter={chapters.find((c) => c.chapter_id === ch.id)}
                  />
                ) : null
              )}
              {activeSection === 'npcs' && <NpcsSection npcs={npcs} />}
              {activeSection === 'appendix' && <AppendixSection appendix={appendix} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}

// ── Section components ───────────────────────────────────────────────────────

function HowToRunSection({ htr, onStart }: { htr: Campaign['how_to_run']; onStart: () => void }) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <span className="text-xs font-ui text-gold uppercase tracking-widest">Before you begin</span>
        <h2 className="font-display text-3xl text-text mt-2 mb-1">How to Run This Campaign</h2>
        <p className="text-muted font-ui text-sm">Read this first. Everything you need to start is here.</p>
      </div>

      {/* Before session 1 */}
      <div className="rounded-2xl border border-border bg-surface p-6 mb-6">
        <h3 className="font-display text-lg text-gold mb-4">{htr.before_session_1?.title ?? 'Before Session 1'}</h3>
        <ol className="space-y-3">
          {(htr.before_session_1?.steps ?? []).map((step, i) => (
            <li key={i} className="flex gap-3">
              <span className="w-6 h-6 rounded-full bg-gold/10 border border-gold/30 text-gold text-xs font-ui font-medium flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span className="font-ui text-sm text-text leading-relaxed">{step}</span>
            </li>
          ))}
        </ol>

        {htr.before_session_1?.what_to_tell_your_players && (
          <div className="mt-5 pt-4 border-t border-border">
            <p className="text-xs font-ui text-muted uppercase tracking-wider mb-2">What to tell your players:</p>
            <blockquote className="border-l-2 border-gold/40 pl-4 text-sm font-ui text-muted italic">
              "{htr.before_session_1.what_to_tell_your_players}"
            </blockquote>
          </div>
        )}
      </div>

      {/* Session plan */}
      {htr.session_plan?.length > 0 && (
        <div className="rounded-2xl border border-border bg-surface p-6 mb-6">
          <h3 className="font-display text-lg text-gold mb-4">Session-by-Session Plan</h3>
          <div className="space-y-3">
            {htr.session_plan.map((s) => (
              <div key={s.session_number} className="flex gap-4 p-3 rounded-lg bg-elevated">
                <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center flex-shrink-0">
                  <span className="font-display text-sm text-gold">{s.session_number}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-ui text-muted mb-0.5">{(s.chapters_to_cover ?? []).join(', ')}</p>
                  <p className="text-sm font-ui text-text leading-snug">{s.goal}</p>
                  <p className="text-xs font-ui text-gold mt-1">Focus: {s.dm_focus}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Running a session */}
      {htr.running_a_session && (
        <div className="rounded-2xl border border-border bg-surface p-6 mb-6">
          <h3 className="font-display text-lg text-gold mb-1">{htr.running_a_session.title}</h3>
          <p className="text-sm font-ui text-muted mb-4">{htr.running_a_session.intro}</p>
          <ol className="space-y-2">
            {(htr.running_a_session.steps ?? []).map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="text-gold font-display text-sm w-5 flex-shrink-0">{i + 1}.</span>
                <span className="font-ui text-sm text-text">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Off script + quick reference */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {htr.when_players_go_off_script && (
          <div className="rounded-2xl border border-border bg-surface p-5">
            <h3 className="font-display text-base text-gold mb-3">{htr.when_players_go_off_script.title}</h3>
            <ul className="space-y-2">
              {(htr.when_players_go_off_script.rules ?? []).map((rule, i) => (
                <li key={i} className="flex gap-2 text-sm font-ui text-text">
                  <span className="text-gold flex-shrink-0">·</span> {rule}
                </li>
              ))}
            </ul>
          </div>
        )}
        {htr.quick_reference_card && (
          <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
            <h3 className="font-display text-base text-gold mb-3">{htr.quick_reference_card.title}</h3>
            <ul className="space-y-1.5">
              {(htr.quick_reference_card.items ?? []).map((item, i) => (
                <li key={i} className="flex gap-2 text-sm font-ui text-text">
                  <span className="text-gold flex-shrink-0">✦</span> {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <button
        onClick={onStart}
        className="w-full py-3 rounded-xl bg-gold text-bg font-ui font-semibold hover:bg-gold-bright active:scale-95 transition-all duration-200"
      >
        Read the Campaign →
      </button>
    </div>
  )
}

function IntroSection({ skeleton }: { skeleton: Campaign['skeleton'] }) {
  return (
    <div className="max-w-2xl mx-auto px-8 py-12 book-content">
      <div className="text-center mb-10">
        <h1 className="book-h2 text-4xl border-none text-center mb-2">{skeleton.title}</h1>
        <p className="font-body text-ink-light italic text-xl">{skeleton.tagline}</p>
        <div className="flex items-center justify-center gap-2 mt-4">
          <div className="h-px bg-ink/20 w-16" />
          <span className="text-ink/30 font-display text-xs">✦</span>
          <div className="h-px bg-ink/20 w-16" />
        </div>
      </div>

      <h2 className="book-h2">What Is This Campaign?</h2>
      <div className="whitespace-pre-wrap">{skeleton.premise}</div>

      <h2 className="book-h2 mt-10">The Setting</h2>
      <h3 className="book-h3">{skeleton.setting.name}</h3>
      <p>{skeleton.setting.description}</p>
      <p className="mt-3 italic text-ink-light">{skeleton.setting.atmosphere}</p>

      <h2 className="book-h2 mt-10">Story Overview</h2>
      {[
        { label: 'Act I — The Beginning', text: skeleton.three_act_structure.act1 },
        { label: 'Act II — The Middle', text: skeleton.three_act_structure.act2 },
        { label: 'Act III — The End', text: skeleton.three_act_structure.act3 },
      ].map(({ label, text }) => (
        <div key={label} className="mb-4">
          <strong className="font-body font-semibold">{label}:</strong> {text}
        </div>
      ))}

      <h2 className="book-h2 mt-10">Chapter Overview</h2>
      {skeleton.chapters.map((ch) => (
        <div key={ch.id} className="mb-4 flex gap-3">
          <span className="font-display text-ink/40 w-8 flex-shrink-0 text-right">{ch.number}.</span>
          <div>
            <strong className="font-body font-semibold">{ch.title}</strong>
            <span className="text-ink-light"> — {ch.synopsis}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function ChapterSection({ skeletonChapter, chapter }: { skeletonChapter: Campaign['skeleton']['chapters'][0]; chapter: Chapter | undefined }) {
  if (!chapter) return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <p className="text-ink-light font-ui text-sm">Chapter content not found.</p>
    </div>
  )

  const diffColor = { easy: 'text-emerald-700', medium: 'text-amber-700', hard: 'text-orange-700', deadly: 'text-red-800' }
  const typeIcon = { combat: '⚔️', social: '💬', exploration: '🗺️', puzzle: '🧩' }

  return (
    <div className="max-w-2xl mx-auto px-8 py-12 book-content">
      <div className="mb-8 pb-4 border-b border-ink/10">
        <p className="font-display text-sm text-ink/40 uppercase tracking-wider mb-1">Chapter {skeletonChapter.number}</p>
        <h1 className="font-display text-3xl text-ink font-bold">{skeletonChapter.title}</h1>
        <p className="italic text-ink-light mt-2">{skeletonChapter.synopsis}</p>
      </div>

      {/* Scene setting */}
      <h2 className="book-h2">Scene Setting</h2>
      <p>{chapter.scene_setting}</p>

      {/* Read aloud boxes */}
      {chapter.read_aloud_boxes?.map((ra) => (
        <div key={ra.id} className="read-aloud my-6 rounded-r-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-gold text-sm">📖</span>
            <span className="text-xs font-ui text-gold/80 uppercase tracking-wider">Read Aloud</span>
            <span className="text-xs font-ui text-muted ml-1">— {ra.trigger}</span>
          </div>
          <p className="font-body italic text-parchment leading-relaxed text-base">{ra.text}</p>
        </div>
      ))}

      {/* DM Notes */}
      <h2 className="book-h2 mt-8">DM Notes</h2>
      <p className="whitespace-pre-wrap">{chapter.dm_notes}</p>

      {/* Encounters */}
      {chapter.encounters?.length > 0 && (
        <>
          <h2 className="book-h2 mt-8">Encounters</h2>
          {chapter.encounters.map((enc) => (
            <div key={enc.id} className="mb-8 rounded-xl border border-ink/10 overflow-hidden">
              <div className="px-5 py-3 border-b border-ink/10 flex items-center gap-2" style={{ background: '#E8D9BC' }}>
                <span>{typeIcon[enc.type] ?? '❓'}</span>
                <h3 className="book-h3 mb-0 text-base">{enc.name}</h3>
                <span className={clsx('ml-auto text-xs font-ui font-medium uppercase', diffColor[enc.difficulty])}>{enc.difficulty}</span>
              </div>
              <div className="px-5 py-4 book-content">
                <p className="mb-3"><strong>Setup:</strong> {enc.setup}</p>
                {enc.read_aloud && (
                  <div className="read-aloud my-4 rounded-r-lg p-4">
                    <p className="text-xs font-ui text-gold/80 mb-2 uppercase tracking-wider">📖 Read Aloud</p>
                    <p className="font-body italic text-parchment text-sm">{enc.read_aloud}</p>
                  </div>
                )}
                <p className="mb-2"><strong>DM Notes:</strong> {enc.dm_notes}</p>
                <p className="mb-2"><strong>Rewards:</strong> {enc.rewards}</p>
                <p className="text-sm italic text-ink-light"><strong>If skipped:</strong> {enc.failure_state}</p>
              </div>
            </div>
          ))}
        </>
      )}

      {/* What happens next */}
      {chapter.what_happens_next && (
        <div className="mt-8 pt-4 border-t border-ink/10">
          <h2 className="book-h2">What Happens Next</h2>
          <p>{chapter.what_happens_next}</p>
        </div>
      )}
    </div>
  )
}

function NpcsSection({ npcs }: { npcs: NPC[] }) {
  const [expanded, setExpanded] = useState<string | null>(npcs[0]?.npc_id ?? null)

  return (
    <div className="max-w-2xl mx-auto px-8 py-12">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-ink font-bold border-b border-ink/10 pb-3">NPC Roster</h1>
      </div>
      <div className="space-y-3">
        {npcs.map((npc) => (
          <div key={npc.npc_id} className="rounded-xl border border-ink/15 overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === npc.npc_id ? null : npc.npc_id)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-parchment-dark/50 transition-colors"
              style={{ background: '#EDD9B0' }}
            >
              <div className="w-10 h-10 rounded-full bg-ink/10 border border-ink/20 flex items-center justify-center flex-shrink-0 font-display text-lg">
                {npc.name[0]}
              </div>
              <div className="min-w-0">
                <p className="font-display font-bold text-ink">{npc.name}</p>
                <p className="text-xs text-ink-light font-ui">{npc.race_and_class} · {npc.stat_block_summary?.alignment}</p>
              </div>
              <ChevronRight className={clsx('w-4 h-4 text-ink/30 ml-auto flex-shrink-0 transition-transform', expanded === npc.npc_id && 'rotate-90')} />
            </button>

            <AnimatePresence>
              {expanded === npc.npc_id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                  style={{ background: '#F4ECD8' }}
                >
                  <div className="px-5 py-5 book-content text-sm space-y-3">
                    <p><strong>Appearance:</strong> {npc.appearance}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(npc.personality_traits ?? []).map((t) => (
                        <span key={t} className="px-2 py-0.5 rounded-full bg-ink/8 border border-ink/10 text-xs font-ui text-ink-light">{t}</span>
                      ))}
                    </div>
                    <p><strong>Ideal:</strong> {npc.ideals}</p>
                    <p><strong>Bond:</strong> {npc.bonds}</p>
                    <p><strong>Flaw:</strong> {npc.flaws}</p>
                    {npc.secret && <p className="text-crimson"><strong>🔒 Secret:</strong> {npc.secret}</p>}
                    <p><strong>How they speak:</strong> {npc.speech_pattern}</p>
                    <div>
                      <strong>Sample Dialogue:</strong>
                      {(npc.sample_dialogue ?? []).map((d, i) => (
                        <div key={i} className="mt-2 pl-3 border-l-2 border-ink/20">
                          <p className="text-xs text-ink-light italic mb-0.5">{d.situation}:</p>
                          <p>"{d.line}"</p>
                        </div>
                      ))}
                    </div>
                    {npc.dm_tips?.length > 0 && (
                      <div>
                        <strong>DM Tips:</strong>
                        <ul className="mt-1 space-y-1">
                          {npc.dm_tips.map((tip, i) => <li key={i} className="flex gap-2"><span className="text-gold flex-shrink-0">·</span>{tip}</li>)}
                        </ul>
                      </div>
                    )}
                    {npc.stat_block_summary && (
                      <div className="flex gap-4 pt-2 border-t border-ink/10 text-xs font-ui text-ink-light">
                        <span>HP {npc.stat_block_summary.hit_points}</span>
                        <span>AC {npc.stat_block_summary.armor_class}</span>
                        {npc.stat_block_summary.challenge_rating && <span>CR {npc.stat_block_summary.challenge_rating}</span>}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}

function AppendixSection({ appendix }: { appendix: Campaign['appendix'] }) {
  return (
    <div className="max-w-2xl mx-auto px-8 py-12 book-content">
      <h1 className="font-display text-3xl text-ink font-bold border-b border-ink/10 pb-3 mb-8">Appendix</h1>

      {appendix.glossary?.length > 0 && (
        <>
          <h2 className="book-h2">Glossary</h2>
          <dl className="space-y-2">
            {appendix.glossary.map((entry, i) => (
              <div key={i}>
                <dt className="font-semibold">{entry.term}</dt>
                <dd className="text-ink-light ml-4">{entry.definition}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      {appendix.locations?.length > 0 && (
        <>
          <h2 className="book-h2 mt-10">Key Locations</h2>
          {appendix.locations.map((loc, i) => (
            <div key={i} className="mb-6">
              <h3 className="book-h3">{loc.name} <span className="text-xs font-ui font-normal text-ink-light uppercase">{loc.type}</span></h3>
              <p>{loc.description}</p>
              <p className="italic text-ink-light mt-2">{loc.atmosphere}</p>
              {loc.key_features?.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {loc.key_features.map((f, j) => <li key={j} className="flex gap-2"><span>·</span>{f}</li>)}
                </ul>
              )}
              {loc.dm_notes && <p className="mt-2 text-sm"><strong>DM Notes:</strong> {loc.dm_notes}</p>}
            </div>
          ))}
        </>
      )}

      {appendix.magic_items?.length > 0 && (
        <>
          <h2 className="book-h2 mt-10">Magic Items</h2>
          {appendix.magic_items.map((item, i) => (
            <div key={i} className="mb-4">
              <h3 className="book-h3">{item.name} <span className="text-xs font-ui font-normal text-ink-light capitalize">{item.rarity}</span></h3>
              <p>{item.description}</p>
              <p className="mt-1"><strong>Properties:</strong> {item.properties}</p>
              <p className="text-sm text-ink-light"><strong>Found:</strong> {item.where_found}</p>
            </div>
          ))}
        </>
      )}

      {appendix.monsters?.length > 0 && (
        <>
          <h2 className="book-h2 mt-10">Monsters &amp; Enemies</h2>
          {appendix.monsters.map((m, i) => (
            <div key={i} className="mb-6 rounded-lg border border-ink/10 p-4" style={{ background: '#EDD9B0' }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="book-h3 mb-0">{m.name}</h3>
                <span className="text-xs font-ui font-medium text-ink-light">CR {m.challenge_rating}</span>
              </div>
              <p className="mb-2">{m.description}</p>
              <div className="flex gap-4 text-xs font-ui text-ink-light mb-2">
                <span>HP {m.hit_points}</span>
                <span>AC {m.armor_class}</span>
                <span>Speed {m.speed}</span>
              </div>
              <p className="text-sm"><strong>Tactics:</strong> {m.tactics}</p>
              <p className="text-sm text-ink-light"><strong>Loot:</strong> {m.loot}</p>
            </div>
          ))}
        </>
      )}

      {appendix.dm_quick_reference && (
        <>
          <h2 className="book-h2 mt-10">DM Quick Reference</h2>
          <div className="rounded-xl border border-ink/10 p-5" style={{ background: '#EDD9B0' }}>
            <h3 className="book-h3">Core Rules</h3>
            <ul className="space-y-1 mb-4">
              {(appendix.dm_quick_reference.core_rules_to_know ?? []).map((r, i) => (
                <li key={i} className="flex gap-2"><span className="text-gold">✦</span>{r}</li>
              ))}
            </ul>
            <p><strong>Combat:</strong> {appendix.dm_quick_reference.combat_flow}</p>
            <p className="mt-2"><strong>Skill Checks:</strong> {appendix.dm_quick_reference.skill_checks}</p>
            <h3 className="book-h3 mt-4">Session Tips</h3>
            <ul className="space-y-1">
              {(appendix.dm_quick_reference.session_tips ?? []).map((t, i) => (
                <li key={i} className="flex gap-2"><span>·</span>{t}</li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
