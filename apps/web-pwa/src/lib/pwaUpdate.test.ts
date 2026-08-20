import { describe, expect, it, vi } from 'vitest';
import {
  registerPwaUpdateController,
  type PwaRegistrationLike,
  type PwaServiceWorkerContainerLike,
  type PwaWorkerLike,
} from './pwaUpdate';

class FakeWorker implements PwaWorkerLike {
  state = 'installed';
  readonly messages: unknown[] = [];
  readonly listeners = new Set<() => void>();

  postMessage(message: unknown): void {
    this.messages.push(message);
  }

  addEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'statechange', listener: () => void): void {
    this.listeners.delete(listener);
  }

  emitState(state: string): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

class FakeRegistration implements PwaRegistrationLike {
  waiting: FakeWorker | null = null;
  installing: FakeWorker | null = null;
  updateCalls = 0;
  readonly updateListeners = new Set<() => void>();

  async update(): Promise<void> {
    this.updateCalls += 1;
  }

  addEventListener(_type: 'updatefound', listener: () => void): void {
    this.updateListeners.add(listener);
  }

  removeEventListener(_type: 'updatefound', listener: () => void): void {
    this.updateListeners.delete(listener);
  }

  emitUpdateFound(): void {
    for (const listener of this.updateListeners) listener();
  }
}

class FakeContainer implements PwaServiceWorkerContainerLike {
  controller: unknown | null = { active: true };
  readonly controllerListeners = new Set<() => void>();
  readonly registerCalls: Array<{ scriptUrl: string; options?: RegistrationOptions }> = [];

  constructor(readonly registration: FakeRegistration) {}

  async register(scriptUrl: string, options?: RegistrationOptions): Promise<PwaRegistrationLike> {
    this.registerCalls.push({ scriptUrl, options });
    return this.registration;
  }

  addEventListener(_type: 'controllerchange', listener: () => void): void {
    this.controllerListeners.add(listener);
  }

  removeEventListener(_type: 'controllerchange', listener: () => void): void {
    this.controllerListeners.delete(listener);
  }

  emitControllerChange(): void {
    for (const listener of this.controllerListeners) listener();
  }
}

describe('registerPwaUpdateController', () => {
  it('announces an already-waiting update only when the page is controlled', async () => {
    const registration = new FakeRegistration();
    registration.waiting = new FakeWorker();
    const container = new FakeContainer(registration);
    const onUpdateAvailable = vi.fn();

    const controller = await registerPwaUpdateController({
      serviceWorker: container,
      scriptUrl: '/sw.js',
      reload: vi.fn(),
      onUpdateAvailable,
    });

    expect(container.registerCalls).toEqual([{ scriptUrl: '/sw.js', options: { scope: './' } }]);
    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('does not announce the first install when no previous controller exists', async () => {
    const registration = new FakeRegistration();
    registration.waiting = new FakeWorker();
    const container = new FakeContainer(registration);
    container.controller = null;
    const onUpdateAvailable = vi.fn();

    const controller = await registerPwaUpdateController({
      serviceWorker: container,
      scriptUrl: '/sw.js',
      reload: vi.fn(),
      onUpdateAvailable,
    });

    expect(onUpdateAvailable).not.toHaveBeenCalled();
    controller.dispose();
  });

  it('posts SKIP_WAITING and reloads exactly once after controllerchange', async () => {
    const registration = new FakeRegistration();
    const waiting = new FakeWorker();
    registration.waiting = waiting;
    const container = new FakeContainer(registration);
    const reload = vi.fn();
    const activating = vi.fn();

    const controller = await registerPwaUpdateController({
      serviceWorker: container,
      scriptUrl: '/sw.js',
      reload,
      onUpdateAvailable: vi.fn(),
      onActivating: activating,
    });

    expect(controller.apply()).toBe(true);
    expect(waiting.messages).toEqual([{ type: 'SKIP_WAITING' }]);
    expect(activating).toHaveBeenCalledTimes(1);

    container.emitControllerChange();
    container.emitControllerChange();
    expect(reload).toHaveBeenCalledTimes(1);
    controller.dispose();
  });

  it('checks for updates without forcing activation', async () => {
    const registration = new FakeRegistration();
    const container = new FakeContainer(registration);

    const controller = await registerPwaUpdateController({
      serviceWorker: container,
      scriptUrl: '/sw.js',
      reload: vi.fn(),
      onUpdateAvailable: vi.fn(),
    });

    await controller.check();
    expect(registration.updateCalls).toBe(1);
    expect(controller.apply()).toBe(false);
    controller.dispose();
  });

  it('observes an installing worker and detaches listeners on dispose', async () => {
    const registration = new FakeRegistration();
    const container = new FakeContainer(registration);
    const onUpdateAvailable = vi.fn();

    const controller = await registerPwaUpdateController({
      serviceWorker: container,
      scriptUrl: '/sw.js',
      reload: vi.fn(),
      onUpdateAvailable,
    });

    const worker = new FakeWorker();
    worker.state = 'installing';
    registration.installing = worker;
    registration.waiting = worker;
    registration.emitUpdateFound();
    worker.emitState('installed');

    expect(onUpdateAvailable).toHaveBeenCalledTimes(1);
    controller.dispose();
    expect(worker.listeners.size).toBe(0);
    expect(registration.updateListeners.size).toBe(0);
    expect(container.controllerListeners.size).toBe(0);
  });
});
