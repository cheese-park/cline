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

import { CheckpointMenu } from "./CheckpointMenu"

describe("CheckpointMenu", () => {
	it("renders checkpoint list", () => {
		const { lastFrame } = render(
			<CheckpointMenu
				messages={
					[
						{ ts: 10, say: "completion_result", lastCheckpointHash: "a" },
						{ ts: 20, say: "checkpoint_created", lastCheckpointHash: "b" },
					] as any
				}
				onCancel={vi.fn()}
				onSelect={vi.fn()}
			/>,
		)
		const frame = lastFrame() || ""
		expect(frame).toContain("Restore Checkpoint")
		expect(frame).toContain("Task completion")
	})

	it("shows empty state with no checkpoints", () => {
		const { lastFrame } = render(<CheckpointMenu messages={[]} onCancel={vi.fn()} onSelect={vi.fn()} />)
		expect(lastFrame()).toContain("No checkpoints available")
	})

	it("shows restore type options after selecting a checkpoint", async () => {
		const { lastFrame, stdin } = render(
			<CheckpointMenu
				messages={[{ ts: 10, say: "completion_result", lastCheckpointHash: "a" }] as any}
				onCancel={vi.fn()}
				onSelect={vi.fn()}
			/>,
		)
		stdin.write("\r")
		await new Promise((resolve) => setTimeout(resolve, 0))
		const frame = lastFrame() || ""
		expect(frame).toContain("Restore Type")
		expect(frame).toContain("Task + Workspace")
	})
})
