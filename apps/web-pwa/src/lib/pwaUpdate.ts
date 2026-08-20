export interface PwaWorkerLike {
  readonly state: string;
  postMessage(message: unknown): void;
  addEventListener(type: 'statechange', listener: () => void): void;
  removeEventListener(type: 'statechange', listener: () => void): void;
}

export interface PwaRegistrationLike {
  readonly waiting: PwaWorkerLike | null;
  readonly installing: PwaWorkerLike | null;
  update(): Promise<void>;
  addEventListener(type: 'updatefound', listener: () => void): void;
  removeEventListener(type: 'updatefound', listener: () => void): void;
}

export interface PwaServiceWorkerContainerLike {
  readonly controller: unknown | null;
  register(scriptUrl: string, options?: RegistrationOptions): Promise<PwaRegistrationLike>;
  addEventListener(type: 'controllerchange', listener: () => void): void;
  removeEventListener(type: 'controllerchange', listener: () => void): void;
}

export interface PwaUpdateController {
  check(): Promise<void>;
  apply(): boolean;
  dispose(): void;
}

export interface RegisterPwaUpdateOptions {
  serviceWorker: PwaServiceWorkerContainerLike;
  scriptUrl: string;
  reload: () => void;
  onUpdateAvailable: () => void;
  onActivating?: () => void;
}

/**
 * Registers the application service worker and exposes an explicit update flow.
 * Existing tabs are never force-reloaded merely because a new worker finished
 * installing. The user chooses when to activate the waiting worker, then the tab
 * reloads exactly once after `controllerchange`.
 */
export async function registerPwaUpdateController(
  options: RegisterPwaUpdateOptions,
): Promise<PwaUpdateController> {
  const registration = await options.serviceWorker.register(options.scriptUrl, { scope: './' });
  let reloadArmed = false;
  let disposed = false;
  let lastAnnouncedWorker: PwaWorkerLike | null = null;
  const workerListeners = new Map<PwaWorkerLike, () => void>();

  const announceWaitingWorker = () => {
    if (disposed || !options.serviceWorker.controller) return;
    const waiting = registration.waiting;
    if (!waiting || waiting === lastAnnouncedWorker) return;
    lastAnnouncedWorker = waiting;
    options.onUpdateAvailable();
  };

  const observeInstallingWorker = () => {
    const worker = registration.installing;
    if (!worker || workerListeners.has(worker)) return;

    const onStateChange = () => {
      if (worker.state === 'installed') announceWaitingWorker();
    };
    workerListeners.set(worker, onStateChange);
    worker.addEventListener('statechange', onStateChange);
  };

  const onUpdateFound = () => {
    observeInstallingWorker();
  };

  const onControllerChange = () => {
    if (!reloadArmed || disposed) return;
    reloadArmed = false;
    options.reload();
  };

  registration.addEventListener('updatefound', onUpdateFound);
  options.serviceWorker.addEventListener('controllerchange', onControllerChange);
  observeInstallingWorker();
  announceWaitingWorker();

  return {
    async check() {
      if (disposed) return;
      await registration.update();
      observeInstallingWorker();
      announceWaitingWorker();
    },

    apply() {
      if (disposed) return false;
      const waiting = registration.waiting;
      if (!waiting) return false;
      reloadArmed = true;
      options.onActivating?.();
      waiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      registration.removeEventListener('updatefound', onUpdateFound);
      options.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      for (const [worker, listener] of workerListeners) {
        worker.removeEventListener('statechange', listener);
      }
      workerListeners.clear();
    },
  };
}
