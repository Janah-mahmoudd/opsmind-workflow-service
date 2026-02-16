import { Router } from 'express';
import { RoutingController } from '../controllers/RoutingController';
import { ClaimController } from '../controllers/ClaimController';
import { ReassignmentController } from '../controllers/ReassignmentController';
import { EscalationController } from '../controllers/EscalationController';
import { MonitoringController } from '../controllers/MonitoringController';

const router = Router();

// ── Controller instances ──
const routingCtrl = new RoutingController();
const claimCtrl = new ClaimController();
const reassignCtrl = new ReassignmentController();
const escalationCtrl = new EscalationController();
const monitorCtrl = new MonitoringController();

// ══════════════════════════════════════
//  Routing
// ══════════════════════════════════════
router.post('/route-ticket', routingCtrl.routeTicket);
router.get('/ticket/:ticketId/routing', routingCtrl.getTicketRouting);
router.get('/group/:groupId/queue', routingCtrl.getGroupQueue);
router.get('/group/:groupId/info', routingCtrl.getGroupInfo);

// ══════════════════════════════════════
//  Claim-on-Open
// ══════════════════════════════════════
router.post('/claim/:ticketId', claimCtrl.claimTicket);
router.get('/claim/:ticketId/status', claimCtrl.getClaimStatus);
router.get('/group/:groupId/unclaimed', claimCtrl.getUnclaimedTickets);

// ══════════════════════════════════════
//  Reassignment
// ══════════════════════════════════════
router.post('/reassign/:ticketId', reassignCtrl.reassignTicket);
router.get('/reassign/:ticketId/targets', reassignCtrl.getReassignmentTargets);

// ══════════════════════════════════════
//  Escalation
// ══════════════════════════════════════
router.post('/escalate/:ticketId', escalationCtrl.escalateTicket);
router.get('/escalate/:ticketId/history', escalationCtrl.getEscalationHistory);
router.get('/group/:groupId/escalation-path', escalationCtrl.getEscalationPath);

// ══════════════════════════════════════
//  Dashboards & Monitoring
// ══════════════════════════════════════
router.get('/dashboard/audit/:ticketId', monitorCtrl.getAuditTrail);
router.get('/dashboard/building/:buildingId', monitorCtrl.getBuildingDashboard);
router.get('/dashboard/member/:memberId', monitorCtrl.getMemberDashboard);
router.get('/dashboard/group/:groupId/metrics', monitorCtrl.getGroupMetrics);
router.get('/dashboard/activity/recent', monitorCtrl.getRecentActivity);

export default router;
