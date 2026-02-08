import { Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { describe, expect, it, vi } from "vitest"

const { mockExtractMentionQuery, mockCheckRipgrep } = vi.hoisted(() => ({
	mockExtractMentionQuery: vi.fn(() => ({ inMentionMode: false, query: "", atIndex: -1 })),
	mockCheckRipgrep: vi.fn(() => false),
}))

vi.mock("@shared/proto/cline/common", () => ({
	EmptyRequest: { create: (d: any) => d || {} },
	StringRequest: { create: (d: any) => d || {} },
}))
vi.mock("@shared/proto/cline/slash", () => ({ SlashCommandInfo: {} }))
vi.mock("@shared/storage", () => ({
	Mode: { ACT: "act", PLAN: "plan" },
	SettingsKey: {},
	getProviderDefaultModelId: () => "model-default",
	getProviderModelIdKey: () => "actModeApiModelId",
	ProviderToApiKeyMap: {},
}))
vi.mock("@shared/api", () => ({ anthropicDefaultModelId: "claude-sonnet-4-20250514" }))
vi.mock("@/core/storage/StateManager", () => ({
	StateManager: {
		get: () => ({
			getGlobalSettingsKey: vi.fn((key: string) => {
				if (key === "mode") return "act"
				if (key === "actModeApiProvider") return "cline"
				if (key === "actModeApiModelId") return "model-1"
				return null
			}),
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

vi.mock("../utils/file-search", () => ({
	checkAndWarnRipgrepMissing: mockCheckRipgrep,
	extractMentionQuery: mockExtractMentionQuery,
	getRipgrepInstallInstructions: vi.fn(() => "brew install ripgrep"),
	insertMention: vi.fn((text: string) => text),
	searchWorkspaceFiles: vi.fn(async () => []),
}))
vi.mock("../utils/input", () => ({ isMouseEscapeSequence: vi.fn(() => false) }))
vi.mock("../utils/parser", () => ({ parseImagesFromInput: vi.fn((text: string) => ({ prompt: text, imagePaths: [] })) }))

vi.mock("./AccountInfoView", () => ({ AccountInfoView: () => React.createElement("span", null, "AccountInfoView") }))
vi.mock("./FileMentionMenu", () => ({ FileMentionMenu: () => React.createElement(Text, null, "FileMentionMenu") }))

import { WelcomeView } from "./WelcomeView"

describe("WelcomeView", () => {
	it("renders welcome message", () => {
		const { lastFrame } = render(<WelcomeView onSubmit={vi.fn()} />)
		expect(lastFrame()).toContain("What can I do for you?")
	})

	it("shows input field and model id", () => {
		const { lastFrame } = render(<WelcomeView onSubmit={vi.fn()} />)
		const frame = lastFrame() || ""
		expect(frame).toContain("model-1")
		expect(frame).toContain("Enter to submit")
	})

	it("renders mention menu in mention mode", () => {
		mockExtractMentionQuery.mockReturnValue({ inMentionMode: true, query: "src", atIndex: 0 })
		const { lastFrame } = render(<WelcomeView onSubmit={vi.fn()} />)
		expect(lastFrame()).toContain("FileMentionMenu")
	})

	it("shows ripgrep warning when missing", async () => {
		mockExtractMentionQuery.mockReturnValue({ inMentionMode: true, query: "src", atIndex: 0 })
		mockCheckRipgrep.mockReturnValueOnce(true)
		const { lastFrame } = render(<WelcomeView onSubmit={vi.fn()} />)
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(mockCheckRipgrep).toHaveBeenCalled()
		expect(lastFrame()).toContain("FileMentionMenu")
	})
})
