"""
Data models for the multi-agent collaboration platform.
Uses Pydantic for validation and serialization.
"""

from datetime import datetime
from typing import Any, Dict, List, Optional, Literal
from enum import Enum
import uuid

try:
    from pydantic import BaseModel, Field, field_validator
except ImportError:
    # Fallback if pydantic is not installed
    class BaseModel:
        def __init__(self, **data):
            for key, value in data.items():
                setattr(self, key, value)

        def dict(self):
            return self.__dict__

        def model_dump(self):
            return self.__dict__

    def Field(default=None, **kwargs):
        return default


def generate_id() -> str:
    """Generate a unique ID"""
    return str(uuid.uuid4())[:8]


class AgentRole(str, Enum):
    """Agent roles in the system"""
    STRATEGY_CONSULTANT = "strategy_consultant"
    DATA_ANALYST = "data_analyst"
    INDUSTRY_EXPERT = "industry_expert"
    DEVILS_ADVOCATE = "devils_advocate"
    EXECUTIVE_SUMMARIZER = "executive_summarizer"
    CLIENT_STAKEHOLDER = "client_stakeholder"
    META_EVOLUTION = "meta_evolution"
    META_QUALITY = "meta_quality"
    META_CONSENSUS = "meta_consensus"
    CUSTOM = "custom"


class DebateMode(str, Enum):
    """Debate interaction modes"""
    HUMAN_ORCHESTRATED = "human_orchestrated"  # Mode A: Human controls
    SEMI_AUTONOMOUS = "semi_autonomous"        # Mode B: System recommends
    FULLY_AUTONOMOUS = "fully_autonomous"      # Mode C: Agents decide


class DebateStatus(str, Enum):
    """Debate session status"""
    PENDING = "pending"           # Created but not started
    ACTIVE = "active"             # Ongoing debate
    CONVERGING = "converging"     # Nearing consensus
    COMPLETED = "completed"       # Finished
    PAUSED = "paused"             # Temporarily paused
    ABORTED = "aborted"           # Cancelled


class EvolutionStatus(str, Enum):
    """Evolution proposal status"""
    PROPOSED = "proposed"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    APPLIED = "applied"
    ROLLED_BACK = "rolled_back"


class AgentDefinition(BaseModel):
    """
    Structured representation of an agent definition.
    Parsed from Markdown + Frontmatter format.
    """
    id: str = Field(default_factory=generate_id)
    name: str
    display_name: str = ""
    description: str
    role: AgentRole = AgentRole.CUSTOM
    tools: List[str] = Field(default_factory=list)
    model: str = "inherit"
    color: str = "blue"
    version: str = "1.0.0"
    system_prompt: str = ""  # The markdown content
    evolution_history: List[Dict[str, Any]] = Field(default_factory=list)
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    def __init__(self, **data):
        super().__init__(**data)
        if not self.display_name:
            self.display_name = self.name

    def to_markdown(self) -> str:
        """Convert to Markdown + Frontmatter format"""
        import yaml

        frontmatter = {
            'name': self.name,
            'description': self.description,
            'tools': self.tools,
            'model': self.model,
            'color': self.color,
            'version': self.version,
            'evolution_history': self.evolution_history,
        }

        yaml_content = yaml.dump(
            frontmatter,
            default_flow_style=False,
            allow_unicode=True
        )

        return f"---\n{yaml_content}---\n\n{self.system_prompt}"

    @classmethod
    def from_markdown(cls, content: str, file_name: str = "") -> "AgentDefinition":
        """Parse from Markdown + Frontmatter"""
        import yaml
        import re

        # Parse frontmatter
        match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)$', content, re.DOTALL)

        if match:
            frontmatter_text = match.group(1)
            body = match.group(2)
            frontmatter = yaml.safe_load(frontmatter_text) or {}
        else:
            frontmatter = {}
            body = content

        # Extract name from file_name if not in frontmatter
        name = frontmatter.get('name', file_name.replace('.md', ''))

        # Handle tools - can be a list or a comma-separated string
        tools = frontmatter.get('tools', [])
        if isinstance(tools, str):
            tools = [t.strip() for t in tools.split(',')]

        return cls(
            name=name,
            display_name=name,
            description=frontmatter.get('description', ''),
            tools=tools,
            model=frontmatter.get('model', 'inherit'),
            color=frontmatter.get('color', 'blue'),
            version=frontmatter.get('version', '1.0.0'),
            system_prompt=body,
            evolution_history=frontmatter.get('evolution_history', []),
        )


class DebateSession(BaseModel):
    """
    Represents a debate session between multiple agents.
    """
    id: str = Field(default_factory=generate_id)
    topic: str
    description: str = ""
    mode: DebateMode = DebateMode.SEMI_AUTONOMOUS
    status: DebateStatus = DebateStatus.PENDING
    max_rounds: int = 10
    current_round: int = 0
    agent_ids: List[str] = Field(default_factory=list)
    created_by: str = "user"  # user ID or system
    created_at: datetime = Field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

    # Topic tracking
    current_topic: str = ""
    topic_history: List[Dict[str, Any]] = Field(default_factory=list)

    # Convergence tracking
    consensus_reached: bool = False
    consensus_summary: str = ""
    divergence_points: List[str] = Field(default_factory=list)


