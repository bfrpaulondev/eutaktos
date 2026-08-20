import type { AuditHistorySource } from '@eutaktos/application';
import {
  assertAuditTenant,
  assertCapability,
  type AccessContext,
  type AuditEvent,
} from '@eutaktos/domain';

export interface AuditReadableSource {
  listAudit(context: AccessContext): readonly Readonly<AuditEvent>[];
}

function cloneEvent(event: AuditEvent): Readonly<AuditEvent> {
  return Object.freeze({
    ...structuredClone(event),
    changedFields: Object.freeze([...event.changedFields]),
  });
}

export class CompositeAuditHistorySource implements AuditHistorySource {
  readonly #sources: readonly AuditReadableSource[];

  constructor(sources: readonly AuditReadableSource[]) {
    this.#sources = Object.freeze([...sources]);
  }

  listAudit(context: AccessContext): readonly Readonly<AuditEvent>[] {
    assertCapability(context, 'audit.read');
    const result: Readonly<AuditEvent>[] = [];
    const seen = new Set<string>();

    for (const source of this.#sources) {
      for (const event of source.listAudit(context)) {
        assertAuditTenant(event, context.tenantId);
        const key = `${event.tenantId}\u0000${event.id}`;
        if (seen.has(key)) throw new Error('Duplicate audit event id across sources');
        seen.add(key);
        result.push(cloneEvent(event));
      }
    }

    return Object.freeze(result);
  }
}
