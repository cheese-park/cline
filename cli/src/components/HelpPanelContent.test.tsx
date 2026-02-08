import { render } from "ink-testing-library"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockUseInput, mockIsMouseEscapeSequence } = vi.hoisted(() => ({
	mockUseInput: vi.fn(),
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

vi.mock("../utils/input", () => ({
	isMouseEscapeSequence: mockIsMouseEscapeSequence,
}))

vi.mock("./Panel", () => ({
	Panel: ({ label, children }: { label: string; children: React.ReactNode }) =>
		React.createElement(React.Fragment, null, React.createElement("ink-text", null, label), children),
}))

import { HelpPanelContent } from "./HelpPanelContent"

describe("HelpPanelContent", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockIsMouseEscapeSequence.mockReturnValue(false)
	})

	it("renders help sections and commands", () => {
		const { lastFrame } = render(<HelpPanelContent onClose={() => {}} />)

		expect(lastFrame()).toContain("Help")
		expect(lastFrame()).toContain("Plan vs Act Mode")
		expect(lastFrame()).toContain("/settings")
		expect(lastFrame()).toContain("https://docs.cline.bot/cline-cli")
	})

	it("closes on escape", () => {
		const onClose = vi.fn()
		render(<HelpPanelContent onClose={onClose} />)

		const inputHandler = mockUseInput.mock.calls[0][0] as (input: string, key: Record<string, boolean>) => void
		inputHandler("", { escape: true })

		expect(onClose).toHaveBeenCalledTimes(1)
	})

	it("ignores mouse escape sequences", () => {
		mockIsMouseEscapeSequence.mockReturnValueOnce(true)
		const onClose = vi.fn()
		render(<HelpPanelContent onClose={onClose} />)

		const inputHandler = mockUseInput.mock.calls[0][0] as (input: string, key: Record<string, boolean>) => void
		inputHandler("\u001b[<0;10;10M", { escape: true })

		expect(onClose).not.toHaveBeenCalled()
	})
})
