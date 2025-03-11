import { Provider, IAgentRuntime, Memory, State, elizaLogger } from "@elizaos/core";
// @ts-ignore
import { getProfile } from "../utils/profileUtils";
import { MongoClient } from 'mongodb';

/**
 * Helper function to remove embeddings from user profile data
 * @param userData User profile data
 * @returns User profile data without embeddings
 */
function stripEmbeddings(userData: any[]): any[] {
    return userData.map(profile => {
        // Create a safe copy of the profile
        const cleanProfile = { ...profile };
        
        // Remove embedding fields if they exist
        if (cleanProfile.latestProfile?.public?.embedding) {
            delete cleanProfile.latestProfile.public.embedding;
        }
        if (cleanProfile.latestProfile?.private?.embedding) {
            delete cleanProfile.latestProfile.private.embedding;
        }
        
        return cleanProfile;
    });
}

/**
 * Creates an initial minimal profile for a new user
 * @param runtime Agent runtime
 * @param platform Platform name (e.g., telegram)
 * @param username Username
 * @param telegramChatId Telegram chat ID if available
 * @param state Current state
 * @returns Boolean indicating success
 */
async function createInitialUserProfile(
  runtime: IAgentRuntime,
  platform: string,
  username: string,
  telegramChatId?: string,
  state?: State
): Promise<boolean> {
  try {
    // Get agent details from runtime
    const agentId = runtime.agentId;
    
    // Get the bot username from runtime or client
    let agentUsername = runtime.character?.username || runtime.character?.name;
    
    // Try to get the actual bot username from Telegram client if available
    const telegramClient = runtime.clients['telegram'] as any;
    if (telegramClient?.bot?.botInfo?.username) {
      agentUsername = telegramClient.bot.botInfo.username.replace(/^@/, '');
      elizaLogger.info(`Using actual bot username for profile: ${agentUsername}`);
    }
    
    // Get community info - defaults to agent username if not available
    const community = state?.community || agentUsername;
    
    // Create an empty profile with minimal data
    const currentProfileData = {
      public: {
        "@context": {
          "schema": "http://schema.org/",
          "datalatte": "https://datalatte.com/ns/"
        },
        "datalatte:initialProfile": true, // Mark as initial profile
        "datalatte:revisionTimestamp": new Date().toISOString()
      },
      private: {
        "@context": {
          "schema": "http://schema.org/",
          "datalatte": "https://datalatte.com/ns/",
          "foaf": "http://xmlns.com/foaf/0.1/"
        },
        "foaf:account": {
          "@type": "foaf:OnlineAccount",
          "foaf:accountServiceHomepage": platform,
          "foaf:accountName": username
        },
        "datalatte:revisionTimestamp": new Date().toISOString()
      },
      timestamp: new Date()
    };
    
    // Store the profile data using MongoDB
    const client = await new MongoClient(runtime.getSetting('MONGODB_CONNECTION_STRING_CKG')).connect();
    const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
    
    // Check if MONGODB_DATABASE_COLLECTION is set in environment, otherwise use platform
    const collectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || platform;
    const collection = db.collection(collectionName);
    
    // Find existing document for this user
    const existingDoc = await collection.findOne({ platform, username });
    
    // Only create a new profile if none exists
    if (!existingDoc) {
      // Create a new profile document with initial data
      const profileDocument: any = {
        platform,
        username,
        latestProfile: currentProfileData,
        profileVersions: [currentProfileData],
        created: new Date(),
        lastUpdated: new Date(),
        agentId,
        agentUsername,
        community
      };

      // Add telegramChatId if provided
      if (telegramChatId) {
        profileDocument.telegramChatId = telegramChatId;
      }
      
      await collection.insertOne(profileDocument);
      
      elizaLogger.info(`Created initial profile for ${username} on ${platform}`);
      return true;
    }
    
    // Profile already exists
    elizaLogger.info(`Profile already exists for ${username} on ${platform}, skipping creation`);
    return false;
  } catch (error) {
    elizaLogger.error(`Error creating initial profile for ${username} on ${platform}: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    // Ensure the MongoDB client is closed
    try {
      const client = await MongoClient.connect(runtime.getSetting('MONGODB_CONNECTION_STRING_CKG'));
      await client.close();
    } catch (error) {
      // Ignore errors when closing the client
    }
  }
}

//TODO; currently sparql query is only getting latest intent ids, but later should get all unique ids and their latest revision timestamp

// SPARQL query to find structured user data

const userProfileProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {

            // Get username from actorsData if available, otherwise fall back to senderName or userId
            const username = state?.actorsData?.find(actor => actor.id === message.userId)?.username || message.userId;
            
            // Get platform type from client
            const clients = runtime.clients;
            let platform = Object.keys(clients)[0];

            elizaLogger.info("Checking for user profile data:", {
                username,
                platform
            });

            // Get profile using the profileUtils.getProfile function
            let userData = await getProfile(runtime, platform, username);

            // If no data found, create an initial profile
            if (!userData || userData.length === 0) {
                elizaLogger.info(`No profile found for ${username} on ${platform}, creating initial profile`);
                
                // Get Telegram chat ID if available
                let telegramChatId: string | undefined;
                
                // Attempt to get Telegram chat ID from message or state
                if (platform === 'telegram') {
                    const telegramClient = runtime.clients['telegram'] as any;
                    
                    // Try to get from message or content properties
                    const messageAny = message as any;
                    if (messageAny.content?.chatId) {
                        telegramChatId = messageAny.content.chatId;
                    } 
                    // Try to get from Telegram's message manager
                    else if (telegramClient?.messageManager?.getUserChatId) {
                        telegramChatId = telegramClient.messageManager.getUserChatId(username);
                    }
                }
                
                // Create initial profile
                const created = await createInitialUserProfile(runtime, platform, username, telegramChatId, state);
                
                if (created) {
                    // Get the freshly created profile
                    userData = await getProfile(runtime, platform, username);
                } 
                
                // Still no profile data (creation might have failed)
                if (!userData || userData.length === 0) {
                    return `No profile information found yet for @${username} on ${platform}. Converse with the user to get more information to build a better profile.`;
                }
            }

            // Strip embeddings from the profile data before formatting as JSON-LD
            userData = stripEmbeddings(userData);

            // Format the found data as JSON-LD
            const jsonLd = {
                "@context": {
                    "schema": "http://schema.org/",
                    "datalatte": "https://datalatte.com/ns/",
                    "foaf": "http://xmlns.com/foaf/0.1/"
                },
                "@graph": userData.map(item => ({
                    ...item.latestProfile.public,
                    ...item.latestProfile.private
                }))
            };

            return `
Profile history for @${username} collected through ${platform} interactions with DataBarista so far:
\`\`\`json
${JSON.stringify(jsonLd, null, 2)}
\`\`\`
Task: Based on user's recent conversation, engage in a natural conversation to ask follow-up questions to get information that helps finding a better match for the intent user is looking for currently in the conversation.
    `;
    }
};

export { userProfileProvider }; 