import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { SYSTEM_PLANNER, planQuestionsPrompt } from '@/lib/prompts'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const ORCHESTRATOR_MODEL = process.env.ORCHESTRATOR_MODEL ?? 'claude-opus-4-6'

const OUTPUT_TOOL: Anthropic.Tool = {
  name: 'output',
  description: 'Return the structured plan data exactly as specified in the prompt.',
  input_schema: { type: 'object', additionalProperties: true },
}

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json()
    if (!idea?.trim()) {
      return NextResponse.json({ error: 'Idea is required' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: ORCHESTRATOR_MODEL,
      max_tokens: 1024,
      system: SYSTEM_PLANNER,
      messages: [{ role: 'user', content: planQuestionsPrompt(idea) }],
      tools: [OUTPUT_TOOL],
      tool_choice: { type: 'tool', name: 'output' },
    })

    const block = response.content.find((b) => b.type === 'tool_use')
    if (!block || block.type !== 'tool_use') {
      return NextResponse.json({ error: 'No structured response from Claude' }, { status: 500 })
    }

    return NextResponse.json(block.input)
  } catch (err) {
    console.error('/api/plan error:', err)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
