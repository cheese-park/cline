import { render } from "ink-testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { mockUseInput } = vi.hoisted(() => ({
	mockUseInput: vi.fn(),
}))

vi.mock("ink", async () => {
	const actual = await vi.importActual<typeof import("ink")>("ink")
	return {
		...actual,
		useInput: mockUseInput,
	}
})

import { ThinkingIndicator } from "./ThinkingIndicator"

describe("ThinkingIndicator", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("renders default acting state", () => {
		const { lastFrame } = render(<ThinkingIndicator />)

		expect(lastFrame()).toContain("Acting...")
	})

	it("renders plan mode message", () => {
		const { lastFrame } = render(<ThinkingIndicator mode="plan" />)

		expect(lastFrame()).toContain("Planning...")
	})

	it("renders elapsed time string when start time exists", async () => {
		vi.spyOn(Date, "now").mockReturnValue(10000)
		const { lastFrame } = render(<ThinkingIndicator startTime={5000} />)
		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(lastFrame()).toContain("s · esc to interrupt")
	})

	it("calls onCancel when escape key is received", () => {
		const onCancel = vi.fn()
		render(<ThinkingIndicator onCancel={onCancel} />)

		const inputHandler = mockUseInput.mock.calls[0][0] as (input: string, key: Record<string, boolean>) => void
		inputHandler("", { escape: true })

		expect(onCancel).toHaveBeenCalledTimes(1)
	})
})
