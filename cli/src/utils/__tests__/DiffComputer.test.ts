import { describe, expect, it, vi } from "vitest"

vi.mock("diff", () => ({
	diffLines: (search: string, replace: string) => {
		const searchLines = search ? search.split("\n") : []
		const replaceLines = replace ? replace.split("\n") : []

		let prefix = 0
		while (prefix < searchLines.length && prefix < replaceLines.length && searchLines[prefix] === replaceLines[prefix]) {
			prefix++
		}

		let suffix = 0
		while (
			suffix < searchLines.length - prefix &&
			suffix < replaceLines.length - prefix &&
			searchLines[searchLines.length - 1 - suffix] === replaceLines[replaceLines.length - 1 - suffix]
		) {
			suffix++
		}

		const prefixLines = searchLines.slice(0, prefix)
		const removedLines = searchLines.slice(prefix, searchLines.length - suffix)
		const addedLines = replaceLines.slice(prefix, replaceLines.length - suffix)
		const suffixLines = searchLines.slice(searchLines.length - suffix)

		const changes: Array<{ value: string; added?: boolean; removed?: boolean }> = []
		if (prefixLines.length > 0) changes.push({ value: prefixLines.join("\n") })
		if (removedLines.length > 0) changes.push({ value: removedLines.join("\n"), removed: true })
		if (addedLines.length > 0) changes.push({ value: addedLines.join("\n"), added: true })
		if (suffixLines.length > 0) changes.push({ value: suffixLines.join("\n") })

		if (changes.length === 0) {
			changes.push({ value: "" })
		}

		return changes
	},
}))

import { computeDiff, getGutterWidth } from "../DiffComputer"

