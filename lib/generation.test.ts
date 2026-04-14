import { describe, it, expect, vi } from 'vitest'
import { generateChaptersSequentially, ChapterSkeleton, CompletedChapter } from './generation'
import { chapterPrompt } from './prompts'

const SKELETON_CHAPTERS: ChapterSkeleton[] = [
  { id: 'ch1', number: 1, title: 'The Dark Forest', synopsis: 'Players enter the woods', key_moments: ['meet ranger', 'find ruin'] },
  { id: 'ch2', number: 2, title: 'The Ruined Tower', synopsis: 'Players explore the tower', key_moments: ['fight gargoyle', 'find map'] },
  { id: 'ch3', number: 3, title: 'The Final Vault', synopsis: 'Players confront the villain', key_moments: ['showdown', 'escape'] },
]

const makeChapterResult = (id: string, i: number): CompletedChapter => ({
  chapter_id: id,
  scene_setting: `Scene for chapter ${i + 1}`,
  what_happens_next: `Bridge to chapter ${i + 2}`,
})

// ── chapterPrompt unit tests ──────────────────────────────────────────────────

describe('chapterPrompt', () => {
  it('omits PRIOR CHAPTERS section when no completed chapters provided', () => {
    const prompt = chapterPrompt('Test Campaign', 'A brave quest', {}, SKELETON_CHAPTERS[0])
    expect(prompt).not.toContain('PRIOR CHAPTERS')
  })

  it('omits PRIOR CHAPTERS section when empty array passed', () => {
    const prompt = chapterPrompt('Test Campaign', 'A brave quest', {}, SKELETON_CHAPTERS[0], [])
    expect(prompt).not.toContain('PRIOR CHAPTERS')
  })

  it('includes PRIOR CHAPTERS section when completed chapters exist', () => {
    const prior: CompletedChapter[] = [makeChapterResult('ch1', 0)]
    const prompt = chapterPrompt('Test Campaign', 'A brave quest', {}, SKELETON_CHAPTERS[1], prior)
    expect(prompt).toContain('PRIOR CHAPTERS')
    expect(prompt).toContain('Scene for chapter 1')
    expect(prompt).toContain('Bridge to chapter 2')
  })

  it('includes context from all prior chapters', () => {
    const prior: CompletedChapter[] = [
      makeChapterResult('ch1', 0),
      makeChapterResult('ch2', 1),
    ]
    const prompt = chapterPrompt('Test Campaign', 'A brave quest', {}, SKELETON_CHAPTERS[2], prior)
    expect(prompt).toContain('Scene for chapter 1')
    expect(prompt).toContain('Scene for chapter 2')
  })

  it('truncates long scene_setting to 200 chars', () => {
    const longScene = 'A'.repeat(500)
    const prior: CompletedChapter[] = [{
      chapter_id: 'ch1',
      scene_setting: longScene,
      what_happens_next: 'Next bridge',
    }]
    const prompt = chapterPrompt('Test Campaign', 'A brave quest', {}, SKELETON_CHAPTERS[1], prior)
    // Should contain truncated version (200 chars + '…'), not the full 500
    expect(prompt).not.toContain('A'.repeat(201))
    expect(prompt).toContain('A'.repeat(200))
  })
})

// ── generateChaptersSequentially tests ───────────────────────────────────────

describe('generateChaptersSequentially', () => {
  it('calls generateChapter once per chapter in order', async () => {
    const callOrder: string[] = []
    const mockGenerate = vi.fn(async (ch) => {
      callOrder.push(ch.id)
      return makeChapterResult(ch.id, ch.number - 1)
    })

    await generateChaptersSequentially('Campaign', 'Premise', {}, SKELETON_CHAPTERS, mockGenerate)

    expect(mockGenerate).toHaveBeenCalledTimes(3)
    expect(callOrder).toEqual(['ch1', 'ch2', 'ch3'])
  })

  it('passes empty completedSoFar to the first chapter', async () => {
    const mockGenerate = vi.fn(async (ch, _prompt, completedSoFar) => {
      return makeChapterResult(ch.id, ch.number - 1)
    })

    await generateChaptersSequentially('Campaign', 'Premise', {}, SKELETON_CHAPTERS, mockGenerate)

    const firstCallCompleted = mockGenerate.mock.calls[0][2]
    expect(firstCallCompleted).toEqual([])
  })

  it('passes one completed chapter to the second chapter call', async () => {
    const mockGenerate = vi.fn(async (ch, _prompt, completedSoFar) => {
      return makeChapterResult(ch.id, ch.number - 1)
    })

    await generateChaptersSequentially('Campaign', 'Premise', {}, SKELETON_CHAPTERS, mockGenerate)

    const secondCallCompleted = mockGenerate.mock.calls[1][2]
    expect(secondCallCompleted).toHaveLength(1)
    expect(secondCallCompleted[0].chapter_id).toBe('ch1')
  })

  it('passes two completed chapters to the third chapter call', async () => {
    const mockGenerate = vi.fn(async (ch, _prompt, completedSoFar) => {
      return makeChapterResult(ch.id, ch.number - 1)
    })

    await generateChaptersSequentially('Campaign', 'Premise', {}, SKELETON_CHAPTERS, mockGenerate)

    const thirdCallCompleted = mockGenerate.mock.calls[2][2]
    expect(thirdCallCompleted).toHaveLength(2)
    expect(thirdCallCompleted[0].chapter_id).toBe('ch1')
    expect(thirdCallCompleted[1].chapter_id).toBe('ch2')
  })

  it('prompt passed to second chapter contains first chapter context', async () => {
    const prompts: string[] = []
    const mockGenerate = vi.fn(async (ch, prompt, _completed) => {
      prompts.push(prompt)
      return makeChapterResult(ch.id, ch.number - 1)
    })

    await generateChaptersSequentially('Campaign', 'Premise', {}, SKELETON_CHAPTERS, mockGenerate)

    expect(prompts[0]).not.toContain('PRIOR CHAPTERS')
    expect(prompts[1]).toContain('PRIOR CHAPTERS')
    expect(prompts[1]).toContain('Scene for chapter 1')
    expect(prompts[2]).toContain('Scene for chapter 1')
    expect(prompts[2]).toContain('Scene for chapter 2')
  })

  it('returns all completed chapters in order', async () => {
    const mockGenerate = vi.fn(async (ch) => makeChapterResult(ch.id, ch.number - 1))

    const results = await generateChaptersSequentially('Campaign', 'Premise', {}, SKELETON_CHAPTERS, mockGenerate)

    expect(results).toHaveLength(3)
    expect(results.map(r => r.chapter_id)).toEqual(['ch1', 'ch2', 'ch3'])
  })

  it('waits for each chapter before starting the next (sequential, not parallel)', async () => {
    const startTimes: number[] = []
    const endTimes: number[] = []

    const mockGenerate = vi.fn(async (ch) => {
      startTimes.push(Date.now())
      await new Promise(r => setTimeout(r, 20))
      endTimes.push(Date.now())
      return makeChapterResult(ch.id, ch.number - 1)
    })

    await generateChaptersSequentially('Campaign', 'Premise', {}, SKELETON_CHAPTERS, mockGenerate)

    // Each chapter should start after the previous one ended
    expect(startTimes[1]).toBeGreaterThanOrEqual(endTimes[0])
    expect(startTimes[2]).toBeGreaterThanOrEqual(endTimes[1])
  })
})
