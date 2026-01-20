import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClawdbotConfig } from "../../config/config.js";
import type { CronJob } from "../types.js";

const mockCreateDiscordThreadAndSendStarter = vi.fn();
const mockResolveDeliveryTarget = vi.fn();
const mockResolveCronSession = vi.fn();
const mockDeliverOutboundPayloads = vi.fn();

vi.mock("./discord-thread.js", () => ({
	createDiscordThreadAndSendStarter: (...args: unknown[]) =>
		mockCreateDiscordThreadAndSendStarter(...args),
}));

vi.mock("./delivery-target.js", () => ({
	resolveDeliveryTarget: (...args: unknown[]) => mockResolveDeliveryTarget(...args),
}));

vi.mock("./session.js", () => ({
	resolveCronSession: (...args: unknown[]) => mockResolveCronSession(...args),
}));

vi.mock("../../infra/outbound/deliver.js", () => ({
	deliverOutboundPayloads: (...args: unknown[]) => mockDeliverOutboundPayloads(...args),
}));

vi.mock("../../agents/agent-scope.js", () => ({
	resolveDefaultAgentId: vi.fn().mockReturnValue("main"),
	resolveAgentConfig: vi.fn().mockReturnValue(undefined),
	resolveAgentModelFallbacksOverride: vi.fn().mockReturnValue(undefined),
	resolveAgentWorkspaceDir: vi.fn().mockReturnValue("/tmp/workspace"),
}));

vi.mock("../../agents/workspace.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../../agents/workspace.js")>();
	return {
		...actual,
		ensureAgentWorkspace: vi.fn().mockResolvedValue({ dir: "/tmp/workspace" }),
	};
});

vi.mock("../../agents/model-catalog.js", () => ({
	loadModelCatalog: vi.fn().mockResolvedValue({}),
}));

vi.mock("../../agents/model-fallback.js", () => ({
	runWithModelFallback: vi.fn().mockResolvedValue({
		result: {
			payloads: [{ text: "Hello" }],
			meta: { agentMeta: { model: "gpt-4o", provider: "openai", usage: {} } },
		},
		provider: "openai",
		model: "gpt-4o",
	}),
}));

vi.mock("../../agents/model-selection.js", () => ({
	resolveConfiguredModelRef: vi.fn().mockReturnValue({ provider: "openai", model: "gpt-4o" }),
	resolveAllowedModelRef: vi.fn().mockReturnValue({
		ref: { provider: "openai", model: "gpt-4o" },
	}),
	getModelRefStatus: vi.fn().mockReturnValue({ allowed: true }),
	resolveHooksGmailModel: vi.fn().mockReturnValue(null),
	resolveThinkingDefault: vi.fn().mockReturnValue("low"),
	isCliProvider: vi.fn().mockReturnValue(false),
}));

vi.mock("../../agents/skills.js", () => ({
	buildWorkspaceSkillSnapshot: vi.fn().mockReturnValue({ version: 1 }),
}));

vi.mock("../../agents/skills/refresh.js", () => ({
	getSkillsSnapshotVersion: vi.fn().mockReturnValue(1),
}));

vi.mock("../../agents/timeout.js", () => ({
	resolveAgentTimeoutMs: vi.fn().mockReturnValue(1000),
}));

vi.mock("../../agents/usage.js", () => ({
	hasNonzeroUsage: vi.fn().mockReturnValue(false),
}));

vi.mock("../../agents/context.js", () => ({
	lookupContextTokens: vi.fn().mockReturnValue(128000),
}));

vi.mock("../../auto-reply/thinking.js", () => ({
	normalizeThinkLevel: vi.fn().mockReturnValue(undefined),
	normalizeVerboseLevel: vi.fn().mockReturnValue("off"),
	supportsXHighThinking: vi.fn().mockReturnValue(false),
	formatXHighModelHint: vi.fn().mockReturnValue("gpt-4o"),
}));

vi.mock("../../config/sessions.js", () => ({
	resolveSessionTranscriptPath: vi.fn().mockReturnValue("/tmp/session.json"),
	updateSessionStore: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../infra/agent-events.js", () => ({
	registerAgentRunContext: vi.fn(),
}));

vi.mock("../../infra/skills-remote.js", () => ({
	getRemoteSkillEligibility: vi.fn().mockReturnValue({}),
}));

vi.mock("../../cli/outbound-send-deps.js", () => ({
	createOutboundSendDeps: vi.fn().mockReturnValue({}),
}));

const baseJob: CronJob = {
	id: "job1",
	name: "Upwork",
	enabled: true,
	createdAtMs: Date.now(),
	updatedAtMs: Date.now(),
	schedule: { kind: "every", everyMs: 60000 },
	sessionTarget: "isolated",
	wakeMode: "next-heartbeat",
	payload: {
		kind: "agentTurn",
		message: "test message",
		deliver: true,
		channel: "discord",
		to: "channel:parent",
		threadName: "New Thread",
	},
	state: {},
};

const baseConfig: ClawdbotConfig = {
	agents: { defaults: {} },
	channels: { discord: { enabled: true, accounts: { default: { enabled: true } } } },
} as ClawdbotConfig;

describe("runCronIsolatedAgentTurn threads", () => {
	beforeEach(() => {
		mockCreateDiscordThreadAndSendStarter.mockReset();
		mockResolveDeliveryTarget.mockReset();
		mockResolveCronSession.mockReset();
		mockDeliverOutboundPayloads.mockReset();

		mockResolveDeliveryTarget.mockResolvedValue({
			channel: "discord",
			to: "channel:parent",
			accountId: "default",
			mode: "explicit",
		});

		mockResolveCronSession.mockReturnValue({
			storePath: "/tmp/store.json",
			store: {},
			sessionEntry: { sessionId: "session-1", systemSent: false },
		});

		mockCreateDiscordThreadAndSendStarter.mockResolvedValue({
			threadId: "thread-123",
			starterMessageId: "msg-1",
		});
	});

	it("creates a thread and binds the session to the thread id", async () => {
		const { runCronIsolatedAgentTurn } = await import("./run.js");

		await runCronIsolatedAgentTurn({
			cfg: baseConfig,
			deps: {} as Parameters<typeof runCronIsolatedAgentTurn>[0]["deps"],
			job: baseJob,
			message: "test message",
			sessionKey: "cron:job1",
		});

		expect(mockCreateDiscordThreadAndSendStarter).toHaveBeenCalledWith({
			to: "channel:parent",
			accountId: "default",
			threadName: "New Thread",
			starterMessage: "test message",
		});

		expect(mockResolveCronSession).toHaveBeenCalledWith(
			expect.objectContaining({
				sessionKey: "agent:main:discord:channel:thread-123",
			}),
		);

		expect(mockDeliverOutboundPayloads).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "channel:thread-123",
			}),
		);
	});
});
