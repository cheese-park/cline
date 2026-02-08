import { Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("react", async () => {
	const actual = await vi.importActual<typeof import("react")>("react")
	return {
		...actual,
		useEffect: vi.fn(),
	}
})

vi.mock("@shared/proto/cline/common", () => ({
	EmptyRequest: { create: (d: any) => d || {} },
	StringRequest: { create: (d: any) => d || {} },
}))
vi.mock("execa", () => ({ execa: vi.fn() }))
vi.mock("@shared/proto/cline/slash", () => ({ SlashCommandInfo: {} }))
vi.mock("@shared/proto/cline/file", () => ({ RuleScope: { GLOBAL: 1, LOCAL: 2 } }))
vi.mock("@shared/storage", () => ({
	getProviderDefaultModelId: () => "test-model",
	getProviderModelIdKey: () => "actModeApiModelId",
	ProviderToApiKeyMap: {},
}))
vi.mock("@shared/storage/state-keys", () => ({
	GlobalStateAndSettings: {},
	GlobalStateAndSettingsKey: {},
	LocalState: {},
	LocalStateKey: {},
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
vi.mock("@/hosts/host-provider", () => ({
	HostProvider: { workspace: { getWorkspacePaths: vi.fn(async () => ({ paths: ["/tmp"] })) } },
}))
vi.mock("../vscode-shim", () => ({ shutdownEvent: { event: vi.fn(() => ({ dispose: vi.fn() })) } }))
vi.mock("../context/StdinContext", () => ({
	StdinProvider: ({ children, isRawModeSupported }: any) =>
		React.createElement(
			React.Fragment,
			null,
			React.createElement(Text, null, `Stdin:${String(isRawModeSupported)}`),
			children,
		),
	useStdinContext: () => ({ isRawModeSupported: true }),
}))
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

vi.mock("@/core/controller/file/refreshRules", () => ({
	refreshRules: vi.fn(async () => ({
		globalClineRulesToggles: { toggles: {} },
		localClineRulesToggles: { toggles: {} },
		localCursorRulesToggles: { toggles: {} },
		localWindsurfRulesToggles: { toggles: {} },
		localAgentsRulesToggles: { toggles: {} },
		globalWorkflowToggles: { toggles: {} },
		localWorkflowToggles: { toggles: {} },
	})),
}))
vi.mock("@/core/controller/file/refreshHooks", () => ({
	refreshHooks: vi.fn(async () => ({ globalHooks: [], workspaceHooks: [] })),
}))
vi.mock("@/core/controller/file/refreshSkills", () => ({
	refreshSkills: vi.fn(async () => ({ globalSkills: [], localSkills: [] })),
}))

vi.mock("./ConfigView", () => ({ ConfigView: () => React.createElement(Text, null, "ConfigView") }))

import { ConfigViewWrapper } from "./ConfigViewWrapper"

describe("ConfigViewWrapper", () => {
	const controller = {
		stateManager: {
			setGlobalState: vi.fn(),
			setWorkspaceState: vi.fn(),
			flushPendingState: vi.fn(async () => {}),
			getWorkspaceStateKey: vi.fn(() => ({})),
		},
	}

	it("renders wrapping ConfigView", () => {
		const { lastFrame, unmount } = render(
			<ConfigViewWrapper
				controller={controller as any}
				dataDir="/tmp"
				globalState={{ mode: "act" }}
				hooksEnabled={false}
				isRawModeSupported={true}
				skillsEnabled={false}
				workspaceState={{}}
			/>,
		)
		expect(lastFrame()).toContain("ConfigView")
		unmount()
	})

	it("renders with hooks and skills disabled", () => {
		const { lastFrame, unmount } = render(
			<ConfigViewWrapper
				controller={controller as any}
				dataDir="/tmp"
				globalState={{}}
				hooksEnabled={false}
				skillsEnabled={false}
				workspaceState={{}}
			/>,
		)
		expect(lastFrame()).toContain("ConfigView")
		unmount()
	})

	it("passes raw-mode state into stdin wrapper", () => {
		const { lastFrame, unmount } = render(
			<ConfigViewWrapper
				controller={controller as any}
				dataDir="/tmp"
				globalState={{}}
				hooksEnabled={false}
				isRawModeSupported={false}
				skillsEnabled={false}
				workspaceState={{}}
			/>,
		)
		expect(lastFrame()).toContain("Stdin:false")
		unmount()
	})
})
