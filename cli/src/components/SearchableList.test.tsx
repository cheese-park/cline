import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockUseInput, mockFuzzyFilter, mockIsMouseEscapeSequence } = vi.hoisted(() => ({
	mockUseInput: vi.fn(),
	mockFuzzyFilter: vi.fn((items: unknown[]) => items),
	mockIsMouseEscapeSequence: vi.fn(() => false),
}))

vi.mock("ink", async () => {
	const actual = await vi.importActual<typeof import("ink")>("ink")
	return {
		...actual,
		useInput: mockUseInput,
	}
})

vi.mock("../context/StdinContext", () => ({
	useStdinContext: () => ({ isRawModeSupported: true }),
}))

vi.mock("../hooks/useScrollableList", () => ({
	useScrollableList: (length: number) => ({
		visibleStart: 0,
		visibleCount: Math.min(5, length),
		showTopIndicator: false,
		showBottomIndicator: length > 5,
	}),
}))

vi.mock("../utils/fuzzy-search", () => ({
	fuzzyFilter: mockFuzzyFilter,
}))

vi.mock("../utils/input", () => ({
	isMouseEscapeSequence: mockIsMouseEscapeSequence,
}))

import { SearchableList } from "./SearchableList"

describe("SearchableList", () => {
	const items = [
		{ id: "1", label: "Alpha" },
		{ id: "2", label: "Beta", suffix: "(configured)" },
		{ id: "3", label: "Gamma" },
	]

	beforeEach(() => {
		vi.clearAllMocks()
		mockFuzzyFilter.mockImplementation((source: unknown[]) => source)
	})

	it("renders search box and items", () => {
		const { lastFrame } = render(<SearchableList items={items} onSelect={() => {}} />)

		expect(lastFrame()).toContain("Search:")
		expect(lastFrame()).toContain("❯ Alpha")
		expect(lastFrame()).toContain("(configured)")
	})

	it("registers keyboard input with active raw mode", () => {
		render(<SearchableList items={items} onSelect={() => {}} />)

		expect(mockUseInput).toHaveBeenCalledTimes(1)
		expect(mockUseInput.mock.calls[0][1]).toEqual({ isActive: true })
	})

	it("selects initially highlighted item on enter", () => {
		const onSelect = vi.fn()
		render(<SearchableList items={items} onSelect={onSelect} />)

		const inputHandler = mockUseInput.mock.calls[0][0] as (input: string, key: Record<string, boolean>) => void
		inputHandler("", { return: true })

		expect(onSelect).toHaveBeenCalledWith({ id: "1", label: "Alpha" })
	})

	it("shows no matches message when list is empty", () => {
		const { lastFrame } = render(<SearchableList items={[]} onSelect={() => {}} />)

		expect(lastFrame()).toContain('No matches for ""')
	})
})
