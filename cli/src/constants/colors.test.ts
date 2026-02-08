/**
 * Tests for colors.ts
 *
 * Tests the color constants and mode color utility.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { COLORS, getModeColor } from "./colors"

describe("colors", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("COLORS constant", () => {
		it("should have primaryBlue color defined", () => {
			expect(COLORS.primaryBlue).toBe("#B1B9F9")
		})

		it("should have planYellow color defined", () => {
			expect(COLORS.planYellow).toBe("yellow")
		})
	})

	describe("getModeColor", () => {
		it("should return planYellow for plan mode", () => {
			const color = getModeColor("plan")
			expect(color).toBe(COLORS.planYellow)
			expect(color).toBe("yellow")
		})

		it("should return primaryBlue for act mode", () => {
			const color = getModeColor("act")
			expect(color).toBe(COLORS.primaryBlue)
			expect(color).toBe("#B1B9F9")
		})

		it("should return consistent colors for same mode", () => {
			const color1 = getModeColor("plan")
			const color2 = getModeColor("plan")
			expect(color1).toBe(color2)
		})

		it("should return different colors for different modes", () => {
			const planColor = getModeColor("plan")
			const actColor = getModeColor("act")
			expect(planColor).not.toBe(actColor)
		})
	})
})
