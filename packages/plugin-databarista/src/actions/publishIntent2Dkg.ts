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
// @ts-ignore
import DKG from "dkg.js";
import { USER_PROFILE_QUERY } from "../utils/sparqlQueries";
import { MATCH_PROMPT_TEMPLATE, KG_EXTRACTION_TEMPLATE, MATCH_QUERY_TEMPLATE } from "../utils/promptTemplates";
import { SHACL_SHAPES } from "../utils/shaclShapes";
import { DkgClientConfig } from "../utils/types";
import { profileCache } from "../utils/profileCache";

let DkgClient: any = null;

async function getOrFetchUserProfile(
  dkgClient: any,
  platform: string,
  username: string,
  forceRefresh: boolean = false
): Promise<any> {
  // If forceRefresh is true, invalidate the cache first
  if (forceRefresh) {
    elizaLogger.info("Forcing cache refresh for user profile:", { platform, username });
    profileCache.invalidate(platform, username);
  }

  // Try to get from cache first
  let profileData = profileCache.get(platform, username);
  if (profileData) {
    elizaLogger.info("Using cached user profile data for:", { platform, username });
    return profileData;
  }

  // If not in cache, query DKG
  elizaLogger.info("Fetching user profile from DKG for:", { platform, username });
  const profileQuery = USER_PROFILE_QUERY
    .replace("{{platform}}", platform)
    .replace("{{username}}", username);

  const queryResult = await dkgClient.graph.query(profileQuery, "SELECT");
  
  if (queryResult.data?.length > 0) {
    // Cache the result
    profileCache.set(platform, username, queryResult.data);
  }
  
  return queryResult.data;
}

async function generateMatchingQuery(
  runtime: IAgentRuntime,
  userProfileData: any,
  platform: string,
  username: string,
  state?: State
): Promise<string> {
  elizaLogger.info("=== Starting Query Generation ===");
  elizaLogger.info("Input Parameters:");
  elizaLogger.info("User Profile Data:", JSON.stringify(userProfileData, null, 2));
  elizaLogger.info("Platform:", platform);
  elizaLogger.info("Username:", username);

  // Update state with recent messages if not present
  if (state && !state.recentMessages) {
    state = await runtime.updateRecentMessageState(state);
  }

  const context = composeContext({
    template: MATCH_QUERY_TEMPLATE,
    state: {
      shaclShapes: SHACL_SHAPES,
      userProfileData: JSON.stringify(userProfileData, null, 2),
      platform,
      username,
      recentMessages: state?.recentMessages || []
    } as any
  });

  elizaLogger.info("=== Generated Context for Query Generation ===");
  elizaLogger.info("Full Context:", context);
  elizaLogger.info("=========================================");

  const queryResult = await generateObjectArray({
    runtime,
    context,
    modelClass: ModelClass.LARGE
  });

  if (!queryResult?.length) {
    throw new Error("Failed to generate SPARQL query");
  }

  elizaLogger.info("=== Query Generation Result ===");
  elizaLogger.info("Raw Result:", JSON.stringify(queryResult, null, 2));
  elizaLogger.info("================================");

  return queryResult[0].query;
}

async function getMatchingProfiles(
  runtime: IAgentRuntime,
  userProfileData: any,
  platform: string,
  username: string,
  state?: State
): Promise<any[]> {
  elizaLogger.info("=== Serendipity Matching Query Parameters ===");
  elizaLogger.info("User Profile:", userProfileData);
  elizaLogger.info("Platform:", platform);
  elizaLogger.info("Username:", username);

  const sparqlQuery = await generateMatchingQuery(runtime, userProfileData, platform, username, state);

  elizaLogger.info("=== Generated SPARQL Query ===");
  elizaLogger.info("Raw Query String:");
  elizaLogger.info(sparqlQuery);
  elizaLogger.info("=================================");

  try {
    elizaLogger.info("=== Executing SPARQL Query ===");
    const result = await DkgClient.graph.query(sparqlQuery, "SELECT");
    elizaLogger.info("=== Raw Query Result ===");
    elizaLogger.info("Status:", result.status);
    elizaLogger.info("Raw Data:", JSON.stringify(result.data, null, 2));
    elizaLogger.info("================================");

    if (!result.data) return [];
    return result.data;
  } catch (error) {
    elizaLogger.error("=== Serendipity Search Error ===");
    elizaLogger.error("SPARQL query failed:", error);
    elizaLogger.error("=============================");
    return [];
  }
}

