import { describe, expect, it } from "vitest"
import {
	DEFAULT_TOOL_DESCRIPTION,
	FILE_EDIT_TOOLS,
	FILE_SAVE_TOOLS,
	getToolDescription,
	isFileEditTool,
	isFileSaveTool,
	normalizeToolName,
	parseMessageJson,
	parseToolFromMessage,
	TOOL_DESCRIPTIONS,
} from "./tools"

describe("tools", () => {
	describe("FILE_EDIT_TOOLS", () => {
		it("should contain expected edit tools", () => {
			expect(FILE_EDIT_TOOLS.has("editedExistingFile")).toBe(true)
			expect(FILE_EDIT_TOOLS.has("newFileCreated")).toBe(true)
			expect(FILE_EDIT_TOOLS.has("replace_in_file")).toBe(true)
			expect(FILE_EDIT_TOOLS.has("write_to_file")).toBe(true)
			expect(FILE_EDIT_TOOLS.has("fileDeleted")).toBe(true)
		})

		it("should not contain non-edit tools", () => {
			expect(FILE_EDIT_TOOLS.has("read_file")).toBe(false)
			expect(FILE_EDIT_TOOLS.has("execute_command")).toBe(false)
		})

		it("contains expected file edit tools as exact set", () => {
			expect(FILE_EDIT_TOOLS).toEqual(
				new Set(["editedExistingFile", "newFileCreated", "replace_in_file", "write_to_file", "fileDeleted"]),
			)
		})
	})

	describe("FILE_SAVE_TOOLS", () => {
		it("should contain expected save tools", () => {
			expect(FILE_SAVE_TOOLS.has("editedExistingFile")).toBe(true)
			expect(FILE_SAVE_TOOLS.has("newFileCreated")).toBe(true)
			expect(FILE_SAVE_TOOLS.has("fileDeleted")).toBe(true)
		})

		it("should not contain replace_in_file or write_to_file", () => {
			expect(FILE_SAVE_TOOLS.has("replace_in_file")).toBe(false)
			expect(FILE_SAVE_TOOLS.has("write_to_file")).toBe(false)
		})

		it("contains expected file save tools as exact set", () => {
			expect(FILE_SAVE_TOOLS).toEqual(new Set(["editedExistingFile", "newFileCreated", "fileDeleted"]))
		})
	})

	describe("isFileEditTool", () => {
		it("should return true for file edit tools", () => {
			expect(isFileEditTool("editedExistingFile")).toBe(true)
			expect(isFileEditTool("newFileCreated")).toBe(true)
			expect(isFileEditTool("replace_in_file")).toBe(true)
			expect(isFileEditTool("write_to_file")).toBe(true)
			expect(isFileEditTool("fileDeleted")).toBe(true)
		})

		it("should return false for non-edit tools", () => {
			expect(isFileEditTool("read_file")).toBe(false)
			expect(isFileEditTool("execute_command")).toBe(false)
			expect(isFileEditTool("unknown_tool")).toBe(false)
		})

		it("should return false for undefined", () => {
			expect(isFileEditTool(undefined)).toBe(false)
		})

		it("should return false for empty string", () => {
			expect(isFileEditTool("")).toBe(false)
		})
	})

	describe("isFileSaveTool", () => {
		it("should return true for file save tools", () => {
			expect(isFileSaveTool("editedExistingFile")).toBe(true)
			expect(isFileSaveTool("newFileCreated")).toBe(true)
			expect(isFileSaveTool("fileDeleted")).toBe(true)
		})

		it("should return false for non-save tools", () => {
			expect(isFileSaveTool("replace_in_file")).toBe(false)
			expect(isFileSaveTool("write_to_file")).toBe(false)
			expect(isFileSaveTool("read_file")).toBe(false)
		})

		it("should return false for undefined", () => {
			expect(isFileSaveTool(undefined)).toBe(false)
		})

		it("should return false for empty string", () => {
			expect(isFileSaveTool("")).toBe(false)
		})
	})

	describe("normalizeToolName", () => {
		it("should convert camelCase to snake_case", () => {
			expect(normalizeToolName("readFile")).toBe("read_file")
			expect(normalizeToolName("writeToFile")).toBe("write_to_file")
			expect(normalizeToolName("editedExistingFile")).toBe("edited_existing_file")
			expect(normalizeToolName("listFilesTopLevel")).toBe("list_files_top_level")
		})

		it("should lowercase already snake_case names", () => {
			expect(normalizeToolName("read_file")).toBe("read_file")
			expect(normalizeToolName("write_to_file")).toBe("write_to_file")
		})

		it("should handle single word", () => {
			expect(normalizeToolName("search")).toBe("search")
		})

		it("should handle already lowercase", () => {
			expect(normalizeToolName("read")).toBe("read")
		})

		it("should handle consecutive uppercase letters", () => {
			expect(normalizeToolName("useMCPTool")).toBe("use_mcptool")
		})
	})

	describe("TOOL_DESCRIPTIONS", () => {
		it("should have descriptions for file operations", () => {
			expect(TOOL_DESCRIPTIONS.read_file).toBeDefined()
			expect(TOOL_DESCRIPTIONS.write_to_file).toBeDefined()
			expect(TOOL_DESCRIPTIONS.replace_in_file).toBeDefined()
		})

		it("should have descriptions for command execution", () => {
			expect(TOOL_DESCRIPTIONS.execute_command).toBeDefined()
		})

		it("should have ask and say fields", () => {
			const desc = TOOL_DESCRIPTIONS.read_file
			expect(desc.ask).toBeTruthy()
			expect(desc.say).toBeTruthy()
		})

		it("stores snake_case keys with ask/say strings", () => {
			for (const [key, value] of Object.entries(TOOL_DESCRIPTIONS)) {
				expect(key).toMatch(/^[a-z0-9_]+$/)
				expect(value).toMatchObject({ ask: expect.any(String), say: expect.any(String) })
			}
		})
	})

	describe("DEFAULT_TOOL_DESCRIPTION", () => {
		it("should have generic ask and say", () => {
			expect(DEFAULT_TOOL_DESCRIPTION.ask).toBe("wants to use a tool")
			expect(DEFAULT_TOOL_DESCRIPTION.say).toBe("used a tool")
		})

		it("has ask and say string fields as exact object", () => {
			expect(DEFAULT_TOOL_DESCRIPTION).toEqual({
				ask: "wants to use a tool",
				say: "used a tool",
			})
		})
	})

	describe("getToolDescription", () => {
		it("should return description for known snake_case tool", () => {
			const desc = getToolDescription("read_file")
			expect(desc.ask).toBe("wants to read this file")
			expect(desc.say).toBe("read this file")
		})

		it("should return description for camelCase tool by normalizing", () => {
			const desc = getToolDescription("readFile")
			expect(desc.ask).toBe("wants to read this file")
		})

		it("returns description for known camelCase tool (editedExistingFile)", () => {
			expect(getToolDescription("editedExistingFile")).toEqual({
				ask: "wants to edit this file",
				say: "edited this file",
			})
		})

		it("should return default description for unknown tool", () => {
			const desc = getToolDescription("unknown_tool")
			expect(desc).toBe(DEFAULT_TOOL_DESCRIPTION)
		})

		it("returns default description for totally unknown tool", () => {
			expect(getToolDescription("totally_unknown_tool")).toBe(DEFAULT_TOOL_DESCRIPTION)
		})

		it("should return description for execute_command", () => {
			const desc = getToolDescription("execute_command")
			expect(desc.ask).toContain("command")
		})
	})

	describe("parseMessageJson", () => {
		it("should parse valid JSON", () => {
			const result = parseMessageJson('{"key": "value"}', {})
			expect(result).toEqual({ key: "value" })
		})

		it("parses valid JSON object", () => {
			expect(parseMessageJson('{"a":1}', { a: 0 })).toEqual({ a: 1 })
		})

		it("should return default for invalid JSON", () => {
			const result = parseMessageJson("not json", { fallback: true })
			expect(result).toEqual({ fallback: true })
		})

		it("returns default for invalid JSON (curly brace only)", () => {
			const fallback = { ok: false }
			expect(parseMessageJson("{bad", fallback)).toBe(fallback)
		})

		it("should return default for undefined text", () => {
			const result = parseMessageJson(undefined, "default")
			expect(result).toBe("default")
		})

		it("should return default for empty string", () => {
			const result = parseMessageJson("", "default")
			expect(result).toBe("default")
		})

		it("returns default for empty string (array fallback)", () => {
			expect(parseMessageJson("", ["default"])).toEqual(["default"])
		})

		it("should parse arrays", () => {
			const result = parseMessageJson("[1,2,3]", [])
			expect(result).toEqual([1, 2, 3])
		})

		it("should parse nested objects", () => {
			const result = parseMessageJson('{"a":{"b":"c"}}', {})
			expect(result).toEqual({ a: { b: "c" } })
		})
	})

	describe("parseToolFromMessage", () => {
		it("should parse tool message with tool field", () => {
			const text = JSON.stringify({ tool: "read_file", path: "/test.ts" })
			const result = parseToolFromMessage(text)
			expect(result).not.toBeNull()
			expect(result?.toolName).toBe("read_file")
			expect(result?.args.path).toBe("/test.ts")
		})

		it("parses valid tool JSON with content result", () => {
			expect(parseToolFromMessage('{"tool":"read_file","path":"a.ts","content":"ok"}')).toEqual({
				toolName: "read_file",
				args: { tool: "read_file", path: "a.ts", content: "ok" },
				result: "ok",
			})
		})

		it("should return result from content field", () => {
			const text = JSON.stringify({ tool: "read_file", content: "file contents here" })
			const result = parseToolFromMessage(text)
			expect(result?.result).toBe("file contents here")
		})

		it("should return result from output field", () => {
			const text = JSON.stringify({ tool: "execute_command", output: "command output" })
			const result = parseToolFromMessage(text)
			expect(result?.result).toBe("command output")
		})

		it("parses valid tool JSON with output result", () => {
			expect(parseToolFromMessage('{"tool":"execute_command","output":"done"}')).toEqual({
				toolName: "execute_command",
				args: { tool: "execute_command", output: "done" },
				result: "done",
			})
		})

		it("should return null for non-tool JSON", () => {
			const text = JSON.stringify({ message: "hello" })
			const result = parseToolFromMessage(text)
			expect(result).toBeNull()
		})

		it("returns null when JSON has no tool field", () => {
			expect(parseToolFromMessage('{"content":"no tool"}')).toBeNull()
		})

		it("should return null for invalid JSON", () => {
			const result = parseToolFromMessage("not json")
			expect(result).toBeNull()
		})

		it("returns null for invalid JSON (curly brace only)", () => {
			expect(parseToolFromMessage("{")).toBeNull()
		})

		it("should return null for undefined", () => {
			const result = parseToolFromMessage(undefined)
			expect(result).toBeNull()
		})

		it("should return null for empty string", () => {
			const result = parseToolFromMessage("")
			expect(result).toBeNull()
		})
	})
})
