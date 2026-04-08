"""
D&D Campaign Generator CLI
Run: python cli.py "A dark gothic adventure in a cursed village"
"""
import asyncio
import json
import os
import sys
import time
from pathlib import Path

import typer
from dotenv import load_dotenv
from openai import AsyncOpenAI
from rich.console import Console
from rich.live import Live
from rich.markdown import Markdown
from rich.panel import Panel
from rich.progress import (
    BarColumn,
    Progress,
    SpinnerColumn,
    TaskProgressColumn,
    TextColumn,
    TimeElapsedColumn,
)
from rich.prompt import Prompt
from rich.rule import Rule
from rich.table import Table
from rich.text import Text
from rich import box

from generator import generate_campaign
from prompts import SYSTEM_PLANNER, PLAN_QUESTIONS_PROMPT
from render import render_campaign

load_dotenv()

app = typer.Typer(add_completion=False)
console = Console()

ORCHESTRATOR_MODEL = os.getenv("ORCHESTRATOR_MODEL", "gpt-5.4")
AGENT_MODEL = os.getenv("AGENT_MODEL", "gpt-5.4-mini")
NANO_MODEL = os.getenv("NANO_MODEL", "gpt-5.4-nano")

# ─── Visual helpers ──────────────────────────────────────────────────────────

BANNER = """
[bold gold1]╔══════════════════════════════════════════════════════════╗
║          ⚔  D&D CAMPAIGN GENERATOR  ⚔                    ║
║        Powered by AI · Built for First-Time DMs           ║
╚══════════════════════════════════════════════════════════╝[/bold gold1]
"""

AGENT_COLORS = {
    "orchestrator": "gold1",
    "chapter": "cyan",
    "npc": "green",
    "appendix": "magenta",
    "fanout": "yellow",
    "warning": "red",
}


def print_banner():
    console.print(BANNER)
    console.print()


def agent_label(agent_id: str) -> str:
    if agent_id.startswith("chapter_"):
        return f"[cyan]📖 Chapter Agent[/cyan] [{agent_id}]"
    if agent_id.startswith("npc_"):
        return f"[green]🧙 NPC Agent[/green] [{agent_id}]"
    if agent_id == "appendix":
        return "[magenta]📚 Appendix Agent[/magenta]"
    if agent_id == "orchestrator":
        return "[gold1]🎲 Orchestrator (GPT-5)[/gold1]"
    if agent_id == "fanout":
        return "[yellow]⚡ Parallel Fanout[/yellow]"
    return f"[white]{agent_id}[/white]"


def status_emoji(status: str) -> str:
    return {
        "thinking": "💭",
        "writing": "✍️ ",
        "reviewing": "🔍",
        "running": "⚡",
        "complete": "✅",
        "error": "❌",
    }.get(status, "•")


# ─── Plan Mode: clarifying questions ─────────────────────────────────────────

async def ask_clarifying_questions(idea: str) -> list[dict]:
    """Have the orchestrator generate clarifying questions for this campaign idea."""
    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    prompt = PLAN_QUESTIONS_PROMPT.format(idea=idea)

    with console.status("[gold1]Thinking about your campaign idea…[/gold1]", spinner="dots"):
        response = await client.chat.completions.create(
            model=ORCHESTRATOR_MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PLANNER},
                {"role": "user", "content": prompt},
            ],
            temperature=0.7,
            response_format={"type": "json_object"},
        )

    text = response.choices[0].message.content.strip()
    data = json.loads(text)
    return data.get("questions", [])


