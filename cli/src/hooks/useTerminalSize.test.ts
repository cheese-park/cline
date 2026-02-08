import { render } from "ink-testing-library"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { useTerminalSize } from "./useTerminalSize"

describe("useTerminalSize", () => {
	const originalColumns = process.stdout.columns
	const originalRows = process.stdout.rows
	const originalWrite = process.stdout.write

	let resizeHandler: (() => void) | undefined

	beforeEach(() => {
		vi.useFakeTimers()
		resizeHandler = undefined
		Object.defineProperty(process.stdout, "columns", { value: 80, configurable: true })
		Object.defineProperty(process.stdout, "rows", { value: 24, configurable: true })
		vi.spyOn(process.stdout, "on").mockImplementation(((event: string, cb: () => void) => {
			if (event === "resize") resizeHandler = cb
			return process.stdout
		}) as any)
		vi.spyOn(process.stdout, "off").mockImplementation(((_event: string, _cb: () => void) => process.stdout) as any)
		vi.spyOn(process.stdout, "write").mockImplementation(((_chunk: string, cb?: (error?: Error | null) => void) => {
			cb?.(null)
			return true
		}) as any)
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.restoreAllMocks()
		Object.defineProperty(process.stdout, "columns", { value: originalColumns, configurable: true })
		Object.defineProperty(process.stdout, "rows", { value: originalRows, configurable: true })
		process.stdout.write = originalWrite
	})

	it("returns initial terminal size", () => {
		let result: ReturnType<typeof useTerminalSize> | undefined
		const Probe = () => {
			result = useTerminalSize()
			return null
		}
		const app = render(React.createElement(Probe))
		expect(result?.columns).toBe(80)
		expect(result?.rows).toBe(24)
		expect(result?.resizeKey).toBe(0)
		app.unmount()
	})

	it("updates size and increments resizeKey after debounced resize", async () => {
		let result: ReturnType<typeof useTerminalSize> | undefined
		const Probe = () => {
			result = useTerminalSize()
			return null
		}
		const app = render(React.createElement(Probe))
		expect(resizeHandler).toBeTypeOf("function")

		Object.defineProperty(process.stdout, "columns", { value: 120, configurable: true })
		Object.defineProperty(process.stdout, "rows", { value: 40, configurable: true })
		resizeHandler?.()

		vi.advanceTimersByTime(301)
		await Promise.resolve()

		expect(result?.resizeKey).toBeGreaterThanOrEqual(0)
		expect(process.stdout.write).toHaveBeenCalled()
		app.unmount()
	})
})
