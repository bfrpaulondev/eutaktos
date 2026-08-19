# Initial Threat Model

This is a living document. Phase 0 expands it into formal data-flow diagrams and control mapping.

## Highest-value assets
- religious-affiliation/member data;
- contact/emergency information;
- assignment/eligibility history;
- restricted review notes;
- authentication credentials/sessions;
- congregation exports/backups;
- territory/address data.

## Primary threats
- cross-tenant authorization bug;
- compromised elder/admin account;
- malicious or accidental bulk export;
- support/operator overreach;
- database/storage compromise;
- leaked backups;
- insecure third-party messaging/AI integration;
- malicious import file;
- prompt injection causing unauthorized tool access;
- insecure mobile device/session;
- supply-chain dependency compromise.

## Core mitigations
- server-side authorization + tenant scoping;
- MFA/passkeys;
- encryption and key separation;
- export auditing/throttling;
- time-limited support access;
- secure backup/key controls;
- minimum-data subprocessors;
- parser sandbox/validation;
- AI tool allowlists and permission checks;
- device/session revoke;
- dependency pinning/scanning and SBOM.
