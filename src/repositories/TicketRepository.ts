import { RowDataPacket } from 'mysql2/promise';
import { execute, query } from '../config/database';

interface WorkloadRow extends RowDataPacket {
  technician_id: number;
  workload_count: number;
}

/**
 * Ticket Repository
 *
 * Thin wrapper over ticket table for workload & assignment.
 * Assumes tickets table has columns: id, assigned_to, status.
 */
export class TicketRepository {
  /**
   * Ensure ticket exists locally so workload calculations work.
   * Only stores id/status to match minimal tickets schema.
   */
  async upsertTicket(ticketId: string): Promise<void> {
    await execute(
      `
        INSERT INTO tickets (id, status)
        VALUES (?, 'OPEN')
        ON DUPLICATE KEY UPDATE
          updated_at = CURRENT_TIMESTAMP
      `,
      [ticketId],
    );
  }

  async getWorkloadMap(): Promise<Record<number, number>> {
    const rows = await query<WorkloadRow[]>(
      `
        SELECT assigned_to AS technician_id, COUNT(*) AS workload_count
        FROM tickets
        WHERE assigned_to IS NOT NULL
          AND status IN ('OPEN', 'IN_PROGRESS')
        GROUP BY assigned_to
      `,
    );

    const map: Record<number, number> = {};
    rows.forEach((r) => {
      if (r.technician_id !== null) {
        map[r.technician_id] = r.workload_count;
      }
    });
    return map;
  }

  async isAlreadyAssigned(ticketId: string): Promise<boolean> {
    const rows = await query<RowDataPacket[]>(
      `SELECT assigned_to FROM tickets WHERE id = ? AND assigned_to IS NOT NULL LIMIT 1`,
      [ticketId],
    );
    return rows.length > 0;
  }

  async assignTicket(ticketId: string, technicianId: number): Promise<void> {
    const result = await execute(
      `
        UPDATE tickets
        SET assigned_to = ?, status = 'IN_PROGRESS'
        WHERE id = ?
      `,
      [technicianId, ticketId],
    );

    if (result.affectedRows === 0) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
  }
}
