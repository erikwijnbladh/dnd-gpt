'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Check, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import type { PlanQuestion, PlanResult } from '@/lib/types'
import clsx from 'clsx'

export default function PlanPage() {
  const router = useRouter()
  const { currentIdea, setAnswers } = useStore()

  const [planResult, setPlanResult] = useState<PlanResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswersLocal] = useState<Record<string, string>>({})
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Redirect if no idea
  useEffect(() => {
    if (!currentIdea) router.replace('/')
  }, [currentIdea, router])

  // Fetch questions
  useEffect(() => {
    if (!currentIdea) return
    setLoading(true)
    fetch('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: currentIdea }),
    })
      .then((r) => r.json())
      .then((data: PlanResult) => {
        setPlanResult(data)
        setLoading(false)
      })
      .catch(() => {
        setError('Failed to load questions. Check your API key.')
        setLoading(false)
      })
  }, [currentIdea])

  // Focus input on question change
  useEffect(() => {
    if (!loading && planResult) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [currentIdx, loading, planResult])

  const questions = planResult?.questions ?? []
  const alreadyKnown = planResult?.already_known ?? {}
  const currentQ = questions[currentIdx]
  const isLast = currentIdx === questions.length - 1
  const progress = questions.length > 0 ? (currentIdx / questions.length) * 100 : 0

  const submitAnswer = () => {
    if (!currentAnswer.trim() || submitting) return
    const newAnswers = { ...answers, [currentQ.question]: currentAnswer.trim() }
    setAnswersLocal(newAnswers)
    setCurrentAnswer('')

    if (isLast) {
      setSubmitting(true)
      setAnswers(newAnswers)
      router.push('/generating')
    } else {
      setCurrentIdx((i) => i + 1)
    }
  }

  const selectChoice = (choice: string) => {
    const newAnswers = { ...answers, [currentQ.question]: choice }
    setAnswersLocal(newAnswers)
    setCurrentAnswer('')
    if (isLast) {
      setSubmitting(true)
      setAnswers(newAnswers)
      router.push('/generating')
    } else {
      setCurrentIdx((i) => i + 1)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && currentQ?.type !== 'choice') {
      e.preventDefault()
      submitAnswer()
    }
  }

  // Skip all — proceed immediately
  const skipAll = () => {
    setAnswers({})
    router.push('/generating')
  }

  if (!currentIdea) return null

  return (
    <main className="min-h-screen flex flex-col">
      {/* Progress bar */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-border z-50">
        <motion.div
          className="h-full bg-gold"
          initial={{ width: '0%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border">
        <button
          onClick={() => router.push('/')}
          className="flex items-center gap-2 text-muted hover:text-text transition-colors font-ui text-sm"
        >
          <span className="text-gold">⚔</span>
          <span>Campaign Forge</span>
        </button>
        <div className="flex items-center gap-4">
          {questions.length > 0 && (
            <span className="text-faint text-sm font-ui">
              {currentIdx + 1} of {questions.length}
            </span>
          )}
          <button
            onClick={skipAll}
            className="text-faint hover:text-muted text-sm font-ui transition-colors"
          >
            Skip all
          </button>
        </div>
      </nav>

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 max-w-2xl mx-auto w-full">

        {/* Loading */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted font-ui text-sm">Reading your campaign idea…</p>
          </motion.div>
        )}

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center"
          >
            <p className="text-crimson-bright font-ui mb-4">{error}</p>
            <button
              onClick={() => router.push('/')}
              className="text-gold hover:text-gold-bright font-ui text-sm underline"
            >
              Go back
            </button>
          </motion.div>
        )}

        {/* Already understood */}
        {!loading && !error && currentIdx === 0 && (
          <AnimatePresence>
            {Object.values(alreadyKnown).some(Boolean) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full mb-8 rounded-xl border border-border bg-surface/50 px-5 py-4"
              >
                <p className="text-xs text-faint font-ui uppercase tracking-wider mb-3">Already clear from your idea</p>
                <div className="space-y-1.5">
                  {Object.entries(alreadyKnown).map(([k, v]) =>
                    v ? (
                      <div key={k} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-gold mt-0.5 flex-shrink-0" />
                        <span className="text-sm font-ui text-muted">
                          <span className="text-text capitalize">{k}:</span> {String(v)}
                        </span>
                      </div>
                    ) : null
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Questions */}
        {!loading && !error && currentQ && (
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIdx}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full"
            >
              {/* Question text */}
              <h2 className="font-display text-2xl md:text-3xl text-text mb-2 leading-snug">
                {currentQ.question}
              </h2>
              {currentQ.hint && (
                <p className="text-muted font-ui text-sm mb-6">💡 {currentQ.hint}</p>
              )}

              {/* Choice type */}
              {currentQ.type === 'choice' && currentQ.choices ? (
                <div className="grid gap-2 mt-6">
                  {currentQ.choices.map((choice, i) => (
                    <motion.button
                      key={choice}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => selectChoice(choice)}
                      className="flex items-center justify-between w-full text-left px-5 py-4 rounded-xl border border-border hover:border-gold/50 hover:bg-gold/5 transition-all duration-150 group"
                    >
                      <span className="font-ui text-text group-hover:text-gold-bright transition-colors">{choice}</span>
                      <ChevronRight className="w-4 h-4 text-faint group-hover:text-gold transition-colors" />
                    </motion.button>
                  ))}
                  <button
                    onClick={() => {
                      setCurrentAnswer('')
                      const el = inputRef.current
                      if (el) {
                        el.style.display = 'block'
                        el.focus()
                      }
                    }}
                    className="text-faint text-sm font-ui mt-1 hover:text-muted transition-colors text-left px-1"
                  >
                    Type your own answer…
                  </button>
                  {/* Hidden open input for choice override */}
                  <textarea
                    ref={inputRef}
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Type your answer…"
                    className="hidden w-full bg-surface border border-border focus:border-gold/50 rounded-xl px-4 py-3 text-text font-ui text-base resize-none focus:outline-none placeholder:text-faint transition-colors mt-2"
                    rows={2}
                  />
                </div>
              ) : (
                /* Open type */
                <div className="mt-6">
                  <textarea
                    ref={inputRef}
                    value={currentAnswer}
                    onChange={(e) => setCurrentAnswer(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder="Type your answer… (Enter to continue)"
                    aria-label={currentQ.question}
                    className="w-full bg-surface border border-border focus:border-gold/50 rounded-xl px-5 py-4 text-text font-ui text-base resize-none focus:outline-none placeholder:text-faint transition-all duration-200 min-h-[80px]"
                    rows={3}
                  />
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-faint text-xs font-ui">Enter to continue</span>
                    <button
                      onClick={submitAnswer}
                      disabled={!currentAnswer.trim()}
                      className={clsx(
                        'flex items-center gap-2 px-4 py-2 rounded-xl font-ui font-medium text-sm transition-all duration-200',
                        currentAnswer.trim()
                          ? 'bg-gold text-bg hover:bg-gold-bright active:scale-95'
                          : 'bg-elevated text-faint cursor-not-allowed'
                      )}
                    >
                      {isLast ? 'Generate Campaign' : 'Next'}
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Answer history pills */}
              {Object.keys(answers).length > 0 && (
                <div className="mt-8 pt-6 border-t border-border">
                  <p className="text-xs text-faint font-ui mb-2">Your answers so far</p>
                  <div className="space-y-1.5">
                    {Object.entries(answers).map(([q, a]) => (
                      <div key={q} className="flex items-start gap-2">
                        <Check className="w-3.5 h-3.5 text-gold mt-0.5 flex-shrink-0" />
                        <span className="text-xs font-ui text-muted">{a}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}

        {/* No questions needed */}
        {!loading && !error && questions.length === 0 && planResult && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-12 h-12 rounded-full bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-4">
              <Check className="w-6 h-6 text-gold" />
            </div>
            <h2 className="font-display text-2xl text-text mb-2">Your idea says it all.</h2>
            <p className="text-muted font-ui text-sm mb-6">No questions needed — ready to generate.</p>
            <button
              onClick={skipAll}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gold text-bg font-ui font-medium hover:bg-gold-bright active:scale-95 transition-all duration-200 mx-auto"
            >
              <Sparkles className="w-4 h-4" />
              Generate Campaign
            </button>
          </motion.div>
        )}
      </div>
    </main>
  )
}

function Sparkles(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  )
}
