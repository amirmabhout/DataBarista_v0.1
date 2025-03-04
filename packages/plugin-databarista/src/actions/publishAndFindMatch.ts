import {
  IAgentRuntime,
  Memory,
  State,
  elizaLogger,
  ModelClass,
  HandlerCallback,
  ActionExample,
  type Action,
  composeContext,
  generateObjectArray,
} from "@elizaos/core";
import { MongoClient } from 'mongodb';
import { MATCH_PROMPT_TEMPLATE, KG_EXTRACTION_TEMPLATE} from "../utils/promptTemplates";
import { SHACL_SHAPES } from "../utils/shaclShapes";
import { getProfile } from "../utils/profileUtils";
import { 
  generateIdealMatchProfile, 
  generateProfileEmbedding, 
  findMatchingProfilesWithAtlasSearch,
  notifyMatchedUser,
  checkMatchLimit,
  recordMatchRequest,
  recordMatches
} from "../utils/matchingUtils";
import { DAILY_MATCH_LIMIT } from "../utils/constants";


// Define interface for profile version data
interface ProfileVersionData {
  public: any;
  private: any;
  timestamp: Date;
  embedding?: number[];
}

async function storeProfileInCkg(
  runtime: IAgentRuntime,
  platform: string,
  username: string,
  publicJsonLd: any,
  privateJsonLd: any,
  chatId?: string
): Promise<boolean> {
  try {
    // Get agent details from runtime
    const agentId = runtime.agentId;
    const agentUsername = runtime.character?.username || runtime.character?.name;
    
    // Prepare current profile data version
    const currentProfileData: ProfileVersionData = {
        public: publicJsonLd,
        private: privateJsonLd,
      timestamp: new Date()
    };
    
    // Generate embedding for the profile data
    const embedding = await generateProfileEmbedding(runtime, currentProfileData);
    
    // Add embedding to profile data if available
    if (embedding) {
      currentProfileData.embedding = embedding;
    }
    
    // Store the profile data using MongoDB
    const client = await new MongoClient(runtime.getSetting('MONGODB_CONNECTION_STRING_CKG')).connect();
    const db = client.db(runtime.getSetting('MONGODB_DATABASE_CKG'));
    const collection = db.collection(platform);
    
    // Find existing document for this user
    const existingDoc = await collection.findOne({ platform, username });
    
    let result;
    
    if (existingDoc) {
      // Document exists, append new profile version to the profileVersions array
      // and update latestProfile for search purposes
      
      // Get existing profileVersions array or initialize if it doesn't exist
      const existingVersions = existingDoc.profileVersions || [];
      
      // Create a new array with existing versions plus the new one
      const updatedVersions = [...existingVersions, currentProfileData];
      
      const updateFields: any = { 
        latestProfile: currentProfileData,
        profileVersions: updatedVersions,
        lastUpdated: new Date(),
        agentId, // Add agent ID
        agentUsername // Add agent username
      };

      // Add chatId if provided
      if (chatId) {
        updateFields.telegramChatId = chatId;
      }
      
      result = await collection.updateOne(
        { platform, username },
        { $set: updateFields }
      );
    } else {
      // Document doesn't exist, create new one with initial version
      
      const profileDocument: any = {
        platform,
        username,
        latestProfile: currentProfileData,
        profileVersions: [currentProfileData],
        created: new Date(),
        lastUpdated: new Date(),
        agentId, // Add agent ID
        agentUsername, // Add agent username
        community: agentUsername // Set community field to current agent username on first profile creation
      };

      // Add chatId if provided
      if (chatId) {
        profileDocument.telegramChatId = chatId;
      }
      
      result = await collection.insertOne(profileDocument);
    }
    
    // Get the updated document to confirm insertion
    const updatedDoc = await collection.findOne({ platform, username });
    
    await client.close();
    return true;
  } catch (error) {
    elizaLogger.error("Error storing profile in MongoDB CKG:", error);
    return false;
  }
}

