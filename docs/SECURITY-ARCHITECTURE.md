# Security Architecture

Eutaktos assumes that a database leak would reveal highly sensitive association data. Security therefore uses defense in depth.

## Identity

- passkeys/WebAuthn support;
- MFA for privileged accounts;
- secure account recovery with anti-takeover controls;
- session/device inventory and revocation;
- short-lived privileged elevation for sensitive operations where practical;
- no shared administrator accounts.

## Authorization

- deny by default;
- role + capability + tenant + resource-context checks;
- server-side authorization on every sensitive action;
- restricted scopes for service-committee / Review Center data;
- automated authorization matrix tests.

## Encryption

- TLS for data in transit;
- encrypted databases, backups and object storage;
- envelope encryption for selected sensitive fields;
- tenant-aware key context;
- stronger/isolated key domain for restricted review notes;
- key rotation plan;
- secrets never committed to source control.

## Audit

Security-relevant events include:
- login/MFA changes;
- privilege/eligibility changes;
- role changes;
- restricted-note access;
- exports/backups;
- bulk reads;
- sensitive configuration changes;
- failed authorization attempts;
- data deletion.

Audit events should be append-only and tamper-evident.

## Application security

Release pipeline will include:
- SAST;
- dependency/SBOM analysis;
- secret scanning;
- container/IaC scanning when applicable;
- API fuzzing for critical parsers;
- DAST in staging;
- external penetration testing before GA.

## Import security

Imports are untrusted input:
- strict size limits;
- MIME/content verification;
- parser sandboxing/defensive parsing;
- zip-bomb and path-traversal protection;
- formula-injection defense in spreadsheet/CSV outputs;
- schema validation;
- no executable file handling;
- dry-run before write.

## Abuse / exfiltration controls

- rate limiting;
- export throttling / audit;
- privileged bulk-export confirmation;
- anomaly alerts for unusual export or administrative activity;
- short-lived download URLs;
- no sensitive data in analytics/telemetry.

## Secure SDLC

- threat modeling for every new external integration;
- security review for auth/permissions/crypto/import/AI changes;
- protected main branch;
- pinned dependencies/actions strategy;
- patching policy;
- vulnerability disclosure process.
