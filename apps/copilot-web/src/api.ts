// SPDX-License-Identifier: Apache-2.0

/**
 * Typed client for the Lux API. All wrappers surface server-provided error
 * messages and never assume a response shape beyond the declared types.
 */

export const API_BASE: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';

export type Channel = 'whatsapp' | 'email' | 'phone';

export interface ClientTaste {
  preferredBrands: string[];
  sizes: Record<string, string>;
  interests: string[];
}

export interface Client {
  id: string;
  displayName: string;
  email?: string;
  phone?: string;
  language: string;
  timezone?: string;
  notes?: string;
  taste: ClientTaste;
  createdAt: string;
}

export interface Interaction {
  id: string;
  clientId: string;
  at: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  summary: string;
  advisorId?: string;
}

export type DraftStatus = 'pending_approval' | 'approved' | 'rejected';

export interface Draft {
  id: string;
  clientId: string;
  channel: string;
  intentHint?: string;
  text: string;
  status: DraftStatus;
  createdAt: string;
  approvedAt?: string;
}

export interface ClientDetail {
  client: Client;
  interactions: Interaction[];
}

export interface NewClientInput {
  displayName: string;
  email?: string;
  phone?: string;
  language: string;
  timezone?: string;
  notes?: string;
  taste: ClientTaste;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body !== null && typeof body === 'object') {
      const message: unknown = (body as { message?: unknown }).message;
      if (typeof message === 'string' && message !== '') return message;
      const error: unknown = (body as { error?: unknown }).error;
      if (typeof error === 'string' && error !== '') return error;
    }
  } catch {
    // Non-JSON error body; fall through to the status line.
  }
  return `Request failed (${response.status} ${response.statusText || 'Error'})`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && headers.get('Content-Type') === null) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (cause: unknown) {
    const reason = cause instanceof Error ? cause.message : 'unknown cause';
    throw new Error(`Unable to reach the Lux API (${reason}).`);
  }

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const raw = await response.text();
  if (raw === '') return undefined as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('The Lux API returned an invalid response.');
  }
}

export function listClients(): Promise<Client[]> {
  return request<Client[]>('/clients');
}

export function getClient(id: string): Promise<ClientDetail> {
  return request<ClientDetail>(`/clients/${encodeURIComponent(id)}`);
}

export function createClient(input: NewClientInput): Promise<Client> {
  return request<Client>('/clients', { method: 'POST', body: JSON.stringify(input) });
}

export function draftReply(input: { clientId: string; channel: Channel; intentHint?: string }): Promise<Draft> {
  return request<Draft>('/drafts', { method: 'POST', body: JSON.stringify(input) });
}

export function approveDraft(id: string, text?: string): Promise<Draft> {
  const payload = text === undefined ? {} : { text };
  return request<Draft>(`/drafts/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function rejectDraft(id: string): Promise<Draft> {
  return request<Draft>(`/drafts/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export function listDrafts(clientId: string): Promise<Draft[]> {
  return request<Draft[]>(`/drafts?clientId=${encodeURIComponent(clientId)}`);
}
