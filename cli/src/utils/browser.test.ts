import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const openMock = vi.fn()

vi.mock("open", () => ({
	default: openMock,
}))

import { openUrlInBrowser } from "./browser"

describe("browser", () => {
	beforeEach(() => {
		openMock.mockReset()
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("openUrlInBrowser", () => {
		it("calls open with the provided URL", async () => {
			openMock.mockResolvedValue(undefined)

			await openUrlInBrowser("https://example.com")

			expect(openMock).toHaveBeenCalledWith("https://example.com")
		})

		it("returns after open resolves", async () => {
			openMock.mockResolvedValue(undefined)

			await expect(openUrlInBrowser("https://cline.bot")).resolves.toBeUndefined()
		})

		it("propagates errors from open", async () => {
			openMock.mockRejectedValue(new Error("failed to open"))

			await expect(openUrlInBrowser("https://bad.example")).rejects.toThrow("failed to open")
		})

		it("supports non-http URLs", async () => {
			openMock.mockResolvedValue(undefined)

			await openUrlInBrowser("file:///tmp/report.txt")

			expect(openMock).toHaveBeenCalledWith("file:///tmp/report.txt")
		})

		it("can be called multiple times", async () => {
			openMock.mockResolvedValue(undefined)

			await openUrlInBrowser("https://one.example")
			await openUrlInBrowser("https://two.example")

			expect(openMock).toHaveBeenNthCalledWith(1, "https://one.example")
			expect(openMock).toHaveBeenNthCalledWith(2, "https://two.example")
		})
	})
})
