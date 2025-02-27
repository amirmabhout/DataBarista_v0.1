import { IAgentRuntime, elizaLogger, type HandlerCallback } from "@elizaos/core";
import { MongoClient } from 'mongodb';

// Define InterestChats locally instead of importing from client-telegram
interface InterestChats {
  [key: string]: {
    currentHandler?: string;
    lastMessageSent?: number;
    messages: Array<{
      userName: string;
      chatId?: string;
      messageText?: string;
    }>;
  };
}

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
  // Store original Telegram chat ID for sending notifications
  telegramChatId?: string;
}

interface TelegramMessageManager {
  interestChats: {
    [key: string]: {
      messages: Array<{
        userName: string;
        chatId?: string;
      }>;
    };
  };
  getUserChatId?: (username: string) => string | undefined;
  getAllUserChatIds?: () => Record<string, string>;
}

interface TelegramClient {
  messageManager: TelegramMessageManager;
  bot: {
    telegram: {
      sendMessage(chatId: string, message: string): Promise<any>;
    };
  };
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
  
  /**
   * Find a user's account details by username
   * @param runtime Agent runtime
   * @param platform Platform name
   * @param username Username to search for
   * @returns User account details if found, or null
   */
  async findAccountByUsername(
    runtime: IAgentRuntime,
    platform: string,
    username: string
  ): Promise<{ id: string; username: string } | null> {
    try {
      elizaLogger.info(`Looking up account for ${username} on ${platform}`);
      
      const client = await this.ensureCkgConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
      const collection = db.collection('accounts');
      
      // Find the account document
      const account = await collection.findOne({ 
        username: username,
        platform: platform 
      });
      
      if (account) {
        elizaLogger.info(`Found account for ${username} with ID: ${account.id}`);
        return {
          id: account.id,
          username: account.username
        };
      }
      
      elizaLogger.warn(`Could not find account for ${username} on ${platform}`);
      return null;
    } catch (error) {
      elizaLogger.error(`Error finding account for ${username}:`, error);
      return null;
    }
  }
  
  /**
   * Find a user's Telegram chat ID from the memories collection
   * @param runtime Agent runtime
   * @param username Username to find chat ID for
   * @returns Chat ID if found, or null
   */
  async findTelegramChatIdFromMemories(
    runtime: IAgentRuntime,
    username: string
  ): Promise<string | null> {
    try {
      elizaLogger.info(`Looking up Telegram chat ID for username: ${username} from memories`);
      
      // First find the user's account to get their userId
      const account = await this.findAccountByUsername(runtime, 'telegram', username);
      if (!account) {
        elizaLogger.warn(`Could not find account for ${username}`);
        return null;
      }
      
      const userId = account.id;
      elizaLogger.info(`Found userId ${userId} for ${username}, searching for roomId in memories`);
      
      const client = await this.ensureCkgConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
      const collection = db.collection('memories');
      
      // Log the database and collection being queried
      elizaLogger.debug(`Querying collection: ${collection.collectionName} in database: ${db.databaseName}`);
      
      // Find the most recent memory for this user
      const memory = await collection.findOne(
        { userId: userId },
        { sort: { createdAt: -1 } }
      );
      
      // Log whether we found a memory
      if (memory) {
        elizaLogger.debug(`Found memory for userId ${userId}: ${JSON.stringify(memory, null, 2)}`);
      } else {
        elizaLogger.debug(`No memory found for userId ${userId}`);
        
        // Try an alternative query to find any memories for this user
        const allMemories = await collection.find({ userId: userId }).limit(5).toArray();
        elizaLogger.debug(`Alternative query found ${allMemories.length} memories for userId ${userId}`);
        
        if (allMemories.length > 0) {
          const firstMemory = allMemories[0];
          if (firstMemory.roomId) {
            elizaLogger.info(`Found roomId ${firstMemory.roomId} for ${username} from alternative query`);
            return firstMemory.roomId;
          }
        }
      }
      
      if (memory && memory.roomId) {
        elizaLogger.info(`Found roomId ${memory.roomId} for ${username} in memories`);
        return memory.roomId;
      }
      
      elizaLogger.warn(`Could not find roomId for ${username} in memories`);
      return null;
    } catch (error) {
      elizaLogger.error(`Error finding chat ID from memories for ${username}:`, error);
      return null;
    }
  }
  
