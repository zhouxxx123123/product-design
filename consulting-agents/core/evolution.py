"""
Evolution system for agent self-improvement.
Manages evolution proposals, approval workflows, and version control.
"""

from datetime import datetime
from typing import Dict, List, Optional, Any, Callable
import copy
import json

from core.models import (
    EvolutionProposal, EvolutionStatus, AgentDefinition,
    AgentMemory, AuditLog
)
from core.storage import HybridStorage


class EvolutionTrigger:
    """
    Detects opportunities for agent evolution based on various triggers.
    """

    def __init__(self, storage: HybridStorage):
        self.storage = storage
        self._trigger_handlers: Dict[str, Callable] = {
            'realtime': self._check_realtime_triggers,
            'task_completion': self._check_task_triggers,
            'human_feedback': self._check_feedback_triggers,
            'peer_review': self._check_peer_triggers,
        }

    def check_triggers(self, agent_id: str, context: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Check all trigger types and return opportunities for evolution.
        """
        opportunities = []

        for trigger_type, handler in self._trigger_handlers.items():
            trigger_opportunities = handler(agent_id, context)
            for opp in trigger_opportunities:
                opp['trigger_type'] = trigger_type
            opportunities.extend(trigger_opportunities)

        return opportunities

    def _check_realtime_triggers(self, agent_id: str, context: Dict) -> List[Dict]:
        """Check for real-time evolution opportunities during task execution."""
        opportunities = []

        # Check for repeated patterns that could be optimized
        if context.get('repeated_action_count', 0) > 3:
            opportunities.append({
                'type': 'prompt_optimization',
                'description': 'Detected repeated actions - prompt could be optimized',
                'confidence': 0.6,
                'proposed_changes': {
                    'add_section': 'Common Action Patterns',
                    'content': 'Add guidance for batch processing repeated actions'
                }
            })

        return opportunities

    def _check_task_triggers(self, agent_id: str, context: Dict) -> List[Dict]:
        """Check for evolution opportunities after task completion."""
        opportunities = []

        # Analyze task success/failure
        task_success = context.get('task_success', True)
        task_duration = context.get('task_duration_minutes', 0)

        if not task_success:
            opportunities.append({
                'type': 'strategy_learning',
                'description': 'Task failed - identify and document failure patterns',
                'confidence': 0.8,
                'proposed_changes': {
                    'memory_type': 'lesson',
                    'content': f"Failed task analysis: {context.get('failure_reason', 'Unknown')}"
                }
            })

        if task_duration > 30:  # Tasks taking too long
            opportunities.append({
                'type': 'efficiency_optimization',
                'description': 'Task took longer than expected - optimize approach',
                'confidence': 0.7,
                'proposed_changes': {
                    'add_guidance': 'Efficiency Guidelines',
                    'content': 'Add time-boxing recommendations'
                }
            })

        return opportunities

    def _check_feedback_triggers(self, agent_id: str, context: Dict) -> List[Dict]:
        """Check for evolution opportunities from human feedback."""
        opportunities = []

        feedback_score = context.get('feedback_score', 0)
        feedback_text = context.get('feedback_text', '')

        if feedback_score < 3:  # Low rating
            opportunities.append({
                'type': 'prompt_optimization',
                'description': f'Low feedback score ({feedback_score}) - needs improvement',
                'confidence': 0.9,
                'proposed_changes': {
                    'address_feedback': feedback_text,
                    'priority': 'high'
                }
            })

        return opportunities

    def _check_peer_triggers(self, agent_id: str, context: Dict) -> List[Dict]:
        """Check for evolution opportunities from peer agent reviews."""
        opportunities = []

        peer_reviews = context.get('peer_reviews', [])

        for review in peer_reviews:
            if review.get('suggests_improvement'):
                opportunities.append({
                    'type': 'collaboration_learning',
                    'description': f"Peer ({review['reviewer_id']}) suggested improvement",
                    'confidence': review.get('confidence', 0.7),
                    'proposed_changes': {
                        'peer_feedback': review.get('suggestion'),
                        'reviewer': review['reviewer_id']
                    }
                })

        return opportunities


class EvolutionManager:
    """
    Manages the agent evolution lifecycle:
    - Trigger detection
    - Proposal creation
    - Approval workflow
    - Application and verification
    - Rollback support
    """

    def __init__(self, storage: Optional[HybridStorage] = None):
        self.storage = storage or HybridStorage()
        self.trigger_detector = EvolutionTrigger(self.storage)
        self._approval_callbacks: List[Callable] = []

    def propose_evolution(
        self,
        agent_id: str,
        proposal_type: str,
        trigger: str,
        description: str,
        changes: Dict[str, Any],
        rationale: str,
        expected_improvements: List[str] = None,
        proposed_by: str = "system"
    ) -> EvolutionProposal:
        """
        Create a new evolution proposal.
        """
        proposal = EvolutionProposal(
            agent_id=agent_id,
            proposal_type=proposal_type,
            trigger=trigger,
            description=description,
            changes=changes,
            rationale=rationale,
            expected_improvements=expected_improvements or [],
            proposed_by=proposed_by,
            status=EvolutionStatus.PROPOSED
        )

        # Save proposal
        self.storage.save('evolution', proposal.id, proposal.model_dump())

        # Log audit event
        self._log_audit(
            action='evolution_proposed',
            actor=proposed_by,
            target_type='evolution',
            target_id=proposal.id,
            details={
                'agent_id': agent_id,
                'proposal_type': proposal_type,
                'trigger': trigger
            }
        )

        # Determine approval path
        approval_path = self._determine_approval_path(proposal)

        if approval_path == 'auto':
            # Auto-approve minor changes
            self.approve_proposal(proposal.id, 'system', auto=True)
        elif approval_path == 'meta_agent':
            # Queue for meta-agent review
            proposal.status = EvolutionStatus.UNDER_REVIEW
            self.storage.save('evolution', proposal.id, proposal.model_dump())
        else:
            # Human approval required
            proposal.status = EvolutionStatus.UNDER_REVIEW
            self.storage.save('evolution', proposal.id, proposal.model_dump())
            # Notify human approvers
            for callback in self._approval_callbacks:
                callback(proposal)

        return proposal

    def _determine_approval_path(self, proposal: EvolutionProposal) -> str:
        """
        Determine the approval path based on proposal characteristics.
        Returns: 'auto', 'meta_agent', or 'human'
        """
        # Auto-approve criteria
        if proposal.trigger == 'realtime':
            # Minor prompt adjustments during execution
            if proposal.proposal_type == 'prompt_optimization':
                return 'auto'

        # Meta-agent review criteria
        if proposal.trigger == 'task_completion':
            return 'meta_agent'

        if proposal.trigger == 'peer_review':
            return 'meta_agent'

        # Human approval required
        if proposal.proposal_type == 'tool_usage':
            return 'human'  # Tool changes need human review

        return 'human'  # Default to human approval

    def approve_proposal(
        self,
        proposal_id: str,
        approver: str,
        comments: str = "",
        auto: bool = False
    ) -> Optional[EvolutionProposal]:
        """
        Approve an evolution proposal.
        """
        proposal = self._get_proposal(proposal_id)
        if proposal is None:
            return None

        if proposal.status not in [EvolutionStatus.PROPOSED, EvolutionStatus.UNDER_REVIEW]:
            raise ValueError(f"Cannot approve proposal in {proposal.status} status")

        proposal.status = EvolutionStatus.APPROVED
        proposal.reviewed_by.append(approver)
        proposal.review_comments.append({
            'reviewer': approver,
            'action': 'approved',
            'comments': comments,
            'timestamp': datetime.utcnow().isoformat(),
            'auto_approved': auto
        })

        self.storage.save('evolution', proposal.id, proposal.model_dump())

        self._log_audit(
            action='evolution_approved',
            actor=approver,
            target_type='evolution',
            target_id=proposal.id,
            details={'auto': auto}
        )

        return proposal

    def reject_proposal(
        self,
        proposal_id: str,
        rejector: str,
        reason: str
    ) -> Optional[EvolutionProposal]:
        """
        Reject an evolution proposal.
        """
        proposal = self._get_proposal(proposal_id)
        if proposal is None:
            return None

        proposal.status = EvolutionStatus.REJECTED
        proposal.reviewed_by.append(rejector)
        proposal.review_comments.append({
            'reviewer': rejector,
            'action': 'rejected',
            'comments': reason,
            'timestamp': datetime.utcnow().isoformat()
        })

        self.storage.save('evolution', proposal.id, proposal.model_dump())

        self._log_audit(
            action='evolution_rejected',
            actor=rejector,
            target_type='evolution',
            target_id=proposal.id,
            details={'reason': reason}
        )

        return proposal

    def apply_proposal(
        self,
        proposal_id: str,
        agent_registry: Any  # AgentRegistry
    ) -> Optional[AgentDefinition]:
        """
        Apply an approved evolution proposal to an agent.
        """
        proposal = self._get_proposal(proposal_id)
        if proposal is None:
            return None

        if proposal.status != EvolutionStatus.APPROVED:
            raise ValueError(f"Cannot apply proposal in {proposal.status} status")

        # Get current agent definition
        agent = agent_registry.get_agent(proposal.agent_id)
        if agent is None:
            raise ValueError(f"Agent {proposal.agent_id} not found")

        # Store rollback version
        proposal.rollback_version = agent.version

        # Apply changes based on type
        updated_agent = self._apply_changes(agent, proposal)

        if updated_agent:
            # Update version
            version_parts = updated_agent.version.split('.')
            if len(version_parts) == 3:
                version_parts[2] = str(int(version_parts[2]) + 1)
                updated_agent.version = '.'.join(version_parts)

            proposal.applied_version = updated_agent.version

            # Record in evolution history
            updated_agent.evolution_history.append({
                'version': updated_agent.version,
                'date': datetime.utcnow().isoformat(),
                'change': proposal.description,
                'proposal_id': proposal.id
            })

            # Save updated agent
            agent_registry.update_agent(
                proposal.agent_id,
                system_prompt=updated_agent.system_prompt,
                version=updated_agent.version,
                evolution_history=updated_agent.evolution_history
            )

            # Update proposal status
            proposal.status = EvolutionStatus.APPLIED
            proposal.applied_at = datetime.utcnow()
            self.storage.save('evolution', proposal.id, proposal.model_dump())

            self._log_audit(
                action='evolution_applied',
                actor='system',
                target_type='agent',
                target_id=proposal.agent_id,
                details={
                    'proposal_id': proposal_id,
                    'from_version': proposal.rollback_version,
                    'to_version': proposal.applied_version
                }
            )

        return updated_agent

    def _apply_changes(
        self,
        agent: AgentDefinition,
        proposal: EvolutionProposal
    ) -> AgentDefinition:
        """Apply the proposed changes to an agent."""
        updated = copy.deepcopy(agent)
        changes = proposal.changes

        if proposal.proposal_type == 'prompt_optimization':
            # Modify system prompt
            if 'add_section' in changes:
                section_name = changes['add_section']
                section_content = changes.get('content', '')
                updated.system_prompt += f"\n\n## {section_name}\n\n{section_content}"

            if 'modify_section' in changes:
                # More complex section modification
                pass

        elif proposal.proposal_type == 'memory_update':
            # Add to agent's knowledge base
            pass

        elif proposal.proposal_type == 'strategy_learning':
            # Update strategy guidance
            if 'memory_type' in changes:
                # This would integrate with memory system
                pass

        elif proposal.proposal_type == 'tool_usage':
            # Update tool recommendations
            if 'add_tools' in changes:
                for tool in changes['add_tools']:
                    if tool not in updated.tools:
                        updated.tools.append(tool)

        return updated

    def rollback_proposal(
        self,
        proposal_id: str,
        agent_registry: Any,
        reason: str = ""
    ) -> Optional[AgentDefinition]:
        """
        Rollback an applied evolution.
        """
        proposal = self._get_proposal(proposal_id)
        if proposal is None:
            return None

        if proposal.status != EvolutionStatus.APPLIED:
            raise ValueError(f"Cannot rollback proposal in {proposal.status} status")

        # Get agent and restore previous version
        agent = agent_registry.get_agent(proposal.agent_id)
        if agent is None:
            return None

        # In a real implementation, we'd store full versions
        # For now, we just mark as rolled back
        proposal.status = EvolutionStatus.ROLLED_BACK
        self.storage.save('evolution', proposal.id, proposal.model_dump())

        self._log_audit(
            action='evolution_rolled_back',
            actor='system',
            target_type='agent',
            target_id=proposal.agent_id,
            details={
                'proposal_id': proposal_id,
                'reason': reason,
                'restored_version': proposal.rollback_version
            }
        )

        return agent

    def get_pending_proposals(self, agent_id: Optional[str] = None) -> List[EvolutionProposal]:
        """Get all pending evolution proposals."""
        filters = {'status': EvolutionStatus.PROPOSED.value}
        if agent_id:
            filters['agent_id'] = agent_id

        proposals_data = self.storage.query('evolution', filters)
        return [EvolutionProposal(**data) for data in proposals_data]

    def get_proposal_history(self, agent_id: str) -> List[EvolutionProposal]:
        """Get evolution history for an agent."""
        proposals_data = self.storage.query('evolution', {'agent_id': agent_id})
        proposals = [EvolutionProposal(**data) for data in proposals_data]
        proposals.sort(key=lambda p: p.proposed_at, reverse=True)
        return proposals

    def _get_proposal(self, proposal_id: str) -> Optional[EvolutionProposal]:
        """Load a proposal from storage."""
        data = self.storage.load('evolution', proposal_id)
        if data:
            return EvolutionProposal(**data)
        return None

    def _log_audit(self, action: str, actor: str, target_type: str, target_id: str, details: Dict):
        """Log an audit event."""
        audit_log = AuditLog(
            action=action,
            actor=actor,
            target_type=target_type,
            target_id=target_id,
            details=details
        )
        self.storage.save('audit_logs', audit_log.id, audit_log.model_dump())

    def on_approval_needed(self, callback: Callable[[EvolutionProposal], None]):
        """Register a callback for when human approval is needed."""
        self._approval_callbacks.append(callback)


class MetaAgentReviewer:
    """
    Meta-agent that reviews evolution proposals on behalf of humans.
    Implements quality gates and automated review logic.
    """

    def __init__(self, evolution_manager: EvolutionManager):
        self.evolution_manager = evolution_manager

    def review_proposal(self, proposal: EvolutionProposal) -> Dict[str, Any]:
        """
        Review an evolution proposal and provide a recommendation.
        """
        review = {
            'approved': False,
            'confidence': 0.0,
            'reasons': [],
            'concerns': [],
            'suggestions': []
        }

        # Quality gate 1: Proposal completeness
        if not proposal.rationale:
            review['concerns'].append("Missing rationale")
            review['confidence'] -= 0.2

        if not proposal.expected_improvements:
            review['concerns'].append("No expected improvements specified")
            review['confidence'] -= 0.1

        # Quality gate 2: Change size
        change_size = self._estimate_change_size(proposal)
        if change_size == 'large':
            review['concerns'].append("Large changes need careful review")
            review['confidence'] -= 0.2
            review['suggestions'].append("Consider breaking into smaller proposals")

        # Quality gate 3: Historical success
        historical_score = self._check_historical_success(proposal)
        if historical_score > 0.7:
            review['reasons'].append("Similar changes succeeded in the past")
            review['confidence'] += 0.2
        elif historical_score < 0.3:
            review['concerns'].append("Similar changes failed in the past")
            review['confidence'] -= 0.3

        # Make decision
        review['confidence'] = max(0.0, min(1.0, review['confidence'] + 0.5))

        if review['confidence'] > 0.7 and not review['concerns']:
            review['approved'] = True
        elif review['confidence'] < 0.4:
            review['approved'] = False
        else:
            # Uncertain - needs human review
            review['needs_human_review'] = True

        return review

    def _estimate_change_size(self, proposal: EvolutionProposal) -> str:
        """Estimate the size of the proposed change."""
        changes = proposal.changes

        # Simple heuristic
        change_count = len(changes)
        content_size = sum(len(str(v)) for v in changes.values())

        if change_count > 3 or content_size > 1000:
            return 'large'
        elif change_count > 1 or content_size > 500:
            return 'medium'
        return 'small'

    def _check_historical_success(self, proposal: EvolutionProposal) -> float:
        """Check historical success rate for similar proposals."""
        # Get past proposals for same agent
        history = self.evolution_manager.get_proposal_history(proposal.agent_id)

        if not history:
            return 0.5  # Unknown

        # Count similar proposals
        similar = [p for p in history if p.proposal_type == proposal.proposal_type]

        if not similar:
            return 0.5

        # Calculate success rate
        successful = sum(1 for p in similar if p.status == EvolutionStatus.APPLIED)
        return successful / len(similar)
