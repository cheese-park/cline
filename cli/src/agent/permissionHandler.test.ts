/**
 * Tests for permissionHandler.ts
 *
 * Tests the permission handling module for ACP integration, including:
 * - Permission option mapping for different ClineAsk types
 * - Permission response translation to Cline format
 * - Auto-approval tracking
 * - Permission request creation
 * - Permission request processing with auto-approval
 * - Auto-approval identifier extraction
 * - Session state updates after permission handling
 *
 * Merged from omo and teams test suites.
 *
 * @see messageTranslator.test.ts for ACP schema validation patterns
 */

import type * as acp from "@agentclientprotocol/sdk"
import type { ClineAsk } from "@shared/ExtensionMessage"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	AutoApprovalTracker,
	createPermissionRequest,
	getAutoApprovalIdentifier,
	getPermissionOptionsForAskType,
	handlePermissionResponse,
	processPermissionRequest,
	requiresPermission,
	updateSessionStateAfterPermission,
} from "./permissionHandler"
import type { AcpSessionState } from "./types"

// =============================================================================
// Mock Infrastructure
// =============================================================================

vi.mock("@/shared/services/Logger.js", () => ({
	Logger: { error: vi.fn(), debug: vi.fn(), log: vi.fn() },
}))

// =============================================================================
// Schema Validation Helpers (following messageTranslator.test.ts pattern)
// =============================================================================

const VALID_PERMISSION_OPTION_KINDS: acp.PermissionOptionKind[] = ["allow_once", "allow_always", "reject_once", "reject_always"]

function assertValidPermissionOption(option: acp.PermissionOption): void {
	expect(VALID_PERMISSION_OPTION_KINDS).toContain(option.kind)
	expect(option.optionId).toBeDefined()
	expect(typeof option.optionId).toBe("string")
	expect(option.name).toBeDefined()
	expect(typeof option.name).toBe("string")
}

// =============================================================================
// Test Helpers
// =============================================================================

function createTestSessionState(sessionId = "test-session"): AcpSessionState {
	return {
		sessionId,
		isProcessing: false,
		cancelled: false,
		pendingToolCalls: new Map(),
		currentToolCallId: undefined,
	}
}

function createToolCall(overrides?: Partial<acp.ToolCall>): acp.ToolCall {
	return {
		sessionUpdate: "tool_call",
		toolCallId: "tool-1",
		title: "test title",
		status: "pending",
		kind: "execute",
		rawInput: {},
		...overrides,
	} as acp.ToolCall
}

function permissionResponse(optionId: string): acp.RequestPermissionResponse {
	return {
		outcome: {
			outcome: "selected",
			optionId,
		},
	} as acp.RequestPermissionResponse
}

function cancelledResponse(): acp.RequestPermissionResponse {
	return {
		outcome: {
			outcome: "cancelled",
		},
	} as acp.RequestPermissionResponse
}

// =============================================================================
// Tests: requiresPermission
// =============================================================================

describe("requiresPermission", () => {
	const permissionRequiringTypes: ClineAsk[] = ["command", "tool", "browser_action_launch", "use_mcp_server", "command_output"]

	const nonPermissionTypes: ClineAsk[] = [
		"followup",
		"plan_mode_respond",
		"completion_result",
		"resume_task",
		"resume_completed_task",
	]

	permissionRequiringTypes.forEach((askType) => {
		it(`should return true for "${askType}"`, () => {
			expect(requiresPermission(askType)).toBe(true)
		})
	})

	nonPermissionTypes.forEach((askType) => {
		it(`should return false for "${askType}"`, () => {
			expect(requiresPermission(askType)).toBe(false)
		})
	})
})

// =============================================================================
// Tests: getPermissionOptionsForAskType
// =============================================================================

