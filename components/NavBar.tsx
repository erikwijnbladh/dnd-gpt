'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import clsx from 'clsx'
import { LogOut, BookOpen, Plus, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme'

export default function NavBar() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const supabase = createClient()
  const { theme, toggle } = useTheme()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
    router.refresh()
  }

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-bg/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4 h-12 flex items-center justify-between">
        <button onClick={() => router.push('/')} className="flex items-center gap-2">
          <span className="text-gold text-sm">⚔</span>
          <span className="font-display text-sm text-text tracking-wide">Campaign Forge</span>
        </button>

        <div className="flex items-center gap-1">
          {user ? (
            <>
              <button
                onClick={() => router.push('/campaigns')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-muted hover:text-text hover:bg-elevated transition-all font-ui text-sm"
              >
                <BookOpen className="w-3.5 h-3.5" />
                My Campaigns
              </button>
              <button
                onClick={() => router.push('/')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 text-gold hover:bg-gold/20 transition-all font-ui text-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                New
              </button>
              <button
                onClick={signOut}
                className="p-2 rounded-lg text-faint hover:text-muted hover:bg-elevated transition-all"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push('/auth')}
              className="px-3 py-1.5 rounded-lg bg-gold text-bg font-ui font-medium text-sm hover:bg-gold-bright transition-colors"
            >
              Sign In
            </button>
          )}

          {/* Theme toggle — always visible */}
          <button
            onClick={toggle}
            className="p-2 rounded-lg text-faint hover:text-muted hover:bg-elevated transition-all ml-1"
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark'
              ? <Sun className="w-4 h-4" />
              : <Moon className="w-4 h-4" />
            }
          </button>
        </div>
      </div>
    </nav>
  )
}
