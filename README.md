# D&D Campaign Generator CLI

AI-powered campaign creation for first-time Dungeon Masters.

## Setup

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure your API key
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY
```

## Usage

```bash
# Full interactive mode (recommended)
python cli.py "A dark gothic adventure in a cursed village"

# Skip the clarifying questions
python cli.py "Pirates discover an ancient god sleeping beneath the ocean" --skip-plan

# Save to a specific folder + get JSON output too
python cli.py "A political intrigue in a city of thieves" --output ./campaigns --json
```

## What It Does

1. **Plan Mode** — The AI reads your idea and asks 6 clarifying questions (setting, tone, player count, etc.)
2. **Orchestrator** — GPT-5 designs the full campaign skeleton (chapters, NPCs, encounters, 3-act structure)
3. **Parallel Agents** — Multiple GPT-5 mini agents write each chapter, NPC, and the appendix simultaneously
4. **Quality Check** — GPT-5 reviews the full campaign for coherence
5. **Output** — A complete Markdown campaign book with read-aloud boxes, NPC profiles, encounter blocks, appendix

## Output Structure

The generated `.md` file contains:
- Campaign introduction & premise
- 3-act structure overview
- Full chapter content with DM notes & read-aloud text
- NPC roster with personality, dialogue samples, stat blocks
- Appendix: glossary, locations, magic items, monsters, DM cheat sheet
- Quality check report

## Model Config

Edit `.env` to change which OpenAI models are used:

```
ORCHESTRATOR_MODEL=gpt-4.1      # The campaign designer / quality checker
AGENT_MODEL=gpt-4.1-mini        # The parallel writers (one per chapter/NPC)
```

Swap in GPT-5 model IDs when available.
