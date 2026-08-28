import { describe, expect, it, vi } from 'vitest';
import type { PeopleApi, PersonProfileDto } from './lib/peopleApi';
import { persistPersonLabels, reconcilePersonLabels } from './PersonLabelsDialog';

function person(labels: readonly string[]): PersonProfileDto {
  return { id: 'person-labels', displayName: 'QA Labels', active: true, labels };
}

describe('Person label ambiguous outcome recovery', () => {
  it('reconciles a persisted PATCH after the confirmation read failed without issuing a second PATCH', async () => {
    let current = person([]);
    let listCall = 0;
    const update = vi.fn(async (_id: string, input: { labels?: readonly string[] }) => {
      current = person(input.labels ?? []);
      return current;
    });
    const api: PeopleApi = {
      list: vi.fn(async () => {
        listCall += 1;
        if (listCall === 2) throw new Error('Temporary refetch failure (503)');
        return [current];
      }),
      create: vi.fn(),
      update,
    };

    await expect(persistPersonLabels(api, current.id, ['qa-final'])).rejects.toThrow('Temporary refetch failure');
    expect(update).toHaveBeenCalledTimes(1);

    await expect(reconcilePersonLabels(api, current.id)).resolves.toEqual(['qa-final']);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('uses read-only reconciliation when the desired labels were not persisted', async () => {
    const current = person(['existing']);
    const update = vi.fn();
    const api: PeopleApi = {
      list: vi.fn(async () => [current]),
      create: vi.fn(),
      update,
    };

    await expect(reconcilePersonLabels(api, current.id)).resolves.toEqual(['existing']);
    expect(update).not.toHaveBeenCalled();
  });
});
