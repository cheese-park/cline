import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { END_SEQUENCES, HOME_SEQUENCES, OPTION_LEFT_SEQUENCES, OPTION_RIGHT_SEQUENCES } from "./keyboard"

describe("keyboard constants", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("HOME_SEQUENCES contains \\x1b[H", () => {
		expect(HOME_SEQUENCES.has("\x1b[H")).toBe(true)
	})

	it("HOME_SEQUENCES contains \\x1b[1~", () => {
		expect(HOME_SEQUENCES.has("\x1b[1~")).toBe(true)
	})

	it("HOME_SEQUENCES contains \\x1bOH", () => {
		expect(HOME_SEQUENCES.has("\x1bOH")).toBe(true)
	})

	it("HOME_SEQUENCES contains \\x1b[7~", () => {
		expect(HOME_SEQUENCES.has("\x1b[7~")).toBe(true)
	})

	it("HOME_SEQUENCES has size 4", () => {
		expect(HOME_SEQUENCES.size).toBe(4)
	})

	it("END_SEQUENCES contains \\x1b[F", () => {
		expect(END_SEQUENCES.has("\x1b[F")).toBe(true)
	})

	it("END_SEQUENCES contains \\x1b[4~", () => {
		expect(END_SEQUENCES.has("\x1b[4~")).toBe(true)
	})

	it("END_SEQUENCES contains \\x1bOF", () => {
		expect(END_SEQUENCES.has("\x1bOF")).toBe(true)
	})

	it("END_SEQUENCES contains \\x1b[8~", () => {
		expect(END_SEQUENCES.has("\x1b[8~")).toBe(true)
	})

	it("END_SEQUENCES has size 4", () => {
		expect(END_SEQUENCES.size).toBe(4)
	})

	it("OPTION_LEFT_SEQUENCES contains \\x1bb", () => {
		expect(OPTION_LEFT_SEQUENCES.has("\x1bb")).toBe(true)
	})

	it("OPTION_LEFT_SEQUENCES contains \\x1b[1;3D", () => {
		expect(OPTION_LEFT_SEQUENCES.has("\x1b[1;3D")).toBe(true)
	})

	it("OPTION_RIGHT_SEQUENCES contains \\x1bf", () => {
		expect(OPTION_RIGHT_SEQUENCES.has("\x1bf")).toBe(true)
	})

	it("OPTION_RIGHT_SEQUENCES contains \\x1b[1;3C", () => {
		expect(OPTION_RIGHT_SEQUENCES.has("\x1b[1;3C")).toBe(true)
	})
})