def run_plan_mode(idea: str) -> dict[str, str]:
    """
    Interactive plan mode: show questions, collect answers.
    Returns {question_text: answer_text} dict.
    """
    console.print(Rule("[bold gold1]PLAN MODE[/bold gold1]", style="gold1"))
    console.print()
    console.print(
        Panel(
            f"[italic]{idea}[/italic]",
            title="[gold1]Your Campaign Idea[/gold1]",
            border_style="gold1",
            padding=(1, 2),
        )
    )
    console.print()

    questions = asyncio.run(ask_clarifying_questions(idea))

    if not questions:
        console.print("[yellow]Could not generate clarifying questions. Proceeding with defaults.[/yellow]")
        return {}

    console.print(
        f"[gold1]I have [bold]{len(questions)}[/bold] questions before I start writing your campaign.[/gold1]\n"
        f"[dim]Take your time — your answers shape everything.[/dim]\n"
    )

    answers: dict[str, str] = {}

    for i, q in enumerate(questions, 1):
        console.print(Rule(f"[dim]Question {i} of {len(questions)}[/dim]", style="dim"))
        console.print()

        # Print the question
        console.print(f"[bold white]{i}. {q['question']}[/bold white]")

        # Print hint if present
        if q.get("hint"):
            console.print(f"[dim]   💡 {q['hint']}[/dim]")

        console.print()

        # Show choices if it's a choice question
        if q.get("type") == "choice" and q.get("choices"):
            table = Table(show_header=False, box=box.SIMPLE, padding=(0, 1))
            table.add_column("num", style="gold1", width=4)
            table.add_column("choice", style="white")
            for j, choice in enumerate(q["choices"], 1):
                table.add_row(f"{j}.", choice)
            console.print(table)
            console.print()

            answer = Prompt.ask(
                f"[gold1]Your answer[/gold1] [dim](number or type your own)[/dim]",
                default="",
            ).strip()

            # If they typed a number, resolve to the choice text
            if answer.isdigit():
                idx = int(answer) - 1
                if 0 <= idx < len(q["choices"]):
                    answer = q["choices"][idx]
        else:
            answer = Prompt.ask("[gold1]Your answer[/gold1]", default="").strip()

        answers[q["question"]] = answer or "(no preference)"
        console.print()

    # Summary table
    console.print(Rule("[bold gold1]YOUR CAMPAIGN BRIEF[/bold gold1]", style="gold1"))
    console.print()

    summary = Table(
        title="What you told me",
        box=box.ROUNDED,
        border_style="gold1",
        show_lines=True,
        padding=(0, 1),
    )
    summary.add_column("Question", style="dim", max_width=40)
    summary.add_column("Your Answer", style="white")
    for q_text, a_text in answers.items():
        summary.add_row(q_text[:60] + ("…" if len(q_text) > 60 else ""), a_text)

    console.print(summary)
    console.print()

    confirm = Prompt.ask(
        "[gold1]Ready to generate your campaign?[/gold1] [dim](yes / no to redo)[/dim]",
        choices=["yes", "no", "y", "n"],
        default="yes",
    )
    if confirm.lower() in ("no", "n"):
        console.print("[yellow]Restarting plan mode…[/yellow]")
        return run_plan_mode(idea)

    return answers


# ─── Generation progress display ─────────────────────────────────────────────

class ProgressTracker:
    def __init__(self):
        self.events: list[tuple[str, str, str]] = []
        self._progress = Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(bar_width=20),
            TaskProgressColumn(),
            TimeElapsedColumn(),
            console=console,
            transient=False,
        )
        self._tasks: dict[str, any] = {}
        self._started = False

    def start(self):
        self._progress.start()
        self._started = True

    def stop(self):
        if self._started:
            self._progress.stop()

    def update(self, agent_id: str, status: str, message: str):
        emoji = status_emoji(status)
        label = agent_label(agent_id)

        if agent_id not in self._tasks:
            color = AGENT_COLORS.get(
                next((k for k in AGENT_COLORS if agent_id.startswith(k)), "orchestrator"),
                "white",
            )
            task_id = self._progress.add_task(
                f"{emoji} {message}",
                total=None if status not in ("complete", "error") else 1,
            )
            self._tasks[agent_id] = task_id
        else:
            task_id = self._tasks[agent_id]
            if status in ("complete", "error"):
                self._progress.update(
                    task_id,
                    description=f"{emoji} {message}",
                    total=1,
                    completed=1,
                )
            else:
                self._progress.update(
                    task_id,
                    description=f"{emoji} {message}",
                    total=None,
                )


# ─── Main command ─────────────────────────────────────────────────────────────

