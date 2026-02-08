import { render } from "ink-testing-library"
import { describe, expect, it, vi } from "vitest"

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

vi.mock("../utils/tools", () => ({
	parseToolFromMessage: vi.fn((text: string) => (text ? { toolName: "write_to_file" } : { toolName: "read_file" })),
	isFileSaveTool: vi.fn((toolName: string) => toolName === "write_to_file"),
}))

import { ActionButtons, type ButtonConfig, getButtonConfig, getVisibleButtons } from "./ActionButtons"

describe("getButtonConfig", () => {
	it("should return default config when no message", () => {
		const config = getButtonConfig(undefined)
		expect(config.enableButtons).toBe(false)
		expect(config.sendingDisabled).toBe(false)
	})

	it("should return api_req_failed config", () => {
		const message = { type: "ask" as const, ask: "api_req_failed" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.primaryText).toBe("Retry")
		expect(config.secondaryText).toBe("Start New Task")
		expect(config.enableButtons).toBe(true)
	})

	it("should return mistake_limit_reached config", () => {
		const message = { type: "ask" as const, ask: "mistake_limit_reached" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.primaryText).toBe("Proceed Anyways")
		expect(config.secondaryText).toBe("Start New Task")
	})

	it("should return tool_approve config for tool ask", () => {
		const message = { type: "ask" as const, ask: "tool" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.primaryText).toBe("Approve")
		expect(config.secondaryText).toBe("Reject")
	})

	it("should return command config", () => {
		const message = { type: "ask" as const, ask: "command" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.primaryText).toBe("Run Command")
		expect(config.secondaryText).toBe("Reject")
	})

	it("returns command_output config from getButtonConfig", () => {
		const config = getButtonConfig({ type: "ask", ask: "command_output" } as any)
		expect(config.enableButtons).toBe(true)
		expect(config.primaryText).toBe("Proceed While Running")
	})

	it("should return command_output config", () => {
		const message = { type: "ask" as const, ask: "command_output" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.primaryText).toBe("Proceed While Running")
		expect(config.secondaryText).toBeUndefined()
	})

	it("should return command_output config even while streaming", () => {
		const message = { type: "ask" as const, ask: "command_output" as const, ts: 1, text: "" }
		const config = getButtonConfig(message, true)
		expect(config.primaryText).toBe("Proceed While Running")
	})

	it("should return partial config while streaming", () => {
		const message = { type: "ask" as const, ask: "tool" as const, ts: 1, text: "" }
		const config = getButtonConfig(message, true)
		expect(config.secondaryText).toBe("Cancel")
		expect(config.sendingDisabled).toBe(true)
	})

	it("should not return partial for error states while streaming", () => {
		const message = { type: "ask" as const, ask: "api_req_failed" as const, ts: 1, text: "" }
		const config = getButtonConfig(message, true)
		expect(config.primaryText).toBe("Retry")
	})

	it("should return completion_result config", () => {
		const message = { type: "ask" as const, ask: "completion_result" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.primaryText).toBe("Start New Task")
		expect(config.secondaryText).toBe("Exit")
	})

	it("should return resume_task config", () => {
		const message = { type: "ask" as const, ask: "resume_task" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.primaryText).toBe("Resume Task")
		expect(config.secondaryText).toBe("Exit")
	})

	it("should return api_req_active config for api_req_started say", () => {
		const message = { type: "say" as const, say: "api_req_started" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.secondaryText).toBe("Cancel")
		expect(config.sendingDisabled).toBe(true)
	})

	it("should return followup config (no buttons)", () => {
		const message = { type: "ask" as const, ask: "followup" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.enableButtons).toBe(false)
	})

	it("should return browser_action_launch config", () => {
		const message = { type: "ask" as const, ask: "browser_action_launch" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.primaryText).toBe("Approve")
		expect(config.secondaryText).toBe("Reject")
	})

	it("should return use_mcp_server config", () => {
		const message = { type: "ask" as const, ask: "use_mcp_server" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.primaryText).toBe("Approve")
	})

	it("should return new_task config", () => {
		const message = { type: "ask" as const, ask: "new_task" as const, ts: 1, text: "" }
		const config = getButtonConfig(message)
		expect(config.primaryText).toBe("Start New Task with Context")
	})

	it("returns tool save config for file-save tool", () => {
		const config = getButtonConfig({ type: "ask", ask: "tool", text: "tool payload" } as any)
		expect(config.primaryText).toBe("Save")
		expect(config.secondaryText).toBe("Reject")
	})
})

