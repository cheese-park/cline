import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/registry", () => ({
	ExtensionRegistryInfo: { id: "test.extension" },
}))

vi.mock("@/shared/storage", () => ({
	ClineFileStorage: class<T = any> {
		private store = new Map<string, T>()
		get<U = T>(key: string) {
			return this.store.get(key) as U | undefined
		}
		set(key: string, value: T) {
			this.store.set(key, value)
		}
		delete(key: string) {
			this.store.delete(key)
		}
	},
}))

vi.mock("node:fs", () => ({
	mkdirSync: vi.fn(),
}))

vi.mock("./vscode-shim", () => ({
	EnvironmentVariableCollection: class {
		persistent = true
	},
	ExtensionKind: { UI: 1 },
	ExtensionMode: { Production: 1, Development: 2 },
	URI: { file: (value: string) => ({ fsPath: value, path: value, toString: () => value }) },
	readJson: vi.fn(() => ({ name: "cline" })),
}))

import { mkdirSync } from "node:fs"
import { initializeCliContext } from "./vscode-context"

describe("vscode-context", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		vi.stubEnv("IS_DEV", "false")
		vi.stubEnv("CLINE_DIR", "/tmp/cline-test")
		vi.stubEnv("WORKSPACE_STORAGE_DIR", "")
		vi.spyOn(process, "cwd").mockReturnValue("/tmp/project-a")
	})

	afterEach(() => {
		vi.unstubAllEnvs()
		vi.restoreAllMocks()
	})

	it("hash behavior is consistent for same workspace path", () => {
		const a = initializeCliContext({ clineDir: "/tmp/a", workspaceDir: "/workspace/same" })
		const b = initializeCliContext({ clineDir: "/tmp/a", workspaceDir: "/workspace/same" })

		expect(a.WORKSPACE_STORAGE_DIR).toBe(b.WORKSPACE_STORAGE_DIR)
	})

	it("hash behavior differs for different workspace paths", () => {
		const a = initializeCliContext({ clineDir: "/tmp/a", workspaceDir: "/workspace/one" })
		const b = initializeCliContext({ clineDir: "/tmp/a", workspaceDir: "/workspace/two" })

		expect(a.WORKSPACE_STORAGE_DIR).not.toBe(b.WORKSPACE_STORAGE_DIR)
	})

	it("hash behavior handles empty workspace path", () => {
		const result = initializeCliContext({ clineDir: "/tmp/a", workspaceDir: "" })
		expect(result.WORKSPACE_STORAGE_DIR).toContain("/tmp/a/data/workspaces/")
	})

	it("Memento-backed globalState can be instantiated and read/write values", async () => {
		const { extensionContext } = initializeCliContext({ clineDir: "/tmp/a", workspaceDir: "/workspace/a" })

		await extensionContext.globalState.update("foo", "bar")
		expect(extensionContext.globalState.get("foo")).toBe("bar")
		expect(extensionContext.globalState.get("vscodeTerminalExecutionMode")).toBe("backgroundExec")
	})

	it("initializeCliContext creates directories and returns expected structure", () => {
		const result = initializeCliContext({ clineDir: "/tmp/custom", workspaceDir: "/repo/main" })

		expect(vi.mocked(mkdirSync)).toHaveBeenCalledTimes(2)
		expect(result.DATA_DIR).toBe("/tmp/custom/data")
		expect(result.WORKSPACE_STORAGE_DIR).toContain("/tmp/custom/data/workspaces/")
		expect(result.extensionContext).toBeTruthy()
		expect(result.extensionContext.globalState).toBeTruthy()
		expect(result.extensionContext.secrets).toBeTruthy()
		expect(typeof result.extensionContext.asAbsolutePath).toBe("function")
	})
})
