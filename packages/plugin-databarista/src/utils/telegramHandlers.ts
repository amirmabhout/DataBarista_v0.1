import { elizaLogger } from "@elizaos/core";

/**
 * Set up handlers for Telegram callback queries
 * This function should be called during plugin initialization
 * to ensure callback handlers are registered with the Telegram bot
 * 
 * @param bot Telegram bot instance
 */
export function setupTelegramCallbackHandlers(bot: any): void {
  try {
    elizaLogger.info("DATABARISTA DEBUG: Setting up global Telegram callback handlers");
    
    // Check if bot already has callback_query handler to avoid duplicates
    const hasExistingHandler = bot.hasOwnProperty('_events') && 
                              bot._events.hasOwnProperty('callback_query');
    
    if (hasExistingHandler) {
      elizaLogger.info("DATABARISTA DEBUG: Callback query handler already registered, skipping");
      return;
    }
    
    // Set up the callback query handler - much simpler now, just to answer the query
    bot.on('callback_query', async (ctx: any) => {
      try {
        elizaLogger.info("DATABARISTA DEBUG: Callback query received");
        
        // Answer the callback query to stop loading indicator
        try {
          await ctx.answerCbQuery();
          elizaLogger.info("DATABARISTA DEBUG: Successfully answered callback query");
        } catch (answerError) {
          elizaLogger.error(`DATABARISTA DEBUG: Error answering callback query: ${answerError}`);
        }
      } catch (error) {
        elizaLogger.error(`DATABARISTA DEBUG: Error in callback_query handler: ${error}`);
        if (ctx.callbackQuery) {
          try {
            await ctx.answerCbQuery().catch((answerError: any) => {
              elizaLogger.error(`DATABARISTA DEBUG: Error answering callback in error handler: ${answerError}`);
            });
          } catch (finalError) {
            elizaLogger.error(`DATABARISTA DEBUG: Final error in callback handling: ${finalError}`);
          }
        }
      }
    });
    
    elizaLogger.info("DATABARISTA DEBUG: Telegram callback handlers successfully registered");
  } catch (error) {
    elizaLogger.error(`DATABARISTA DEBUG: Error setting up Telegram callback handlers: ${error}`);
  }
} 