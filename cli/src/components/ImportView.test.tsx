import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockImportFromCodex } = vi.hoisted(() => ({
	mockImportFromCodex: vi.fn(),
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
			flushPendingState: vi.fn(async () => {}),
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

vi.mock("../utils/import-configs", () => ({
	importFromCodex: mockImportFromCodex,
	importFromOpenCode: vi.fn(() => ({ keys: [] })),
	getProviderDisplayName: vi.fn((provider: string) => provider.toUpperCase()),
	getSourceDisplayName: vi.fn((source: string) => source.toUpperCase()),
}))
vi.mock("../utils/provider-config", () => ({ applyProviderConfig: vi.fn(async () => {}) }))

import { ImportView } from "./ImportView"

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

describe("ImportView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders import options with detected keys", async () => {
		mockImportFromCodex.mockReturnValueOnce({
			keys: [
				{ provider: "anthropic", key: "sk-11111111", modelId: "claude" },
				{ provider: "openai", key: "sk-22222222", modelId: "gpt" },
			],
		})
		const { lastFrame } = render(<ImportView onCancel={vi.fn()} onComplete={vi.fn()} source="codex" />)
		await new Promise((resolve) => setTimeout(resolve, 0))
		const frame = lastFrame() || ""
		expect(frame).toContain("Select which key to import")
		expect(frame).toContain("Arrows to navigate")
	})

	it("shows confirmation screen for a single key", async () => {
		mockImportFromCodex.mockReturnValueOnce({ keys: [{ provider: "anthropic", key: "sk-1234567890", modelId: "claude-3" }] })
		const { lastFrame } = render(<ImportView onCancel={vi.fn()} onComplete={vi.fn()} source="codex" />)
		const frame = await waitForFrame(lastFrame, (text) => text.includes("Import API key from CODEX?"))
		expect(frame).toContain("Import API key from CODEX?")
		expect(frame).toContain("Confirm import")
	})

	it("shows error state when no keys are found", async () => {
		mockImportFromCodex.mockReturnValueOnce(null)
		const { lastFrame } = render(<ImportView onCancel={vi.fn()} onComplete={vi.fn()} source="codex" />)
		const frame = await waitForFrame(lastFrame, (text) => text.includes("Something went wrong"))
		expect(frame).toContain("Something went wrong")
	})
})
