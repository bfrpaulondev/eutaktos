# ADR 0001 — Architecture Principles

Status: Proposed

## Decision

Eutaktos will use explicit domain boundaries, server-side authorization, tenant-scoped persistence, asynchronous workers for side effects, and data minimization as architectural constraints.

## Consequences

Security and privacy concerns are part of domain/API design rather than middleware added after implementation.
