# lux Charter

This charter states the commitments the project holds itself to. They bind the codebase, the infrastructure, the documentation, and every derivative deployment. A contribution that conflicts with a commitment is a defect, and a product direction that conflicts with a commitment is out of scope.

## 1. No advertising

**No advertising. The platform and its derivatives never sell attention or client data to advertisers.**

The platform exists to serve the advisor–client relationship, not to monetize attention. This prohibits advertising surfaces of any kind, sponsored or paid ranking, tracker or ad-tech integrations, and the sale or licensing of client data to advertisers or data brokers. As enforced today: the monorepo contains no advertising or tracking components, the web app loads no third-party scripts, and the API has no data path to any advertising platform.

## 2. No plaintext access to client vault data

**No plaintext access to client vault data. The platform operator cannot read client profiles; encryption keys remain with the client.**

A client's vault — preferences, sizing, collection, interaction history — is the client's memory, and it must not be readable by whoever operates the infrastructure. This prohibits operator-held keys, escrow arrangements, and any server-side decryption path for vault records. As enforced today: `packages/vault-sdk` encrypts each record client-side with AES-GCM envelope encryption; per-record data keys are wrapped by a client-held master key, and stored systems receive ciphertext and wrapped keys only.

## 3. No waitlist or allocation manipulation

**No waitlist or allocation manipulation. The platform does not automate or game allocation systems; it supports authentic client relationships.**

Allocation of scarce goods — tables, allocations of watches, places on lists — must remain a human judgement grounded in a real relationship. This prohibits tooling that games, queue-jumps, or auto-optimizes allocation systems, and any feature that ranks clients for preferential access to scarce goods. As enforced today: the codebase ships no allocation tooling, and the MCP surface exposes client lookup, draft, and approve/reject only — nothing that acts on an allocation system.

## 4. Human approval on all irreversible actions

**Human approval on all irreversible actions. Every outbound client communication requires explicit advisor approval.**

A message sent to a client cannot be unsent, so the decision to send cannot be delegated. This prohibits automated sending, auto-approval, and any path — including integrations — that delivers an outbound message without an explicit approval action. As enforced today: drafts are created in a `pending_approval` state, the outbound path in `packages/copilot-api` requires an explicit approval call, and MCP-initiated drafts pass through the same gate.

## 5. Brand data stays in the brand's boundary

**Brand data stays in the brand's boundary. Each deployment runs isolated in the brand's own cloud project and region.**

Brand data — client memory, interactions, drafts — is the brand's asset and must not be aggregated into a central estate. This prohibits multi-tenant SaaS operation by the project and any cross-brand data sharing. As enforced today: `infra/terraform` provisions a dedicated Google Cloud project per brand (Firestore, Cloud Run, Firebase Hosting, Secret Manager, least-privilege IAM). The one path beyond the tenant boundary is the model provider the brand itself configures; brands requiring in-region processing select the Vertex AI provider.

## Charter changes

Amendments are held to a higher bar than code changes. Every amendment requires a tracked ADR under `docs/adr/` and must maintain or strengthen the protections above; an amendment that weakens any commitment is rejected. Charter changes never ship inside a feature pull request — the ADR and the amended charter text land together, in the open.
