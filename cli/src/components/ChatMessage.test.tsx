/**
 * Tests for ChatMessage component
 * Covers: message types, tool rendering, formatting, ChatMessageList
 */

import type { ClineMessage } from "@shared/ExtensionMessage"
import { Box, Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockParseToolFromMessage, mockJsonParseSafe } = vi.hoisted(() => ({
	mockParseToolFromMessage: vi.fn(() => null),
	mockJsonParseSafe: vi.fn((text: string, fallback: any) => {
		try {
			return JSON.parse(text)
		} catch {
			return fallback
		}
	}),
}))

vi.mock("@shared/proto/cline/common", () => ({
	EmptyRequest: { create: (d: any) => d || {} },
	StringRequest: { create: (d: any) => d || {} },
}))
vi.mock("@shared/proto/cline/slash", () => ({ SlashCommandInfo: {} }))
vi.mock("@shared/storage", () => ({
	getProviderDefaultModelId: () => "test-model",
	getProviderModelIdKey: () => "actModeApiModelId",
	ProviderToApiKeyMap: {},
}))
vi.mock("@shared/api", () => ({ anthropicDefaultModelId: "claude-sonnet-4-20250514" }))
vi.mock("@/core/storage/StateManager", () => ({
	StateManager: {
		get: () => ({
			getGlobalSettingsKey: vi.fn(() => null),
			setGlobalState: vi.fn(),
			getApiConfiguration: vi.fn(() => ({})),
			getRemoteConfigSettings: vi.fn(() => undefined),
			setApiConfiguration: vi.fn(),
			flushPendingState: vi.fn(),
		}),
	},
}))
vi.mock("@/core/controller", () => ({ Controller: vi.fn() }))
vi.mock("@/shared/services/Logger", () => ({ Logger: { log: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock("../vscode-shim", () => ({ shutdownEvent: { event: vi.fn(() => ({ dispose: vi.fn() })) } }))
vi.mock("../context/StdinContext", () => ({ useStdinContext: () => ({ isRawModeSupported: true }) }))
vi.mock("../context/TaskContext", () => ({
	useTaskState: vi.fn(() => ({ clineMessages: [], mode: "act" })),
	useTaskContext: vi.fn(() => ({ controller: null })),
	useTaskController: vi.fn(() => null),
}))
vi.mock("../hooks/useTerminalSize", () => ({ useTerminalSize: () => ({ columns: 80, rows: 24, resizeKey: 0 }) }))
vi.mock("../hooks/useStateSubscriber", () => ({
	useIsSpinnerActive: vi.fn(() => ({ isActive: false, startTime: null })),
	useProcessedMessages: vi.fn(() => []),
	useCompletedAskMessages: vi.fn(() => []),
	useLastCompletedAskMessage: vi.fn(() => null),
	useCompletionSignals: vi.fn(() => ({ isComplete: false })),
}))

vi.mock("@shared/ClineAccount", () => ({ CLINE_ACCOUNT_AUTH_ERROR_MESSAGE: "AUTH_ERROR" }))
vi.mock("@shared/combineCommandSequences", () => ({ COMMAND_OUTPUT_STRING: "\n<command_output>\n" }))
vi.mock("../utils/parser", () => ({ jsonParseSafe: mockJsonParseSafe }))
vi.mock("../utils/tools", () => ({
	parseToolFromMessage: mockParseToolFromMessage,
	isFileEditTool: vi.fn((toolName: string) => {
		return ["write_to_file", "replace_in_file", "editedExistingFile", "newFileCreated"].includes(toolName)
	}),
	getToolDescription: vi.fn((toolName: string) => {
		const descriptions: Record<string, { ask: string; say: string }> = {
			read_file: { ask: "wants to read this file", say: "read this file" },
			write_to_file: { ask: "wants to create a new file", say: "created a new file" },
			execute_command: { ask: "wants to execute this command", say: "executed this command" },
		}
		return descriptions[toolName] || { ask: "wants to use a tool", say: "used a tool" }
	}),
}))
vi.mock("./DiffView", () => ({
	DiffView: ({ filePath, content }: { filePath?: string; content?: string }) =>
		React.createElement(Text, null, `DiffView: ${filePath} (${content?.length || 0} chars)`),
}))

// Helper to create a ClineMessage
function msg(overrides: Partial<ClineMessage>): ClineMessage {
	return {
		ts: Date.now(),
		type: "say",
		...overrides,
	} as ClineMessage
}

import { ChatMessage, ChatMessageList } from "./ChatMessage"

describe("ChatMessage", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders text message", () => {
		const { lastFrame } = render(
			<ChatMessage message={{ type: "say", say: "text", text: "hello from assistant", ts: 1 } as any} />,
		)
		expect(lastFrame()).toContain("hello from assistant")
	})

	it("renders tool message", () => {
		mockParseToolFromMessage.mockReturnValueOnce({
			toolName: "read_file",
			args: { path: "src/file.ts" },
			result: "line one\nline two",
		})
		const { lastFrame } = render(<ChatMessage message={{ type: "ask", ask: "tool", text: "tool payload", ts: 2 } as any} />)
		const frame = lastFrame() || ""
		expect(frame).toContain("Cline wants to read this file")
		expect(frame).toContain("src/file.ts")
		expect(frame).toContain("line one")
	})

	it("renders error message", () => {
		const { lastFrame } = render(
			<ChatMessage message={{ type: "say", say: "error", text: '{"message":"Something failed"}', ts: 3 } as any} />,
		)
		const frame = lastFrame() || ""
		expect(frame).toContain("Error")
		expect(frame).toContain("Something failed")
	})

	it("renders completion_result", () => {
		const { lastFrame } = render(
			<ChatMessage message={{ type: "say", say: "completion_result", text: "All done", ts: 4 } as any} />,
		)
		const frame = lastFrame() || ""
		expect(frame).toContain("Task completed")
		expect(frame).toContain("All done")
	})

	describe("User messages (say: task / user_feedback)", () => {
		it("should render user task message with > prefix", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "task", text: "Hello world" })} />)
			expect(lastFrame()).toContain("> Hello world")
		})

		it("should render user feedback message with > prefix", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "user_feedback", text: "Fix the bug" })} />)
			expect(lastFrame()).toContain("> Fix the bug")
		})

		it("should handle empty text for task messages", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "task", text: "" })} />)
			expect(lastFrame()).toContain(">")
		})
	})

	describe("Assistant text messages (say: text)", () => {
		it("should render assistant text with dot prefix", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "text", text: "Here is my response" })} />)
			expect(lastFrame()).toContain("Here is my response")
		})

		it("should return null for empty text messages", () => {
			const { lastFrame } = render(
				<Box>
					<ChatMessage message={msg({ say: "text", text: "" })} />
					<Text>sentinel</Text>
				</Box>,
			)
			expect(lastFrame()).toContain("sentinel")
		})

		it("should return null for whitespace-only text messages", () => {
			const { lastFrame } = render(
				<Box>
					<ChatMessage message={msg({ say: "text", text: "   " })} />
					<Text>sentinel</Text>
				</Box>,
			)
			expect(lastFrame()).toContain("sentinel")
		})
	})

	describe("Reasoning messages (say: reasoning)", () => {
		it("should return null for reasoning messages", () => {
			const { lastFrame } = render(
				<Box>
					<ChatMessage message={msg({ say: "reasoning", text: "Thinking about this..." })} />
					<Text>sentinel</Text>
				</Box>,
			)
			expect(lastFrame()).toContain("sentinel")
			expect(lastFrame()).not.toContain("Thinking about this")
		})
	})

	describe("Tool messages (ask: tool / say: tool)", () => {
		it("should render tool ask with 'wants to' description", () => {
			mockParseToolFromMessage.mockReturnValueOnce({
				toolName: "read_file",
				args: { path: "/src/main.ts" },
				result: null,
			})
			const toolText = JSON.stringify({ tool: "read_file", path: "/src/main.ts" })
			const { lastFrame } = render(<ChatMessage message={msg({ type: "ask", ask: "tool", text: toolText })} />)
			expect(lastFrame()).toContain("wants to read this file")
			expect(lastFrame()).toContain("/src/main.ts")
		})

		it("should render tool say with past tense description", () => {
			mockParseToolFromMessage.mockReturnValueOnce({
				toolName: "read_file",
				args: { path: "/src/main.ts" },
				result: null,
			})
			const toolText = JSON.stringify({ tool: "read_file", path: "/src/main.ts" })
			const { lastFrame } = render(<ChatMessage message={msg({ say: "tool", text: toolText })} />)
			expect(lastFrame()).toContain("read this file")
			expect(lastFrame()).toContain("/src/main.ts")
		})

		it("should render file edit tool with DiffView", () => {
			mockParseToolFromMessage.mockReturnValueOnce({
				toolName: "write_to_file",
				args: { path: "/src/new.ts", content: "console.log('hello')" },
				result: null,
			})
			const toolText = JSON.stringify({
				tool: "write_to_file",
				path: "/src/new.ts",
				content: "console.log('hello')",
			})
			const { lastFrame } = render(<ChatMessage message={msg({ say: "tool", text: toolText })} />)
			expect(lastFrame()).toContain("DiffView")
		})

		it("should render tool result content", () => {
			mockParseToolFromMessage.mockReturnValueOnce({
				toolName: "read_file",
				args: { path: "/src/main.ts" },
				result: "file contents here",
			})
			const toolText = JSON.stringify({
				tool: "read_file",
				path: "/src/main.ts",
				content: "file contents here",
			})
			const { lastFrame } = render(<ChatMessage message={msg({ say: "tool", text: toolText })} />)
			expect(lastFrame()).toContain("file contents here")
		})

		it("should show fallback for unparseable tool say messages", () => {
			mockParseToolFromMessage.mockReturnValueOnce(null)
			const { lastFrame } = render(<ChatMessage message={msg({ say: "tool", text: "not json at all" })} />)
			expect(lastFrame()).toContain("not json at all")
		})
	})

	describe("Command messages", () => {
		it("should render command ask with 'wants to execute' label", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ type: "ask", ask: "command", text: "npm test" })} />)
			expect(lastFrame()).toContain("Cline wants to execute this command")
			expect(lastFrame()).toContain("npm test")
		})

		it("should render command say with 'executed' label", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "command", text: "ls -la" })} />)
			expect(lastFrame()).toContain("Cline executed this command")
			expect(lastFrame()).toContain("ls -la")
		})

		it("should parse command output from combined text", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ say: "command", text: "ls -la\nOutput:\nfile1.ts\nfile2.ts" })} />,
			)
			expect(lastFrame()).toContain("ls -la")
			expect(lastFrame()).toContain("file1.ts")
		})

		it("should return null for command with no text", () => {
			const { lastFrame } = render(
				<Box>
					<ChatMessage message={msg({ say: "command", text: undefined })} />
					<Text>sentinel</Text>
				</Box>,
			)
			expect(lastFrame()).not.toContain("Cline executed")
		})
	})

	describe("Command output messages", () => {
		it("should render command_output with result rows", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "command_output", text: "line1\nline2\nline3" })} />)
			expect(lastFrame()).toContain("line1")
		})
	})

	describe("MCP messages", () => {
		it("should render MCP ask with tool name", () => {
			const mcpText = JSON.stringify({
				type: "use_mcp_tool",
				serverName: "test-server",
				toolName: "get_data",
				arguments: "{}",
			})
			const { lastFrame } = render(<ChatMessage message={msg({ type: "ask", ask: "use_mcp_server", text: mcpText })} />)
			expect(lastFrame()).toContain("Cline wants to use MCP")
			expect(lastFrame()).toContain("test-server")
			expect(lastFrame()).toContain("tool: get_data")
		})

		it("should render MCP say with used label", () => {
			const mcpText = JSON.stringify({
				type: "use_mcp_tool",
				serverName: "test-server",
				toolName: "search",
			})
			const { lastFrame } = render(<ChatMessage message={msg({ say: "use_mcp_server", text: mcpText })} />)
			expect(lastFrame()).toContain("Cline used MCP")
			expect(lastFrame()).toContain("test-server")
		})

		it("should render MCP resource access", () => {
			const mcpText = JSON.stringify({
				type: "access_mcp_resource",
				serverName: "test-server",
				uri: "resource://data",
			})
			const { lastFrame } = render(<ChatMessage message={msg({ type: "ask", ask: "use_mcp_server", text: mcpText })} />)
			expect(lastFrame()).toContain("resource: resource://data")
		})

		it("should render MCP arguments", () => {
			const mcpText = JSON.stringify({
				type: "use_mcp_tool",
				serverName: "srv",
				toolName: "tool1",
				arguments: JSON.stringify({ key: "value" }),
			})
			const { lastFrame } = render(<ChatMessage message={msg({ type: "ask", ask: "use_mcp_server", text: mcpText })} />)
			expect(lastFrame()).toContain("args:")
		})

		it("should render MCP response", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ say: "mcp_server_response", text: "Response data here" })} />,
			)
			expect(lastFrame()).toContain("MCP response")
			expect(lastFrame()).toContain("Response data here")
		})

		it("should render MCP notification", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "mcp_notification", text: "Server connected" })} />)
			expect(lastFrame()).toContain("MCP Notification")
			expect(lastFrame()).toContain("Server connected")
		})

		it("should render MCP server request started", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "mcp_server_request_started", text: "fetching" })} />)
			expect(lastFrame()).toContain("Cline is using an MCP tool")
			expect(lastFrame()).toContain("fetching")
		})
	})

	describe("Error messages", () => {
		it("should render error say message", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "error", text: "Something went wrong" })} />)
			expect(lastFrame()).toContain("Error")
			expect(lastFrame()).toContain("Something went wrong")
		})

		it("should render api_req_failed ask as error", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ type: "ask", ask: "api_req_failed", text: "Rate limited" })} />,
			)
			expect(lastFrame()).toContain("Error")
			expect(lastFrame()).toContain("Rate limited")
		})

		it("should parse JSON error messages", () => {
			const errorText = JSON.stringify({ message: "Detailed error info" })
			const { lastFrame } = render(<ChatMessage message={msg({ say: "error", text: errorText })} />)
			expect(lastFrame()).toContain("Detailed error info")
		})

		it("should show sign-in instructions for auth errors", () => {
			const { lastFrame } = render(
				<ChatMessage
					message={msg({
						say: "error",
						text: "AUTH_ERROR: Please sign in to Cline before trying again.",
					})}
				/>,
			)
			expect(lastFrame()).toContain("/settings")
		})

		it("should render clineignore error", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "clineignore_error", text: "/secret/file.txt" })} />)
			expect(lastFrame()).toContain("blocked by the .clineignore file")
			expect(lastFrame()).toContain("/secret/file.txt")
		})
	})

	describe("Error retry messages", () => {
		it("should render retrying state", () => {
			const retryText = JSON.stringify({
				failed: false,
				attempt: 2,
				maxAttempts: 3,
				errorMessage: "Timeout",
			})
			const { lastFrame } = render(<ChatMessage message={msg({ say: "error_retry", text: retryText })} />)
			expect(lastFrame()).toContain("Retrying")
			expect(lastFrame()).toContain("2/3")
		})

		it("should render failed state after max retries", () => {
			const retryText = JSON.stringify({
				failed: true,
				attempt: 3,
				maxAttempts: 3,
				errorMessage: "Connection refused",
			})
			const { lastFrame } = render(<ChatMessage message={msg({ say: "error_retry", text: retryText })} />)
			expect(lastFrame()).toContain("Failed")
			expect(lastFrame()).toContain("3 retries")
		})
	})

	describe("Completion result messages", () => {
		it("should render completion result with green styling", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ say: "completion_result", text: "Task done successfully" })} />,
			)
			expect(lastFrame()).toContain("Task completed")
			expect(lastFrame()).toContain("Task done successfully")
		})

		it("should render completion result ask with text", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ type: "ask", ask: "completion_result", text: "Completed" })} />,
			)
			expect(lastFrame()).toContain("Task completed")
		})

		it("should not render completion result ask without text", () => {
			const { lastFrame } = render(
				<Box>
					<ChatMessage message={msg({ type: "ask", ask: "completion_result", text: undefined })} />
					<Text>sentinel</Text>
				</Box>,
			)
			expect(lastFrame()).not.toContain("Task completed")
		})
	})

	describe("API request messages", () => {
		it("should return null for api_req_started", () => {
			const { lastFrame } = render(
				<Box>
					<ChatMessage message={msg({ say: "api_req_started", text: '{"cost": 0.01}' })} />
					<Text>sentinel</Text>
				</Box>,
			)
			expect(lastFrame()).toContain("sentinel")
			expect(lastFrame()).not.toContain("cost")
		})
	})

	describe("Browser action messages", () => {
		it("should render browser_action message", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "browser_action", text: "click button" })} />)
			expect(lastFrame()).toContain("Cline used the browser")
			expect(lastFrame()).toContain("click button")
		})

		it("should render browser_action_launch message", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ say: "browser_action_launch", text: "http://localhost:3000" })} />,
			)
			expect(lastFrame()).toContain("Cline used the browser")
			expect(lastFrame()).toContain("http://localhost:3000")
		})
	})

	describe("Info messages", () => {
		it("should render info messages in gray", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ say: "info", text: "Some info" })} />)
			expect(lastFrame()).toContain("Some info")
		})
	})

	describe("Followup questions", () => {
		it("should render followup question with options", () => {
			const followupText = JSON.stringify({
				question: "Which option do you prefer?",
				options: ["Option A", "Option B", "Option C"],
			})
			const { lastFrame } = render(<ChatMessage message={msg({ type: "ask", ask: "followup", text: followupText })} />)
			expect(lastFrame()).toContain("Which option do you prefer?")
			expect(lastFrame()).toContain("Option A")
			expect(lastFrame()).toContain("Option B")
			expect(lastFrame()).toContain("Option C")
		})

		it("should show selected option with checkmark", () => {
			const followupText = JSON.stringify({
				question: "Pick one",
				options: ["A", "B"],
				selected: "A",
			})
			const { lastFrame } = render(<ChatMessage message={msg({ type: "ask", ask: "followup", text: followupText })} />)
			expect(lastFrame()).toContain("\u2713")
		})
	})

	describe("Act mode respond", () => {
		it("should render act mode response", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ type: "ask", ask: "act_mode_respond", text: "Progress update" })} />,
			)
			expect(lastFrame()).toContain("Progress update")
		})
	})

	describe("Plan mode respond", () => {
		it("should render plan mode response", () => {
			const planText = JSON.stringify({ response: "Here is the plan" })
			const { lastFrame } = render(<ChatMessage message={msg({ type: "ask", ask: "plan_mode_respond", text: planText })} />)
			expect(lastFrame()).toContain("Here is the plan")
		})
	})

	describe("Mistake limit reached", () => {
		it("should render mistake limit message", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ type: "ask", ask: "mistake_limit_reached", text: "Too many mistakes" })} />,
			)
			expect(lastFrame()).toContain("Error")
			expect(lastFrame()).toContain("Too many mistakes")
		})

		it("should show default text when no text provided", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ type: "ask", ask: "mistake_limit_reached" })} />)
			expect(lastFrame()).toContain("Mistake limit reached")
		})
	})

	describe("New task request", () => {
		it("should render new task request", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ type: "ask", ask: "new_task", text: "Refactor this module" })} />,
			)
			expect(lastFrame()).toContain("Cline wants to start a new task")
			expect(lastFrame()).toContain("Refactor this module")
		})
	})

	describe("Condense conversation", () => {
		it("should render condense request", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ type: "ask", ask: "condense", text: "Summary of conversation" })} />,
			)
			expect(lastFrame()).toContain("Cline wants to condense your conversation")
			expect(lastFrame()).toContain("Summary of conversation")
		})
	})

	describe("Summarize task", () => {
		it("should render summarize request", () => {
			const { lastFrame } = render(
				<ChatMessage message={msg({ type: "ask", ask: "summarize_task", text: "Task summary" })} />,
			)
			expect(lastFrame()).toContain("Cline wants to summarize the task")
			expect(lastFrame()).toContain("Task summary")
		})
	})

	describe("Report bug", () => {
		it("should render report bug request", () => {
			const { lastFrame } = render(<ChatMessage message={msg({ type: "ask", ask: "report_bug", text: "Bug details" })} />)
			expect(lastFrame()).toContain("Cline wants to create a Github issue")
			expect(lastFrame()).toContain("Bug details")
		})
	})

	describe("Mode-dependent coloring", () => {
		it("should use plan mode color (yellow) for tool calls in plan mode", () => {
			mockParseToolFromMessage.mockReturnValueOnce({
				toolName: "read_file",
				args: { path: "/file.ts" },
				result: null,
			})
			const toolText = JSON.stringify({ tool: "read_file", path: "/file.ts" })
			const { lastFrame } = render(<ChatMessage message={msg({ say: "tool", text: toolText })} mode="plan" />)
			expect(lastFrame()).toContain("Cline")
		})

		it("should use act mode color for tool calls in act mode", () => {
			mockParseToolFromMessage.mockReturnValueOnce({
				toolName: "read_file",
				args: { path: "/file.ts" },
				result: null,
			})
			const toolText = JSON.stringify({ tool: "read_file", path: "/file.ts" })
			const { lastFrame } = render(<ChatMessage message={msg({ say: "tool", text: toolText })} mode="act" />)
			expect(lastFrame()).toContain("Cline")
		})
	})

	describe("Unrecognized messages", () => {
		it("should return null for unrecognized say types", () => {
			const { lastFrame } = render(
				<Box>
					<ChatMessage message={msg({ say: "api_req_finished" as any })} />
					<Text>sentinel</Text>
				</Box>,
			)
			expect(lastFrame()).toContain("sentinel")
		})
	})
})

