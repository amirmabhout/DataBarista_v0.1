import {
  IAgentRuntime,
  Memory,
  State,
  elizaLogger,
  ModelClass,
  composeContext,
  generateObjectArray,
  embed,
  type HandlerCallback
} from "@elizaos/core";
import { MongoClient } from 'mongodb';
import { IDEAL_MATCH_TEMPLATE } from "./promptTemplates";
import { SHACL_SHAPES } from "./shaclShapes";
import { DAILY_MATCH_LIMIT, DEFAULT_VECTOR_INDEX_NAME, MONGODB_VECTOR_INDEX_ENV_VAR } from "./constants";

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
    embedding?: number[];
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
  agentUsername?: string;
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
 * Generates an ideal match profile description based on user profile data
 * @param runtime Agent runtime
 * @param userProfileData User profile data
 * @param state Current state
 * @returns Ideal match description or null if generation fails
 */
export async function generateIdealMatchProfile(
  runtime: IAgentRuntime,
  userProfileData: any,
  state?: State
): Promise<string | null> {
  try {
    elizaLogger.debug('Generating ideal match profile with context');
    
    // Update state with recent messages if not present
    if (state && !state.recentMessages) {
      state = await runtime.updateRecentMessageState(state);
    }

    const context = composeContext({
      template: IDEAL_MATCH_TEMPLATE,
      state: {
        shaclShapes: SHACL_SHAPES,
        userProfileData: JSON.stringify(userProfileData, null, 2),
        recentMessages: state?.recentMessages || []
      } as any
    });

    const idealMatchResult = await generateObjectArray({
      runtime,
      context,
      modelClass: ModelClass.LARGE
    });

    if (!idealMatchResult?.length) {
      elizaLogger.error("Failed to generate ideal match profile: empty result");
      return null;
    }

    // Extract the ideal match description text
    const idealMatchDescription = idealMatchResult[0].ideal_match_description;
    
    if (!idealMatchDescription) {
      elizaLogger.error("Invalid ideal match description format: missing ideal_match_description field");
      return null;
    }
    
    return idealMatchDescription;
  } catch (error) {
    elizaLogger.error(`Error generating ideal match profile: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Generate embeddings for profile data using ElizaOS Core's embedding service
 * @param runtime Agent runtime for embedding service 
 * @param profileData Profile data to generate embeddings for (either a complex object or an object with ideal_match_description)
 * @returns Embedding vector as number array
 */
export async function generateProfileEmbedding(
  runtime: IAgentRuntime,
  profileData: any
): Promise<number[] | null> {
  try {
    let textToEmbed = '';
    
    // Check if we have a simple ideal match description
    if (profileData.ideal_match_description) {
      // If we have a direct description text, use it directly
      textToEmbed = profileData.ideal_match_description;
    } else {
      // Otherwise, extract from complex profile structure
      const publicData = profileData.public || {};
      const privateData = profileData.private || {};
      
      // Combine the most important semantic fields for embedding
      textToEmbed = [
        publicData["datalatte:summary"] || "",
        publicData["datalatte:intentCategory"] || "",
        publicData["datalatte:projectDescription"] || "",
        privateData["datalatte:background"] || "",
        privateData["datalatte:knowledgeDomain"] || "",
        privateData?.["datalatte:hasProject"]?.["datalatte:projectDomain"] || "",
        privateData?.["datalatte:hasProject"]?.["schema:description"] || "",
        // Join desired connections if it's an array
        Array.isArray(publicData["datalatte:desiredConnections"]) 
          ? publicData["datalatte:desiredConnections"].join(" ") 
          : (publicData["datalatte:desiredConnections"] || "")
      ].filter(Boolean).join(" ");
    }
    
    if (!textToEmbed.trim()) {
      elizaLogger.warn("No meaningful text found to embed for profile");
      return null;
    }
    
    // Use ElizaOS Core embedding service
    const embedding = await embed(runtime, textToEmbed);
    
    if (embedding && embedding.length > 0) {
      return embedding;
    } else {
      elizaLogger.warn("Embedding generation returned empty vector");
      return null;
    }
  } catch (error) {
    elizaLogger.error("Error generating profile embedding:", error);
    return null;
  }
}

/**
 * Find matching profiles using MongoDB Atlas Vector Search
 * @param runtime Agent runtime
 * @param idealProfileEmbedding Embedding vector for the ideal match profile
 * @param platform Platform name
 * @param username Username
 * @param state Current state or platform string
 * @returns Array of matching profiles
 */
export async function findMatchingProfilesWithAtlasSearch(
  runtime: IAgentRuntime,
  idealProfileEmbedding: number[],
  platform: string,
  username: string,
  state?: State | string
): Promise<any[]> {
  try {
    const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
    const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');
    
    if (!connectionString || !dbName) {
      elizaLogger.error('Missing MongoDB connection settings');
      return [];
    }
    
    const client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    // Check if MONGODB_DATABASE_COLLECTION is set in environment, otherwise use platform
    const collectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || platform;
    const collection = db.collection(collectionName);
    
  
    // Get the user's match history to avoid showing the same profiles again
    const matchHistory = await getMatchHistory(
      runtime, 
      platform, 
      username
    );
    
    // Create a list of profile IDs to exclude (user's profile + previously matched profiles)
    const excludeList = matchHistory.map(match => ({
      platform: match.platform,
      username: match.username
    }));
    
    // Add the user's own profile to the exclude list
    excludeList.push({
      platform,
      username
    });
    
    // Use Atlas Vector Search to find the top matches
    // Try to get vector index name from dedicated environment variable first
    // If not available, try using MONGODB_DATABASE_COLLECTION
    // If neither is available, use the default name
    const vectorIndexName = runtime.getSetting(MONGODB_VECTOR_INDEX_ENV_VAR) || 
                            runtime.getSetting('MONGODB_DATABASE_COLLECTION') || 
                            DEFAULT_VECTOR_INDEX_NAME;
    elizaLogger.info(`Using vector index name: ${vectorIndexName}`);
    
    const pipeline = [
      {
        $vectorSearch: {
          index: vectorIndexName,
          path: "latestProfile.embedding",
          queryVector: idealProfileEmbedding,
          numCandidates: 100,
          limit: 10 // Increase limit to ensure we have enough candidates after filtering
        }
      },
      {
        $match: {
          $nor: excludeList.map(item => ({
            platform: item.platform,
            username: item.username
          }))
        }
      },
      {
        $project: {
          platform: 1,
          username: 1,
          "latestProfile.public": 1,
          "latestProfile.private": 1,
          "latestProfile.timestamp": 1,
          timestamp: 1,
          lastUpdated: 1,
          score: { $meta: "vectorSearchScore" }
        }
      },
      {
        $limit: 7 // Limit to top 7 matches after filtering
      }
    ];
    
    const matches = await collection.aggregate(pipeline).toArray();
    
    // Format the results to match the expected structure
    const result = matches.map(match => ({
      platform: match.platform,
      username: match.username,
      profileData: match.latestProfile,
      timestamp: match.timestamp || match.lastUpdated || new Date(),
      score: match.score
    }));
    
    await client.close();
    
    return result;
  } catch (error) {
    elizaLogger.error("Atlas search failed:", error);
    return [];
  }
}

/**
 * Send a notification to a matched user
 * @param runtime Agent runtime
 * @param platform Platform of the matched user
 * @param matchedUsername Username of the matched user
 * @param username Username of the requesting user
 * @param postMessage The message to send to the matched user
 * @param callback Optional callback function for direct messaging
 * @returns Boolean indicating success
 */
export async function notifyMatchedUser(
  runtime: IAgentRuntime,
  platform: string,
  matchedUsername: string,
  username: string,
  postMessage: string,
  callback?: any
): Promise<boolean> {
  try {
    // Create a personalized message for the matched user
    const matchNotificationMessage = `
Hey @${matchedUsername}! ☕️

${username} just dropped by my café chatting about their latest challenge, and I immediately thought of you. Couldn't resist passing along your contact—hope that's cool! Here's the brew I served up about you:

----------
${postMessage}
----------

Hope you two stir up something amazing together! Thanks a latte! ☕️✨
`;
    
    // Send the notification
    const notificationSent = await sendNotification(
      runtime,
      platform,
      matchedUsername,
      matchNotificationMessage,
      callback
    );
    
    if (notificationSent) {
      elizaLogger.info(`Successfully notified ${matchedUsername} about the match with ${username}`);
    } else {
      elizaLogger.warn(`Failed to notify ${matchedUsername} about the match with ${username}`);
    }
    
    return notificationSent;
  } catch (error) {
    elizaLogger.error(`Error notifying matched user: ${error}`);
    return false;
  }
}

/**
 * Check if a user has reached their match request limit (5 matches in 24 hours)
 * @param runtime Agent runtime
 * @param platform User platform
 * @param username User username
 * @returns Object with isLimited boolean and remaining count
 */
export async function checkMatchLimit(
  runtime: IAgentRuntime,
  platform: string,
  username: string
): Promise<{ isLimited: boolean; remaining: number; resetTime?: Date }> {
  try {
    const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
    const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');
    
    if (!connectionString || !dbName) {
      elizaLogger.error('Missing MongoDB connection settings');
      return { isLimited: false, remaining: DAILY_MATCH_LIMIT };
    }
    
    const client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    // Check if MONGODB_DATABASE_COLLECTION is set in environment, otherwise use platform
    const collectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || platform;
    const collection = db.collection(collectionName);
    
    // Get the user profile
    const profile = await collection.findOne(
      { platform, username },
      { projection: { matchRequests: 1 } }
    );
    
    await client.close();
    
    if (!profile) {
      // If no profile, they haven't made any requests yet
      return { isLimited: false, remaining: DAILY_MATCH_LIMIT };
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
    const isLimited = totalCount >= DAILY_MATCH_LIMIT;
    const remaining = Math.max(0, DAILY_MATCH_LIMIT - totalCount);
    
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
    return { isLimited: false, remaining: DAILY_MATCH_LIMIT };
  }
}

/**
 * Record a match request for rate limiting purposes
 * @param runtime Agent runtime
 * @param platform User platform
 * @param username User username
 * @returns Success status
 */
export async function recordMatchRequest(
  runtime: IAgentRuntime,
  platform: string,
  username: string
): Promise<boolean> {
  try {
    const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
    const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');
    
    if (!connectionString || !dbName) {
      elizaLogger.error('Missing MongoDB connection settings');
      return false;
    }
    
    const client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    // Check if MONGODB_DATABASE_COLLECTION is set in environment, otherwise use platform
    const collectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || platform;
    const collection = db.collection(collectionName);
    
    const now = new Date();
    
    // Update or create the match requests record using $addToSet instead of $push
    const result = await collection.updateOne(
      { platform, username },
      { 
        $addToSet: { 
          matchRequests: { 
            timestamp: now,
            count: 1
          }
        }
      },
      { upsert: true }
    );
    
    await client.close();
    
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
export async function recordMatches(
  runtime: IAgentRuntime,
  userPlatform: string,
  userUsername: string,
  matches: Array<{ platform: string; username: string }>
): Promise<boolean> {
  try {
    if (!matches || matches.length === 0) {
      return true; // Nothing to record
    }
    
    const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
    const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');
    
    if (!connectionString || !dbName) {
      elizaLogger.error('Missing MongoDB connection settings');
      return false;
    }
    
    const client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection(userPlatform);
    
    const now = new Date();
    
    // Format the matches with timestamps
    const matchesWithTimestamp = matches.map(match => ({
      platform: match.platform,
      username: match.username,
      timestamp: now
    }));
    
    // Add matches to user's match history one by one to avoid complex update operators
    let success = true;
    for (const match of matchesWithTimestamp) {
      const result = await collection.updateOne(
        { platform: userPlatform, username: userUsername },
        { 
          $addToSet: { 
            matchHistory: match
          }
        },
        { upsert: true }
      );
      
      if (!result.acknowledged) {
        success = false;
      }
    }
    
    await client.close();
    
    return success;
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
export async function getMatchHistory(
  runtime: IAgentRuntime,
  platform: string,
  username: string
): Promise<Array<{ platform: string; username: string; timestamp: Date }>> {
  try {
    const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
    const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');
    
    if (!connectionString || !dbName) {
      elizaLogger.error('Missing MongoDB connection settings');
      return [];
    }
    
    const client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    // Check if MONGODB_DATABASE_COLLECTION is set in environment, otherwise use platform
    const collectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || platform;
    const collection = db.collection(collectionName);
    
    const profile = await collection.findOne(
      { platform, username },
      { projection: { matchHistory: 1 } }
    );
    
    await client.close();
    
    return profile?.matchHistory || [];
  } catch (error) {
    elizaLogger.error('Error getting match history:', error);
    return [];
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
export async function sendNotification(
  runtime: IAgentRuntime,
  platform: string,
  username: string,
  message: string,
  userCallback?: HandlerCallback
): Promise<boolean> {
  try {
    // Only use the chat ID from the CKG database
    if (platform === 'telegram') {
      // Retrieve user profile to get both chat ID and associated agent username
      const userProfile = await getUserProfile(runtime, username);
      
      if (!userProfile) {
        elizaLogger.warn(`No user profile found for user ${username}`);
        return false;
      }
      
      const storedChatId = userProfile.telegramChatId;
      const agentUsername = userProfile.agentUsername;
      
      if (!storedChatId) {
        elizaLogger.warn(`No chat ID found for user ${username}`);
        return false;
      }
      
      try {
        // Get the appropriate Telegram bot token based on the agent username
        const botToken = getTelegramBotToken(runtime, agentUsername);
        
        if (!botToken) {
          elizaLogger.error(`No Telegram bot token configured for agent ${agentUsername}`);
          return false;
        }
        
        // Create a temporary Telegram bot instance with the correct token
        const { Telegraf } = await import('telegraf');
        const tempBot = new Telegraf(botToken);
        
        // Send the message using the temporary bot
        await tempBot.telegram.sendMessage(storedChatId, message);
        elizaLogger.info(`Successfully sent message to ${username} using bot for agent ${agentUsername}`);
        return true;
      } catch (error) {
        elizaLogger.error(`Failed to send Telegram message to ${username}: ${error}`);
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
 * Get the appropriate Telegram bot token based on agent username
 * @param runtime Agent runtime
 * @param agentUsername Agent username associated with the user
 * @returns Telegram bot token
 */
function getTelegramBotToken(runtime: IAgentRuntime, agentUsername?: string): string | undefined {
  // Default to the current runtime's token if no agent username specified
  if (!agentUsername) {
    return runtime.getSetting('TELEGRAM_BOT_TOKEN');
  }
  
  // Get tokens from environment variables based on agent username
  // Format: TELEGRAM_BOT_TOKEN_AGENTNAME (with non-alphanumeric chars removed)
  const safeAgentName = agentUsername.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const tokenEnvKey = `TELEGRAM_BOT_TOKEN_${safeAgentName}`;
  
  // Try to get the specific token for this agent
  const agentSpecificToken = runtime.getSetting(tokenEnvKey);
  
  // Use the specific token if available, otherwise fall back to the default token
  return agentSpecificToken || runtime.getSetting('TELEGRAM_BOT_TOKEN');
}

/**
 * Get the user's profile data
 * @param runtime Agent runtime
 * @param username Username to look up
 * @returns User profile data or null if not found
 */
async function getUserProfile(runtime: IAgentRuntime, username: string): Promise<ProfileData | null> {
  try {
    // Clean the username - ensure no @ prefix for database queries
    const cleanUsername = username.replace(/^@/, '');
    
    const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
    const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');
    
    if (!connectionString || !dbName) {
      elizaLogger.error('Missing MongoDB connection settings');
      return null;
    }
    
    const client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    // For this specific function, we could either:
    // 1. Use MONGODB_DATABASE_COLLECTION if set, or
    // 2. Always use 'telegram' as it's hardcoded in the original code
    // Let's go with option 1 to be consistent with other functions
    const collectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || 'telegram';
    const collection = db.collection(collectionName);
    
    // Look for the user profile
    const profile = await collection.findOne(
      { platform: 'telegram', username: cleanUsername }
    );
    
    await client.close();
    
    // Cast the MongoDB document to ProfileData type
    return profile as unknown as ProfileData;
  } catch (error) {
    elizaLogger.error(`Error retrieving profile for ${username}:`, error);
    return null;
  }
} 