class DebateMessage(BaseModel):
    """
    A single message in a debate.
    """
    id: str = Field(default_factory=generate_id)
    session_id: str
    agent_id: str
    agent_name: str = ""
    round_number: int
    message_type: Literal["statement", "question", "response", "consensus_check", "topic_shift"] = "statement"
    content: str
    references_to: List[str] = Field(default_factory=list)  # IDs of messages referenced
    sentiment: Optional[str] = None  # positive, negative, neutral
    importance_score: float = 0.5  # 0.0 to 1.0
    created_at: datetime = Field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = Field(default_factory=dict)


class AgentMemory(BaseModel):
    """
    Long-term memory for an agent.
    Stores experiences, lessons learned, and effective strategies.
    """
    id: str = Field(default_factory=generate_id)
    agent_id: str
    memory_type: Literal["experience", "lesson", "strategy", "collaboration", "feedback"] = "experience"
    content: str
    tags: List[str] = Field(default_factory=list)
    context: Dict[str, Any] = Field(default_factory=dict)  # When/where this memory was formed
    effectiveness_score: float = 0.5  # How effective was this
    usage_count: int = 0  # How many times this memory was used
    last_accessed: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class EvolutionProposal(BaseModel):
    """
    A proposed evolution/change to an agent.
    """
    id: str = Field(default_factory=generate_id)
    agent_id: str
    agent_name: str = ""
    proposal_type: Literal["prompt_optimization", "memory_update", "strategy_learning", "tool_usage"] = "prompt_optimization"
    trigger: Literal["realtime", "task_completion", "human_feedback", "peer_review"] = "task_completion"
    description: str
    changes: Dict[str, Any]  # Specific changes proposed
    rationale: str  # Why this change is beneficial
    expected_improvements: List[str] = Field(default_factory=list)
    status: EvolutionStatus = EvolutionStatus.PROPOSED
    proposed_by: str = ""  # Agent ID or user
    proposed_at: datetime = Field(default_factory=datetime.utcnow)
    reviewed_by: List[str] = Field(default_factory=list)
    review_comments: List[Dict[str, Any]] = Field(default_factory=list)
    applied_at: Optional[datetime] = None
    applied_version: str = ""
    rollback_version: str = ""  # Version to rollback to if needed
    test_results: Optional[Dict[str, Any]] = None


class AuditLog(BaseModel):
    """
    Audit log for tracking system actions.
    """
    id: str = Field(default_factory=generate_id)
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    action: str  # e.g., 'agent_created', 'debate_started', 'evolution_applied'
    actor: str  # user or agent ID
    actor_type: Literal["user", "agent", "system"] = "system"
    target_type: str  # e.g., 'agent', 'session', 'evolution'
    target_id: str
    details: Dict[str, Any] = Field(default_factory=dict)
    ip_address: Optional[str] = None
    session_id: Optional[str] = None


class AgentPerformance(BaseModel):
    """
    Performance metrics for an agent.
    """
    agent_id: str
    period_start: datetime
    period_end: datetime
    total_sessions: int = 0
    total_messages: int = 0
    avg_message_length: float = 0.0
    consensus_contributions: int = 0  # Times agent helped reach consensus
    effectiveness_score: float = 0.0  # Aggregated score
    collaboration_score: float = 0.0  # How well agent works with others
    feedback_scores: List[float] = Field(default_factory=list)
    improvement_trends: Dict[str, Any] = Field(default_factory=dict)


class SpeakingSchedule(BaseModel):
    """
    Tracks the speaking schedule for a debate.
    """
    session_id: str
    current_turn_index: int = 0
    turn_order: List[str] = Field(default_factory=list)  # Agent IDs in order
    mode: Literal["round_robin", "response_triggered", "priority_based"] = "round_robin"
    last_speaker: Optional[str] = None
    speaker_history: List[Dict[str, Any]] = Field(default_factory=list)  # Who spoke when
    pending_responses: List[str] = Field(default_factory=list)  # Agents who need to respond

    def get_next_speaker(self) -> Optional[str]:
        """Get the next agent who should speak"""
        if not self.turn_order:
            return None

        if self.mode == "round_robin":
            speaker = self.turn_order[self.current_turn_index % len(self.turn_order)]
            self.current_turn_index += 1
            return speaker
        elif self.mode == "response_triggered":
            # Return first pending responder, or next in round robin
            if self.pending_responses:
                return self.pending_responses.pop(0)
            speaker = self.turn_order[self.current_turn_index % len(self.turn_order)]
            self.current_turn_index += 1
            return speaker

        return None

    def request_response(self, agent_id: str) -> None:
        """Request a specific agent to respond"""
        if agent_id not in self.pending_responses:
            self.pending_responses.append(agent_id)

    def record_speaking(self, agent_id: str) -> None:
        """Record that an agent has spoken"""
        self.last_speaker = agent_id
        self.speaker_history.append({
            'agent_id': agent_id,
            'timestamp': datetime.utcnow().isoformat(),
            'turn_number': len(self.speaker_history) + 1
        })
