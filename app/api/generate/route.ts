import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/lib/supabase/server";
import {
  SYSTEM_ORCHESTRATOR,
  skeletonPrompt,
  npcPrompt,
  appendixPrompt,
  howToRunPrompt,
  qualityCheckPrompt,
} from "@/lib/prompts";
import {
  generateChaptersSequentially,
  type ChapterSkeleton,
  type CompletedChapter,
} from "@/lib/generation";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ORCHESTRATOR_MODEL = process.env.ORCHESTRATOR_MODEL ?? "claude-opus-4-6";
const AGENT_MODEL = process.env.AGENT_MODEL ?? "claude-sonnet-4-6";
const NANO_MODEL = process.env.NANO_MODEL ?? "claude-haiku-4-5-20251001";

// Minimal tool schema — the prompts define the exact JSON shape;
// forcing tool use guarantees we always get a parsed object back (no markdown fences to strip)
const OUTPUT_TOOL: Anthropic.Tool = {
  name: "output",
  description:
    "Return the structured campaign data exactly as specified in the prompt.",
  input_schema: { type: "object", additionalProperties: true },
};

async function callClaude(
  model: string,
  system: string,
  prompt: string,
  maxTokens = 4096,
): Promise<Record<string, unknown>> {
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
    tools: [OUTPUT_TOOL],
    tool_choice: { type: "tool", name: "output" },
  });
  const block = response.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use")
    throw new Error("No tool_use block in Claude response");
  return block.input as Record<string, unknown>;
}

function normalizeList(val: unknown, keys: string[]): object[] {
  if (!val) return [];
  const arr = Array.isArray(val) ? val : [val];
  return arr.map((item) => {
    if (typeof item === "object" && item !== null) return item;
    if (typeof item === "string" && keys.length >= 2) {
      const [a, ...rest] = item.split(":");
      return { [keys[0]]: a?.trim() ?? item, [keys[1]]: rest.join(":").trim() };
    }
    return { [keys[0]]: String(item) };
  });
}

function normalizeAppendix(a: Record<string, unknown>) {
  a.glossary = normalizeList(a.glossary, ["term", "definition"]);
  a.locations = normalizeList(a.locations, ["name", "description"]);
  a.magic_items = normalizeList(a.magic_items, ["name", "description"]);
  a.monsters = normalizeList(a.monsters, ["name", "description"]);
  return a;
}

function normalizeNpc(npc: Record<string, unknown>) {
  if (typeof npc.dm_tips === "string") {
    npc.dm_tips = (npc.dm_tips as string).split("\n").filter(Boolean);
  } else if (!Array.isArray(npc.dm_tips)) {
    npc.dm_tips = [];
  }
  if (typeof npc.personality_traits === "string") {
    npc.personality_traits = (npc.personality_traits as string)
      .split(",")
      .map((s: string) => s.trim());
  }
  return npc;
}

function inferSessionCount(answers: Record<string, string>): {
  players: number;
  sessions: number;
} {
  let players = 4,
    sessions = 6;
  for (const a of Object.values(answers)) {
    const l = a.toLowerCase();
    if (l.includes("2") && l.includes("player")) players = 2;
    else if (l.includes("3") && l.includes("player")) players = 3;
    else if (l.includes("5") && l.includes("player")) players = 5;
    if (
      l.includes("one-shot") ||
      l.includes("one shot") ||
      l.includes("single")
    )
      sessions = 1;
    else if (l.includes("3 session") || l.includes("three session"))
      sessions = 3;
    else if (l.includes("10") || l.includes("twelve") || l.includes("long"))
      sessions = 10;
  }
  return { players, sessions };
}

