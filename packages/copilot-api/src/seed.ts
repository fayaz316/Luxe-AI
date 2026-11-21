// SPDX-License-Identifier: Apache-2.0
// Fictional demonstration data. One line per memory; the story is in the
// pattern, not the prose.
import type { Store } from './store.js';
import type { Client, Interaction } from './types.js';

function daysAgo(days: number, hourUtc = 12): string {
  const date = new Date();
  date.setUTCHours(hourUtc, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString();
}

/**
 * Seeds the fictional client base of "Maison Verre": three clients whose
 * histories carry the hooks the demo moments rely on — a remembered
 * anniversary and allergy, a language and quiet-hours preference, a past
 * multi-vendor request that once took three days of back-and-forth.
 * All people, contacts, and events are invented.
 */
export async function seedDemoData(store: Store): Promise<Client[]> {
  const amara = await store.createClient({
    displayName: 'Amara Laurent',
    email: 'amara.laurent@example.test',
    phone: '+41 79 555 01 01',
    language: 'fr',
    timezone: 'Europe/Paris',
    notes: 'Salon privé. Shellfish allergy — herself and guests.',
    taste: {
      preferredBrands: ['Hermès', 'Céline'],
      sizes: { 'ready-to-wear': '34 FR', footwear: '37 EU' },
      interests: ['théâtre', 'Burgundy', 'contemporary art'],
    },
  });

  const kenji = await store.createClient({
    displayName: 'Kenji Watanabe',
    email: 'k.watanabe@example.test',
    phone: '+81 90 5555 01 02',
    language: 'ja',
    timezone: 'Asia/Tokyo',
    notes: 'Discretion. No calls after 19:00 JST.',
    taste: {
      preferredBrands: ['Cartier'],
      sizes: { footwear: '27 JP' },
      interests: ['single cask whisky', 'counter dining'],
    },
  });

  const sofia = await store.createClient({
    displayName: 'Sofia Marchetti',
    email: 'sofia.marchetti@example.test',
    phone: '+39 335 555 01 03',
    language: 'it',
    timezone: 'Europe/Rome',
    notes: 'Terrace in warm weather; regatta every September.',
    taste: {
      preferredBrands: ['Loro Piana'],
      sizes: { footwear: '38 EU' },
      interests: ['sailing', 'white truffle'],
    },
  });

  const interactions: Array<Omit<Interaction, 'id'>> = [
    // Amara — the remembered details.
    { clientId: amara.id, at: daysAgo(150, 9), channel: 'whatsapp', direction: 'inbound',
      summary: 'C’était parfait pour notre anniversaire. Merci.' },
    { clientId: amara.id, at: daysAgo(150, 18), channel: 'email', direction: 'outbound', advisorId: 'advisor-01',
      summary: 'Anniversary noted: June 12, dinner for two, no shellfish.' },
    { clientId: amara.id, at: daysAgo(60, 22), channel: 'whatsapp', direction: 'inbound',
      summary: 'Théâtre puis dîner — nous arriverons vers 23h.' },
    { clientId: amara.id, at: daysAgo(60, 22), channel: 'whatsapp', direction: 'outbound', advisorId: 'advisor-01',
      summary: 'Bien sûr. Table gardée jusqu’à minuit.' },
    { clientId: amara.id, at: daysAgo(30, 10), channel: 'phone', direction: 'inbound',
      summary: 'Corner suite for December — but away from the street.' },
    { clientId: amara.id, at: daysAgo(2, 20), channel: 'whatsapp', direction: 'inbound',
      summary: 'Une table calme samedi soir, après le théâtre ?' },

    // Kenji — the quiet hours and the standing preferences.
    { clientId: kenji.id, at: daysAgo(90, 7), channel: 'email', direction: 'inbound',
      summary: 'Counter for eight in the new year. Whisky pairing if possible.' },
    { clientId: kenji.id, at: daysAgo(87, 7), channel: 'email', direction: 'outbound', advisorId: 'advisor-02',
      summary: 'Confirmed: counter, eight guests, pairing flight.' },
    { clientId: kenji.id, at: daysAgo(80, 1), channel: 'whatsapp', direction: 'inbound',
      summary: 'Exceptional. My thanks to the chef.' },
    { clientId: kenji.id, at: daysAgo(14, 6), channel: 'email', direction: 'outbound', advisorId: 'advisor-02',
      summary: 'Winter cellar notes. Private viewing invitation, your guest welcome.' },

    // Sofia — the request that once took three days.
    { clientId: sofia.id, at: daysAgo(400, 11), channel: 'phone', direction: 'inbound',
      summary: 'Regatta: berth, dinner for the crew, cars from the marina.' },
    { clientId: sofia.id, at: daysAgo(398, 15), channel: 'email', direction: 'outbound', advisorId: 'advisor-03',
      summary: 'Berth confirmed.' },
    { clientId: sofia.id, at: daysAgo(397, 9), channel: 'email', direction: 'outbound', advisorId: 'advisor-03',
      summary: 'Dinner confirmed — took two more calls.' },
    { clientId: sofia.id, at: daysAgo(9, 17), channel: 'phone', direction: 'inbound',
      summary: 'Same as last year for the September regatta, per favore.' },
  ];

  for (const interaction of interactions) {
    await store.addInteraction(interaction);
  }

  return [amara, kenji, sofia];
}
