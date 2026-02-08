import { beforeEach, describe, expect, it, vi } from "vitest"

const {
	setApiConfigurationMock,
	flushPendingStateMock,
	getGlobalSettingsKeyMock,
	getApiConfigurationMock,
	setGlobalStateMock,
	buildApiHandlerMock,
	getDefaultModelIdMock,
	getProviderModelIdKeyMock,
} = vi.hoisted(() => ({
	setApiConfigurationMock: vi.fn(),
	flushPendingStateMock: vi.fn(async () => undefined),
	getGlobalSettingsKeyMock: vi.fn(() => "act"),
	getApiConfigurationMock: vi.fn(() => ({ existing: "config" })),
	setGlobalStateMock: vi.fn(),
	buildApiHandlerMock: vi.fn(() => ({ handler: "rebuilt" })),
	getDefaultModelIdMock: vi.fn(() => "default-model"),
	getProviderModelIdKeyMock: vi.fn((provider: string, mode: "act" | "plan") =>
		mode === "act" ? `act:${provider}` : `plan:${provider}`,
	),
}))

vi.mock("@/core/storage/StateManager", () => ({
	StateManager: {
		get: () => ({
			setApiConfiguration: setApiConfigurationMock,
			flushPendingState: flushPendingStateMock,
			getGlobalSettingsKey: getGlobalSettingsKeyMock,
			getApiConfiguration: getApiConfigurationMock,
			setGlobalState: setGlobalStateMock,
		}),
	},
}))

vi.mock("@/core/api", () => ({
	buildApiHandler: buildApiHandlerMock,
}))

vi.mock("@shared/storage", () => ({
	getProviderModelIdKey: getProviderModelIdKeyMock,
	ProviderToApiKeyMap: {
		anthropic: "apiKey",
		openrouter: "openRouterApiKey",
		bedrock: ["awsAccessKey", "awsBedrockApiKey"],
	},
}))

vi.mock("../components/ModelPicker", () => ({
	getDefaultModelId: getDefaultModelIdMock,
}))

import { applyBedrockConfig, applyProviderConfig } from "./provider-config"

describe("provider-config", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		getDefaultModelIdMock.mockReturnValue("default-model")
		getApiConfigurationMock.mockReturnValue({ existing: "config" })
	})

	it("sets act and plan providers with default model id", async () => {
		await applyProviderConfig({ providerId: "anthropic" })

		expect(setApiConfigurationMock).toHaveBeenCalledWith({
			actModeApiProvider: "anthropic",
			planModeApiProvider: "anthropic",
			"act:anthropic": "default-model",
			"plan:anthropic": "default-model",
		})
	})

	it("adds api key and base URL when provided", async () => {
		await applyProviderConfig({
			providerId: "anthropic",
			apiKey: "sk-test",
			baseUrl: "https://api.example.com",
			modelId: "custom-model",
		})

		expect(setApiConfigurationMock).toHaveBeenCalledWith({
			actModeApiProvider: "anthropic",
			planModeApiProvider: "anthropic",
			"act:anthropic": "custom-model",
			"plan:anthropic": "custom-model",
			apiKey: "sk-test",
			openAiBaseUrl: "https://api.example.com",
		})
	})

	it("flushes pending state after setting provider config", async () => {
		await applyProviderConfig({ providerId: "anthropic" })
		expect(flushPendingStateMock).toHaveBeenCalledTimes(1)
	})

	it("rebuilds API handler when controller has active task", async () => {
		const controller = {
			task: { ulid: "task-1", api: null as unknown },
		} as any

		await applyProviderConfig({ providerId: "anthropic", controller })

		expect(buildApiHandlerMock).toHaveBeenCalledWith({ existing: "config", ulid: "task-1" }, "act")
		expect(controller.task.api).toEqual({ handler: "rebuilt" })
	})

	it("stores openrouter model info for cline/openrouter providers", async () => {
		const controller = {
			task: { ulid: "task-2", api: null as unknown },
			readOpenRouterModels: vi.fn(async () => ({ "model-x": { id: "model-x" } })),
		} as any

		await applyProviderConfig({ providerId: "cline", controller, modelId: "model-x" })

		expect(setGlobalStateMock).toHaveBeenCalledWith("actModeOpenRouterModelInfo", { id: "model-x" })
		expect(setGlobalStateMock).toHaveBeenCalledWith("planModeOpenRouterModelInfo", { id: "model-x" })
	})

	it("applyBedrockConfig saves aws fields and optional credentials", async () => {
		const controller = {
			task: { ulid: "task-bedrock", api: null as unknown },
		} as any

		await applyBedrockConfig({
			controller,
			modelId: "bedrock-model",
			bedrockConfig: {
				awsAuthentication: "profile",
				awsRegion: "us-west-2",
				awsUseCrossRegionInference: true,
				awsProfile: "default",
				awsAccessKey: "AKIA",
				awsSecretKey: "SECRET",
				awsSessionToken: "TOKEN",
			},
		} as any)

		expect(setApiConfigurationMock).toHaveBeenCalledWith({
			actModeApiProvider: "bedrock",
			planModeApiProvider: "bedrock",
			awsAuthentication: "profile",
			awsRegion: "us-west-2",
			awsUseCrossRegionInference: true,
			"act:bedrock": "bedrock-model",
			"plan:bedrock": "bedrock-model",
			awsProfile: "default",
			awsAccessKey: "AKIA",
			awsSecretKey: "SECRET",
			awsSessionToken: "TOKEN",
		})
		expect(buildApiHandlerMock).toHaveBeenCalledWith({ existing: "config", ulid: "task-bedrock" }, "act")
	})
})