describe("ChatMessageList", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should render a list of messages", () => {
		const messages: ClineMessage[] = [
			msg({ ts: 1, say: "task", text: "Hello" }),
			msg({ ts: 2, say: "text", text: "Response" }),
		]
		const { lastFrame } = render(<ChatMessageList messages={messages} />)
		expect(lastFrame()).toContain("> Hello")
		expect(lastFrame()).toContain("Response")
	})

	it("should filter out api_req_finished messages", () => {
		const messages: ClineMessage[] = [
			msg({ ts: 1, say: "task", text: "Hello" }),
			msg({ ts: 2, say: "api_req_finished" as any }),
			msg({ ts: 3, say: "text", text: "Response" }),
		]
		const { lastFrame } = render(<ChatMessageList messages={messages} />)
		expect(lastFrame()).toContain("> Hello")
		expect(lastFrame()).toContain("Response")
	})

	it("should filter out empty text messages", () => {
		const messages: ClineMessage[] = [
			msg({ ts: 1, say: "task", text: "Hello" }),
			msg({ ts: 2, say: "text", text: "" }),
			msg({ ts: 3, say: "text", text: "Visible" }),
		]
		const { lastFrame } = render(<ChatMessageList messages={messages} />)
		expect(lastFrame()).toContain("Visible")
	})

	it("should filter out checkpoint_created messages", () => {
		const messages: ClineMessage[] = [
			msg({ ts: 1, say: "task", text: "Hello" }),
			msg({ ts: 2, say: "checkpoint_created" as any }),
			msg({ ts: 3, say: "text", text: "After checkpoint" }),
		]
		const { lastFrame } = render(<ChatMessageList messages={messages} />)
		expect(lastFrame()).toContain("After checkpoint")
	})

	it("should limit messages when maxMessages is set", () => {
		const messages: ClineMessage[] = [
			msg({ ts: 1, say: "text", text: "Old message" }),
			msg({ ts: 2, say: "text", text: "New message" }),
		]
		const { lastFrame } = render(<ChatMessageList maxMessages={1} messages={messages} />)
		expect(lastFrame()).not.toContain("Old message")
		expect(lastFrame()).toContain("New message")
	})

	it("should handle empty messages array", () => {
		const { lastFrame } = render(<ChatMessageList messages={[]} />)
		expect(lastFrame()).toBeDefined()
	})
})
