export type AsyncResourceCacheOptions = {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
};

type CacheEntry<Value> = {
  value: Value;
  expiresAt: number;
};

export class AsyncResourceCache<Key, Value> {
  private readonly cached = new Map<Key, CacheEntry<Value>>();
  private readonly inFlight = new Map<Key, Promise<Value>>();
  private readonly options: AsyncResourceCacheOptions;

  constructor(options: AsyncResourceCacheOptions) {
    this.options = options;
  }

  async get(
    key: Key,
    loader: () => Promise<Value>,
  ): Promise<Value> {
    const now = this.options.now?.() ?? Date.now();
    const entry = this.cached.get(key);
    if (entry && entry.expiresAt > now) {
      this.cached.delete(key);
      this.cached.set(key, entry);
      return entry.value;
    }
    if (entry) this.cached.delete(key);

    const existing = this.inFlight.get(key);
    if (existing) return existing;

    const pending = loader()
      .then((value) => {
        this.cached.set(key, {
          value,
          expiresAt: (this.options.now?.() ?? Date.now()) + this.options.ttlMs,
        });
        while (this.cached.size > this.options.maxEntries) {
          const oldest = this.cached.keys().next().value;
          if (oldest === undefined) break;
          this.cached.delete(oldest);
        }
        return value;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });
    this.inFlight.set(key, pending);
    return pending;
  }

  clear(): void {
    this.cached.clear();
    this.inFlight.clear();
  }

  get size(): number {
    return this.cached.size;
  }

  get inFlightSize(): number {
    return this.inFlight.size;
  }
}
