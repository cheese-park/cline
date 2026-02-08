const create = <T>(value?: T): T => value ?? ({} as T)

export const cline = {
	Empty: { create },
	String: { create },
}

export const host = {
	Setting: {
		DISABLED: 0,
		ENABLED: 1,
	},
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
	ShowMessageType: {
		ERROR: 0,
		WARNING: 1,
		INFORMATION: 2,
	},
}
