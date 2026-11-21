# ADR 0005: Request ledger with per-step approval

## Status

Accepted

## Date

2026-11-21

## Context

Guest needs routinely span the house and its partners: a delayed flight
touches the suite, the table, the car, and the theatre; a gift draws on the
boutique, the gallery, and the florist. Legacy tools stop at each partner's
wall, so coordinating one need becomes days of calls in which no participant
sees the whole. A draft is the wrong shape for this: a single message cannot
represent four independent commitments.

## Decision

Introduce the request ledger. A `ClientRequest` decomposes one guest need
into `RequestStep`s, each naming the executing partner (the house or an
external partner). Steps are inert by construction: they exist only in
`awaiting-your-hand` until the advisor confirms them through the approval
endpoint, and a guest-facing step records its outbound communication at
confirmation — the same gate as drafted replies. The ledger is a product
surface (`GET /requests`, step approval), not a demo construct.

## Consequences

- Coordination becomes visible: the advisor sees the whole board and moves
  it one confirmation at a time.
- Partner participation needs no partner integration in v0.1 — partners are
  named on steps and reached by the house; structured partner-facing
  protocols remain future work (see ADR 0004).
- Every step is auditable in the interaction history, preserving charter
  commitments 4 and 5.
