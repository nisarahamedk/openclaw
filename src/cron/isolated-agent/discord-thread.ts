import { createThreadDiscord, sendMessageDiscord } from "../../discord/send.js";

export type DiscordThreadResult = {
	threadId: string;
	starterMessageId: string;
};

/**
 * Send a starter message and create a Discord thread on the parent channel.
 * Returns the thread channel ID and the starter message ID.
 */
export async function createDiscordThreadAndSendStarter(params: {
	to: string;
	accountId?: string;
	threadName: string;
	starterMessage: string;
}): Promise<DiscordThreadResult> {
	const { to, accountId, threadName, starterMessage } = params;

	if (!to.startsWith("channel:")) {
		throw new Error("Discord thread creation requires a channel target (channel:<id>).");
	}

	const starterResult = await sendMessageDiscord(to, starterMessage, {
		accountId: accountId ?? undefined,
	});

	const threadResponse = (await createThreadDiscord(
		starterResult.channelId,
		{
			messageId: starterResult.messageId,
			name: threadName,
		},
		{ accountId: accountId ?? undefined },
	)) as { id?: string | null };

	const threadId = threadResponse?.id ? String(threadResponse.id) : "";
	if (!threadId) {
		throw new Error("Discord thread creation failed (missing thread id).");
	}

	return {
		threadId,
		starterMessageId: starterResult.messageId,
	};
}
