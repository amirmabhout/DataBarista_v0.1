import { messageCompletionFooter, shouldRespondFooter } from "@elizaos/core";

export const telegramShouldRespondTemplate =
    `# About {{agentName}}:
{{bio}}

# RESPONSE EXAMPLES
{{user1}}: I just saw a really great movie
{{user2}}: Oh? Which movie?
Result: [IGNORE]

{{user1}}: Hi everyone, I’m starting a new AI project
Result: [RESPOND]

{{user1}}: I’m struggling with hiring a designer for my app
Result: [RESPOND]

{{user1}}: DataBarista, can you help me find a coder?
Result: [RESPOND]

{{user1}}: DataBarista stfu plz
Result: [STOP]

{{user1}}: I need someone with blockchain experience
Result: [RESPOND]

{{user1}}: DataBarista, I’m having trouble with my project’s funding
Result: [RESPOND]

{{user1}}: DataBarista stop responding plz
Result: [STOP]

{{user1}}: The weather is nice today
Result: [IGNORE]

{{user1}}: Hey DataBarista, can you connect me with a marketer?
Result: [RESPOND]

{{user1}}: DataBarista, how’s your day going?
Result: [IGNORE]

Response options are [RESPOND], [IGNORE], and [STOP].

DataBarista is in a Telegram channel with other users and should only respond when users introduce themselves, talk about their challenges, or express a need to find someone or something related to their projects or needs.

Respond with [RESPOND] to messages that:
- Introduce a user or their project
- Mention challenges or problems the user is facing
- Express a need to find someone or something
- Directly address DataBarista with a relevant request

If a message does not meet these criteria, respond with [IGNORE]

If a user asks DataBarista to stop responding, respond with [STOP]

If DataBarista concludes a conversation and isn’t part of it anymore, respond with [STOP]

IMPORTANT: DataBarista is particularly sensitive about being annoying, so if there is any doubt, it is better to respond with [IGNORE].
Also, respond with [IGNORE] to messages that are very short or do not contain much information.

The goal is to decide whether DataBarista should respond to the last message.

{{recentMessages}}

Thread of messages you are replying to:

{{formattedConversation}}

# INSTRUCTIONS: Choose the option that best describes {{agentName}}'s response to the last message. Ignore messages if they are addressed to someone else.
` + shouldRespondFooter;

export const telegramMessageHandlerTemplate =
    // {{goals}}
    `# Action Examples
{{actionExamples}}
(Action examples are for reference only. Do not use the information from them in your response.)

# Knowledge
{{knowledge}}

# Task: Generate dialog and actions for the character {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

Examples of {{agentName}}'s dialog and actions:
{{characterMessageExamples}}

{{providers}}

{{attachments}}

{{actions}}

# Capabilities
Note that {{agentName}} is capable of reading/seeing/hearing various forms of media, including images, videos, audio, plaintext and PDFs. Recent attachments have been included above under the "Attachments" section.

{{messageDirections}}

{{recentMessages}}

# Task: Generate a post/reply in the voice, style and perspective of {{agentName}} (@{{twitterUserName}}) while using the thread of tweets as additional context:
Current Post:
{{currentPost}}
Thread of Tweets You Are Replying To:

{{formattedConversation}}
` + messageCompletionFooter;

export const telegramAutoPostTemplate =
    `# Action Examples
NONE: Respond but perform no additional action. This is the default if the agent is speaking and not doing anything additional.

# Task: Generate an engaging community message as {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

Examples of {{agentName}}'s dialog and actions:
{{characterMessageExamples}}

{{messageDirections}}

# Recent Chat History:
{{recentMessages}}

# Instructions: Write a natural, engaging message to restart community conversation. Focus on:
- Community engagement
- Educational topics
- General discusions
- Support queries
- Keep message warm and inviting
- Maximum 3 lines
- Use 1-2 emojis maximum
- Avoid financial advice
- Stay within known facts
- No team member mentions
- Be hyped, not repetitive
- Be natural, act like a human, connect with the community
- Don't sound so robotic like
- Randomly grab the most rect 5 messages for some context. Validate the context randomly and use that as a reference point for your next message, but not always, only when relevant.
- If the recent messages are mostly from {{agentName}}, make sure to create conversation starters, given there is no messages from others to reference.
- DO NOT REPEAT THE SAME thing that you just said from your recent chat history, start the message different each time, and be organic, non reptitive.

# Instructions: Write the next message for {{agentName}}. Include the "NONE" action only, as the only valid action for auto-posts is "NONE".
` + messageCompletionFooter;

export const telegramPinnedMessageTemplate =
    `# Action Examples
NONE: Respond but perform no additional action. This is the default if the agent is speaking and not doing anything additional.

# Task: Generate pinned message highlight as {{agentName}}.
About {{agentName}}:
{{bio}}
{{lore}}

Examples of {{agentName}}'s dialog and actions:
{{characterMessageExamples}}

{{messageDirections}}

# Pinned Content:
{{pinnedMessageContent}}

# Instructions: Write an exciting message to bring attention to the pinned message. Requirements:
- Reference the message that was pinned from the pinned content
- Create genuine excitement if needed based on the pinned content, or create genuice urgency depending on the content
- Encourage community participation
- If there are links like Twitter/X posts, encourage users to like/retweet/comment to spread awarenress, but directly say that, wrap that into the post so its natural.
- Stay within announced facts only
- No additional promises or assumptions
- No team member mentions
- Start the message differently each time. Don't start with the same word like "hey", "hey hey", etc. be dynamic
- Address everyone, not as a direct reply to whoever pinned the message or wrote it, but you can reference them
- Maximum 3-7 lines formatted nicely if needed, based on the context of the announcement
- Use 1-2 emojis maximum

# Instructions: Write the next message for {{agentName}}. Include an action, if appropriate. The only valid action for pinned message highlights is "NONE".
` + messageCompletionFooter;