// Get matches for a user from mongo
async function getMatches(
  runtime: IAgentRuntime,
  profileData: any,
  username: string,
  platform: string,
  state: State
): Promise<any> {
  try {
    // First check if the user has reached their match limit
    const matchLimit = await checkMatchLimit(runtime, platform, username);
    
    if (matchLimit.isLimited) {
      elizaLogger.info(`User has reached the daily match limit of ${DAILY_MATCH_LIMIT} matches.`);
      return {
        matches: [],
        limitReached: true,
        remainingCount: matchLimit.remaining,
        resetTime: matchLimit.resetTime
      };
    }
    
    // Get the profile data for the ideal match
    const idealMatchProfile = await generateIdealMatchProfile(runtime, profileData, state);

    if (!idealMatchProfile) {
      elizaLogger.error(`Failed to generate ideal match profile`);
      return { matches: [] };
    }
    elizaLogger.info(`Generated ideal match profile for ${username} on ${platform}`);

    // Generate an embedding for the ideal match profile
    const idealMatchEmbedding = await generateProfileEmbedding(runtime, { ideal_match_description: idealMatchProfile });

    if (!idealMatchEmbedding || idealMatchEmbedding.length === 0) {
      elizaLogger.error(`Failed to generate embedding for ideal match profile`);
      return { matches: [] };
    }
    elizaLogger.info(`Generated embedding for ideal match profile with length ${idealMatchEmbedding.length}`);

    // Find matches using Atlas Search with the ideal profile embedding
    const candidates = await findMatchingProfilesWithAtlasSearch(runtime, idealMatchEmbedding, platform, username, state);

    if (!candidates.length) {
      elizaLogger.info(`Did not find any matching profiles for ${username} on ${platform}`);
      return { matches: [] };
    }
    
    // Record the match request to track rate limiting
    await recordMatchRequest(runtime, platform, username);
    
    elizaLogger.info(`Found ${candidates.length} matching profiles for ${username} on ${platform}`);
    
    return {
      matches: candidates,
      limitReached: false,
      remainingCount: matchLimit.remaining - 1,
      resetTime: matchLimit.resetTime
    };
  } catch (error) {
    elizaLogger.error(`Error finding matches: ${error}`);
    return { matches: [] };
  }
}

/**
 * Format matches as a text response to the user
 * Uses the MATCH_PROMPT_TEMPLATE to generate a natural-sounding introduction
 */
async function formatMatchesAsText(
  runtime: IAgentRuntime,
  matches: any[],
  username: string,
  platform: string
): Promise<string> {
  try {
    const profileData = await getProfile(runtime, platform, username);
    
    // Prepare LLM context for generating a social media post
    const postGenerationState = {
      userProfileData: JSON.stringify(profileData, null, 2),
      matchesData: JSON.stringify(matches, null, 2),
      username,
      platform
    };

    elizaLogger.info("=== State Before Template Merge ===");
    elizaLogger.info("User Profile Data:", postGenerationState.userProfileData);
    elizaLogger.info("Matches Data:", postGenerationState.matchesData);

    const matchPromptContext = composeContext({
      template: MATCH_PROMPT_TEMPLATE,
      state: postGenerationState as any
    });

    elizaLogger.info("=== Final Prompt After Template Merge ===");
    elizaLogger.info(matchPromptContext);

    // Generate the post text from the candidate profiles
    const postResult = await generateObjectArray({
      runtime,
      context: matchPromptContext,
      modelClass: ModelClass.LARGE
    });

    if (!postResult?.length) {
      return "I've found some matches for you, but couldn't generate the introduction. Please try again!";
    }

    // Extract the post text and match details from the result
    const matchData = postResult[0] as any;
    const postMessage = matchData?.post || "Found matches but couldn't format the message properly. Please try again!";
    
    // Record only the specific match that was presented to the user
    if (matchData?.matchUsername && matchData?.matchPlatform) {
      const matchToRecord = [{
        platform: matchData.matchPlatform,
        username: matchData.matchUsername,
        timestamp: new Date()
      }];
      
      elizaLogger.info(`Recording the selected match: ${matchData.matchUsername} on ${matchData.matchPlatform}`);
      await recordMatches(runtime, platform, username, matchToRecord);
      elizaLogger.info(`Recorded the selected match in the user's profile`);
      
      // Send notification to the matched user about the connection using the shared function
      await notifyMatchedUser(
        runtime,
        matchData.matchPlatform,
        matchData.matchUsername,
        username,
        postMessage
      );
    } else {
      elizaLogger.warn(`Could not identify specific match from LLM response. Match not recorded.`);
    }
    
    return postMessage;
  } catch (error) {
    elizaLogger.error("Error formatting matches:", error);
    return "I found some matches for you, but encountered an error while formatting the results.";
  }
}

