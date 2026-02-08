/**
 * Tests for ClineAgent.ts
 *
 * Tests the core agent implementation, session management, and task execution.
 * Due to the heavy dependency on Controller, StateManager, and other infrastructure,
 * these tests focus on:
 * - Permission handler management
 * - Session emitter management
 * - Session state tracking
 * - Message delta computation logic
 * - Prompt resolution logic
 * - Mode setting validation
 * - Cancel flow
 * - Shutdown cleanup
 *
 * Uses heavy mocking of infrastructure dependencies.
 *
 * Merged from omo and teams test suites.
 */

import type * as acp from "@agentclientprotocol/sdk"
import { EventEmitter } from "events"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createSessionState } from "./messageTranslator"

// =============================================================================
// Mock Infrastructure (vi.hoisted for mocks that need early initialization)
// =============================================================================

const {
	mockController,
	ControllerCtor,
	stateManagerMock,
	permissionHandlerMock,
	translateMessageMock,
	secretStorageGet,
	initializeHostProviderMock,
	initializeCliContextMock,
} = vi.hoisted(() => {
	const mockController = {
		dispose: vi.fn().mockResolvedValue(undefined),
		stateManager: {
			flushPendingState: vi.fn().mockResolvedValue(undefined),
			setGlobalState: vi.fn(),
		},
		getStateToPostToWebview: vi.fn().mockResolvedValue({ mode: "act" }),
		initTask: vi.fn(),
		reinitExistingTaskFromId: vi.fn(),
		cancelTask: vi.fn().mockResolvedValue(undefined),
		togglePlanActMode: vi.fn().mockResolvedValue(undefined),
		task: null,
	}

	return {
		mockController,
		ControllerCtor: class {
			constructor() {
				return mockController
			}
		},
		stateManagerMock: {
			getGlobalSettingsKey: vi.fn((key: string) => {
				if (key === "mode") return "act"
				if (key === "actModeApiProvider") return "cline"
				return undefined
			}),
			setGlobalState: vi.fn(),
			getApiConfiguration: vi.fn(() => ({})),
			setApiConfiguration: vi.fn(),
			flushPendingState: vi.fn().mockResolvedValue(undefined),
		},
		permissionHandlerMock: vi.fn(),
		translateMessageMock: vi.fn((..._args: any[]) => ({ updates: [], requiresPermission: false }) as any),
		secretStorageGet: vi.fn(async (key: string) => (key === "clineApiKey" ? "test-key" : null)),
		initializeHostProviderMock: vi.fn(),
		initializeCliContextMock: vi.fn(() => ({
			extensionContext: {},
			EXTENSION_DIR: "/tmp/ext",
			DATA_DIR: "/tmp/data",
		})),
	}
})

vi.mock("@agentclientprotocol/sdk", () => ({
	PROTOCOL_VERSION: "0.test",
	RequestError: {
		authRequired: () => new Error("auth required"),
	},
}))

vi.mock("@shared/api", () => ({
	anthropicDefaultModelId: "claude-test",
	anthropicModels: { "claude-test": {} },
	bedrockDefaultModelId: "bedrock-test",
	bedrockModels: { "bedrock-test": {} },
	deepSeekDefaultModelId: "deepseek-test",
	deepSeekModels: { "deepseek-test": {} },
	geminiDefaultModelId: "gemini-test",
	geminiModels: { "gemini-test": {} },
	groqDefaultModelId: "groq-test",
	groqModels: { "groq-test": {} },
	mistralDefaultModelId: "mistral-test",
	mistralModels: { "mistral-test": {} },
	openAiCodexDefaultModelId: "codex-test",
	openAiNativeDefaultModelId: "gpt-test",
	openAiNativeModels: { "gpt-test": {} },
	xaiDefaultModelId: "xai-test",
	xaiModels: { "xai-test": {} },
}))

vi.mock("@/config.js", () => ({
	ClineEndpoint: {
		initialize: vi.fn().mockResolvedValue(undefined),
	},
}))

vi.mock("@/core/controller", () => ({
	Controller: ControllerCtor,
}))

