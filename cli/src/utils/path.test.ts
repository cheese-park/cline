import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("@vscode/ripgrep", () => ({
	rgPath: "/mocked/rg/path",
}))

vi.mock("node:child_process", () => ({
	execFileSync: vi.fn(),
}))

import { CLINE_CLI_DIR, getCliBinaryPath } from "./path"

describe("path utils", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("CLINE_CLI_DIR", () => {
		it("should export data and log directories as non-empty strings", () => {
			expect(typeof CLINE_CLI_DIR.data).toBe("string")
			expect(CLINE_CLI_DIR.data.length).toBeGreaterThan(0)
			expect(typeof CLINE_CLI_DIR.log).toBe("string")
			expect(CLINE_CLI_DIR.log).toBeTruthy()
		})

		it("CLINE_CLI_DIR.log contains logs", () => {
			expect(CLINE_CLI_DIR.log).toContain("logs")
		})

		it("should use CLINE_DATA_DIR env var if set", async () => {
			const originalDataDir = process.env.CLINE_DATA_DIR
			process.env.CLINE_DATA_DIR = "/tmp/custom-cline-data"
			vi.resetModules()

			const mod = await import("./path")
			expect(mod.CLINE_CLI_DIR.data).toBe("/tmp/custom-cline-data")
			expect(mod.CLINE_CLI_DIR.log).toBe("/tmp/custom-cline-data/logs")

			// Restore
			if (originalDataDir === undefined) {
				delete process.env.CLINE_DATA_DIR
			} else {
				process.env.CLINE_DATA_DIR = originalDataDir
			}
		})
	})

	describe("getCliBinaryPath", () => {
		it("should return system path when rg is found in PATH", async () => {
			const { execFileSync } = await import("node:child_process")
			vi.mocked(execFileSync).mockReturnValue("/usr/local/bin/rg\n")

			await expect(getCliBinaryPath("rg")).resolves.toBe("/usr/local/bin/rg")
		})

		it("should fall back to bundled ripgrep when not in PATH", async () => {
			const { execFileSync } = await import("node:child_process")
			vi.mocked(execFileSync).mockImplementation(() => {
				throw new Error("not found")
			})

			await expect(getCliBinaryPath("rg")).resolves.toBe("/mocked/rg/path")
		})

		it("should throw for unsupported binary name", async () => {
			await expect(getCliBinaryPath("nonexistent")).rejects.toThrow("not supported")
		})

		it("should throw for unsupported binary names like python", async () => {
			const { getCliBinaryPath: getBin } = await import("./path")
			await expect(getBin("python")).rejects.toThrow("not supported")
		})

		it("should accept rg-prefixed names", async () => {
			const cp = await import("node:child_process")
			vi.mocked(cp.execFileSync).mockImplementation(() => {
				throw new Error("not found")
			})

			const { getCliBinaryPath: getBin } = await import("./path")
			// "rg" starts with "rg" so it should work
			const result = await getBin("rg")
			expect(result).toBe("/mocked/rg/path")
		})
	})
})
