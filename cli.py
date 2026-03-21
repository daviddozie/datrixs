#!/usr/bin/env python3
"""
Datrixs CLI — Interact with your Datrixs data agent from the terminal.

Usage:
    python3 cli.py chat                         # Start interactive chat
    python3 cli.py upload <file> <session_id>   # Upload a file to a session
    python3 cli.py sessions                     # List all sessions
    python3 cli.py new-session <name>           # Create a new session
    python3 cli.py ask <session_id> <question>  # Ask a one-shot question
"""

import sys
import os
import json
import time
import requests
import typer
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.prompt import Prompt
from rich.markdown import Markdown
from rich import print as rprint
from typing import Optional

app = typer.Typer(
    name="datrixs",
    help="🤖 Datrixs — AI-powered data analysis agent CLI",
    add_completion=False,
)
console = Console()

NEXT_URL = os.environ.get("NEXT_PUBLIC_APP_URL", "http://localhost:3000")

MIME_MAP = {
    ".csv": "text/csv",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


# ── Helpers ───────────────────────────────────


def check_service() -> bool:
    """Verify the Next.js service is reachable"""
    try:
        requests.get(f"{NEXT_URL}/api/sessions", timeout=5)
        return True
    except Exception:
        console.print(
            f"[red]❌ Cannot reach Datrixs at {NEXT_URL}[/red]\n"
            "Make sure the app is running:\n"
            "  [bold]npm run dev[/bold]"
        )
        return False


def api_get(path: str) -> dict:
    r = requests.get(f"{NEXT_URL}{path}", timeout=10)
    return r.json()


def api_post(path: str, **kwargs) -> dict:
    r = requests.post(f"{NEXT_URL}{path}", timeout=30, **kwargs)
    return r.json()


def ask_agent_stream(session_id: str, question: str) -> str:
    """Stream agent response and print it in real time"""
    try:
        r = requests.post(
            f"{NEXT_URL}/api/agent",
            json={"sessionId": session_id, "content": question},
            timeout=120,
            stream=True,
        )
        full = ""
        console.print("\n[bold cyan]🤖 Datrixs:[/bold cyan] ", end="")
        for chunk in r.iter_content(chunk_size=None, decode_unicode=True):
            if chunk:
                # Strip chart markers before printing
                if "[CHART_DATA]" in chunk:
                    before, _, rest = chunk.partition("[CHART_DATA]")
                    _, _, after = rest.partition("[/CHART_DATA]")
                    chunk = before + after
                    console.print(
                        "\n[dim italic](chart generated — open the UI to view it)[/dim italic]"
                    )
                print(chunk, end="", flush=True)
                full += chunk
        print()
        return full
    except requests.exceptions.Timeout:
        console.print("[red]Timeout — agent took too long to respond[/red]")
        return ""
    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")
        return ""


# ── Commands ──────────────────────────────────


@app.command()
def sessions():
    """List all sessions."""
    if not check_service():
        raise typer.Exit(1)

    data = api_get("/api/sessions")
    if not data.get("success"):
        console.print(f"[red]Error: {data.get('error', 'Unknown error')}[/red]")
        raise typer.Exit(1)

    items = data.get("data", [])
    if not items:
        console.print("[yellow]No sessions found. Create one with:[/yellow] datrixs new-session <name>")
        return

    table = Table(title="Sessions", show_lines=True)
    table.add_column("ID", style="dim", no_wrap=True)
    table.add_column("Name", style="bold")
    table.add_column("Files", justify="right")
    table.add_column("Messages", justify="right")
    table.add_column("Created")

    for s in items:
        table.add_row(
            s["id"],
            s["name"],
            str(s.get("fileCount", 0)),
            str(s.get("messageCount", 0)),
            s["createdAt"][:10],
        )

    console.print(table)


@app.command("new-session")
def new_session(name: str = typer.Argument(..., help="Name for the new session")):
    """Create a new session."""
    if not check_service():
        raise typer.Exit(1)

    data = api_post("/api/sessions", json={"name": name})
    if data.get("success"):
        session = data["data"]
        console.print(f"[green]✅ Session created:[/green] [bold]{session['name']}[/bold]")
        console.print(f"   ID: [cyan]{session['id']}[/cyan]")
    else:
        console.print(f"[red]Error: {data.get('error')}[/red]")
        raise typer.Exit(1)


@app.command()
def upload(
    file_path: str = typer.Argument(..., help="Path to the file to upload"),
    session_id: str = typer.Argument(..., help="Session ID to upload into"),
):
    """Upload a data file (CSV, XLSX, PDF, or image) to a session."""
    if not check_service():
        raise typer.Exit(1)

    if not os.path.exists(file_path):
        console.print(f"[red]File not found: {file_path}[/red]")
        raise typer.Exit(1)

    ext = os.path.splitext(file_path)[1].lower()
    mime = MIME_MAP.get(ext)
    if not mime:
        console.print(
            f"[red]Unsupported file type: {ext}[/red]\n"
            f"Supported: {', '.join(MIME_MAP.keys())}"
        )
        raise typer.Exit(1)

    file_name = os.path.basename(file_path)
    console.print(f"⬆️  Uploading [bold]{file_name}[/bold] to session [cyan]{session_id}[/cyan]...")

    with open(file_path, "rb") as f:
        r = requests.post(
            f"{NEXT_URL}/api/upload",
            files={"file": (file_name, f, mime)},
            data={"sessionId": session_id},
            timeout=60,
        )
    data = r.json()

    if data.get("success"):
        file_info = data["data"]
        console.print(f"[green]✅ Upload successful — processing in background[/green]")
        console.print(f"   File ID: [dim]{file_info['id']}[/dim]")
        console.print(f"   Status:  [yellow]{file_info['status']}[/yellow]")
        console.print("\n[dim]Wait a moment, then start asking questions.[/dim]")
    else:
        console.print(f"[red]❌ Upload failed: {data.get('error')}[/red]")
        raise typer.Exit(1)


@app.command()
def ask(
    session_id: str = typer.Argument(..., help="Session ID to query"),
    question: str = typer.Argument(..., help="Question to ask the agent"),
):
    """Ask a one-shot question to the agent."""
    if not check_service():
        raise typer.Exit(1)

    console.print(f"\n[bold]You:[/bold] {question}")
    ask_agent_stream(session_id, question)


@app.command()
def chat(
    session_id: Optional[str] = typer.Option(
        None, "--session", "-s", help="Session ID to use (creates new session if omitted)"
    ),
    name: str = typer.Option("CLI Session", "--name", "-n", help="Name for a new session"),
):
    """
    Start an interactive chat session with the Datrixs agent.

    If no --session is provided, a new session is created automatically.
    Type 'exit' or 'quit' to end the session.
    Type 'upload <path>' to upload a file during the conversation.
    Type 'sessions' to list all sessions.
    """
    if not check_service():
        raise typer.Exit(1)

    console.print(
        Panel.fit(
            "[bold cyan]🤖 Datrixs CLI[/bold cyan]\n"
            "[dim]AI-powered data analysis agent[/dim]\n\n"
            "Commands:\n"
            "  [bold]upload <file_path>[/bold]  — upload a data file\n"
            "  [bold]sessions[/bold]            — list sessions\n"
            "  [bold]exit[/bold] / [bold]quit[/bold]           — end session",
            title="Welcome",
        )
    )

    # Resolve or create session
    if session_id:
        console.print(f"Using session: [cyan]{session_id}[/cyan]")
    else:
        data = api_post("/api/sessions", json={"name": name})
        if not data.get("success"):
            console.print(f"[red]Failed to create session: {data.get('error')}[/red]")
            raise typer.Exit(1)
        session_id = data["data"]["id"]
        console.print(
            f"[green]✅ New session created:[/green] [bold]{name}[/bold]\n"
            f"   ID: [cyan]{session_id}[/cyan]\n"
        )

    console.print(
        "[dim]Upload a file first, then ask questions about your data.[/dim]\n"
    )

    while True:
        try:
            user_input = Prompt.ask("[bold green]You[/bold green]").strip()
        except (KeyboardInterrupt, EOFError):
            console.print("\n[dim]Goodbye![/dim]")
            break

        if not user_input:
            continue

        if user_input.lower() in ("exit", "quit"):
            console.print("[dim]Goodbye![/dim]")
            break

        if user_input.lower() == "sessions":
            data = api_get("/api/sessions")
            for s in data.get("data", []):
                console.print(f"  [cyan]{s['id']}[/cyan]  {s['name']}  (files: {s.get('fileCount', 0)})")
            continue

        if user_input.lower().startswith("upload "):
            path = user_input[7:].strip()
            if not os.path.exists(path):
                console.print(f"[red]File not found: {path}[/red]")
                continue
            ext = os.path.splitext(path)[1].lower()
            mime = MIME_MAP.get(ext)
            if not mime:
                console.print(f"[red]Unsupported file type: {ext}[/red]")
                continue
            file_name = os.path.basename(path)
            with open(path, "rb") as f:
                r = requests.post(
                    f"{NEXT_URL}/api/upload",
                    files={"file": (file_name, f, mime)},
                    data={"sessionId": session_id},
                    timeout=60,
                )
            resp = r.json()
            if resp.get("success"):
                console.print(
                    f"[green]✅ {file_name} uploaded[/green] — processing in background.\n"
                    "[dim]Wait a few seconds before asking questions.[/dim]"
                )
            else:
                console.print(f"[red]❌ Upload failed: {resp.get('error')}[/red]")
            continue

        # Regular question — stream response
        ask_agent_stream(session_id, user_input)
        print()


if __name__ == "__main__":
    app()
