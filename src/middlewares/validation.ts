import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

/**
 * Validation Middleware Factory (TypeScript)
 *
 * Creates middleware that validates req.body against a Joi schema.
 */
export function validateBody(schema: Joi.ObjectSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      const details = error.details.map((d) => d.message).join(', ');
      res.status(400).json({ success: false, error: `Validation failed: ${details}` });
      return;
    }

    next();
  };
}

// ── Predefined Schemas ──

export const routeTicketSchema = Joi.object({
  ticketId: Joi.number().integer().required(),
  building: Joi.string().required(),
  floor: Joi.number().integer().required(),
});

export const claimTicketSchema = Joi.object({
  userId: Joi.number().integer().required(),
});

export const reassignTicketSchema = Joi.object({
  userId: Joi.number().integer().required(),
  toMemberId: Joi.number().integer().required(),
  userRole: Joi.string().valid('JUNIOR', 'SENIOR', 'SUPERVISOR', 'HEAD_OF_IT').required(),
  userBuilding: Joi.string().optional(),
});

export const escalateTicketSchema = Joi.object({
  triggerType: Joi.string().valid('SLA', 'MANUAL', 'CRITICAL', 'REOPEN_COUNT').required(),
  performedBy: Joi.number().integer().optional(),
  userRole: Joi.when('triggerType', {
    is: 'MANUAL',
    then: Joi.string().valid('SENIOR', 'SUPERVISOR').required(),
    otherwise: Joi.string().optional(),
  }),
});
