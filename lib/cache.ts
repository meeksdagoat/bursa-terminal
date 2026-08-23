type CacheEntry = { expiresAt: number; promise: Promise<unknown> };

const globalStore = globalThis as typeof globalThis & {
  __bursaCache?: Map<string, CacheEntry>;
};

// Survives dev-server module reloads so upstream APIs are not hit on every HMR pass.
const store = (globalStore.__bursaCache ??= new Map<string, CacheEntry>());

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

  const promise = load().catch((error: unknown) => {
    store.delete(key);
    throw error;
  });

  store.set(key, { expiresAt: now + ttlMs, promise });
  return promise;
}
