# Changelog

All notable changes to this project are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the
project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-11-21

### Added

- Advisor copilot API: client records, interaction history, memory-informed
  drafting, approval gate on every outbound communication, WhatsApp Business
  webhook (inbound recording only, no automatic responses).
- Advisor workspace web app (installable PWA) with the approval workflow as
  the primary interaction.
- `@luxe/vault-sdk`: client-held envelope encryption for vault records
  (AES-GCM, per-record data keys, AAD binding).
- `@luxe/model-gateway`: provider-neutral completion interface with Gemini
  API-key, Vertex AI, and deterministic mock providers.
- `@luxe/mcp-server`: MCP surface exposing advisor tools over the copilot API.
- Per-brand Google Cloud tenant deployment (Terraform): Cloud Run, Firestore,
  Secret Manager, Artifact Registry, least-privilege IAM.
- Project charter, architecture documentation, threat model, ADRs.
