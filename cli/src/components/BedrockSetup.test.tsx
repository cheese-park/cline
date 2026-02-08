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

vi.mock("../hooks/useScrollableList", () => ({
	useScrollableList: vi.fn((length: number) => ({
		visibleStart: 0,
		visibleCount: Math.min(length, 8),
		showTopIndicator: false,
		showBottomIndicator: false,
	})),
}))
vi.mock("../utils/input", () => ({ isMouseEscapeSequence: vi.fn(() => false) }))

import { BedrockSetup } from "./BedrockSetup"

const waitForFrame = async (getFrame: () => string | undefined, matcher: (frame: string) => boolean) => {
	for (let i = 0; i < 20; i++) {
		const frame = getFrame() || ""
		if (matcher(frame)) {
			return frame
		}
		await new Promise((resolve) => setTimeout(resolve, 10))
	}
	return getFrame() || ""
}

describe("BedrockSetup", () => {
	it("renders setup form", () => {
		const { lastFrame } = render(<BedrockSetup isActive={true} onCancel={vi.fn()} onComplete={vi.fn()} />)
		expect(lastFrame()).toContain("Authentication method")
	})

	it("shows AWS profile field after selecting profile method", async () => {
		const { lastFrame, stdin } = render(<BedrockSetup isActive={true} onCancel={vi.fn()} onComplete={vi.fn()} />)
		stdin.write("\r")
		const frame = await waitForFrame(lastFrame, (text) => text.includes("AWS Profile Name"))
		expect(frame).toContain("AWS Profile Name")
	})

	it("shows AWS credentials fields for credentials auth", async () => {
		const { lastFrame, stdin } = render(<BedrockSetup isActive={true} onCancel={vi.fn()} onComplete={vi.fn()} />)
		stdin.write("\x1B[B")
		await new Promise((resolve) => setTimeout(resolve, 10))
		stdin.write("\r")
		const frame = await waitForFrame(lastFrame, (text) => /AWS (Profile Name|Credentials)/.test(text))
		expect(frame).toMatch(/AWS (Profile Name|Credentials)/)
	})
})
