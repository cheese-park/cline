import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { waitFor } from "./timeout"

describe("timeout", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	describe("waitFor", () => {
		it("should return immediately if condition is already truthy", async () => {
			const result = await waitFor(() => "ready", 1000)
			expect(result).toBe("ready")
		})

		it("returns immediately when condition is already truthy and checks call count", async () => {
			const condition = vi.fn(() => "ready")

			await expect(waitFor(condition, 1000, 50)).resolves.toBe("ready")
			expect(condition).toHaveBeenCalledTimes(1)
			expect(vi.getTimerCount()).toBe(0)
		})

		it("should return value when condition becomes truthy", async () => {
			let value: string | undefined
			setTimeout(() => {
				value = "done"
			}, 200)

			const promise = waitFor(() => value, 1000, 50)
			vi.advanceTimersByTime(300)
			const result = await promise
			expect(result).toBe("done")
		})

		it("polls until condition becomes truthy", async () => {
			let ready = false
			const condition = vi.fn(() => (ready ? "done" : undefined))
			const promise = waitFor(condition, 1000, 100)

			setTimeout(() => {
				ready = true
			}, 250)

			await vi.advanceTimersByTimeAsync(300)

			await expect(promise).resolves.toBe("done")
			expect(condition).toHaveBeenCalledTimes(4)
		})

		it("should return undefined on timeout", async () => {
			const promise = waitFor(() => undefined, 500, 50)
			vi.advanceTimersByTime(600)
			const result = await promise
			expect(result).toBeUndefined()
		})

		it("returns undefined when timeout is reached and checks call count", async () => {
			const condition = vi.fn(() => undefined)
			const promise = waitFor(condition, 500, 100)

			await vi.advanceTimersByTimeAsync(500)

			await expect(promise).resolves.toBeUndefined()
			expect(condition).toHaveBeenCalledTimes(6)
		})

		it("should check condition at poll interval", async () => {
			const conditionFn = vi.fn().mockReturnValue(undefined)

			const promise = waitFor(conditionFn, 1000, 100)

			vi.advanceTimersByTime(350)

			// Condition should be called: 1 (immediate) + 3 (at 100, 200, 300) = 4 times
			expect(conditionFn.mock.calls.length).toBeGreaterThanOrEqual(4)

			// Resolve by making it truthy
			conditionFn.mockReturnValue("found")
			vi.advanceTimersByTime(100)
			await promise
		})

		it("should handle null condition as falsy", async () => {
			let value: string | null = null
			setTimeout(() => {
				value = "ready"
			}, 200)

			const promise = waitFor(() => value, 1000, 50)
			vi.advanceTimersByTime(300)
			const result = await promise
			expect(result).toBe("ready")
		})

		it("should use default poll interval of 100ms", async () => {
			const conditionFn = vi.fn().mockReturnValue(undefined)

			const promise = waitFor(conditionFn, 500)

			vi.advanceTimersByTime(250)

			// immediate check + checks at 100, 200 = 3 calls minimum
			expect(conditionFn.mock.calls.length).toBeGreaterThanOrEqual(3)

			// Clean up
			vi.advanceTimersByTime(500)
			await promise
		})

		it("uses default poll interval when not provided and checks call count", async () => {
			const condition = vi.fn(() => undefined)
			const promise = waitFor(condition, 250)

			await vi.advanceTimersByTimeAsync(250)

			await expect(promise).resolves.toBeUndefined()
			expect(condition).toHaveBeenCalledTimes(3)
		})

		it("should return non-string truthy values", async () => {
			const result = await waitFor(() => 42, 1000)
			expect(result).toBe(42)
		})

		it("should return object when truthy", async () => {
			const obj = { status: "ok" }
			const result = await waitFor(() => obj, 1000)
			expect(result).toBe(obj)
		})

		it("should treat 0 as falsy and wait", async () => {
			let value: number | undefined = 0 as any
			setTimeout(() => {
				value = 1
			}, 200)

			const promise = waitFor(() => value, 1000, 50)
			vi.advanceTimersByTime(300)
			const result = await promise
			expect(result).toBe(1)
		})

		it("clears timers when condition succeeds before timeout", async () => {
			let calls = 0
			const condition = vi.fn(() => {
				calls += 1
				return calls >= 3 ? "ok" : undefined
			})

			const promise = waitFor(condition, 1000, 100)
			await vi.advanceTimersByTimeAsync(200)

			await expect(promise).resolves.toBe("ok")
			expect(vi.getTimerCount()).toBe(0)
		})
	})
})