describe("getPermissionOptionsForAskType", () => {
	describe("standard permission options (with always allow)", () => {
		const standardTypes: ClineAsk[] = ["command", "tool", "use_mcp_server"]

		standardTypes.forEach((askType) => {
			it(`should return 3 options for "${askType}" including allow_always`, () => {
				const options = getPermissionOptionsForAskType(askType)

				expect(options).toBeDefined()
				expect(options).toHaveLength(3)
				options?.forEach(assertValidPermissionOption)

				const kinds = options?.map((o) => o.kind)
				expect(kinds).toContain("allow_once")
				expect(kinds).toContain("allow_always")
				expect(kinds).toContain("reject_once")
			})

			it(`should have correct optionId values for "${askType}"`, () => {
				const options = getPermissionOptionsForAskType(askType)
				expect(options?.map((opt) => opt.optionId)).toEqual(["allow_once", "allow_always", "reject_once"])
			})
		})
	})

	describe("restricted permission options (without always allow)", () => {
		const restrictedTypes: ClineAsk[] = ["browser_action_launch", "command_output"]

		restrictedTypes.forEach((askType) => {
			it(`should return 2 options for "${askType}" without allow_always`, () => {
				const options = getPermissionOptionsForAskType(askType)

				expect(options).toBeDefined()
				expect(options).toHaveLength(2)
				options?.forEach(assertValidPermissionOption)

				const kinds = options?.map((o) => o.kind)
				expect(kinds).toContain("allow_once")
				expect(kinds).not.toContain("allow_always")
				expect(kinds).toContain("reject_once")
			})
		})
	})

	describe("non-permission types", () => {
		it("should return undefined for followup", () => {
			expect(getPermissionOptionsForAskType("followup")).toBeUndefined()
		})

		it("should return undefined for plan_mode_respond", () => {
			expect(getPermissionOptionsForAskType("plan_mode_respond")).toBeUndefined()
		})

		it("should return undefined for completion_result", () => {
			expect(getPermissionOptionsForAskType("completion_result")).toBeUndefined()
		})
	})
})

// =============================================================================
// Tests: handlePermissionResponse
// =============================================================================

describe("handlePermissionResponse", () => {
	it("should handle cancelled outcome as noButtonClicked + cancelled", () => {
		expect(handlePermissionResponse(cancelledResponse(), "tool")).toEqual({
			response: "noButtonClicked",
			cancelled: true,
		})
	})

	it("should handle allow_once response", () => {
		const response: acp.RequestPermissionResponse = {
			outcome: { outcome: "selected", optionId: "allow_once" } as unknown as acp.RequestPermissionOutcome,
		}

		const result = handlePermissionResponse(response, "command")

		expect(result.response).toBe("yesButtonClicked")
		expect(result.alwaysAllow).toBe(false)
		expect(result.cancelled).toBeUndefined()
	})

	it("should map allow_once to yesButtonClicked with alwaysAllow false", () => {
		expect(handlePermissionResponse(permissionResponse("allow_once"), "tool")).toEqual({
			response: "yesButtonClicked",
			alwaysAllow: false,
		})
	})

	it("should handle allow_always response", () => {
		const response: acp.RequestPermissionResponse = {
			outcome: { outcome: "selected", optionId: "allow_always" } as unknown as acp.RequestPermissionOutcome,
		}

		const result = handlePermissionResponse(response, "tool")

		expect(result.response).toBe("yesButtonClicked")
		expect(result.alwaysAllow).toBe(true)
	})

	it("should map allow_always to yesButtonClicked with alwaysAllow true", () => {
		expect(handlePermissionResponse(permissionResponse("allow_always"), "command")).toEqual({
			response: "yesButtonClicked",
			alwaysAllow: true,
		})
	})

	it("should handle reject_once response", () => {
		const response: acp.RequestPermissionResponse = {
			outcome: { outcome: "selected", optionId: "reject_once" } as unknown as acp.RequestPermissionOutcome,
		}

		const result = handlePermissionResponse(response, "command")

		expect(result.response).toBe("noButtonClicked")
		expect(result.alwaysAllow).toBe(false)
	})

	it("should handle reject_always response", () => {
		const response: acp.RequestPermissionResponse = {
			outcome: { outcome: "selected", optionId: "reject_always" } as unknown as acp.RequestPermissionOutcome,
		}

		const result = handlePermissionResponse(response, "command")

		expect(result.response).toBe("noButtonClicked")
		expect(result.alwaysAllow).toBe(false)
	})

	it("should handle unknown optionId as rejection for safety", () => {
		expect(handlePermissionResponse(permissionResponse("not_real_option"), "tool")).toEqual({
			response: "noButtonClicked",
		})
	})
})

