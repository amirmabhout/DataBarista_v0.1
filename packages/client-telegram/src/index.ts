import { elizaLogger } from "@elizaos/core";
import type { Client, IAgentRuntime } from "@elizaos/core";
import { TelegramClient } from "./telegramClient.ts";
import { validateTelegramConfig } from "./environment.ts";

export const TelegramClientInterface: Client = {
    start: async (runtime: IAgentRuntime) => {
        await validateTelegramConfig(runtime);

        const tg = new TelegramClient(
            runtime,
            runtime.getSetting("TELEGRAM_BOT_TOKEN")
        );

        await tg.start();

        elizaLogger.success(
            `✅ Telegram client successfully started for character ${runtime.character.name}`
        );
        return tg;
    },
    stop: async (_runtime: IAgentRuntime) => {
        elizaLogger.warn("Telegram client does not support stopping yet");
    },
};

// Add a method to get user chatIds
export function getUserChatId(runtime: IAgentRuntime, username: string): string | undefined {
  if (runtime.clients['telegram']?.messageManager?.getUserChatId) {
    return runtime.clients['telegram'].messageManager.getUserChatId(username);
  }
  return undefined;
}

export function getAllUserChatIds(runtime: IAgentRuntime): Record<string, string> {
  if (runtime.clients['telegram']?.messageManager?.getAllUserChatIds) {
    return runtime.clients['telegram'].messageManager.getAllUserChatIds();
  }
  return {};
}

export default TelegramClientInterface;
