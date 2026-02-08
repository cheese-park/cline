import { describe, expect, it } from "vitest"

import { checkRawModeSupport } from "./StdinContext"

describe("checkRawModeSupport", () => {
	it("returns a boolean result", () => {
		const result = checkRawModeSupport()
		expect(typeof result).toBe("boolean")
	})

	it("matches current stdin raw mode capability", () => {
		const expected = Boolean(process.stdin.isTTY && typeof process.stdin.setRawMode === "function")
		expect(checkRawModeSupport()).toBe(expected)
	})
})
