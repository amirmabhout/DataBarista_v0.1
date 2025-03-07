/**
 * Utility functions for handling profile data
 */
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
  matchHistory?: Array<{
    platform: string;
    username: string;
    timestamp: Date;
  }>;
  matchRequests?: Array<{
    timestamp: Date;
    count: number;
  }>;
  telegramChatId?: string;
  community?: string;
}

// Database connection singleton
let ckgClient: MongoClient | null = null;

/**
 * Ensure connection to the MongoDB CKG database
 */
async function ensureCkgConnection(runtime: IAgentRuntime): Promise<MongoClient> {
  if (ckgClient) {
    return ckgClient;
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
    
    ckgClient = new MongoClient(connectionString);
    await ckgClient.connect();
    
    elizaLogger.info('Successfully connected to MongoDB CKG');
    
    return ckgClient;
  } catch (error) {
    elizaLogger.error('Failed to connect to MongoDB CKG', error);
    throw error;
  }
}

/**
 * Get a user profile directly from the database
 * @param runtime Agent runtime for database access
 * @param platform Social platform identifier
 * @param username Username on the platform
 * @returns User profile data or null if not found/error
 */
export async function getProfile(
  runtime: IAgentRuntime,
  platform: string,
  username: string
): Promise<any> {
  try {
    elizaLogger.info('Fetching user profile from MongoDB CKG for:', { platform, username });
    
    const client = await ensureCkgConnection(runtime);
    const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
    
    // Check if MONGODB_DATABASE_COLLECTION is set in environment, otherwise use platform
    const collectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || platform;
    const collection = db.collection(collectionName);
    
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
    return null;
  } catch (error) {
    elizaLogger.error(`Error fetching profile for ${username} on ${platform}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}