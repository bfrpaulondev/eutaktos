import { describe, it, expect } from 'vitest';
import {
  createTaskCompletion, reopenTaskCompletion, orderCompletionHistory,
  filterCompletionsByTenant, findCompletionsForTask, assertCompletionTenant,
  normalizeTaskCompletion,
} from './task-history';

const NOW = '2026-08-21T12:00:00.000Z';
const T = 'tenant-aaa';

function make(overrides?: { id?: string; taskId?: string; now?: string }) {
  return createTaskCompletion({ id: overrides?.id ?? 'tc-1', tenantId: T, taskId: overrides?.taskId ?? 'task-1', completedBy: 'p1', now: overrides?.now ?? NOW });
}

describe('createTaskCompletion', () => {
  it('creates completed record', () => { const r = make(); expect(r.status).toBe('completed'); expect(r.reopenedAt).toBeNull(); expect(Object.isFrozen(r)).toBe(true); });
  it('throws on empty', () => { expect(() => createTaskCompletion({ id: '', tenantId: T, taskId: 't', completedBy: 'p', now: NOW })).toThrow('completionId is required'); });
});

describe('reopenTaskCompletion', () => {
  it('reopens with reason', () => {
    const r = reopenTaskCompletion(make(), 'p2', '2026-08-22T10:00:00Z', 'Incomplete');
    expect(r.status).toBe('reopened'); expect(r.reopenedBy).toBe('p2'); expect(r.reopenReason).toBe('Incomplete');
  });
  it('is idempotent-guarded', () => {
    let r = make(); r = reopenTaskCompletion(r, 'p2', '2026-08-22T10:00:00Z');
    expect(() => reopenTaskCompletion(r, 'p2', '2026-08-23T10:00:00Z')).toThrow('already reopened');
  });
  it('reason too long', () => { expect(() => reopenTaskCompletion(make(), 'p2', NOW, 'x'.repeat(501))).toThrow('reopenReason too long'); });
});

describe('orderCompletionHistory', () => {
  it('orders by completedAt desc then id asc', () => {
    const records = [
      make({ id: 'tc-1', taskId: 't', now: '2026-08-20T10:00:00Z' }),
      make({ id: 'tc-3', taskId: 't', now: '2026-08-21T10:00:00Z' }),
      make({ id: 'tc-2', taskId: 't', now: '2026-08-21T10:00:00Z' }),
    ];
    const ordered = orderCompletionHistory(records);
    expect(ordered.map(r => r.id)).toEqual(['tc-2', 'tc-3', 'tc-1']);
  });
});

describe('cross-tenant', () => {
  it('filterCompletionsByTenant', () => {
    const a = make(); const b = createTaskCompletion({ id: 'tc-2', tenantId: 'other', taskId: 't', completedBy: 'p', now: NOW });
    expect(filterCompletionsByTenant([a, b], T)).toHaveLength(1);
  });
  it('findCompletionsForTask cross-tenant', () => {
    const a = make({ taskId: 't1' });
    expect(findCompletionsForTask([a], 'other', 't1')).toHaveLength(0);
  });
  it('assertCompletionTenant', () => {
    expect(() => assertCompletionTenant(make(), T)).not.toThrow();
    expect(() => assertCompletionTenant(make(), 'other')).toThrow('Cross-tenant');
  });
});

describe('normalizeTaskCompletion', () => {
  it('normalizes valid', () => { expect(normalizeTaskCompletion(make()).id).toBe('tc-1'); });
  it('throws on invalid status', () => { expect(() => normalizeTaskCompletion({ ...make(), status: 'x' } as any)).toThrow('Invalid status'); });
});
