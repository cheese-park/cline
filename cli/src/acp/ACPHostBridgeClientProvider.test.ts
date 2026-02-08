import { describe, expect, it, vi } from "vitest"

vi.mock("@/shared/services/Logger", () => ({ Logger: { debug: vi.fn() } }))
vi.mock("@/shared/cline", () => ({ ClineClient: { Cli: 1 } }))
// @ts-expect-error Proto package is virtual in tests.
vi.mock(import("@shared/proto/index"), () => {
	const create = (value: any = {}) => value
	return {
		cline: {
			Empty: { create },
			String: { create },
		},
		host: {
			Setting: { DISABLED: 0 },
			OpenDiffResponse: { create },
			GetDocumentTextResponse: { create },
			ReplaceTextResponse: { create },
			ScrollDiffResponse: { create },
			TruncateDocumentResponse: { create },
			SaveDocumentResponse: { create },
			CloseAllDiffsResponse: { create },
			OpenMultiFileDiffResponse: { create },
			GetHostVersionResponse: { create },
			GetTelemetrySettingsResponse: { create },
			TelemetrySettingsEvent: { create },
			TextEditorInfo: { create },
			SelectedResources: { create },
			SelectedResponse: { create },
			ShowInputBoxResponse: { create },
			ShowSaveDialogResponse: { create },
			OpenFileResponse: { create },
			OpenSettingsResponse: { create },
			GetOpenTabsResponse: { create },
			GetVisibleTabsResponse: { create },
			GetActiveEditorResponse: { create },
			GetWorkspacePathsResponse: { create },
			SaveOpenDocumentIfDirtyResponse: { create },
			GetDiagnosticsResponse: { create },
			OpenProblemsPanelResponse: { create },
			OpenInFileExplorerPanelResponse: { create },
			OpenClineSidebarPanelResponse: { create },
			OpenTerminalResponse: { create },
			ExecuteCommandInTerminalResponse: { create },
			OpenFolderResponse: { create },
		},
	}
})

const { ACPHostBridgeClientProvider } = await import("./ACPHostBridgeClientProvider")

describe("ACPHostBridgeClientProvider", () => {
	const sessionIdResolver = () => "session-1"
	const cwdResolver = () => "/workspace/test"

	it("constructs all service clients", () => {
		const provider = new ACPHostBridgeClientProvider({ terminal: true } as any, sessionIdResolver, cwdResolver, "2.3.4")
		expect(provider.diffClient).toBeTruthy()
		expect(provider.envClient).toBeTruthy()
		expect(provider.windowClient).toBeTruthy()
		expect(provider.workspaceClient).toBeTruthy()
	})

	it("diff client methods return expected stub structures", async () => {
		const provider = new ACPHostBridgeClientProvider(undefined, sessionIdResolver, cwdResolver)
		const diffClient = provider.diffClient as any

		const getText = await diffClient.getDocumentText({ diffId: "d1" })
		expect(getText.content).toBe("")

		expect(await diffClient.openDiff({})).toEqual(expect.any(Object))
		expect(await diffClient.replaceText({})).toEqual(expect.any(Object))
		expect(await diffClient.scrollDiff({})).toEqual(expect.any(Object))
		expect(await diffClient.truncateDocument({})).toEqual(expect.any(Object))
		expect(await diffClient.saveDocument({})).toEqual(expect.any(Object))
		expect(await diffClient.closeAllDiffs({})).toEqual(expect.any(Object))
		expect(await diffClient.openMultiFileDiff({})).toEqual(expect.any(Object))
	})

	it("env client returns version and telemetry defaults", async () => {
		const provider = new ACPHostBridgeClientProvider(undefined, sessionIdResolver, cwdResolver, "9.9.9")
		const env = provider.envClient as any

		const hostVersion = await env.getHostVersion({})
		expect(hostVersion.version).toBe("9.9.9")
		expect(hostVersion.platform).toBe("Cline ACP Agent")

		const telemetry = await env.getTelemetrySettings({})
		expect(telemetry).toEqual(expect.objectContaining({ isEnabled: expect.any(Number) }))

		const events: any[] = []
		const unsubscribe = env.subscribeToTelemetrySettings({}, { onResponse: (e: unknown) => events.push(e) })
		expect(events.length).toBe(1)
		expect(typeof unsubscribe).toBe("function")
	})

	it("window client returns proto-like data", async () => {
		const provider = new ACPHostBridgeClientProvider(undefined, sessionIdResolver, cwdResolver)
		const win = provider.windowClient as any

		const editor = await win.showTextDocument({ path: "/file.ts" })
		expect(editor.documentPath).toBe("/file.ts")

		const openTabs = await win.getOpenTabs({})
		expect(openTabs.paths).toEqual([])

		const visibleTabs = await win.getVisibleTabs({})
		expect(visibleTabs.paths).toEqual([])
	})

	it("workspace client uses cwd resolver and stubs responses", async () => {
		const provider = new ACPHostBridgeClientProvider({ terminal: true } as any, sessionIdResolver, cwdResolver)
		const workspace = provider.workspaceClient as any

		const paths = await workspace.getWorkspacePaths({})
		expect(paths.paths).toEqual(["/workspace/test"])

		const diagnostics = await workspace.getDiagnostics({})
		expect(diagnostics.fileDiagnostics).toEqual([])

		const folder = await workspace.openFolder({ path: "/new-folder" })
		expect(folder.success).toBe(true)
	})
})
