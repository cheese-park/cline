import { Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetGlobalSettingsKey, mockAuthInfo, mockOrganizations, mockBalance } = vi.hoisted(() => ({
	mockGetGlobalSettingsKey: vi.fn((key: string) => {
		if (key === "mode") return "act"
		if (key === "actModeApiProvider") return "cline"
		return null
	}),
	mockAuthInfo: vi.fn(() => ({ user: { uid: "u1", email: "test@cline.bot" } })),
	mockOrganizations: vi.fn(() => [{ name: "Cline Org", active: true }]),
	mockBalance: vi.fn(async () => ({ balance: 2500000 })),
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
vi.mock("@/core/controller", () => ({ Controller: vi.fn() }))
vi.mock("@/core/storage/StateManager", () => ({
	StateManager: {
		get: () => ({
			getGlobalSettingsKey: mockGetGlobalSettingsKey,
			setGlobalState: vi.fn(),
			getApiConfiguration: vi.fn(() => ({})),
			getRemoteConfigSettings: vi.fn(() => undefined),
			setApiConfiguration: vi.fn(),
			flushPendingState: vi.fn(),
		}),
	},
}))
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

vi.mock("@/services/auth/AuthService", () => ({
	AuthService: {
		getInstance: vi.fn(() => ({
			getInfo: mockAuthInfo,
			getUserOrganizations: mockOrganizations,
			getActiveOrganizationId: vi.fn(() => "org-1"),
		})),
	},
	ClineAccountOrganization: {},
}))
vi.mock("@/services/account/ClineAccountService", () => ({
	ClineAccountService: {
		getInstance: vi.fn(() => ({
			fetchOrganizationCreditsRPC: mockBalance,
			fetchBalanceRPC: mockBalance,
		})),
	},
}))
vi.mock("./Spinner", () => ({ LoadingSpinner: () => React.createElement(Text, null, "...") }))

import { AccountInfoView } from "./AccountInfoView"

const waitForFrameToContain = async (getFrame: () => string | undefined, text: string) => {
	for (let i = 0; i < 20; i++) {
		const frame = getFrame() || ""
		if (frame.includes(text)) {
			return frame
		}
		await new Promise((resolve) => setTimeout(resolve, 20))
	}
	return getFrame() || ""
}

describe("AccountInfoView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockGetGlobalSettingsKey.mockImplementation((key: string) => {
			if (key === "mode") return "act"
			if (key === "actModeApiProvider") return "cline"
			return null
		})
	})

	it("shows loading state", () => {
		const { lastFrame } = render(<AccountInfoView controller={{} as any} />)
		expect(lastFrame()).toContain("Loading")
	})

	it("renders account info", async () => {
		const { lastFrame } = render(<AccountInfoView controller={{} as any} />)
		const frame = await waitForFrameToContain(lastFrame, "Provider")
		expect(frame).toContain("Provider")
		expect(frame).toContain("Cline")
	})

	it("renders non-cline provider state", async () => {
		mockGetGlobalSettingsKey.mockImplementation(((key: string) => {
			if (key === "mode") return "act"
			if (key === "actModeApiProvider") return "openai-native"
			return null
		}) as any)
		const { lastFrame } = render(<AccountInfoView controller={{} as any} />)
		const frame = await waitForFrameToContain(lastFrame, "Openai Native")
		expect(frame).toContain("Openai Native")
	})

	it("should show non-Cline provider name", async () => {
		mockGetGlobalSettingsKey.mockImplementation(((key: string) => {
			if (key === "mode") return "act"
			if (key === "actModeApiProvider") return "anthropic"
			return null
		}) as any)
		const { lastFrame } = render(<AccountInfoView controller={{} as any} />)
		const frame = await waitForFrameToContain(lastFrame, "Anthropic")
		expect(frame).toContain("Anthropic")
	})
})
