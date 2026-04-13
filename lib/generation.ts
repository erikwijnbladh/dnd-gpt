import { chapterPrompt } from './prompts'

export type ChapterSkeleton = {
  id: string
  number: number
  title: string
  synopsis: string
  key_moments: string[]
}

export type CompletedChapter = {
  chapter_id: string
  scene_setting: string
  what_happens_next: string
  [key: string]: unknown
}

export type GenerateChapterFn = (
  ch: ChapterSkeleton,
  prompt: string,
  completedSoFar: CompletedChapter[],
) => Promise<CompletedChapter>

/**
 * Runs chapter generation sequentially, passing each completed chapter
 * as context to the next one.
 */
export async function generateChaptersSequentially(
  campaignTitle: string,
  premise: string,
  threeAct: object,
  skeletonChapters: ChapterSkeleton[],
  generateChapter: GenerateChapterFn,
): Promise<CompletedChapter[]> {
  const completed: CompletedChapter[] = []
  for (const ch of skeletonChapters) {
    const snapshot = [...completed]
    const prompt = chapterPrompt(campaignTitle, premise, threeAct, ch, snapshot)
    const result = await generateChapter(ch, prompt, snapshot)
    completed.push(result)
  }
  return completed
}
