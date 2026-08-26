# Ordinary contact contract

This document defines the minimal, canonical contract for **ordinary profile contacts** introduced in PX5.3. It is intentionally independent from emergency contacts and is the approved reuse point for a future PX6 consumer. It does not alter any Product Experience master-plan status.

| Topic | Contract |
| --- | --- |
| Resource | Ordinary profile contact for one authorized person. |
| Endpoint | `GET /api/people/:personId/contact` and `PUT /api/people/:personId/contact`. |
| Response and request DTO | `{ "phone"?: string, "email"?: string, "address"?: string }`. Each property is optional; an empty object represents no ordinary contact. **PUT is full replacement of the ordinary-contact resource**: callers send the complete desired contact. Omitted, `null` or blank fields are absent from the resulting resource; fields from a prior value are not merged. |
| Read authorization | The server-derived principal must have `people.read`. |
| Write authorization | The server-derived principal must have both `people.read` and `people.write`; the mutation also requires the existing trusted same-origin request check. |
| Authority | Tenant, actor identity and capabilities are resolved on the server from the verified session. They are never accepted from browser payload, URL parameters beyond the opaque person identifier, or client state. |
| Validation | Phone is normalized and limited to 40 characters; email is trimmed, structurally validated and limited to 254 characters; address is normalized and limited to 500 characters. Empty values are removed. |
| Persistence | Changes use the People unit of work and expected-version persistence. Audit and domain-event metadata name only `ordinaryContact`; they do not contain contact values. |

## Privacy and scope boundary

> **Emergency contacts are a different sensitive resource.** They remain under the existing `emergency-contacts.read` and `emergency-contacts.write` capabilities and are never included in the ordinary-contact response, request, cache or audit payload.

Ordinary contacts are deliberately excluded from the general People directory DTO. Client requests use the dedicated same-origin path and place contact values only in the JSON request body, never in URLs, query parameters, router state, local/session storage or service-worker cache. The profile loader presents `401` and `403` states as blocked sections without fabricating fallback contact data.

## Reuse guidance for PX6

PX6 or another authorized consumer must reuse this dedicated endpoint and DTO rather than widening the People directory contract or reading the aggregate directly. A caller must send the complete desired resource on PUT and preserve the capability model, no-PII URL/storage boundary, server-derived authority and explicit empty/error/blocked states defined above.
