import { IAgentRuntime, elizaLogger } from "@elizaos/core";
import { MongoClient } from 'mongodb';

/**
 * Interface for profile data returned from MongoDB CKG
 */
interface ProfileData {
  platform: string;
  username: string;
  latestProfile: {
    public: any;
    private: any;
    timestamp?: Date;
  };
  timestamp?: Date;
  lastUpdated?: Date;
  // Match history to avoid repetitive matches
  matchHistory?: Array<{
    platform: string;
    username: string;
    timestamp: Date;
  }>;
  // Match request timestamps for rate limiting
  matchRequests?: Array<{
    timestamp: Date;
    count: number;
  }>;
}

/**
 * A utility class for interacting with the MongoDB CKG database for user profiles
 */
class MongoProfileProvider {
  private ckgClient: MongoClient | null = null;
  private readonly PROFILES_COLLECTION = 'profiles';

  /**
   * Ensure connection to the MongoDB CKG database
   */
  private async ensureCkgConnection(runtime: IAgentRuntime): Promise<MongoClient> {
    if (this.ckgClient) {
      return this.ckgClient;
    }

    try {
      const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
      const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');

      if (!connectionString) {
        throw new Error('MONGODB_CONNECTION_STRING_CKG not set in environment');
      }

      if (!dbName) {
        throw new Error('MONGODB_DATABASE_CKG not set in environment');
      }

      elizaLogger.info('Connecting to MongoDB CKG', { dbName });
      
      this.ckgClient = new MongoClient(connectionString);
      await this.ckgClient.connect();
      
      elizaLogger.info('Successfully connected to MongoDB CKG');
      
      return this.ckgClient;
    } catch (error) {
      elizaLogger.error('Failed to connect to MongoDB CKG', error);
      throw error;
    }
  }

  /**
   * Get a profile from the MongoDB CKG database
   * Optimized to directly fetch only the necessary fields without caching
   */
  async getProfile(
    runtime: IAgentRuntime, 
    platform: string, 
    username: string, 
    forceRefresh: boolean = false // parameter kept for backward compatibility
  ): Promise<ProfileData[]> {
    try {
      elizaLogger.info('Fetching user profile from MongoDB CKG for:', { platform, username });
      
      const client = await this.ensureCkgConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
      const collection = db.collection(this.PROFILES_COLLECTION);
      
      // Optimized query that only fetches the necessary fields
      // and explicitly excludes the embedding field
      const results = await collection.find(
        { platform, username },
        { 
          projection: {
            platform: 1,
            username: 1,
            "latestProfile.public": 1,
            "latestProfile.private": 1,
            "latestProfile.timestamp": 1,
            timestamp: 1,
            lastUpdated: 1,
            "matchHistory": 1,
            "matchRequests": 1
          } 
        }
      ).sort({ timestamp: -1 }).toArray() as unknown as ProfileData[];
      
      elizaLogger.info(`Found ${results.length} profile(s) for ${username} on ${platform}`);
      
      if (results.length > 0) {
        return results;
      }
      
      elizaLogger.warn(`No profile found for ${username} on ${platform}`);
      return [];
    } catch (error) {
      elizaLogger.error('Error in mongoProfileProvider.getProfile:', error);
      return [];
    }
  }