// =============================================================================
// Tests: createPermissionRequest
// =============================================================================

describe("createPermissionRequest", () => {
	it("should create permission request for command ask type", () => {
		const toolCall = createToolCall({ kind: "execute", title: "Execute: npm install" })

		const request = createPermissionRequest(toolCall, "command")

		expect(request).not.toBeNull()
		expect(request?.toolCall).toBe(toolCall)
		expect(request?.options).toHaveLength(3)
		request?.options.forEach(assertValidPermissionOption)
	})

	it("returns toolCall + options for permission types", () => {
		const toolCall = createToolCall({ toolCallId: "tool-a" })
		const result = createPermissionRequest(toolCall, "tool")

		expect(result).not.toBeNull()
		expect(result?.toolCall.toolCallId).toBe("tool-a")
		expect(result?.options).toHaveLength(3)
	})

	it("should create restricted permission request for browser_action_launch", () => {
		const toolCall = createToolCall({ kind: "execute", title: "Launch browser" })

		const request = createPermissionRequest(toolCall, "browser_action_launch")

		expect(request).not.toBeNull()
		expect(request?.options).toHaveLength(2)
		expect(request?.options.map((o) => o.kind)).not.toContain("allow_always")
	})

	it("should return null for non-permission ask types", () => {
		const toolCall = createToolCall()

		expect(createPermissionRequest(toolCall, "followup")).toBeNull()
		expect(createPermissionRequest(toolCall, "plan_mode_respond")).toBeNull()
		expect(createPermissionRequest(toolCall, "completion_result")).toBeNull()
	})
})

// =============================================================================
// Tests: AutoApprovalTracker
// =============================================================================

describe("AutoApprovalTracker", () => {
	let tracker: AutoApprovalTracker

	beforeEach(() => {
		tracker = new AutoApprovalTracker()
	})

	describe("command auto-approval", () => {
		it("should track command auto-approval by prefix", () => {
			tracker.recordAlwaysAllow("command", "npm install express")

			expect(tracker.isAutoApproved("command", "npm install express")).toBe(true)
			expect(tracker.isAutoApproved("command", "npm run build")).toBe(true) // Same prefix "npm"
			expect(tracker.isAutoApproved("command", "yarn install")).toBe(false)
		})

		it("should auto-approve by first word of command", () => {
			tracker.recordAlwaysAllow("command", "git commit -m 'msg'")

			expect(tracker.isAutoApproved("command", "git push")).toBe(true) // Same prefix "git"
			expect(tracker.isAutoApproved("command", "npm test")).toBe(false)
		})

		it("records and checks command approvals using first word prefix", () => {
			tracker.recordAlwaysAllow("command", "npm install")

			expect(tracker.isAutoApproved("command", "npm run test")).toBe(true)
			expect(tracker.isAutoApproved("command", "pnpm install")).toBe(false)
		})
	})

	describe("tool auto-approval", () => {
		it("should track tool auto-approval by name", () => {
			tracker.recordAlwaysAllow("tool", "editedExistingFile")

			expect(tracker.isAutoApproved("tool", "editedExistingFile")).toBe(true)
			expect(tracker.isAutoApproved("tool", "readFile")).toBe(false)
		})

		it("records and checks tool approvals", () => {
			tracker.recordAlwaysAllow("tool", "readFile")

			expect(tracker.isAutoApproved("tool", "readFile")).toBe(true)
			expect(tracker.isAutoApproved("tool", "writeToFile")).toBe(false)
		})
	})

	describe("MCP server auto-approval", () => {
		it("should track MCP server auto-approval", () => {
			tracker.recordAlwaysAllow("use_mcp_server", "database-server")

			expect(tracker.isAutoApproved("use_mcp_server", "database-server")).toBe(true)
			expect(tracker.isAutoApproved("use_mcp_server", "other-server")).toBe(false)
		})

		it("records and checks MCP server approvals", () => {
			tracker.recordAlwaysAllow("use_mcp_server", "weather-server")

			expect(tracker.isAutoApproved("use_mcp_server", "weather-server")).toBe(true)
			expect(tracker.isAutoApproved("use_mcp_server", "database-server")).toBe(false)
		})
	})

	describe("non-auto-approvable types", () => {
		it("should return false for browser_action_launch", () => {
			expect(tracker.isAutoApproved("browser_action_launch", "anything")).toBe(false)
		})

		it("should return false for followup", () => {
			expect(tracker.isAutoApproved("followup", "anything")).toBe(false)
		})

		it("returns false for unknown ask types", () => {
			expect(tracker.isAutoApproved("followup", "anything")).toBe(false)
		})
	})

	describe("clear", () => {
		it("should clear all auto-approval records", () => {
			tracker.recordAlwaysAllow("command", "npm install")
			tracker.recordAlwaysAllow("tool", "readFile")
			tracker.recordAlwaysAllow("use_mcp_server", "db-server")

			tracker.clear()

			expect(tracker.isAutoApproved("command", "npm install")).toBe(false)
			expect(tracker.isAutoApproved("tool", "readFile")).toBe(false)
			expect(tracker.isAutoApproved("use_mcp_server", "db-server")).toBe(false)
		})

		it("clear resets all approval records including extended checks", () => {
			tracker.recordAlwaysAllow("command", "npm install")
			tracker.recordAlwaysAllow("tool", "readFile")
			tracker.recordAlwaysAllow("use_mcp_server", "weather-server")
			tracker.clear()

			expect(tracker.isAutoApproved("command", "npm run build")).toBe(false)
			expect(tracker.isAutoApproved("tool", "readFile")).toBe(false)
			expect(tracker.isAutoApproved("use_mcp_server", "weather-server")).toBe(false)
		})
	})
})

