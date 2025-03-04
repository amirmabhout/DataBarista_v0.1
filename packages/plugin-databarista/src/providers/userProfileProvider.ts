import { Provider, IAgentRuntime, Memory, State, elizaLogger } from "@elizaos/core";
// @ts-ignore
import DKG from "dkg.js";
import { DkgClientConfig } from "../utils/types";
import { getProfile } from "../utils/profileUtils";

let DkgClient: any = null;

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

            elizaLogger.info("Checking for user profile data:", {
                username,
                platform
            });

            // Get profile using the profileUtils.getProfile function
            let userData = await getProfile(runtime, platform, username);

            // If no data found
            if (!userData || userData.length === 0) {
                return `No profile information found yet for @${username} on ${platform}. Converse with the user to get more information to build a better profile.`;
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
        } catch (error) {
            elizaLogger.error("Error in userProfileProvider:", error);
            return null;
        }
    }
};

export { userProfileProvider }; 