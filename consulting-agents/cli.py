#!/usr/bin/env python3
"""
CLI tool for the Multi-Agent Collaboration Platform.
Provides commands for starting debates, managing agents, and viewing history.
"""

import argparse
import sys
import json
from datetime import datetime
from typing import Optional
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent))

try:
    from core.agent import AgentRegistry
    from core.debate import DebateCoordinator, AutonomousDebate, DebateFormatter
    from core.evolution import EvolutionManager
    from core.storage import HybridStorage
    from core.models import DebateMode, DebateStatus
except ImportError as e:
    print(f"Error importing modules: {e}")
    print("Make sure you're running from the consulting-agents directory.")
    sys.exit(1)


def print_header(title: str):
    """Print a formatted header."""
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60 + "\n")


def print_agent_card(agent):
    """Print a formatted agent card."""
    print(f"  {agent.name}")
    print(f"    Description: {agent.description[:60]}..." if len(agent.description) > 60 else f"    Description: {agent.description}")
    print(f"    Tools: {', '.join(agent.tools[:5])}{'...' if len(agent.tools) > 5 else ''}")
    print(f"    Version: {agent.version}")
    print()


def cmd_list_agents(args):
    """List all available agents."""
    print_header("AVAILABLE AGENTS")

    registry = AgentRegistry()
    agents = registry.load_all_agents()

    # Show built-in agents first
    builtin = registry.get_builtin_agents()
    if builtin:
        print("Built-in Consulting Agents:")
        print("-" * 40)
        for agent in builtin:
            print_agent_card(agent)

    # Show custom agents
    custom = [a for a in agents.values() if a not in builtin]
    if custom:
        print("\nCustom Agents:")
        print("-" * 40)
        for agent in custom:
            print_agent_card(agent)

    print(f"Total: {len(agents)} agents")


def cmd_show_agent(args):
    """Show detailed information about an agent."""
    registry = AgentRegistry()
    agent = registry.get_agent(args.name)

    if agent is None:
        # Try partial matching
        agents = registry.load_all_agents()
        matches = [a for a in agents.values() if args.name.lower() in a.name.lower()]

        if len(matches) == 1:
            agent = matches[0]
        elif len(matches) > 1:
            print(f"Multiple matches found for '{args.name}':")
            for m in matches:
                print(f"  - {m.name}")
            return
        else:
            print(f"Agent '{args.name}' not found.")
            return

    print_header(f"AGENT: {agent.name}")
    print(f"Description:\n  {agent.description}\n")
    print(f"Tools: {', '.join(agent.tools)}")
    print(f"Model: {agent.model}")
    print(f"Version: {agent.version}")

    if args.show_prompt:
        print("\n" + "-" * 40)
        print("System Prompt:")
        print("-" * 40)
        print(agent.system_prompt[:1000])
        if len(agent.system_prompt) > 1000:
            print(f"\n... ({len(agent.system_prompt) - 1000} more characters)")


def cmd_start_debate(args):
    """Start a new debate session."""
    print_header("STARTING DEBATE SESSION")

    storage = HybridStorage()
    coordinator = DebateCoordinator(storage)
    registry = AgentRegistry(storage)

    # Load agents
    registry.load_all_agents()

    # Resolve agent names to IDs
    agent_ids = []
    for name in args.agents:
        agent = registry.get_agent(name)
        if agent:
            agent_ids.append(agent.name)
        else:
            # Try to find by partial match
            agents = registry.list_agents()
            matches = [a for a in agents if name.lower() in a.name.lower()]
            if matches:
                agent_ids.append(matches[0].name)
            else:
                print(f"Warning: Agent '{name}' not found, skipping.")

    if len(agent_ids) < 2:
        print("Error: At least 2 agents are required for a debate.")
        print(f"Available agents: {', '.join(a.name for a in registry.list_agents())}")
        return

    # Create session
    mode = DebateMode(args.mode)
    session = coordinator.create_session(
        topic=args.topic,
        description=args.description or "",
        agent_ids=agent_ids,
        mode=mode,
        max_rounds=args.max_rounds
    )

    print(f"Created debate session: {session.id}")
    print(f"Topic: {session.topic}")
    print(f"Mode: {session.mode.value}")
    print(f"Agents: {', '.join(agent_ids)}")
    print(f"Max rounds: {session.max_rounds}")

    if args.start:
        coordinator.start_session(session.id)
        print(f"\nSession started!")
        print(f"Session ID: {session.id}")
        print("\nUse this ID to add messages or view the debate:")
        print(f"  python cli.py view-debate {session.id}")