// =============================================================================
// Tests: processPermissionRequest
// =============================================================================

describe("processPermissionRequest", () => {
	let mockRequestPermission: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.clearAllMocks()
		mockRequestPermission = vi.fn()
	})

	it("should auto-approve when tracker has approval recorded", async () => {
		const tracker = new AutoApprovalTracker()
		tracker.recordAlwaysAllow("command", "npm test")

		const toolCall = createToolCall({ rawInput: { command: "npm test" } })

		const result = await processPermissionRequest(
			mockRequestPermission,
			"session-1",
			toolCall,
			"command",
			"npm test",
			tracker,
		)

		expect(result.response).toBe("yesButtonClicked")
		expect(result.alwaysAllow).toBe(true)
		expect(mockRequestPermission).not.toHaveBeenCalled()
	})

	it("returns immediate yes when operation is already auto-approved", async () => {
		const tracker = new AutoApprovalTracker()
		tracker.recordAlwaysAllow("tool", "readFile")

		const result = await processPermissionRequest(
			mockRequestPermission,
			"session-1",
			createToolCall(),
			"tool",
			"readFile",
			tracker,
		)

		expect(result).toEqual({ response: "yesButtonClicked", alwaysAllow: true })
		expect(mockRequestPermission).not.toHaveBeenCalled()
	})

	it("should request permission when not auto-approved", async () => {
		mockRequestPermission.mockResolvedValue({
			outcome: { outcome: "selected", optionId: "allow_once" },
		})

		const toolCall = createToolCall()

		const result = await processPermissionRequest(mockRequestPermission, "session-1", toolCall, "command", "npm test")

		expect(mockRequestPermission).toHaveBeenCalledWith("session-1", toolCall, expect.any(Array))
		expect(result.response).toBe("yesButtonClicked")
		expect(result.alwaysAllow).toBe(false)
	})

	it("calls requestPermission and translates allow_once response", async () => {
		const requestPermission = vi.fn(async () => permissionResponse("allow_once"))

		const result = await processPermissionRequest(requestPermission, "session-1", createToolCall(), "command", "npm install")

		expect(requestPermission).toHaveBeenCalledTimes(1)
		expect(result).toEqual({ response: "yesButtonClicked", alwaysAllow: false })
	})

	it("should record always-allow decisions in tracker", async () => {
		const tracker = new AutoApprovalTracker()
		mockRequestPermission.mockResolvedValue({
			outcome: { outcome: "selected", optionId: "allow_always" },
		})

		const toolCall = createToolCall()

		await processPermissionRequest(mockRequestPermission, "session-1", toolCall, "command", "npm test", tracker)

		expect(tracker.isAutoApproved("command", "npm test")).toBe(true)
	})

	it("tracks always allow decisions in tracker for MCP servers", async () => {
		const tracker = new AutoApprovalTracker()
		const requestPermission = vi.fn(async () => permissionResponse("allow_always"))

		const result = await processPermissionRequest(
			requestPermission,
			"session-1",
			createToolCall(),
			"use_mcp_server",
			"weather-server",
			tracker,
		)

		expect(result).toEqual({ response: "yesButtonClicked", alwaysAllow: true })
		expect(tracker.isAutoApproved("use_mcp_server", "weather-server")).toBe(true)
	})

	it("should allow by default for non-permission ask types", async () => {
		const toolCall = createToolCall()

		const result = await processPermissionRequest(mockRequestPermission, "session-1", toolCall, "followup", "question")

		expect(result.response).toBe("yesButtonClicked")
		expect(mockRequestPermission).not.toHaveBeenCalled()
	})

	it("returns yes when ask type has no permission options", async () => {
		const result = await processPermissionRequest(mockRequestPermission, "session-1", createToolCall(), "followup", "ignored")

		expect(result).toEqual({ response: "yesButtonClicked" })
		expect(mockRequestPermission).not.toHaveBeenCalled()
	})

	it("should handle cancelled response", async () => {
		mockRequestPermission.mockResolvedValue({
			outcome: { outcome: "cancelled" },
		})

		const toolCall = createToolCall()

		const result = await processPermissionRequest(mockRequestPermission, "session-1", toolCall, "command", "rm -rf /")

		expect(result.response).toBe("noButtonClicked")
		expect(result.cancelled).toBe(true)
	})
})