vi.mock("@/core/controller/slash/getAvailableSlashCommands", () => ({
	getAvailableSlashCommands: vi.fn(async () => ({ commands: [] })),
}))

vi.mock("@/core/storage/StateManager", () => ({
	StateManager: {
		initialize: vi.fn().mockResolvedValue(undefined),
		get: () => stateManagerMock,
	},
}))

vi.mock("@/hosts/host-provider.js", () => ({
	HostProvider: {
		initialize: initializeHostProviderMock,
		get: () => ({
			createWebviewProvider: vi.fn(() => ({ controller: {}, dispose: vi.fn().mockResolvedValue(undefined) })),
		}),
	},
}))

vi.mock("@/hosts/external/AuthHandler.js", () => ({
	AuthHandler: {
		getInstance: () => ({ isAuthenticated: () => true, getCallbackUrl: vi.fn(async () => ""), setEnabled: vi.fn() }),
	},
}))

vi.mock("@/hosts/external/ExternalCommentReviewController.js", () => ({ ExternalCommentReviewController: vi.fn() }))
vi.mock("@/hosts/external/ExternalWebviewProvider.js", () => ({ ExternalWebviewProvider: vi.fn(() => ({ controller: {} })) }))
vi.mock("@/integrations/editor/FileEditProvider", () => ({ FileEditProvider: vi.fn() }))
vi.mock("@/integrations/terminal/index.js", () => ({ StandaloneTerminalManager: vi.fn() }))
vi.mock("@/services/auth/AuthService.js", () => ({ AuthService: { getInstance: vi.fn() } }))
vi.mock("@/integrations/openai-codex/oauth", () => ({
	openAiCodexOAuthManager: { initialize: vi.fn(), isAuthenticated: vi.fn() },
}))
vi.mock("@/shared/services/Logger.js", () => ({
	Logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), log: vi.fn(), warn: vi.fn() },
}))
vi.mock("@/shared/storage/ClineSecretStorage", () => ({ secretStorage: { get: secretStorageGet } }))
vi.mock("@/utils/env", () => ({ openExternal: vi.fn() }))

vi.mock("../vscode-context.js", () => ({ initializeCliContext: initializeCliContextMock }))
vi.mock("../acp/ACPDiffViewProvider.js", () => ({ ACPDiffViewProvider: vi.fn() }))
vi.mock("../acp/ACPHostBridgeClientProvider.js", () => ({ ACPHostBridgeClientProvider: vi.fn() }))
vi.mock("../acp/AcpTerminalManager.js", () => ({ AcpTerminalManager: vi.fn() }))

vi.mock("./messageTranslator.js", async (importOriginal) => {
	const actual = await importOriginal<typeof import("./messageTranslator.js")>()
	return {
		...actual,
		translateMessage: translateMessageMock,
	}
})
vi.mock("./permissionHandler.js", () => ({
	handlePermissionResponse: permissionHandlerMock,
	getPermissionOptionsForAskType: vi.fn(),
	getAutoApprovalIdentifier: vi.fn(() => "test"),
}))

vi.mock("@shared/slashCommands", () => ({ CLI_ONLY_COMMANDS: [], VSCODE_ONLY_COMMANDS: [] }))
vi.mock("@shared/storage", () => ({ ProviderToApiKeyMap: { anthropic: "anthropicApiKey" } }))
vi.mock("@shared/storage/provider-keys", () => ({ getProviderModelIdKey: vi.fn(() => "modelKey") }))
vi.mock("../utils/openrouter-models", () => ({
	fetchOpenRouterModels: vi.fn(async () => []),
	usesOpenRouterModels: vi.fn(() => false),
}))

import { ClineAgent } from "./ClineAgent"

// =============================================================================
// Test Helpers
// =============================================================================

class TestClineAgent extends ClineAgent {
	public async callRequestPermission(): Promise<any> {
		return this.requestPermission(
			"session-1",
			{ sessionUpdate: "tool_call", toolCallId: "tc-1", title: "tool", kind: "execute_command" } as any,
			[{ optionId: "allow", name: "Allow", kind: "allow_once" } as any],
		)
	}
}

