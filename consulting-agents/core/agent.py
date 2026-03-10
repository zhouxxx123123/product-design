"""
Agent definition parser and registry.
Handles loading, parsing, and managing agent definitions from Markdown files.
"""

import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Any
import yaml

from core.models import AgentDefinition, AgentRole
from core.storage import HybridStorage


class AgentRegistry:
    """
    Manages agent definitions and provides dynamic loading capabilities.
    """

    def __init__(self, storage: Optional[HybridStorage] = None):
        self.storage = storage or HybridStorage()
        self._agents: Dict[str, AgentDefinition] = {}
        self._loaded = False

    def load_all_agents(self, agents_dir: Optional[str] = None) -> Dict[str, AgentDefinition]:
        """
        Load all agent definitions from the agents directory.
        """
        if agents_dir is None:
            # Default to .claude/agents relative to project root
            # core/agent.py -> core/ -> consulting-agents/ -> .claude/agents
            agents_dir = Path(__file__).parent.parent / '.claude' / 'agents'
        else:
            agents_dir = Path(agents_dir)

        self._agents = {}

        if not agents_dir.exists():
            print(f"Warning: Agents directory not found: {agents_dir}")
            return self._agents

        # Load all .md files
        for agent_file in agents_dir.glob("*.md"):
            try:
                agent_def = self.load_agent_from_file(agent_file)
                self._agents[agent_def.name] = agent_def
            except Exception as e:
                print(f"Error loading agent {agent_file}: {e}")

        self._loaded = True
        return self._agents

    def load_agent_from_file(self, file_path: Path) -> AgentDefinition:
        """Load an agent definition from a Markdown file."""
        content = file_path.read_text(encoding='utf-8')
        return AgentDefinition.from_markdown(content, file_path.name)

    def get_agent(self, name: str) -> Optional[AgentDefinition]:
        """Get an agent definition by name."""
        if not self._loaded:
            self.load_all_agents()
        return self._agents.get(name)

    def get_agent_by_role(self, role: AgentRole) -> List[AgentDefinition]:
        """Get all agents with a specific role."""
        if not self._loaded:
            self.load_all_agents()
        return [a for a in self._agents.values() if a.role == role]

    def list_agents(self) -> List[AgentDefinition]:
        """List all loaded agent definitions."""
        if not self._loaded:
            self.load_all_agents()
        return list(self._agents.values())

    def reload_agent(self, name: str) -> Optional[AgentDefinition]:
        """Reload a single agent definition."""
        agents_dir = Path(__file__).parent.parent / '.claude' / 'agents'
        agent_file = agents_dir / f"{self._get_file_name(name)}.md"

        if agent_file.exists():
            try:
                agent_def = self.load_agent_from_file(agent_file)
                self._agents[name] = agent_def
                return agent_def
            except Exception as e:
                print(f"Error reloading agent {name}: {e}")

        return None

    def _get_file_name(self, agent_name: str) -> str:
        """Convert agent name to file name."""
        # Map special names to file names
        name_map = {
            '(◆_◆) strategy-consultant': 'strategy-consultant',
            '(📊) data-analyst': 'data-analyst',
            '(🏦) industry-expert': 'industry-expert',
            '(⚡) devils-advocate': 'devils-advocate',
            '(📝) executive-summarizer': 'executive-summarizer',
            '(👔) client-stakeholder': 'client-stakeholder',
        }

        if agent_name in name_map:
            return name_map[agent_name]

        # Remove emoji and special characters
        clean_name = re.sub(r'[^\w\s-]', '', agent_name)
        return clean_name.strip().lower().replace(' ', '-')

    def create_agent(
        self,
        name: str,
        description: str,
        system_prompt: str,
        tools: List[str] = None,
        role: AgentRole = AgentRole.CUSTOM,
        color: str = "blue"
    ) -> AgentDefinition:
        """Create a new agent definition."""
        agent_def = AgentDefinition(
            name=name,
            description=description,
            system_prompt=system_prompt,
            tools=tools or [],
            role=role,
            color=color
        )

        # Save to file
        self._save_agent_file(agent_def)

        # Add to registry
        self._agents[name] = agent_def

        return agent_def

    def update_agent(self, name: str, **updates) -> Optional[AgentDefinition]:
        """Update an existing agent definition."""
        agent = self.get_agent(name)
        if agent is None:
            return None

        # Apply updates
        for key, value in updates.items():
            if hasattr(agent, key):
                setattr(agent, key, value)

        agent.updated_at = __import__('datetime').datetime.utcnow()

        # Save to file
        self._save_agent_file(agent)

        return agent

    def _save_agent_file(self, agent_def: AgentDefinition) -> None:
        """Save agent definition to a Markdown file."""
        agents_dir = Path(__file__).parent.parent / '.claude' / 'agents'
        agents_dir.mkdir(parents=True, exist_ok=True)

        file_name = self._get_file_name(agent_def.name)
        file_path = agents_dir / f"{file_name}.md"

        content = agent_def.to_markdown()
        file_path.write_text(content, encoding='utf-8')

    def delete_agent(self, name: str) -> bool:
        """Delete an agent definition."""
        if name not in self._agents:
            return False

        # Remove from registry
        del self._agents[name]

        # Delete file
        file_name = self._get_file_name(name)
        agents_dir = Path(__file__).parent.parent / '.claude' / 'agents'
        file_path = agents_dir / f"{file_name}.md"

        if file_path.exists():
            file_path.unlink()

        return True

    def get_builtin_agents(self) -> List[AgentDefinition]:
        """Get the 6 built-in consulting agents."""
        builtin_names = [
            '(◆_◆) strategy-consultant',
            '(📊) data-analyst',
            '(🏦) industry-expert',
            '(⚡) devils-advocate',
            '(📝) executive-summarizer',
            '(👔) client-stakeholder',
        ]

        agents = []
        for name in builtin_names:
            agent = self.get_agent(name)
            if agent:
                agents.append(agent)

        return agents


