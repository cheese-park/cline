import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type UpdateModule = typeof import("./update")

interface UpdateModuleMocks {
	module: UpdateModule
	fetchMock: ReturnType<typeof vi.fn>
	spawnMock: ReturnType<typeof vi.fn>
	realpathSyncMock: ReturnType<typeof vi.fn>
}

async function loadUpdateModule(options?: {
	scriptPath?: string
	fetchImpl?: () => Promise<{ ok: boolean; json?: () => Promise<unknown> }>
}): Promise<UpdateModuleMocks> {
	vi.resetModules()

	const fetchMock = vi.fn(
		options?.fetchImpl ??
			(async () => ({
				ok: false,
			})),
	)
	const spawnMock = vi.fn(() => ({
		unref: vi.fn(),
		on: vi.fn(),
	}))
	const realpathSyncMock = vi.fn(() => options?.scriptPath ?? "/tmp/unknown-installation")

	vi.doMock("node:child_process", () => ({
		spawn: spawnMock,
	}))

	vi.doMock("node:fs", () => ({
		realpathSync: realpathSyncMock,
	}))

	vi.doMock("@/shared/net", () => ({
		fetch: fetchMock,
	}))

	vi.doMock("./display", () => ({
		printInfo: vi.fn(),
		printWarning: vi.fn(),
	}))

	const module = await import("./update")

	return {
		module,
		fetchMock,
		spawnMock,
		realpathSyncMock,
	}
}