async function publishToDkg(
  dkgClient: any,
  publicJsonLd: any,
  privateJsonLd: any,
  runtime: IAgentRuntime
): Promise<void> {
  try {
    elizaLogger.info("Publishing professional intention to DKG with client config:", {
      environment: runtime.getSetting("DKG_ENVIRONMENT"),
      endpoint: runtime.getSetting("DKG_HOSTNAME"),
      port: runtime.getSetting("DKG_PORT"),
      blockchain: runtime.getSetting("DKG_BLOCKCHAIN_NAME"),
    });

    elizaLogger.info("Initializing DKG asset creation...");
    const createAssetResult = await dkgClient.asset.create(
      {
        public: publicJsonLd,
        private: privateJsonLd,
      },
      { epochsNum: 3 }
    );

    elizaLogger.info("DKG asset creation request completed successfully");
    elizaLogger.info("=== Knowledge Asset Created ===");
    elizaLogger.info(`UAL: ${createAssetResult.UAL}`);
    elizaLogger.info(
      `DKG Explorer Link: ${
        runtime.getSetting("DKG_ENVIRONMENT") === "mainnet"
          ? "https://dkg.origintrail.io/explore?ual="
          : "https://dkg-testnet.origintrail.io/explore?ual="
      }${createAssetResult.UAL}`
    );
  } catch (error) {
    elizaLogger.error("Error occurred while publishing intents to DKG:", error.message);
    if (error.stack) {
      elizaLogger.error("Stack trace:", error.stack);
    }
    if (error.response) {
      elizaLogger.error("Response data:", JSON.stringify(error.response.data, null, 2));
    }
  }
}

