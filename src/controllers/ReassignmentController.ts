import { Request, Response } from 'express';
import { ReassignmentService } from '../services/ReassignmentService';
import { UserRole } from '../interfaces/types';

/**
 * Reassignment Controller (TypeScript)
 */
export class ReassignmentController {
  private reassignmentService = new ReassignmentService();

  /** POST /workflow/reassign/:ticketId */
  reassignTicket = async (req: Request, res: Response): Promise<void> => {
    try {
      const ticketId = req.params.ticketId;
      const { userId, toMemberId, userRole, userBuilding } = req.body;

      if (!userId || !toMemberId || !userRole) {
        res.status(400).json({ success: false, error: 'Missing required fields: userId, toMemberId, userRole' });
        return;
      }

      const result = await this.reassignmentService.reassignTicket(
        ticketId,
        userId,
        toMemberId,
        userRole as UserRole,
        userBuilding,
      );

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Reassignment error:', error);

      if (error.message.includes('can only reassign')) {
        res.status(403).json({ success: false, error: error.message });
        return;
      }

      res.status(400).json({ success: false, error: error.message });
    }
  };

  /** GET /workflow/reassign/:ticketId/targets */
  getReassignmentTargets = async (req: Request, res: Response): Promise<void> => {
    try {
      const ticketId = req.params.ticketId;
      const { groupId, userRole, userBuilding } = req.query;

      if (!groupId || !userRole) {
        res.status(400).json({ success: false, error: 'Missing required query params: groupId, userRole' });
        return;
      }

      const targets = await this.reassignmentService.getAvailableTargets(
        parseInt(groupId as string, 10),
        userRole as UserRole,
        userBuilding as string | undefined,
      );

      res.status(200).json({ success: true, data: { ticketId, availableTargets: targets, count: targets.length } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}
