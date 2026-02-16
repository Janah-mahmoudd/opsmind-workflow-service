import axios, { AxiosInstance } from 'axios';
import { ExternalTicket, ExternalUser } from '../interfaces/types';

/**
 * External Service Clients (TypeScript)
 *
 * - Docker container names used as hostnames
 * - Typed responses for type-safety
 * - Timeout configuration prevents hanging requests
 */

const AUTH_SERVICE_URL: string = process.env.AUTH_SERVICE_URL || 'http://opsmind-auth-service:3002';
const TICKET_SERVICE_URL: string = process.env.TICKET_SERVICE_URL || 'http://opsmind-ticket-service:3000';

// ---------- Axios Instances ----------

export const authServiceClient: AxiosInstance = axios.create({
  baseURL: AUTH_SERVICE_URL,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
});

export const ticketServiceClient: AxiosInstance = axios.create({
  baseURL: TICKET_SERVICE_URL,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
});

// ---------- Auth Service Helpers ----------

export async function validateUser(userId: number): Promise<ExternalUser> {
  const { data } = await authServiceClient.get<ExternalUser>(`/users/${userId}`);
  return data;
}

export async function getUserRole(userId: number): Promise<{ role: string }> {
  const { data } = await authServiceClient.get<{ role: string }>(`/users/${userId}/role`);
  return data;
}

// ---------- Ticket Service Helpers ----------

export async function getTicket(ticketId: number): Promise<ExternalTicket> {
  const { data } = await ticketServiceClient.get<ExternalTicket>(`/tickets/${ticketId}`);
  return data;
}

export async function assignTicket(
  ticketId: number,
  userId: number,
  status: string = 'IN_PROGRESS',
): Promise<any> {
  const { data } = await ticketServiceClient.patch(`/tickets/${ticketId}/assign`, {
    assigned_to: userId,
    status,
  });
  return data;
}

export async function updateTicketStatus(ticketId: number, status: string): Promise<any> {
  const { data } = await ticketServiceClient.patch(`/tickets/${ticketId}/status`, { status });
  return data;
}

export async function escalateTicket(ticketId: number, escalatedTo: number): Promise<any> {
  const { data } = await ticketServiceClient.patch(`/tickets/${ticketId}/escalate`, {
    escalated_to: escalatedTo,
  });
  return data;
}