def cmd_list_debates(args):
    """List debate sessions."""
    print_header("DEBATE SESSIONS")

    storage = HybridStorage()
    coordinator = DebateCoordinator(storage)

    status_filter = None
    if args.status:
        status_filter = DebateStatus(args.status)

    sessions = coordinator.list_sessions(status=status_filter, limit=args.limit)

    if not sessions:
        print("No debate sessions found.")
        return

    print(f"{'ID':<10} {'Status':<12} {'Mode':<18} {'Topic':<30}")
    print("-" * 70)

    for session in sessions:
        topic = session.topic[:27] + "..." if len(session.topic) > 30 else session.topic
        print(f"{session.id:<10} {session.status.value:<12} {session.mode.value:<18} {topic}")

    print(f"\nTotal: {len(sessions)} sessions")


def cmd_view_debate(args):
    """View a debate session."""
    storage = HybridStorage()
    coordinator = DebateCoordinator(storage)

    history = coordinator.get_session_history(args.session_id)

    if not history:
        print(f"Session '{args.session_id}' not found.")
        return

    if args.json:
        print(json.dumps(history, indent=2, default=str))
        return

    # Terminal format
    print(DebateFormatter.format_for_terminal(args.session_id, coordinator))


def cmd_add_message(args):
    """Add a message to a debate session."""
    storage = HybridStorage()
    coordinator = DebateCoordinator(storage)
    registry = AgentRegistry(storage)

    session = coordinator._get_session(args.session_id)
    if session is None:
        print(f"Session '{args.session_id}' not found.")
        return

    # Resolve agent name
    agent = registry.get_agent(args.agent)
    if agent is None:
        print(f"Agent '{args.agent}' not found.")
        return

    # Add message
    message = coordinator.record_message(
        session_id=args.session_id,
        agent_id=agent.name,
        content=args.message,
        message_type=args.type
    )

    print(f"Message added: {message.id}")
    print(f"Round: {message.round_number}")


def cmd_next_round(args):
    """Advance to the next round."""
    storage = HybridStorage()
    coordinator = DebateCoordinator(storage)

    session = coordinator.advance_round(args.session_id)
    if session:
        print(f"Advanced to round {session.current_round}")
    else:
        print(f"Session '{args.session_id}' not found.")


def cmd_complete_debate(args):
    """Complete a debate session."""
    storage = HybridStorage()
    coordinator = DebateCoordinator(storage)

    session = coordinator.complete_session(
        args.session_id,
        consensus_summary=args.summary or "",
        force=args.force
    )

    if session:
        print(f"Session {args.session_id} completed.")
        if session.consensus_summary:
            print("\nConsensus Summary:")
            print(session.consensus_summary)
    else:
        print(f"Session '{args.session_id}' not found.")


def cmd_evolution_status(args):
    """Check evolution status for an agent."""
    storage = HybridStorage()
    manager = EvolutionManager(storage)
    registry = AgentRegistry(storage)

    agent = registry.get_agent(args.agent)
    if agent is None:
        print(f"Agent '{args.agent}' not found.")
        return

    print_header(f"EVOLUTION STATUS: {agent.name}")

    # Show version history
    print(f"Current Version: {agent.version}")
    print(f"Evolution History:")
    for entry in agent.evolution_history:
        print(f"  {entry.get('version', 'unknown')} - {entry.get('change', 'No description')}")

    # Show pending proposals
    pending = manager.get_pending_proposals(agent.name)
    if pending:
        print(f"\nPending Proposals ({len(pending)}):")
        for prop in pending:
            print(f"  - {prop.proposal_type}: {prop.description[:50]}...")
    else:
        print("\nNo pending evolution proposals.")


def cmd_audit_log(args):
    """View audit log."""
    storage = HybridStorage()

    print_header("AUDIT LOG")

    filters = {}
    if args.action:
        filters['action'] = args.action
    if args.actor:
        filters['actor'] = args.actor

    logs = storage.query('audit_logs', filters)
    logs = logs[-args.limit:] if len(logs) > args.limit else logs

    if not logs:
        print("No audit logs found.")
        return

    for log in logs:
        timestamp = log.get('timestamp', 'unknown')
        action = log.get('action', 'unknown')
        actor = log.get('actor', 'unknown')
        target = f"{log.get('target_type', 'unknown')}:{log.get('target_id', 'unknown')}"
        print(f"[{timestamp}] {action:<25} by {actor:<15} on {target}")


