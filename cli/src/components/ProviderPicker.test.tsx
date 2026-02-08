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
vi.mock("@shared/api", () => ({ anthropicDefaultModelId: "claude-sonnet-4-20250514" }))
vi.mock("@/core/storage/StateManager", () => ({
	StateManager: {
		get: () => ({
			getGlobalSettingsKey: vi.fn(() => null),
			setGlobalState: vi.fn(),
			getApiConfiguration: vi.fn(() => ({ apiKey: "sk-123", openRouterApiKey: "or-123" })),
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

vi.mock("../utils/providers", () => ({
	useValidProviders: vi.fn(() => ["anthropic", "openrouter"]),
	getProviderLabel: vi.fn((provider: string) => provider.toUpperCase()),
}))
vi.mock("./SearchableList", () => ({
	SearchableList: ({ items }: any) =>
		React.createElement("span", null, items.map((i: any) => `${i.label} ${i.suffix || ""}`).join(" | ")),
}))

import { ProviderPicker } from "./ProviderPicker"

describe("ProviderPicker", () => {
	it("renders provider list", () => {
		const { lastFrame } = render(<ProviderPicker onSelect={vi.fn()} />)
		const frame = lastFrame() || ""
		expect(frame).toContain("ANTHROPIC")
		expect(frame).toContain("OPENROUTER")
	})

	it("shows configured suffix", () => {
		const { lastFrame } = render(<ProviderPicker onSelect={vi.fn()} />)
		expect(lastFrame()).toContain("Configured")
	})

	it("renders while inactive", () => {
		const { lastFrame } = render(<ProviderPicker isActive={false} onSelect={vi.fn()} />)
		expect(lastFrame()).toContain("ANTHROPIC")
	})
})
