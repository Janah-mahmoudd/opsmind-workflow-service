import { SupportGroupRepository } from '../repositories/SupportGroupRepository';
import { TicketRoutingStateRepository } from '../repositories/TicketRoutingStateRepository';
import { WorkflowLogRepository } from '../repositories/WorkflowLogRepository';
import { RouteTicketResponse, TicketRoutingStateRow, SupportGroupRow } from '../interfaces/types';

/**
 * Routing Service (TypeScript)
 *
 * Auto-routes tickets based on building + floor → support group mapping.
 */
export class RoutingService {
  private groupRepo = new SupportGroupRepository();
  private routingRepo = new TicketRoutingStateRepository();
  private logRepo = new WorkflowLogRepository();

  async routeTicket(ticketId: string, building: string, floor: number): Promise<RouteTicketResponse> {
    const group = await this.groupRepo.getGroupByBuildingAndFloor(building, floor);

    if (!group) {
      throw new Error(`No support group found for building: ${building}, floor: ${floor}`);
    }

    const routingState = await this.routingRepo.createRoutingState(ticketId, group.id);

    await this.logRepo.logAction(ticketId, 'ROUTED', {
      to_group_id: group.id,
      reason: `Auto-routed to ${group.name} (Building: ${building}, Floor: ${floor})`,
    });

    return {
      success: true,
      ticketId,
      groupId: group.id,
      groupName: group.name,
      building: group.building,
      floor: group.floor,
      routing_state: routingState,
    };
  }

  async getTicketRouting(ticketId: string): Promise<TicketRoutingStateRow | null> {
    return this.routingRepo.getByTicketId(ticketId);
  }

  async getGroupQueue(groupId: number): Promise<TicketRoutingStateRow[]> {
    return this.routingRepo.getGroupTickets(groupId);
  }

  async getGroupInfo(groupId: number): Promise<SupportGroupRow | null> {
    return this.groupRepo.getGroupById(groupId);
  }
}