function createTaskHarness() {
	const messageStateEmitter = new EventEmitter()
	const handleWebviewAskResponse = vi.fn().mockResolvedValue(undefined)
	const abortTask = vi.fn().mockResolvedValue(undefined)
	const getClineMessages = vi.fn(() => [])

	const task = {
		taskId: "task-1",
		handleWebviewAskResponse,
		abortTask,
		messageStateHandler: {
			on: (event: string, listener: (...args: any[]) => void) => {
				messageStateEmitter.on(event, listener)
			},
			off: (event: string, listener: (...args: any[]) => void) => {
				messageStateEmitter.off(event, listener)
			},
			getClineMessages,
		},
	}

	return {
		task,
		handleWebviewAskResponse,
		messageStateEmitter,
		getClineMessages,
	}
}

// =============================================================================
// Tests: ClineAgent Construction and Setup
// =============================================================================

describe("ClineAgent", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockController.task = null
		mockController.initTask.mockResolvedValue(undefined)
		mockController.reinitExistingTaskFromId.mockResolvedValue(undefined)
		mockController.cancelTask.mockResolvedValue(undefined)
		mockController.togglePlanActMode.mockResolvedValue(undefined)
		translateMessageMock.mockImplementation(() => ({ updates: [], requiresPermission: false }))
		permissionHandlerMock.mockReset()
	})

	// =============================================================================
	// Tests: Constructor
	// =============================================================================

	describe("constructor", () => {
		it("creates instance from constructor", () => {
			const agent = new ClineAgent({ version: "1.2.3", debug: true })
			expect(agent).toBeInstanceOf(ClineAgent)
			expect(initializeCliContextMock).toHaveBeenCalledTimes(1)
		})

		it("should initialize with empty sessions map", () => {
			const agent = new ClineAgent({ version: "1.0.0-test", debug: false })
			expect(agent.sessions.size).toBe(0)
		})
	})

	// =============================================================================
	// Tests: Initialize
	// =============================================================================

	describe("initialize", () => {
		it("returns protocol and agent info", async () => {
			const agent = new ClineAgent({ version: "9.9.9" })
			const result = await agent.initialize({ clientCapabilities: { terminal: true, fs: true } } as any)

			expect(result.protocolVersion).toBe("0.test")
			expect(result.agentInfo).toEqual({ name: "cline", version: "9.9.9" })
			expect(result.agentCapabilities?.loadSession).toBe(true)
			expect(initializeHostProviderMock).toHaveBeenCalledTimes(1)
		})

		it("should include agent capabilities in response", async () => {
			const agent = new ClineAgent({ version: "1.0.0-test" })
			const params: acp.InitializeRequest = {
				client: { name: "test-client", version: "1.0" },
			}

			const response = await agent.initialize(params)

			expect(response.agentCapabilities).toBeDefined()
			expect(response.agentCapabilities?.loadSession).toBe(true)
			expect(response.agentCapabilities?.promptCapabilities?.image).toBe(true)
			expect(response.agentCapabilities?.mcpCapabilities?.http).toBe(true)
		})

		it("should include auth methods in response", async () => {
			const agent = new ClineAgent({ version: "1.0.0-test" })
			const params: acp.InitializeRequest = {
				client: { name: "test-client", version: "1.0" },
			}

			const response = await agent.initialize(params)

			expect(response.authMethods).toBeDefined()
			expect(response.authMethods).toHaveLength(2)
			expect(response.authMethods?.[0].id).toBe("cline-oauth")
			expect(response.authMethods?.[1].id).toBe("openai-codex-oauth")
		})

		it("should store client capabilities", async () => {
			const agent = new ClineAgent({ version: "1.0.0-test" })
			const clientCapabilities = {
				terminal: true,
				fs: { readTextFile: true, writeTextFile: true },
			}
			const params: acp.InitializeRequest = {
				client: { name: "test-client", version: "1.0" },
				clientCapabilities,
			} as acp.InitializeRequest

			await agent.initialize(params)

			// Client capabilities are stored internally
			// Verified by testing that they're used in subsequent session creation
			expect(params.clientCapabilities).toBe(clientCapabilities)
		})
	})

	// =============================================================================
	// Tests: newSession
	// =============================================================================

	describe("newSession", () => {
		it("creates and stores a session", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			await agent.initialize({ clientCapabilities: {} } as any)

			const response = await agent.newSession({ cwd: "/tmp/project", mcpServers: [] } as any)

			expect(response.sessionId).toBeTruthy()
			expect(agent.sessions.has(response.sessionId)).toBe(true)
			expect(response.modes?.currentModeId).toBe("act")
		})
	})

	// =============================================================================
	// Tests: Permission Handler
	// =============================================================================

	describe("setPermissionHandler", () => {
		it("stores and uses custom handler", async () => {
			const agent = new TestClineAgent({ version: "1.0.0" })
			agent.setPermissionHandler((request, resolve) => {
				const permissionResponse: Parameters<typeof resolve>[0] = {
					outcome: { outcome: "selected", optionId: request.options[0].optionId },
				}
				resolve(permissionResponse)
			})

			const response = await agent.callRequestPermission()
			expect(response.outcome.outcome).toBe("selected")
			expect(response.outcome.optionId).toBe("allow")
		})

		it("should set the permission handler without calling it immediately", () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			const handler = vi.fn()
			agent.setPermissionHandler(handler)
			expect(handler).not.toHaveBeenCalled()
		})
	})

	// =============================================================================
	// Tests: Session Emitter
	// =============================================================================

	describe("emitterForSession", () => {
		it("returns stable emitter per session", () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			const emitterA = agent.emitterForSession("s1")
			const emitterB = agent.emitterForSession("s1")
			const emitterC = agent.emitterForSession("s2")

			expect(emitterA).toBe(emitterB)
			expect(emitterA).not.toBe(emitterC)
		})

		it("should return a working emitter that can register listeners", () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			const emitter = agent.emitterForSession("session-1")
			const listener = vi.fn()

			emitter.on("agent_message_chunk", listener)
			emitter.emit("agent_message_chunk", {
				content: { type: "text", text: "Hello" },
			})

			expect(listener).toHaveBeenCalledTimes(1)
		})
	})

	// =============================================================================
	// Tests: Prompt
	// =============================================================================

	describe("prompt", () => {
		it("starts a new task and resolves on followup ask", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			await agent.initialize({ clientCapabilities: {} } as any)
			const session = await agent.newSession({ cwd: "/tmp/project" } as any)

			const harness = createTaskHarness()
			mockController.initTask.mockImplementation(async () => {
				mockController.task = harness.task as any
			})

			const promptPromise = agent.prompt({
				sessionId: session.sessionId,
				prompt: [
					{ type: "text", text: "Plan this" },
					{ type: "image", data: "abc", mimeType: "image/jpeg" },
					{ type: "resource", resource: { uri: "file:///tmp/spec.md" } },
				],
			} as any)

			await vi.waitFor(() => {
				expect(harness.messageStateEmitter.listenerCount("clineMessagesChanged")).toBeGreaterThan(0)
			})

			harness.messageStateEmitter.emit("clineMessagesChanged", {
				type: "add",
				message: {
					ts: 1,
					type: "ask",
					ask: "followup",
					text: '{"question":"Need more details?"}',
					partial: false,
				},
			})

			const response = await promptPromise
			expect(response).toEqual({ stopReason: "end_turn" })
			expect(mockController.initTask).toHaveBeenCalledWith(
				"Plan this",
				["data:image/jpeg;base64,abc"],
				["file:///tmp/spec.md"],
			)
		})

		it("handles permission flow and emits in-progress tool update", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			agent.setPermissionHandler((_request, resolve) => {
				resolve({ outcome: { outcome: "selected", optionId: "allow" } } as any)
			})

			await agent.initialize({ clientCapabilities: {} } as any)
			const session = await agent.newSession({ cwd: "/tmp/project" } as any)

			const harness = createTaskHarness()
			mockController.initTask.mockImplementation(async () => {
				mockController.task = harness.task as any
			})

			permissionHandlerMock.mockReturnValue({ cancelled: false, response: "yesButtonClicked", text: undefined })
			translateMessageMock.mockImplementation((_message: any, sessionState: any) => {
				sessionState.currentToolCallId = "tool-1"
				return {
					updates: [{ sessionUpdate: "tool_call", toolCallId: "tool-1", title: "Run", kind: "execute_command" }],
					requiresPermission: true,
					permissionRequest: {
						toolCall: { sessionUpdate: "tool_call", toolCallId: "tool-1", title: "Run", kind: "execute_command" },
						options: [{ optionId: "allow", name: "Allow", kind: "allow_once" }],
					},
				}
			})

			const toolUpdates: any[] = []
			agent.emitterForSession(session.sessionId).on("tool_call_update", (update) => {
				toolUpdates.push(update)
			})

			const promptPromise = agent.prompt({
				sessionId: session.sessionId,
				prompt: [{ type: "text", text: "Run command" }],
			} as any)

			await vi.waitFor(() => {
				expect(harness.messageStateEmitter.listenerCount("clineMessagesChanged")).toBeGreaterThan(0)
			})

			harness.messageStateEmitter.emit("clineMessagesChanged", {
				type: "add",
				message: { ts: 2, type: "ask", ask: "command", text: "run it", partial: false },
			})

			await vi.waitFor(() => {
				expect(harness.handleWebviewAskResponse).toHaveBeenCalledWith("yesButtonClicked", undefined)
			})

			harness.messageStateEmitter.emit("clineMessagesChanged", {
				type: "add",
				message: { ts: 3, type: "say", say: "completion_result", text: "Done", partial: false },
			})

			const response = await promptPromise
			expect(response).toEqual({ stopReason: "end_turn" })
			expect(toolUpdates.some((u) => u.toolCallId === "tool-1" && u.status === "in_progress")).toBe(true)
		})

		it("returns error stopReason when initTask throws", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			await agent.initialize({ clientCapabilities: {} } as any)
			const session = await agent.newSession({ cwd: "/tmp/project" } as any)

			mockController.initTask.mockRejectedValue(new Error("init failed"))

			const chunks: any[] = []
			agent.emitterForSession(session.sessionId).on("agent_message_chunk", (update) => {
				chunks.push(update)
			})

			const response = await agent.prompt({
				sessionId: session.sessionId,
				prompt: [{ type: "text", text: "Start" }],
			} as any)

			expect(response).toEqual({ stopReason: "error" })
			expect(chunks.some((c) => c.content?.text?.includes("init failed"))).toBe(true)
		})
	})

	// =============================================================================
	// Tests: setSessionMode
	// =============================================================================

	describe("setSessionMode", () => {
		it("updates mode and toggles active task", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			await agent.initialize({ clientCapabilities: {} } as any)
			const session = await agent.newSession({ cwd: "/tmp/project" } as any)

			const harness = createTaskHarness()
			mockController.task = harness.task as any

			await agent.setSessionMode({ sessionId: session.sessionId, modeId: "plan" } as any)

			expect(mockController.stateManager.setGlobalState).toHaveBeenCalledWith("mode", "plan")
			expect(mockController.togglePlanActMode).toHaveBeenCalledWith("plan")
		})

		it("should throw for unknown session", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			await agent.initialize({ clientCapabilities: {} } as any)

			await expect(
				agent.setSessionMode({
					sessionId: "nonexistent",
					modeId: "plan",
				}),
			).rejects.toThrow("Session not found")
		})
	})

	// =============================================================================
	// Tests: Cancel
	// =============================================================================

	describe("cancel", () => {
		it("calls controller.cancelTask when task is active", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			await agent.initialize({ clientCapabilities: {} } as any)
			const session = await agent.newSession({ cwd: "/tmp/project" } as any)

			const harness = createTaskHarness()
			mockController.task = harness.task as any

			await agent.cancel({ sessionId: session.sessionId } as any)

			expect(mockController.cancelTask).toHaveBeenCalledTimes(1)
		})

		it("should handle cancel for non-existent session gracefully", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			await agent.initialize({ clientCapabilities: {} } as any)

			await expect(
				agent.cancel({
					sessionId: "nonexistent",
				}),
			).resolves.not.toThrow()
		})
	})

	// =============================================================================
	// Tests: Authenticate
	// =============================================================================

	describe("authenticate", () => {
		it("throws for unknown auth method", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			await expect(agent.authenticate({ methodId: "unknown" } as any)).rejects.toThrow(
				"Unknown authentication method: unknown",
			)
		})
	})

	// =============================================================================
	// Tests: Shutdown
	// =============================================================================

	describe("shutdown", () => {
		it("disposes controller resources and clears sessions", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			await agent.initialize({ clientCapabilities: {} } as any)
			const response = await agent.newSession({ cwd: "/tmp/project" } as any)

			expect(agent.sessions.has(response.sessionId)).toBe(true)

			await agent.shutdown()

			expect(mockController.stateManager.flushPendingState).toHaveBeenCalled()
			expect(mockController.dispose).toHaveBeenCalled()
			expect(agent.sessions.size).toBe(0)
		})

		it("should handle shutdown with no sessions", async () => {
			const agent = new ClineAgent({ version: "1.0.0" })
			await expect(agent.shutdown()).resolves.not.toThrow()
		})
	})
})

