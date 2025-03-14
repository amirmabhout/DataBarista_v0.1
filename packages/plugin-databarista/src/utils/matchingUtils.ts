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
import { COMBINED_PROFILE_TEMPLATE } from "./promptTemplates";
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
 * This is a compatibility function that uses the new generateCombinedProfile
 * and returns just the ideal section
 * 
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
    elizaLogger.debug('Generating ideal match profile using combined profile generator');
    
    // Use the new combined profile generator
    const combinedProfile = await generateCombinedProfile(runtime, userProfileData, state);
    
    if (!combinedProfile) {
      elizaLogger.error("Failed to generate combined profile for ideal match");
      return null;
    }
    
    // Return just the ideal section
    return combinedProfile.ideal;
  } catch (error) {
    elizaLogger.error(`Error generating ideal match profile: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Generate embeddings for profile data using ElizaOS Core's embedding service
 * This is a compatibility function that supports the old format for backward compatibility
 * It will attempt to use the new generateCombinedProfileEmbeddings when possible
 * 
 * @param runtime Agent runtime for embedding service 
 * @param profileData Profile data to generate embeddings for (either a complex object or an object with ideal_match_description)
 * @returns Embedding vector as number array
 */
export async function generateProfileEmbedding(
  runtime: IAgentRuntime,
  profileData: any
): Promise<number[] | null> {
  try {
    // Check if we have a simple ideal match description
    if (profileData.ideal_match_description) {
      // If we have a direct description text, use it directly
      return await embed(runtime, profileData.ideal_match_description);
    }
    
    // Check if we have a text-based profile structure
    if (profileData.private && profileData.public && profileData.ideal &&
        typeof profileData.private === 'string' && 
        typeof profileData.public === 'string' && 
        typeof profileData.ideal === 'string') {
      
      // Use the new combined profile embeddings function
      const embeddings = await generateCombinedProfileEmbeddings(runtime, profileData);
      if (embeddings) {
        // Return the ideal embedding since that's what the old function would return
        return embeddings.ideal_embedding;
      }
      return null;
    }
    
    // Handle legacy format - extract text from the JSON-LD structure
    let textToEmbed = '';
    
    // Extract from complex profile structure
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
    
    if (!textToEmbed.trim()) {
      elizaLogger.warn("No meaningful text found to embed for profile");
      return null;
    }
    
    // Use ElizaOS Core embedding service
    return await embed(runtime, textToEmbed);
  } catch (error) {
    elizaLogger.error("Error generating profile embedding:", error);
    return null;
  }
}

/**
 * Find matching profiles using vector similarity search
 * 
 * @param runtime Agent runtime
 * @param idealProfileEmbedding Embedding vector for ideal match profile
 * @param platform Platform to search in (e.g., "telegram")
 * @param username Username to exclude from results
 * @param state Current state or bot username
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
    // Get MongoDB connection info
    const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
    const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');
    const collectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || platform;
    
    // Validate connection info
    if (!connectionString || !dbName) {
      elizaLogger.error('Missing MongoDB connection settings');
      return [];
    }
    
    const client = await MongoClient.connect(connectionString);
    const db = client.db(dbName);
    const collection = db.collection(collectionName);
    
    // Get bot username to filter users from the same community
    const myBotUsername = typeof state === 'string' 
      ? state 
      : (state?.agentUsername || runtime.character?.username);
    
    // Query exclude list (excludes self and recently matched profiles)
    const excludeList = [
      { platform, username }, // Exclude self
    ];
    
    // Add the user's match history to the exclude list if available
    try {
      const userDoc = await collection.findOne({ platform, username });
      if (userDoc?.matchHistory) {
        // Add matches from the last 30 days to the exclude list
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentMatches = userDoc.matchHistory.filter((match: any) => 
          new Date(match.timestamp) > thirtyDaysAgo
        );
        
        excludeList.push(...recentMatches);
      }
    } catch (error) {
      elizaLogger.warn("Error fetching match history:", error);
      // Continue with search even if we can't get match history
    }
    
    // Get vector index name from environment
    const vectorIndexName = runtime.getSetting('MONGODB_VECTOR_INDEX') || 'text_embedding_index';
    elizaLogger.info(`Using vector index name: ${vectorIndexName}`);
    
    // Define the search pipeline
    const pipeline = [
      {
        // Search against embedding (renamed from profile_embedding) in the latestProfile
        $vectorSearch: {
          index: vectorIndexName,
          path: "latestProfile.embedding",
          queryVector: idealProfileEmbedding,
          numCandidates: 100,
          limit: 10
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
          "latestProfile.private": 1,
          "latestProfile.public": 1,
          "latestProfile.ideal": 1,
          "latestProfile.timestamp": 1,
          timestamp: 1,
          lastUpdated: 1,
          telegramChatId: 1,
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
      score: match.score,
      telegramChatId: match.telegramChatId
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
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // First check if there's already a match request for today
    const userDoc = await collection.findOne(
      { 
        platform, 
        username,
        matchRequests: { 
          $elemMatch: { 
            timestamp: { 
              $gte: today 
            } 
          }
        }
      }
    );
    
    let result;
    if (userDoc) {
      // Update existing request count for today using a type-safe approach
      const updateDoc: Record<string, any> = {
        $inc: {}
      };
      updateDoc.$inc["matchRequests.$.count"] = 1;
      
      result = await collection.updateOne(
        { 
          platform, 
          username,
          "matchRequests.timestamp": { $gte: today }
        },
        updateDoc
      );
    } else {
      // Add a new request record using a type-safe approach
      const updateDoc: Record<string, any> = {
        $push: {}
      };
      updateDoc.$push.matchRequests = {
        timestamp: now,
        count: 1
      };
      
      result = await collection.updateOne(
        { platform, username },
        updateDoc,
        { upsert: true }
      );
    }
    
    await client.close();
    
    return result.acknowledged;
  } catch (error) {
    elizaLogger.error('Error recording match request:', error);
    return false;
  }
}

/**
 * Store matches in user's profile to avoid repetition
 * Also records bidirectional matches - both user->match and match->user
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
    
    try {
      // Create an array of operations to perform
      const operations = [];
      const now = new Date();
      
      // 1. Format the matches with timestamps for the current user
      const matchesWithTimestamp = matches.map(match => ({
        platform: match.platform,
        username: match.username,
        timestamp: now
      }));
      
      // 2. Add matches to current user's match history
      const userCollectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || userPlatform;
      const userCollection = db.collection(userCollectionName);
      
      const userUpdate: Record<string, any> = {
        $push: {}
      };
      userUpdate.$push.matchHistory = { $each: matchesWithTimestamp };
      
      operations.push(
        userCollection.updateOne(
          { platform: userPlatform, username: userUsername },
          userUpdate,
          { upsert: true }
        )
      );
      
      // 3. Add current user to each matched user's history
      for (const match of matches) {
        // The current user's profile data to add to the matched user's history
        const currentUserMatchData = {
          platform: userPlatform,
          username: userUsername,
          timestamp: now
        };
        
        // Get the appropriate collection for the matched user (could be on a different platform)
        const matchedUserCollectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || match.platform;
        const matchedUserCollection = db.collection(matchedUserCollectionName);
        
        // Prepare update for matched user
        const matchedUserUpdate: Record<string, any> = {
          $push: {}
        };
        matchedUserUpdate.$push.matchHistory = { $each: [currentUserMatchData] };
        
        operations.push(
          matchedUserCollection.updateOne(
            { platform: match.platform, username: match.username },
            matchedUserUpdate,
            { upsert: true }
          )
        );
        
        elizaLogger.info(`Recording bidirectional match: ${userUsername} <-> ${match.username}`);
      }
      
      // Execute all operations
      const results = await Promise.all(operations);
      
      // Check if all operations were successful
      const allSuccessful = results.every(result => result.acknowledged);
      
      elizaLogger.info(
        `Recorded ${matches.length} bidirectional matches for ${userUsername} on ${userPlatform}: ${allSuccessful ? 'success' : 'partial failure'}`
      );
      
      return allSuccessful;
    } finally {
      // Ensure connection is closed even if operation fails
      await client.close();
    }
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

/**
 * Generate combined profile content using the new text-based approach
 * Creates private, public, and ideal match sections in one call
 * 
 * @param runtime Agent runtime
 * @param userProfileData Existing user profile data (can be empty/null for new users)
 * @param state Current state with conversation context
 * @returns Object with private, public, and ideal text sections, or null if generation fails
 */
export async function generateCombinedProfile(
  runtime: IAgentRuntime,
  userProfileData: any,
  state?: State
): Promise<{
  private: string;
  public: string;
  ideal: string;
  analysis: { 
    matchType: 'exact_match' | 'update_existing' | 'new_information';
    reason: string; 
  };
} | null> {
  try {
    elizaLogger.debug('Generating combined profile with all three components');
    
    // Update state with recent messages if not present
    if (state && !state.recentMessages) {
      state = await runtime.updateRecentMessageState(state);
    }

    // Prepare context
    const contextData = {
      shaclShapes: SHACL_SHAPES,
      userProfileData: JSON.stringify(userProfileData || {}, null, 2),
      username: state?.username || '',
      platform: state?.platform || '',
      recentMessages: state?.recentMessages || []
    };
    
    // Log minimal info about profile generation input
    elizaLogger.info(`Generating profile for ${contextData.username} on ${contextData.platform}`);

    const context = composeContext({
      template: COMBINED_PROFILE_TEMPLATE,
      state: contextData as any
    });
    
    // Log raw prompt content
    elizaLogger.info(`RAW_PROFILE_PROMPT: ${context}`);

    const combinedProfileResult = await generateObjectArray({
      runtime,
      context,
      modelClass: ModelClass.LARGE
    });
    
    // Log raw LLM response
    elizaLogger.info(`RAW_PROFILE_RESPONSE: ${JSON.stringify(combinedProfileResult)}`);

    if (!combinedProfileResult?.length) {
      elizaLogger.error("Failed to generate combined profile: empty result");
      return null;
    }

    // Extract the sections from the result
    const result = combinedProfileResult[0];
    
    // Log minimal info about profile generation result
    elizaLogger.info(`Profile generated for ${contextData.username} with match type: ${result.analysis?.matchType || 'unknown'}`);
    
    if (!result.private || !result.public || !result.ideal || !result.analysis) {
      elizaLogger.error("Invalid combined profile format: missing required sections", result);
      return null;
    }
    
    return {
      private: result.private,
      public: result.public,
      ideal: result.ideal,
      analysis: result.analysis
    };
  } catch (error) {
    elizaLogger.error(`Error generating combined profile: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

/**
 * Generate embeddings from the new text-based profile structure
 * Creates two embeddings: one for profile (private+public) and one for ideal match
 * 
 * @param runtime Agent runtime for embedding service
 * @param profileData Object containing private, public, and ideal text sections
 * @returns Object containing profile and ideal match embeddings, or null if generation fails
 */
export async function generateCombinedProfileEmbeddings(
  runtime: IAgentRuntime,
  profileData: {
    private: string;
    public: string;
    ideal: string;
  }
): Promise<{
  embedding: number[];
  ideal_embedding: number[];
} | null> {
  try {
    // Combine private and public sections for the profile embedding
    const profileText = `${profileData.private} ${profileData.public}`;
    
    // Generate embedding for the combined profile text
    const profileEmbedding = await embed(runtime, profileText);
    
    // Generate embedding for the ideal match text
    const idealEmbedding = await embed(runtime, profileData.ideal);
    
    if (!profileEmbedding || profileEmbedding.length === 0 || 
        !idealEmbedding || idealEmbedding.length === 0) {
      elizaLogger.warn("Failed to generate one or both embeddings for combined profile");
      return null;
    }
    
    return {
      embedding: profileEmbedding,
      ideal_embedding: idealEmbedding
    };
  } catch (error) {
    elizaLogger.error("Error generating combined profile embeddings:", error);
    return null;
  }
} 