  /**
   * Check if a user has reached their match request limit (5 matches in 24 hours)
   * @param runtime Agent runtime
   * @param platform User platform
   * @param username User username
   * @returns Object with isLimited boolean and remaining count
   */
  async checkMatchLimit(
    runtime: IAgentRuntime,
    platform: string,
    username: string
  ): Promise<{ isLimited: boolean; remaining: number; resetTime?: Date }> {
    try {
      const client = await this.ensureCkgConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
      const collection = db.collection(this.PROFILES_COLLECTION);
      
      // Get the user profile
      const profile = await collection.findOne(
        { platform, username },
        { projection: { matchRequests: 1 } }
      );
      
      if (!profile) {
        // If no profile, they haven't made any requests yet
        return { isLimited: false, remaining: 5 };
      }
      
      const matchRequests = profile.matchRequests || [];
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      // Filter requests made in the last 24 hours
      const recentRequests = matchRequests.filter(request => 
        new Date(request.timestamp) > oneDayAgo
      );
      
      // Calculate total count of requests in the last 24 hours
      const totalCount = recentRequests.reduce((sum, request) => sum + request.count, 0);
      
      // Check if limit is reached
      const isLimited = totalCount >= 5;
      const remaining = Math.max(0, 5 - totalCount);
      
      // Calculate when the limit will reset (when the oldest request becomes > 24h old)
      let resetTime;
      if (recentRequests.length > 0 && isLimited) {
        const oldestRequest = recentRequests.reduce((oldest, current) => 
          new Date(oldest.timestamp) < new Date(current.timestamp) ? oldest : current
        );
        resetTime = new Date(new Date(oldestRequest.timestamp).getTime() + 24 * 60 * 60 * 1000);
      }
      
      return { isLimited, remaining, resetTime };
    } catch (error) {
      elizaLogger.error('Error checking match limit:', error);
      // Default to not limited in case of error
      return { isLimited: false, remaining: 5 };
    }
  }
  
  /**
   * Record a match request for rate limiting purposes
   * @param runtime Agent runtime
   * @param platform User platform
   * @param username User username
   * @returns Success status
   */
  async recordMatchRequest(
    runtime: IAgentRuntime,
    platform: string,
    username: string
  ): Promise<boolean> {
    try {
      const client = await this.ensureCkgConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
      const collection = db.collection(this.PROFILES_COLLECTION);
      
      const now = new Date();
      
      // Update or create the match requests record
      const result = await collection.updateOne(
        { platform, username },
        { 
          $push: { 
            matchRequests: { 
              timestamp: now,
              count: 1
            } 
          }
        },
        { upsert: true }
      );
      
      return result.acknowledged;
    } catch (error) {
      elizaLogger.error('Error recording match request:', error);
      return false;
    }
  }
  
  /**
   * Store matches in user's profile to avoid repetition
   * @param runtime Agent runtime
   * @param userPlatform User platform
   * @param userUsername User username
   * @param matches Array of matches to record
   * @returns Success status
   */
  async recordMatches(
    runtime: IAgentRuntime,
    userPlatform: string,
    userUsername: string,
    matches: Array<{ platform: string; username: string }>
  ): Promise<boolean> {
    try {
      if (!matches || matches.length === 0) {
        return true; // Nothing to record
      }
      
      const client = await this.ensureCkgConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
      const collection = db.collection(this.PROFILES_COLLECTION);
      
      const now = new Date();
      
      // Format the matches with timestamps
      const matchesWithTimestamp = matches.map(match => ({
        platform: match.platform,
        username: match.username,
        timestamp: now
      }));
      
      // Add matches to user's match history
      const result = await collection.updateOne(
        { platform: userPlatform, username: userUsername },
        { 
          $push: { 
            matchHistory: { 
              $each: matchesWithTimestamp 
            } 
          }
        },
        { upsert: true }
      );
      
      return result.acknowledged;
    } catch (error) {
      elizaLogger.error('Error recording matches:', error);
      return false;
    }
  }
  
  /**
   * Get a user's match history
   * @param runtime Agent runtime
   * @param platform User platform
   * @param username User username
   * @returns Array of previous matches
   */
  async getMatchHistory(
    runtime: IAgentRuntime,
    platform: string,
    username: string
  ): Promise<Array<{ platform: string; username: string; timestamp: Date }>> {
    try {
      const client = await this.ensureCkgConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
      const collection = db.collection(this.PROFILES_COLLECTION);
      
      const profile = await collection.findOne(
        { platform, username },
        { projection: { matchHistory: 1 } }
      );
      
      return profile?.matchHistory || [];
    } catch (error) {
      elizaLogger.error('Error getting match history:', error);
      return [];
    }
  }
}

export const mongoProfileProvider = new MongoProfileProvider(); 