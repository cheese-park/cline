import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const savedLog = console.log
const savedError = console.error
const savedWarn = console.warn
const savedInfo = console.info
const savedDebug = console.debug

describe("console", () => {
	beforeEach(() => {
		vi.resetModules()
		console.log = savedLog
		console.error = savedError
		console.warn = savedWarn
		console.info = savedInfo
		console.debug = savedDebug
	})

	afterEach(() => {
		console.log = savedLog
		console.error = savedError
		console.warn = savedWarn
		console.info = savedInfo
		console.debug = savedDebug
		vi.restoreAllMocks()
	})

	describe("original console exports", () => {
		it("exports originalConsoleLog as a function", async () => {
			const module = await import("./console")
			expect(typeof module.originalConsoleLog).toBe("function")
		})

		it("exports originalConsoleError as a function", async () => {
			const module = await import("./console")
			expect(typeof module.originalConsoleError).toBe("function")
		})

		it("exports originalConsoleWarn as a function", async () => {
			const module = await import("./console")
			expect(typeof module.originalConsoleWarn).toBe("function")
		})

		it("exports originalConsoleInfo as a function", async () => {
			const module = await import("./console")
			expect(typeof module.originalConsoleInfo).toBe("function")
		})

		it("exports originalConsoleDebug as a function", async () => {
			const module = await import("./console")
			expect(typeof module.originalConsoleDebug).toBe("function")
		})
	})

	describe("restoreConsole", () => {
		it("restores console.log", async () => {
			const module = await import("./console")
			expect(console.log).not.toBe(savedLog)

			module.restoreConsole()

			expect(console.log).toBe(module.originalConsoleLog)
		})

		it("restores console.error", async () => {
			const module = await import("./console")
			expect(console.error).not.toBe(savedError)

			module.restoreConsole()

			expect(console.error).toBe(module.originalConsoleError)
		})

		it("should restore all console methods", async () => {
			// Suppress console first
			console.log = () => {}
			console.error = () => {}
			console.warn = () => {}
			console.info = () => {}
			console.debug = () => {}

			const {
				restoreConsole,
				originalConsoleLog,
				originalConsoleError,
				originalConsoleWarn,
				originalConsoleInfo,
				originalConsoleDebug,
			} = await import("./console")

			restoreConsole()

			// After restore, console methods should be the originals
			expect(console.log).toBe(originalConsoleLog)
			expect(console.error).toBe(originalConsoleError)
			expect(console.warn).toBe(originalConsoleWarn)
			expect(console.info).toBe(originalConsoleInfo)
			expect(console.debug).toBe(originalConsoleDebug)
		})
	})
})
