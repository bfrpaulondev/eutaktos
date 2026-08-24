import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { registerPwaUpdateController, type PwaServiceWorkerContainerLike, type PwaRegistrationLike, type PwaWorkerLike } from './pwaUpdate';

class MockWorker implements PwaWorkerLike {
  state = 'installed';
  private listeners = new Set<() => void>();
  postMessage() { /* no-op */ }
  addEventListener(type: 'statechange', listener: () => void) { if (type === 'statechange') this.listeners.add(listener); }
  removeEventListener(type: 'statechange', listener: () => void) { if (type === 'statechange') this.listeners.delete(listener); }
  simulateStateChange() { for (const l of this.listeners) l(); }
}

class MockRegistration implements PwaRegistrationLike {
  waiting: PwaWorkerLike | null = null;
  installing: PwaWorkerLike | null = null;
  private updateFoundListeners = new Set<() => void>();
  async update() { /* no-op */ }
  addEventListener(type: 'updatefound', listener: () => void) { if (type === 'updatefound') this.updateFoundListeners.add(listener); }
  removeEventListener(type: 'updatefound', listener: () => void) { if (type === 'updatefound') this.updateFoundListeners.delete(listener); }
  simulateUpdateFound() { for (const l of this.updateFoundListeners) l(); }
}

class MockServiceWorkerContainer implements PwaServiceWorkerContainerLike {
  controller: unknown | null = {};
  private registrations: MockRegistration[] = [];
  private controllerChangeListeners = new Set<() => void>();
  async register(): Promise<PwaRegistrationLike> {
    const reg = new MockRegistration();
    this.registrations.push(reg);
    return reg;
  }
  addEventListener(type: 'controllerchange', listener: () => void) { if (type === 'controllerchange') this.controllerChangeListeners.add(listener); }
  removeEventListener(type: 'controllerchange', listener: () => void) { if (type === 'controllerchange') this.controllerChangeListeners.delete(listener); }
  simulateControllerChange() { for (const l of this.controllerChangeListeners) l(); }
  get lastRegistration() { return this.registrations[this.registrations.length - 1]; }
}

describe('PWA update controller', () => {
  it('registers service worker and returns controller', async () => {
    const sw = new MockServiceWorkerContainer();
    const reload = vi.fn();
    const onUpdateAvailable = vi.fn();
    const controller = await registerPwaUpdateController({
      serviceWorker: sw,
      scriptUrl: '/sw.js',
      reload,
      onUpdateAvailable,
    });
    expect(controller).toBeDefined();
    expect(typeof controller.check).toBe('function');
    expect(typeof controller.apply).toBe('function');
    expect(typeof controller.dispose).toBe('function');
  });

  it('calls onUpdateAvailable when a waiting worker appears', async () => {
    const sw = new MockServiceWorkerContainer();
    const reload = vi.fn();
    const onUpdateAvailable = vi.fn();
    await registerPwaUpdateController({
      serviceWorker: sw,
      scriptUrl: '/sw.js',
      reload,
      onUpdateAvailable,
    });
    const reg = sw.lastRegistration;
    const worker = new MockWorker();
    reg.installing = worker;
    reg.simulateUpdateFound();
    worker.simulateStateChange();
    // Now simulate the worker becoming the waiting worker
    reg.waiting = worker;
    worker.simulateStateChange();
    expect(onUpdateAvailable).toHaveBeenCalled();
  });

  it('apply() posts SKIP_WAITING to waiting worker', async () => {
    const sw = new MockServiceWorkerContainer();
    const reload = vi.fn();
    const onUpdateAvailable = vi.fn();
    const controller = await registerPwaUpdateController({
      serviceWorker: sw,
      scriptUrl: '/sw.js',
      reload,
      onUpdateAvailable,
    });
    const reg = sw.lastRegistration;
    const worker = new MockWorker();
    reg.waiting = worker;
    const postMessageSpy = vi.spyOn(worker, 'postMessage');
    const result = controller.apply();
    expect(result).toBe(true);
    expect(postMessageSpy).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('apply() returns false when no waiting worker', async () => {
    const sw = new MockServiceWorkerContainer();
    const controller = await registerPwaUpdateController({
      serviceWorker: sw,
      scriptUrl: '/sw.js',
      reload: vi.fn(),
      onUpdateAvailable: vi.fn(),
    });
    expect(controller.apply()).toBe(false);
  });

  it('reloads exactly once after apply() + controllerchange', async () => {
    const sw = new MockServiceWorkerContainer();
    const reload = vi.fn();
    const controller = await registerPwaUpdateController({
      serviceWorker: sw,
      scriptUrl: '/sw.js',
      reload,
      onUpdateAvailable: vi.fn(),
    });
    const reg = sw.lastRegistration;
    const worker = new MockWorker();
    reg.waiting = worker;
    controller.apply();
    // First controllerchange should trigger reload
    sw.simulateControllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
    // Second controllerchange should NOT trigger reload again
    sw.simulateControllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('dispose() prevents further callbacks', async () => {
    const sw = new MockServiceWorkerContainer();
    const reload = vi.fn();
    const onUpdateAvailable = vi.fn();
    const controller = await registerPwaUpdateController({
      serviceWorker: sw,
      scriptUrl: '/sw.js',
      reload,
      onUpdateAvailable,
    });
    controller.dispose();
    const reg = sw.lastRegistration;
    const worker = new MockWorker();
    reg.installing = worker;
    reg.simulateUpdateFound();
    worker.simulateStateChange();
    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });

  it('check() calls registration.update()', async () => {
    const sw = new MockServiceWorkerContainer();
    const controller = await registerPwaUpdateController({
      serviceWorker: sw,
      scriptUrl: '/sw.js',
      reload: vi.fn(),
      onUpdateAvailable: vi.fn(),
    });
    const reg = sw.lastRegistration;
    const updateSpy = vi.spyOn(reg, 'update');
    await controller.check();
    expect(updateSpy).toHaveBeenCalledOnce();
  });

  it('does not announce update when no controller exists', async () => {
    const sw = new MockServiceWorkerContainer();
    sw.controller = null;
    const onUpdateAvailable = vi.fn();
    await registerPwaUpdateController({
      serviceWorker: sw,
      scriptUrl: '/sw.js',
      reload: vi.fn(),
      onUpdateAvailable,
    });
    expect(onUpdateAvailable).not.toHaveBeenCalled();
  });
});
