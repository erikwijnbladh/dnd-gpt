'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { Plus, Trash2, BookOpen } from 'lucide-react'
import NavBar from '@/components/NavBar'

interface CampaignRow {
  id: string
  title: string
  tagline: string
  idea: string
  created_at: string
  skeleton: { chapters: unknown[]; total_sessions: number; player_count: number }
}

export default function CampaignsPage() {
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const load = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('campaigns')
      .select('id, title, tagline, idea, created_at, skeleton')
      .order('created_at', { ascending: false })
    setCampaigns((data as CampaignRow[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const deleteCampaign = async (id: string) => {
    await supabase.from('campaigns').delete().eq('id', id)
    setCampaigns((c) => c.filter((x) => x.id !== id))
  }

  return (
    <>
      <NavBar />
      <main className="min-h-screen pt-20 px-4 max-w-3xl mx-auto pb-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-2xl text-text">My Campaigns</h1>
            <p className="text-muted font-ui text-sm mt-1">{campaigns.length} campaign{campaigns.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gold text-bg font-ui font-medium text-sm hover:bg-gold-bright active:scale-95 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Campaign
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
          </div>
        )}

        {!loading && campaigns.length === 0 && (
          <div className="text-center py-20 rounded-2xl border border-dashed border-border">
            <BookOpen className="w-10 h-10 text-faint mx-auto mb-3" />
            <p className="font-display text-lg text-muted mb-1">No campaigns yet</p>
            <p className="text-faint font-ui text-sm mb-4">Generate your first campaign to see it here.</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 rounded-xl bg-gold text-bg font-ui font-medium text-sm hover:bg-gold-bright transition-colors"
            >
              Create Campaign
            </button>
          </div>
        )}

        <div className="space-y-3">
          {campaigns.map((c, i) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group rounded-2xl border border-border bg-surface hover:border-gold/30 transition-all duration-200 overflow-hidden"
            >
              <button
                onClick={() => router.push(`/campaign/${c.id}`)}
                className="w-full text-left px-5 py-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-base text-text group-hover:text-gold transition-colors truncate">{c.title}</h2>
                    <p className="text-muted font-ui text-sm italic mt-0.5 truncate">{c.tagline}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs font-ui text-faint">
                      <span>{c.skeleton?.chapters?.length ?? '?'} chapters</span>
                      <span>·</span>
                      <span>{c.skeleton?.total_sessions ?? '?'} sessions</span>
                      <span>·</span>
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center">
                    <span className="text-gold text-sm">📜</span>
                  </div>
                </div>
              </button>

              {/* Delete — separated from open action */}
              <div className="px-5 pb-3 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); deleteCampaign(c.id) }}
                  className="flex items-center gap-1.5 text-xs font-ui text-faint hover:text-crimson-bright transition-colors"
                  aria-label={`Delete ${c.title}`}
                >
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </main>
    </>
  )
}
