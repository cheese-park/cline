import { render } from "ink-testing-library"
import { describe, expect, it, vi } from "vitest"

vi.mock("@shared/focus-chain-utils", () => ({
	isFocusChainItem: (line: string) => /^- \[[ xX]\]/.test(line),
	isCompletedFocusChainItem: (line: string) => /^- \[[xX]\]/.test(line),
	parseFocusChainItem: (line: string) => {
		const match = line.match(/^- \[([ xX])\] (.+)$/)
		if (!match) {
			return null
		}
		return {
			checked: match[1].toLowerCase() === "x",
			text: match[2],
		}
	},
}))

import { FocusChain } from "./FocusChain"

describe("FocusChain", () => {
	it("renders nothing without checklist", () => {
		const { lastFrame } = render(<FocusChain focusChainChecklist={null} />)

		expect(lastFrame()).toBe("")
	})

	it("should return null when no props provided", () => {
		const { lastFrame } = render(<FocusChain />)
		expect(lastFrame()).toBe("")
	})

	it("should return null when checklist is empty string", () => {
		const { lastFrame } = render(<FocusChain focusChainChecklist="" />)
		expect(lastFrame()).toBe("")
	})

	it("should return null when checklist has no items", () => {
		const { lastFrame } = render(<FocusChain focusChainChecklist="just some random text" />)
		expect(lastFrame()).toBe("")
	})

	it("renders current todo summary and progress", () => {
		const checklist = "- [x] setup\n- [ ] write tests\n- [ ] run suite"
		const { lastFrame } = render(<FocusChain focusChainChecklist={checklist} />)

		expect(lastFrame()).toContain("[2/3]")
		expect(lastFrame()).toContain("write tests")
		expect(lastFrame()).toContain("33%")
	})

	it("should render progress bar", () => {
		const checklist = "- [ ] Task 1\n- [x] Task 2\n- [ ] Task 3"
		const { lastFrame } = render(<FocusChain focusChainChecklist={checklist} />)
		expect(lastFrame()).toContain("█")
		expect(lastFrame()).toContain("33%")
	})

	it("renders expanded list items", () => {
		const checklist = "- [x] setup\n- [ ] write tests"
		const { lastFrame } = render(<FocusChain expanded focusChainChecklist={checklist} />)

		expect(lastFrame()).toContain("✓")
		expect(lastFrame()).toContain("○")
		expect(lastFrame()).toContain("setup")
		expect(lastFrame()).toContain("write tests")
	})

	it("should not show expanded list by default", () => {
		const checklist = "- [x] Task 1\n- [ ] Task 2\n- [ ] Task 3"
		const { lastFrame } = render(<FocusChain focusChainChecklist={checklist} />)
		// Should only show the header, not the full list with checkmarks
		expect(lastFrame()).not.toContain("○")
	})

	it("renders completed state text", () => {
		const checklist = "- [x] first\n- [x] second"
		const { lastFrame } = render(<FocusChain expanded focusChainChecklist={checklist} />)

		expect(lastFrame()).toContain("All tasks completed")
		expect(lastFrame()).toContain("New steps will be generated")
	})

	it("should show all completed message when all tasks done", () => {
		const checklist = "- [x] Task 1\n- [x] Task 2\n- [x] Task 3"
		const { lastFrame } = render(<FocusChain focusChainChecklist={checklist} />)
		expect(lastFrame()).toContain("All tasks completed")
		expect(lastFrame()).toContain("100%")
	})

	it("should show help text when all completed and expanded", () => {
		const checklist = "- [x] Task 1\n- [x] Task 2"
		const { lastFrame } = render(<FocusChain expanded={true} focusChainChecklist={checklist} />)
		expect(lastFrame()).toContain("New steps will be generated")
	})

	it("should truncate long task names", () => {
		const longTask = "x".repeat(100)
		const checklist = `- [ ] ${longTask}`
		const { lastFrame } = render(<FocusChain focusChainChecklist={checklist} />)
		expect(lastFrame()).toContain("...")
	})
})
