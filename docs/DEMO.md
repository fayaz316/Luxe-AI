# Demo

`pnpm demo` starts a fully local, seeded environment. Requires `pnpm install` first.

## What starts

- **copilot-api** on `http://localhost:8080`, running with `SEED_DEMO=1`: the fictional client base of "Maison Verre", with months of memory per client.
- **copilot-web** on `http://localhost:5173`, pointed at the local API.

## The impossible moments

Trigger all of them at once (the night desk, out of hours):

```bash
curl -X POST http://localhost:8080/dev/demo/burst
```

Then open `http://localhost:5173` — three drafts are waiting, the arrival
cascade is open, and nothing has been sent.

### 1. The remembered details — Amara Laurent

Her flight is delayed; she writes one line in French. The prepared draft already
knows: the salon privé, the table held past midnight after the théâtre, and that
the menu must carry no shellfish. Ends the frustration of repeating yourself to
a machine that forgets.

### 2. The right language, the right hour — Kenji Watanabe

One line in English; the prepared reply is in Japanese, notes the quiet room,
and the vegetarian preference of his guest — and waits, because nothing sends
after 19:00 JST. Ends the handoff where the human knows nothing and the bot
knows less.

### 3. One reply for four vendors — Sofia Marchetti

Berth, dinner for eight, two cars. Last year this took three days of
back-and-forth; the prepared draft is one elegant paragraph with a single
confirmation owed. Ends the abandonment of requests too complex for a bot.

### 4. Paris, tonight — the four-house cascade

The burst also opens a coordinated request on Amara's ledger: the suite held
past midnight, the table moved to 22:30, the car re-timed to the 00:25
arrival, the theatre will-call re-noted. Four houses, one word from the
guest. Today this is four phone calls where each house says "we'll note it"
— and none of them talk to each other. Each step waits on the advisor's
Confirm.

### 5. A gift that knew — Kenji Watanabe

On Kenji's ledger, standing: hold the September bag (size and colour already
known from a March fitting), arrange a private watercolour morning (from a
remark at dinner), white peonies on standby. His wife's birthday is in ten
days. Today this knowledge lives in four disconnected systems and a departed
employee's memory; here it is one list on the desk.

## The ledger

Requests decompose a guest need into steps across the house and its partners.
Every step shows one line: the action, the partner, and its state. Champagne
means it awaits the advisor's hand; confirmed steps fill their dot. Guests
with steps awaiting their hand carry a small champagne dot beside their name
in the list.

## Manual walkthrough

1. Select a guest; review the memory, ledger, and correspondence.
2. Choose a channel, add an intent, **Generate draft** (or press Enter).
3. Edit. Approve. The outbound reply is recorded — nothing ever sends without
   the approval.
4. In the ledger, confirm steps one by one; guest-facing steps record their
   message at confirmation.

## What to notice

- **The approval gate.** Drafts and ledger steps exist only in `pending_approval` / `awaiting-your-hand` until confirmed. Enforced at the API layer — the workspace cannot bypass it, and neither can an MCP client.
- **Memory-informed drafting.** Drafts draw on recorded preferences and history, in the guest's own language and tone.
- **Ecosystem orchestration.** One request coordinates the house, boutique, gallery, marina, transport, florist, theatre — legacy tools cannot see across these walls.
- **Fictional data.** Maison Verre and every guest are fictional and ship with the repository for demonstration only.
