# ADR 0003: Model provider abstraction

- Status: Accepted
- Date: 2026-11-21

## Context

Model provider pricing, capabilities, and data-processing terms shift on short notice. Brands also enter different commercial arrangements: some operate with API-key terms, others require Vertex AI processing inside their Google Cloud agreement for regional data guarantees. Binding any single provider into the core request path would couple drafting availability — and the approval-gated loop that depends on it — to one vendor's commercial posture.

## Decision

All model access goes through the `ModelProvider` interface in `packages/model-gateway`. Three implementations ship: a Gemini API-key provider, a Vertex AI provider, and a deterministic mock for tests and local development. `resolveProvider()` selects the implementation from the environment (`GEMINI_API_KEY`, or `GOOGLE_PROJECT` with `GOOGLE_APPLICATION_CREDENTIALS`, otherwise the mock).

## Consequences

- Brands select providers by configuration; switching requires no recompilation or fork.
- Provider-specific capabilities that not every implementation offers will need per-capability feature flags over time.
- Core paths must avoid deep vendor-specific features; anything not expressible through the interface stays out of the core.
