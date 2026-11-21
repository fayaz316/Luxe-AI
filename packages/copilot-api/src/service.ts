// SPDX-License-Identifier: Apache-2.0
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import cors from '@fastify/cors';
import type { ModelProvider } from '@luxe/model-gateway';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Store } from './store.js';
import type { Client, ClientRequest, Draft, Interaction, InteractionChannel } from './types.js';
import { runDemoBurst } from './demo.js';

export const SERVICE_NAME = 'copilot-api';
export const SERVICE_VERSION = '0.1.0';

export interface BuildServerOptions {
  store: Store;
  provider: ModelProvider;
  /**
   * Registers the demonstration-only routes (SEED_DEMO deployments). These
   * operate exclusively on the fictional seeded client base.
   */
  demoMode?: boolean;
  /**
   * Optional shared secret. When set, every request must carry it in the
   * `x-api-key` header, except the health check and the WhatsApp webhook
   * (which Meta calls without application headers and authenticates via its
   * own verification mechanism).
   */
  apiKey?: string;
}

/** Constant-time comparison of digests so the key length never leaks. */
function apiKeyMatches(presented: string | undefined, expected: string): boolean {
  if (typeof presented !== 'string' || presented.length === 0) return false;
  const presentedDigest = createHash('sha256').update(presented).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(presentedDigest, expectedDigest);
}

const API_KEY_EXEMPT_PREFIXES = ['/health', '/webhook/whatsapp'];

/**
 * System prompt for drafted client communications. Establishes the restrained
 * luxury tone and the hard boundaries: no promises of allocation or discounts,
 * no invented facts, no automatic sign-offs.
 */
const DRAFT_SYSTEM_PROMPT = [
  'You draft client communications on behalf of an advisor at a luxury hotel and dining property.',
  'Tone: restrained, polished, and warm without being familiar.',
  'Keep the draft brief, at most 120 words.',
  'Never promise table allocation, availability, upgrades, or discounts.',
  'Never invent facts such as dates, prices, names, or reservations that are not in the client record.',
  'Do not add a signature or sign-off; the advisor signs every message personally.',
  'Return only the message body, ready for advisor review and approval.',
].join(' ');

const CHANNELS: readonly InteractionChannel[] = ['whatsapp', 'email', 'phone', 'in-person'];

/** Number of most-recent interactions included in a draft prompt. */
const INTERACTION_WINDOW = 8;

/** Maximum length stored for interaction summaries. */
const SUMMARY_MAX_LENGTH = 280;

const DEFAULT_WHATSAPP_VERIFY_TOKEN = 'luxe-dev-verify';

interface WhatsAppWebhookPayload {
  entry?: readonly WhatsAppWebhookEntry[];
}

interface WhatsAppWebhookEntry {
  changes?: readonly WhatsAppWebhookChange[];
}

interface WhatsAppWebhookChange {
  value?: WhatsAppWebhookValue;
}

interface WhatsAppWebhookValue {
  messages?: readonly WhatsAppInboundMessage[];
}

interface WhatsAppInboundMessage {
  from?: string;
  /** Unix seconds, as sent by Meta. */
  timestamp?: string;
  type?: string;
  text?: { body?: string };
}

