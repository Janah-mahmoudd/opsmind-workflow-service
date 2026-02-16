import { Request, Response } from 'express';
import { RoutingService } from '../services/RoutingService';

/**
 * Routing Controller (TypeScript)
 */
export class RoutingController {
  private routingService = new RoutingService();

  /** POST /workflow/route-ticket */
  routeTicket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ticketId, building, floor } = req.body;

      if (!ticketId || !building || floor === undefined) {
        res.status(400).json({ success: false, error: 'Missing required fields: ticketId, building, floor' });
        return;
      }

      const result = await this.routingService.routeTicket(ticketId, building, floor);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      console.error('Routing error:', error);
      res.status(400).json({ success: false, error: error.message });
    }
  };

  /** GET /workflow/ticket/:ticketId/routing */
  getTicketRouting = async (req: Request, res: Response): Promise<void> => {
    try {
      const ticketId = parseInt(req.params.ticketId, 10);
      const routing = await this.routingService.getTicketRouting(ticketId);

      if (!routing) {
        res.status(404).json({ success: false, error: `Ticket ${ticketId} not found in workflow system` });
        return;
      }

      res.status(200).json({ success: true, data: routing });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** GET /workflow/group/:groupId/queue */
  getGroupQueue = async (req: Request, res: Response): Promise<void> => {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      const queue = await this.routingService.getGroupQueue(groupId);
      res.status(200).json({ success: true, data: { groupId, tickets: queue } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };

  /** GET /workflow/group/:groupId/info */
  getGroupInfo = async (req: Request, res: Response): Promise<void> => {
    try {
      const groupId = parseInt(req.params.groupId, 10);
      const info = await this.routingService.getGroupInfo(groupId);

      if (!info) {
        res.status(404).json({ success: false, error: `Group ${groupId} not found` });
        return;
      }

      res.status(200).json({ success: true, data: info });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  };
}
