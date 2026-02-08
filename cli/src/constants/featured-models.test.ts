import { describe, expect, it } from "vitest"
import { FEATURED_MODELS, getAllFeaturedModels } from "./featured-models"

describe("featured-models", () => {
	it("exposes recommended and free arrays", () => {
		expect(Array.isArray(FEATURED_MODELS.recommended)).toBe(true)
		expect(Array.isArray(FEATURED_MODELS.free)).toBe(true)
	})

	it("has at least one recommended and one free model", () => {
		expect(FEATURED_MODELS.recommended.length).toBeGreaterThan(0)
		expect(FEATURED_MODELS.free.length).toBeGreaterThan(0)
	})

	it("getAllFeaturedModels returns combined list in order", () => {
		const all = getAllFeaturedModels()
		expect(all).toEqual([...FEATURED_MODELS.recommended, ...FEATURED_MODELS.free])
	})

	it("every featured model has required structure", () => {
		for (const model of getAllFeaturedModels()) {
			expect(model).toMatchObject({
				id: expect.any(String),
				name: expect.any(String),
				description: expect.any(String),
				labels: expect.any(Array),
			})
			expect(model.labels.every((label) => typeof label === "string")).toBe(true)
		}
	})

	it("returns a new array instance", () => {
		const allA = getAllFeaturedModels()
		const allB = getAllFeaturedModels()

		expect(allA).not.toBe(allB)
		expect(allA).toEqual(allB)
	})
})
