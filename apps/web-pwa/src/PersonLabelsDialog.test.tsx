import { describe, expect, it, vi } from 'vitest';
import { labelSaveErrorState, labelsDraftValid, persistPersonLabels } from './PersonLabelsDialog';
import type { PeopleApi, PersonProfileDto } from './lib/peopleApi';

describe('PersonLabelsDialog', () => {
  it('accepts the canonical label limits', () => {
    expect(labelsDraftValid(['Visita', 'Apoio local'])).toBe(true);
    expect(labelsDraftValid(Array.from({ length: 20 }, (_, index) => `Label ${index}`))).toBe(true);
  });

  it('fails closed on invalid label drafts before mutation', () => {
    expect(labelsDraftValid(['x'.repeat(41)])).toBe(false);
    expect(labelsDraftValid(['bad\u0000label'])).toBe(false);
    expect(labelsDraftValid(Array.from({ length: 21 }, (_, index) => `Label ${index}`))).toBe(false);
  });

  it('classifies 401 and 403 separately from retryable save failures', () => {
    expect(labelSaveErrorState(new Error('Unauthorized (401)'))).toBe('unauthenticated');
    expect(labelSaveErrorState(new Error('Forbidden (403)'))).toBe('forbidden');
    expect(labelSaveErrorState(new Error('People API request failed (503)'))).toBe('retryable');
  });

  it('does not repeat PATCH when a retry observes the desired labels already persisted', async () => {
    let state: PersonProfileDto = { id: 'p1', displayName: 'Ana', active: true };
    const update = vi.fn(async (_id: string, input: { labels?: readonly string[] }) => {
      state = { ...state, labels: input.labels };
      return state;
    });
    const list = vi.fn(async () => [state]);
    const api = { list, update, create: vi.fn() } as unknown as PeopleApi;

    await expect(persistPersonLabels(api, 'p1', ['Visita'])).resolves.toEqual(['Visita']);
    expect(update).toHaveBeenCalledTimes(1);
    await expect(persistPersonLabels(api, 'p1', ['Visita'])).resolves.toEqual(['Visita']);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
