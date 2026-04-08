'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'

type Mode = 'signin' | 'signup'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError(null)
    setSuccess(null)

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Check your email to confirm your account, then sign in.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push('/')
        router.refresh()
      }
    }
    setLoading(false)
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-gold/10 border border-gold/30 flex items-center justify-center mx-auto mb-4">
            <span className="text-gold text-xl">⚔</span>
          </div>
          <h1 className="font-display text-2xl text-text">Campaign Forge</h1>
          <p className="text-muted font-ui text-sm mt-1">
            {mode === 'signin' ? 'Welcome back.' : 'Create your account.'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-surface p-6">
          {/* Mode toggle */}
          <div className="flex rounded-xl border border-border p-1 mb-6">
            {(['signin', 'signup'] as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); setSuccess(null) }}
                className={clsx(
                  'flex-1 py-2 rounded-lg font-ui text-sm font-medium transition-all duration-150',
                  mode === m ? 'bg-elevated text-text' : 'text-muted hover:text-text'
                )}
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-ui text-muted mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="w-full bg-elevated border border-border focus:border-gold/50 rounded-xl px-4 py-2.5 text-text font-ui text-sm placeholder:text-faint focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-ui text-muted mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 8 characters' : '••••••••'}
                required
                minLength={mode === 'signup' ? 8 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="w-full bg-elevated border border-border focus:border-gold/50 rounded-xl px-4 py-2.5 text-text font-ui text-sm placeholder:text-faint focus:outline-none transition-colors"
              />
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-crimson-bright text-xs font-ui"
                  role="alert"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Success */}
            <AnimatePresence>
              {success && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-emerald-400 text-xs font-ui"
                  role="status"
                  aria-live="polite"
                >
                  {success}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={loading || !email || !password}
              className={clsx(
                'w-full py-2.5 rounded-xl font-ui font-semibold text-sm transition-all duration-200',
                loading || !email || !password
                  ? 'bg-elevated text-faint cursor-not-allowed'
                  : 'bg-gold text-bg hover:bg-gold-bright active:scale-95'
              )}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-faint text-xs font-ui mt-6">
          Your campaigns are saved to your account.
        </p>
      </motion.div>
    </main>
  )
}
