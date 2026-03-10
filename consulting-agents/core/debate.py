"""
Debate system for multi-agent collaboration.
Implements session state machine, speaking scheduler, and topic tracking.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
import json

from core.models import (
    DebateSession, DebateMessage, DebateStatus, DebateMode,
    SpeakingSchedule, AgentDefinition
)
from core.storage import HybridStorage


class DebateEvent(Enum):
    """Events that can trigger state transitions"""
    START = "start"
    PAUSE = "pause"
    RESUME = "resume"
    NEXT_TURN = "next_turn"
    CONSENSUS_DETECTED = "consensus_detected"
    DIVERGENCE_DETECTED = "divergence_detected"
    COMPLETE = "complete"
    ABORT = "abort"


class DebateCoordinator:
    """
    Manages debate sessions between multiple agents.
    Implements the session state machine and coordination logic.
    """

    def __init__(self, storage: Optional[HybridStorage] = None):
        self.storage = storage or HybridStorage()
        self._active_sessions: Dict[str, DebateSession] = {}
        self._speaking_schedules: Dict[str, SpeakingSchedule] = {}
        self._message_callbacks: List[Callable] = []

    def create_session(
        self,
        topic: str,
        description: str = "",
        agent_ids: List[str] = None,
        mode: DebateMode = DebateMode.SEMI_AUTONOMOUS,
        max_rounds: int = 10,
        created_by: str = "user"
    ) -> DebateSession:
        """
        Create a new debate session.
        """
        session = DebateSession(
            topic=topic,
            description=description,
            mode=mode,
            max_rounds=max_rounds,
            agent_ids=agent_ids or [],
            created_by=created_by,
            current_topic=topic
        )

        # Save to storage
        self.storage.save('sessions', session.id, session.model_dump())

        # Initialize speaking schedule
        schedule = SpeakingSchedule(
            session_id=session.id,
            turn_order=agent_ids or [],
            mode="round_robin" if mode != DebateMode.FULLY_AUTONOMOUS else "response_triggered"
        )
        self._speaking_schedules[session.id] = schedule

        self._active_sessions[session.id] = session

        return session

    def start_session(self, session_id: str) -> Optional[DebateSession]:
        """
        Start a debate session (transition from PENDING to ACTIVE).
        """
        session = self._get_session(session_id)
        if session is None:
            return None

        if session.status != DebateStatus.PENDING:
            raise ValueError(f"Cannot start session in {session.status} status")

        session.status = DebateStatus.ACTIVE
        session.started_at = datetime.utcnow()
        session.current_round = 1

        self._save_session(session)

        return session

    def get_next_speaker(self, session_id: str) -> Optional[str]:
        """
        Get the next agent who should speak in the debate.
        """
        session = self._get_session(session_id)
        if session is None or session.status != DebateStatus.ACTIVE:
            return None

        schedule = self._speaking_schedules.get(session_id)
        if schedule is None:
            return None

        return schedule.get_next_speaker()

    def record_message(
        self,
        session_id: str,
        agent_id: str,
        content: str,
        message_type: str = "statement",
        references_to: List[str] = None,
        metadata: Dict[str, Any] = None
    ) -> DebateMessage:
        """
        Record a message from an agent in the debate.
        """
        session = self._get_session(session_id)
        if session is None:
            raise ValueError(f"Session {session_id} not found")

        # Create message
        message = DebateMessage(
            session_id=session_id,
            agent_id=agent_id,
            round_number=session.current_round,
            message_type=message_type,
            content=content,
            references_to=references_to or [],
            metadata=metadata or {}
        )

        # Save message
        self.storage.save('messages', message.id, message.model_dump())

        # Update speaking schedule
        schedule = self._speaking_schedules.get(session_id)
        if schedule:
            schedule.record_speaking(agent_id)

        # Check for topic shift
        self._check_topic_shift(session, message)

        # Check for convergence/divergence
        self._check_consensus(session, message)

        # Notify callbacks
        for callback in self._message_callbacks:
            callback(message)

        return message

    def advance_round(self, session_id: str) -> Optional[DebateSession]:
        """
        Advance to the next round of the debate.
        """
        session = self._get_session(session_id)
        if session is None:
            return None

        session.current_round += 1

        # Check if max rounds reached
        if session.current_round > session.max_rounds:
            session.status = DebateStatus.COMPLETED
            session.completed_at = datetime.utcnow()

        self._save_session(session)
        return session

    def pause_session(self, session_id: str) -> Optional[DebateSession]:
        """Pause an active session."""
        session = self._get_session(session_id)
        if session and session.status == DebateStatus.ACTIVE:
            session.status = DebateStatus.PAUSED
            self._save_session(session)
        return session

    def resume_session(self, session_id: str) -> Optional[DebateSession]:
        """Resume a paused session."""
        session = self._get_session(session_id)
        if session and session.status == DebateStatus.PAUSED:
            session.status = DebateStatus.ACTIVE
            self._save_session(session)
        return session

    def complete_session(
        self,
        session_id: str,
        consensus_summary: str = "",
        force: bool = False
    ) -> Optional[DebateSession]:
        """
        Complete a debate session.
        """
        session = self._get_session(session_id)
        if session is None:
            return None

        if not force and session.status not in [DebateStatus.ACTIVE, DebateStatus.CONVERGING]:
            raise ValueError(f"Cannot complete session in {session.status} status")

        session.status = DebateStatus.COMPLETED
        session.completed_at = datetime.utcnow()
        session.consensus_summary = consensus_summary
        session.consensus_reached = bool(consensus_summary)

        self._save_session(session)

        # Clean up active session tracking
        if session_id in self._active_sessions:
            del self._active_sessions[session_id]

        return session

    def get_session_messages(
        self,
        session_id: str,
        round_number: Optional[int] = None
    ) -> List[DebateMessage]:
        """
        Get all messages for a session, optionally filtered by round.
        """
        filters = {'session_id': session_id}
        if round_number is not None:
            filters['round_number'] = round_number

        message_data = self.storage.query('messages', filters)
        messages = [DebateMessage(**data) for data in message_data]

        # Sort by creation time
        messages.sort(key=lambda m: m.created_at)

        return messages

    def get_session_history(self, session_id: str) -> Dict[str, Any]:
        """
        Get complete history of a debate session.
        """
        session = self._get_session(session_id)
        if session is None:
            return {}

        messages = self.get_session_messages(session_id)

        return {
            'session': session.model_dump(),
            'messages': [m.model_dump() for m in messages],
            'message_count': len(messages),
            'speaking_order': self._speaking_schedules.get(session_id, SpeakingSchedule(session_id=session_id)).turn_order
        }

    def list_sessions(
        self,
        status: Optional[DebateStatus] = None,
        limit: int = 50
    ) -> List[DebateSession]:
        """
        List debate sessions, optionally filtered by status.
        """
        filters = {}
        if status:
            filters['status'] = status.value

        session_data = self.storage.query('sessions', filters)
        sessions = [DebateSession(**data) for data in session_data]

        # Sort by creation time (newest first)
        sessions.sort(key=lambda s: s.created_at, reverse=True)

        return sessions[:limit]

    def on_message(self, callback: Callable[[DebateMessage], None]):
        """Register a callback for new messages."""
        self._message_callbacks.append(callback)

    def _get_session(self, session_id: str) -> Optional[DebateSession]:
        """Get session from cache or storage."""
        # Check cache first
        if session_id in self._active_sessions:
            return self._active_sessions[session_id]

        # Load from storage
        data = self.storage.load('sessions', session_id)
        if data:
            return DebateSession(**data)

        return None

    def _save_session(self, session: DebateSession) -> None:
        """Save session to storage."""
        self.storage.save('sessions', session.id, session.model_dump())

    def _check_topic_shift(self, session: DebateSession, message: DebateMessage) -> None:
        """Detect if the message indicates a topic shift."""
        # Simple heuristic: look for topic-related keywords
        content_lower = message.content.lower()

        topic_indicators = [
            "changing topic", "let's discuss", "moving on to",
            "another point", "regarding", "speaking of",
            "shifting focus", "let's talk about"
        ]

        for indicator in topic_indicators:
            if indicator in content_lower:
                # Record topic shift
                session.topic_history.append({
                    'from_topic': session.current_topic,
                    'to_topic': 'shifted',  # Could extract new topic
                    'triggered_by': message.id,
                    'timestamp': datetime.utcnow().isoformat()
                })

                message.message_type = "topic_shift"
                break

    def _check_consensus(self, session: DebateSession, message: DebateMessage) -> None:
        """Check if the debate is reaching consensus or diverging."""
        content_lower = message.content.lower()

        # Consensus indicators
        consensus_phrases = [
            "i agree", "we agree", "consensus", "everyone agrees",
            "we're aligned", "in agreement", "common ground"
        ]

        # Divergence indicators
        divergence_phrases = [
            "i disagree", "we disagree", "fundamental difference",
            "cannot agree", "opposing view", "divergent"
        ]

        consensus_score = sum(1 for p in consensus_phrases if p in content_lower)
        divergence_score = sum(1 for p in divergence_phrases if p in content_lower)

        if consensus_score > 0:
            message.sentiment = "positive"
            # Check if we should transition to CONVERGING
            if session.status == DebateStatus.ACTIVE and self._detect_convergence(session):
                session.status = DebateStatus.CONVERGING
        elif divergence_score > 0:
            message.sentiment = "negative"
            session.divergence_points.append(message.id)

    def _detect_convergence(self, session: DebateSession) -> bool:
        """Detect if debate is converging toward consensus."""
        # Get recent messages
        messages = self.get_session_messages(session_id=session.id)
        recent_messages = messages[-5:] if len(messages) >= 5 else messages

        if len(recent_messages) < 3:
            return False

        # Count agreement indicators in recent messages
        agreement_count = sum(
            1 for m in recent_messages
            if m.sentiment == "positive"
        )

        # If majority of recent messages show agreement, consider converging
        return agreement_count >= len(recent_messages) / 2


class AutonomousDebate(DebateCoordinator):
    """
    Extended debate coordinator for autonomous agent interactions.
    Agents can decide when to speak, who to respond to, etc.
    """

    def __init__(self, storage: Optional[HybridStorage] = None):
        super().__init__(storage)
        self._agent_queue: Dict[str, List[str]] = {}  # session_id -> agent_ids waiting to speak

    def request_to_speak(
        self,
        session_id: str,
        agent_id: str,
        urgency: float = 0.5
    ) -> int:
        """
        Allow an agent to request speaking time.
        Returns the position in the queue.
        """
        if session_id not in self._agent_queue:
            self._agent_queue[session_id] = []

        queue = self._agent_queue[session_id]

        # Insert based on urgency (higher urgency = earlier)
        position = len(queue)
        for i, existing_id in enumerate(queue):
            # Simple FIFO for now, could be priority-based
            if urgency > 0.8:  # High urgency can jump queue
                position = i
                break

        queue.insert(position, agent_id)
        return position

    def get_autonomous_next_speaker(self, session_id: str) -> Optional[str]:
        """
        Get next speaker in autonomous mode.
        Considers queue and response triggers.
        """
        session = self._get_session(session_id)
        if session is None or session.status != DebateStatus.ACTIVE:
            return None

        # Check if there's a queued speaker
        queue = self._agent_queue.get(session_id, [])
        if queue:
            return queue.pop(0)

        # Fall back to schedule
        schedule = self._speaking_schedules.get(session_id)
        if schedule:
            return schedule.get_next_speaker()

        return None

    def trigger_response(
        self,
        session_id: str,
        target_agent_id: str,
        from_message_id: str
    ) -> None:
        """
        Trigger a specific agent to respond to a message.
        """
        schedule = self._speaking_schedules.get(session_id)
        if schedule:
            schedule.request_response(target_agent_id)

    def evaluate_speaking_opportunity(
        self,
        session_id: str,
        agent_id: str,
        last_messages: List[DebateMessage]
    ) -> Dict[str, Any]:
        """
        Evaluate whether an agent should speak now.
        Returns decision factors.
        """
        # Simple heuristics for speaking decision
        should_speak = False
        reasons = []

        # Hasn't spoken recently
        session = self._get_session(session_id)
        if session:
            messages = self.get_session_messages(session_id)
            recent_speakers = [m.agent_id for m in messages[-3:]]

            if agent_id not in recent_speakers:
                should_speak = True
                reasons.append("Hasn't spoken recently")

        # Has something to add (based on last messages)
        if last_messages:
            last_content = last_messages[-1].content.lower()
            # If last message asked a question
            if '?' in last_messages[-1].content:
                should_speak = True
                reasons.append("Responding to question")

        return {
            'should_speak': should_speak,
            'confidence': 0.7 if should_speak else 0.3,
            'reasons': reasons,
            'suggested_urgency': 0.6 if should_speak else 0.3
        }


class DebateFormatter:
    """
    Formats debate output for different audiences.
    """

    @staticmethod
    def format_for_terminal(session_id: str, coordinator: DebateCoordinator) -> str:
        """Format debate history for terminal display."""
        history = coordinator.get_session_history(session_id)

        if not history:
            return "No session found."

        session = history['session']
        messages = history['messages']

        lines = [
            "=" * 60,
            f"DEBATE: {session['topic']}",
            f"Status: {session['status']} | Round: {session['current_round']}/{session['max_rounds']}",
            "=" * 60,
            ""
        ]

        for msg in messages:
            agent_name = msg.get('agent_name') or msg['agent_id']
            lines.append(f"\n[{msg['round_number']}] {agent_name}:")
            lines.append(f"  {msg['content'][:200]}..." if len(msg['content']) > 200 else f"  {msg['content']}")
            lines.append("")

        if session.get('consensus_summary'):
            lines.append("\n" + "=" * 60)
            lines.append("CONSENSUS:")
            lines.append(session['consensus_summary'])

        return "\n".join(lines)

    @staticmethod
    def format_summary(session_id: str, coordinator: DebateCoordinator) -> Dict[str, Any]:
        """Generate a structured summary of the debate."""
        history = coordinator.get_session_history(session_id)

        if not history:
            return {}

        session = history['session']
        messages = history['messages']

        # Count messages by agent
        agent_message_counts = {}
        for msg in messages:
            agent_id = msg['agent_id']
            agent_message_counts[agent_id] = agent_message_counts.get(agent_id, 0) + 1

        return {
            'topic': session['topic'],
            'status': session['status'],
            'rounds_completed': session['current_round'],
            'total_messages': len(messages),
            'agent_participation': agent_message_counts,
            'consensus_reached': session.get('consensus_reached', False),
            'consensus_summary': session.get('consensus_summary', ''),
            'divergence_points': len(session.get('divergence_points', [])),
            'duration_minutes': None  # Could calculate from timestamps
        }
