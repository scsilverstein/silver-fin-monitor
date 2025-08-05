import { Request, Response, NextFunction } from 'express';

export interface CacheOptions {
  maxAge?: number;
  noCache?: boolean;
  noStore?: boolean;
  mustRevalidate?: boolean;
  private?: boolean;
  public?: boolean;
}

export const setCacheHeaders = (options: CacheOptions = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const {
      maxAge = 0,
      noCache = true,
      noStore = true,
      mustRevalidate = false,
      private: isPrivate = false,
      public: isPublic = false
    } = options;

    const cacheDirectives: string[] = [];

    if (noCache) cacheDirectives.push('no-cache');
    if (noStore) cacheDirectives.push('no-store');
    if (mustRevalidate) cacheDirectives.push('must-revalidate');
    if (isPrivate) cacheDirectives.push('private');
    if (isPublic) cacheDirectives.push('public');
    if (maxAge > 0) cacheDirectives.push(`max-age=${maxAge}`);

    const cacheControl = cacheDirectives.join(', ') || 'no-cache';

    res.set({
      'Cache-Control': cacheControl,
      'Pragma': noCache ? 'no-cache' : '',
      'Expires': noCache ? '0' : new Date(Date.now() + maxAge * 1000).toUTCString()
    });

    next();
  };
};

// Predefined cache strategies
export const neverCache = setCacheHeaders({
  noCache: true,
  noStore: true,
  mustRevalidate: true,
  private: true
});

export const shortCache = setCacheHeaders({
  maxAge: 300, // 5 minutes
  mustRevalidate: true,
  public: true
});

export const mediumCache = setCacheHeaders({
  maxAge: 3600, // 1 hour
  mustRevalidate: true,
  public: true
});

export const longCache = setCacheHeaders({
  maxAge: 86400, // 24 hours
  public: true
});