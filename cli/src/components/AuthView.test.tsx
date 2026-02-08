import { Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockDetectImportSources, mockUseValidProviders } = vi.hoisted(() => ({
	mockDetectImportSources: vi.fn(() => ({ codex: false, opencode: false })),
	mockUseValidProviders: vi.fn(() => ["anthropic", "openai"]),
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
vi.mock("@shared/api", () => ({
	anthropicDefaultModelId: "claude-sonnet-4-20250514",
	liteLlmDefaultModelId: "lite-1",
	openAiCodexDefaultModelId: "codex-1",
	openRouterDefaultModelId: "openrouter-1",
}))
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

vi.mock("@/integrations/openai-codex/oauth", () => ({
	openAiCodexOAuthManager: {
		startAuthorizationFlow: vi.fn(() => "https://example.com/auth"),
		waitForCallback: vi.fn(async () => {}),
		cancelAuthorizationFlow: vi.fn(),
	},
}))
vi.mock("@/services/auth/AuthService", () => ({
	AuthService: {
		getInstance: vi.fn(() => ({
			createAuthRequest: vi.fn(async () => {}),
			subscribeToAuthStatusUpdate: vi.fn(),
		})),
	},
}))
vi.mock("@/utils/env", () => ({ openExternal: vi.fn(async () => {}) }))
vi.mock("../hooks/useOcaAuth", () => ({ useOcaAuth: vi.fn(() => ({ startAuth: vi.fn() })) }))
vi.mock("../hooks/useScrollableList", () => ({
	useScrollableList: vi.fn((length: number) => ({
		visibleStart: 0,
		visibleCount: Math.min(length, 8),
		showTopIndicator: false,
		showBottomIndicator: false,
	})),
}))
vi.mock("../utils/import-configs", () => ({
	detectImportSources: mockDetectImportSources,
	getSourceDisplayName: vi.fn((s: string) => s),
}))
vi.mock("../utils/input", () => ({ isMouseEscapeSequence: vi.fn(() => false) }))
vi.mock("../utils/provider-config", () => ({
	applyProviderConfig: vi.fn(async () => {}),
	applyBedrockConfig: vi.fn(async () => {}),
}))
vi.mock("../utils/providers", () => ({
	useValidProviders: mockUseValidProviders,
}))

vi.mock("./ApiKeyInput", () => ({ ApiKeyInput: () => React.createElement(Text, null, "ApiKeyInput") }))
vi.mock("./AsciiMotionCli", () => ({ StaticRobotFrame: () => React.createElement(Text, null, "Robot") }))
vi.mock("./BedrockSetup", () => ({ BedrockSetup: () => React.createElement(Text, null, "BedrockSetup") }))
vi.mock("./FeaturedModelPicker", () => ({
	FeaturedModelPicker: () => React.createElement(Text, null, "FeaturedModelPicker"),
	getFeaturedModelAtIndex: vi.fn(() => ({ id: "model-1" })),
	getFeaturedModelMaxIndex: vi.fn(() => 2),
	isBrowseAllSelected: vi.fn(() => false),
}))
vi.mock("./ImportView", () => ({ ImportView: () => React.createElement(Text, null, "ImportView") }))
vi.mock("./ModelPicker", () => ({
	ModelPicker: () => React.createElement(Text, null, "ModelPicker"),
	getDefaultModelId: vi.fn(() => "model-default"),
	hasModelPicker: vi.fn(() => true),
}))
vi.mock("./ProviderPicker", () => ({ getProviderLabel: vi.fn((id: string) => id.toUpperCase()) }))

import { AuthView } from "./AuthView"

describe("AuthView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockDetectImportSources.mockReturnValue({ codex: false, opencode: false })
	})

	it("renders provider selection step", () => {
		const { lastFrame } = render(<AuthView controller={{}} />)
		const frame = lastFrame() || ""
		expect(frame).toContain("Welcome to Cline")
		expect(frame).toContain("How would you like to get started?")
	})

	it("renders with import source auth state", async () => {
		mockDetectImportSources.mockReturnValue({ codex: true, opencode: true })
		const { lastFrame } = render(<AuthView controller={{}} />)
		await new Promise((resolve) => setTimeout(resolve, 0))
		const frame = lastFrame() || ""
		expect(mockDetectImportSources).toHaveBeenCalled()
		expect(frame).toContain("How would you like to get started?")
	})

	it("shows ChatGPT auth option in the menu", () => {
		const { lastFrame } = render(<AuthView controller={{}} />)
		expect(lastFrame()).toContain("Sign in with ChatGPT Subscription")
	})

	it("shows API key option in the menu", () => {
		const { lastFrame } = render(<AuthView controller={{}} />)
		const frame = lastFrame() || ""
		expect(frame).toContain("Use your own API key")
	})
})
