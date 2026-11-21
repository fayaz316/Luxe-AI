# Demo

`pnpm demo` starts a fully local, seeded environment. Requires `pnpm install` first.

## What starts

- **copilot-api** on `http://localhost:8080`, running with `SEED_DEMO=1`: the fictional client base of "Maison Verre", with months of memory per client.
- **copilot-web** on `http://localhost:5173`, pointed at the local API.

## Three impossible moments

Trigger all three at once (the night desk, out of hours):

```bash
curl -X POST http://localhost:8080/dev/demo/burst
```

Then open `http://localhost:5173` — three drafts are waiting, none sent.

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

## Manual walkthrough

1. Select a client; review the memory and timeline.
2. Choose a channel, add an intent, **Generate draft**.
3. Edit. Approve. The outbound reply is recorded — nothing ever sends without
   the approval.

## What to notice

- **The approval gate.** Drafts exist only as `pending_approval` until approved. Enforced at the API layer — the workspace cannot bypass it, and neither can an MCP client.
- **Memory-informed drafting.** Drafts draw on recorded preferences and history, in the client's own language and tone.
- **Fictional data.** Maison Verre and every client are fictional and ship with the repository for demonstration only.
