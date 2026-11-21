# ADR 0001: Tenant isolation on Google Cloud

- Status: Accepted
- Date: 2026-11-21

## Context

Luxury brands treat client data as a regulated asset. Procurement and compliance processes require a demonstrable data boundary and, frequently, data residency in a chosen region. A multi-tenant SaaS operated centrally would concentrate every brand's client data in one estate, create a single point of regulatory failure across jurisdictions, and sit in direct conflict with charter commitment 5.

## Decision

Every lux deployment targets the brand's own Google Cloud project. `infra/terraform` provisions that project per brand: Firestore, Cloud Run, Firebase Hosting, Secret Manager, and least-privilege IAM. The project ships no multi-tenant SaaS and no central control plane capable of reading tenant data.

## Consequences

- Operational burden — provisioning, updates, monitoring — falls on each brand rather than a central operator.
- Procurement and compliance paths are unblocked: the data boundary is the brand's own project, in the brand's chosen region.
- No central data aggregation is possible, because no central estate exists.
- Aligns with charter commitment 5 (brand data stays in the brand's boundary).
