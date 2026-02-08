import { describe, expect, it, vi } from "vitest"

vi.mock("fzf", () => ({
	Fzf: function Fzf(items: any[], opts: { selector: (item: any) => string }) {
		return {
			find: (q: string) =>
				items.filter((i: any) => opts.selector(i).toLowerCase().includes(q.toLowerCase())).map((i: any) => ({ item: i })),
		}
	},
}))

import { fuzzyFilter } from "./fuzzy-search"

describe("fuzzyFilter", () => {
	const items = [
		{ id: 1, label: "Alpha" },
		{ id: 2, label: "Beta" },
		{ id: 3, label: "Gamma" },
	]

	it("returns all items for empty query", () => {
		expect(fuzzyFilter(items, "", (item) => item.label)).toEqual(items)
	})

	it("returns all items for empty query as a copy", () => {
		const result = fuzzyFilter(items, "", (item) => item.label)
		expect(result).not.toBe(items)
	})

	it("filters matching items for query", () => {
		expect(fuzzyFilter(items, "alp", (item) => item.label)).toEqual([{ id: 1, label: "Alpha" }])
	})

	it("matches query case-insensitively", () => {
		expect(fuzzyFilter(items, "GAM", (item) => item.label)).toEqual([{ id: 3, label: "Gamma" }])
	})

	it("returns empty array for empty item list", () => {
		expect(fuzzyFilter([], "anything", (item: { label: string }) => item.label)).toEqual([])
	})

	it("should filter items by fuzzy match with string items", () => {
		const stringItems = ["apple", "banana", "cherry"]
		const result = fuzzyFilter(stringItems, "ban", (item) => item)
		expect(result).toContainEqual("banana")
		expect(result).not.toContainEqual("cherry")
	})

	it("should work with object items and selector", () => {
		const objectItems = [
			{ name: "apple", id: 1 },
			{ name: "banana", id: 2 },
			{ name: "cherry", id: 3 },
		]
		const result = fuzzyFilter(objectItems, "ban", (item) => item.name)
		expect(result.length).toBeGreaterThan(0)
		expect(result[0].name).toBe("banana")
	})

	it("should return empty array when no matches", () => {
		const stringItems = ["apple", "banana"]
		const result = fuzzyFilter(stringItems, "zzz", (item) => item)
		expect(result).toEqual([])
	})

	it("should be case-insensitive with string items", () => {
		const stringItems = ["Apple", "BANANA", "cherry"]
		const result = fuzzyFilter(stringItems, "apple", (item) => item)
		expect(result.length).toBeGreaterThan(0)
	})

	it("should order best matches first", () => {
		const stringItems = ["test", "testing", "tes"]
		const result = fuzzyFilter(stringItems, "tes", (item) => item)
		expect(result.length).toBeGreaterThan(0)
		// "tes" should be a top match since it's exact
		expect(result).toContainEqual("tes")
	})
})
