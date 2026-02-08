import { describe, expect, it } from "vitest"
import * as types from "./types"

describe("agent/types module", () => {
	it("loads without runtime errors", () => {
		expect(types).toBeTypeOf("object")
	})
})
