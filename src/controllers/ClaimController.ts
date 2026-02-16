import { Request, Response } from 'express';
import { ClaimService } from '../services/ClaimService';

/**
 * Claim Controller (TypeScript)
 */
export class ClaimController {
  private claimService = new ClaimService();

  /** POST /workflow/claim/:ticketId */
  claimTicket = async (req: Request, res: Response): Promise<void> => {
    try {
      const ticketId = parseInt(req.params.ticketId, 10);
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({ success: false, error: 'Missing required field: userId' });
        return;
      }

      const result = await this.claimService.claimTicket(ticketId, userId);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Claim error:', error);

      if (error.message.includes('already claimed')) {
        res.status(409).json({ success: false, error: error.message });
        return;
      }

      res.status(400).json({ success: false, error: error.message });
    }
  };

  /** GET /workflow/claim/:ticketId/status */
  getClaimStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const ticketId = parseInt(req.params.ticketId, 10);
      const claimed = await this.claimService.isTicketClaimed(ticketId);
      res.status(200).json({ success: true, data: { ticketId, claimed } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** GET /workflow/group/:groupId/unclaimed */
  getUnclaimedTickets = async (req: Request, res: Response): Promise<void> => {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      const tickets = await this.claimService.getUnclaimedTickets(groupId);
      res.status(200).json({ success: true, data: { groupId, unclaimedTickets: tickets, count: tickets.length } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}