describe("update", () => {
	const originalEnv = { ...process.env }
	const originalArgv = [...process.argv]

	beforeEach(() => {
		process.env = { ...originalEnv }
		process.argv = [...originalArgv]
	})

	afterEach(() => {
		process.env = { ...originalEnv }
		process.argv = [...originalArgv]
		vi.restoreAllMocks()
		vi.resetModules()
	})

	describe("PackageManager enum", () => {
		it("has npm value", async () => {
			const { module } = await loadUpdateModule()
			expect(module.PackageManager.NPM).toBe("npm")
		})

		it("has pnpm value", async () => {
			const { module } = await loadUpdateModule()
			expect(module.PackageManager.PNPM).toBe("pnpm")
		})

		it("has yarn value", async () => {
			const { module } = await loadUpdateModule()
			expect(module.PackageManager.YARN).toBe("yarn")
		})

		it("has bun value", async () => {
			const { module } = await loadUpdateModule()
			expect(module.PackageManager.BUN).toBe("bun")
		})

		it("has npx value", async () => {
			const { module } = await loadUpdateModule()
			expect(module.PackageManager.NPX).toBe("npx")
		})

		it("has unknown value", async () => {
			const { module } = await loadUpdateModule()
			expect(module.PackageManager.UNKNOWN).toBe("unknown")
		})
	})

	describe("autoUpdateOnStartup", () => {
		it("skips auto update in dev mode", async () => {
			const { module, fetchMock, spawnMock } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
			})
			process.env.IS_DEV = "true"

			module.autoUpdateOnStartup("1.2.3")

			expect(fetchMock).not.toHaveBeenCalled()
			expect(spawnMock).not.toHaveBeenCalled()
		})

		it("skips auto update when CLINE_NO_AUTO_UPDATE=1", async () => {
			const { module, fetchMock, spawnMock } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
			})
			process.env.CLINE_NO_AUTO_UPDATE = "1"

			module.autoUpdateOnStartup("1.2.3")

			expect(fetchMock).not.toHaveBeenCalled()
			expect(spawnMock).not.toHaveBeenCalled()
		})

		it("skips when installation cannot be mapped to an update command", async () => {
			const { module, fetchMock, spawnMock } = await loadUpdateModule({
				scriptPath: "/opt/custom/cline.js",
			})

			module.autoUpdateOnStartup("1.2.3")

			expect(fetchMock).not.toHaveBeenCalled()
			expect(spawnMock).not.toHaveBeenCalled()
		})

		it("uses nightly npm tag when current version is nightly", async () => {
			const { module, fetchMock } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
			})

			module.autoUpdateOnStartup("1.2.3-nightly.1736365200")
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(fetchMock).toHaveBeenCalledWith("https://registry.npmjs.org/cline/nightly")
		})

		it("uses latest npm tag for stable versions", async () => {
			const { module, fetchMock } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
			})

			module.autoUpdateOnStartup("1.2.3")
			await new Promise((resolve) => setTimeout(resolve, 0))

			expect(fetchMock).toHaveBeenCalledWith("https://registry.npmjs.org/cline/latest")
		})

		it("does not throw when network check fails", async () => {
			const { module } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
				fetchImpl: async () => {
					throw new Error("network down")
				},
			})

			expect(() => module.autoUpdateOnStartup("1.2.3")).not.toThrow()
		})

		it("spawns update when newer version is available (npm install)", async () => {
			const { module, fetchMock, spawnMock } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
				fetchImpl: async () => ({
					ok: true,
					json: async () => ({ version: "2.0.0" }),
				}),
			})

			module.autoUpdateOnStartup("1.0.0")
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(fetchMock).toHaveBeenCalled()
			expect(spawnMock).toHaveBeenCalledWith(
				expect.stringContaining("npm install -g cline@latest"),
				expect.objectContaining({ shell: true, detached: true }),
			)
		})

		it("does not spawn update when current version is same as latest", async () => {
			const { module, fetchMock, spawnMock } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
				fetchImpl: async () => ({
					ok: true,
					json: async () => ({ version: "1.2.3" }),
				}),
			})

			module.autoUpdateOnStartup("1.2.3")

			// Wait for the fire-and-forget async checkAndUpdate to complete
			await vi.waitFor(() => {
				expect(fetchMock).toHaveBeenCalled()
			})

			expect(spawnMock).not.toHaveBeenCalled()
		})

		it("does not spawn update when current version is newer", async () => {
			const { module, spawnMock } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
				fetchImpl: async () => ({
					ok: true,
					json: async () => ({ version: "1.0.0" }),
				}),
			})

			module.autoUpdateOnStartup("2.0.0")
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(spawnMock).not.toHaveBeenCalled()
		})

		it("does not spawn update when fetch returns null version", async () => {
			const { module, spawnMock } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
				fetchImpl: async () => ({
					ok: true,
					json: async () => ({}),
				}),
			})

			module.autoUpdateOnStartup("1.0.0")
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(spawnMock).not.toHaveBeenCalled()
		})

		it("skips update for npx installations", async () => {
			const { module, fetchMock } = await loadUpdateModule({
				scriptPath: "/home/user/.npm/_npx/abc123/node_modules/cline/dist/index.js",
			})

			module.autoUpdateOnStartup("1.0.0")
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(fetchMock).not.toHaveBeenCalled()
		})

		it("detects pnpm global and uses pnpm update command", async () => {
			const { module, spawnMock } = await loadUpdateModule({
				scriptPath: "/home/user/.pnpm/global/5/node_modules/cline/dist/index.js",
				fetchImpl: async () => ({
					ok: true,
					json: async () => ({ version: "2.0.0" }),
				}),
			})

			module.autoUpdateOnStartup("1.0.0")
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(spawnMock).toHaveBeenCalledWith(
				expect.stringContaining("pnpm add -g cline@latest"),
				expect.objectContaining({ shell: true }),
			)
		})

		it("detects yarn global and uses yarn update command", async () => {
			const { module, spawnMock } = await loadUpdateModule({
				scriptPath: "/home/user/.yarn/global/node_modules/cline/dist/index.js",
				fetchImpl: async () => ({
					ok: true,
					json: async () => ({ version: "2.0.0" }),
				}),
			})

			module.autoUpdateOnStartup("1.0.0")
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(spawnMock).toHaveBeenCalledWith(
				expect.stringContaining("yarn global add cline@latest"),
				expect.objectContaining({ shell: true }),
			)
		})

		it("detects bun global and uses bun update command", async () => {
			const { module, spawnMock } = await loadUpdateModule({
				scriptPath: "/home/user/.bun/bin/cline",
				fetchImpl: async () => ({
					ok: true,
					json: async () => ({ version: "2.0.0" }),
				}),
			})

			module.autoUpdateOnStartup("1.0.0")
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(spawnMock).toHaveBeenCalledWith(
				expect.stringContaining("bun add -g cline@latest"),
				expect.objectContaining({ shell: true }),
			)
		})

		it("compares nightly versions by timestamp", async () => {
			const { module, spawnMock } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
				fetchImpl: async () => ({
					ok: true,
					json: async () => ({ version: "1.0.0-nightly.9999999999" }),
				}),
			})

			module.autoUpdateOnStartup("1.0.0-nightly.1000000000")
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(spawnMock).toHaveBeenCalledWith(
				expect.stringContaining("npm install -g cline@nightly"),
				expect.objectContaining({ shell: true }),
			)
		})

		it("nightly considered less than stable of same base version", async () => {
			const { module, spawnMock } = await loadUpdateModule({
				scriptPath: "/usr/lib/node_modules/cline/dist/index.js",
				fetchImpl: async () => ({
					ok: true,
					json: async () => ({ version: "1.0.0" }),
				}),
			})

			module.autoUpdateOnStartup("1.0.0-nightly.1736365200")
			await new Promise((resolve) => setTimeout(resolve, 50))

			expect(spawnMock).toHaveBeenCalled()
		})

		it("handles realpathSync throwing gracefully", async () => {
			const { module, fetchMock } = await loadUpdateModule()

			vi.doMock("node:fs", () => ({
				realpathSync: () => {
					throw new Error("ENOENT")
				},
			}))

			expect(() => module.autoUpdateOnStartup("1.0.0")).not.toThrow()
		})
	})
})
