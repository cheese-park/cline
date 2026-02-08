import { Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { describe, expect, it, vi } from "vitest"

const { mockGetTaskHistory } = vi.hoisted(() => ({
	mockGetTaskHistory: vi.fn(
		async (): Promise<{
			tasks: Array<{
				id: string
				ts: number
				task: string
				totalCost?: number
				tokensIn?: number
				tokensOut?: number
				isFavorited?: boolean
			}>
		}> => ({ tasks: [] }),
	),
}))

vi.mock("@shared/proto/cline/common", () => ({
	EmptyRequest: { create: (d: any) => d || {} },
	StringRequest: { create: (d: any) => d || {} },
}))
vi.mock("@shared/proto/cline/task", () => ({
	GetTaskHistoryRequest: { create: (d: any) => d || {} },
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

vi.mock("@/core/controller/task/getTaskHistory", () => ({ getTaskHistory: mockGetTaskHistory }))
vi.mock("@/core/controller/task/showTaskWithId", () => ({ showTaskWithId: vi.fn(async () => {}) }))
vi.mock("../utils/input", () => ({ isMouseEscapeSequence: vi.fn(() => false) }))
vi.mock("./Panel", () => ({
	Panel: ({ children }: any) => React.createElement(React.Fragment, null, React.createElement(Text, null, "Panel"), children),
}))

import { HistoryPanelContent } from "./HistoryPanelContent"

describe("HistoryPanelContent", () => {
	it("renders history list", async () => {
		mockGetTaskHistory.mockResolvedValueOnce({
			tasks: [
				{ id: "t1", ts: Date.now(), task: "Fix bug", totalCost: 1.23, tokensIn: 10, tokensOut: 20, isFavorited: false },
			],
		})
		const { lastFrame } = render(<HistoryPanelContent controller={{} as any} onClose={vi.fn()} onSelectTask={vi.fn()} />)
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(lastFrame()).toContain("Fix bug")
	})

	it("shows empty state", async () => {
		mockGetTaskHistory.mockResolvedValueOnce({ tasks: [] })
		const { lastFrame } = render(<HistoryPanelContent controller={{} as any} onClose={vi.fn()} onSelectTask={vi.fn()} />)
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(lastFrame()).toContain("No task history")
	})

	it("shows search header", () => {
		const { lastFrame } = render(<HistoryPanelContent controller={{} as any} onClose={vi.fn()} onSelectTask={vi.fn()} />)
		expect(lastFrame()).toContain("Search:")
	})
})
