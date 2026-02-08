import type { SlashCommandInfo } from "@shared/proto/cline/slash"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	extractSlashQuery,
	filterCommands,
	getVisibleWindow,
	insertSlashCommand,
	sortCommandsWorkflowsFirst,
} from "./slash-commands"

vi.mock("./fuzzy-search", () => ({
	fuzzyFilter: vi.fn((items: any[], query: string, selector: (item: any) => string) => {
		return items.filter((item) => selector(item).toLowerCase().includes(query.toLowerCase()))
	}),
}))

interface TestCommand {
	name: string
	description: string
	section: "custom" | "default"
	cliCompatible: boolean
}

function createCommand(name: string, section: "custom" | "default" = "default"): TestCommand {
	return {
		name,
		description: `${name} description`,
		section,
		cliCompatible: true,
	}
}

const makeCmd = (name: string, section?: string): SlashCommandInfo => ({ name, section: section ?? "" }) as SlashCommandInfo

describe("slash-commands", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("getVisibleWindow", () => {
		it("should return all items when less than maxVisible", () => {
			const items = [1, 2, 3]
			const result = getVisibleWindow(items, 0, 5)
			expect(result.items).toEqual([1, 2, 3])
			expect(result.startIndex).toBe(0)
		})

		it("should return all items when equal to maxVisible", () => {
			const items = [1, 2, 3, 4, 5]
			const result = getVisibleWindow(items, 0, 5)
			expect(result.items).toEqual([1, 2, 3, 4, 5])
			expect(result.startIndex).toBe(0)
		})

		it("returns all items with startIndex 0 when item count is within maxVisible", () => {
			const items = ["a", "b", "c"]
			const result = getVisibleWindow(items, 1, 5)

			expect(result.items).toEqual(items)
			expect(result.startIndex).toBe(0)
		})

		it("should center selected item in window", () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			const result = getVisibleWindow(items, 5, 5)
			expect(result.items).toHaveLength(5)
			expect(result.items).toContain(6) // selectedIndex 5 = value 6
		})

		it("centers around selected index when possible", () => {
			const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
			const result = getVisibleWindow(items, 5, 5)

			expect(result.items).toEqual([3, 4, 5, 6, 7])
			expect(result.startIndex).toBe(3)
		})

		it("should handle selection at start", () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			const result = getVisibleWindow(items, 0, 5)
			expect(result.startIndex).toBe(0)
			expect(result.items).toEqual([1, 2, 3, 4, 5])
		})

		it("starts at 0 when selected index is near the beginning", () => {
			const items = [0, 1, 2, 3, 4, 5, 6]
			const result = getVisibleWindow(items, 1, 5)

			expect(result.items).toEqual([0, 1, 2, 3, 4])
			expect(result.startIndex).toBe(0)
		})

		it("should handle selection at end", () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			const result = getVisibleWindow(items, 9, 5)
			expect(result.startIndex).toBe(5)
			expect(result.items).toEqual([6, 7, 8, 9, 10])
		})

		it("adjusts start when selected index is near the end", () => {
			const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
			const result = getVisibleWindow(items, 9, 5)

			expect(result.items).toEqual([5, 6, 7, 8, 9])
			expect(result.startIndex).toBe(5)
		})

		it("should use default maxVisible of 5", () => {
			const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
			const result = getVisibleWindow(items, 0)
			expect(result.items).toHaveLength(5)
		})

		it("should handle empty items", () => {
			const result = getVisibleWindow([], 0, 5)
			expect(result.items).toEqual([])
			expect(result.startIndex).toBe(0)
		})
	})

	describe("sortCommandsWorkflowsFirst", () => {
		it("should put custom (workflow) commands first", () => {
			const commands = [makeCmd("help", "default"), makeCmd("my-workflow", "custom"), makeCmd("new", "default")]
			const sorted = sortCommandsWorkflowsFirst(commands)
			expect(sorted[0].name).toBe("my-workflow")
		})

		it("puts custom section commands before non-custom commands", () => {
			const commands = [
				createCommand("help", "default"),
				createCommand("workflow-a", "custom"),
				createCommand("status", "default"),
				createCommand("workflow-b", "custom"),
			]

			const result = sortCommandsWorkflowsFirst(commands)

			expect(result.map((c) => c.name)).toEqual(["workflow-a", "workflow-b", "help", "status"])
		})

		it("should preserve order within sections", () => {
			const commands = [makeCmd("a", "custom"), makeCmd("b", "custom"), makeCmd("c", "default")]
			const sorted = sortCommandsWorkflowsFirst(commands)
			expect(sorted.map((c) => c.name)).toEqual(["a", "b", "c"])
		})

		it("should handle empty array", () => {
			expect(sortCommandsWorkflowsFirst([])).toEqual([])
		})

		it("should handle all custom commands", () => {
			const commands = [makeCmd("a", "custom"), makeCmd("b", "custom")]
			const sorted = sortCommandsWorkflowsFirst(commands)
			expect(sorted).toHaveLength(2)
		})

		it("should handle no custom commands", () => {
			const commands = [makeCmd("a", "default"), makeCmd("b", "default")]
			const sorted = sortCommandsWorkflowsFirst(commands)
			expect(sorted.map((c) => c.name)).toEqual(["a", "b"])
		})
	})

	describe("extractSlashQuery", () => {
		it("should detect slash at start of input", () => {
			const result = extractSlashQuery("/hel")
			expect(result.inSlashMode).toBe(true)
			expect(result.query).toBe("hel")
			expect(result.slashIndex).toBe(0)
		})

		it("detects slash mode with empty query when slash is first character", () => {
			expect(extractSlashQuery("/")).toEqual({
				inSlashMode: true,
				query: "",
				slashIndex: 0,
			})
		})

		it("extracts query after slash", () => {
			expect(extractSlashQuery("/hel")).toEqual({
				inSlashMode: true,
				query: "hel",
				slashIndex: 0,
			})
		})

		it("should detect slash after whitespace", () => {
			const result = extractSlashQuery("text /com")
			expect(result.inSlashMode).toBe(true)
			expect(result.query).toBe("com")
			expect(result.slashIndex).toBe(5)
		})

		it("should return not in slash mode when no slash", () => {
			const result = extractSlashQuery("hello world")
			expect(result.inSlashMode).toBe(false)
			expect(result.query).toBe("")
			expect(result.slashIndex).toBe(-1)
		})

		it("returns not in slash mode when there is no slash", () => {
			expect(extractSlashQuery("hello world")).toEqual({
				inSlashMode: false,
				query: "",
				slashIndex: -1,
			})
		})

		it("should not trigger when slash is in middle of word", () => {
			const result = extractSlashQuery("http://example.com")
			expect(result.inSlashMode).toBe(false)
		})

		it("returns not in slash mode when slash is preceded by non-whitespace", () => {
			expect(extractSlashQuery("abc/hel")).toEqual({
				inSlashMode: false,
				query: "",
				slashIndex: -1,
			})
		})

		it("should exit slash mode when space follows query", () => {
			const result = extractSlashQuery("/help ")
			expect(result.inSlashMode).toBe(false)
		})

		it("returns not in slash mode when text after slash contains whitespace", () => {
			expect(extractSlashQuery("/hel there")).toEqual({
				inSlashMode: false,
				query: "",
				slashIndex: -1,
			})
		})

		it("should handle cursor position", () => {
			const result = extractSlashQuery("/help some text", 4)
			expect(result.inSlashMode).toBe(true)
			expect(result.query).toBe("hel")
		})

		it("respects cursor position when extracting slash query", () => {
			const text = "/hello there"
			const cursorPosition = 3

			expect(extractSlashQuery(text, cursorPosition)).toEqual({
				inSlashMode: true,
				query: "he",
				slashIndex: 0,
			})
		})

		it("should not trigger second slash when first command is completed", () => {
			const result = extractSlashQuery("/help text /another")
			expect(result.inSlashMode).toBe(false)
		})

		it("returns not in slash mode when an earlier slash command is already completed", () => {
			expect(extractSlashQuery("/help done /ne")).toEqual({
				inSlashMode: false,
				query: "",
				slashIndex: -1,
			})
		})

		it("should handle empty string", () => {
			const result = extractSlashQuery("")
			expect(result.inSlashMode).toBe(false)
		})

		it("should handle just a slash", () => {
			const result = extractSlashQuery("/")
			expect(result.inSlashMode).toBe(true)
			expect(result.query).toBe("")
		})
	})

	describe("filterCommands", () => {
		it("should return all commands when query is empty", () => {
			const commands = [makeCmd("help"), makeCmd("new"), makeCmd("settings")]
			const result = filterCommands(commands, "")
			expect(result).toHaveLength(3)
		})

		it("returns all commands for empty query", () => {
			const commands = [createCommand("help"), createCommand("status"), createCommand("workflow")]
			expect(filterCommands(commands, "")).toEqual(commands)
		})

		it("should filter by name", () => {
			const commands = [makeCmd("help"), makeCmd("new"), makeCmd("settings")]
			const result = filterCommands(commands, "hel")
			expect(result.some((c) => c.name === "help")).toBe(true)
		})

		it("filters commands using mocked fuzzy match", () => {
			const commands = [createCommand("help"), createCommand("status"), createCommand("workflow")]
			expect(filterCommands(commands, "sta").map((c) => c.name)).toEqual(["status"])
		})

		it("should handle no matches", () => {
			const commands = [makeCmd("help"), makeCmd("new")]
			const result = filterCommands(commands, "zzz")
			expect(result).toHaveLength(0)
		})
	})

	describe("insertSlashCommand", () => {
		it("should insert command at slash index", () => {
			const result = insertSlashCommand("/hel", 0, "help")
			expect(result).toBe("/help ")
		})

		it("should preserve text before slash", () => {
			const result = insertSlashCommand("text /hel", 5, "help")
			expect(result).toBe("text /help ")
		})

		it("should replace partial query", () => {
			const result = insertSlashCommand("/ne", 0, "new")
			expect(result).toBe("/new ")
		})

		it("should handle text after the partial query", () => {
			const result = insertSlashCommand("/hel more text", 0, "help")
			expect(result).toBe("/help ")
		})

		it("inserts slash command at slash index and replaces partial text", () => {
			const text = "please run /he now"
			const slashIndex = text.indexOf("/")

			expect(insertSlashCommand(text, slashIndex, "help")).toBe("please run /help ")
		})

		it("always adds a trailing space", () => {
			expect(insertSlashCommand("/w", 0, "workflow")).toBe("/workflow ")
		})
	})
})