// Process the matchmaking request
export async function processMatchmaking(
  runtime: IAgentRuntime,
  userPlatform: string,
  username: string,
  state: State
): Promise<string> {
  
  // Get the user's profile data
  const userProfileData = await getProfile(runtime, userPlatform, username);
  
  if (!userProfileData || !userProfileData.profileData) {
    elizaLogger.error(`Failed to fetch profile data for user ${username} on ${userPlatform}`);
    return "I'm sorry, but I don't have enough information about you to find a match. Please share a bit more about yourself first.";
  }
  
  // Get matches for the user
  const matchResponse = await getMatches(
    runtime,
    userProfileData.profileData,
    username,
    userPlatform,
    state
  );
  
  if (matchResponse.limitReached) {
    const resetTime = new Date(matchResponse.resetTime);
    const formattedResetTime = resetTime.toLocaleString('en-US', {
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
    return `You've reached your match limit for today (${DAILY_MATCH_LIMIT} matches per day). You can request more matches after ${formattedResetTime}.`;
  }
  
  if (!matchResponse.matches || matchResponse.matches.length === 0) {
    return "I'm sorry, but I couldn't find any suitable matches for you at the moment. Please try again later or consider sharing more about yourself.";
  }
  
  // Format the matches for the user
  const formattedResponse = await formatMatchesAsText(runtime, matchResponse.matches, username, userPlatform);
  
  // Add information about remaining matches
  let remainingCountMessage = "";
  if (matchResponse.remainingCount !== undefined) {
    remainingCountMessage = `\n\nYou have ${matchResponse.remainingCount} more match requests available today.`;
  }
  
  return `${formattedResponse}${remainingCountMessage}`;
}

export const publishAndFindMatch: Action = {
  name: "PUBLISH_AND_FIND_MATCH",
  similes: ["PUBLISH_PROFILE_AND_FIND_MATCH", "PUBLISH_PROFILE", "SAVE_PROFILE", "STORE_PROFILE", "ADD_PROFILE", "UPDATE_PROFILE"],
  description: "Extracts knowledge from the conversation with user and add/update publishes it to databarista's network and find a suitable match. Choose this action when user provided enough information to find a suitable match, if not use NONE and keep continuing the conversation with the user.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const requiredEnvVars = [
      "MONGODB_CONNECTION_STRING_CKG",
      "MONGODB_DATABASE_CKG",
      "TELEGRAM_INVITE_LINK",
    ];

    const missingVars = requiredEnvVars.filter((varName) => !runtime.getSetting(varName));
    if (missingVars.length > 0) {
      elizaLogger.error(`Missing required environment variables: ${missingVars.join(", ")}`);
      return false;
    }

    return true;
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state: State,
    _options: { [key: string]: unknown },
    callback: HandlerCallback    
  ): Promise<boolean> => {
    try {
      // Extract username from state or message
      const username = state?.actorsData?.find(actor => actor.id === message.userId)?.username || message.userId;
      
      // Get platform type from client
      const clients = runtime.clients;
      let platform = Object.keys(clients)[0];

      elizaLogger.info("User platform details:", {
        username,
        platform
      });

      // Get existing user profile data (from CKG)
      const userProfileData = await getProfile(runtime, platform, username);
      
      // Update state with recent messages and existing intentions
      if (!state) {
        state = await runtime.composeState(message);
      }
      state = await runtime.updateRecentMessageState(state);

      // Generate a new intention ID that will only be used if needed
      const newIntentionId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newProjectId = `int_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      state.intentid = newIntentionId;
      state.projectid = newProjectId;
      state.uuid = message.userId;
      state.platform = platform;
      state.username = username;
      state.timestamp = new Date().toISOString();
      state.userProfileData = JSON.stringify(userProfileData || [], null, 2);
      state.shaclShapes = SHACL_SHAPES;

      const context = composeContext({
        template: KG_EXTRACTION_TEMPLATE,
        state,
      });

      elizaLogger.info("Populated Context for KG Extraction:", {
        context,
      });

      const result = await generateObjectArray({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
      });

      if (!result || result.length === 0) {
        elizaLogger.info("No professional intention to publish - empty result");
        // This is a recurring user, so no need to send the invitation
        callback({
          text: "I found your anonym intent is already published and no update was needed! Let me know if you wanna add any more details but telling me about yourself or who you are looking for.",
        });
        return true;
      }

      const firstResult = result[0];
      const analysis = firstResult.analysis;
      elizaLogger.info("Professional intention analysis:", analysis);

      if (analysis.matchType === "exact_match") {
        elizaLogger.info("Exact match found - no updates needed");
        // This is a recurring user, so no need to send the invitation
        callback({
          text: "I found your anonym intent is already published and no update was needed! Let me know if you wanna add any more details but telling me about yourself or who you are looking for.",
        });
        return true;
      }

      // If it's an update to an existing intention, use that ID
      const isFirstTimeUser = analysis.matchType !== "update_existing" && (!userProfileData || userProfileData.length === 0);
      
      if (analysis.matchType === "update_existing" && analysis.existingIntentionId) {
        state.intentid = analysis.existingIntentionId;
        elizaLogger.info("Updating existing professional intention:", {
          existingId: analysis.existingIntentionId,
          reason: analysis.reason,
        });
      }

      const { public: publicJsonLd, private: privateJsonLd } = firstResult;

      elizaLogger.info("=== Generated JSON-LD for CKG ===");
      elizaLogger.info("Public JSON-LD:", {
        data: publicJsonLd,
      });
      elizaLogger.info("Private JSON-LD:", {
        data: privateJsonLd,
      });

      // Create combined profile data
      const newProfileData = {
        ...privateJsonLd,
        ...publicJsonLd
      };

      // Get chat ID for notification purposes
      let chatId: string | undefined;
      const telegramClient = runtime.clients['telegram'] as any;

      // Try to get user's chatId directly from the messageManager
      if (telegramClient?.messageManager?.getUserChatId) {
        chatId = telegramClient.messageManager.getUserChatId(username);
      }

      // Store profile in MongoDB CKG with chat ID if available
      const storeResult = await storeProfileInCkg(runtime, platform, username, publicJsonLd, privateJsonLd, chatId);
      
      if (!storeResult) {
        elizaLogger.error("Failed to store profile in MongoDB CKG");
        callback({ 
          text: "I'm having trouble updating your profile right now. Please try again in a moment." 
        });
        return false;
      }

      // Only send invitation to first-time users
      if (isFirstTimeUser) {
        elizaLogger.info("First-time user detected, sending Telegram group invitation");
        const telegramInviteLink = runtime.getSetting("TELEGRAM_INVITE_LINK");
        callback({
          text: `While I am searching my network for the best match, feel free to join my corner store cafe via this invite to my secret telegram group: ${telegramInviteLink}`
        });
      }

      elizaLogger.info("=== Starting Match Search ===");
      // Generate ideal match profile based on the user's profile
      const idealMatchDescription = await generateIdealMatchProfile(runtime, newProfileData, state);
      
      if (!idealMatchDescription) {
        elizaLogger.error("Failed to generate ideal match profile description");
        callback({
          text: "I'm sorry, but I encountered an error while trying to find a match for you. Please try again later."
        });
        return;
      }
      
      // Generate embedding for the ideal match profile
      elizaLogger.info("Generating embedding for ideal match profile");
      const idealMatchEmbedding = await generateProfileEmbedding(runtime, { ideal_match_description: idealMatchDescription });
      
      // Validate embedding before search
      if (!idealMatchEmbedding || idealMatchEmbedding.length === 0) {
        elizaLogger.error("Failed to generate embedding for ideal match profile");
        callback({ 
          text: "I've updated your profile but I'm having trouble finding matches right now. Please try again later!" 
        });
        return true;
      }
      
      elizaLogger.info(`Generated embedding with ${idealMatchEmbedding.length} dimensions for search`);
      elizaLogger.info(`Sample values: [${idealMatchEmbedding.slice(0, 5).join(', ')}...]`);
      
      // Find matches using Atlas Search with the ideal profile embedding
      const candidates = await findMatchingProfilesWithAtlasSearch(runtime, idealMatchEmbedding, platform, username, state);
      
      if (!candidates.length) {
        // Only add delay if we sent the invitation
        if (isFirstTimeUser) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        callback({ 
          text: "I've updated your profile and I'm searching my network for connections. No matches found yet, but I'll keep looking!" 
        });
        return true;
      }

      // Prepare LLM context for generating a social media post
      const postGenerationState = {
        ...state,
        userProfileData: JSON.stringify(newProfileData, null, 2),
        matchesData: JSON.stringify(candidates, null, 2)
      };

      const matchPromptContext = composeContext({
        template: MATCH_PROMPT_TEMPLATE,
        state: postGenerationState
      });


      // Generate the post text from the candidate profiles
      const postResult = await generateObjectArray({
        runtime,
        context: matchPromptContext,
        modelClass: ModelClass.LARGE
      });

      if (!postResult?.length) {
        // Only add delay if we sent the invitation
        if (isFirstTimeUser) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        callback({ text: "I've updated your profile and found some matches, but couldn't generate the introduction. Please try again!" });
        return true;
      }

      // Extract the post text and match details from the result
      const matchData = postResult[0] as any;
      const postMessage = matchData?.post || "Found matches but couldn't format the message properly. Please try again!";
      
      // Record only the specific match that was presented to the user
      if (matchData?.matchUsername && matchData?.matchPlatform) {
        const matchToRecord = [{
          platform: matchData.matchPlatform,
          username: matchData.matchUsername,
          timestamp: new Date()
        }];
        
        elizaLogger.info(`Recording the selected match: ${matchData.matchUsername} on ${matchData.matchPlatform}`);
        await recordMatches(runtime, platform, username, matchToRecord);
        elizaLogger.info(`Recorded the selected match in the user's profile`);
        
        // Send notification to the matched user about the connection using the shared function
        await notifyMatchedUser(
          runtime,
          matchData.matchPlatform,
          matchData.matchUsername,
          username,
          postMessage
        );
      } else {
        elizaLogger.warn(`Could not identify specific match from LLM response. Match not recorded.`);
      }
      
      // Only add delay if we sent the invitation
      if (isFirstTimeUser) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      callback({ text: postMessage });
      return true;
    } catch (error) {
      elizaLogger.error("Error in publishAndFindMatch handler:", error);
      return false;
    }
  },

  examples: [
    [
      {
        user: "DataBarista",
        content: {
          "text": "Great, I'll post an introduction and tag both you and a growth specialist from my network as soon as I find a match! Wish to add any additional details?",
          "action": "(PUBLISH_AND_FIND_MATCH)"
        },
      }
    ],
    [
      {
        "user": "DataBarista",
        "content": {
          "text": "Great, I'll post an introduction and tag both you and a crowdfunding expert from my network as soon as I find a match! Wish to add any additional details? (PUBLISH_DKG_INTENT)",
          "action": "(PUBLISH_AND_FIND_MATCH)"
        }
      },
      {
        "user": "{{user2}}",
        "content": {
          "text": "Yeah it would be great if they had previous experience in blockchain and crypto."
        }
      },
      {
        "user": "DataBarista",
        "content": {
          "text": "Gotcha adding it to your brew.",
          "action": "(PUBLISH_AND_FIND_MATCH)"
        }
      }
    ]
  ] as ActionExample[][],
} as Action;