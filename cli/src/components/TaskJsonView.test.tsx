import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockUseTaskState, mockUseTaskContext, mockUseCompletionSignals, mockConsoleLog } = vi.hoisted(() => ({
	mockUseTaskState: vi.fn(() => ({ clineMessages: [] })),
	mockUseTaskContext: vi.fn(() => ({ setIsComplete: vi.fn() })),
	mockUseCompletionSignals: vi.fn(() => ({ isTaskComplete: () => false, getCompletionMessage: () => null })),
	mockConsoleLog: vi.fn(),
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
	useTaskState: mockUseTaskState,
	useTaskContext: mockUseTaskContext,
	useTaskController: vi.fn(() => null),
}))
vi.mock("../hooks/useTerminalSize", () => ({ useTerminalSize: () => ({ columns: 80, rows: 24, resizeKey: 0 }) }))
vi.mock("../hooks/useStateSubscriber", () => ({
	useIsSpinnerActive: vi.fn(() => ({ isActive: false, startTime: null })),
	useProcessedMessages: vi.fn(() => []),
	useCompletedAskMessages: vi.fn(() => []),
	useLastCompletedAskMessage: vi.fn(() => null),
	useCompletionSignals: mockUseCompletionSignals,
}))
vi.mock("../utils/console", () => ({ originalConsoleLog: mockConsoleLog }))

import { useTaskState } from "../context/TaskContext"
import { TaskJsonView } from "./TaskJsonView"

describe("TaskJsonView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUseTaskState.mockReturnValue({ clineMessages: [] })
		mockUseCompletionSignals.mockReturnValue({ isTaskComplete: () => false, getCompletionMessage: () => null })
	})

	it("renders without crashing", () => {
		const { lastFrame } = render(<TaskJsonView />)
		expect(lastFrame()).toBe("")
	})

	it("renders JSON output for a regular message", () => {
		mockUseTaskState.mockReturnValue({ clineMessages: [{ ts: 1, type: "say", say: "text", text: "hello" }] })
		render(<TaskJsonView />)
		expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"type":"message"'))
		expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"text":"hello"'))
	})

	it("filters api request noise in non-verbose mode", () => {
		mockUseTaskState.mockReturnValue({ clineMessages: [{ ts: 2, type: "say", say: "api_req_started", text: "start" }] })
		render(<TaskJsonView verbose={false} />)
		expect(mockConsoleLog).not.toHaveBeenCalled()
	})

	it("emits completion output", () => {
		mockUseCompletionSignals.mockReturnValue({
			isTaskComplete: () => true,
			getCompletionMessage: () => ({ type: "say", say: "completion_result" }),
		})
		render(<TaskJsonView onComplete={vi.fn()} />)
		expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('"type":"completion"'))
	})

	it("assigns user role to first text message", () => {
		vi.mocked(useTaskState).mockReturnValue({
			clineMessages: [{ type: "say", say: "text", ts: 1000, text: "User task" }],
			mode: "act",
		} as any)

		render(<TaskJsonView />)

		const callArg = mockConsoleLog.mock.calls[0]?.[0]
		if (callArg) {
			const parsed = JSON.parse(callArg)
			expect(parsed.role).toBe("user")
		}
	})

	it("assigns system role to api_req_started", () => {
		vi.mocked(useTaskState).mockReturnValue({
			clineMessages: [{ type: "say", say: "api_req_started", ts: 1000, text: '{"cost": 0.01}' }],
			mode: "act",
		} as any)

		render(<TaskJsonView verbose={true} />)

		const callArg = mockConsoleLog.mock.calls[0]?.[0]
		if (callArg) {
			const parsed = JSON.parse(callArg)
			expect(parsed.role).toBe("system")
		}
	})

	it("includes api_req messages in verbose mode", () => {
		vi.mocked(useTaskState).mockReturnValue({
			clineMessages: [
				{ type: "say", say: "api_req_started", ts: 1000, text: "{}" },
				{ type: "say", say: "text", ts: 2000, text: "Hello" },
			],
			mode: "act",
		} as any)

		render(<TaskJsonView verbose={true} />)

		expect(mockConsoleLog).toHaveBeenCalledTimes(2)
	})

	it("skips partial messages", () => {
		vi.mocked(useTaskState).mockReturnValue({
			clineMessages: [{ type: "say", say: "text", ts: 1000, text: "partial...", partial: true }],
			mode: "act",
		} as any)

		render(<TaskJsonView />)

		expect(mockConsoleLog).not.toHaveBeenCalled()
	})

	it("assigns user role to user_feedback messages", () => {
		vi.mocked(useTaskState).mockReturnValue({
			clineMessages: [
				{ type: "say", say: "text", ts: 1000, text: "task" },
				{ type: "say", say: "user_feedback", ts: 2000, text: "looks good" },
			],
			mode: "act",
		} as any)

		render(<TaskJsonView />)

		if (mockConsoleLog.mock.calls.length > 1) {
			const parsed = JSON.parse(mockConsoleLog.mock.calls[1][0])
			expect(parsed.role).toBe("user")
		}
	})

	it("does not duplicate messages on re-render", () => {
		vi.mocked(useTaskState).mockReturnValue({
			clineMessages: [{ type: "say", say: "text", ts: 1000, text: "Hello" }],
			mode: "act",
		} as any)

		const { rerender } = render(<TaskJsonView />)
		const initialCount = mockConsoleLog.mock.calls.length

		// Re-render with same messages
		rerender(<TaskJsonView />)
		expect(mockConsoleLog.mock.calls.length).toBe(initialCount)
	})
})
