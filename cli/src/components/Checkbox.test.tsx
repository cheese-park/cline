import { render } from "ink-testing-library"
import { describe, expect, it } from "vitest"
import { Checkbox } from "./Checkbox"

describe("Checkbox", () => {
	it("renders unchecked item with label", () => {
		const { lastFrame } = render(<Checkbox checked={false} label="Enable logs" />)

		expect(lastFrame()).toContain("[ ]")
		expect(lastFrame()).toContain("Enable logs")
	})

	it("should render checked state", () => {
		const { lastFrame } = render(<Checkbox checked={true} label="Test option" />)
		expect(lastFrame()).toContain("[✓]")
		expect(lastFrame()).toContain("Test option")
	})

	it("renders checked and selected states", () => {
		const { lastFrame } = render(<Checkbox checked isSelected label="Use feature" />)

		expect(lastFrame()).toContain("❯")
		expect(lastFrame()).toContain("[✓]")
		expect(lastFrame()).toContain("Tab to toggle")
	})

	it("should show selection indicator when isSelected", () => {
		const { lastFrame } = render(<Checkbox checked={false} isSelected={true} label="Test option" />)
		expect(lastFrame()).toContain("❯")
		expect(lastFrame()).toContain("Tab to toggle")
	})

	it("should not show selection indicator when not selected", () => {
		const { lastFrame } = render(<Checkbox checked={false} isSelected={false} label="Test option" />)
		expect(lastFrame()).not.toContain("❯")
		expect(lastFrame()).not.toContain("Tab to toggle")
	})

	it("renders description when provided", () => {
		const { lastFrame } = render(<Checkbox checked={false} description="Extra details" label="Advanced" />)

		expect(lastFrame()).toContain("Advanced")
		expect(lastFrame()).toContain("Extra details")
	})

	it("should not render description when not provided", () => {
		const { lastFrame } = render(<Checkbox checked={false} label="Test option" />)
		expect(lastFrame()).toContain("Test option")
	})

	it("should default isSelected to false", () => {
		const { lastFrame } = render(<Checkbox checked={false} label="Test option" />)
		expect(lastFrame()).not.toContain("❯")
	})
})
