import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { SYSTEM_PLANNER, planQuestionsPrompt } from '@/lib/prompts'

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
const ORCHESTRATOR_MODEL = process.env.ORCHESTRATOR_MODEL ?? 'gpt-5.4'

export async function POST(req: NextRequest) {
  try {
    const { idea } = await req.json()
    if (!idea?.trim()) {
      return NextResponse.json({ error: 'Idea is required' }, { status: 400 })
    }

    const response = await client.chat.completions.create({
      model: ORCHESTRATOR_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PLANNER },
        { role: 'user', content: planQuestionsPrompt(idea) },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    })

    const data = JSON.parse(response.choices[0].message.content ?? '{}')
    return NextResponse.json(data)
  } catch (err) {
    console.error('/api/plan error:', err)
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 })
  }
}
