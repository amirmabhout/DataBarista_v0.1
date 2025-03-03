import {
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
    ModelClass,
    ActionExample,
    type Action,
    composeContext,
    generateObjectArray,
    embed
  } from "@elizaos/core";
import { MongoClient } from 'mongodb';
import { MATCH_PROMPT_TEMPLATE, IDEAL_MATCH_TEMPLATE } from "../utils/promptTemplates";
  import { SHACL_SHAPES } from "../utils/shaclShapes";
import { mongoProfileProvider } from "../utils/mongoProfileProvider";

// This function is from publishAndFindMatch.ts
async function getOrFetchUserProfile(
  runtime: IAgentRuntime,
  platform: string,
  username: string,
  forceRefresh: boolean = false
): Promise<any> {
  // Use the mongoProfileProvider to get the profile data
  const profileData = await mongoProfileProvider.getProfile(runtime, platform, username, forceRefresh);
  return profileData;
}

// This function is adapted from publishAndFindMatch.ts
async function generateIdealMatchProfile(
    runtime: IAgentRuntime,
    userProfileData: any,
    platform: string,
    username: string,
    state?: State
  ): Promise<string> {
  elizaLogger.info("=== Starting Ideal Match Profile Generation ===");
    elizaLogger.info("Input Parameters:");
    elizaLogger.info("User Profile Data:", JSON.stringify(userProfileData, null, 2));
    elizaLogger.info("Platform:", platform);
    elizaLogger.info("Username:", username);

    // Update state with recent messages if not present
    if (state && !state.recentMessages) {
      state = await runtime.updateRecentMessageState(state);
    }

  // Clean user profile data before passing to template - no need to strip embeddings
  // as they are already excluded in the MongoDB projection
  const cleanUserProfileData = userProfileData;

    const context = composeContext({
    template: IDEAL_MATCH_TEMPLATE,
      state: {
        shaclShapes: SHACL_SHAPES,
      userProfileData: JSON.stringify(cleanUserProfileData, null, 2),
        platform,
        username,
        recentMessages: state?.recentMessages || []
      } as any
    });

  const idealMatchResult = await generateObjectArray({
      runtime,
      context,
      modelClass: ModelClass.LARGE
    });

  if (!idealMatchResult?.length) {
    throw new Error("Failed to generate ideal match profile");
    }

  elizaLogger.info("=== Ideal Match Profile Generation Result ===");
  elizaLogger.info("Raw Result:", JSON.stringify(idealMatchResult, null, 2));
    elizaLogger.info("================================");

  // Extract the ideal match description text
  const idealMatchDescription = idealMatchResult[0].ideal_match_description;
  
  if (!idealMatchDescription) {
    throw new Error("Invalid ideal match description format");
  }
  
  elizaLogger.info("Generated ideal match description:", idealMatchDescription.substring(0, 200) + "...");
  
  return idealMatchDescription;
}

/**
 * Generate embeddings for profile data using ElizaOS Core's embedding service
 * @param runtime Agent runtime for embedding service 
 * @param profileData Profile data to generate embeddings for (either a complex object or an object with ideal_match_description)
 * @returns Embedding vector as number array
 */
