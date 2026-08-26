/**
 * Serializes one ordinary-contact save operation in the browser. The guard is
 * intentionally state-free from the UI perspective: the server remains the
 * authority and the caller must refetch after a successful mutation.
 */
export function createOrdinaryContactMutationGuard() {
  let active = false;
  return async <T>(mutation: () => Promise<T>): Promise<T | undefined> => {
    if (active) return undefined;
    active = true;
    try {
      return await mutation();
    } finally {
      active = false;
    }
  };
}
