import { beforeEach, describe, expect, it, vi } from "vitest"

const {
	getProgram,
	stateManager,
	setGlobalStateMock,
	flushPendingStateMock,
	printWarningMock,
	readStdinIfPipedMock,
	runPlainTextTaskMock,
	selectOutputModeMock,
	getProviderModelIdKeyMock,
} = vi.hoisted(() => {
	class MockCommand {
		public static lastRoot: MockCommand | null = null
		public readonly commands: MockCommand[] = []
		public actionHandler?: (...args: any[]) => any

		constructor(name = "") {
			this._name = name
			if (!name) MockCommand.lastRoot = this
		}

		name(value: string) {
			this._name = value
			return this
		}
		description() {
			return this
		}
		version() {
			return this
		}
		enablePositionalOptions() {
			return this
		}
		command(name: string) {
			const cmd = new MockCommand(name)
			this.commands.push(cmd)
			return cmd
		}
		alias() {
			return this
		}
		argument() {
			return this
		}
		option() {
			return this
		}
		action(handler: (...args: any[]) => any) {
			this.actionHandler = handler
			return this
		}
		parse() {
			return this
		}
	}

	const setGlobalStateMock = vi.fn()
	const flushPendingStateMock = vi.fn(async () => undefined)
	const stateManager = {
		_initializeDone: false,
		_getTaskHistory: [] as any[],
		_welcome: undefined as undefined | boolean,
		_apiConfig: { anthropicApiKey: "k", actModeApiProvider: "anthropic", planModeApiProvider: "anthropic" } as any,
		_mode: "act",
		initialize: vi.fn(async () => undefined),
		getGlobalStateKey: vi.fn((key: string) => {
			if (key === "taskHistory") return stateManager._getTaskHistory
			if (key === "welcomeViewCompleted") return stateManager._welcome
			return undefined
		}),
		getGlobalSettingsKey: vi.fn((key: string) => {
			if (key === "mode") return stateManager._mode
			if (key === "actModeApiProvider") return "anthropic"
			if (key === "planModeApiProvider") return "anthropic"
			return undefined
		}),
		setGlobalState: setGlobalStateMock,
		flushPendingState: flushPendingStateMock,
		getApiConfiguration: vi.fn(() => stateManager._apiConfig),
		getAllGlobalStateEntries: vi.fn(() => ({})),
		getAllWorkspaceStateEntries: vi.fn(() => ({})),
	}

	return {
		getProgram: () => MockCommand.lastRoot,
		stateManager,
		setGlobalStateMock,
		flushPendingStateMock,
		printWarningMock: vi.fn(),
		readStdinIfPipedMock: vi.fn(async () => null),
		runPlainTextTaskMock: vi.fn(async () => true),
		selectOutputModeMock: vi.fn(() => ({ usePlainTextMode: true, reason: "json" })),
		getProviderModelIdKeyMock: vi.fn(() => "act:anthropic:modelKey"),
	}
})

vi.mock("commander", () => {
	const Command = class {
		public commands: any[] = []
		public actionHandler?: (...args: any[]) => any
		static lastRoot: any
		constructor(public _name = "") {
			if (!_name) Command.lastRoot = this
		}
		name(v: string) {
			this._name = v
			return this
		}
		description() {
			return this
		}
		version() {
			return this
		}
		enablePositionalOptions() {
			return this
		}
		command(name: string) {
			const c = new Command(name)
			this.commands.push(c)
			return c
		}
		alias() {
			return this
		}
		argument() {
			return this
		}
		option() {
			return this
		}
		action(fn: (...args: any[]) => any) {
			this.actionHandler = fn
			return this
		}
		parse() {
			return this
		}
	}
	return { Command }
})

vi.mock("node:process", async () => {
	const actual = await vi.importActual<any>("node:process")
	return { ...actual, exit: vi.fn() }
})

vi.mock("ink", () => ({ render: vi.fn(() => ({ waitUntilExit: async () => undefined, unmount: vi.fn() })) }))
vi.mock("@/config", () => ({ ClineEndpoint: { initialize: vi.fn(async () => undefined) } }))
vi.mock("@/core/controller", () => ({
	Controller: vi.fn(() => ({ stateManager, dispose: vi.fn(async () => undefined), task: null })),
}))
vi.mock("@/core/storage/StateManager", () => ({ StateManager: { initialize: stateManager.initialize, get: () => stateManager } }))
vi.mock("@/hosts/external/AuthHandler", () => ({
	AuthHandler: { getInstance: () => ({ setEnabled: vi.fn(), getCallbackUrl: vi.fn(async () => "") }) },
}))
vi.mock("@/hosts/host-provider", () => ({
	HostProvider: {
		initialize: vi.fn(),
		get: () => ({
			createWebviewProvider: vi.fn(() => ({ controller: { stateManager, dispose: vi.fn(async () => undefined) } })),
			logToChannel: vi.fn(),
		}),
	},
}))
vi.mock("@/integrations/editor/FileEditProvider", () => ({ FileEditProvider: vi.fn() }))
vi.mock("@/integrations/openai-codex/oauth", () => ({ openAiCodexOAuthManager: { initialize: vi.fn() } }))
vi.mock("@/integrations/terminal/standalone/StandaloneTerminalManager", () => ({ StandaloneTerminalManager: vi.fn() }))
vi.mock("@/services/banner/BannerService", () => ({ BannerService: { initialize: vi.fn() } }))
vi.mock("@/services/error/ErrorService", () => ({
	ErrorService: { initialize: vi.fn(async () => undefined), get: () => ({ dispose: vi.fn(async () => undefined) }) },
}))
vi.mock("@/services/logging/distinctId", () => ({ initializeDistinctId: vi.fn(async () => undefined) }))
vi.mock("@/services/telemetry", () => ({ telemetryService: { captureExtensionActivated: vi.fn(), captureHostEvent: vi.fn() } }))
vi.mock("@/shared/services/Logger", () => ({ Logger: { subscribe: vi.fn(), info: vi.fn(), error: vi.fn() } }))
vi.mock("@/shared/services/Session", () => ({ Session: { reset: vi.fn() } }))
vi.mock("@/shared/storage", () => ({
	ProviderToApiKeyMap: { anthropic: "anthropicApiKey" },
	getProviderModelIdKey: getProviderModelIdKeyMock,
}))

