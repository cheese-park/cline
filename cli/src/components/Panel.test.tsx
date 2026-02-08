import { Text } from "ink"
import { render } from "ink-testing-library"
import { describe, expect, it, vi } from "vitest"

vi.mock("../hooks/useTerminalSize", () => ({
	useTerminalSize: () => ({ columns: 80, rows: 24, resizeKey: 0 }),
}))

import { Panel } from "./Panel"

describe("Panel", () => {
	it("renders label and children", () => {
		const { lastFrame } = render(
			<Panel label="Settings">
				<Text>Panel body</Text>
			</Panel>,
		)

		expect(lastFrame()).toContain("Settings")
		expect(lastFrame()).toContain("Panel body")
		expect(lastFrame()).toContain("Esc to close")
	})

	it("should render children content", () => {
		const { lastFrame } = render(
			<Panel label="Test">
				<Text>Hello World</Text>
			</Panel>,
		)
		expect(lastFrame()).toContain("Hello World")
	})

	it("should show 'go back' hint when isSubpage is true", () => {
		const { lastFrame } = render(
			<Panel isSubpage label="Test">
				<Text>Content</Text>
			</Panel>,
		)
		expect(lastFrame()).toContain("Esc to go back")
	})

	it("renders tabs and arrow hint", () => {
		const { lastFrame } = render(
			<Panel
				currentTab="models"
				label="Preferences"
				tabs={[
					{ key: "general", label: "General" },
					{ key: "models", label: "Models" },
				]}>
				<Text>Tab content</Text>
			</Panel>,
		)

		expect(lastFrame()).toContain("General")
		expect(lastFrame()).toContain("Models")
		expect(lastFrame()).toContain("(←/→)")
	})

	it("should render tabs with Rules label", () => {
		const tabs = [
			{ key: "general", label: "General" },
			{ key: "rules", label: "Rules" },
		]
		const { lastFrame } = render(
			<Panel currentTab="general" label="Settings" tabs={tabs}>
				<Text>Content</Text>
			</Panel>,
		)
		expect(lastFrame()).toContain("General")
		expect(lastFrame()).toContain("Rules")
	})

	it("renders subpage header text and no arrow hint", () => {
		const { lastFrame } = render(
			<Panel currentTab="general" isSubpage label="Settings" tabs={[{ key: "general", label: "General" }]}>
				<Text>Subpage</Text>
			</Panel>,
		)

		expect(lastFrame()).toContain("Esc to go back")
		expect(lastFrame()).not.toContain("(←/→)")
	})

	it("should hide arrow key hint on subpage with multiple tabs", () => {
		const tabs = [
			{ key: "general", label: "General" },
			{ key: "rules", label: "Rules" },
		]
		const { lastFrame } = render(
			<Panel currentTab="general" isSubpage label="Settings" tabs={tabs}>
				<Text>Content</Text>
			</Panel>,
		)
		expect(lastFrame()).not.toContain("←/→")
	})

	it("renders separator line", () => {
		const { lastFrame } = render(
			<Panel label="Separator">
				<Text>Body</Text>
			</Panel>,
		)

		expect(lastFrame()).toContain("─")
	})
})
