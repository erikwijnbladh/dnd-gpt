'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Campaign } from './types'

interface AppStore {
  // Current flow state
  currentIdea: string
  currentAnswers: Record<string, string>
  setIdea: (idea: string) => void
  setAnswers: (answers: Record<string, string>) => void

  // Saved campaigns
  campaigns: Record<string, Campaign>
  saveCampaign: (campaign: Campaign) => void
  getCampaign: (id: string) => Campaign | undefined
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      currentIdea: '',
      currentAnswers: {},
      setIdea: (idea) => set({ currentIdea: idea }),
      setAnswers: (answers) => set({ currentAnswers: answers }),

      campaigns: {},
      saveCampaign: (campaign) =>
        set((s) => ({ campaigns: { ...s.campaigns, [campaign.id]: campaign } })),
      getCampaign: (id) => get().campaigns[id],
    }),
    { name: 'dnd-gpt-store' }
  )
)
