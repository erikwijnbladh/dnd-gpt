import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#08090E',
        surface: '#0E1018',
        elevated: '#141720',
        border: '#1C2030',
        'border-bright': '#2A3050',
        gold: '#C9A84C',
        'gold-bright': '#E4C86A',
        'gold-dim': '#6B5520',
        'gold-glow': '#C9A84C33',
        text: '#EAE6DF',
        muted: '#7A7E8E',
        faint: '#3D4155',
        crimson: '#8B2020',
        'crimson-bright': '#B83030',
        parchment: '#F4ECD8',
        'parchment-dark': '#E8D9BC',
        ink: '#2C1B0E',
        'ink-light': '#5C3D20',
        agent: {
          chapter: '#3B7BE0',
          npc: '#2D9E6E',
          appendix: '#8B5CF6',
          guide: '#E97316',
          orchestrator: '#C9A84C',
        },
      },
      fontFamily: {
        display: ['var(--font-cinzel)', 'serif'],
        body: ['var(--font-crimson)', 'Georgia', 'serif'],
        ui: ['var(--font-jakarta)', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in-right': 'slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'appear': 'appear 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(32px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 20px #C9A84C33, 0 0 40px #C9A84C11' },
          '50%': { boxShadow: '0 0 40px #C9A84C55, 0 0 80px #C9A84C22' },
        },
        appear: {
          from: { opacity: '0', transform: 'scale(0.92) translateY(8px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        shimmer: {
          from: { backgroundPosition: '-200% center' },
          to: { backgroundPosition: '200% center' },
        },
      },
      backgroundImage: {
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E\")",
        'gold-shimmer': 'linear-gradient(90deg, transparent 0%, #C9A84C44 50%, transparent 100%)',
      },
    },
  },
  plugins: [],
}

export default config
