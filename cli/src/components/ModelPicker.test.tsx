import { render } from "ink-testing-library"
import React from "react"
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
vi.mock("@shared/api", () => ({
	anthropicDefaultModelId: "claude-sonnet-4-20250514",
	anthropicModels: { "claude-sonnet-4-20250514": {} },
	askSageDefaultModelId: "ask-1",
	askSageModels: {},
	basetenDefaultModelId: "base-1",
	basetenModels: {},
	bedrockDefaultModelId: "bedrock-1",
	bedrockModels: {},
	cerebrasDefaultModelId: "cerebras-1",
	cerebrasModels: {},
	claudeCodeDefaultModelId: "claude-code-1",
	claudeCodeModels: {},
	deepSeekDefaultModelId: "deepseek-1",
	deepSeekModels: {},
	doubaoDefaultModelId: "doubao-1",
	doubaoModels: {},
	fireworksDefaultModelId: "fireworks-1",
	fireworksModels: {},
	geminiDefaultModelId: "gemini-1",
	geminiModels: {},
	groqDefaultModelId: "groq-1",
	groqModels: {},
	huaweiCloudMaasDefaultModelId: "hua-1",
	huaweiCloudMaasModels: {},
	huggingFaceDefaultModelId: "hf-1",
	huggingFaceModels: {},
	internationalQwenDefaultModelId: "qwen-1",
	internationalQwenModels: {},
	internationalZAiDefaultModelId: "zai-1",
	internationalZAiModels: {},
	minimaxDefaultModelId: "minimax-1",
	minimaxModels: {},
	mistralDefaultModelId: "mistral-1",
	mistralModels: {},
	moonshotDefaultModelId: "moonshot-1",
	moonshotModels: {},
	nebiusDefaultModelId: "nebius-1",
	nebiusModels: {},
	nousResearchDefaultModelId: "nous-1",
	nousResearchModels: {},
	openAiCodexDefaultModelId: "codex-1",
	openAiCodexModels: {},
	openAiNativeDefaultModelId: "openai-native-1",
	openAiNativeModels: {},
	qwenCodeDefaultModelId: "qwen-code-1",
	qwenCodeModels: {},
	sambanovaDefaultModelId: "samba-1",
	sambanovaModels: {},
	sapAiCoreDefaultModelId: "sap-1",
	sapAiCoreModels: {},
	vertexDefaultModelId: "vertex-1",
	vertexModels: {},
	xaiDefaultModelId: "xai-1",
	xaiModels: {},
}))
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
vi.mock("@/core/controller/models/refreshOpenRouterModels", () => ({
	refreshOpenRouterModels: vi.fn(async () => ({ "openrouter/model-a": {}, "openrouter/model-b": {} })),
}))
vi.mock("@/shared/utils/model-filters", () => ({ filterOpenRouterModelIds: vi.fn((ids: string[]) => ids) }))
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

vi.mock("../utils/openrouter-models", () => ({
	usesOpenRouterModels: vi.fn((provider: string) => provider === "openrouter"),
	getOpenRouterDefaultModelId: vi.fn(() => "openrouter/model-a"),
}))
vi.mock("./SearchableList", () => ({
	SearchableList: ({ items }: any) => React.createElement("span", null, items.map((i: any) => i.id).join("|")),
	SearchableListItem: {},
}))

import { ModelPicker } from "./ModelPicker"

const waitForFrame = async (getFrame: () => string | undefined, matcher: (frame: string) => boolean) => {
	for (let i = 0; i < 30; i++) {
		const frame = getFrame() || ""
		if (matcher(frame)) {
			return frame
		}
		await new Promise((resolve) => setTimeout(resolve, 10))
	}
	return getFrame() || ""
}

describe("ModelPicker", () => {
	it("renders static model list", () => {
		const { lastFrame } = render(
			<ModelPicker controller={{}} isActive={true} onChange={vi.fn()} onSubmit={vi.fn()} provider="anthropic" />,
		)
		expect(lastFrame()).toContain("claude-sonnet-4-20250514")
	})

	it("renders openrouter model list", async () => {
		const { lastFrame } = render(
			<ModelPicker controller={{}} isActive={true} onChange={vi.fn()} onSubmit={vi.fn()} provider="openrouter" />,
		)
		const frame = await waitForFrame(lastFrame, (text) => text.includes("openrouter/model-a"))
		expect(frame).toContain("openrouter/model-a")
	})

	it("renders nothing when provider has no model picker", () => {
		const { lastFrame } = render(
			<ModelPicker controller={{}} isActive={true} onChange={vi.fn()} onSubmit={vi.fn()} provider="unknown-provider" />,
		)
		expect(lastFrame()).toBe("")
	})
})