// =============================================================================
// Tests: getAutoApprovalIdentifier
// =============================================================================

describe("getAutoApprovalIdentifier", () => {
	it("should extract command from rawInput for command ask type", () => {
		const toolCall = createToolCall({
			rawInput: { command: "npm install express" },
			title: "Execute: npm install express",
		})

		expect(getAutoApprovalIdentifier(toolCall, "command")).toBe("npm install express")
	})

	it("uses rawInput.command for command ask type", () => {
		const toolCall = createToolCall({ rawInput: { command: "npm test" }, title: "fallback title" })
		expect(getAutoApprovalIdentifier(toolCall, "command")).toBe("npm test")
	})

	it("should fall back to title for command if rawInput missing", () => {
		const toolCall = createToolCall({
			title: "Execute: npm install",
		})

		expect(getAutoApprovalIdentifier(toolCall, "command")).toBe("Execute: npm install")
	})

	it("falls back to title when rawInput field is missing", () => {
		const toolCall = createToolCall({ title: "fallback title" })
		expect(getAutoApprovalIdentifier(toolCall, "command")).toBe("fallback title")
	})

	it("should extract tool name from rawInput for tool ask type", () => {
		const toolCall = createToolCall({
			rawInput: { tool: "editedExistingFile" },
			title: "Edit file: /src/app.ts",
		})

		expect(getAutoApprovalIdentifier(toolCall, "tool")).toBe("editedExistingFile")
	})

	it("uses rawInput.tool for tool ask type", () => {
		const toolCall = createToolCall({ rawInput: { tool: "readFile" }, title: "fallback title" })
		expect(getAutoApprovalIdentifier(toolCall, "tool")).toBe("readFile")
	})

	it("should extract serverName from rawInput for use_mcp_server ask type", () => {
		const toolCall = createToolCall({
			rawInput: { serverName: "database-server" },
			title: "MCP: database-server",
		})

		expect(getAutoApprovalIdentifier(toolCall, "use_mcp_server")).toBe("database-server")
	})

	it("uses rawInput.serverName for use_mcp_server ask type", () => {
		const toolCall = createToolCall({ rawInput: { serverName: "weather-server" }, title: "fallback title" })
		expect(getAutoApprovalIdentifier(toolCall, "use_mcp_server")).toBe("weather-server")
	})

	it("should return toolCallId for unknown ask types", () => {
		const toolCall = createToolCall({
			toolCallId: "unique-tool-call-id",
		})

		expect(getAutoApprovalIdentifier(toolCall, "followup")).toBe("unique-tool-call-id")
	})

	it("uses toolCallId for unknown ask types", () => {
		const toolCall = createToolCall({ toolCallId: "tool-abc" })
		expect(getAutoApprovalIdentifier(toolCall, "followup")).toBe("tool-abc")
	})
})

