import { describe, expect, it } from "vitest"
import { AsciiMotionCli, StaticRobotFrame } from "./AsciiMotionCli"

describe("AsciiMotionCli module", () => {
	it("exports AsciiMotionCli component", () => {
		expect(typeof AsciiMotionCli).toBe("function")
	})

	it("exports StaticRobotFrame component", () => {
		expect(typeof StaticRobotFrame).toBe("function")
	})
})
