import { IAgentRuntime, elizaLogger } from "@elizaos/core";
import { Markup } from "telegraf";
import { MongoClient } from 'mongodb';

/**
 * Interface for user profile data from MongoDB
 */
interface ProfileData {
  platform: string;
  username: string;
  latestProfile: any;
  telegramChatId?: string;
  agentUsername?: string;
}

/**
 * Button type for inline keyboard
 */
export type InlineKeyboardButtonType = 
  | { type: 'callback', text: string, callbackData: string }
  | { type: 'switch_inline_query_current_chat', text: string, query: string };

/**
 * Get the user's profile data from MongoDB
 * 
 * @param runtime Agent runtime
 * @param username Username to look up
 * @returns User profile data or null if not found
 */
async function getUserProfile(
  runtime: IAgentRuntime,
  username: string
): Promise<ProfileData | null> {
  try {
    // Clean the username - ensure no @ prefix for database queries
    const cleanUsername = username.replace(/^@/, '');
    
    elizaLogger.info(`DATABARISTA DEBUG: Looking up profile for username: ${cleanUsername}`);
    
    const connectionString = runtime.getSetting('MONGODB_CONNECTION_STRING_CKG');
    const dbName = runtime.getSetting('MONGODB_DATABASE_CKG');
    
    if (!connectionString || !dbName) {
      elizaLogger.error('Missing MongoDB connection settings');
      return null;
    }
    
    const client = new MongoClient(connectionString);
    await client.connect();
    
    const db = client.db(dbName);
    // Use MONGODB_DATABASE_COLLECTION if set, otherwise default to 'telegram'
    const collectionName = runtime.getSetting('MONGODB_DATABASE_COLLECTION') || 'telegram';
    const collection = db.collection(collectionName);
    
    // Look for the user profile
    const profile = await collection.findOne(
      { platform: 'telegram', username: cleanUsername }
    );
    
    await client.close();
    
    elizaLogger.info(`DATABARISTA DEBUG: Profile found: ${!!profile}, has chatId: ${!!profile?.telegramChatId}`);
    
    // Cast the MongoDB document to ProfileData type
    return profile as unknown as ProfileData;
  } catch (error) {
    elizaLogger.error(`Error retrieving profile for ${username}:`, error);
    return null;
  }
}

/**
 * Get the appropriate Telegram bot token based on agent username
 * 
 * @param runtime Agent runtime
 * @param agentUsername Agent username associated with the user
 * @returns Telegram bot token or undefined if not found
 */
function getTelegramBotToken(
  runtime: IAgentRuntime,
  agentUsername?: string
): string | undefined {
  // Default to the current runtime's token if no agent username specified
  if (!agentUsername) {
    const defaultToken = runtime.getSetting('TELEGRAM_BOT_TOKEN');
    elizaLogger.info(`DATABARISTA DEBUG: Using default token (available: ${!!defaultToken})`);
    return defaultToken;
  }
  
  // Get tokens from environment variables based on agent username
  // Format: TELEGRAM_BOT_TOKEN_AGENTNAME (with non-alphanumeric chars removed)
  const safeAgentName = agentUsername.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const tokenEnvKey = `TELEGRAM_BOT_TOKEN_${safeAgentName}`;
  
  // Try to get the specific token for this agent
  const agentSpecificToken = runtime.getSetting(tokenEnvKey);
  
  // Log which token we're using
  elizaLogger.info(`DATABARISTA DEBUG: Looking for token with key ${tokenEnvKey}, found: ${!!agentSpecificToken}`);
  
  // Use the specific token if available, otherwise fall back to the default token
  return agentSpecificToken || runtime.getSetting('TELEGRAM_BOT_TOKEN');
}

/**
 * Get the Telegram client from the runtime
 * This uses the existing client instead of creating a new one
 * 
 * @param runtime Agent runtime
 * @returns The Telegram client or null if not found
 */
function getTelegramClient(runtime: IAgentRuntime): any {
  try {
    // Get the Telegram client from runtime
    const telegramClient = runtime.clients['telegram'];
    if (!telegramClient) {
      elizaLogger.error('No Telegram client found in runtime');
      return null;
    }
    
    // Access the bot.telegram property which contains the API methods
    if (!telegramClient.bot || !telegramClient.bot.telegram) {
      elizaLogger.error('Invalid Telegram client structure');
      return null;
    }
    
    return telegramClient.bot.telegram;
  } catch (error) {
    elizaLogger.error(`Error getting Telegram client: ${error}`);
    return null;
  }
}

