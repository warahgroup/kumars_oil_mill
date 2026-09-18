type Entry = { data: unknown; expiresAt: number }

const store = new Map<string, Entry>()

const DEFAULT_TTL_MS = 2 * 60 * 1000

export async function cachedQuery<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return hit.data as T
  }
  const data = await loader()
  store.set(key, { data, expiresAt: Date.now() + ttlMs })
  return data
}

export function invalidateDataCache(prefix?: string): void {
  if (!prefix) {
    store.clear()
    return
  }
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

export function prefetchQueries(loaders: Array<{ key: string; fn: () => Promise<unknown> }>): void {
  void Promise.all(loaders.map(({ key, fn }) => cachedQuery(key, fn)))
}
