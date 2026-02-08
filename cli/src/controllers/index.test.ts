import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

declare module "open" {
	const open: (target: string) => Promise<void>
	export default open
}

// Mock dependencies
vi.mock("@shared/proto/index", () => {
	const createFactory = (defaults: Record<string, any> = {}) => ({
		create: (overrides: Record<string, any> = {}) => ({ ...defaults, ...overrides }),
	})

	return {
		host: {
			OpenDiffResponse: createFactory(),
			GetDocumentTextResponse: createFactory({ content: "" }),
			ReplaceTextResponse: createFactory(),
			ScrollDiffResponse: createFactory(),
			TruncateDocumentResponse: createFactory(),
			SaveDocumentResponse: createFactory(),
			CloseAllDiffsResponse: createFactory(),
			OpenMultiFileDiffResponse: createFactory(),
			GetHostVersionResponse: createFactory(),
			GetTelemetrySettingsResponse: createFactory(),
			TelemetrySettingsEvent: createFactory(),
			TextEditorInfo: createFactory(),
			SelectedResources: createFactory({ paths: [] }),
			SelectedResponse: createFactory(),
			ShowInputBoxResponse: createFactory({ response: "" }),
			ShowSaveDialogResponse: createFactory({ selectedPath: "" }),
			OpenFileResponse: createFactory(),
			OpenSettingsResponse: createFactory(),
			GetOpenTabsResponse: createFactory({ paths: [] }),
			GetVisibleTabsResponse: createFactory({ paths: [] }),
			GetActiveEditorResponse: createFactory(),
			GetWorkspacePathsResponse: createFactory(),
			SaveOpenDocumentIfDirtyResponse: createFactory(),
			GetDiagnosticsResponse: createFactory({ fileDiagnostics: [] }),
			OpenProblemsPanelResponse: createFactory(),
			OpenInFileExplorerPanelResponse: createFactory(),
			OpenClineSidebarPanelResponse: createFactory(),
			OpenTerminalResponse: createFactory(),
			ExecuteCommandInTerminalResponse: createFactory(),
			OpenFolderResponse: createFactory(),
			Setting: { ENABLED: 1, DISABLED: 0 },
			ShowMessageType: { ERROR: 0, WARNING: 1, INFORMATION: 2 },
		},
		cline: {
			Empty: createFactory(),
			String: createFactory(),
		},
	}
})

vi.mock("@/core/storage/StateManager", () => ({
	StateManager: {
		get: vi.fn(() => ({
			getGlobalSettingsKey: vi.fn((key: string) => {
				if (key === "telemetrySetting") return "enabled"
				return null
			}),
		})),
	},
}))

vi.mock("@/shared/cline", () => ({
	ClineClient: { Cli: "cli" },
}))

vi.mock("../../package.json", () => ({
	version: "1.0.0-test",
}))

vi.mock("open", () => ({
	default: vi.fn(async () => {}),
}))

const mockPrintInfo = vi.fn()
const mockPrintWarning = vi.fn()
const mockPrintError = vi.fn()
vi.mock("../utils/display", () => ({
	printInfo: (...args: any[]) => mockPrintInfo(...args),
	printWarning: (...args: any[]) => mockPrintWarning(...args),
	printError: (...args: any[]) => mockPrintError(...args),
}))

import {
	CliDiffServiceClient,
	CliEnvServiceClient,
	CliWindowServiceClient,
	CliWorkspaceServiceClient,
	createCliHostBridgeProvider,
} from "./index"

describe("CliDiffServiceClient", () => {
	let client: CliDiffServiceClient

	beforeEach(() => {
		vi.clearAllMocks()
		client = new CliDiffServiceClient()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should return empty response for openDiff", async () => {
		const result = await client.openDiff({} as any)
		expect(result).toBeDefined()
	})

	it("should return empty content for getDocumentText", async () => {
		const result = await client.getDocumentText({} as any)
		expect(result.content).toBe("")
	})

	it("should return empty response for replaceText", async () => {
		const result = await client.replaceText({} as any)
		expect(result).toBeDefined()
	})

	it("should return empty response for scrollDiff", async () => {
		const result = await client.scrollDiff({} as any)
		expect(result).toBeDefined()
	})

	it("should return empty response for truncateDocument", async () => {
		const result = await client.truncateDocument({} as any)
		expect(result).toBeDefined()
	})

	it("should return empty response for saveDocument", async () => {
		const result = await client.saveDocument({} as any)
		expect(result).toBeDefined()
	})

	it("should return empty response for closeAllDiffs", async () => {
		const result = await client.closeAllDiffs({} as any)
		expect(result).toBeDefined()
	})

	it("should print info for openMultiFileDiff with diffs", async () => {
		const result = await client.openMultiFileDiff({
			title: "Test Diff",
			diffs: [{ filePath: "file1.ts" }, { filePath: "file2.ts" }],
		} as any)
		expect(result).toBeDefined()
		expect(mockPrintInfo).toHaveBeenCalledWith(expect.stringContaining("Test Diff"))
		expect(mockPrintInfo).toHaveBeenCalledWith(expect.stringContaining("2 file(s)"))
	})

	it("should not print for openMultiFileDiff with no diffs", async () => {
		mockPrintInfo.mockClear()
		await client.openMultiFileDiff({ diffs: [] } as any)
		expect(mockPrintInfo).not.toHaveBeenCalled()
	})
})

