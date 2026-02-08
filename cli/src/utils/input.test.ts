import { describe, expect, it } from "vitest"
import { isMouseEscapeSequence } from "./input"

describe("input", () => {
	describe("isMouseEscapeSequence", () => {
		it("returns true for SGR mouse press format", () => {
			expect(isMouseEscapeSequence("\x1b[<35;46;17M")).toBe(true)
		})

		it("returns true for SGR mouse release format", () => {
			expect(isMouseEscapeSequence("\x1b[<35;46;17m")).toBe(true)
		})

		it("should detect mouse events with different coordinates", () => {
			expect(isMouseEscapeSequence("\x1b[<0;1;1M")).toBe(true)
			expect(isMouseEscapeSequence("\x1b[<64;100;200M")).toBe(true)
		})

		it("returns false for arrow down keyboard sequence", () => {
			expect(isMouseEscapeSequence("\x1b[B")).toBe(false)
		})

		it("should not detect arrow key escape sequences", () => {
			expect(isMouseEscapeSequence("\x1b[A")).toBe(false)
			expect(isMouseEscapeSequence("\x1b[B")).toBe(false)
			expect(isMouseEscapeSequence("\x1b[C")).toBe(false)
			expect(isMouseEscapeSequence("\x1b[D")).toBe(false)
		})

		it("returns false for Option+left arrow sequence", () => {
			expect(isMouseEscapeSequence("\x1b[1;3D")).toBe(false)
		})

		it("should not detect other escape sequences", () => {
			expect(isMouseEscapeSequence("\x1b[1;5C")).toBe(false) // Ctrl+right arrow
			expect(isMouseEscapeSequence("\x1b[H")).toBe(false) // Home
		})

		it("returns false for plain text", () => {
			expect(isMouseEscapeSequence("hello")).toBe(false)
		})

		it("returns false for empty string", () => {
			expect(isMouseEscapeSequence("")).toBe(false)
		})

		it("should not detect regular single-char keyboard input", () => {
			expect(isMouseEscapeSequence("a")).toBe(false)
		})

		it("returns false for home key sequence", () => {
			expect(isMouseEscapeSequence("\x1b[H")).toBe(false)
		})

		it("returns true when mouse sequence appears inside larger input", () => {
			expect(isMouseEscapeSequence(`prefix\x1b[<1;2;3Msuffix`)).toBe(true)
		})

		it("returns false for incomplete mouse sequence without terminator", () => {
			expect(isMouseEscapeSequence("\x1b[<35;46;17")).toBe(false)
		})

		it("returns false for malformed mouse sequence with non-numeric coordinates", () => {
			expect(isMouseEscapeSequence("\x1b[<a;46;17M")).toBe(false)
		})
	})
})