// =============================================================================
// Tests: updateSessionStateAfterPermission
// =============================================================================

describe("updateSessionStateAfterPermission", () => {
	it("should remove tool call from pending map", () => {
		const state = createTestSessionState()
		state.pendingToolCalls.set("tool-123", createToolCall())

		updateSessionStateAfterPermission(state, "tool-123", true)

		expect(state.pendingToolCalls.has("tool-123")).toBe(false)
	})

	it("removes handled tool call from pendingToolCalls", () => {
		const sessionState: AcpSessionState = {
			sessionId: "session-1",
			isProcessing: false,
			cancelled: false,
			currentToolCallId: "tool-a",
			pendingToolCalls: new Map<string, acp.ToolCall>([
				["tool-a", createToolCall({ toolCallId: "tool-a" })],
				["tool-b", createToolCall({ toolCallId: "tool-b" })],
			]),
		}

		updateSessionStateAfterPermission(sessionState, "tool-a", true)

		expect(sessionState.pendingToolCalls.has("tool-a")).toBe(false)
		expect(sessionState.pendingToolCalls.has("tool-b")).toBe(true)
	})

	it("should clear currentToolCallId when rejected and matches", () => {
		const state = createTestSessionState()
		state.currentToolCallId = "tool-123"
		state.pendingToolCalls.set("tool-123", createToolCall())

		updateSessionStateAfterPermission(state, "tool-123", false)

		expect(state.currentToolCallId).toBeUndefined()
		expect(state.pendingToolCalls.has("tool-123")).toBe(false)
	})

	it("clears currentToolCallId when rejected and ids match", () => {
		const sessionState: AcpSessionState = {
			sessionId: "session-1",
			isProcessing: false,
			cancelled: false,
			currentToolCallId: "tool-a",
			pendingToolCalls: new Map<string, acp.ToolCall>([["tool-a", createToolCall({ toolCallId: "tool-a" })]]),
		}

		updateSessionStateAfterPermission(sessionState, "tool-a", false)

		expect(sessionState.currentToolCallId).toBeUndefined()
	})

	it("should NOT clear currentToolCallId when approved", () => {
		const state = createTestSessionState()
		state.currentToolCallId = "tool-123"
		state.pendingToolCalls.set("tool-123", createToolCall())

		updateSessionStateAfterPermission(state, "tool-123", true)

		expect(state.currentToolCallId).toBe("tool-123")
	})

	it("should NOT clear currentToolCallId when it does not match", () => {
		const state = createTestSessionState()
		state.currentToolCallId = "other-tool"
		state.pendingToolCalls.set("tool-123", createToolCall())

		updateSessionStateAfterPermission(state, "tool-123", false)

		expect(state.currentToolCallId).toBe("other-tool")
	})

	it("should handle case when tool call is not in pending map", () => {
		const state = createTestSessionState()

		// Should not throw
		updateSessionStateAfterPermission(state, "nonexistent", true)

		expect(state.pendingToolCalls.size).toBe(0)
	})
})