class AgentParser:
    """
    Parses agent definitions from various formats.
    """

    @staticmethod
    def parse_frontmatter(content: str) -> tuple[Dict[str, Any], str]:
        """
        Parse YAML frontmatter from markdown content.
        Returns (frontmatter_dict, body_content).
        """
        pattern = r'^---\s*\n(.*?)\n---\s*\n(.*)$'
        match = re.match(pattern, content, re.DOTALL)

        if match:
            try:
                frontmatter = yaml.safe_load(match.group(1)) or {}
            except yaml.YAMLError:
                frontmatter = {}
            body = match.group(2)
        else:
            frontmatter = {}
            body = content

        return frontmatter, body

    @staticmethod
    def generate_frontmatter(data: Dict[str, Any]) -> str:
        """Generate YAML frontmatter from a dictionary."""
        return yaml.dump(data, default_flow_style=False, allow_unicode=True)

    @staticmethod
    def extract_tools_from_prompt(prompt: str) -> List[str]:
        """Extract tool mentions from a system prompt."""
        tools = []
        tool_patterns = [
            r'Read', r'Grep', r'Glob', r'Bash', r'Agent',
            r'WebSearch', r'WebFetch', r'Edit', r'Write'
        ]

        for pattern in tool_patterns:
            if re.search(rf'\b{pattern}\b', prompt):
                tools.append(pattern)

        return tools

    @staticmethod
    def validate_agent_definition(agent_def: AgentDefinition) -> List[str]:
        """Validate an agent definition and return any errors."""
        errors = []

        if not agent_def.name:
            errors.append("Agent name is required")

        if not agent_def.description:
            errors.append("Agent description is required")

        if not agent_def.system_prompt:
            errors.append("System prompt is required")

        if len(agent_def.system_prompt) < 100:
            errors.append("System prompt seems too short")

        return errors
