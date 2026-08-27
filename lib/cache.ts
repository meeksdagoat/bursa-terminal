type CacheEntry = { expiresAt: number; promise: Promise<unknown> };

const globalStore = globalThis as typeof globalThis & {
  __bursaCache?: Map<string, CacheEntry>;
  __bursaStale?: Map<string, unknown>;
};

// Survives dev-server module reloads so upstream APIs are not hit on every HMR pass.
const store = (globalStore.__bursaCache ??= new Map<string, CacheEntry>());
const stale = (globalStore.__bursaStale ??= new Map<string, unknown>());

/**
 * De-duplicates concurrent loads and serves the previous result until `ttlMs` elapses.
 * Rejections are never cached.
 */
export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expiresAt > now) {
    return hit.promise as Promise<T>;
  }

  const promise = load()
    .then((value) => {
      stale.set(key, value);
      return value;
    })
    .catch((error: unknown) => {
      store.delete(key);
      throw error;
    });

  store.set(key, { expiresAt: now + ttlMs, promise });
  return promise;
}

/** Last successful payload for `key`, used when a live refresh 503s or times out. */
export function staleValue<T>(key: string): T | null {
  return (stale.get(key) as T | undefined) ?? null;
}

/**
 * Like `cached`, but returns the last good value instead of throwing when the
 * loader fails. Throws only when there is nothing in memory to serve.
 */
export async function cachedKeepLast<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  try {
    return await cached(key, ttlMs, load);
  } catch (error) {
    const previous = staleValue<T>(key);
    if (previous) return previous;
    throw error;
  }
}
