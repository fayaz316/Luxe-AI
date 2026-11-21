# ADR 0004: Protocol integration deferred

- Status: Accepted
- Date: 2026-11-21

## Context

The A2A and MCP ecosystem is young: specifications, transports, and client behaviour continue to move. The core value of the platform is the approval-gated copilot loop — memory, draft, explicit approval, recorded outcome — and that value does not depend on any inter-agent protocol. Committing early to additional wire protocols would freeze design decisions against unstable references.

## Decision

Ship one MCP server surface now: `packages/mcp-server` exposes the advisor tools (client lookup, draft, approve/reject) over the copilot API. A2A, agentic interoperability, and any new wire protocols are deferred to v0.3 (see ROADMAP.md), pending adoption evidence from real deployments.

## Consequences

- Third-party integrations are API-shaped today: anything that can call the copilot API over HTTP can integrate now.
- Standards work begins after adoption evidence exists, not before.
- The MCP surface inherits the approval gate; no protocol-level path may bypass explicit advisor approval.
