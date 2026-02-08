import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockComputeDiff, mockGetGutterWidth } = vi.hoisted(() => ({
	mockComputeDiff: vi.fn(),
	mockGetGutterWidth: vi.fn(() => 2),
}))

vi.mock("../utils/DiffComputer", () => ({
	computeDiff: mockComputeDiff,
	getGutterWidth: mockGetGutterWidth,
}))

import { DiffView } from "./DiffView"

describe("DiffView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockGetGutterWidth.mockReturnValue(2)
	})

	it("should return null when no content", () => {
		mockComputeDiff.mockReturnValue(null)
		const { lastFrame } = render(<DiffView />)
		expect(lastFrame()).toBe("")
	})

	it("should return null when content is undefined", () => {
		mockComputeDiff.mockReturnValue(null)
		const { lastFrame } = render(<DiffView content={undefined} />)
		expect(lastFrame()).toBe("")
	})

	it("renders nothing when no blocks are returned", () => {
		mockComputeDiff.mockReturnValue({ blocks: [] })

		const { lastFrame } = render(<DiffView content="diff" />)

		expect(lastFrame()).toBe("")
	})

	it("renders add/remove/context lines", () => {
		mockComputeDiff.mockReturnValue({
			blocks: [
				{
					lines: [
						{ type: "remove", content: "old line", oldLineNumber: 1 },
						{ type: "add", content: "new line", newLineNumber: 1 },
						{ type: "context", content: "same line", oldLineNumber: 2, newLineNumber: 2 },
					],
				},
			],
		})

		const { lastFrame } = render(<DiffView content="diff" />)

		expect(lastFrame()).toContain("-old line")
		expect(lastFrame()).toContain("+new line")
		expect(lastFrame()).toContain(" same line")
	})

	it("should show + prefix for additions", () => {
		mockComputeDiff.mockReturnValue({
			blocks: [
				{
					lines: [{ type: "add", content: "new line", newLineNumber: 1 }],
				},
			],
		})

		const { lastFrame } = render(<DiffView content="some diff content" />)
		expect(lastFrame()).toContain("+")
	})

	it("should show - prefix for deletions", () => {
		mockComputeDiff.mockReturnValue({
			blocks: [
				{
					lines: [{ type: "remove", content: "old line", oldLineNumber: 1 }],
				},
			],
		})

		const { lastFrame } = render(<DiffView content="some diff content" />)
		expect(lastFrame()).toContain("-")
	})

	it("collapses long unchanged context runs", () => {
		mockComputeDiff.mockReturnValue({
			blocks: [
				{
					lines: [
						{ type: "context", content: "ctx1", oldLineNumber: 1, newLineNumber: 1 },
						{ type: "context", content: "ctx2", oldLineNumber: 2, newLineNumber: 2 },
						{ type: "context", content: "ctx3", oldLineNumber: 3, newLineNumber: 3 },
						{ type: "remove", content: "old", oldLineNumber: 4 },
						{ type: "add", content: "new", newLineNumber: 4 },
						{ type: "context", content: "ctx4", oldLineNumber: 5, newLineNumber: 5 },
						{ type: "context", content: "ctx5", oldLineNumber: 6, newLineNumber: 6 },
						{ type: "context", content: "ctx6", oldLineNumber: 7, newLineNumber: 7 },
					],
				},
			],
		})

		const { lastFrame } = render(<DiffView content="diff" contextLines={1} />)

		expect(lastFrame()).toContain("unchanged lines")
	})

	it("renders block separator for multiple blocks", () => {
		mockComputeDiff.mockReturnValue({
			blocks: [
				{ lines: [{ type: "remove", content: "a", oldLineNumber: 1 }] },
				{ lines: [{ type: "add", content: "b", newLineNumber: 2 }] },
			],
		})

		const { lastFrame } = render(<DiffView content="diff" />)

		expect(lastFrame()).toContain(
			"\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500",
		)
	})

	it("should render with custom contextLines", () => {
		mockComputeDiff.mockReturnValue({
			blocks: [
				{
					lines: [
						{ type: "context", content: "unchanged line", oldLineNumber: 1, newLineNumber: 1 },
						{ type: "add", content: "new line", newLineNumber: 2 },
					],
				},
			],
		})

		const { lastFrame } = render(<DiffView content="some diff content" contextLines={5} />)
		expect(lastFrame()).toContain("unchanged line")
	})
})
