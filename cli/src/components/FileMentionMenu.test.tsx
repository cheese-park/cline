import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { FileSearchResult } from "../utils/file-search"

const { mockGetVisibleWindow, mockRipgrepInstructions } = vi.hoisted(() => ({
	mockGetVisibleWindow: vi.fn(),
	mockRipgrepInstructions: vi.fn(() => "brew install ripgrep"),
}))

vi.mock("../utils/slash-commands", () => ({
	getVisibleWindow: mockGetVisibleWindow,
}))

vi.mock("../utils/file-search", () => ({
	getRipgrepInstallInstructions: mockRipgrepInstructions,
}))

import { FileMentionMenu } from "./FileMentionMenu"

describe("FileMentionMenu", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockGetVisibleWindow.mockImplementation((items: unknown[]) => ({ items, startIndex: 0 }))
	})

	it("renders loading state", () => {
		const { lastFrame } = render(<FileMentionMenu isLoading query="src" results={[]} selectedIndex={0} />)

		expect(lastFrame()).toContain("Searching files")
	})

	it("renders no-result state with query", () => {
		const { lastFrame } = render(<FileMentionMenu isLoading={false} query="xyz" results={[]} selectedIndex={0} />)

		expect(lastFrame()).toContain('No files matching "xyz"')
	})

	it("should show prompt when no query and no results", () => {
		const { lastFrame } = render(<FileMentionMenu isLoading={false} query="" results={[]} selectedIndex={0} />)
		expect(lastFrame()).toContain("Type to search files")
	})

	it("should render file results", () => {
		const results: FileSearchResult[] = [
			{ path: "src/index.ts", type: "file", label: "index.ts" },
			{ path: "src/utils.ts", type: "file", label: "utils.ts" },
		]
		const { lastFrame } = render(<FileMentionMenu isLoading={false} query="src" results={results} selectedIndex={0} />)
		expect(lastFrame()).toContain("src/index.ts")
		expect(lastFrame()).toContain("src/utils.ts")
	})

	it("renders truncated paths and selection marker", () => {
		const results: FileSearchResult[] = [
			{ path: "/very/long/path/to/a/project/src/components/SomeReallyLongFileName.tsx", type: "file", label: "long" },
			{ path: "README.md", type: "file", label: "readme" },
		]
		const { lastFrame } = render(<FileMentionMenu isLoading={false} query="" results={results} selectedIndex={0} />)

		expect(lastFrame()).toContain("❯")
		expect(lastFrame()).toContain("SomeReallyLongFileName.tsx")
		expect(lastFrame()).toContain("...")
	})

	it("shows ripgrep warning and more indicator", () => {
		const results: FileSearchResult[] = [
			{ path: "a", type: "file", label: "a" },
			{ path: "b", type: "file", label: "b" },
			{ path: "c", type: "file", label: "c" },
		]
		mockGetVisibleWindow.mockReturnValueOnce({ items: results.slice(0, 2), startIndex: 0 })

		const { lastFrame } = render(
			<FileMentionMenu isLoading={false} query="" results={results} selectedIndex={1} showRipgrepWarning />,
		)

		expect(lastFrame()).toContain("▼")
		expect(lastFrame()).toContain("ripgrep not found")
		expect(lastFrame()).toContain("brew install ripgrep")
	})

	it("should show ripgrep warning when enabled during loading", () => {
		const { lastFrame } = render(
			<FileMentionMenu isLoading={true} query="test" results={[]} selectedIndex={0} showRipgrepWarning={true} />,
		)
		expect(lastFrame()).toContain("ripgrep not found")
		expect(lastFrame()).toContain("brew install ripgrep")
	})

	it("should show ripgrep warning when enabled with no results", () => {
		const { lastFrame } = render(
			<FileMentionMenu isLoading={false} query="test" results={[]} selectedIndex={0} showRipgrepWarning={true} />,
		)
		expect(lastFrame()).toContain("ripgrep not found")
	})
})
