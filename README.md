# Campaign Forge

AI-powered D&D campaign generator for first-time (and veteran) Dungeon Masters.

Describe your idea, answer a few questions, and get a complete campaign book — chapters, NPCs, encounters, and DM notes — generated in about 2 minutes.

## Stack

- **Next.js 15** — App Router, React 19
- **Anthropic Claude** — orchestrator + parallel writer agents (Opus for design, Sonnet for writing, Haiku for reference content)
- **Supabase** — auth & campaign storage
- **Zustand** — client state
- **Tailwind CSS + Framer Motion** — UI

## Getting Started

### 1. Supabase

Create a free project at [supabase.com](https://supabase.com), then run the migration.

**Option A — Supabase CLI:**
```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

**Option B — Supabase dashboard:**
Go to **SQL Editor** and paste the contents of `supabase/migrations/20240101000000_init.sql`.

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in `.env.local`:
```
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=      # Settings → API → Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY= # Settings → API → anon public key
```

### 3. Run

```bash
bun install   # or: npm install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## How It Works

1. **Idea** — You describe your campaign concept
2. **Plan** — The AI asks clarifying questions (tone, setting, player count, etc.)
3. **Generate** — An orchestrator designs the full campaign skeleton, then parallel agents write each chapter, NPC, and encounter simultaneously
4. **Review** — A final pass checks for coherence
5. **Output** — A complete campaign book saved to your account

## What's Generated

- Campaign premise & 3-act structure
- Full chapter content with DM notes & read-aloud text
- NPC roster with personalities, dialogue samples, and secrets
- Encounter blocks
- Appendix: locations, magic items, monsters, DM cheat sheet

## Environment Variables

```
ANTHROPIC_API_KEY=          # console.anthropic.com
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# Optional model overrides
ORCHESTRATOR_MODEL=claude-opus-4-6        # skeleton design + quality check
AGENT_MODEL=claude-sonnet-4-6             # chapter + NPC writers (parallel)
NANO_MODEL=claude-haiku-4-5-20251001      # appendix + DM guide
```
