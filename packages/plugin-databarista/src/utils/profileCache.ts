import { elizaLogger } from "@elizaos/core";

interface UserProfile {
  data: any;
  timestamp: number;
  isEmpty: boolean;  // Flag to indicate if this is an empty profile
}

class ProfileCache {
  private static instance: ProfileCache;
  private cache: Map<string, UserProfile>;
  private readonly CACHE_TTL = 1000 * 60 * 60; // 1 hour TTL for normal profiles
  private readonly EMPTY_CACHE_TTL = 1000 * 60 * 5; // 5 minutes TTL for empty profiles

  private constructor() {
    this.cache = new Map();
  }

  public static getInstance(): ProfileCache {
    if (!ProfileCache.instance) {
      ProfileCache.instance = new ProfileCache();
    }
    return ProfileCache.instance;
  }

  private getCacheKey(platform: string, username: string): string {
    return `${platform}:${username}`;
  }

  public get(platform: string, username: string): any | null {
    const key = this.getCacheKey(platform, username);
    const cached = this.cache.get(key);

    if (!cached) {
      elizaLogger.info("Cache miss for user profile:", { platform, username });
      return null;
    }

    // Check if cache has expired based on whether it's an empty profile or not
    const ttl = cached.isEmpty ? this.EMPTY_CACHE_TTL : this.CACHE_TTL;
    if (Date.now() - cached.timestamp > ttl) {
      elizaLogger.info("Cache expired for user profile:", { 
        platform, 
        username,
        isEmpty: cached.isEmpty,
        ttl: cached.isEmpty ? "5 minutes" : "1 hour"
      });
      this.cache.delete(key);
      return null;
    }

    elizaLogger.info("Cache hit for user profile:", { 
      platform, 
      username,
      isEmpty: cached.isEmpty
    });
    return cached.data;
  }

  public set(platform: string, username: string, data: any): void {
    const key = this.getCacheKey(platform, username);
    const isEmpty = !data || (Array.isArray(data) && data.length === 0);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      isEmpty
    });

    elizaLogger.info("Updated cache for user profile:", { 
      platform, 
      username,
      isEmpty,
      ttl: isEmpty ? "5 minutes" : "1 hour"
    });
  }

  public invalidate(platform: string, username: string): void {
    const key = this.getCacheKey(platform, username);
    this.cache.delete(key);
    elizaLogger.info("Invalidated cache for user profile:", { platform, username });
  }
}

export const profileCache = ProfileCache.getInstance(); 