# Lux Copilot (web)

`@lux/copilot-web` is the advisor workspace of **Lux**, an open-source
client-intelligence platform for the luxury industry. It is an installable
progressive web app where a client advisor can:

- browse and search their book of clients,
- review the full client memory — notes, preferred brands, sizes, interests,
  language and timezone,
- walk the complete interaction timeline (inbound and outbound),
- request an AI-drafted reply over WhatsApp, email, or phone,
- and **approve, edit, or reject every draft before anything is sent**.

## Approval policy

**No message reaches a client without advisor approval.** This is the defining
policy of the product and it is enforced in the interface itself: the header
carries a permanent "Human approval required for every send" badge, a banner
under the header restates the policy, and every generated draft opens in a
review editor with explicit **Approve & send**, **Regenerate**, and **Reject**
actions. Nothing is dispatched by the application on its own.

## Development

This app lives in the Lux pnpm workspace. From the repository root:

```sh
pnpm install
pnpm --filter @lux/copilot-web dev        # start Vite dev server on port 5173
pnpm --filter @lux/copilot-web typecheck  # tsc --noEmit
pnpm --filter @lux/copilot-web build      # typecheck + vite build
pnpm --filter @lux/copilot-web preview    # preview the production build
```

## Environment

Copy `.env.example` to `.env.local` and point the app at a Lux API instance:

```
VITE_API_URL=http://localhost:8080
```

The client expects the following REST surface:

| Function      | Request                                        |
| ------------- | ---------------------------------------------- |
| `listClients` | `GET /clients`                                 |
| `getClient`   | `GET /clients/:id` → `{ client, interactions }` |
| `createClient`| `POST /clients`                                |
| `draftReply`  | `POST /drafts`                                 |
| `approveDraft`| `POST /drafts/:id/approve`                     |
| `rejectDraft` | `POST /drafts/:id/reject`                      |
| `listDrafts`  | `GET /drafts?clientId=…`                       |

## Progressive web app

Lux Copilot ships a web app manifest and a small service worker, so it can be
installed to a device home screen or desktop and run standalone. Offline, the
service worker serves cached assets and the app shell with a network-first
strategy; API calls (`/api`) and cross-origin requests are never cached.

## License

Apache-2.0. See the repository `LICENSE` file for the full text.
