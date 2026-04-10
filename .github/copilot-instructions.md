# OpsMind Workflow Service

Ticket assignment and workflow orchestrator for university IT management. Assigns tickets to optimal technicians using location-based scoring (haversine distance + workload), and manages multi-tier escalation chains with SLA tracking. Support groups are used for claim/escalation/reassignment workflows, not for initial assignment.

## Architecture

**Layered architecture** with clear separation:
- **Controllers** → HTTP request handling, validation
- **Services** → Business logic (assignment, escalation, claiming, reassignment)
- **Repositories** → Data access layer (thin wrappers over raw SQL)
- **Middleware** → Auth, validation, logging, error handling
- **Background Jobs** → RabbitMQ consumer (ticket.created), SLA monitor (60s interval)

Key reference files:
- [src/services/AssignmentService.ts](../src/services/AssignmentService.ts) - Location-based assignment with priority-weighted scoring
- [src/repositories/SupportGroupRepository.ts](../src/repositories/SupportGroupRepository.ts) - Repository pattern with dynamic SQL building
- [src/middlewares/auth.ts](../src/middlewares/auth.ts) - JWT authentication and RBAC implementation

## Build and Test

```bash
# Development
npm install
npm run dev           # ts-node-dev with hot reload

# Production build
npm run build         # Compiles TypeScript to dist/
npm start            # Runs compiled code from dist/

# Testing
npm test             # Jest (config/tests not yet implemented)

# Docker
docker-compose up    # Requires external 'opsmind-net' network and MySQL
```

**Database setup:** Run [db/init.sql](../db/init.sql) then [db/seed.sql](../db/seed.sql).  
**Docker race condition:** [config/database.ts](../src/config/database.ts#L35) `waitForDatabase()` handles MySQL startup delays.

## External Service Dependencies

This service integrates with:
1. **Auth Service** (`opsmind-auth-service:3002`) - User validation, role verification
2. **Ticket Service** (`opsmind-ticket-service:3000`) - Authoritative ticket store, assignment updates
3. **RabbitMQ** (`opsmind-rabbitmq:5672`) - Consumes `ticket.created`, publishes `ticket.assigned`
4. **MySQL** - Workflow state, routing rules, SLA tracking

Typed clients in [config/externalServices.ts](../src/config/externalServices.ts).

## Code Conventions

### Database Access
**No ORM.** Use custom typed wrapper in [config/database.ts](../src/config/database.ts):
```typescript
// Query with type safety
const rows = await query<Technician[]>('SELECT * FROM technicians WHERE status = ?', ['ACTIVE']);

// Transactions
const connection = await beginTransaction();
try {
  await connection.execute(sql1, params1);
  await connection.commit();
} catch (err) {
  await connection.rollback();
}
```

**Repository pattern:**
- Extend `RowDataPacket` for type safety: `interface TechnicianRowData extends TechnicianRow, RowDataPacket {}`
- Parameter binding (never string concatenation)
- Return domain types from [interfaces/types.ts](../src/interfaces/types.ts)
- Keep business logic in services, not repositories

### Authentication & Authorization
JWT-based with role hierarchy: `REQUESTER < JUNIOR < SENIOR < SUPERVISOR < ADMIN`

Three middleware variants in [middlewares/auth.ts](../src/middlewares/auth.ts):
- `requireAuth` → 401 if token missing/invalid
- `optionalAuth` → Extracts user if present, always continues (used globally on workflow routes)
- `requireRole(...roles)` → 403 if insufficient permissions

Access via `req.user: AuthUser` (includes id, role, building, supportGroupId, technicianLevel).

### Validation
Joi schemas in [middlewares/validation.ts](../src/middlewares/validation.ts). Apply via factory:
```typescript
router.post('/route', validateBody(routeTicketSchema), controller.routeTicket);
```

### Error Handling
Throw plain `Error` objects in services:
```typescript
throw new Error('Ticket already assigned to another technician');
```

Global handler in [middlewares/errorHandler.ts](../src/middlewares/errorHandler.ts) formats responses. Custom status codes via `(err as any).statusCode = 404`.

### API Documentation
**Centralized Swagger config** in [config/swagger.ts](../src/config/swagger.ts). All schemas/paths defined programmatically (no JSDoc annotations in routes). View at `/api-docs`.

### Application Factory Pattern
[src/app.ts](../src/app.ts) exports `createApp()` (separates creation from startup). [src/index.ts](../src/index.ts) handles database wait, server startup, background jobs, and graceful shutdown.

### Background Jobs
- **SLA Monitor:** Runs every 60s ([jobs/slaMonitor.ts](../src/jobs/slaMonitor.ts)), auto-escalates breached tickets
- **Assignment Consumer:** RabbitMQ listener ([jobs/assignmentConsumer.ts](../src/jobs/assignmentConsumer.ts)), uses haversine distance + workload scoring

## Key Domain Concepts

- **Assignment:** Location-based with priority-weighted scoring: `score = weights.distance * norm_distance + weights.workload * norm_workload` (lower wins). Technicians are selected by coordinates, not building/floor.
- **Priority Weights:** CRITICAL/HIGH favor proximity (0.7 distance, 0.3 workload), MEDIUM balanced (0.5/0.5), LOW favors least-busy (0.3 distance, 0.7 workload)
- **Claiming:** Technicians self-assign unassigned tickets in their group (uses support groups for workflow management)
- **Reassignment:** Transfer between members (role-based restrictions, uses support groups)
- **Escalation:** Two-tier chain (Floor→Building Senior→University Supervisor) triggered by SLA/MANUAL/CRITICAL/REOPEN_COUNT (uses support groups)
- **SLA Priorities:** CRITICAL(60min), HIGH(120min), MEDIUM(240min), LOW(480min)

## Common Pitfalls

- **Docker startup:** Service may start before MySQL is ready. Always use `waitForDatabase()` pattern.
- **Transaction rollback:** Don't forget `finally { connection.release(); }` in transaction blocks.
- **Auth middleware order:** Apply `optionalAuth` before `requireRole()`.
- **External service calls:** Use typed clients from [config/externalServices.ts](../src/config/externalServices.ts), not raw axios.
- **Geo calculations:** Use [utils/geo.ts](../src/utils/geo.ts) `haversineDistance()` for consistent distance calculations.
- **Audit logging:** Always create workflow logs via `WorkflowLogRepository` for state changes.
