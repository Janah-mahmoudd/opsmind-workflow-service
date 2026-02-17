import { RowDataPacket } from 'mysql2/promise';
import { SupportGroupRepository } from '../repositories/SupportGroupRepository';
import { TicketRoutingStateRepository } from '../repositories/TicketRoutingStateRepository';
import { WorkflowLogRepository } from '../repositories/WorkflowLogRepository';
import { TicketRoutingStateRow, SupportGroupRow } from '../interfaces/types';
import { query, execute } from '../config/database';
import { ticketServiceClient } from '../config/externalServices';

/**
 * Routing Service (TypeScript)
 *
 * Auto-routes tickets based on building + floor → support group mapping.
 * Selects an available JUNIOR technician, calls Ticket Service to assign,
 * persists routing state, and logs the action.
 */
export class RoutingService {
  private groupRepo = new SupportGroupRepository();
  private routingRepo = new TicketRoutingStateRepository();
  private logRepo = new WorkflowLogRepository();

  /**
   * Route a ticket:
   *  1. Find SupportGroup by building + floor
   *  2. Select the least-loaded ACTIVE JUNIOR technician in that group
   *  3. PATCH ticket-service to set assigned_to + status=ASSIGNED
   *  4. Save routing_state with the assigned member
   *  5. Create workflow_log entry
   *  6. Return the assigned technician info
   */
  async routeTicket(
    ticketId: string,
    building: string,
    floor: number,
    priority?: string,
  ): Promise<any> {
    // ── Step 1: Validate & find support group ──
    console.log(`[ROUTING] Step 1: Looking up support group for building=${building}, floor=${floor}, ticket=${ticketId}`);
    const group = await this.groupRepo.getGroupByBuildingAndFloor(building, floor);
    if (!group) {
      console.error(`[ROUTING] FAIL: No support group for building=${building}, floor=${floor}`);
      throw new Error(`No support group found for building: ${building}, floor: ${floor}`);
    }
    console.log(`[ROUTING] Step 1 OK: Found group id=${group.id}, name="${group.name}"`);

    // ── Step 2: Select least-loaded JUNIOR technician ──
    console.log(`[ROUTING] Step 2: Selecting least-loaded JUNIOR in group ${group.id}`);
    const techSql = `
      SELECT gm.id AS member_id, gm.user_id
      FROM group_members gm
      LEFT JOIN (
        SELECT assigned_member_id, COUNT(*) AS ticket_count
        FROM ticket_routing_state
        WHERE status = 'ASSIGNED'
        GROUP BY assigned_member_id
      ) tc ON gm.id = tc.assigned_member_id
      WHERE gm.group_id = ? AND gm.role = 'JUNIOR' AND gm.status = 'ACTIVE'
      ORDER BY COALESCE(tc.ticket_count, 0) ASC
      LIMIT 1
    `;
    const techs = await query<RowDataPacket[]>(techSql, [group.id]);

    if (!techs.length) {
      console.error(`[ROUTING] FAIL: No available JUNIOR in group "${group.name}"`);
      throw new Error(
        `No available JUNIOR technician in group "${group.name}" (Building: ${building}, Floor: ${floor})`,
      );
    }

    const technician = techs[0];
    console.log(`[ROUTING] Step 2 OK: Selected technician memberId=${technician.member_id}, userId=${technician.user_id}`);

    // ── Step 3: PRE-PATCH log ──
    console.log(`[ROUTING] Step 3: PRE-PATCH — calling PATCH /tickets/${ticketId} on ticket-service`);
    await this.logRepo.logAction(ticketId, 'ROUTED', {
      to_group_id: group.id,
      to_member_id: technician.member_id,
      reason: `[PRE-PATCH] About to assign ticket to technician userId=${technician.user_id} (L1) via ticket-service`,
    });

    // ── Step 4: Call Ticket Service PATCH ──
    try {
      await ticketServiceClient.patch(`/tickets/${ticketId}`, {
        assigned_to: String(technician.user_id),
        assigned_to_level: 'L1',
        status: 'IN_PROGRESS',
      });
      console.log(`[ROUTING] Step 4 OK: Ticket-service PATCH successful`);
    } catch (err: any) {
      const detail = err.response?.data?.message || err.message;
      console.error(`[ROUTING] Step 4 FAIL: Ticket-service PATCH failed — ${detail}`);
      throw new Error(`Failed to update ticket in Ticket Service: ${detail}`);
    }

    // ── Step 5: Insert routing state ──
    console.log(`[ROUTING] Step 5: Inserting routing state`);
    const insertSql = `
      INSERT INTO ticket_routing_state
        (ticket_id, current_group_id, assigned_member_id, status, claimed_at)
      VALUES (?, ?, ?, 'ASSIGNED', CURRENT_TIMESTAMP)
    `;
    const result = await execute(insertSql, [ticketId, group.id, technician.member_id]);
    console.log(`[ROUTING] Step 5 OK: routing_state inserted, id=${result.insertId}`);

    // ── Step 6: POST-PATCH audit log ──
    await this.logRepo.logAction(ticketId, 'ROUTED', {
      to_group_id: group.id,
      to_member_id: technician.member_id,
      reason: `[POST-PATCH] Auto-routed to ${group.name}, assigned to technician userId=${technician.user_id}${priority ? ` | priority: ${priority}` : ''}`,
    });
    console.log(`[ROUTING] Step 6 OK: Workflow log written — routing complete`);

    // ── Step 7: Return result ──
    return {
      ticketId,
      groupId: group.id,
      groupName: group.name,
      building: group.building,
      floor: group.floor,
      assignedTechnician: {
        memberId: technician.member_id,
        userId: technician.user_id,
      },
      priority: priority || null,
      status: 'ASSIGNED',
      routing_state: {
        id: result.insertId,
        ticket_id: ticketId,
        current_group_id: group.id,
        assigned_member_id: technician.member_id,
        status: 'ASSIGNED',
      },
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