vi.mock("../acp/index.js", () => ({ runAcpMode: vi.fn(async () => undefined) }))
vi.mock("../components/App", () => ({ App: () => null }))
vi.mock("../context/StdinContext", () => ({ checkRawModeSupport: vi.fn(() => true) }))
vi.mock("../controllers", () => ({ createCliHostBridgeProvider: vi.fn(() => ({})) }))
vi.mock("../controllers/CliCommentReviewController", () => ({ CliCommentReviewController: vi.fn() }))
vi.mock("../controllers/CliWebviewProvider", () => ({ CliWebviewProvider: vi.fn() }))
vi.mock("../utils/console", () => ({ restoreConsole: vi.fn() }))
vi.mock("../utils/display", () => ({ printInfo: vi.fn(), printWarning: printWarningMock }))
vi.mock("../utils/parser", () => ({
	parseImagesFromInput: vi.fn((p: string) => ({ prompt: p, imagePaths: [] })),
	processImagePaths: vi.fn(async () => []),
}))
vi.mock("../utils/path", () => ({ CLINE_CLI_DIR: { log: "/tmp/log" }, getCliBinaryPath: vi.fn() }))
vi.mock("../utils/piped", () => ({ readStdinIfPiped: readStdinIfPipedMock }))
vi.mock("../utils/plain-text-task", () => ({ runPlainTextTask: runPlainTextTaskMock }))
vi.mock("../utils/provider-config", () => ({ applyProviderConfig: vi.fn(async () => undefined) }))
vi.mock("../utils/mode-selection", () => ({ selectOutputMode: selectOutputModeMock }))
vi.mock("../utils/providers", () => ({ getValidCliProviders: vi.fn(() => ["anthropic"]), isValidCliProvider: vi.fn(() => true) }))
vi.mock("../utils/update", () => ({ autoUpdateOnStartup: vi.fn(), checkForUpdates: vi.fn(async () => undefined) }))
vi.mock("../vscode-context", () => ({
	initializeCliContext: vi.fn(() => ({ extensionContext: {}, DATA_DIR: "/tmp/data", EXTENSION_DIR: "/tmp/ext" })),
}))
vi.mock("../vscode-shim", () => ({
	CLI_LOG_FILE: "/tmp/log",
	shutdownEvent: { fire: vi.fn() },
	window: { createOutputChannel: vi.fn(() => ({ appendLine: vi.fn() })) },
}))

describe("index coverage helpers (indirect)", () => {
	beforeEach(() => {
		vi.resetModules()
		vi.clearAllMocks()
		stateManager._getTaskHistory = []
		stateManager._welcome = undefined
		stateManager._apiConfig = { anthropicApiKey: "k", actModeApiProvider: "anthropic", planModeApiProvider: "anthropic" }
		stateManager._mode = "act"
	})

	it("findTaskInHistory path: resume with missing task warns", async () => {
		await import("../index")
		const program = (await import("commander" as any)).Command.lastRoot
		const taskCommand = program.commands.find((c: any) => c._name === "task")

		await taskCommand.actionHandler("continue work", { taskId: "missing-id", json: true })

		expect(printWarningMock).toHaveBeenCalledWith("Task not found: missing-id")
	})

	it("isAuthConfigured/checkAnyProviderConfigured path sets welcome flag", async () => {
		stateManager._welcome = undefined
		stateManager._apiConfig = { anthropicApiKey: "configured" }

		await import("../index")
		const program = (await import("commander" as any)).Command.lastRoot
		await program.actionHandler(undefined, {})

		expect(setGlobalStateMock).toHaveBeenCalledWith("welcomeViewCompleted", true)
		expect(flushPendingStateMock).toHaveBeenCalled()
	})

	it("applyTaskOptions/getModeSelection path applies mode/model/thinking/yolo", async () => {
		await import("../index")
		const program = (await import("commander" as any)).Command.lastRoot
		const taskCommand = program.commands.find((c: any) => c._name === "task")

		await taskCommand.actionHandler("implement feature", {
			plan: true,
			model: "claude-test",
			thinking: true,
			yolo: true,
			json: true,
		})

		expect(selectOutputModeMock).toHaveBeenCalled()
		expect(setGlobalStateMock).toHaveBeenCalledWith("mode", "plan")
		expect(getProviderModelIdKeyMock).toHaveBeenCalled()
		expect(setGlobalStateMock).toHaveBeenCalledWith("act:anthropic:modelKey", "claude-test")
		expect(setGlobalStateMock).toHaveBeenCalledWith("actModeThinkingBudgetTokens", 1024)
		expect(setGlobalStateMock).toHaveBeenCalledWith("yoloModeToggled", true)
		expect(runPlainTextTaskMock).toHaveBeenCalled()
	})
})