describe("getVisibleButtons", () => {
	it("should return both buttons when both have text", () => {
		const config: ButtonConfig = {
			sendingDisabled: false,
			enableButtons: true,
			primaryText: "Approve",
			secondaryText: "Reject",
			primaryAction: "approve",
			secondaryAction: "reject",
		}
		const { hasPrimary, hasSecondary } = getVisibleButtons(config)
		expect(hasPrimary).toBe(true)
		expect(hasSecondary).toBe(true)
	})

	it("should hide cancel buttons", () => {
		const config: ButtonConfig = {
			sendingDisabled: true,
			enableButtons: true,
			primaryText: undefined,
			secondaryText: "Cancel",
			primaryAction: undefined,
			secondaryAction: "cancel",
		}
		const { hasPrimary, hasSecondary } = getVisibleButtons(config)
		expect(hasPrimary).toBe(false)
		expect(hasSecondary).toBe(false)
	})

	it("should return no buttons when text is undefined", () => {
		const config: ButtonConfig = {
			sendingDisabled: false,
			enableButtons: true,
			primaryText: undefined,
			secondaryText: undefined,
		}
		const { hasPrimary, hasSecondary } = getVisibleButtons(config)
		expect(hasPrimary).toBe(false)
		expect(hasSecondary).toBe(false)
	})
})

describe("ActionButtons", () => {
	it("renders without crashing with two buttons", () => {
		const { lastFrame } = render(
			<ActionButtons
				config={{
					enableButtons: true,
					sendingDisabled: false,
					primaryText: "Approve",
					secondaryText: "Reject",
					primaryAction: "approve",
					secondaryAction: "reject",
				}}
			/>,
		)
		const frame = lastFrame() || ""
		expect(frame).toContain("Approve")
		expect(frame).toContain("Reject")
	})

	it("hides output when buttons are disabled", () => {
		const { lastFrame } = render(
			<ActionButtons
				config={{
					enableButtons: false,
					sendingDisabled: false,
				}}
			/>,
		)
		expect(lastFrame()).toBe("")
	})

	it("should return null when enableButtons is false", () => {
		const config: ButtonConfig = { sendingDisabled: false, enableButtons: false }
		const { lastFrame } = render(<ActionButtons config={config} />)
		expect(lastFrame()).toBe("")
	})

	it("should return null when no visible buttons", () => {
		const config: ButtonConfig = {
			sendingDisabled: true,
			enableButtons: true,
			secondaryText: "Cancel",
			secondaryAction: "cancel",
		}
		const { lastFrame } = render(<ActionButtons config={config} />)
		expect(lastFrame()).toBe("")
	})

	it("should render primary button with shortcut (1)", () => {
		const config: ButtonConfig = {
			sendingDisabled: false,
			enableButtons: true,
			primaryText: "Approve",
			primaryAction: "approve",
		}
		const { lastFrame } = render(<ActionButtons config={config} />)
		expect(lastFrame()).toContain("Approve")
		expect(lastFrame()).toContain("(1)")
	})

	it("should render both buttons with shortcuts", () => {
		const config: ButtonConfig = {
			sendingDisabled: false,
			enableButtons: true,
			primaryText: "Approve",
			secondaryText: "Reject",
			primaryAction: "approve",
			secondaryAction: "reject",
		}
		const { lastFrame } = render(<ActionButtons config={config} />)
		expect(lastFrame()).toContain("Approve")
		expect(lastFrame()).toContain("(1)")
		expect(lastFrame()).toContain("Reject")
		expect(lastFrame()).toContain("(2)")
	})

	it("should use secondary shortcut (1) when no primary", () => {
		const config: ButtonConfig = {
			sendingDisabled: false,
			enableButtons: true,
			secondaryText: "Exit",
			secondaryAction: "reject",
		}
		const { lastFrame } = render(<ActionButtons config={config} />)
		expect(lastFrame()).toContain("Exit")
		expect(lastFrame()).toContain("(1)")
	})
})