describe("CliEnvServiceClient", () => {
	let client: CliEnvServiceClient

	beforeEach(() => {
		vi.clearAllMocks()
		client = new CliEnvServiceClient()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should write and read clipboard content", async () => {
		await client.clipboardWriteText({ value: "test content" } as any)
		const result = await client.clipboardReadText({} as any)
		expect(result.value).toBe("test content")
	})

	it("should return empty clipboard when nothing written", async () => {
		const result = await client.clipboardReadText({} as any)
		expect(result.value).toBe("")
	})

	it("should return host version info", async () => {
		const result = await client.getHostVersion({} as any)
		expect(result.version).toBe("1.0.0-test")
		expect(result.platform).toBe("Cline CLI - Node.js")
		expect(result.clineType).toBe("cli")
	})

	it("should return empty IDE redirect URI", async () => {
		const result = await client.getIdeRedirectUri({} as any)
		expect(result.value).toBe("")
	})

	it("should return telemetry settings", async () => {
		const result = await client.getTelemetrySettings({} as any)
		expect(result.isEnabled).toBeDefined()
	})

	it("should subscribe to telemetry settings and emit initial event", () => {
		const onResponse = vi.fn()
		const unsubscribe = client.subscribeToTelemetrySettings({} as any, {
			onResponse,
			onError: vi.fn(),
			onComplete: vi.fn(),
		})
		expect(onResponse).toHaveBeenCalledTimes(1)
		expect(typeof unsubscribe).toBe("function")
	})

	it("should return empty for debugLog in non-dev mode", async () => {
		const result = await client.debugLog({ value: "test" } as any)
		expect(result).toBeDefined()
	})

	it("should return empty for shutdown", async () => {
		const result = await client.shutdown({} as any)
		expect(result).toBeDefined()
		expect(mockPrintInfo).toHaveBeenCalledWith("Shutting down...")
	})

	it("should open external URL", async () => {
		const result = await client.openExternal({ value: "https://example.com" } as any)
		expect(result).toBeDefined()
		expect(mockPrintInfo).toHaveBeenCalledWith(expect.stringContaining("https://example.com"))
	})

	it("should handle empty URL for openExternal", async () => {
		mockPrintInfo.mockClear()
		const result = await client.openExternal({ value: "" } as any)
		expect(result).toBeDefined()
	})
})

describe("CliWindowServiceClient", () => {
	let client: CliWindowServiceClient

	beforeEach(() => {
		vi.clearAllMocks()
		client = new CliWindowServiceClient()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should show text document", async () => {
		const result = await client.showTextDocument({ path: "/test/file.ts" } as any)
		expect(result.documentPath).toBe("/test/file.ts")
		expect(mockPrintInfo).toHaveBeenCalledWith(expect.stringContaining("/test/file.ts"))
	})

	it("should warn for open dialogue", async () => {
		const result = await client.showOpenDialogue({} as any)
		expect(result.paths).toEqual([])
		expect(mockPrintWarning).toHaveBeenCalledWith(expect.stringContaining("not available"))
	})

	it("should show error message", async () => {
		await client.showMessage({ message: "test error", type: 0 } as any) // ERROR = 0
		expect(mockPrintError).toHaveBeenCalledWith("test error")
	})

	it("should show warning message", async () => {
		await client.showMessage({ message: "test warning", type: 1 } as any) // WARNING = 1
		expect(mockPrintWarning).toHaveBeenCalledWith("test warning")
	})

	it("should show info message", async () => {
		await client.showMessage({ message: "test info", type: 2 } as any) // INFORMATION = 2
		expect(mockPrintInfo).toHaveBeenCalledWith("test info")
	})

	it("should show info message for default type", async () => {
		await client.showMessage({ message: "test default" } as any)
		expect(mockPrintInfo).toHaveBeenCalledWith("test default")
	})

	it("should route messages by severity in sequence", async () => {
		await client.showMessage({ type: 0, message: "err" } as any)
		await client.showMessage({ type: 1, message: "warn" } as any)
		await client.showMessage({ type: 2, message: "info" } as any)

		expect(mockPrintError).toHaveBeenCalledWith("err")
		expect(mockPrintWarning).toHaveBeenCalledWith("warn")
		expect(mockPrintInfo).toHaveBeenCalledWith("info")
	})

	it("should warn for input box", async () => {
		const result = await client.showInputBox({} as any)
		expect(result.response).toBe("")
		expect(mockPrintWarning).toHaveBeenCalled()
	})

	it("should warn for save dialog", async () => {
		const result = await client.showSaveDialog({} as any)
		expect(result.selectedPath).toBe("")
		expect(mockPrintWarning).toHaveBeenCalled()
	})

	it("should open file", async () => {
		const result = await client.openFile({ filePath: "/test/file.ts" } as any)
		expect(result).toBeDefined()
		expect(mockPrintInfo).toHaveBeenCalledWith(expect.stringContaining("/test/file.ts"))
	})

	it("should show settings info", async () => {
		await client.openSettings({} as any)
		expect(mockPrintInfo).toHaveBeenCalledWith(expect.stringContaining("globalState.json"))
	})

	it("should return empty tabs", async () => {
		const result = await client.getOpenTabs({} as any)
		expect(result.paths).toEqual([])
	})

	it("should return empty visible tabs", async () => {
		const result = await client.getVisibleTabs({} as any)
		expect(result.paths).toEqual([])
	})

	it("should return empty active editor", async () => {
		const result = await client.getActiveEditor({} as any)
		expect(result).toBeDefined()
	})
})

