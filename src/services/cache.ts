// Minimal cache service for Netlify Functions
class Cache {
  private store: Map<string, { value: any; expires: number }> = new Map();

  async get(key: string): Promise<any> {
    const item = this.store.get(key);
    if (!item) return null;
    
    if (item.expires < Date.now()) {
      this.store.delete(key);
      return null;
    }
    
    return item.value;
  }

  async set(key: string, value: any, ttl = 3600): Promise<void> {
    const expires = Date.now() + (ttl * 1000);
    this.store.set(key, { value, expires });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

export const cache = new Cache();