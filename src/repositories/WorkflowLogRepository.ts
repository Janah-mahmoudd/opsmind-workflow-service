import { RowDataPacket } from 'mysql2/promise';
import { query, execute } from '../config/database';
import { WorkflowLogRow, WorkflowAction, WorkflowLogData } from '../interfaces/types';

interface WorkflowLogRowData extends WorkflowLogRow, RowDataPacket {}

/**
 * Workflow Logs Repository (TypeScript)
 *
 * Immutable audit trail — only INSERT operations.
 * Never UPDATE or DELETE logs.
 */
export class WorkflowLogRepository {
  async logAction(ticketId: number, action: WorkflowAction, data: WorkflowLogData = {}): Promise<{ id: number }> {
    const sql = `
      INSERT INTO workflow_logs
        (ticket_id, action, from_group_id, to_group_id, from_member_id, to_member_id, performed_by, reason)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await execute(sql, [
      ticketId,
      action,
      data.from_group_id ?? null,
      data.to_group_id ?? null,
      data.from_member_id ?? null,
      data.to_member_id ?? null,
      data.performed_by ?? null,
      data.reason ?? null,
    ]);
    return { id: result.insertId };
  }

  async getTicketLogs(ticketId: number): Promise<WorkflowLogRow[]> {
    const sql = `
      SELECT * FROM workflow_logs
      WHERE ticket_id = ?
      ORDER BY created_at DESC
    `;
    return query<WorkflowLogRowData[]>(sql, [ticketId]);
  }

  async getMemberLogs(memberId: number, limit: number = 100): Promise<WorkflowLogRow[]> {
    const sql = `
      SELECT * FROM workflow_logs
      WHERE from_member_id = ? OR to_member_id = ? OR performed_by = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return query<WorkflowLogRowData[]>(sql, [memberId, memberId, memberId, limit]);
  }

  async getGroupLogs(groupId: number, limit: number = 100): Promise<WorkflowLogRow[]> {
    const sql = `
      SELECT * FROM workflow_logs
      WHERE from_group_id = ? OR to_group_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return query<WorkflowLogRowData[]>(sql, [groupId, groupId, limit]);
  }

  async getRecentLogs(limit: number = 50, minutesBack: number = 60): Promise<WorkflowLogRow[]> {
    const sql = `
      SELECT * FROM workflow_logs
      WHERE created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
      ORDER BY created_at DESC
      LIMIT ?
    `;
    return query<WorkflowLogRowData[]>(sql, [minutesBack, limit]);
  }
}
