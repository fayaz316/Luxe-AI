# luxe

Open-source client intelligence and advisor enablement platform for the luxury industry.

<!-- Replace YOUR-ORG/luxe with the repository slug. -->
[![CI](https://github.com/YOUR-ORG/luxe/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/YOUR-ORG/luxe/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](#license)
[![Node](https://img.shields.io/badge/node-%3E%3D20-green.svg)](#quickstart)

## Positioning

Every luxury house holds a fragment of the client: the hotel holds the stay history, the maison holds the collection, the restaurant holds the table preferences. Horizontal AI platforms resolve this by reading everything and steering clients to the highest bidder. luxe takes the opposite position: client memory belongs to the client, and brand data belongs to the brand. Advisors gain complete client memory, drafted communications in a professional tone, and a hard approval gate — no outbound message exists without explicit advisor approval.

## What each audience gets

| Audience | Value |
| --- | --- |
| Advisors | Complete client memory per brand, drafted communications, approval control over every outbound message |
| Brands | Deployment in their own Google Cloud project, no data egress, choice of model provider |
| Clients | An encrypted profile they own, no ad targeting |

## The desk

The advisor workspace (fictional demonstration data — see [docs/DEMO.md](docs/DEMO.md)):

![The guest desk: memory, the request ledger with the Paris-tonight cascade, and correspondence](docs/screenshots/desk.png)

A draft awaits the advisor's hand — editable, and nothing sends without explicit approval:

![A prepared draft under the approval gate](docs/screenshots/approval.png)

## Architecture

```mermaid
graph LR
    WEB["Browser PWA<br/>(apps/copilot-web)"] -->|HTTPS| API["copilot-api<br/>(Cloud Run)"]
    MCP["mcp-server"] -->|advisor tools| API
    WA["WhatsApp Business API"] -->|inbound webhook| API
    API --> FS[("Firestore<br/>(brand tenant)")]
    API --> GW["model-gateway"]
    GW --> GEM["Gemini API"]
    GW --> VTX["Vertex AI"]
    GW --> MOCK["Mock provider"]
    VAULT["vault-sdk<br/>(client-side)"] -->|ciphertext only| FS
```

Vault records are encrypted client-side by `vault-sdk`; stored systems hold ciphertext only. The model layer is provider-neutral (`Gemini`, `Vertex AI`, or a deterministic mock). Full detail: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Quickstart

Requires Node 20+ and pnpm 12+.

```bash
pnpm install
pnpm demo
```

- Web app: http://localhost:5173
- API: http://localhost:8080

The demo seeds a fictional hotel and dining client base, "Maison Verre". All demo data is fictional. Walkthrough: [docs/DEMO.md](docs/DEMO.md).

### Commands

| Command | Purpose |
| --- | --- |
| `pnpm install` | Install workspace dependencies |
| `pnpm typecheck` | Type-check all packages |
| `pnpm test` | Run all tests |
| `pnpm build` | Build all packages |
| `pnpm demo` | Run the seeded demo (API + web app) |

### Configuration

| Variable | Component | Purpose |
| --- | --- | --- |
| `PORT` | copilot-api | HTTP port (default 8080) |
| `COPILOT_API_KEY` | copilot-api | Optional shared secret; when set, all endpoints except health and the WhatsApp webhook require the `x-api-key` header |
| `GEMINI_API_KEY` | copilot-api | Selects the Gemini API-key provider |
| `GOOGLE_PROJECT` / `GOOGLE_APPLICATION_CREDENTIALS` | copilot-api | Selects the Vertex AI provider |
| `FIRESTORE_PROJECT` | copilot-api | Enables the Firestore store; default is in-memory |
| `WHATSAPP_VERIFY_TOKEN` | copilot-api | WhatsApp webhook verification token |
| `SEED_DEMO` | copilot-api | Seeds the fictional demo dataset (`1`) |
| `VITE_API_URL` | copilot-web | API base URL |
| `VITE_API_KEY` | copilot-web | Shared secret sent as `x-api-key`, when the API requires one |
| `COPILOT_API_URL` | mcp-server | copilot-api base URL |
| `COPILOT_API_KEY` | mcp-server | Shared secret forwarded as `x-api-key`, when the API requires one |

## Repository

| Path | Purpose |
| --- | --- |
| `apps/copilot-web` | Advisor workspace (browser PWA) |
| `packages/copilot-api` | Advisor API: client memory, drafting, approval gate, WhatsApp webhook |
| `packages/model-gateway` | `ModelProvider` abstraction: Gemini API key, Vertex AI, deterministic mock |
| `packages/vault-sdk` | Client-held envelope encryption for vault records |
| `packages/mcp-server` | MCP server exposing advisor tools over the copilot API |
| `infra/terraform` | Per-brand Google Cloud deployment (Cloud Run, Firestore, Secret Manager, Artifact Registry, IAM) |
| `docs` | Architecture, threat model, deployment, demo, ADRs |

## Charter

The project is governed by five commitments — [CHARTER.md](CHARTER.md):

- No advertising.
- No plaintext access to client vault data.
- No waitlist or allocation manipulation.
- Human approval on all irreversible actions.
- Brand data stays in the brand's boundary.

## Deployment

Each brand deploys luxe into its own Google Cloud project. Instructions: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). In production, combine the optional API key (`COPILOT_API_KEY`) with Cloud Run invoker IAM; neither alone is sufficient defense.

## Roadmap

Milestones are version-ordered and carry no dates: [ROADMAP.md](ROADMAP.md).

## License

Apache-2.0. Copyright 2026 luxe contributors.
