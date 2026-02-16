import { RowDataPacket } from 'mysql2/promise';
import { query, execute } from '../config/database';
import { SupportGroupRow, GroupMemberRow } from '../interfaces/types';

/**
 * Support Groups Repository (TypeScript)
 */

// Extend RowDataPacket for mysql2 type compatibility
interface SupportGroupRowData extends SupportGroupRow, RowDataPacket {}
interface GroupMemberRowData extends GroupMemberRow, RowDataPacket {}

export class SupportGroupRepository {
  async getGroupByBuildingAndFloor(building: string, floor: number): Promise<SupportGroupRow | null> {
    const sql = `
      SELECT * FROM support_groups
      WHERE building = ? AND floor = ? AND is_active = TRUE
    `;
    const rows = await query<SupportGroupRowData[]>(sql, [building, floor]);
    return rows[0] ?? null;
  }

  async getGroupsByBuilding(building: string): Promise<SupportGroupRow[]> {
    const sql = `
      SELECT * FROM support_groups
      WHERE building = ? AND is_active = TRUE
      ORDER BY floor ASC
    `;
    return query<SupportGroupRowData[]>(sql, [building]);
  }

  async getGroupById(groupId: number): Promise<SupportGroupRow | null> {
    const sql = `SELECT * FROM support_groups WHERE id = ?`;
    const rows = await query<SupportGroupRowData[]>(sql, [groupId]);
    return rows[0] ?? null;
  }

  async createGroup(
    name: string,
    building: string,
    floor: number,
    parentGroupId: number | null = null,
  ): Promise<{ id: number; name: string; building: string; floor: number; parent_group_id: number | null }> {
    const sql = `
      INSERT INTO support_groups (name, building, floor, parent_group_id, is_active)
      VALUES (?, ?, ?, ?, TRUE)
    `;
    const result = await execute(sql, [name, building, floor, parentGroupId]);
    return { id: result.insertId, name, building, floor, parent_group_id: parentGroupId };
  }

  async getGroupMembers(groupId: number): Promise<GroupMemberRow[]> {
    const sql = `
      SELECT * FROM group_members
      WHERE group_id = ? AND status = 'ACTIVE'
      ORDER BY role DESC, joined_at ASC
    `;
    return query<GroupMemberRowData[]>(sql, [groupId]);
  }

  async getGroupSenior(groupId: number): Promise<GroupMemberRow | null> {
    const sql = `
      SELECT * FROM group_members
      WHERE group_id = ? AND role = 'SENIOR' AND status = 'ACTIVE'
      LIMIT 1
    `;
    const rows = await query<GroupMemberRowData[]>(sql, [groupId]);
    return rows[0] ?? null;
  }

  async getGroupJuniors(groupId: number): Promise<GroupMemberRow[]> {
    const sql = `
      SELECT * FROM group_members
      WHERE group_id = ? AND role = 'JUNIOR' AND status = 'ACTIVE'
      ORDER BY joined_at ASC
    `;
    return query<GroupMemberRowData[]>(sql, [groupId]);
  }
}
