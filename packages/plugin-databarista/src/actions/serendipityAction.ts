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
  } from "@elizaos/core";
  // @ts-ignore
  import DKG from "dkg.js";
  import { USER_PROFILE_QUERY } from "../utils/sparqlQueries";
  import { MATCH_PROMPT_TEMPLATE, MATCH_QUERY_TEMPLATE } from "../utils/promptTemplates";
  import { SHACL_SHAPES } from "../utils/shaclShapes";
  import { DkgClientConfig } from "../utils/types";
  
  let DkgClient: any = null;
  
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

      return result.data.map((candidate: any) => ({
        ...candidate,
        username: candidate.accountName?.replace(/^"|"$/g, ''),
        name: candidate.name?.replace(/^"|"$/g, ''),
        knowledgeDomain: candidate.knowledgeDomain?.replace(/^"|"$/g, ''),
        desiredConnections: candidate.allDesiredConnections?.replace(/^"|"$/g, ''),
        projectType: candidate.projectType?.replace(/^"|"$/g, ''),
        projectDomain: candidate.projectDomain?.replace(/^"|"$/g, ''),
        challenge: candidate.challenge?.replace(/^"|"$/g, ''),
        projectName: candidate.projectName?.replace(/^"|"$/g, ''),
        projectDescription: candidate.projectDescription?.replace(/^"|"$/g, '')
      }));
    } catch (error) {
      elizaLogger.error("=== Serendipity Search Error ===");
      elizaLogger.error("SPARQL query failed:", error);
      elizaLogger.error("=============================");
      return [];
    }
  }
  
  export const serendipity: Action = {
    name: "SERENDIPITY",
    similes: ["FIND_MATCHES", "DISCOVER_CONNECTIONS"],
    description: "Finds most compatible matches from the databarista's network and introduces them together. Choose this action when user provided enough information to find a suitable match, if not use NONE and keep continuing the conversation with the user. This action is used only after (PUBLISH_INTENT_DKG) action is chosen atleast once in history of convo with user.",
  
    validate: async (runtime: IAgentRuntime, _message: Memory) => {
      const requiredVars = ["DKG_ENVIRONMENT", "DKG_HOSTNAME", "DKG_PORT"];
      return requiredVars.every(v => runtime.getSetting(v));
    },
  
    handler: async (runtime, message, state, _, callback) => {
      try {
        if (!DkgClient) {
          const config: DkgClientConfig = {
            environment: runtime.getSetting("DKG_ENVIRONMENT"),
            endpoint: runtime.getSetting("DKG_HOSTNAME"),
            port: runtime.getSetting("DKG_PORT"),
            blockchain: {
              name: runtime.getSetting("DKG_BLOCKCHAIN_NAME"),
              publicKey: runtime.getSetting("DKG_PUBLIC_KEY"),
              privateKey: runtime.getSetting("DKG_PRIVATE_KEY"),
            }
          };
          DkgClient = new DKG(config);
        }
  
        // Extract username from state or message
        const username = state?.actorsData?.find(actor => actor.id === message.userId)?.username || message.userId;
        
        // Get platform type from client
        const clients = runtime.clients;
        let platform = Object.keys(clients)[0];

        elizaLogger.info("=== Serendipity Action Started ===");
        elizaLogger.info("User Context:", { username, platform });
  
        // Get user profile
        const profileQuery = USER_PROFILE_QUERY
          .replace("{{platform}}", platform)
          .replace("{{username}}", username);
  
        elizaLogger.info("=== User Profile Query ===");
        elizaLogger.info(profileQuery);
        elizaLogger.info("=========================");
  
        const profileResult = await DkgClient.graph.query(profileQuery, "SELECT");
        elizaLogger.info("=== User Profile Result ===");
        elizaLogger.info(JSON.stringify(profileResult.data?.[0] || {}, null, 2));
        elizaLogger.info("==========================");
  
        if (!profileResult.data?.length) {
          callback({ text: "Please publish your profile first using 'publish to dkg'" });
          return false;
        }
  
        const rawProfile = profileResult.data[0];
        if (!rawProfile.projectDomain || !rawProfile.allDesiredConnections) {
          callback({ text: "Your profile seems incomplete. Please make sure to specify your knowledge domain, project domain, and desired connections when publishing to DKG." });
          return false;
        }
  
        if (!state) {
          state = await runtime.composeState(message);
        }
        state = await runtime.updateRecentMessageState(state);
  
        const candidates = await getMatchingProfiles(runtime, rawProfile, platform, username, state);
        if (!candidates.length) {
          callback({ text: "No matches found yet. I'll keep searching!" });
          return true;
        }
  
        // Prepare LLM context for generating a social media post
        const postGenerationState = {
          ...state,
          userProfileData: JSON.stringify(profileResult.data[0], null, 2),
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
  
        callback({ text: postMessage });
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
      }],
      [{
        user: "User",
        content: { text: "Find me blockchain developers" }
      }]
    ] as ActionExample[][]
  } as Action;
  