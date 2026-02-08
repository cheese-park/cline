import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const getStatsMock = vi.fn()
const getWallTimeMsMock = vi.fn()
const getAgentActiveTimeMsMock = vi.fn()
const getStartTimeMock = vi.fn()
const getEndTimeMock = vi.fn()
const formatTimeMock = vi.fn()
const getSuccessRateMock = vi.fn()

vi.mock("@/shared/services/Session", () => ({
	Session: {
		get: () => ({
			getStats: getStatsMock,
			getWallTimeMs: getWallTimeMsMock,
			getAgentActiveTimeMs: getAgentActiveTimeMsMock,
			getStartTime: getStartTimeMock,
			getEndTime: getEndTimeMock,
			formatTime: formatTimeMock,
			getSuccessRate: getSuccessRateMock,
		}),
	},
}))

import { printSessionSummary } from "./session-summary"

describe("printSessionSummary", () => {
	let writeSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

		getStatsMock.mockReturnValue({
			sessionId: "session-123",
			totalToolCalls: 10,
			successfulToolCalls: 8,
			failedToolCalls: 2,
			apiTimeMs: 2000,
			toolTimeMs: 3000,
			peakMemoryBytes: 2 * 1024 * 1024,
			resources: {
				rss: 1024,
				heapUsed: 2048,
				heapTotal: 4096,
				userCpuMs: 500,
				systemCpuMs: 250,
			},
		})
		getWallTimeMsMock.mockReturnValue(5000)
		getAgentActiveTimeMsMock.mockReturnValue(4000)
		getStartTimeMock.mockReturnValue(111)
		getEndTimeMock.mockReturnValue(222)
		formatTimeMock.mockImplementation((value: number) => `t-${value}`)
		getSuccessRateMock.mockReturnValue(80)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should not print when session is less than 1 second", () => {
		getWallTimeMsMock.mockReturnValue(500)
		printSessionSummary()
		expect(writeSpy).not.toHaveBeenCalled()
	})

	it("skips printing if wall time is less than one second (999ms)", () => {
		getWallTimeMsMock.mockReturnValue(999)
		printSessionSummary()
		expect(writeSpy).not.toHaveBeenCalled()
	})

	it("prints summary output to stdout", () => {
		printSessionSummary()
		expect(writeSpy).toHaveBeenCalledTimes(1)
		const output = String(writeSpy.mock.calls[0][0])
		expect(output).toContain("Interaction Summary")
		expect(output).toContain("session-123")
	})

	it("should include session ID", () => {
		getStatsMock.mockReturnValue({
			...getStatsMock.mock.results[0]?.value,
			sessionId: "my-session-id",
		})
		printSessionSummary()
		const output = writeSpy.mock.calls.map((c) => c[0]).join("")
		expect(output).toContain("my-session-id")
	})

	it("should include Interaction Summary header", () => {
		printSessionSummary()
		const output = writeSpy.mock.calls.map((c) => c[0]).join("")
		expect(output).toContain("Interaction Summary")
	})

	it("should include tool call stats", () => {
		getStatsMock.mockReturnValue({
			...getStatsMock.mock.results[0]?.value,
			totalToolCalls: 15,
			successfulToolCalls: 12,
			failedToolCalls: 3,
		})
		printSessionSummary()
		const output = writeSpy.mock.calls.map((c) => c[0]).join("")
		expect(output).toContain("15")
	})

	it("includes formatted session time and success information", () => {
		printSessionSummary()
		const output = String(writeSpy.mock.calls[0][0])
		expect(output).toContain("t-111 → t-222")
		expect(output).toContain("Tool Calls:")
		expect(output).toContain("10")
		expect(output).toContain("80.0%")
	})

	it("should include Performance section", () => {
		printSessionSummary()
		const output = writeSpy.mock.calls.map((c) => c[0]).join("")
		expect(output).toContain("Performance")
	})

	it("should include Resources section", () => {
		printSessionSummary()
		const output = writeSpy.mock.calls.map((c) => c[0]).join("")
		expect(output).toContain("Resources")
	})

	it("should include success rate", () => {
		printSessionSummary()
		const output = writeSpy.mock.calls.map((c) => c[0]).join("")
		expect(output).toContain("80.0%")
	})

	it("shows human-readable duration and bytes", () => {
		printSessionSummary()
		const output = String(writeSpy.mock.calls[0][0])
		expect(output).toContain("5.0s")
		expect(output).toContain("4.0s")
		expect(output).toContain("1.0KB")
		expect(output).toContain("2.0MB")
	})

	it("handles zero totals in percentage fields", () => {
		getAgentActiveTimeMsMock.mockReturnValue(0)
		getStatsMock.mockReturnValue({
			...getStatsMock.mock.results[0]?.value,
			sessionId: "session-0",
			totalToolCalls: 0,
			successfulToolCalls: 0,
			failedToolCalls: 0,
			apiTimeMs: 0,
			toolTimeMs: 0,
			peakMemoryBytes: 0,
			resources: {
				rss: 0,
				heapUsed: 0,
				heapTotal: 0,
				userCpuMs: 0,
				systemCpuMs: 0,
			},
		})

		printSessionSummary()

		const output = String(writeSpy.mock.calls[0][0])
		expect(output).toContain("(0.0%)")
	})
})
