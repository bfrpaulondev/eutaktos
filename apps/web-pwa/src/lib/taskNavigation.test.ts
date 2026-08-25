import { describe, expect, it } from 'vitest';
import { taskNavFromLocation, taskNavTarget } from './taskNavigation';

describe('task-oriented navigation', () => {
  it('maps product navigation to truthful existing routes', () => {
    expect(taskNavTarget('home')).toMatchObject({ pathname: '/', section: 'home' });
    expect(taskNavTarget('prepare')).toMatchObject({ pathname: '/agenda', section: 'agenda' });
    expect(taskNavTarget('people')).toMatchObject({ pathname: '/pessoas', section: 'people' });
    expect(taskNavTarget('organization')).toMatchObject({ pathname: '/pessoas', search: '?area=organization', section: 'people' });
    expect(taskNavTarget('planning')).toMatchObject({ pathname: '/designacoes', section: 'assignments' });
    expect(taskNavTarget('admin')).toMatchObject({ pathname: '/preferencias', section: 'preferences' });
  });

  it('preserves legacy/deep-link aliases while selecting the task navigation destination', () => {
    expect(taskNavFromLocation('/agenda')).toBe('prepare');
    expect(taskNavFromLocation('/assignments')).toBe('planning');
    expect(taskNavFromLocation('/people')).toBe('people');
    expect(taskNavFromLocation('/people', '?area=organization')).toBe('organization');
    expect(taskNavFromLocation('/preferences')).toBe('admin');
    expect(taskNavFromLocation('/unknown')).toBe('home');
  });
});