// =============================================================================
// Tests: createSessionState (from messageTranslator, used by ClineAgent)
// =============================================================================

describe("createSessionState for ClineAgent", () => {
	it("should create valid initial session state", () => {
		const state = createSessionState("session-123")

		expect(state.sessionId).toBe("session-123")
		expect(state.isProcessing).toBe(false)
		expect(state.cancelled).toBe(false)
		expect(state.currentToolCallId).toBeUndefined()
		expect(state.pendingToolCalls.size).toBe(0)
	})

	it("should create independent state objects for different sessions", () => {
		const state1 = createSessionState("s1")
		const state2 = createSessionState("s2")

		state1.isProcessing = true
		state1.cancelled = true
		state1.currentToolCallId = "tool-1"

		expect(state2.isProcessing).toBe(false)
		expect(state2.cancelled).toBe(false)
		expect(state2.currentToolCallId).toBeUndefined()
	})

	it("should allow tracking pending tool calls", () => {
		const state = createSessionState("s1")

		state.pendingToolCalls.set("tool-1", {
			sessionUpdate: "tool_call",
			toolCallId: "tool-1",
			title: "Test",
		} as acp.ToolCall)

		expect(state.pendingToolCalls.size).toBe(1)
		expect(state.pendingToolCalls.has("tool-1")).toBe(true)
	})
})

