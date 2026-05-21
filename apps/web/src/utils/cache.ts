// Client-side lightweight state cache for Next.js SPA transitions
// Prevents full loaders / layout resets on back/forward navigation

type CacheEntry = {
  data: any;
  timestamp: number;
};

// Global memory cache persisted in memory for SPA transitions
const memoryCache: Record<string, CacheEntry> = {};

// Optional local storage cache for longer persistence
export const spaCache = {
  get: (key: string, maxAgeMs = 180000) => { // 3 minutes default cache TTL
    if (typeof window === "undefined") return null;
    const entry = memoryCache[key];
    if (!entry) return null;
    
    const isExpired = Date.now() - entry.timestamp > maxAgeMs;
    if (isExpired) {
      delete memoryCache[key];
      return null;
    }
    return entry.data;
  },
  
  set: (key: string, data: any) => {
    if (typeof window === "undefined") return;
    memoryCache[key] = {
      data,
      timestamp: Date.now(),
    };
  },
  
  has: (key: string) => {
    if (typeof window === "undefined") return false;
    return !!memoryCache[key];
  },
  
  delete: (key: string) => {
    if (typeof window === "undefined") return;
    delete memoryCache[key];
  },
  
  clear: () => {
    if (typeof window === "undefined") return;
    for (const key in memoryCache) {
      delete memoryCache[key];
    }
  }
};
