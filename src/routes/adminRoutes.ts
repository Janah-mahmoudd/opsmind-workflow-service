import { Router } from 'express';
import { SupportGroupRepository } from '../repositories/SupportGroupRepository';
import { GroupMemberRepository } from '../repositories/GroupMemberRepository';
import { EscalationRuleRepository } from '../repositories/EscalationRuleRepository';
import { Request, Response } from 'express';
import { MemberRole, EscalationTrigger } from '../interfaces/types';

/**
 * Admin Routes
 *
 * For managing support groups, members, and escalation rules.
 * Used during setup or by administrators.
 */

const router = Router();
const groupRepo = new SupportGroupRepository();
const memberRepo = new GroupMemberRepository();
const ruleRepo = new EscalationRuleRepository();

// ── Support Groups ──

router.post('/groups', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, building, floor, parentGroupId } = req.body;
    if (!name || !building || floor === undefined) {
      res.status(400).json({ success: false, error: 'Missing: name, building, floor' });
      return;
    }
    const group = await groupRepo.createGroup(name, building, floor, parentGroupId ?? null);
    res.status(201).json({ success: true, data: group });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/groups/building/:building', async (req: Request, res: Response): Promise<void> => {
  try {
    const groups = await groupRepo.getGroupsByBuilding(req.params.building);
    res.status(200).json({ success: true, data: groups });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/groups/:groupId', async (req: Request, res: Response): Promise<void> => {
  try {
    const group = await groupRepo.getGroupById(parseInt(req.params.groupId, 10));
    if (!group) { res.status(404).json({ success: false, error: 'Group not found' }); return; }
    res.status(200).json({ success: true, data: group });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/groups/:groupId/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const members = await groupRepo.getGroupMembers(parseInt(req.params.groupId, 10));
    res.status(200).json({ success: true, data: members });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Group Members ──

router.post('/members', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, groupId, role, canAssign, canEscalate } = req.body;
    if (!userId || !groupId || !role) {
      res.status(400).json({ success: false, error: 'Missing: userId, groupId, role' });
      return;
    }
    const member = await memberRepo.addMember(
      userId,
      groupId,
      role as MemberRole,
      canAssign ?? false,
      canEscalate ?? false,
    );
    res.status(201).json({ success: true, data: member });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/members/:memberId', async (req: Request, res: Response): Promise<void> => {
  try {
    const member = await memberRepo.getMemberById(parseInt(req.params.memberId, 10));
    if (!member) { res.status(404).json({ success: false, error: 'Member not found' }); return; }
    res.status(200).json({ success: true, data: member });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.patch('/members/:memberId/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body;
    await memberRepo.updateMemberStatus(parseInt(req.params.memberId, 10), status);
    res.status(200).json({ success: true, message: 'Status updated' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ── Escalation Rules ──

router.post('/escalation-rules', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceGroupId, targetGroupId, triggerType, delayMinutes, priority } = req.body;
    if (!sourceGroupId || !targetGroupId || !triggerType) {
      res.status(400).json({ success: false, error: 'Missing: sourceGroupId, targetGroupId, triggerType' });
      return;
    }
    const rule = await ruleRepo.createRule(
      sourceGroupId,
      targetGroupId,
      triggerType as EscalationTrigger,
      delayMinutes ?? 0,
      priority ?? 0,
    );
    res.status(201).json({ success: true, data: rule });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/escalation-rules', async (_req: Request, res: Response): Promise<void> => {
  try {
    const rules = await ruleRepo.getAllRules();
    res.status(200).json({ success: true, data: rules });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
