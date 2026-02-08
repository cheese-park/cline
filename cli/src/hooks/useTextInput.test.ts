import { describe, expect, it } from "vitest"

import { OPTION_LEFT_SEQUENCES, OPTION_RIGHT_SEQUENCES } from "../constants/keyboard"
import { findWordEnd, findWordStart } from "./useTextInput"

describe("useTextInput pure utilities", () => {
	it("findWordStart finds start of previous word", () => {
		expect(findWordStart("hello world", 11)).toBe(6)
		expect(findWordStart("hello world", 6)).toBe(0)
	})

	it("findWordStart skips whitespace before word", () => {
		expect(findWordStart("hello   world", 8)).toBe(0)
		expect(findWordStart("a  b", 4)).toBe(3)
	})

	it("findWordEnd finds end of next word and trailing spaces", () => {
		expect(findWordEnd("hello world", 0)).toBe(6)
		expect(findWordEnd("hello   world", 0)).toBe(8)
	})

	it("findWordEnd handles cursor at end and empty string", () => {
		expect(findWordEnd("", 0)).toBe(0)
		expect(findWordEnd("abc", 3)).toBe(3)
	})

	it("keyboard sequence sets include expected option-left and option-right values", () => {
		expect(OPTION_LEFT_SEQUENCES.has("\x1bb")).toBe(true)
		expect(OPTION_LEFT_SEQUENCES.has("\x1b[1;3D")).toBe(true)
		expect(OPTION_RIGHT_SEQUENCES.has("\x1bf")).toBe(true)
		expect(OPTION_RIGHT_SEQUENCES.has("\x1b[1;3C")).toBe(true)
	})
})
