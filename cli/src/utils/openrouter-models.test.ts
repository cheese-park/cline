import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/shared/api", () => ({
	openRouterDefaultModelId: "anthropic/claude-sonnet-4-20250514",
}))

vi.mock("@/shared/net", () => ({
	fetch: vi.fn(),
}))

vi.mock("@/shared/services/Logger", () => ({
	Logger: { debug: vi.fn(), error: vi.fn(), log: vi.fn() },
}))

describe("openrouter-models", () => {
	beforeEach(() => {
		vi.resetModules()
	})

	afterEach(() => {
		vi.clearAllMocks()
		vi.restoreAllMocks()
	})

	it("usesOpenRouterModels returns true for openrouter", async () => {
		const { usesOpenRouterModels } = await import("./openrouter-models")
		expect(usesOpenRouterModels("openrouter")).toBe(true)
	})

	it("usesOpenRouterModels returns true for cline", async () => {
		const { usesOpenRouterModels } = await import("./openrouter-models")
		expect(usesOpenRouterModels("cline")).toBe(true)
	})

	it("usesOpenRouterModels returns false for anthropic", async () => {
		const { usesOpenRouterModels } = await import("./openrouter-models")
		expect(usesOpenRouterModels("anthropic")).toBe(false)
	})

	it("usesOpenRouterModels returns false for openai", async () => {
		const { usesOpenRouterModels } = await import("./openrouter-models")
		expect(usesOpenRouterModels("openai")).toBe(false)
	})

	it("usesOpenRouterModels returns false for empty provider", async () => {
		const { usesOpenRouterModels } = await import("./openrouter-models")
		expect(usesOpenRouterModels("")).toBe(false)
	})

	it("getOpenRouterDefaultModelId returns mocked default model id", async () => {
		const { getOpenRouterDefaultModelId } = await import("./openrouter-models")
		expect(getOpenRouterDefaultModelId()).toBe("anthropic/claude-sonnet-4-20250514")
	})

	it("fetchOpenRouterModels returns sorted model ids on success", async () => {
		const { fetch } = await import("@/shared/net")
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({
				data: [
					{ id: "zeta/model", name: "Zeta" },
					{ id: "alpha/model", name: "Alpha" },
				],
			}),
		} as Response)

		const { fetchOpenRouterModels } = await import("./openrouter-models")
		await expect(fetchOpenRouterModels()).resolves.toEqual(["alpha/model", "zeta/model"])
	})

	it("fetchOpenRouterModels returns empty array on failed fetch", async () => {
		const { fetch } = await import("@/shared/net")
		vi.mocked(fetch).mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({}),
		} as Response)

		const { fetchOpenRouterModels } = await import("./openrouter-models")
		await expect(fetchOpenRouterModels()).resolves.toEqual([])
	})

	it("fetchOpenRouterModels uses cache on second call", async () => {
		const { fetch } = await import("@/shared/net")
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({
				data: [
					{ id: "beta/model", name: "Beta" },
					{ id: "alpha/model", name: "Alpha" },
				],
			}),
		} as Response)

		const { fetchOpenRouterModels } = await import("./openrouter-models")
		const first = await fetchOpenRouterModels()
		const second = await fetchOpenRouterModels()

		expect(first).toEqual(["alpha/model", "beta/model"])
		expect(second).toEqual(["alpha/model", "beta/model"])
		expect(fetch).toHaveBeenCalledTimes(1)
	})

	it("fetchOpenRouterModels handles missing data property", async () => {
		const { fetch } = await import("@/shared/net")
		vi.mocked(fetch).mockResolvedValue({
			ok: true,
			json: async () => ({}),
		} as Response)

		const { fetchOpenRouterModels } = await import("./openrouter-models")
		await expect(fetchOpenRouterModels()).resolves.toEqual([])
	})
})