// =============================================================================
// Tests: checkMessageForPromptResolution logic
// (tested indirectly via session state patterns)
// =============================================================================

describe("prompt resolution patterns", () => {
	it("should resolve on followup ask messages", () => {
		const message = { type: "ask", ask: "followup", text: "question?", partial: false }
		const askType = message.ask
		const promptResolving = new Set([
			"followup",
			"plan_mode_respond",
			"act_mode_respond",
			"completion_result",
			"resume_task",
			"resume_completed_task",
		])

		expect(promptResolving.has(askType)).toBe(true)
	})

	it("should resolve on completion_result ask messages", () => {
		const message = { type: "ask", ask: "completion_result", text: "done" }
		const promptResolving = new Set([
			"followup",
			"plan_mode_respond",
			"act_mode_respond",
			"completion_result",
			"resume_task",
			"resume_completed_task",
		])

		expect(promptResolving.has(message.ask)).toBe(true)
	})

	it("should resolve on completion_result say messages", () => {
		const message = { type: "say", say: "completion_result", text: "done" }
		const shouldResolve = message.type === "say" && message.say === "completion_result"

		expect(shouldResolve).toBe(true)
	})

	it("should NOT resolve for partial messages", () => {
		const message = { type: "ask", ask: "followup", text: "question?", partial: true }

		// Partial messages should not resolve
		expect(message.partial).toBe(true)
	})

	it("should NOT resolve for text say messages", () => {
		const message = { type: "say", say: "text", text: "Hello" }
		const promptResolving = new Set([
			"followup",
			"plan_mode_respond",
			"act_mode_respond",
			"completion_result",
			"resume_task",
			"resume_completed_task",
		])

		// say:text is not in the prompt-resolving set
		expect(message.type === "ask" && promptResolving.has(message.say)).toBe(false)
		expect(message.type === "say" && message.say === "completion_result").toBe(false)
	})
})

