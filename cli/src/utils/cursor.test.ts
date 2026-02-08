import { describe, expect, it } from "vitest"
import { moveCursorDown, moveCursorUp } from "./cursor"

function positionAt(text: string, line: number, column: number): number {
	const lines = text.split("\n")
	let offset = 0
	for (let i = 0; i < line; i++) {
		offset += lines[i].length + 1
	}
	return offset + column
}

describe("cursor", () => {
	describe("moveCursorUp", () => {
		it("returns 0 when already on first line", () => {
			expect(moveCursorUp("alpha\nbeta", 2)).toBe(0)
		})

		it("should move to start when on first line (single line)", () => {
			expect(moveCursorUp("hello", 3)).toBe(0)
		})

		it("moves up from second line preserving column", () => {
			const text = "abc\ndefg"
			const start = positionAt(text, 1, 2)
			expect(moveCursorUp(text, start)).toBe(positionAt(text, 0, 2))
		})

		it("should move to same column on previous line", () => {
			const text = "hello\nworld"
			// Cursor at 'r' in 'world' (index 8)
			const result = moveCursorUp(text, 8)
			// Should move to 'l' in 'hello' (index 2)
			expect(result).toBe(2)
		})

		it("clamps to previous line end when column exceeds length", () => {
			const text = "ab\ncdef"
			const start = positionAt(text, 1, 3)
			expect(moveCursorUp(text, start)).toBe(positionAt(text, 0, 2))
		})

		it("should clamp column when previous line is shorter", () => {
			const text = "hi\nhello world"
			// Cursor at 'w' in 'world' (index 9)
			const result = moveCursorUp(text, 9)
			// Previous line "hi" has length 2, so column clamped
			expect(result).toBe(2) // end of "hi"
		})

		it("moves from third line to second line", () => {
			const text = "short\nmuchlonger\nmid"
			const start = positionAt(text, 2, 2)
			expect(moveCursorUp(text, start)).toBe(positionAt(text, 1, 2))
		})

		it("clamps when moving from long third line to short second line", () => {
			const text = "aaa\nb\ncccccc"
			const start = positionAt(text, 2, 5)
			expect(moveCursorUp(text, start)).toBe(positionAt(text, 1, 1))
		})

		it("moves to start of previous line from line start", () => {
			const text = "line1\nline2"
			const start = positionAt(text, 1, 0)
			expect(moveCursorUp(text, start)).toBe(positionAt(text, 0, 0))
		})

		it("should handle cursor at start of second line", () => {
			const text = "hello\nworld"
			// Cursor at 'w' (index 6)
			const result = moveCursorUp(text, 6)
			// Column 0 on previous line = index 0
			expect(result).toBe(0)
		})

		it("should handle three lines", () => {
			const text = "aaa\nbbb\nccc"
			// Cursor at index 10 ('c' at column 2 of third line)
			const result = moveCursorUp(text, 10)
			// Should be at column 2 of second line = index 6
			expect(result).toBe(6)
		})

		it("should handle empty first line", () => {
			const text = "\nhello"
			// Cursor at 'h' (index 1)
			const result = moveCursorUp(text, 1)
			// Previous line is empty, col clamped to 0
			expect(result).toBe(0)
		})

		it("should handle cursor at beginning of text", () => {
			expect(moveCursorUp("hello\nworld", 0)).toBe(0)
		})
	})

	describe("moveCursorDown", () => {
		it("returns text.length when already on last line", () => {
			const text = "alpha\nbeta"
			expect(moveCursorDown(text, positionAt(text, 1, 2))).toBe(text.length)
		})

		it("should move to end when on last line (single line)", () => {
			expect(moveCursorDown("hello", 3)).toBe(5)
		})

		it("moves down from first line preserving column", () => {
			const text = "abc\ndefg"
			const start = positionAt(text, 0, 2)
			expect(moveCursorDown(text, start)).toBe(positionAt(text, 1, 2))
		})

		it("should move to same column on next line", () => {
			const text = "hello\nworld"
			// Cursor at 'l' in 'hello' (index 2)
			const result = moveCursorDown(text, 2)
			// Should move to 'r' in 'world' (index 8)
			expect(result).toBe(8)
		})

		it("clamps to next line end when column exceeds length", () => {
			const text = "abcdef\nxy"
			const start = positionAt(text, 0, 5)
			expect(moveCursorDown(text, start)).toBe(positionAt(text, 1, 2))
		})

		it("should clamp column when next line is shorter", () => {
			const text = "hello world\nhi"
			// Cursor at column 5 ('w') of first line (index 5)
			const result = moveCursorDown(text, 5)
			// Next line "hi" has length 2, clamped to index 14
			expect(result).toBe(14) // end of "hi"
		})

		it("moves from first to second in three-line text", () => {
			const text = "one\ntwo\nthree"
			const start = positionAt(text, 0, 1)
			expect(moveCursorDown(text, start)).toBe(positionAt(text, 1, 1))
		})

		it("moves from second to third preserving column", () => {
			const text = "one\nlongline\nthree"
			const start = positionAt(text, 1, 3)
			expect(moveCursorDown(text, start)).toBe(positionAt(text, 2, 3))
		})

		it("clamps from second to shorter third line", () => {
			const text = "one\nlongline\nhi"
			const start = positionAt(text, 1, 6)
			expect(moveCursorDown(text, start)).toBe(positionAt(text, 2, 2))
		})

		it("should handle cursor at start of line", () => {
			const text = "hello\nworld"
			// Cursor at 'h' (index 0)
			const result = moveCursorDown(text, 0)
			// Column 0 on next line = index 6
			expect(result).toBe(6)
		})

		it("should handle three lines moving from second to third", () => {
			const text = "aaa\nbbb\nccc"
			// Cursor at index 5 ('b' at column 1 of second line)
			const result = moveCursorDown(text, 5)
			// Should be at column 1 of third line = index 9
			expect(result).toBe(9)
		})

		it("should handle empty next line", () => {
			const text = "hello\n"
			// Cursor at 'h' (index 0)
			const result = moveCursorDown(text, 0)
			// Next line is empty, col clamped to 0
			expect(result).toBe(6)
		})

		it("should handle cursor at end of text", () => {
			expect(moveCursorDown("hello\nworld", 11)).toBe(11)
		})
	})
})
