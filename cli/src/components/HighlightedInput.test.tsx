import { render } from "ink-testing-library"
import { describe, expect, it, vi } from "vitest"

vi.mock("@shared/context-mentions", () => ({
	mentionRegexGlobal: /@[^\s]+/g,
}))

import { HighlightedInput } from "./HighlightedInput"

describe("HighlightedInput", () => {
	describe("without cursor", () => {
		it("returns null for empty text", () => {
			const { lastFrame } = render(<HighlightedInput text="" />)

			expect(lastFrame()).toBe("")
		})

		it("should render plain text", () => {
			const { lastFrame } = render(<HighlightedInput text="Hello world" />)
			expect(lastFrame()).toContain("Hello world")
		})

		it("renders text with mention and slash command", () => {
			const { lastFrame } = render(
				<HighlightedInput availableCommands={["help", "settings"]} text="run /help then check @src/index.ts" />,
			)

			expect(lastFrame()).toContain("/help")
			expect(lastFrame()).toContain("@src/index.ts")
		})

		it("should render text with mentions", () => {
			const { lastFrame } = render(<HighlightedInput text="Check @file.ts please" />)
			expect(lastFrame()).toContain("@file.ts")
		})

		it("should render text with slash commands", () => {
			const { lastFrame } = render(<HighlightedInput availableCommands={["help"]} text="/help" />)
			expect(lastFrame()).toContain("/help")
		})

		it("keeps unknown command text when command is not available", () => {
			const { lastFrame } = render(<HighlightedInput availableCommands={["help"]} text="try /unknown command" />)

			expect(lastFrame()).toContain("/unknown")
		})
	})

	describe("with cursor", () => {
		it("renders with cursor inside text and at end", () => {
			const inside = render(<HighlightedInput cursorPos={3} text="hello" />)
			expect(inside.lastFrame()).toContain("hello")

			const end = render(<HighlightedInput cursorPos={5} text="hello" />)
			expect(end.lastFrame()).toContain("hello")
		})

		it("should render cursor at beginning", () => {
			const { lastFrame } = render(<HighlightedInput cursorPos={0} text="Hello" />)
			expect(lastFrame()).toContain("Hello")
		})

		it("should render cursor in middle of text", () => {
			const { lastFrame } = render(<HighlightedInput cursorPos={2} text="Hello" />)
			expect(lastFrame()).toContain("Hello")
		})

		it("should handle cursor beyond text length", () => {
			const { lastFrame } = render(<HighlightedInput cursorPos={100} text="Hi" />)
			expect(lastFrame()).toContain("Hi")
		})

		it("should handle negative cursor position", () => {
			const { lastFrame } = render(<HighlightedInput cursorPos={-5} text="Hello" />)
			expect(lastFrame()).toContain("Hello")
		})
	})
})
