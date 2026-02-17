import { TicketRoutingStateRepository } from '../repositories/TicketRoutingStateRepository';
import { SupportGroupRepository } from '../repositories/SupportGroupRepository';
import { WorkflowLogRepository } from '../repositories/WorkflowLogRepository';
import { EscalationRuleRepository } from '../repositories/EscalationRuleRepository';
import {
  EscalateTicketResponse,
  EscalationTrigger,
  UserRole,
  WorkflowLogRow,
  EscalationRuleRow,
} from '../interfaces/types';

/**
 * Escalation Service (TypeScript)
 *
 * Triggers: SLA | MANUAL | CRITICAL | REOPEN_COUNT
 * Flow: Junior Group → Senior → Supervisor → Head of IT
 */
export class EscalationService {
  private routingRepo = new TicketRoutingStateRepository();
  private groupRepo = new SupportGroupRepository();
  private logRepo = new WorkflowLogRepository();
  private ruleRepo = new EscalationRuleRepository();

  async escalateTicket(
    ticketId: string,
    triggerType: EscalationTrigger,
    performedBy: number | null,
  ): Promise<EscalateTicketResponse> {
    const routingState = await this.routingRepo.getByTicketId(ticketId);
    if (!routingState) throw new Error(`Ticket ${ticketId} not found`);

    const currentGroup = await this.groupRepo.getGroupById(routingState.current_group_id);
    if (!currentGroup) throw new Error('Current group not found');

    const rule = await this.ruleRepo.getRuleByTrigger(currentGroup.id, triggerType);
    if (!rule) {
      throw new Error(`No escalation rule for group ${currentGroup.id} with trigger ${triggerType}`);
    }

    const targetGroup = await this.groupRepo.getGroupById(rule.target_group_id);
    if (!targetGroup) throw new Error('Target escalation group not found');

    await this.routingRepo.escalateTicket(ticketId, targetGroup.id);

    await this.logRepo.logAction(ticketId, 'ESCALATED', {
      from_group_id: currentGroup.id,
      to_group_id: targetGroup.id,
      performed_by: performedBy,
      reason: `Escalated (${triggerType}) from ${currentGroup.name} to ${targetGroup.name}`,
    });

    const escalationCount = await this.routingRepo.getEscalationCount(ticketId);

    return {
      success: true,
      ticketId,
      fromGroup: currentGroup.name,
      toGroup: targetGroup.name,
      escalationCount,
      triggerType,
      message: `Ticket escalated to ${targetGroup.name}`,
    };
  }

  async manualEscalate(ticketId: string, userId: number, userRole: UserRole): Promise<EscalateTicketResponse> {
    if (userRole !== 'SENIOR' && userRole !== 'SUPERVISOR') {
      throw new Error(`Only Seniors and Supervisors can escalate. User role: ${userRole}`);
    }
    return this.escalateTicket(ticketId, 'MANUAL', userId);
  }

  async escalateIfCritical(
    ticketId: string,
    isCritical: boolean,
  ): Promise<EscalateTicketResponse | { success: false; message: string }> {
    if (!isCritical) return { success: false, message: 'Ticket is not critical' };
    return this.escalateTicket(ticketId, 'CRITICAL', null);
  }

  async escalateOnSLABreach(
    ticketId: string,
    slaBreached: boolean,
  ): Promise<EscalateTicketResponse | { success: false; message: string }> {
    if (!slaBreached) return { success: false, message: 'SLA not breached' };
    return this.escalateTicket(ticketId, 'SLA', null);
  }

  async escalateOnReopenThreshold(
    ticketId: string,
    reopenCount: number,
    threshold: number = 3,
  ): Promise<EscalateTicketResponse | { success: false; message: string }> {
    if (reopenCount < threshold) {
      return { success: false, message: `Reopen count ${reopenCount} below threshold ${threshold}` };
    }
    return this.escalateTicket(ticketId, 'REOPEN_COUNT', null);
  }

  async getEscalationPath(groupId: number): Promise<EscalationRuleRow[]> {
    return this.ruleRepo.getRulesForGroup(groupId);
  }

  async getEscalationHistory(ticketId: string): Promise<WorkflowLogRow[]> {
    const logs = await this.logRepo.getTicketLogs(ticketId);
    return logs.filter((l) => l.action === 'ESCALATED');
  }
}
