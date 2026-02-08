import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetVisibleWindow } = vi.hoisted(() => ({
	mockGetVisibleWindow: vi.fn(),
}))

vi.mock("../hooks/useTerminalSize", () => ({
	useTerminalSize: () => ({ columns: 80, rows: 24, resizeKey: 0 }),
}))

vi.mock("../utils/slash-commands", () => ({
	getVisibleWindow: mockGetVisibleWindow,
}))

import { SlashCommandMenu } from "./SlashCommandMenu"

describe("SlashCommandMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockGetVisibleWindow.mockImplementation((items: unknown[]) => ({ items, startIndex: 0 }))
	})

	it("renders empty search helper", () => {
		const { lastFrame } = render(<SlashCommandMenu commands={[]} query="" selectedIndex={0} />)

		expect(lastFrame()).toContain("Type to search commands")
	})

	it("renders no-match text with query", () => {
		const { lastFrame } = render(<SlashCommandMenu commands={[]} query="mod" selectedIndex={0} />)

		expect(lastFrame()).toContain('No commands matching "/mod"')
	})

	it("renders command list and selected row", () => {
		const commands = [
			{ name: "help", description: "Show help", section: "default" },
			{ name: "workflow.run", description: "Workflow", section: "workflow" },
		]
		const { lastFrame } = render(<SlashCommandMenu commands={commands} query="h" selectedIndex={0} />)

		expect(lastFrame()).toContain("❯ /help")
		expect(lastFrame()).toContain("Show help")
		expect(lastFrame()).toContain("/workflow.run")
		expect(lastFrame()).not.toContain("/workflow.run - Workflow")
	})

	it("shows descriptions for default commands", () => {
		const commands = [{ name: "help", description: "Show help information", section: "default" }]
		const { lastFrame } = render(<SlashCommandMenu commands={commands} query="h" selectedIndex={0} />)
		expect(lastFrame()).toContain("Show help information")
	})

	it("shows more-below indicator when window is truncated", () => {
		const commands = [
			{ name: "a", description: "A", section: "default" },
			{ name: "b", description: "B", section: "default" },
			{ name: "c", description: "C", section: "default" },
		]
		mockGetVisibleWindow.mockReturnValueOnce({ items: commands.slice(0, 2), startIndex: 0 })

		const { lastFrame } = render(<SlashCommandMenu commands={commands} query="" selectedIndex={1} />)

		expect(lastFrame()).toContain("▼")
	})
})
