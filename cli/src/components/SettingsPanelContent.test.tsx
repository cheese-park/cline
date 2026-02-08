import { Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { describe, expect, it, vi } from "vitest"

const { stateManager } = vi.hoisted(() => ({
	stateManager: {
		getGlobalSettingsKey: vi.fn((key: string) => {
			if (key === "preferredLanguage") return "English"
			return undefined
		}),
		getGlobalStateKey: vi.fn(() => undefined),
		getApiConfiguration: vi.fn(() => ({ actModeApiProvider: "anthropic", planModeApiProvider: "anthropic" })),
		setGlobalState: vi.fn(),
		flushPendingState: vi.fn(async () => undefined),
	},
}))

vi.mock("@/core/storage/StateManager", () => ({
	StateManager: { get: () => stateManager },
}))

vi.mock("@shared/storage", () => ({
	getProviderModelIdKey: vi.fn((provider: string, mode: "act" | "plan") => `${mode}:${provider}:modelKey`),
	isSettingsKey: vi.fn(() => false),
	ProviderToApiKeyMap: { anthropic: "anthropicApiKey", openai: "openAiApiKey" },
}))

vi.mock("@/core/api", () => ({ buildApiHandler: vi.fn(() => ({})) }))
vi.mock("@/integrations/openai-codex/oauth", () => ({
	openAiCodexOAuthManager: {
		startAuthorizationFlow: vi.fn(() => "https://auth"),
		waitForCallback: vi.fn(async () => undefined),
		cancelAuthorizationFlow: vi.fn(),
	},
}))
vi.mock("@/services/account/ClineAccountService", () => ({
	ClineAccountService: {
		getInstance: vi.fn(() => ({
			fetchUserOrganizationsRPC: vi.fn(async () => []),
			fetchBalanceRPC: vi.fn(async () => ({ balance: 0 })),
			switchAccount: vi.fn(async () => undefined),
		})),
	},
}))
vi.mock("@/services/auth/AuthService", () => ({
	AuthService: {
		getInstance: vi.fn(() => ({
			getInfo: vi.fn(() => ({})),
			createAuthRequest: vi.fn(async () => undefined),
			handleDeauth: vi.fn(async () => undefined),
			subscribeToAuthStatusUpdate: vi.fn(),
		})),
	},
}))
vi.mock("@/utils/env", () => ({ openExternal: vi.fn(async () => undefined) }))

vi.mock("../context/StdinContext", () => ({ useStdinContext: vi.fn(() => ({ isRawModeSupported: true })) }))
vi.mock("../hooks/useOcaAuth", () => ({
	useOcaAuth: vi.fn(() => ({ isWaiting: false, startAuth: vi.fn(), cancelAuth: vi.fn(), isAuthenticated: false })),
}))
vi.mock("../utils/input", () => ({ isMouseEscapeSequence: vi.fn(() => false) }))
vi.mock("../utils/provider-config", () => ({ applyBedrockConfig: vi.fn(), applyProviderConfig: vi.fn(async () => undefined) }))

vi.mock("./ApiKeyInput", () => ({ ApiKeyInput: () => React.createElement(Text, null, "ApiKeyInput") }))
vi.mock("./BedrockSetup", () => ({ BedrockSetup: () => React.createElement(Text, null, "BedrockSetup") }))
vi.mock("./Checkbox", () => ({ Checkbox: ({ label }: any) => React.createElement(Text, null, label) }))
vi.mock("./FeaturedModelPicker", () => ({
	FeaturedModelPicker: () => React.createElement(Text, null, "FeaturedModelPicker"),
	getFeaturedModelAtIndex: vi.fn(() => ({ id: "model-a" })),
	getFeaturedModelMaxIndex: vi.fn(() => 1),
	isBrowseAllSelected: vi.fn(() => false),
}))
vi.mock("./LanguagePicker", () => ({ LanguagePicker: () => React.createElement(Text, null, "LanguagePicker") }))
vi.mock("./ModelPicker", () => ({
	hasModelPicker: vi.fn(() => true),
	ModelPicker: () => React.createElement(Text, null, "ModelPicker"),
}))
vi.mock("./OrganizationPicker", () => ({ OrganizationPicker: () => React.createElement(Text, null, "OrganizationPicker") }))
vi.mock("./ProviderPicker", () => ({
	getProviderLabel: vi.fn((v: string) => v),
	ProviderPicker: () => React.createElement(Text, null, "ProviderPicker"),
}))
vi.mock("./Panel", () => ({
	Panel: ({ label, tabs, currentTab, children }: any) =>
		React.createElement(
			React.Fragment,
			null,
			React.createElement(Text, null, `${label}:${currentTab}`),
			React.createElement(Text, null, tabs.map((t: any) => t.label).join("|")),
			children,
		),
}))

import { SettingsPanelContent } from "./SettingsPanelContent"

const tick = async () => new Promise((resolve) => setTimeout(resolve, 20))

describe("SettingsPanelContent", () => {
	it("renders default tab and tab labels", () => {
		const { lastFrame } = render(<SettingsPanelContent onClose={vi.fn()} />)
		expect(lastFrame()).toContain("Settings:api")
		expect(lastFrame()).toContain("API|Auto-approve|Features|Account|Other")
	})

	it("renders api fields in default view", () => {
		const { lastFrame } = render(<SettingsPanelContent onClose={vi.fn()} />)
		expect(lastFrame()).toContain("Provider")
		expect(lastFrame()).toContain("Model ID")
	})

	it("renders checkbox labels from API section", () => {
		const { lastFrame } = render(<SettingsPanelContent onClose={vi.fn()} />)
		expect(lastFrame()).toContain("Enable thinking")
		expect(lastFrame()).toContain("Use separate models for Plan and Act")
	})

	it("switches to auto-approve tab with keyboard navigation", async () => {
		const { stdin, lastFrame } = render(<SettingsPanelContent onClose={vi.fn()} />)
		stdin.write("\u001B[C")
		await tick()
		const frame = lastFrame() || ""
		expect(frame).toContain("Settings:auto-approve")
		expect(frame).toContain("Read project files")
		expect(frame).toContain("Enable notifications")
	})

	it("switches to features tab with keyboard navigation", async () => {
		const { stdin, lastFrame } = render(<SettingsPanelContent onClose={vi.fn()} />)
		let frame = lastFrame() || ""
		for (let i = 0; i < 4 && !frame.includes("Settings:features"); i++) {
			stdin.write("\u001B[C")
			await tick()
			frame = lastFrame() || ""
		}
		expect(frame).toContain("Settings:features")
		expect(frame).toContain("Auto-condense")
		expect(frame).toContain("Parallel tool calling")
	})

	it("renders account sign-in prompt when account is not authenticated", async () => {
		const { stdin, lastFrame } = render(<SettingsPanelContent onClose={vi.fn()} />)
		let frame = lastFrame() || ""
		for (let i = 0; i < 6 && !frame.includes("Settings:account"); i++) {
			stdin.write("\u001B[C")
			await tick()
			frame = lastFrame() || ""
		}
		expect(frame).toContain("Settings:account")
		expect(frame).toContain("Sign in to access Cline features")
		expect(frame).toContain("Sign in with Cline")
	})

	it("switches to other tab and shows language/telemetry options", async () => {
		const { stdin, lastFrame } = render(<SettingsPanelContent onClose={vi.fn()} />)
		stdin.write("\u001B[D")
		await tick()
		const frame = lastFrame() || ""
		expect(frame).toContain("Settings:other")
		expect(frame).toContain("Preferred language")
		expect(frame).toContain("Error/usage reporting")
		expect(frame).toContain("Cline v")
	})

	it("opens provider picker from API provider row", async () => {
		const { stdin, lastFrame } = render(<SettingsPanelContent onClose={vi.fn()} />)
		stdin.write("\t")
		await tick()
		const frame = lastFrame() || ""
		expect(frame).toContain("Select Provider")
		expect(frame).toContain("ProviderPicker")
	})

	it("opens model picker from API model row", async () => {
		const { stdin, lastFrame } = render(<SettingsPanelContent onClose={vi.fn()} />)
		stdin.write("\u001B[B")
		await tick()
		stdin.write("\t")
		await tick()
		const frame = lastFrame() || ""
		expect(frame).toContain("Select: Model ID (Act)")
		expect(frame).toContain("ModelPicker")
	})

	it("renders featured model picker when opened in featured-models mode", () => {
		const { lastFrame } = render(
			<SettingsPanelContent initialMode="featured-models" initialModelKey="actModelId" onClose={vi.fn()} />,
		)
		expect(lastFrame()).toContain("FeaturedModelPicker")
	})
})