@app.command()
def create(
    idea: str = typer.Argument(
        ...,
        help='Your campaign idea. E.g. "A dark gothic adventure in a cursed village"',
    ),
    output: Path = typer.Option(
        Path("."),
        "--output",
        "-o",
        help="Directory to save the campaign Markdown file",
    ),
    skip_plan: bool = typer.Option(
        False,
        "--skip-plan",
        help="Skip the clarifying questions and generate immediately",
    ),
    json_output: bool = typer.Option(
        False,
        "--json",
        help="Also save raw JSON alongside the Markdown",
    ),
):
    """
    Generate a complete D&D campaign from your idea.

    The tool will first ask you a few questions (plan mode),
    then spawn parallel AI agents to write every section of your campaign book.
    """
    # Validate API key
    if not os.getenv("OPENAI_API_KEY"):
        console.print(
            Panel(
                "[red bold]OPENAI_API_KEY not set.[/red bold]\n\n"
                "Copy [cyan].env.example[/cyan] to [cyan].env[/cyan] and add your key.",
                title="⛔ Missing API Key",
                border_style="red",
            )
        )
        raise typer.Exit(1)

    print_banner()

    # ── Plan mode ──────────────────────────────────────────────────────
    if skip_plan:
        answers: dict[str, str] = {}
        console.print("[dim]Skipping plan mode — generating with defaults.[/dim]\n")
    else:
        answers = run_plan_mode(idea)

    # ── Generation ─────────────────────────────────────────────────────
    console.print()
    console.print(Rule("[bold gold1]GENERATING YOUR CAMPAIGN[/bold gold1]", style="gold1"))
    console.print()
    console.print(
        f"[dim]Orchestrator: [cyan]{ORCHESTRATOR_MODEL}[/cyan]  ·  "
        f"Agents: [cyan]{AGENT_MODEL}[/cyan]  ·  "
        f"Nano: [cyan]{NANO_MODEL}[/cyan][/dim]\n"
    )

    tracker = ProgressTracker()
    tracker.start()

    async def on_progress(agent_id: str, status: str, message: str):
        tracker.update(agent_id, status, message)

    start_time = time.time()

    try:
        campaign = asyncio.run(generate_campaign(idea, answers, on_progress))
    except Exception as e:
        tracker.stop()
        console.print(f"\n[red bold]Generation failed:[/red bold] {e}")
        raise typer.Exit(1)

    tracker.stop()

    elapsed = time.time() - start_time
    console.print()
    console.print(
        f"[bold green]✅ Campaign generated in {elapsed:.0f}s[/bold green]\n"
    )

    # ── Render ─────────────────────────────────────────────────────────
    output.mkdir(parents=True, exist_ok=True)
    md_path = render_campaign(campaign, output)
    console.print(f"[gold1]📜 Campaign book saved to:[/gold1] [bold white]{md_path}[/bold white]")

    if json_output:
        slug = md_path.stem
        json_path = output / f"{slug}.json"
        json_path.write_text(json.dumps(campaign, indent=2, ensure_ascii=False), encoding="utf-8")
        console.print(f"[dim]JSON saved to: {json_path}[/dim]")

    # ── Summary ────────────────────────────────────────────────────────
    skeleton = campaign["skeleton"]
    qc = campaign.get("quality_check", {})

    console.print()
    console.print(
        Panel(
            f"[bold gold1]{skeleton.get('title', 'Your Campaign')}[/bold gold1]\n"
            f"[italic]{skeleton.get('tagline', '')}[/italic]\n\n"
            f"[dim]Chapters: {len(campaign.get('chapters', []))} · "
            f"NPCs: {len(campaign.get('npcs', []))} · "
            f"Quality: {qc.get('overall_quality', '?').title()} "
            f"({qc.get('coherence_score', '?')}/10 coherence)[/dim]",
            title="[gold1]Campaign Complete[/gold1]",
            border_style="gold1",
            padding=(1, 2),
        )
    )

    console.print()
    console.print("[dim]Open the Markdown file in any editor, Obsidian, or Notion to read your campaign.[/dim]")
    console.print("[dim]Next step: run again with --json to get the raw data for the web app.[/dim]")


if __name__ == "__main__":
    app()
