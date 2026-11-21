// SPDX-License-Identifier: Apache-2.0
// Fictional demonstration scenarios. Every string is deliberately short:
// the demo is meant to be felt in seconds, not read.
import { MockProvider, type MockScript } from '@luxe/model-gateway';
import type { Store } from './store.js';
import type { Draft } from './types.js';

export interface BurstScenario {
  clientPhone: string;
  inbound: string;
  reason: string;
  intent: string;
  match: string;
  reply: string;
}

/** The three demonstration moments, in triage order. */
export const BURST_SCENARIOS: readonly BurstScenario[] = [
  {
    clientPhone: '+41 79 555 01 01',
    inbound: 'Vol retardé — nous arrivons vers minuit.',
    reason: 'Itinéraire modifié — arrivée 00:10',
    intent: 'Vol retardé, arrivée 00:10 — table décalée, suite conservée.',
    match: '00:10',
    reply:
      'Avec plaisir — salon privé samedi, après le théâtre.\nMenu sans fruits de mer pour deux. Votre suite reste prête, quelle que soit l’heure.',
  },
  {
    clientPhone: '+81 90 5555 01 02',
    inbound: 'Friday, quiet table for two. Guest is vegetarian.',
    reason: 'Friday table — guest vegetarian',
    intent: 'Friday, quiet table for two, guest vegetarian.',
    match: 'vegetarian',
    reply:
      'かしこまりました。金曜日、静かな個室をご用意いたします。\nお連れ様のベジタリアン対応も承りました。',
  },
  {
    clientPhone: '+39 335 555 01 03',
    inbound: 'Regatta Saturday: berth, dinner for 8, two cars.',
    reason: 'Regatta Saturday — 4 vendors, 1 reply',
    intent: 'Regatta Saturday: berth, dinner 8 (two vegetarian), two cars dockside.',
    match: 'dockside',
    reply:
      'With pleasure — berth Saturday, dinner for eight (two vegetarian), two cars dockside 08:30.\nOne confirmation from me by morning.',
  },
];

/** Scenario scripts for the deterministic demo provider. */
export function demoMockScripts(): MockScript[] {
  return BURST_SCENARIOS.map((scenario) => ({
    match: scenario.match,
    reply: scenario.reply,
  }));
}

/** The demo provider: scripted where a scenario matches, terse elsewhere. */
export function buildDemoProvider(): MockProvider {
  return new MockProvider('DRAFT: With pleasure — I will confirm the details shortly.', demoMockScripts());
}

/**
 * Simulates the night desk: three inbound messages arrive together and a
 * draft is prepared for each, in the client's own language and tone, with
 * the reason attached. Nothing is sent — approval still gates every reply.
 */
export async function runDemoBurst(store: Store): Promise<Draft[]> {
  const clients = await store.listClients();
  const drafts: Draft[] = [];

  for (const scenario of BURST_SCENARIOS) {
    const client = clients.find(
      (candidate) => candidate.phone?.replace(/[^0-9]/g, '') === scenario.clientPhone.replace(/[^0-9]/g, ''),
    );
    if (client === undefined) continue;

    await store.addInteraction({
      clientId: client.id,
      at: new Date().toISOString(),
      channel: 'whatsapp',
      direction: 'inbound',
      summary: scenario.inbound,
    });

    drafts.push(
      await store.saveDraft({
        id: crypto.randomUUID(),
        clientId: client.id,
        channel: 'whatsapp',
        intentHint: scenario.reason,
        text: scenario.reply,
        status: 'pending_approval',
        createdAt: new Date().toISOString(),
      }),
    );
  }

  return drafts;
}
