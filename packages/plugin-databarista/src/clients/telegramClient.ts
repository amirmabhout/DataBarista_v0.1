import { Client, IAgentRuntime, elizaLogger } from "@elizaos/core";
import { shutdownTelegramBots } from "../utils/telegramUtils";
import { setupTelegramCallbackHandlers } from "../utils/telegramHandlers";

/**
 * Telegram client for DataBarista plugin
 * Manages Telegram bot instances and ensures proper cleanup
 */
export const telegramClient: Client = {
    /**
     * Initialize the Telegram client
     * This is called when the plugin is loaded
     */
    start: async (runtime: IAgentRuntime): Promise<unknown> => {
        try {
            // Get the Telegram client from runtime
            const client = runtime.clients['telegram'];
            if (!client || !client.bot) {
                elizaLogger.error('No valid Telegram client found in runtime');
                return false;
            }
            
            // Set up handlers for inline keyboard callbacks using the shared function
            setupTelegramCallbackHandlers(client.bot);
            
            elizaLogger.info("Telegram client initialized with callback handlers");
            return true;
        } catch (error) {
            elizaLogger.error(`Error initializing Telegram client: ${error}`);
            return false;
        }
    },
    
    /**
     * Stop the Telegram client
     * This is called when the plugin is unloaded
     */
    stop: async (_runtime: IAgentRuntime): Promise<unknown> => {
        // Shut down all active Telegram bots
        await shutdownTelegramBots();
        return true;
    }
}; 