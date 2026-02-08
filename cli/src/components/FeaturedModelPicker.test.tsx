import { render } from "ink-testing-library"
import { describe, expect, it, vi } from "vitest"

// Mock featured models - using teams version with more model data (3 models with provider/modelId fields)
vi.mock("../constants/featured-models", () => ({
	getAllFeaturedModels: () => [
		{
			id: "model-1",
			name: "Test Model 1",
			description: "Best model",
			labels: ["Best"],
			provider: "anthropic",
			modelId: "m1",
		},
		{ id: "model-2", name: "Test Model 2", description: "Free model", labels: ["FREE"], provider: "cline", modelId: "m2" },
		{
			id: "model-3",
			name: "Test Model 3",
			description: "New model",
			labels: ["New", "Trending"],
			provider: "openai",
			modelId: "m3",
		},
	],
}))

import {
	FeaturedModelPicker,
	getFeaturedModelAtIndex,
	getFeaturedModelMaxIndex,
	isBrowseAllSelected,
} from "./FeaturedModelPicker"

describe("FeaturedModelPicker", () => {
	it("should render all featured models", () => {
		const { lastFrame } = render(<FeaturedModelPicker selectedIndex={0} />)
		expect(lastFrame()).toContain("Test Model 1")
		expect(lastFrame()).toContain("Test Model 2")
		expect(lastFrame()).toContain("Test Model 3")
	})

	it("should render model descriptions", () => {
		const { lastFrame } = render(<FeaturedModelPicker selectedIndex={0} />)
		expect(lastFrame()).toContain("Best model")
		expect(lastFrame()).toContain("Free model")
	})

	it("should render model labels", () => {
		const { lastFrame } = render(<FeaturedModelPicker selectedIndex={0} />)
		expect(lastFrame()).toContain("Best")
		expect(lastFrame()).toContain("FREE")
		expect(lastFrame()).toContain("Trending")
	})

	it("should show selection indicator on selected item", () => {
		const { lastFrame } = render(<FeaturedModelPicker selectedIndex={0} />)
		expect(lastFrame()).toContain("❯")
	})

	it("should show Browse all option by default", () => {
		const { lastFrame } = render(<FeaturedModelPicker selectedIndex={0} />)
		expect(lastFrame()).toContain("Browse all models")
	})

	it("should hide Browse all option when showBrowseAll is false", () => {
		const { lastFrame } = render(<FeaturedModelPicker selectedIndex={0} showBrowseAll={false} />)
		expect(lastFrame()).not.toContain("Browse all models")
	})

	it("renders title when provided", () => {
		const { lastFrame } = render(<FeaturedModelPicker selectedIndex={0} title="Pick a model" />)
		expect(lastFrame()).toContain("Pick a model")
	})

	it("should show default help text", () => {
		const { lastFrame } = render(<FeaturedModelPicker selectedIndex={0} />)
		expect(lastFrame()).toContain("Arrows to navigate")
	})

	it("should show custom help text", () => {
		const { lastFrame } = render(<FeaturedModelPicker helpText="Custom help" selectedIndex={0} />)
		expect(lastFrame()).toContain("Custom help")
	})

	it("should select Browse all when selectedIndex equals model count", () => {
		const { lastFrame } = render(<FeaturedModelPicker selectedIndex={3} />)
		expect(lastFrame()).toContain("Browse all models")
	})

	it("renders browse-all option and selection marker", () => {
		const { lastFrame } = render(<FeaturedModelPicker selectedIndex={3} showBrowseAll />)
		expect(lastFrame()).toContain("❯")
		expect(lastFrame()).toContain("Browse all models")
	})
})

describe("getFeaturedModelMaxIndex", () => {
	it("should return model count when showBrowseAll is true", () => {
		expect(getFeaturedModelMaxIndex(true)).toBe(3)
	})

	it("should return model count minus 1 when showBrowseAll is false", () => {
		expect(getFeaturedModelMaxIndex(false)).toBe(2)
	})
})

describe("isBrowseAllSelected", () => {
	it("should return true when index equals model count", () => {
		expect(isBrowseAllSelected(3)).toBe(true)
	})

	it("should return false when index is less than model count", () => {
		expect(isBrowseAllSelected(0)).toBe(false)
		expect(isBrowseAllSelected(2)).toBe(false)
	})
})

describe("getFeaturedModelAtIndex", () => {
	it("should return model at valid index", () => {
		const model = getFeaturedModelAtIndex(0)
		expect(model).not.toBeNull()
		expect(model?.name).toBe("Test Model 1")
	})

	it("should return null for Browse all index", () => {
		expect(getFeaturedModelAtIndex(3)).toBeNull()
	})

	it("should return null for negative index", () => {
		expect(getFeaturedModelAtIndex(-1)).toBeNull()
	})
})