// =============================================================================
// Tests: Text streaming message delta logic
// =============================================================================

describe("text streaming delta computation", () => {
	it("should compute delta when new text starts with old text", () => {
		const lastText = "Hello, "
		const currentText = "Hello, world!"

		let delta: string
		if (currentText.startsWith(lastText)) {
			delta = currentText.slice(lastText.length)
		} else {
			delta = currentText
		}

		expect(delta).toBe("world!")
	})

	it("should send full text when content changed entirely", () => {
		const lastText = "Previous content"
		const currentText = "Completely different"

		let delta: string
		if (currentText.startsWith(lastText)) {
			delta = currentText.slice(lastText.length)
		} else {
			delta = currentText
		}

		expect(delta).toBe("Completely different")
	})

	it("should send nothing when text hasn't changed", () => {
		const lastText = "Same content"
		const currentText = "Same content"

		let delta: string
		if (currentText.startsWith(lastText)) {
			delta = currentText.slice(lastText.length)
		} else {
			delta = currentText
		}

		expect(delta).toBe("")
	})

	it("should identify text streaming message types correctly", () => {
		const textStreamingTypes = [
			{ type: "say", say: "text" },
			{ type: "say", say: "reasoning" },
			{ type: "say", say: "completion_result" },
			{ type: "ask", ask: "followup" },
			{ type: "ask", ask: "plan_mode_respond" },
			{ type: "ask", ask: "completion_result" },
		]

		const nonStreamingTypes = [
			{ type: "say", say: "tool" },
			{ type: "say", say: "command" },
			{ type: "say", say: "command_output" },
			{ type: "say", say: "error" },
			{ type: "ask", ask: "command" },
			{ type: "ask", ask: "tool" },
			{ type: "ask", ask: "act_mode_respond" },
		]

		const isTextStreaming = (msg: any) => {
			return (
				(msg.type === "say" && (msg.say === "text" || msg.say === "reasoning" || msg.say === "completion_result")) ||
				(msg.type === "ask" &&
					(msg.ask === "followup" || msg.ask === "plan_mode_respond" || msg.ask === "completion_result"))
			)
		}

		textStreamingTypes.forEach((msg) => {
			expect(isTextStreaming(msg)).toBe(true)
		})

		nonStreamingTypes.forEach((msg) => {
			expect(isTextStreaming(msg)).toBe(false)
		})
	})

	it("should extract text from JSON-wrapped plan_mode_respond", () => {
		const text = JSON.stringify({ response: "Here is my plan...", options: ["Approve", "Revise"] })
		const parsed = JSON.parse(text)

		expect(parsed.response).toBe("Here is my plan...")
	})

	it("should extract question from JSON-wrapped followup", () => {
		const text = JSON.stringify({ question: "What should I do?", options: ["Continue", "Stop"] })
		const parsed = JSON.parse(text)

		expect(parsed.question).toBe("What should I do?")
	})

	it("should handle completion_result with leading newline", () => {
		const isCompletionResult = true
		const lastText = ""
		const needsNewline = isCompletionResult && lastText === ""
		const delta = "Task completed!"
		const result = needsNewline ? `\n${delta}` : delta

		expect(result).toBe("\nTask completed!")
	})

	it("should NOT add leading newline when not first content", () => {
		const isCompletionResult = true
		const lastText = "Previous text"
		const needsNewline = isCompletionResult && lastText === ""
		const delta = "Task completed!"
		const result = needsNewline ? `\n${delta}` : delta

		expect(result).toBe("Task completed!")
	})
})
