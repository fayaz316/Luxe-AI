# @lux/copilot-api

Advisor-facing backend for the lux platform (Cloud Run target). It stores
brand-side client records and interaction history, drafts client
communications with an LLM through `@lux/model-gateway`, and enforces the
platform's approval-first policy: **no message is ever final without explicit
advisor approval**.

## Approval-first policy

- Every generated draft is created with status `pending_approval`.
- A draft only becomes `approved` through `POST /drafts/:id/approve`, where
  the advisor may also supply an edited final text.
- Approving appends an outbound interaction to the client history; nothing is
  ever sent or recorded on the client's side automatically.
- The WhatsApp webhook never auto-responds; inbound messages are only logged
  as interactions.
- Approve/reject return `409` for drafts that are no longer pending, so a
  decision cannot be made twice.

## Quickstart

```bash
cp packages/copilot-api/.env.example packages/copilot-api/.env
pnpm install
pnpm --filter @lux/copilot-api dev        # http://localhost:8080
```

### Environment variables

| Variable                      | Default          | Purpose                                                                  |
| ----------------------------- | ---------------- | ------------------------------------------------------------------------ |
| `PORT`                        | `8080`           | HTTP port (Cloud Run injects this)                                        |
| `GEMINI_API_KEY`              | –                | Google AI Studio key; enables the Gemini API-key provider                 |
| `GOOGLE_PROJECT` / `GOOGLE_PROJECT_ID` | –       | Google Cloud project; enables the Vertex AI provider                      |
| `GOOGLE_APPLICATION_CREDENTIALS` | –            | Optional service-account key file for Vertex                              |
| `FIRESTORE_PROJECT`           | –                | When set, uses Firestore instead of the in-memory store                   |
| `WHATSAPP_VERIFY_TOKEN`       | `lux-dev-verify` | Expected `hub.verify_token` for Meta webhook verification                 |
| `SEED_DEMO`                   | `0`              | Set to `1` to seed the fictional "Maison Verre" demo client base on boot   |

With no model credentials set, the deterministic mock provider is used, so
the full draft → review → approve flow works offline.

## API routes

| Method | Path                    | Purpose                                                                       |
| ------ | ----------------------- | ----------------------------------------------------------------------------- |
| GET    | `/health`               | Liveness and version                                                           |
| GET    | `/clients`              | List clients                                                                   |
| POST   | `/clients`              | Create a client (`displayName` and `language` required, else `400`)             |
| GET    | `/clients/:id`          | Client with interaction history (oldest first); `404` when unknown              |
| GET    | `/drafts?clientId=`     | Drafts for a client, newest first                                              |
| POST   | `/draft`                | Generate a `pending_approval` draft; `404` for unknown clients                 |
| POST   | `/drafts/:id/approve`   | Approve, optionally with advisor-edited `text`; appends outbound interaction   |
| POST   | `/drafts/:id/reject`    | Reject the draft                                                               |
| GET    | `/webhook/whatsapp`     | Meta webhook verification (`hub.challenge` echoed, else `403`)                 |
| POST   | `/webhook/whatsapp`     | Inbound WhatsApp events; always `200 { received: true }`, never auto-responds   |

Draft generation is brief by design: the prompt combines a restrained
luxury-tone system prompt (no allocation or discount promises, no invented
facts, no automatic sign-offs) with the client profile, taste data, and the
eight most recent interactions. Webhook messages from numbers that do not
match a stored client phone are ignored — clients are never auto-created.

## Production data store

The default store is `MemoryStore` (in-process, reset on restart), which
keeps local development and the demo dependency-free. When `FIRESTORE_PROJECT`
is set, the server constructs `FirestoreStore` against collections `clients`,
`interactions`, and `drafts`. `@google-cloud/firestore` is intentionally **not**
a package dependency: it is dynamically imported only inside the Firestore
branch, so brands install it themselves (`pnpm --filter @lux/copilot-api add
@google-cloud/firestore`) or use the bundled deployment image. The store uses
plain get/set with client-side filtering; composite queries and indexes can be
added when access patterns demand them. `FirestoreStore` also accepts any
pre-built Firestore instance, which keeps tests hermetic.

## Docker

```bash
docker build -f packages/copilot-api/Dockerfile -t lux-copilot-api .
docker run --rm -p 8080:8080 --env-file packages/copilot-api/.env lux-copilot-api
```

Single multi-stage image: build with pnpm over the workspace, then run
`node packages/copilot-api/dist/index.js` as the non-root `node` user.

## Development

```bash
pnpm --filter @lux/copilot-api build
pnpm --filter @lux/copilot-api typecheck
pnpm --filter @lux/copilot-api test      # fastify app.inject, no network
```

Logging hygiene: request logging uses the default serializers (method, URL,
host — never request bodies) with the `authorization` header redacted, and
client names or ids are never written to logs beyond request identifiers.

## License

Apache-2.0
