import type { IAgentRuntime, Plugin } from "@elizaos/core";
import { noneAction } from "./actions/noneAction";
import { publishAndFindMatch } from "./actions/publishAndFindMatch";
import { serendipityAction } from "./actions/serendipityAction";
import { simSynteticProfile } from "./actions/simSynteticProfile";
import { userProfileProvider } from "./providers/userProfileProvider";
import { telegramClient } from "./clients/telegramClient";
import { setupTelegramCallbackHandlers } from "./utils/telegramHandlers";

export * as actions from "./actions";
//export * as evaluators from "./evaluators";
export * as providers from "./providers";
export * as utils from "./utils";
export * as clients from "./clients";

// Simple flag to prevent duplicate initialization
let hasInitialized = false;

// Simpler initialization for inline keyboard handlers
const initializeTelegramHandlers = () => {
  if (hasInitialized) return;
  
  // Only run in Node.js environment, not browser
  if (typeof window !== 'undefined') return;
  
  hasInitialized = true;
  
  // We'll rely on the telegramClient.start and noneAction.handler methods 
  // to set up handlers, no need for complex global initialization here
};

// Initialize handlers when the module is loaded
initializeTelegramHandlers();

export const databaristaPlugin: Plugin = {
    name: "databarista",
    description: "A matchmaking agent disguised as a barista",
    actions: [
        publishAndFindMatch,
        noneAction,
        simSynteticProfile,
        serendipityAction
    ],
    evaluators: [],
    providers: [userProfileProvider],
    clients: [telegramClient]
};
export default databaristaPlugin;
