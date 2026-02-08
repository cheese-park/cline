import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockUseLastCompletedAskMessage, mockUseTaskController, mockExit } = vi.hoisted(() => ({
	mockUseLastCompletedAskMessage: vi.fn(() => null),
	mockUseTaskController: vi.fn(() => null),
	mockExit: vi.fn(),
}))

const mockHandleWebviewAskResponse = vi.fn()
const mockTogglePlanActMode = vi.fn()

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
	useTaskController: mockUseTaskController,
}))
vi.mock("../hooks/useTerminalSize", () => ({ useTerminalSize: () => ({ columns: 80, rows: 24, resizeKey: 0 }) }))
vi.mock("../hooks/useStateSubscriber", () => ({
	useIsSpinnerActive: vi.fn(() => ({ isActive: false, startTime: null })),
	useProcessedMessages: vi.fn(() => []),
	useCompletedAskMessages: vi.fn(() => []),
	useLastCompletedAskMessage: mockUseLastCompletedAskMessage,
	useCompletionSignals: vi.fn(() => ({ isComplete: false })),
}))

vi.mock("ink", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ink")>()
	return {
		...actual,
		useApp: () => ({ exit: mockExit }),
	}
})

vi.mock("../utils/input", () => ({ isMouseEscapeSequence: vi.fn(() => false) }))
vi.mock("../utils/parser", () => ({
	jsonParseSafe: vi.fn((text: string, fallback: any) => {
		try {
			return JSON.parse(text)
		} catch {
			return fallback
		}
	}),
}))

import { AskPrompt } from "./AskPrompt"

describe("AskPrompt", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUseTaskController.mockReturnValue({
			task: {
				handleWebviewAskResponse: mockHandleWebviewAskResponse,
			},
			togglePlanActMode: mockTogglePlanActMode,
		})
	})

	it("should return null when no ask message", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce(null)
		const { lastFrame } = render(<AskPrompt />)
		expect(lastFrame()).toBe("")
	})

	it("renders followup prompt", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({ type: "ask", ask: "followup", text: "{}", ts: 1 })
		const { lastFrame } = render(<AskPrompt />)
		expect(lastFrame()).toContain("Reply")
	})

	it("renders command approval prompt", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({ type: "ask", ask: "command", text: "run it", ts: 2 })
		const { lastFrame } = render(<AskPrompt />)
		expect(lastFrame()).toContain("Execute this command?")
	})

	it("renders completion prompt", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({ type: "ask", ask: "completion_result", text: "done", ts: 3 })
		const { lastFrame } = render(<AskPrompt />)
		expect(lastFrame()).toContain("Follow-up")
	})

	it("renders plan mode options prompt", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({
			type: "ask",
			ask: "plan_mode_respond",
			text: '{"options":["yes","no"]}',
			ts: 4,
		})
		const { lastFrame } = render(<AskPrompt />)
		expect(lastFrame()).toContain("Select an option")
	})

	it("should render tool confirmation prompt", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({
			type: "ask",
			ask: "tool",
			ts: 1,
			text: "some tool",
		})
		const { lastFrame } = render(<AskPrompt />)
		expect(lastFrame()).toContain("Use this tool?")
		expect(lastFrame()).toContain("(y/n)")
	})

	it("should render resume task prompt", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({
			type: "ask",
			ask: "resume_task",
			ts: 1,
			text: "",
		})
		const { lastFrame } = render(<AskPrompt />)
		expect(lastFrame()).toContain("Resume task?")
		expect(lastFrame()).toContain("(y/n)")
	})

	it("should render browser action launch prompt", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({
			type: "ask",
			ask: "browser_action_launch",
			ts: 1,
			text: "",
		})
		const { lastFrame } = render(<AskPrompt />)
		expect(lastFrame()).toContain("Launch browser?")
		expect(lastFrame()).toContain("(y/n)")
	})

	it("should render MCP server prompt", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({
			type: "ask",
			ask: "use_mcp_server",
			ts: 1,
			text: "",
		})
		const { lastFrame } = render(<AskPrompt />)
		expect(lastFrame()).toContain("Use MCP server?")
		expect(lastFrame()).toContain("(y/n)")
	})

	it("should render plan_mode_respond prompt", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({
			type: "ask",
			ask: "plan_mode_respond",
			ts: 1,
			text: "",
		})
		const { lastFrame } = render(<AskPrompt />)
		expect(lastFrame()).toContain("Reply:")
		expect(lastFrame()).toContain("Enter to switch to Act mode")
	})

	it("should send yesButtonClicked on 'y' for confirmation", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({
			type: "ask",
			ask: "command",
			ts: 1,
			text: "",
		})

		const { stdin } = render(<AskPrompt />)
		stdin.write("y")
		expect(mockHandleWebviewAskResponse).toHaveBeenCalledWith("yesButtonClicked", undefined)
	})

	it("should send noButtonClicked on 'n' for confirmation", () => {
		mockUseLastCompletedAskMessage.mockReturnValueOnce({
			type: "ask",
			ask: "command",
			ts: 1,
			text: "",
		})

		const { stdin } = render(<AskPrompt />)
		stdin.write("n")
		expect(mockHandleWebviewAskResponse).toHaveBeenCalledWith("noButtonClicked", undefined)
	})
})
