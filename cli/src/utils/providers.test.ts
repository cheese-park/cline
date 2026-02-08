import { beforeEach, describe, expect, it, vi } from "vitest"

const getRemoteConfigSettingsMock = vi.fn()

vi.mock("react", () => ({
	useMemo: (factory: () => unknown) => factory(),
}))

vi.mock("@/core/storage/StateManager", () => ({
	StateManager: {
		get: () => ({
			getRemoteConfigSettings: getRemoteConfigSettingsMock,
		}),
	},
}))

vi.mock("@/shared/providers/providers.json", () => ({
	default: {
		list: [
			{ value: "anthropic", label: "Anthropic" },
			{ value: "openai", label: "OpenAI" },
			{ value: "vscode-lm", label: "VS Code LM" },
		],
	},
}))

import { getProviderLabel, getValidCliProviders, isValidCliProvider, useValidProviders } from "./providers"

describe("providers utils", () => {
	beforeEach(() => {
		getRemoteConfigSettingsMock.mockReset()
		getRemoteConfigSettingsMock.mockReturnValue(undefined)
	})

	it("getProviderLabel returns display label when known", () => {
		expect(getProviderLabel("anthropic")).toBe("Anthropic")
	})

	it("getProviderLabel falls back to provider id", () => {
		expect(getProviderLabel("unknown-provider")).toBe("unknown-provider")
	})

	it("getValidCliProviders excludes vscode-lm", () => {
		expect(getValidCliProviders()).toEqual(["anthropic", "openai"])
	})

	it("isValidCliProvider returns true for valid non-excluded provider", () => {
		expect(isValidCliProvider("openai")).toBe(true)
	})

	it("isValidCliProvider returns false for excluded or unknown provider", () => {
		expect(isValidCliProvider("vscode-lm")).toBe(false)
		expect(isValidCliProvider("missing")).toBe(false)
	})

	it("useValidProviders uses remote configured providers when present", () => {
		getRemoteConfigSettingsMock.mockReturnValue({ remoteConfiguredProviders: ["openai"] })
		expect(useValidProviders()).toEqual(["openai"])
	})

	it("useValidProviders falls back to default valid providers", () => {
		getRemoteConfigSettingsMock.mockReturnValue({ remoteConfiguredProviders: [] })
		expect(useValidProviders()).toEqual(["anthropic", "openai"])
	})
})
