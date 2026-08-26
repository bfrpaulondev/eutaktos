import { describe, expect, it, vi } from 'vitest';
import { createOrdinaryContactMutationGuard } from './ordinaryContactMutationGuard';

describe('ordinary contact mutation guard', () => {
  it('blocks a duplicate save while the first mutation is pending', async () => {
    const guard = createOrdinaryContactMutationGuard();
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const mutation = vi.fn(async () => pending);

    const first = guard(mutation);
    const second = guard(mutation);

    expect(mutation).toHaveBeenCalledTimes(1);
    release();
    await Promise.all([first, second]);
  });

  it('releases the lock after a rejected request so an explicit retry is possible', async () => {
    const guard = createOrdinaryContactMutationGuard();
    const mutation = vi.fn()
      .mockRejectedValueOnce(new Error('Temporary failure'))
      .mockResolvedValueOnce('saved');

    await expect(guard(mutation)).rejects.toThrow('Temporary failure');
    await expect(guard(mutation)).resolves.toBe('saved');
    expect(mutation).toHaveBeenCalledTimes(2);
  });
});