export async function POST(req: NextRequest) {
  const { idea, answers } = await req.json();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          /* stream closed */
        }
      };

      try {
        // ── 1. Skeleton ──────────────────────────────────────────────
        send({
          type: "status",
          agentId: "orchestrator",
          agentType: "orchestrator",
          status: "thinking",
          message: "Designing your campaign world…",
        });

        const { players, sessions } = inferSessionCount(answers ?? {});
        const skeleton = await callClaude(
          ORCHESTRATOR_MODEL,
          SYSTEM_ORCHESTRATOR,
          skeletonPrompt(idea, answers ?? {}, players, sessions),
          4096,
        );

        send({
          type: "agent_complete",
          agentId: "orchestrator",
          status: "complete",
          message: `"${skeleton.title}" designed`,
          preview: skeleton.tagline,
        });

        // Announce fanout
        const chapterCount = (skeleton.chapters as unknown[])?.length ?? 0;
        const npcCount = (skeleton.npcs as unknown[])?.length ?? 0;
        send({
          type: "fanout",
          agentId: "fanout",
          status: "running",
          message: `Spawning ${chapterCount} chapter agents + ${npcCount} NPC agents…`,
        });

        // Pre-announce agents so UI renders them immediately
        for (const ch of (skeleton.chapters as any[]) ?? []) {
          send({
            type: "agent_start",
            agentId: `chapter_${ch.id}`,
            agentType: "chapter",
            message: ch.title,
            status: "thinking",
          });
        }
        for (const npc of (skeleton.npcs as any[]) ?? []) {
          send({
            type: "agent_start",
            agentId: `npc_${npc.id}`,
            agentType: "npc",
            message: npc.name,
            status: "thinking",
          });
        }
        send({
          type: "agent_start",
          agentId: "appendix",
          agentType: "appendix",
          message: "Appendix",
          status: "thinking",
        });
        send({
          type: "agent_start",
          agentId: "how_to_run",
          agentType: "guide",
          message: "DM Guide",
          status: "thinking",
        });

        // ── 2. Sequential chapters + parallel NPCs / appendix / guide ──
        // Chapters run one-at-a-time so each gets narrative context from prior chapters.
        // NPCs, appendix, and guide run in parallel alongside them.
        const chapterTask = () =>
          generateChaptersSequentially(
            skeleton.title as string,
            skeleton.premise as string,
            skeleton.three_act_structure as object,
            (skeleton.chapters as ChapterSkeleton[]) ?? [],
            async (ch, prompt) => {
              send({
                type: "agent_update",
                agentId: `chapter_${ch.id}`,
                status: "writing",
                message: `Writing ${ch.title}…`,
              });
              const result = await callClaude(
                AGENT_MODEL,
                SYSTEM_ORCHESTRATOR,
                prompt,
                4096,
              );
              send({
                type: "agent_complete",
                agentId: `chapter_${ch.id}`,
                status: "complete",
                message: `✓ ${ch.title}`,
                preview:
                  (result.scene_setting as string)?.slice(0, 120) + "…",
              });
              return result as CompletedChapter;
            },
          );

        const npcTasks = ((skeleton.npcs as any[]) ?? []).map(async (npc) => {
          send({
            type: "agent_update",
            agentId: `npc_${npc.id}`,
            status: "writing",
            message: `Creating ${npc.name}…`,
          });
          const result = normalizeNpc(
            await callClaude(
              AGENT_MODEL,
              SYSTEM_ORCHESTRATOR,
              npcPrompt(
                skeleton.title as string,
                skeleton.premise as string,
                skeleton.setting as object,
                npc,
              ),
              2048,
            ),
          );
          send({
            type: "agent_complete",
            agentId: `npc_${npc.id}`,
            status: "complete",
            message: `✓ ${npc.name}`,
            preview: (result.appearance as string)?.slice(0, 100) + "…",
          });
          return result;
        });

        const appendixTask = async () => {
          send({
            type: "agent_update",
            agentId: "appendix",
            status: "writing",
            message: "Compiling appendix…",
          });
          const chStr = ((skeleton.chapters as any[]) ?? [])
            .map((c) => `Ch${c.number}: ${c.title}`)
            .join("; ");
          const nStr = ((skeleton.npcs as any[]) ?? [])
            .map((n) => `${n.name} (${n.role})`)
            .join("; ");
          const result = normalizeAppendix(
            await callClaude(
              NANO_MODEL,
              SYSTEM_ORCHESTRATOR,
              appendixPrompt(
                skeleton.title as string,
                skeleton.premise as string,
                chStr,
                nStr,
              ),
              4096,
            ),
          );
          send({
            type: "agent_complete",
            agentId: "appendix",
            status: "complete",
            message: "✓ Appendix compiled",
          });
          return result;
        };

        const howToRunTask = async () => {
          send({
            type: "agent_update",
            agentId: "how_to_run",
            status: "writing",
            message: "Writing DM guide…",
          });
          const chList = ((skeleton.chapters as any[]) ?? [])
            .map((c) => `Chapter ${c.number}: ${c.title}`)
            .join("; ");
          const nList = ((skeleton.npcs as any[]) ?? [])
            .map((n) => n.name)
            .join(", ");
          const result = await callClaude(
            NANO_MODEL,
            SYSTEM_ORCHESTRATOR,
            howToRunPrompt(
              skeleton.title as string,
              skeleton.premise as string,
              (skeleton.chapters as any[])?.length ?? 0,
              (skeleton.total_sessions as number) ?? 6,
              (skeleton.player_count as number) ?? 4,
              chList,
              nList,
            ),
            2048,
          );
          send({
            type: "agent_complete",
            agentId: "how_to_run",
            status: "complete",
            message: "✓ DM guide ready",
          });
          return result;
        };

        const [chapters, npcs, appendix, how_to_run] = await Promise.all([
          chapterTask(),
          Promise.all(npcTasks),
          appendixTask(),
          howToRunTask(),
        ] as const);

        // ── 3. Quality check ─────────────────────────────────────────
        send({
          type: "agent_start",
          agentId: "qc",
          agentType: "qc",
          status: "reviewing",
          message: "Quality check…",
        });
        send({
          type: "agent_update",
          agentId: "orchestrator",
          status: "reviewing",
          message: "Reviewing for coherence…",
        });

        const chSummaries = ((skeleton.chapters as any[]) ?? [])
          .map((c) => `Ch${c.number}: ${c.title}`)
          .join("; ");
        const quality_check = await callClaude(
          ORCHESTRATOR_MODEL,
          SYSTEM_ORCHESTRATOR,
          qualityCheckPrompt(skeleton.title as string, chSummaries),
          1024,
        );
        send({
          type: "agent_complete",
          agentId: "qc",
          status: "complete",
          message: `Quality: ${quality_check.overall_quality}`,
        });

        // ── 4. Save to Supabase ──────────────────────────────────────
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const campaignId = uuidv4();
        const campaign = {
          id: campaignId,
          idea,
          answers: answers ?? {},
          generatedAt: new Date().toISOString(),
          skeleton,
          chapters,
          npcs,
          appendix,
          how_to_run,
          quality_check,
        };

        if (user) {
          const { error: dbError } = await supabase.from("campaigns").insert({
            id: campaignId,
            user_id: user.id,
            title: skeleton.title,
            tagline: skeleton.tagline,
            idea,
            answers: answers ?? {},
            skeleton,
            chapters,
            npcs,
            appendix,
            how_to_run,
            quality_check,
          });
          if (dbError) console.error("Failed to save campaign:", dbError);
        }

        send({ type: "complete", campaign });
      } catch (err) {
        console.error("Generation error:", err);
        send({ type: "error", message: String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