export const publishIntent2Dkg: Action = {
  name: "PUBLISH_DKG_INTENT",
  similes: ["PUBLISH_INTENTION_TO_DKG", "SAVE_INTENTION_TO_DKG", "STORE_INTENTION_IN_DKG"],
  description: "Extracts knowledge from the conversation with user and publishes it to the edge node while anonymous intents are public on DKG and user profile is private within edge node. Choose this action when user provided enough information to find a suitable match, if not use NONE and keep continuing the conversation with the user.",

  validate: async (runtime: IAgentRuntime, _message: Memory) => {
    const requiredEnvVars = [
      "DKG_ENVIRONMENT",
      "DKG_HOSTNAME",
      "DKG_PORT",
      "DKG_BLOCKCHAIN_NAME",
      "DKG_PUBLIC_KEY",
      "DKG_PRIVATE_KEY",
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
      // Initialize DKG client if needed
      if (!DkgClient) {
        const config: DkgClientConfig = {
          environment: runtime.getSetting("DKG_ENVIRONMENT"),
          endpoint: runtime.getSetting("DKG_HOSTNAME"),
          port: runtime.getSetting("DKG_PORT"),
          blockchain: {
            name: runtime.getSetting("DKG_BLOCKCHAIN_NAME"),
            publicKey: runtime.getSetting("DKG_PUBLIC_KEY"),
            privateKey: runtime.getSetting("DKG_PRIVATE_KEY"),
          },
          maxNumberOfRetries: 300,
          frequency: 2,
          contentType: "all",
          nodeApiVersion: "/v1",
        };
        DkgClient = new DKG(config);
      }

      // Extract username from state or message
      const username = state?.actorsData?.find(actor => actor.id === message.userId)?.username || message.userId;
      
      // Get platform type from client
      const clients = runtime.clients;
      let platform = Object.keys(clients)[0];

      elizaLogger.info("User platform details:", {
        username,
        platform
      });

      // Get existing user profile data (from cache or DKG)
      const userProfileData = await getOrFetchUserProfile(DkgClient, platform, username);
      
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

      elizaLogger.info("Generating JSON-LD with context data:", {
        messageId: message.id,
        platform,
        username,
        newIntentionId,
        newProjectId
      });

      const context = composeContext({
        template: KG_EXTRACTION_TEMPLATE,
        state,
      });

      elizaLogger.info("=== Full KG Extraction Template Prompt ===");
      elizaLogger.info("Template:", {
        fullPrompt: context,
        stateData: {
          recentMessages: state.recentMessages,
          uuid: state.uuid,
          intentid: state.intentid,
          projectid: state.projectid,
          platform: state.platform,
          username: state.username,
        },
      });

      const result = await generateObjectArray({
        runtime,
        context,
        modelClass: ModelClass.LARGE,
      });

      if (!result || result.length === 0) {
        elizaLogger.info("No professional intention to publish - empty result");
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
        callback({
          text: "I found your anonym intent is already published and no update was needed! Let me know if you wanna add any more details but telling me about yourself or who you are looking for.",
        });
        return true;
      }

      // If it's an update to an existing intention, use that ID
      if (analysis.matchType === "update_existing" && analysis.existingIntentionId) {
        state.intentid = analysis.existingIntentionId;
        elizaLogger.info("Updating existing professional intention:", {
          existingId: analysis.existingIntentionId,
          reason: analysis.reason,
        });
      }

      const { public: publicJsonLd, private: privateJsonLd } = firstResult;

      elizaLogger.info("=== Generated JSON-LD for DKG ===");
      elizaLogger.info("Public JSON-LD:", {
        data: publicJsonLd,
      });
      elizaLogger.info("Private JSON-LD:", {
        data: JSON.stringify(privateJsonLd, null, 2),
      });

      // Update cache with combined JSON-LD data
      const newProfileData = {
        ...privateJsonLd,
        ...publicJsonLd
      };

      profileCache.set(platform, username, [newProfileData]);
      elizaLogger.info("Cache updated with combined profile data");

      // Start DKG publishing asynchronously
      publishToDkg(DkgClient, publicJsonLd, privateJsonLd, runtime).catch(error => {
        elizaLogger.error("Async DKG publishing failed:", error);
      });

      elizaLogger.info("=== Starting Match Search ===");
      // Find matches using the new profile data immediately
      const candidates = await getMatchingProfiles(runtime, newProfileData, platform, username, state);
      
      if (!candidates.length) {
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

      elizaLogger.info("=== State Before Template Merge ===");
      elizaLogger.info("User Profile Data:", postGenerationState.userProfileData);
      elizaLogger.info("Matches Data:", postGenerationState.matchesData);

      const matchPromptContext = composeContext({
        template: MATCH_PROMPT_TEMPLATE,
        state: postGenerationState
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
        callback({ text: "I've updated your profile and found some matches, but couldn't generate the introduction. Please try again!" });
        return true;
      }

      // Extract the post text from the result array and send the callback
      const postMessage = postResult[0]?.post || "Found matches but couldn't format the message properly. Please try again!";
      callback({ text: postMessage });

      return true;
    } catch (error) {
      elizaLogger.error("Error in publishIntent2Dkg handler:", error);
      return false;
    }
  },

  examples: [
    [
      {
        user: "DataBarista",
        content: {
          "text": "Great, I'll post an introduction and tag both you and a growth specialist from my network as soon as I find a match! Wish to add any additional details?",
          "action": "(PUBLISH_DKG_INTENT)"
        },
      }
    ],
    [
      {
        "user": "DataBarista",
        "content": {
          "text": "Great, I'll post an introduction and tag both you and a crowdfunding expert from my network as soon as I find a match! Wish to add any additional details? (PUBLISH_DKG_INTENT)",
          "action": "(PUBLISH_DKG_INTENT)"
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
          "action": "(PUBLISH_DKG_INTENT)"
        }
      }
    ]
  ] as ActionExample[][],
} as Action;