  /**
   * Find a user's chat ID by directly querying the account and memory collections
   * This method uses information from both collections to find the correct chat ID
   * @param runtime Agent runtime
   * @param username Username to find chat ID for
   * @returns Chat ID if found, or null
   */
  async findTelegramRoomId(runtime: IAgentRuntime, username: string): Promise<string | null> {
    try {
      elizaLogger.info(`Looking up Telegram roomId for username: ${username} by direct DB query`);
      
      const client = await this.ensureCkgConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
      
      // First, find the user in the accounts collection to get their ID
      const accountsCollection = db.collection('accounts');
      const account = await accountsCollection.findOne({ 
        username: username, 
        platform: 'telegram' 
      });
      
      if (!account || !account.id) {
        elizaLogger.warn(`Could not find account ID for ${username} in accounts collection`);
        return null;
      }
      
      const userId = account.id;
      elizaLogger.info(`Found userId ${userId} for ${username}`);
      
      // Now, search the memories collection for entries with this userId
      const memoriesCollection = db.collection('memories');
      
      // Look for any memory with this userId and get its roomId
      const memory = await memoriesCollection.findOne(
        { userId: userId },
        { projection: { roomId: 1 } }
      );
      
      if (memory && memory.roomId) {
        elizaLogger.info(`Found roomId ${memory.roomId} for userId ${userId}`);
        return memory.roomId;
      }
      
      elizaLogger.warn(`No memory with roomId found for userId ${userId}`);
      return null;
    } catch (error) {
      elizaLogger.error(`Error in findTelegramRoomId: ${error}`);
      return null;
    }
  }
  
  /**
   * Ensure connection to the main MongoDB database (not CKG)
   */
  private async ensureMainDbConnection(runtime: IAgentRuntime): Promise<MongoClient> {
    try {
      const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING');
      const dbName = runtime.getSetting('MONGODB_DATABASE');

      if (!connectionString) {
        throw new Error('MONGODB_CONNECTION_STRING not set in environment');
      }

      if (!dbName) {
        throw new Error('MONGODB_DATABASE not set in environment');
      }

      elizaLogger.info('Connecting to main MongoDB database', { dbName });
      
      const client = new MongoClient(connectionString);
      await client.connect();
      
      elizaLogger.info('Successfully connected to main MongoDB database');
      
      return client;
    } catch (error) {
      elizaLogger.error('Failed to connect to main MongoDB database', error);
      throw error;
    }
  }

  /**
   * Find a user's most recent message ID for reply context
   * @param runtime Agent runtime
   * @param username Username to find message for
   * @returns Message ID if found, or null
   */
  async findLatestMessageId(
    runtime: IAgentRuntime,
    username: string
  ): Promise<{ messageId: string | null, userId: string | null }> {
    let client: MongoClient | null = null;
    
    try {
      elizaLogger.info(`[findLatestMessageId] Looking up latest message ID for username: ${username}`);
      
      client = await this.ensureMainDbConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE'));
      
      // Step 1: Find the user's account to get their userId
      const accountsCollection = db.collection('accounts');
      elizaLogger.info(`[findLatestMessageId] Querying accounts collection for username: ${username}`);
      const account = await accountsCollection.findOne({ username: username });
      
      if (!account || !account.id) {
        elizaLogger.warn(`[findLatestMessageId] Could not find account ID for ${username}`);
        return { messageId: null, userId: null };
      }
      
      const userId = account.id;
      elizaLogger.info(`[findLatestMessageId] Found userId ${userId} for ${username}`);
      
      // Step 2: Search the memories collection for the most recent message from this user
      const memoriesCollection = db.collection('memories');
      elizaLogger.info(`[findLatestMessageId] Querying memories collection for userId: ${userId}`);
      
      // Find the most recent message from this user
      const memory = await memoriesCollection.findOne(
        { userId: userId, type: "messages" },
        { sort: { createdAt: -1 } }
      );
      
      if (memory && memory.id) {
        elizaLogger.info(`[findLatestMessageId] Found most recent message ID ${memory.id} for user ${username} with userId ${userId}`);
        return { messageId: memory.id, userId: userId };
      }
      
      elizaLogger.warn(`[findLatestMessageId] No messages found for user ${username} with userId ${userId}`);
      return { messageId: null, userId: userId };
    } catch (error) {
      elizaLogger.error(`[findLatestMessageId] Error finding latest message ID for ${username}:`, error);
      return { messageId: null, userId: null };
    } finally {
      if (client) {
        try {
          await client.close();
          elizaLogger.debug(`[findLatestMessageId] Closed MongoDB connection`);
        } catch (closeError) {
          elizaLogger.error(`[findLatestMessageId] Error closing MongoDB connection:`, closeError);
        }
      }
    }
  }

