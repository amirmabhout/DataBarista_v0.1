import {
    IAgentRuntime,
    Memory,
    State,
    elizaLogger,
    ModelClass,
    ActionExample,
    type Action,
    composeContext,
    generateObjectArray
  } from "@elizaos/core";
import { MATCH_PROMPT_TEMPLATE } from "../utils/promptTemplates";
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
      const matchLimit = await checkMatchLimit(runtime, platform, username);
      
      if (matchLimit.isLimited) {
        elizaLogger.info(`User has reached the daily match limit of ${DAILY_MATCH_LIMIT} matches.`);
        
        const resetTime = new Date(matchLimit.resetTime || new Date());
        const formattedResetTime = resetTime.toLocaleString('en-US', {
          hour: 'numeric',
          minute: 'numeric',
          hour12: true
        });
        
        callback({ 
          text: `You've reached your match limit for today (${DAILY_MATCH_LIMIT} matches per day). You can request more matches after ${formattedResetTime}.`
        });
        return true;
      }

      // Get user profile using MongoDB
      let profileData = await getProfile(runtime, platform, username);

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
      const idealMatchDescription = await generateIdealMatchProfile(runtime, rawProfile, activeState);
      
      if (!idealMatchDescription) {
        elizaLogger.error("Failed to generate ideal match profile description");
        callback({
          text: "I'm sorry, but I encountered an error while trying to find a match for you. Please try again later."
        });
        return false;
      }
      
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
      const candidates = await findMatchingProfilesWithAtlasSearch(runtime, idealMatchEmbedding, platform, username, state);
      
        if (!candidates.length) {
          callback({ text: "No matches found yet. I'll keep searching!" });
          return true;
        }
      
      // Record the match request to track rate limiting
      await recordMatchRequest(runtime, platform, username);
  
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
        await recordMatches(runtime, platform, username, matchToRecord);
        elizaLogger.info(`Recorded the selected match in the user's profile`);
        
        // Send notification to the matched user about the connection using the shared function
        await notifyMatchedUser(
          runtime,
          selectedMatch.matchPlatform,
          selectedMatch.matchUsername,
          username,
          postMessage,
          callback // Pass the callback function for direct messaging
        );
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
  