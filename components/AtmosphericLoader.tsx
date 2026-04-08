'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PHASES = [
  {
    phrase: 'Consulting the ancient tomes',
    sub: 'The lore is vast…',
    visual: '📚',
    anim: 'float',
    color: '#C9A84C',
  },
  {
    phrase: 'Mixing the cauldron',
    sub: 'Something wicked brews…',
    visual: '⚗️',
    anim: 'bubble',
    color: '#8B5CF6',
  },
  {
    phrase: 'Sharpening swords',
    sub: 'Your heroes will need these…',
    visual: '⚔️',
    anim: 'shake',
    color: '#94A3B8',
  },
  {
    phrase: 'Lighting the beacons',
    sub: 'The signal reaches far…',
    visual: '🔥',
    anim: 'flicker',
    color: '#F97316',
  },
  {
    phrase: 'Charting the territories',
    sub: 'Every road, every ruin…',
    visual: '🗺️',
    anim: 'float',
    color: '#2D9E6E',
  },
  {
    phrase: 'Waking the ancient dead',
    sub: 'They have been waiting…',
    visual: '💀',
    anim: 'rise',
    color: '#8B2020',
  },
  {
    phrase: 'Inscribing the runes',
    sub: 'Words have power here…',
    visual: '🪄',
    anim: 'spin',
    color: '#C9A84C',
  },
  {
    phrase: 'Summoning dark forces',
    sub: 'Every great story needs a villain…',
    visual: '🌑',
    anim: 'pulse',
    color: '#4B2D8A',
  },
  {
    phrase: 'Rolling the fates',
    sub: 'The dice decide all…',
    visual: '🎲',
    anim: 'tumble',
    color: '#E4C86A',
  },
  {
    phrase: 'Binding the pages',
    sub: 'Almost ready for the table…',
    visual: '📜',
    anim: 'unfurl',
    color: '#C9A84C',
  },
  {
    phrase: 'Raising the fortress walls',
    sub: 'Every dungeon needs its depths…',
    visual: '🏰',
    anim: 'float',
    color: '#94A3B8',
  },
  {
    phrase: 'Whispering to the spirits',
    sub: 'They have stories to tell…',
    visual: '👻',
    anim: 'pulse',
    color: '#7DD3FC',
  },
]

const ANIM_STYLES: Record<string, string> = {
  float:   'animate-[float_3s_ease-in-out_infinite]',
  bubble:  'animate-[bubble_1.8s_ease-in-out_infinite]',
  shake:   'animate-[shake_0.5s_ease-in-out_infinite]',
  flicker: 'animate-[flicker_0.4s_ease-in-out_infinite]',
  rise:    'animate-[rise_2s_ease-in-out_infinite]',
  spin:    'animate-[spin_3s_linear_infinite]',
  pulse:   'animate-[pulse_2s_ease-in-out_infinite]',
  tumble:  'animate-[tumble_1.2s_ease-in-out_infinite]',
  unfurl:  'animate-[float_2.5s_ease-in-out_infinite]',
}

export default function AtmosphericLoader({ idea }: { idea: string }) {
  const [idx, setIdx] = useState(0)
  const [visible, setVisible] = useState(true)

  // Cycle every 3.5s
  useEffect(() => {
    const timer = setInterval(() => {
      setVisible(false)
      setTimeout(() => {
        setIdx((i) => (i + 1) % PHASES.length)
        setVisible(true)
      }, 400)
    }, 3500)
    return () => clearInterval(timer)
  }, [])

  const phase = PHASES[idx]

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] px-4 select-none">
      <AnimatePresence mode="wait">
        {visible && (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -16, scale: 0.95 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col items-center text-center"
          >
            {/* Visual */}
            <div
              className="text-8xl mb-6"
              style={{
                filter: `drop-shadow(0 0 32px ${phase.color}66)`,
              }}
            >
              <span className={ANIM_STYLES[phase.anim] ?? ''}>{phase.visual}</span>
            </div>

            {/* Phrase */}
            <h2 className="font-display text-3xl md:text-4xl text-text mb-2 leading-tight">
              {phase.phrase}
            </h2>
            <p className="text-muted font-ui text-base italic">{phase.sub}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress dots */}
      <div className="flex gap-1.5 mt-12">
        {PHASES.map((_, i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-500"
            style={{
              width: i === idx ? 20 : 6,
              height: 6,
              background: i === idx ? phase.color : '#1C2030',
            }}
          />
        ))}
      </div>

      {/* Idea reminder */}
      <p className="mt-8 text-xs font-ui text-faint max-w-sm text-center italic">
        "{idea.length > 80 ? idea.slice(0, 80) + '…' : idea}"
      </p>
    </div>
  )
}