/**
 * Send a message with an inline keyboard to a user using user's chat ID from the database
 * 
 * @param runtime Agent runtime
 * @param username Telegram username to send message to (without @ prefix)
 * @param messageText Text message to send with the keyboard
 * @param options Keyboard options
 * @returns Boolean indicating success
 */
export async function sendInlineKeyboardToUser(
  runtime: IAgentRuntime,
  username: string,
  messageText: string,
  options: {
    buttons?: Array<InlineKeyboardButtonType[]>;
  } = {}
): Promise<boolean> {
  try {
    elizaLogger.info(`DATABARISTA DEBUG: sendInlineKeyboardToUser called for username: ${username}`);
    
    // Clean username (remove @ if present)
    const cleanUsername = username.replace(/^@/, '');
    
    // Retrieve user profile to get both chat ID and associated agent username
    const userProfile = await getUserProfile(runtime, cleanUsername);
    
    if (!userProfile) {
      elizaLogger.warn(`DATABARISTA DEBUG: No user profile found for user ${cleanUsername}`);
      return false;
    }
    
    const storedChatId = userProfile.telegramChatId;
    
    if (!storedChatId) {
      elizaLogger.warn(`DATABARISTA DEBUG: No chat ID found for user ${cleanUsername}`);
      return false;
    }
    
    elizaLogger.info(`DATABARISTA DEBUG: Found chatId ${storedChatId}`);
    
    // Get the Telegram client from runtime
    const telegram = getTelegramClient(runtime);
    if (!telegram) {
      elizaLogger.error('DATABARISTA DEBUG: Failed to get Telegram client');
      return false;
    }
    
    // Create inline keyboard with provided buttons or defaults
    const keyboardButtons = options.buttons || [
      [{ type: 'callback', text: 'Option 1', callbackData: 'option1' }],
      [{ type: 'callback', text: 'Option 2', callbackData: 'option2' }]
    ];
    
    elizaLogger.info(`DATABARISTA DEBUG: Creating keyboard with ${keyboardButtons.length} rows`);
    elizaLogger.info(`DATABARISTA DEBUG: Raw buttons: ${JSON.stringify(keyboardButtons, null, 2)}`);
    
    // Convert our button format to Telegraf's format
    const keyboard = Markup.inlineKeyboard(
      keyboardButtons.map(row => 
        row.map(button => {
          elizaLogger.info(`DATABARISTA DEBUG: Converting button: ${JSON.stringify(button)}`);
          if (button.type === 'callback') {
            elizaLogger.info(`DATABARISTA DEBUG: Creating callback button with text "${button.text}" and data "${button.callbackData}"`);
            return Markup.button.callback(button.text, button.callbackData);
          } else if (button.type === 'switch_inline_query_current_chat') {
            elizaLogger.info(`DATABARISTA DEBUG: Creating switch_inline_query_current_chat button with text "${button.text}" and query "${button.query}"`);
            return Markup.button.switchToCurrentChat(button.text, button.query);
          } else {
            // Default to callback button if type is unknown
            elizaLogger.warn(`DATABARISTA DEBUG: Unknown button type: ${(button as any).type}`);
            return Markup.button.callback(
              (button as any).text || 'Button', 
              (button as any).callbackData || 'unknown'
            );
          }
        })
      )
    );
    
    // Log the processed keyboard for debugging
    elizaLogger.info(`DATABARISTA DEBUG: Processed keyboard: ${JSON.stringify(keyboard, null, 2)}`);
    
    // Send message with inline keyboard using the existing client
    elizaLogger.info(`DATABARISTA DEBUG: Sending message with keyboard to chatId ${storedChatId}`);
    try {
      const sentMessage = await telegram.sendMessage(storedChatId, messageText, keyboard);
      elizaLogger.info(`DATABARISTA DEBUG: Successfully sent message, response: ${JSON.stringify(sentMessage, null, 2)}`);
      return true;
    } catch (sendError) {
      elizaLogger.error(`DATABARISTA DEBUG: Error sending message: ${sendError}`);
      return false;
    }
  } catch (error) {
    elizaLogger.error(`DATABARISTA DEBUG: Error in sendInlineKeyboardToUser: ${error}`);
    return false;
  }
}

/**
 * Check if a chat ID belongs to Telegram platform
 * 
 * @param chatId The chat ID to check
 * @returns Boolean indicating if it's a valid Telegram chat ID
 */
export function isTelegramChatId(chatId: string): boolean {
  // Telegram chat IDs are numeric
  return /^-?\d+$/.test(chatId);
}

/**
 * Gracefully shutdown all active Telegram bot instances
 * This is a placeholder since we're no longer creating our own instances
 */
export async function shutdownTelegramBots(): Promise<void> {
  elizaLogger.info('No custom bot instances to shut down - using framework client');
} 