def main():
    parser = argparse.ArgumentParser(
        description="Multi-Agent Collaboration Platform CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List all agents
  python cli.py list-agents

  # Show agent details
  python cli.py show-agent "strategy-consultant"

  # Start a debate
  python cli.py start-debate "Market Entry Strategy" --agents strategy-consultant devils-advocate --start

  # View debate
  python cli.py view-debate <session-id>

  # Add message to debate
  python cli.py add-message <session-id> strategy-consultant "My analysis shows..."
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='Available commands')

    # List agents
    list_agents_parser = subparsers.add_parser('list-agents', help='List all agents')
    list_agents_parser.set_defaults(func=cmd_list_agents)

    # Show agent
    show_agent_parser = subparsers.add_parser('show-agent', help='Show agent details')
    show_agent_parser.add_argument('name', help='Agent name')
    show_agent_parser.add_argument('--show-prompt', action='store_true', help='Show full system prompt')
    show_agent_parser.set_defaults(func=cmd_show_agent)

    # Start debate
    start_debate_parser = subparsers.add_parser('start-debate', help='Start a debate session')
    start_debate_parser.add_argument('topic', help='Debate topic')
    start_debate_parser.add_argument('--agents', nargs='+', required=True, help='Agent names to participate')
    start_debate_parser.add_argument('--description', help='Session description')
    start_debate_parser.add_argument('--mode', choices=['human_orchestrated', 'semi_autonomous', 'fully_autonomous'],
                                     default='semi_autonomous', help='Debate mode')
    start_debate_parser.add_argument('--max-rounds', type=int, default=10, help='Maximum rounds')
    start_debate_parser.add_argument('--start', action='store_true', help='Start the session immediately')
    start_debate_parser.set_defaults(func=cmd_start_debate)

    # List debates
    list_debates_parser = subparsers.add_parser('list-debates', help='List debate sessions')
    list_debates_parser.add_argument('--status', choices=['pending', 'active', 'converging', 'completed', 'paused', 'aborted'],
                                    help='Filter by status')
    list_debates_parser.add_argument('--limit', type=int, default=50, help='Maximum to show')
    list_debates_parser.set_defaults(func=cmd_list_debates)

    # View debate
    view_debate_parser = subparsers.add_parser('view-debate', help='View debate session')
    view_debate_parser.add_argument('session_id', help='Session ID')
    view_debate_parser.add_argument('--json', action='store_true', help='Output as JSON')
    view_debate_parser.set_defaults(func=cmd_view_debate)

    # Add message
    add_message_parser = subparsers.add_parser('add-message', help='Add message to debate')
    add_message_parser.add_argument('session_id', help='Session ID')
    add_message_parser.add_argument('agent', help='Agent name')
    add_message_parser.add_argument('message', help='Message content')
    add_message_parser.add_argument('--type', default='statement', choices=['statement', 'question', 'response', 'consensus_check'])
    add_message_parser.set_defaults(func=cmd_add_message)

    # Next round
    next_round_parser = subparsers.add_parser('next-round', help='Advance to next round')
    next_round_parser.add_argument('session_id', help='Session ID')
    next_round_parser.set_defaults(func=cmd_next_round)

    # Complete debate
    complete_parser = subparsers.add_parser('complete-debate', help='Complete a debate')
    complete_parser.add_argument('session_id', help='Session ID')
    complete_parser.add_argument('--summary', help='Consensus summary')
    complete_parser.add_argument('--force', action='store_true', help='Force completion')
    complete_parser.set_defaults(func=cmd_complete_debate)

    # Evolution status
    evolution_parser = subparsers.add_parser('evolution-status', help='Check agent evolution status')
    evolution_parser.add_argument('agent', help='Agent name')
    evolution_parser.set_defaults(func=cmd_evolution_status)

    # Audit log
    audit_parser = subparsers.add_parser('audit-log', help='View audit log')
    audit_parser.add_argument('--action', help='Filter by action')
    audit_parser.add_argument('--actor', help='Filter by actor')
    audit_parser.add_argument('--limit', type=int, default=50, help='Maximum to show')
    audit_parser.set_defaults(func=cmd_audit_log)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        sys.exit(1)

    args.func(args)


if __name__ == '__main__':
    main()
