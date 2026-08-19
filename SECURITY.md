# Security Policy

Eutaktos handles highly sensitive personal data. Security reports must not be posted as public GitHub issues.

## Reporting a vulnerability

Before production release, the repository must enable GitHub Private Vulnerability Reporting / Security Advisories and publish a dedicated security contact. Until that channel is configured, do not disclose an exploitable vulnerability publicly.

## Scope priorities

High-priority reports include:
- cross-congregation data access;
- authentication or MFA bypass;
- privilege escalation;
- restricted Review Center disclosure;
- export/backup exposure;
- cryptographic key leakage;
- remote code execution;
- SSRF affecting private infrastructure;
- injection affecting sensitive data;
- AI/tool authorization bypass.

## Safe handling

Do not use real congregation data to demonstrate a vulnerability. Use synthetic accounts/data and the minimum proof required.
