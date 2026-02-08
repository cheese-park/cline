import { Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { describe, expect, it, vi } from "vitest"

vi.mock("ink-spinner", () => ({
	default: () => React.createElement(Text, null, "*"),
}))

import { LoadingSpinner } from "./Spinner"

describe("LoadingSpinner", () => {
	it("renders default act mode message", () => {
		const { lastFrame } = render(<LoadingSpinner />)

		expect(lastFrame()).toContain("Thinking...")
		expect(lastFrame()).toContain("*")
	})

	it("renders plan mode message", () => {
		const { lastFrame } = render(<LoadingSpinner mode="plan" />)

		expect(lastFrame()).toContain("Planning...")
	})

	it("renders act mode when explicitly passed", () => {
		const { lastFrame } = render(<LoadingSpinner mode="act" />)

		expect(lastFrame()).toContain("Thinking...")
	})

	it("shows spinner character", () => {
		const { lastFrame } = render(<LoadingSpinner />)
		expect(lastFrame()).toContain("*")
	})
})
