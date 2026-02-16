import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { query, execute, getConnection } from '../config/database';
import { TicketRoutingStateRow, RoutingStatus } from '../interfaces/types';

interface RoutingStateRowData extends TicketRoutingStateRow, RowDataPacket {}

/**
 * Ticket Routing State Repository (TypeScript)
 *
 * Tracks workflow state of each ticket.
 * NOT the ticket details (owned by Ticket Service).
 */
export class TicketRoutingStateRepository {
  async createRoutingState(
    ticketId: number,
    groupId: number,
  ): Promise<{ id: number; ticket_id: number; current_group_id: number }> {
    const sql = `
      INSERT INTO ticket_routing_state (ticket_id, current_group_id, status)
      VALUES (?, ?, 'UNASSIGNED')
    `;
    const result = await execute(sql, [ticketId, groupId]);
    return { id: result.insertId, ticket_id: ticketId, current_group_id: groupId };
  }

  async getByTicketId(ticketId: number): Promise<TicketRoutingStateRow | null> {
    const sql = `SELECT * FROM ticket_routing_state WHERE ticket_id = ?`;
    const rows = await query<RoutingStateRowData[]>(sql, [ticketId]);
    return rows[0] ?? null;
  }

  /**
   * Claim ticket (CONCURRENCY-SAFE)
   * Atomic UPDATE with WHERE status = 'UNASSIGNED' prevents race conditions.
   */
  async claimTicket(ticketId: number, memberId: number): Promise<boolean> {
    const connection = await getConnection();

    try {
      await connection.beginTransaction();

      const updateSql = `
        UPDATE ticket_routing_state
        SET assigned_member_id = ?, status = 'ASSIGNED', claimed_at = CURRENT_TIMESTAMP
        WHERE ticket_id = ? AND status = 'UNASSIGNED'
      `;

      const [result] = await connection.execute<ResultSetHeader>(updateSql, [memberId, ticketId]);

      if (result.affectedRows === 0) {
        await connection.rollback();
        throw new Error('Ticket already claimed or does not exist');
      }

      await connection.commit();
      return true;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async reassignTicket(ticketId: number, toMemberId: number, toGroupId: number): Promise<void> {
    const sql = `
      UPDATE ticket_routing_state
      SET assigned_member_id = ?, current_group_id = ?, status = 'ASSIGNED', updated_at = CURRENT_TIMESTAMP
      WHERE ticket_id = ?
    `;
    await execute(sql, [toMemberId, toGroupId, ticketId]);
  }

  async escalateTicket(ticketId: number, toGroupId: number): Promise<boolean> {
    const sql = `
      UPDATE ticket_routing_state
      SET current_group_id = ?, status = 'ESCALATED',
          escalation_count = escalation_count + 1,
          last_escalated_at = CURRENT_TIMESTAMP,
          assigned_member_id = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE ticket_id = ?
    `;
    const result = await execute(sql, [toGroupId, ticketId]);
    return result.affectedRows > 0;
  }

  async updateStatus(ticketId: number, status: RoutingStatus): Promise<void> {
    const sql = `
      UPDATE ticket_routing_state
      SET status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE ticket_id = ?
    `;
    await execute(sql, [status, ticketId]);
  }

  async getEscalationCount(ticketId: number): Promise<number> {
    const sql = `SELECT escalation_count FROM ticket_routing_state WHERE ticket_id = ?`;
    const rows = await query<RoutingStateRowData[]>(sql, [ticketId]);
    return rows[0]?.escalation_count ?? 0;
  }

  async getGroupTickets(groupId: number): Promise<TicketRoutingStateRow[]> {
    const sql = `
      SELECT * FROM ticket_routing_state
      WHERE current_group_id = ?
      ORDER BY updated_at DESC
    `;
    return query<RoutingStateRowData[]>(sql, [groupId]);
  }

  async getMemberTickets(memberId: number): Promise<TicketRoutingStateRow[]> {
    const sql = `
      SELECT * FROM ticket_routing_state
      WHERE assigned_member_id = ? AND status = 'ASSIGNED'
      ORDER BY claimed_at DESC
    `;
    return query<RoutingStateRowData[]>(sql, [memberId]);
  }
}
