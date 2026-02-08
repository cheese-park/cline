import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

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

vi.mock("../context/StdinContext", () => ({
	useStdinContext: () => ({ isRawModeSupported: true }),
}))

import { SelectList } from "./SelectList"

describe("SelectList", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders all items and selected indicator", () => {
		const { lastFrame } = render(
			<SelectList
				items={[
					{ id: "a", label: "Alpha" },
					{ id: "b", label: "Beta", suffix: "(configured)" },
				]}
				onSelect={() => {}}
			/>,
		)

		expect(lastFrame()).toContain("❯ Alpha")
		expect(lastFrame()).toContain("Beta")
		expect(lastFrame()).toContain("(configured)")
	})

	it("registers input with active raw mode", () => {
		render(<SelectList items={[{ id: "a", label: "Alpha" }]} onSelect={() => {}} />)

		expect(mockUseInput).toHaveBeenCalledTimes(1)
		expect(mockUseInput.mock.calls[0][1]).toEqual({ isActive: true })
	})

	it("selects initially highlighted item on enter", () => {
		const onSelect = vi.fn()
		render(
			<SelectList
				items={[
					{ id: "a", label: "Alpha" },
					{ id: "b", label: "Beta" },
				]}
				onSelect={onSelect}
			/>,
		)

		const inputHandler = mockUseInput.mock.calls[0][0] as (input: string, key: Record<string, boolean>) => void
		inputHandler("", { return: true })

		expect(onSelect).toHaveBeenCalledWith({ id: "a", label: "Alpha" })
	})
})
