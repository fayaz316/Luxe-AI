# Roadmap

Milestones are version-ordered and carry no dates: scope ships when it meets the charter and the quality bar. Non-goals are commitments, not omissions to be revisited later in the same milestone.

## v0.1 — Copilot foundation (current)

Scope:

- Advisor workspace (`apps/copilot-web`): client memory, interaction timeline, draft composition.
- Hard approval gate at the API layer on every outbound communication.
- WhatsApp Business API inbound webhook; outbound delivery via approved drafts.
- Per-brand tenant provisioning for Google Cloud via `infra/terraform`.
- MCP server exposing advisor tools (client lookup, draft, approve/reject) over the copilot API.
- `packages/vault-sdk`: client-held envelope encryption for vault records.

Non-goals:

- Multi-brand data aggregation of any kind.
- Client-facing applications.
- Automated sending in any form.

## v0.2 — Client companion

Scope:

- Client PWA built on `vault-sdk`.
- Client-held master keys: generation, import, and device-local storage.
- Zero-data personalization queries to brands: the client's device answers brand queries from the vault, and the brand receives the answer, never the record.

Non-goals:

- Key escrow or operator-assisted key recovery.
- Brand-side decryption of vault records under any circumstance.

## v0.3 — Interoperability

Scope:

- A2A/MCP integration surface for brand systems (property management, CRM, point of sale).
- Provenance-aware and Digital Product Passport (DPP)-aware records for watches, jewellery, and art.
- Contribution of the vault record format and the approval-gated messaging model to open standards work.

Non-goals:

- Replacing brand systems of record.
- Automatic cross-brand data sharing without client direction.

## v0.4 — Governance

Scope:

- Transition of project stewardship to an independent foundation.
- Open specification stewardship for the vault record format and the approval gate model.
- Neutral, charter-bound governance for the repository and specification.

Non-goals:

- A hosted multi-tenant SaaS offering.
- Monetization of client data (prohibited by the charter).