describe("CliWorkspaceServiceClient", () => {
	let client: CliWorkspaceServiceClient

	beforeEach(() => {
		vi.clearAllMocks()
		client = new CliWorkspaceServiceClient("/test/workspace")
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should return workspace paths", async () => {
		const result = await client.getWorkspacePaths({} as any)
		expect(result.paths).toEqual(["/test/workspace"])
	})

	it("should use cwd as default workspace path", () => {
		const defaultClient = new CliWorkspaceServiceClient()
		// Just verify it can be constructed without arguments
		expect(defaultClient).toBeDefined()
	})

	it("should update workspace path with setWorkspacePath", async () => {
		client.setWorkspacePath("/new/path")
		const result = await client.getWorkspacePaths({} as any)
		expect(result.paths).toEqual(["/new/path"])
	})

	it("should update workspace path via openFolder", async () => {
		const result = await client.openFolder({ path: "/repo/b" } as any)
		expect(result.success).toBe(true)

		const paths = await client.getWorkspacePaths({} as any)
		expect(paths.paths).toEqual(["/repo/b"])
	})

	it("should return empty for saveOpenDocumentIfDirty", async () => {
		const result = await client.saveOpenDocumentIfDirty({} as any)
		expect(result).toBeDefined()
	})

	it("should return empty diagnostics", async () => {
		const result = await client.getDiagnostics({} as any)
		expect(result.fileDiagnostics).toEqual([])
	})

	it("should print info for openProblemsPanel", async () => {
		await client.openProblemsPanel({} as any)
		expect(mockPrintInfo).toHaveBeenCalledWith(expect.stringContaining("linters"))
	})

	it("should print path for openInFileExplorerPanel", async () => {
		await client.openInFileExplorerPanel({ path: "/test/dir" } as any)
		expect(mockPrintInfo).toHaveBeenCalledWith(expect.stringContaining("/test/dir"))
	})

	it("should return empty for openClineSidebarPanel", async () => {
		const result = await client.openClineSidebarPanel({} as any)
		expect(result).toBeDefined()
	})

	it("should print info for openTerminalPanel", async () => {
		await client.openTerminalPanel({} as any)
		expect(mockPrintInfo).toHaveBeenCalledWith(expect.stringContaining("Terminal"))
	})

	it("should print command for executeCommandInTerminal", async () => {
		await client.executeCommandInTerminal({ command: "npm test" } as any)
		expect(mockPrintInfo).toHaveBeenCalledWith(expect.stringContaining("npm test"))
	})
})

describe("createCliHostBridgeProvider", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should create a provider with all service clients", () => {
		const provider = createCliHostBridgeProvider("/test")
		expect(provider.workspaceClient).toBeInstanceOf(CliWorkspaceServiceClient)
		expect(provider.envClient).toBeInstanceOf(CliEnvServiceClient)
		expect(provider.windowClient).toBeInstanceOf(CliWindowServiceClient)
		expect(provider.diffClient).toBeInstanceOf(CliDiffServiceClient)
	})

	it("should pass workspace path to workspace client", async () => {
		const provider = createCliHostBridgeProvider("/custom/path")
		const paths = await provider.workspaceClient.getWorkspacePaths({} as any)
		expect(paths.paths).toEqual(["/custom/path"])
	})

	it("should work without workspace path argument", () => {
		const provider = createCliHostBridgeProvider()
		expect(provider).toBeDefined()
	})
})
