# Threat model

This model covers lux 0.1. It is revised whenever a boundary, asset, or actor changes; residual risks are reviewed against [ROADMAP.md](../ROADMAP.md) each milestone.

## Assets

| Asset | Location | Sensitivity |
| --- | --- | --- |
| Client profiles and interaction history | Brand tenant (Firestore) | High; advisor-visible within the brand |
| Vault ciphertext (preferences, sizing, collection, interaction history) | Brand tenant storage | Confidentiality depends on client keys, not tenant controls |
| Vault master keys | Client devices | Critical; loss of the key is loss of the vault |
| Message drafts (`pending_approval`) | copilot-api | High; unapproved client communications |
| API credentials (model provider, WhatsApp) | Secret Manager / runtime environment | High; abuse enables outbound spoofing and cost |

## Actors

| Actor | Description |
| --- | --- |
| Advisor | Authenticates to the workspace; can read brand tenant data and approve drafts |
| Brand administrator | Administers the brand's Google Cloud project and IAM |
| Brand's cloud provider | Operates the infrastructure the tenant runs on |
| Platform operators / maintainers | Maintain the open-source code; hold no tenant credentials in the intended deployment |
| Model provider | Receives drafting context via `provider.complete` |
| Network attacker | Attempts interception, replay, or injection on any hop |
| Malicious insider | Any party above acting against client or brand interest |

## Trust boundaries

1. Browser (advisor workspace) ↔ copilot-api
2. copilot-api ↔ Firestore
3. copilot-api ↔ model provider
4. Client device ↔ vault storage
5. MCP client ↔ copilot-api

## Risks and mitigations per boundary

| Boundary | Risk | Current mitigation |
| --- | --- | --- |
| Browser ↔ copilot-api | Session hijack or credential replay; attacker drafts and sends as the advisor | TLS on all hops; Cloud Run invoker restricted to the brand's Google identities; the approval gate bounds a stolen session to drafts the real advisor still must approve |
| copilot-api ↔ Firestore | Read or tamper with records from inside the project | Least-privilege IAM; vault records held as ciphertext only; per-record DEKs with AAD binding detect tampering and relocation |
| copilot-api ↔ model provider | Drafting context disclosed to or retained by the provider | Minimal context in prompts; region pinning via the Vertex AI provider; no payment or credential data in prompts |
| Client device ↔ vault storage | Ciphertext substitution, replay, or unauthenticated write | AES-GCM authenticated encryption with record identifier and kind as AAD; a record transplanted across identifiers or kinds fails to decrypt |
| MCP client ↔ copilot-api | Automation attempting to bypass the approval gate | MCP tools call the same server-side API paths as the workspace; approval cannot be granted from the drafting side; explicit reject path available |

Cross-cutting controls: TLS on every hop; PII-free, redacted application logs; least-privilege IAM across the tenant; approval gate on all outbound messages regardless of origin.

## Residual risks

| # | Residual risk | Position |
| --- | --- | --- |
| a | The model provider sees drafting context (profile memory, recent interactions) | Accepted for 0.1 with constraints: minimal context in prompts, region pinning via the Vertex AI provider, and no payment or credential data in prompts |
| b | The brand tenant holds advisor-visible plaintext of the brand's own interactions | By design: the tenant is the brand's data boundary, isolated in the brand's own project. Brokerage of that data across brands is architecturally absent and prohibited by the charter |
| c | Master key loss is vault loss | Recovery is the client's responsibility in v0.1; the platform holds no keys and cannot assist. Key export and re-encryption workflows are planned for the v0.2 client companion |
