import { render } from "ink-testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { mockExecSync } = vi.hoisted(() => ({
	mockExecSync: vi.fn(() => "main\n"),
}))

vi.mock("child_process", () => ({
	execSync: mockExecSync,
}))

import { StatusBar } from "./StatusBar"

describe("StatusBar", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockExecSync.mockImplementation(() => "main\n")
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("renders directory, branch, model and cost", async () => {
		const { lastFrame } = render(
			<StatusBar cwd="/tmp/project" modelId="claude-3-5-sonnet" tokensIn={1200} tokensOut={300} totalCost={0.0123} />,
		)
		await new Promise((resolve) => setTimeout(resolve, 0))

		expect(lastFrame()).toContain("project")
		expect(lastFrame()).toContain("claude-3-5-sonnet")
		expect(lastFrame()).toContain("(1,500)")
		expect(lastFrame()).toContain("$0.0123")
		expect(mockExecSync).toHaveBeenCalled()
	})

	it("hides branch when git lookup fails", () => {
		mockExecSync.mockImplementationOnce(() => {
			throw new Error("not a git repo")
		})

		const { lastFrame } = render(<StatusBar cwd="/tmp/project" modelId="model-x" totalCost={0} />)

		expect(lastFrame()).toContain("project")
		expect(lastFrame()).not.toContain("(main)")
	})

	it("truncates long model id", () => {
		const { lastFrame } = render(
			<StatusBar cwd="/tmp/project" modelId="this-is-a-very-long-model-id-name" tokensIn={10} tokensOut={5} />,
		)

		expect(lastFrame()).toContain("this-is-a-very-lo...")
		// context bar is always visible
		expect(lastFrame()).toContain("░")
	})
})