async function generateProfileEmbedding(
    runtime: IAgentRuntime,
  profileData: any
): Promise<number[] | null> {
  try {
    let textToEmbed = '';
    
    // Check if we have a simple ideal match description
    if (profileData.ideal_match_description) {
      // If we have a direct description text, use it directly
      textToEmbed = profileData.ideal_match_description;
      elizaLogger.info("Using ideal match description for embedding generation");
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
    
    elizaLogger.info("Generated text for embedding:", textToEmbed.substring(0, 100) + "...");
    
    // Use ElizaOS Core embedding service
    elizaLogger.info("Calling embed function to generate embedding");
    const embedding = await embed(runtime, textToEmbed);
    
    if (embedding && embedding.length > 0) {
      elizaLogger.info(`Generated embedding vector with ${embedding.length} dimensions`);
      // Log the first few values to help with debugging
      elizaLogger.debug(`Embedding sample values: [${embedding.slice(0, 5).join(', ')}...]`);
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

// This function is from publishAndFindMatch.ts
async function findMatchingProfilesWithAtlasSearch(
  runtime: IAgentRuntime,
  idealProfileEmbedding: number[],
    username: string,
  platform: string
  ): Promise<any[]> {
  try {
    elizaLogger.info(`Embedding dimensions: ${idealProfileEmbedding.length}`);
    
    const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
    const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');
    
    if (!connectionString || !dbName) {
      elizaLogger.error('Missing MongoDB connection settings');
      return [];
    }
    
    const client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    const collection = db.collection('profiles');
    
    // Get the platform and username to exclude (usually the agent itself)
    const platformToExclude = platform || Object.keys(runtime.clients)[0] || 'telegram';
    const usernameToExclude = username || runtime.character?.name || 'databarista';
    
    elizaLogger.info(`Excluding user's own profile: ${usernameToExclude} on ${platformToExclude}`);
    
    // Get the user's match history to avoid showing the same profiles again
    const matchHistory = await mongoProfileProvider.getMatchHistory(
      runtime, 
      platformToExclude, 
      usernameToExclude
    );
    
    // Create a list of profile IDs to exclude (user's profile + previously matched profiles)
    const excludeList = matchHistory.map(match => ({
      platform: match.platform,
      username: match.username
    }));
    
    elizaLogger.info(`Found ${matchHistory.length} previous matches to exclude`);
    
    // Add the user's own profile to the exclude list
    excludeList.push({
      platform: platformToExclude,
      username: usernameToExclude
    });
    
    // Use Atlas Vector Search to find the top matches
    const pipeline = [
      {
        $vectorSearch: {
          index: "vector_index",
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
    
    elizaLogger.info("=== Vector Search Pipeline ===");
    elizaLogger.info(JSON.stringify(pipeline, null, 2));
    
    const matches = await collection.aggregate(pipeline).toArray();
    elizaLogger.info(`Found ${matches.length} potential matches using Vector Search`);
    
    // Additional safety check to filter out the user's own profile and previously matched profiles
    const filteredMatches = matches.filter(match => {
      // Check if this match is the user's own profile
      if (match.platform === platformToExclude && match.username === usernameToExclude) {
        return false;
      }
      
      // Check if this match is in the user's match history
      return !excludeList.some(exclude => 
        exclude.platform === match.platform && exclude.username === match.username
      );
    });
    
    if (filteredMatches.length < matches.length) {
      elizaLogger.info(`Filtered out ${matches.length - filteredMatches.length} matches that were excluded`);
    }
    
    // Format the results to match the expected structure
    const result = filteredMatches.map(match => ({
      platform: match.platform,
      username: match.username,
      profileData: match.latestProfile,
      timestamp: match.timestamp || match.lastUpdated || new Date(),
      score: match.score
    }));
    
    await client.close();
    elizaLogger.info('MongoDB connection closed after search');
    
    return result;
    } catch (error) {
    elizaLogger.error("=== Search Error ===");
    elizaLogger.error("Atlas search failed:", error);
    elizaLogger.error("=====================");
    // Just return empty results instead of falling back to text search
      return [];
    }
  }
  
export const serendipityAction: Action = {
  id: 'SERENDIPITY_ACTION',
    name: "SERENDIPITY",
    similes: ["FIND_MATCHES", "DISCOVER_CONNECTIONS"],
    description: "Finds most compatible matches from the databarista's network and introduces them together. Choose this action when user provided enough information to find a suitable match, if not use NONE and keep continuing the conversation with the user. This action is used only after (PUBLISH_INTENT_DKG) action is chosen atleast once in history of convo with user.",
  
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const requiredVars = ["MONGODB_CONNECTION_STRING_CKG", "MONGODB_DATABASE_CKG"];
      return requiredVars.every(v => runtime.getSetting(v));
    },
  
  handler: async (runtime: IAgentRuntime, message: any, state?: any, _conversation?: any, callback?: any): Promise<boolean> => {
    try {
      if (!callback) {
        // If we don't have a callback function to send responses with, we can't proceed
        elizaLogger.error("No callback function provided");
        return false;
      }

      let activeState = state || {};
  
        // Extract username from state or message
      const username = activeState?.actorsData?.find((actor: any) => actor.id === message.userId)?.username || message.userId;
        
        // Get platform type from client
        const clients = runtime.clients;
        let platform = Object.keys(clients)[0];

        elizaLogger.info("=== Serendipity Action Started ===");
        elizaLogger.info("User Context:", { username, platform });
  
      // First check if the user has reached their match limit
      const matchLimit = await mongoProfileProvider.checkMatchLimit(runtime, platform, username);
      
      if (matchLimit.isLimited) {
        elizaLogger.info(`User has reached the daily match limit of 5 matches.`);
        
        const resetTime = new Date(matchLimit.resetTime || new Date());
        const formattedResetTime = resetTime.toLocaleString('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        });
        
        callback({ 
          text: `You've reached your match limit for today (5 matches per day). You can request more matches after ${formattedResetTime}.`
        });
        return true;
      }

      // Get user profile using MongoDB
      let profileData = await getOrFetchUserProfile(runtime, platform, username);

      if (!profileData || profileData.length === 0) {
        callback({ text: "I don't have enough information about your profile yet. Let's talk a bit more so I can understand what you're looking for." });
            return false;
          }

      const rawProfile = profileData[0];

      if (!activeState.bio) {
        activeState = await runtime.composeState(message);
      }
      activeState = await runtime.updateRecentMessageState(activeState);
      activeState.username = username;
      activeState.platform = platform;

      // Generate ideal match profile based on the user's profile
      elizaLogger.info("=== Starting Match Search ===");
      const idealMatchDescription = await generateIdealMatchProfile(runtime, rawProfile, platform, username, activeState);
      
      // Generate embedding for the ideal match profile
      elizaLogger.info("Generating embedding for ideal match profile");
      const idealMatchEmbedding = await generateProfileEmbedding(runtime, { ideal_match_description: idealMatchDescription });
      
      // Validate embedding before search
      if (!idealMatchEmbedding || idealMatchEmbedding.length === 0) {
        elizaLogger.error("Failed to generate embedding for ideal match profile");
        callback({ 
          text: "I'm having trouble finding matches right now. Please try again later!" 
        });
        return true;
      }
      
      elizaLogger.info(`Generated embedding with ${idealMatchEmbedding.length} dimensions for search`);
      elizaLogger.info(`Sample values: [${idealMatchEmbedding.slice(0, 5).join(', ')}...]`);
      
      // Find matches using Atlas Search with the ideal profile embedding
      const candidates = await findMatchingProfilesWithAtlasSearch(runtime, idealMatchEmbedding, username, platform);
      
        if (!candidates.length) {
          callback({ text: "No matches found yet. I'll keep searching!" });
          return true;
        }
      
      // Record the match request to track rate limiting
      await mongoProfileProvider.recordMatchRequest(runtime, platform, username);
  
        // Prepare LLM context for generating a social media post
      // No need to strip embeddings as they are excluded in the MongoDB query
        const postGenerationState = {
        ...activeState,
        userProfileData: JSON.stringify(rawProfile, null, 2),
          matchesData: JSON.stringify(candidates, null, 2)
        };
  
        elizaLogger.info("=== State Before Template Merge ===");
        elizaLogger.info("User Profile Data:", postGenerationState.userProfileData);
        elizaLogger.info("Matches Data:", postGenerationState.matchesData);
        elizaLogger.info("=================================");
  
        const context = composeContext({
          template: MATCH_PROMPT_TEMPLATE,
          state: postGenerationState
        });
  
        elizaLogger.info("=== Final Prompt After Template Merge ===");
        elizaLogger.info(context);
        elizaLogger.info("=======================================");
  
        // Generate the post text from the candidate profiles
        const postResult = await generateObjectArray({
          runtime,
          context,
          modelClass: ModelClass.LARGE
        });
  
        if (!postResult?.length) {
          callback({ text: "Found matches but couldn't generate the post. Please try again later!" });
          return true;
        }
  
        // Extract the post text from the result array
        const postMessage = postResult[0]?.post || "Found matches but couldn't format the message properly. Please try again!";
  
      // Record only the specific match that was presented to the user
      const selectedMatch = postResult[0];
      if (selectedMatch?.matchUsername && selectedMatch?.matchPlatform) {
        const matchToRecord = [{
          platform: selectedMatch.matchPlatform,
          username: selectedMatch.matchUsername,
          timestamp: new Date()
        }];
        
        elizaLogger.info(`Recording the selected match: ${selectedMatch.matchUsername} on ${selectedMatch.matchPlatform}`);
        await mongoProfileProvider.recordMatches(runtime, platform, username, matchToRecord);
        elizaLogger.info(`Recorded the selected match in the user's profile`);
        
        // Send notification to the matched user about the connection
        try {
          // Create a personalized message for the matched user
          const matchNotificationMessage = `
Hi @${selectedMatch.matchUsername}! 

I just connected you with @${username} who was looking for someone with your expertise. They'll probably reach out to you soon.

Here's what I told them about you:
----------
${postMessage}
----------

Good luck with the connection!
`;
          
          // Send the notification - pass the callback function
          const notificationSent = await mongoProfileProvider.sendNotification(
            runtime,
            selectedMatch.matchPlatform,
            selectedMatch.matchUsername,
            matchNotificationMessage,
            callback // Pass the callback function for direct messaging
          );
          
          if (notificationSent) {
            elizaLogger.info(`Successfully notified ${selectedMatch.matchUsername} about the match with ${username}`);
          } else {
            elizaLogger.warn(`Failed to notify ${selectedMatch.matchUsername} about the match with ${username}`);
          }
        } catch (error) {
          elizaLogger.error(`Error notifying matched user: ${error}`);
          // Continue even if notification fails
        }
      } else {
        elizaLogger.warn(`Could not identify specific match from LLM response. Match not recorded.`);
      }
      
      // Add information about remaining matches
      let remainingCountMessage = "";
      if (matchLimit.remaining !== undefined) {
        const remaining = matchLimit.remaining - 1;
        remainingCountMessage = `\n\nYou have ${remaining} more match requests available today.`;
      }

      callback({ text: `${postMessage}${remainingCountMessage}` });
        return true;
  
      } catch (error) {
        elizaLogger.error("Serendipity error", error);
        callback({ text: "Matchmaking system busy. Please try again later!" });
        return false;
      }
    },
  
    examples: [
      [{
        user: "DataBarista",
        content: {
          text: "Searching for professionals in web3 marketing...",
          action: "SERENDIPITY"
        }
      },
      {
        user: "User",
        content: { text: "Find me blockchain developers" }
      }],
      [{
        user: "User",
        content: {
          text: "/new_match"
        }
      },
      {
        user: "DataBarista",
        content: { text: "Coming right up!" },
        action: "SERENDIPITY"
      }]
    ] as ActionExample[][]
  } as Action;
  