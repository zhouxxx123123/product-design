"""
Multi-Agent Collaboration Platform - Core Module

This module provides the core functionality for the evolutionary multi-agent
consulting platform, including:

- Storage layer (local + PostgreSQL with bidirectional sync)
- Agent definition parsing and registry
- Debate coordination system
- Evolution management
"""

__version__ = "0.1.0"

from core.agent import AgentRegistry, AgentParser
from core.debate import DebateCoordinator, AutonomousDebate, DebateFormatter
from core.evolution import EvolutionManager, EvolutionTrigger, MetaAgentReviewer
from core.storage import (
    HybridStorage,
    LocalStorage,
    PostgresStorage,
    SyncManager
)
from core.models import (
    AgentDefinition,
    DebateSession,
    DebateMessage,
    DebateStatus,
    DebateMode,
    EvolutionProposal,
    EvolutionStatus,
    AgentMemory,
    SpeakingSchedule
)

__all__ = [
    # Version
    '__version__',

    # Core classes
    'AgentRegistry',
    'AgentParser',
    'DebateCoordinator',
    'AutonomousDebate',
    'DebateFormatter',
    'EvolutionManager',
    'EvolutionTrigger',
    'MetaAgentReviewer',

    # Storage
    'HybridStorage',
    'LocalStorage',
    'PostgresStorage',
    'SyncManager',

    # Models
    'AgentDefinition',
    'DebateSession',
    'DebateMessage',
    'DebateStatus',
    'DebateMode',
    'EvolutionProposal',
    'EvolutionStatus',
    'AgentMemory',
    'SpeakingSchedule',
]
