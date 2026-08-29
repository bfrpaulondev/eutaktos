import { describe, expect, it } from 'vitest';
import { personDto } from './_entity-read';
import type { EntityRow } from './_db';

describe('personDto', () => {
  it('preserves explicit labels required by authoritative People rereads', () => {
    const row = {
      tenant_id: 'tenant-a',
      entity_type: 'person',
      entity_id: 'p1',
      version: 4,
      data: {
        id: 'p1',
        tenantId: 'tenant-a',
        displayName: 'Ana',
        active: true,
        labels: ['Apoio', 'Visita'],
      },
    } as EntityRow;

    expect(personDto(row, 'tenant-a')).toEqual({
      id: 'p1',
      displayName: 'Ana',
      active: true,
      labels: ['Apoio', 'Visita'],
    });
  });
});