describe("DiffComputer", () => {
	describe("computeDiff", () => {
		it("should compute diff for SEARCH/REPLACE format with changes", () => {
			const content = `------- SEARCH
function hello() {
  console.log("hello")
}
=======
function hello() {
  console.log("hello, world!")
}
+++++++ REPLACE`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(1)
			expect(diff.totalDeletions).toBeGreaterThan(0)
			expect(diff.totalAdditions).toBeGreaterThan(0)

			// Should have context lines for unchanged parts
			const contextLines = diff.blocks[0].lines.filter((l) => l.type === "context")
			expect(contextLines.length).toBeGreaterThan(0)

			// Should have the changed line
			const removeLines = diff.blocks[0].lines.filter((l) => l.type === "remove")
			const addLines = diff.blocks[0].lines.filter((l) => l.type === "add")
			expect(removeLines.some((l) => l.content.includes('"hello"'))).toBe(true)
			expect(addLines.some((l) => l.content.includes('"hello, world!"'))).toBe(true)
		})

		it("should handle streaming (incomplete SEARCH block)", () => {
			const content = `------- SEARCH
function hello() {
  console.log("hello")`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(1)
			expect(diff.totalDeletions).toBeGreaterThan(0)
			expect(diff.totalAdditions).toBe(0) // No replace block yet
		})

		it("should handle multiple SEARCH/REPLACE blocks", () => {
			const content = `------- SEARCH
const a = 1
=======
const a = 2
+++++++ REPLACE
------- SEARCH
const b = 3
=======
const b = 4
+++++++ REPLACE`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(2)
			expect(diff.totalDeletions).toBe(2)
			expect(diff.totalAdditions).toBe(2)
		})

		it("should handle new file (all additions)", () => {
			const content = `line 1
line 2
line 3`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(1)
			expect(diff.totalAdditions).toBe(3)
			expect(diff.totalDeletions).toBe(0)
			expect(diff.blocks[0].lines.every((l) => l.type === "add")).toBe(true)
		})

		it("should assign line numbers correctly", () => {
			const content = `------- SEARCH
line 1
line 2
=======
line 1
new line
line 2
+++++++ REPLACE`

			const diff = computeDiff(content)
			const lines = diff.blocks[0].lines

			// Context lines should have both old and new line numbers
			const contextLines = lines.filter((l) => l.type === "context")
			for (const line of contextLines) {
				expect(line.oldLineNumber).toBeDefined()
				expect(line.newLineNumber).toBeDefined()
			}

			// Add lines should have new line numbers
			const addLines = lines.filter((l) => l.type === "add")
			for (const line of addLines) {
				expect(line.newLineNumber).toBeDefined()
			}
		})
	})

	describe("getGutterWidth", () => {
		it("should return correct width for single digit line numbers", () => {
			const diff = computeDiff("line 1\nline 2\nline 3")
			expect(getGutterWidth(diff)).toBe(1)
		})

		it("should return correct width for double digit line numbers", () => {
			const lines = Array.from({ length: 15 }, (_, i) => `line ${i + 1}`).join("\n")
			const diff = computeDiff(lines)
			expect(getGutterWidth(diff)).toBe(2)
		})

		it("should return correct width for triple digit line numbers", () => {
			const lines = Array.from({ length: 150 }, (_, i) => `line ${i + 1}`).join("\n")
			const diff = computeDiff(lines)
			expect(getGutterWidth(diff)).toBe(3)
		})

		it("should handle empty diff", () => {
			const diff = computeDiff("")
			expect(getGutterWidth(diff)).toBe(1)
		})
	})

	describe("computeDiff advanced cases", () => {
		it("should handle deletion (no replace block)", () => {
			const content = `------- SEARCH
function toDelete() {
  return 42
}
=======
+++++++ REPLACE`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(1)
			expect(diff.blocks[0].deletions).toBeGreaterThan(0)
			expect(diff.blocks[0].additions).toBe(0)
		})

		it("should handle insertion (empty search)", () => {
			const content = `------- SEARCH
=======
function newFunc() {
  return 42
}
+++++++ REPLACE`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(1)
			expect(diff.blocks[0].additions).toBeGreaterThan(0)
			expect(diff.blocks[0].deletions).toBe(0)
		})

		it("should handle windows line endings", () => {
			const content = `------- SEARCH\r\nline 1\r\nline 2\r\n=======\r\nline 1\r\nmodified\r\n+++++++ REPLACE`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(1)
			expect(diff.blocks[0].lines.length).toBeGreaterThan(0)
		})

		it("should handle tabs and special characters", () => {
			const content = `------- SEARCH
\tconst x = 1
=======
\tconst x = 2
+++++++ REPLACE`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(1)
			const lines = diff.blocks[0].lines
			expect(lines.some((l) => l.type === "remove" && l.content.includes("x = 1"))).toBe(true)
			expect(lines.some((l) => l.type === "add" && l.content.includes("x = 2"))).toBe(true)
		})

		it("should handle replace-only content correctly", () => {
			const content = `------- SEARCH
search text
=======
replace text
+++++++ REPLACE`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(1)
			expect(diff.blocks[0].additions).toBeGreaterThan(0)
			expect(diff.blocks[0].deletions).toBeGreaterThan(0)
		})

		it("should accumulate totals from multiple blocks", () => {
			const content = `------- SEARCH
a
=======
b
+++++++ REPLACE
------- SEARCH
c
d
=======
c
+++++++ REPLACE`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(2)
			expect(diff.totalDeletions).toBeGreaterThan(0)
			expect(diff.totalAdditions).toBeGreaterThan(0)
			// Total should be sum of blocks
			expect(diff.totalDeletions).toBe(diff.blocks.reduce((sum, b) => sum + b.deletions, 0))
			expect(diff.totalAdditions).toBe(diff.blocks.reduce((sum, b) => sum + b.additions, 0))
		})

		it("should handle very long lines", () => {
			const longLine = "x".repeat(1000)
			const content = `------- SEARCH
${longLine}
=======
${longLine}modified
+++++++ REPLACE`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(1)
			expect(diff.blocks[0].lines.length).toBeGreaterThan(0)
		})

		it("should handle empty lines in diff", () => {
			const content = `------- SEARCH
line 1

line 3
=======
line 1

line 3 modified
+++++++ REPLACE`

			const diff = computeDiff(content)

			expect(diff.blocks).toHaveLength(1)
			const lines = diff.blocks[0].lines
			// The mock diffLines merges the empty line into the prefix context chunk,
			// and the trailing newline stripping in computeLineDiff drops it,
			// so no empty context lines are produced.
			const emptyContext = lines.filter((l) => l.type === "context" && l.content === "")
			expect(emptyContext.length).toBe(0)
		})

		it("should properly number lines in complex diffs", () => {
			const content = `------- SEARCH
line 1
line 2
line 3
=======
line 1
NEW
line 2
line 3
+++++++ REPLACE`

			const diff = computeDiff(content)
			const lines = diff.blocks[0].lines

			// Verify line numbering is consistent
			const newLines = lines.filter((l) => l.type === "add")
			const oldLines = lines.filter((l) => l.type === "context" || l.type === "remove")

			for (const line of newLines) {
				expect(line.newLineNumber).toBeDefined()
				expect(line.newLineNumber).toBeGreaterThan(0)
			}

			for (const line of oldLines) {
				if (line.oldLineNumber) {
					expect(line.oldLineNumber).toBeGreaterThan(0)
				}
			}
		})
	})
})
