import { Provider, IAgentRuntime, Memory, State, elizaLogger } from "@elizaos/core";
// @ts-ignore
import DKG from "dkg.js";
import { USER_PROFILE_QUERY } from "../utils/sparqlQueries";
import { DkgClientConfig } from "../utils/types";

let DkgClient: any = null;

//TODO; currently sparql query is only getting latest intent ids, but later should get all unique ids and their latest revision timestamp

// SPARQL query to find structured user data

const userProfileProvider: Provider = {
    get: async (runtime: IAgentRuntime, message: Memory, state?: State): Promise<string | null> => {
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

            // Get username from actorsData if available, otherwise fall back to senderName or userId
            const username = state?.actorsData?.find(actor => actor.id === message.userId)?.username || message.userId;
            
            // Get platform type from client
            const clients = runtime.clients;
            let platform = Object.keys(clients)[0];

            elizaLogger.info("Checking DKG for user data:", {
                username,
                platform
            });

            // Query for user data
            const userDataQuery = USER_PROFILE_QUERY
                .replace("{{platform}}", platform)
                .replace("{{username}}", username);

            let userData;
            try {
                const queryResult = await DkgClient.graph.query(userDataQuery, "SELECT");
                elizaLogger.info("User data query result:", {
                    status: queryResult.status,
                    data: queryResult.data
                });
                
                userData = queryResult.data;
            } catch (error) {
                elizaLogger.error("Error querying user data:", error);
                return null;
            }

            // If no data found
            if (!userData || userData.length === 0) {
                return `No profile information found yet for @${username} on ${platform}. Converse the user to get more information to build a better profile.`;
            }

            // Format the found data as JSON-LD
            const jsonLd = {
                "@context": {
                    "schema": "http://schema.org/",
                    "datalatte": "https://datalatte.com/ns/",
                    "foaf": "http://xmlns.com/foaf/0.1/"
                },
                "@graph": userData
            };

            return `
Profile history for @${username} collected through ${platform} interactions with DataBarista sofar:
\`\`\`json
${JSON.stringify(jsonLd, null, 2)}
\`\`\`
Task: Based on users recent conversation, engage in a natural conversation to ask follow up questions to get information that helps finding a better match for the intent user is looking for currently in the conversation.
`;
        } catch (error) {
            elizaLogger.error("Error in userProfileProvider:", error);
            return null;
        }
    }
};

export { userProfileProvider }; 