  /**
   * Send a notification message to a user
   * @param runtime Agent runtime
   * @param platform User platform
   * @param username User username
   * @param message Message to send
   * @param userCallback Optional callback function to use for sending messages
   * @returns Success status
   */
  async sendNotification(
    runtime: IAgentRuntime,
    platform: string,
    username: string,
    message: string,
    userCallback?: HandlerCallback
  ): Promise<boolean> {
    try {
      // Only use the chat ID from the CKG database
      if (platform === 'telegram') {
        const storedChatId = await this.getTelegramChatId(runtime, username);
        if (storedChatId) {
          try {
            const telegramClient = runtime.clients['telegram'] as TelegramClient;
            await telegramClient.bot.telegram.sendMessage(storedChatId, message);
            return true;
          } catch (error) {
            elizaLogger.error(`Failed to send Telegram message to ${username}: ${error}`);
            return false;
          }
        } else {
          elizaLogger.warn(`No chat ID found for user ${username}`);
          return false;
        }
      }

     

      return false;
    } catch (error) {
      elizaLogger.error(`Error in sendNotification: ${error}`);
      return false;
    }
  }

  /**
   * Store a user's Telegram chat ID in their profile
   * @param runtime Agent runtime
   * @param identifier Telegram username or generated identifier
   * @param chatId Original Telegram chat ID (numeric)
   * @returns Success status
   */
  async storeTelegramChatId(
    runtime: IAgentRuntime,
    identifier: string,
    chatId: string
  ): Promise<boolean> {
    try {
      // Clean the identifier - ensure no @ prefix for database queries
      const cleanIdentifier = identifier.replace(/^@/, '');
      elizaLogger.info(`[storeTelegramChatId] Storing chat ID ${chatId} for identifier ${cleanIdentifier}`);
      
      const client = await this.ensureCkgConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
      const collection = db.collection(this.PROFILES_COLLECTION);
      
      // Check if user exists in profiles collection
      const existingProfile = await collection.findOne({ 
        $or: [
          { platform: 'telegram', username: cleanIdentifier },
          { platform: 'telegram', telegramChatId: chatId }
        ]
      });
      
      if (existingProfile) {
        // User exists, update their profile with the chat ID
        elizaLogger.info(`[storeTelegramChatId] Updating existing profile with chat ID for ${cleanIdentifier}`);
        
        const result = await collection.updateOne(
          { _id: existingProfile._id },
          { 
            $set: { 
              telegramChatId: chatId,
              lastUpdated: new Date()
            },
            $setOnInsert: {
              platform: 'telegram',
              username: cleanIdentifier
            }
          }
        );
        
        return result.acknowledged;
      } else {
        // User doesn't exist yet, create a minimal profile
        elizaLogger.info(`[storeTelegramChatId] Creating new profile with chat ID for ${cleanIdentifier}`);
        
        const now = new Date();
        const profileDocument = {
          platform: 'telegram',
          username: cleanIdentifier,
          telegramChatId: chatId,
          created: now,
          lastUpdated: now,
          latestProfile: {
            public: {},
            private: {},
            timestamp: now
          }
        };
        
        const result = await collection.insertOne(profileDocument);
        return result.acknowledged;
      }
    } catch (error) {
      elizaLogger.error(`[storeTelegramChatId] Error storing chat ID for ${identifier}:`, error);
      return false;
    }
  }
  
  /**
   * Retrieve a user's stored Telegram chat ID
   * @param runtime Agent runtime
   * @param username Telegram username
   * @returns The original Telegram chat ID or null if not found
   */
  async getTelegramChatId(
    runtime: IAgentRuntime,
    username: string
  ): Promise<string | null> {
    try {
      // Clean the username - ensure no @ prefix for database queries
      const cleanUsername = username.replace(/^@/, '');
      elizaLogger.info(`[getTelegramChatId] Looking up chat ID for user ${cleanUsername}`);
      
      const client = await this.ensureCkgConnection(runtime);
      const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
      const collection = db.collection(this.PROFILES_COLLECTION);
      
      // Look for the stored chat ID
      const profile = await collection.findOne(
        { platform: 'telegram', username: cleanUsername },
        { projection: { telegramChatId: 1 } }
      );
      
      if (profile && profile.telegramChatId) {
        elizaLogger.info(`[getTelegramChatId] Found chat ID ${profile.telegramChatId} for ${cleanUsername}`);
        return profile.telegramChatId;
      }
      
      elizaLogger.warn(`[getTelegramChatId] No chat ID found for user ${cleanUsername}`);
      return null;
    } catch (error) {
      elizaLogger.error(`[getTelegramChatId] Error retrieving chat ID for ${username}:`, error);
      return null;
    }
  }
}

export const mongoProfileProvider = new MongoProfileProvider(); 