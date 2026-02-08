import { render } from "ink-testing-library"
import React from "react"
import { describe, expect, it } from "vitest"

import { useScrollableList } from "./useScrollableList"

function runHook(itemCount: number, selectedIndex: number, maxRows: number) {
	let result: ReturnType<typeof useScrollableList> | undefined

	const Probe = () => {
		result = useScrollableList(itemCount, selectedIndex, maxRows)
		return null
	}

	const app = render(React.createElement(Probe))
	app.unmount()

	if (!result) {
		throw new Error("Hook did not produce a result")
	}

	return result
}

describe("useScrollableList", () => {
	it("returns full window when itemCount fits maxRows", () => {
		const result = runHook(3, 1, 5)
		expect(result).toEqual({
			visibleStart: 0,
			visibleCount: 3,
			showTopIndicator: false,
			showBottomIndicator: false,
		})
	})

	it("handles itemCount=0", () => {
		const result = runHook(0, 0, 5)
		expect(result.visibleStart).toBe(0)
		expect(result.visibleCount).toBe(0)
		expect(result.showTopIndicator).toBe(false)
		expect(result.showBottomIndicator).toBe(false)
	})

	it("handles selectedIndex at top boundary", () => {
		const result = runHook(20, 0, 5)
		expect(result.visibleStart).toBe(0)
		expect(result.showTopIndicator).toBe(false)
		expect(result.showBottomIndicator).toBe(true)
	})

	it("handles selectedIndex at bottom boundary", () => {
		const result = runHook(20, 19, 5)
		expect(result.visibleStart).toBe(16)
		expect(result.showTopIndicator).toBe(true)
		expect(result.showBottomIndicator).toBe(false)
	})

	it("calculates centered window and both indicators for middle selection", () => {
		const result = runHook(20, 10, 5)
		expect(result.visibleStart).toBe(9)
		expect(result.visibleCount).toBe(3)
		expect(result.showTopIndicator).toBe(true)
		expect(result.showBottomIndicator).toBe(true)
	})
})
