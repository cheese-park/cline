/**
 * Tests for acp/index.ts
 *
 * Tests the ACP module entry point, including:
 * - Console redirection to stderr
 * - Module exports
 * - restoreConsole functionality
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock dependencies to prevent actual stdio operations
vi.mock("@agentclientprotocol/sdk", () => ({
	AgentSideConnection: vi.fn(),
	ndJsonStream: vi.fn(),
}))

vi.mock("@/shared/services/Logger", () => ({
	Logger: {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock("../../../package.json", () => ({
	version: "1.0.0-test",
}))

vi.mock("./AcpAgent.js", () => ({
	AcpAgent: vi.fn(),
}))

vi.mock("./streamUtils.js", () => ({
	nodeToWebReadable: vi.fn().mockReturnValue({}),
	nodeToWebWritable: vi.fn().mockReturnValue({}),
}))

vi.mock("../agent/ClineAgent.js", () => ({
	ClineAgent: vi.fn(),
}))

vi.mock("../agent/ClineSessionEmitter.js", () => ({
	ClineSessionEmitter: vi.fn(),
}))

// =============================================================================
// Tests: Module Exports
// =============================================================================

describe("acp/index module", () => {
	it("should export restoreConsole function", async () => {
		const acpModule = await import("./index")
		expect(typeof acpModule.restoreConsole).toBe("function")
	})

	it("should export runAcpMode function", async () => {
		const acpModule = await import("./index")
		expect(typeof acpModule.runAcpMode).toBe("function")
	})

	it("should export ClineAgent", async () => {
		const acpModule = await import("./index")
		expect(acpModule.ClineAgent).toBeDefined()
	})

	it("should export AcpAgent", async () => {
		const acpModule = await import("./index")
		expect(acpModule.AcpAgent).toBeDefined()
	})

	it("should export ClineSessionEmitter", async () => {
		const acpModule = await import("./index")
		expect(acpModule.ClineSessionEmitter).toBeDefined()
	})

	it("exports ACP classes and helpers with correct types", async () => {
		const mod = await import("./index")
		expect(mod.AcpAgent).toBeTypeOf("function")
		expect(mod.ClineAgent).toBeTypeOf("function")
		expect(mod.ClineSessionEmitter).toBeTypeOf("function")
		expect(mod.runAcpMode).toBeTypeOf("function")
		expect(mod.restoreConsole).toBeTypeOf("function")
	})
})

// =============================================================================
// Tests: restoreConsole
// =============================================================================

describe("restoreConsole", () => {
	let originalLog: typeof console.log
	let originalInfo: typeof console.info
	let originalWarn: typeof console.warn
	let originalDebug: typeof console.debug
	let originalError: typeof console.error

	beforeEach(() => {
		// Save original console methods
		originalLog = console.log
		originalInfo = console.info
		originalWarn = console.warn
		originalDebug = console.debug
		originalError = console.error
	})

	afterEach(() => {
		// Restore console methods
		console.log = originalLog
		console.info = originalInfo
		console.warn = originalWarn
		console.debug = originalDebug
		console.error = originalError
	})

	it("should restore console methods after being called", async () => {
		const { restoreConsole } = await import("./index")

		// Modify console methods (simulating what redirectConsoleToStderr does)
		console.log = (...args) => console.error(...args)
		console.info = (...args) => console.error(...args)

		// Restore should set them back
		restoreConsole()

		// After restore, console.log should be a function (not throwing)
		expect(typeof console.log).toBe("function")
		expect(typeof console.info).toBe("function")
		expect(typeof console.warn).toBe("function")
		expect(typeof console.debug).toBe("function")
		expect(typeof console.error).toBe("function")
	})

	it("restoreConsole resets console methods to originals", async () => {
		const mod = await import("./index")

		console.log = vi.fn() as any
		console.info = vi.fn() as any
		console.warn = vi.fn() as any
		console.debug = vi.fn() as any
		console.error = vi.fn() as any

		mod.restoreConsole()

		expect(console.log).toBe(originalLog)
		expect(console.info).toBe(originalInfo)
		expect(console.warn).toBe(originalWarn)
		expect(console.debug).toBe(originalDebug)
		expect(console.error).toBe(originalError)
	})
})
