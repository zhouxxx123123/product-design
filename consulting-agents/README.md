# Multi-Agent Collaboration Platform

An enterprise-grade multi-agent collaboration platform for AI-powered consulting.

## Features

- **Multi-Agent Debates**: Enable AI agents to collaborate through structured debates
- **Self-Evolution**: Agents learn and improve from interactions
- **Human-in-the-Loop**: Multiple interaction modes from fully human-controlled to autonomous
- **Enterprise Security**: Audit logging, approval workflows, and version control
- **Dual Storage**: Local file storage + PostgreSQL with bidirectional sync

## Quick Start

### 1. Start PostgreSQL

```bash
docker-compose up -d postgres
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. List Available Agents

```bash
python cli.py list-agents
```

### 4. Start a Debate

```bash
python cli.py start-debate "Market Entry Strategy" \
  --agents "strategy-consultant" "devils-advocate" "data-analyst" \
  --mode semi_autonomous \
  --start
```

### 5. View Debate

```bash
python cli.py view-debate <session-id>
```

## CLI Commands

### Agent Management
- `list-agents` - List all available agents
- `show-agent <name>` - Show agent details

### Debate Management
- `start-debate <topic>` - Create a new debate session
- `list-debates` - List debate sessions
- `view-debate <session-id>` - View debate history
- `add-message <session-id> <agent> <message>` - Add message
- `next-round <session-id>` - Advance to next round
- `complete-debate <session-id>` - Complete debate

### Evolution
- `evolution-status <agent>` - Check agent evolution status

### Audit
- `audit-log` - View audit log

## Architecture

```
consulting-agents/
├── .claude/agents/       # Agent definitions (Markdown + Frontmatter)
├── core/                  # Core framework
│   ├── agent.py          # Agent registry and parser
│   ├── debate.py         # Debate coordination
│   ├── evolution.py      # Evolution management
│   ├── models/           # Data models
│   └── storage/          # Storage layer
├── config/               # Configuration files
├── cli.py                # Command-line interface
└── docker-compose.yml    # PostgreSQL setup
```

## Agent Definition Format

Agents are defined in Markdown with YAML frontmatter:

```markdown
---
name: (◆_◆) strategy-consultant
description: Strategic analysis specialist
tools: [Read, Grep, Glob, Bash, Agent]
color: navy
version: 1.0.0
---

# Strategy Consultant

You are a seasoned management consultant...
```

## Configuration

Edit `config/settings.yaml` to customize:
- Storage preferences
- Debate settings
- Evolution thresholds
- Security policies

## Development

### Running Tests

```bash
python -m pytest tests/
```

### Database Management

With Adminer (database UI):
```bash
docker-compose --profile admin up -d
# Open http://localhost:8080
```

## License

MIT
