'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Sparkles, BookOpen, Users, Zap } from 'lucide-react'
import { useStore } from '@/lib/store'
import clsx from 'clsx'

const ALL_IDEAS = [
  'A dying world where flesh and machine have been fused by a corrupting radiant force',
  'Pirates discover an ancient god sleeping beneath the ocean floor',
  'A city where memories are currency and the poor are forced to forget',
  'A dark gothic adventure in a cursed village that no one can leave',
  'An empire built on the bones of a dead god slowly comes back to life',
  'Time travelers stranded in a medieval war must prevent a paradox',
  'A heist to steal a spell from the mind of a sleeping archmage',
  'Exiled nobles must reclaim a kingdom that has forgotten they existed',
  'A carnival that travels between planes, selling impossible things',
  'The last dragons disguise themselves as humans — and are running out of time',
  'Rebels fight an empire that weaponizes grief and nostalgia',
  'A lighthouse keeper discovers the sea is a graveyard of lost timelines',
  'A plague that turns the infected into living statues — but they\'re still conscious',
  'Underground city-states wage cold war over the last source of sunlight',
  'A murder mystery aboard a spelljammer ship with no way to escape',
]

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const FEATURES = [
  { icon: BookOpen, label: 'Full campaign book', desc: 'Chapters, encounters, read-aloud text' },
  { icon: Users, label: 'Complete NPC roster', desc: 'Personalities, dialogue, secrets' },
  { icon: Zap, label: 'Parallel AI agents', desc: 'Multiple writers, one coherent story' },
]

const TYPEWRITER_PROMPTS = shuffled(ALL_IDEAS)

export default function LandingPage() {
  const router = useRouter()
  const { setIdea } = useStore()
  const [idea, setIdeaLocal] = useState('')
  const [focused, setFocused] = useState(false)
  const [loading, setLoading] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Randomized suggestion pills — pick 4 on mount
  const exampleIdeas = useMemo(() => shuffled(ALL_IDEAS).slice(0, 4), [])

  // Typewriter placeholder
  const [placeholder, setPlaceholder] = useState('')
  const promptIndexRef = useRef(0)
  const charIndexRef = useRef(0)
  const deletingRef = useRef(false)
  const pauseRef = useRef(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>

    const tick = () => {
      if (pauseRef.current) {
        timeout = setTimeout(tick, 1800)
        pauseRef.current = false
        return
      }

      const current = TYPEWRITER_PROMPTS[promptIndexRef.current]

      if (!deletingRef.current) {
        charIndexRef.current++
        setPlaceholder(current.slice(0, charIndexRef.current))

        if (charIndexRef.current === current.length) {
          pauseRef.current = true
          deletingRef.current = true
          timeout = setTimeout(tick, 1800)
          return
        }
        timeout = setTimeout(tick, 38)
      } else {
        charIndexRef.current--
        setPlaceholder(current.slice(0, charIndexRef.current))

        if (charIndexRef.current === 0) {
          deletingRef.current = false
          promptIndexRef.current = (promptIndexRef.current + 1) % TYPEWRITER_PROMPTS.length
          timeout = setTimeout(tick, 400)
          return
        }
        timeout = setTimeout(tick, 18)
      }
    }

    timeout = setTimeout(tick, 600)
    return () => clearTimeout(timeout)
  }, [])

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [idea])

  const handleSubmit = () => {
    if (!idea.trim() || loading) return
    setLoading(true)
    setIdea(idea.trim())
    router.push('/plan')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-20">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="flex items-center gap-2 mb-12"
      >
        <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center">
          <span className="text-gold text-sm">⚔</span>
        </div>
        <span className="font-display text-sm tracking-widest text-muted uppercase">Campaign Forge</span>
      </motion.div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="text-center max-w-2xl mx-auto mb-10"
      >
        <h1 className="font-display text-5xl md:text-6xl font-bold mb-4 leading-tight">
          <span className="text-gold-gradient">Your campaign,</span>
          <br />
          <span className="text-text">written by AI.</span>
        </h1>
        <p className="font-ui text-muted text-lg leading-relaxed max-w-lg mx-auto">
          Describe your idea. We'll ask a few questions, then generate a complete D&D campaign book — chapters, NPCs, encounters, and a guide for running it.
        </p>
      </motion.div>

      {/* Idea Input */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-2xl mb-4"
      >
        <div
          className={clsx(
            'relative rounded-2xl border bg-surface transition-all duration-300',
            focused
              ? 'border-gold/50 shadow-[0_0_40px_#C9A84C22]'
              : 'border-border hover:border-border-bright'
          )}
        >
          <textarea
            ref={textareaRef}
            value={idea}
            onChange={(e) => setIdeaLocal(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            placeholder={placeholder || 'Describe your campaign idea…'}
            aria-label="Campaign idea"
            className="w-full bg-transparent text-text font-ui text-base resize-none px-5 pt-5 pb-14 rounded-2xl placeholder:text-faint focus:outline-none leading-relaxed min-h-[72px]"
            rows={1}
          />

          {/* Submit button inside textarea */}
          <div className="absolute bottom-3 right-3 flex items-center gap-2">
            <span className="text-faint text-xs font-ui hidden sm:block">
              {idea.trim() ? '⌘ Enter' : ''}
            </span>
            <button
              onClick={handleSubmit}
              disabled={!idea.trim() || loading}
              aria-label="Create campaign"
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-xl font-ui font-medium text-sm transition-all duration-200',
                idea.trim() && !loading
                  ? 'bg-gold text-bg hover:bg-gold-bright active:scale-95 shadow-[0_0_20px_#C9A84C33]'
                  : 'bg-elevated text-faint cursor-not-allowed'
              )}
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  <span>Starting…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Create Campaign</span>
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>

      {/* Example ideas */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="w-full max-w-2xl mb-16"
      >
        <p className="text-xs text-faint font-ui mb-2 px-1">Try an example:</p>
        <div className="flex flex-wrap gap-2">
          {exampleIdeas.map((ex) => (
            <button
              key={ex}
              onClick={() => {
                setIdeaLocal(ex)
                textareaRef.current?.focus()
              }}
              className="text-xs font-ui text-muted border border-border hover:border-gold/40 hover:text-gold px-3 py-1.5 rounded-full transition-all duration-150 hover:bg-gold/5"
            >
              {ex.length > 48 ? ex.slice(0, 48) + '…' : ex}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Feature pills */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="flex flex-col sm:flex-row items-center gap-4"
      >
        {FEATURES.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-surface/50">
            <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center flex-shrink-0">
              <Icon className="w-4 h-4 text-gold" />
            </div>
            <div>
              <div className="text-sm font-ui font-medium text-text">{label}</div>
              <div className="text-xs font-ui text-muted">{desc}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Bottom hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-12 text-xs text-faint font-ui"
      >
        ~$0.17 per campaign · ~2 minutes to generate · No account needed
      </motion.p>
    </main>
  )
}