function isInteractionChannel(value: unknown): value is InteractionChannel {
  return typeof value === 'string' && (CHANNELS as readonly string[]).includes(value);
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1)}…`;
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

/** Oldest first, by timestamp. */
function oldestFirst<T extends Interaction>(interactions: readonly T[]): T[] {
  return [...interactions].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Newest first, by creation timestamp. */
function newestFirst<T extends Draft>(drafts: readonly T[]): T[] {
  return [...drafts].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Builds the user message for a draft request from the client record and recent history. */
export function buildDraftPrompt(
  client: Client,
  interactions: readonly Interaction[],
  channel: InteractionChannel,
  intentHint?: string,
): string {
  const lines: string[] = [];
  lines.push(`Client: ${client.displayName}`);
  lines.push(`Preferred language: ${client.language}`);
  if (client.timezone) lines.push(`Timezone: ${client.timezone}`);
  if (client.notes) lines.push(`Notes: ${client.notes}`);
  if (client.taste.preferredBrands.length > 0) {
    lines.push(`Preferred brands: ${client.taste.preferredBrands.join(', ')}`);
  }
  const sizes = Object.entries(client.taste.sizes);
  if (sizes.length > 0) {
    lines.push(`Sizes: ${sizes.map(([kind, size]) => `${kind} ${size}`).join(', ')}`);
  }
  if (client.taste.interests.length > 0) {
    lines.push(`Interests: ${client.taste.interests.join(', ')}`);
  }
  if (interactions.length > 0) {
    lines.push('Recent interactions (oldest first):');
    for (const interaction of interactions) {
      lines.push(`- ${interaction.at} ${interaction.direction} ${interaction.channel}: ${interaction.summary}`);
    }
  } else {
    lines.push('Recent interactions: none recorded.');
  }
  if (intentHint) lines.push(`Advisor intent: ${intentHint}`);
  lines.push(`Draft a ${channel} message to the client following the rules above.`);
  return lines.join('\n');
}

function toIso(unixSeconds: string | undefined): string {
  const seconds = Number(unixSeconds);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString();
}

function matchClientIdByPhone(clients: readonly Client[], from: string | undefined): string | undefined {
  if (!from) return undefined;
  const digits = normalizePhoneDigits(from);
  if (digits.length === 0) return undefined;
  const match = clients.find((client) => {
    const clientDigits = client.phone ? normalizePhoneDigits(client.phone) : '';
    return clientDigits.length > 0 && clientDigits === digits;
  });
  return match?.id;
}

/**
 * Builds the Fastify instance for the copilot API. Configuration (store and
 * model provider) is injected so tests never touch a network or a database.
 *
 * Logging hygiene: requests are logged with the default serializers (method,
 * url, host — never bodies), and the authorization header is redacted.
 */
export function buildServer(options: BuildServerOptions): FastifyInstance {
  const { store, provider } = options;

  const app = Fastify({
    logger: {
      level: 'info',
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["x-api-key"]'],
        censor: '[redacted]',
      },
    },
  });

  if (options.apiKey !== undefined && options.apiKey !== '') {
    const expectedKey = options.apiKey;
    app.addHook('onRequest', async (request, reply) => {
      // CORS preflights carry no application headers; the actual request
      // that follows is still authenticated below.
      if (request.method === 'OPTIONS') {
        return;
      }
      const path = request.url.split('?')[0] ?? request.url;
      if (API_KEY_EXEMPT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))) {
        return;
      }
      const presented = request.headers['x-api-key'];
      const presentedValue = Array.isArray(presented) ? presented[0] : presented;
      if (!apiKeyMatches(presentedValue, expectedKey)) {
        return reply.code(401).send({ error: 'unauthorized' });
      }
    });
  }

  void app.register(cors, { origin: true });

  app.get('/health', async () => ({
    ok: true,
    service: SERVICE_NAME,
    version: SERVICE_VERSION,
  }));

  app.get('/clients', async () => store.listClients());

  app.post('/clients', async (request, reply) => {
    const body = request.body as Partial<Omit<Client, 'id' | 'createdAt'>> | undefined;
    const displayName = typeof body?.displayName === 'string' ? body.displayName.trim() : '';
    const language = typeof body?.language === 'string' ? body.language.trim() : '';
    if (!displayName || !language) {
      return reply.code(400).send({ error: 'displayName and language are required' });
    }
    const client = await store.createClient({
      displayName,
      email: body?.email,
      phone: body?.phone,
      language,
      timezone: body?.timezone,
      notes: body?.notes,
      taste: {
        preferredBrands: body?.taste?.preferredBrands ?? [],
        sizes: body?.taste?.sizes ?? {},
        interests: body?.taste?.interests ?? [],
      },
    });
    return reply.code(201).send(client);
  });

  app.get('/clients/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const client = await store.getClient(id);
    if (!client) {
      return reply.code(404).send({ error: 'client not found' });
    }
    const interactions = oldestFirst(await store.listInteractions(id));
    return { client, interactions };
  });

  app.get('/drafts', async (request, reply) => {
    const query = request.query as { clientId?: string };
    if (!query.clientId) {
      return reply.code(400).send({ error: 'clientId query parameter is required' });
    }
    return newestFirst(await store.listDrafts(query.clientId));
  });

  app.post('/draft', async (request, reply) => {
    const body = request.body as { clientId?: string; channel?: string; intentHint?: string } | undefined;
    const clientId = body?.clientId;
    const channel = body?.channel;
    if (!clientId) {
      return reply.code(400).send({ error: 'clientId is required' });
    }
    if (!isInteractionChannel(channel)) {
      return reply.code(400).send({ error: `channel must be one of: ${CHANNELS.join(', ')}` });
    }
    const client = await store.getClient(clientId);
    if (!client) {
      return reply.code(404).send({ error: 'client not found' });
    }
    const history = oldestFirst(await store.listInteractions(clientId)).slice(-INTERACTION_WINDOW);
    const userContent = buildDraftPrompt(client, history, channel, body?.intentHint);

    let text: string;
    try {
      const result = await provider.complete({
        system: DRAFT_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
      });
      text = result.text;
    } catch (err) {
      app.log.warn(err, 'completion provider failed');
      return reply.code(502).send({ error: 'completion provider failed' });
    }

    const draft: Draft = {
      id: randomUUID(),
      clientId,
      channel,
      intentHint: body?.intentHint,
      text,
      status: 'pending_approval',
      createdAt: new Date().toISOString(),
    };
    return reply.code(201).send(await store.saveDraft(draft));
  });

  app.post('/drafts/:id/approve', async (request, reply) => {
    const { id } = request.params as { id: string };
    const draft = await store.getDraft(id);
    if (!draft) {
      return reply.code(404).send({ error: 'draft not found' });
    }
    if (draft.status !== 'pending_approval') {
      return reply.code(409).send({ error: 'draft is not pending approval' });
    }
    const body = request.body as { text?: string } | undefined;
    const finalText = typeof body?.text === 'string' && body.text.trim().length > 0 ? body.text : draft.text;
    const approvedAt = new Date().toISOString();
    const approved: Draft = { ...draft, text: finalText, status: 'approved', approvedAt };
    await store.updateDraft(approved);
    await store.addInteraction({
      clientId: approved.clientId,
      at: approvedAt,
      channel: approved.channel,
      direction: 'outbound',
      summary: truncate(finalText, SUMMARY_MAX_LENGTH),
    });
    return approved;
  });

  app.post('/drafts/:id/reject', async (request, reply) => {
    const { id } = request.params as { id: string };
    const draft = await store.getDraft(id);
    if (!draft) {
      return reply.code(404).send({ error: 'draft not found' });
    }
    if (draft.status !== 'pending_approval') {
      return reply.code(409).send({ error: 'draft is not pending approval' });
    }
    const rejected: Draft = { ...draft, status: 'rejected' };
    return store.updateDraft(rejected);
  });

  app.get('/requests', async (request) => {
    const query = request.query as { clientId?: string };
    return store.listRequests(query.clientId);
  });

  app.post('/requests/:id/steps/:stepId/approve', async (request, reply) => {
    const { id, stepId } = request.params as { id: string; stepId: string };
    const clientRequest = await store.getRequest(id);
    if (!clientRequest) {
      return reply.code(404).send({ error: 'request not found' });
    }
    const step = clientRequest.steps.find((candidate) => candidate.id === stepId);
    if (!step) {
      return reply.code(404).send({ error: 'step not found' });
    }
    if (step.state !== 'awaiting-your-hand') {
      return reply.code(409).send({ error: 'step is not awaiting your hand' });
    }
    const body = request.body as { text?: string } | undefined;
    const confirmedAt = new Date().toISOString();
    step.state = 'confirmed';
    step.confirmedAt = confirmedAt;
    await store.saveRequest(clientRequest);

    // A step that speaks to the guest records the outbound communication
    // at approval — same gate as drafted replies.
    const message = typeof body?.text === 'string' && body.text.trim() !== '' ? body.text : step.draft;
    if (message !== undefined) {
      await store.addInteraction({
        clientId: clientRequest.clientId,
        at: confirmedAt,
        channel: step.channel ?? 'whatsapp',
        direction: 'outbound',
        summary: truncate(message, SUMMARY_MAX_LENGTH),
      });
    }
    return clientRequest;
  });

  app.get('/webhook/whatsapp', async (request, reply) => {
    const query = request.query as Record<string, string | undefined>;
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN ?? DEFAULT_WHATSAPP_VERIFY_TOKEN;
    if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] === expectedToken) {
      return reply.code(200).send(query['hub.challenge'] ?? '');
    }
    return reply.code(403).send({ error: 'verification failed' });
  });

  app.post('/webhook/whatsapp', async (request, reply) => {
    const payload = request.body as WhatsAppWebhookPayload | undefined;
    const clients = await store.listClients();
    for (const entry of payload?.entry ?? []) {
      for (const change of entry?.changes ?? []) {
        // Delivery/read status updates carry a `statuses` array and no
        // `messages`; they are intentionally ignored.
        for (const message of change?.value?.messages ?? []) {
          const clientId = matchClientIdByPhone(clients, message?.from);
          if (!clientId) {
            // Unknown number: record nothing and never auto-create clients.
            continue;
          }
          const bodyText = typeof message?.text?.body === 'string' ? message.text.body : undefined;
          const summary = truncate(
            bodyText ?? `received ${typeof message?.type === 'string' ? message.type : 'unknown'} message`,
            SUMMARY_MAX_LENGTH,
          );
          await store.addInteraction({
            clientId,
            at: toIso(message?.timestamp),
            channel: 'whatsapp',
            direction: 'inbound',
            summary,
          });
        }
      }
    }
    // Always acknowledge quickly; responses are never sent automatically
    // (approval-first policy).
    return { received: true };
  });

  if (options.demoMode === true) {
    app.post('/dev/demo/burst', async () => {
      const { drafts, requests } = await runDemoBurst(store);
      return { prepared: drafts.length, drafts, requests };
    });
  }

  return app;
}
