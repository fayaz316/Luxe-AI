# Demo

`pnpm demo` starts a fully local, seeded environment. Requires `pnpm install` first.

## What starts

- **copilot-api** on `http://localhost:8080`, running with `SEED_DEMO=1`: a fictional hotel and dining client base, "Maison Verre" — clients, preferences, stay history, and dining history.
- **copilot-web** on `http://localhost:5173`, pointed at the local API.

## Walkthrough

1. Open `http://localhost:5173`.
2. Select the client **Amara Laurent**.
3. Review the client memory: preferences, stay history, and dining history recorded for the brand.
4. Compose a WhatsApp draft regarding a Saturday table.
5. Select **Generate draft**. The draft appears in the `pending_approval` state.
6. Edit the draft. The wording is the advisor's to change before anything is sent.
7. Select **Approve & send**.
8. Observe the timeline: the outbound interaction is recorded alongside the inbound history.

## What to notice

- **The approval gate.** The draft exists only as `pending_approval` until explicitly approved. The gate is enforced at the API layer — the workspace cannot send around it, and neither can an MCP client.
- **Memory-informed drafting.** The generated draft draws on the recorded preferences and interaction history for that client, in a professional tone consistent with the brand.
- **Fictional data.** Maison Verre and every client in the demo dataset are fictional. The dataset ships with the repository for demonstration only.
