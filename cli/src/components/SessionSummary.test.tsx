import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockSession } = vi.hoisted(() => ({
	mockSession: {
		getStats: vi.fn(),
		getWallTimeMs: vi.fn(),
		getAgentActiveTimeMs: vi.fn(),
		formatTime: vi.fn((value: number) => `t-${value}`),
		getStartTime: vi.fn(() => 1000),
		getEndTime: vi.fn(() => 90000),
	},
}))

vi.mock("@/shared/services/Session", () => ({
	Session: {
		get: () => mockSession,
	},
}))

import { SessionSummary } from "./SessionSummary"

describe("SessionSummary", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockSession.getStats.mockReturnValue({
			sessionId: "ses_123",
			totalToolCalls: 12,
			apiTimeMs: 12000,
			toolTimeMs: 3000,
			peakMemoryBytes: 1024 * 1024 * 128,
			resources: {
				rss: 1024 * 1024 * 64,
				heapUsed: 1024 * 1024 * 20,
				heapTotal: 1024 * 1024 * 40,
				userCpuMs: 850,
				systemCpuMs: 150,
			},
		})
		mockSession.getWallTimeMs.mockReturnValue(62000)
		mockSession.getAgentActiveTimeMs.mockReturnValue(30000)
	})

	it("renders summary sections and session metadata", () => {
		const { lastFrame } = render(<SessionSummary />)

		expect(lastFrame()).toContain("Interaction Summary")
		expect(lastFrame()).toContain("ses_123")
		expect(lastFrame()).toContain("Tool Calls:")
		expect(lastFrame()).toContain("12")
	})

	it("renders performance and resource values", () => {
		const { lastFrame } = render(<SessionSummary />)

		expect(lastFrame()).toContain("Wall Time:")
		expect(lastFrame()).toContain("1m 2s")
		expect(lastFrame()).toContain("Resources")
		expect(lastFrame()).toContain("64.0MB")
	})

	it("does not render for very short sessions", () => {
		mockSession.getWallTimeMs.mockReturnValueOnce(500)
		const { lastFrame } = render(<SessionSummary />)

		expect(lastFrame()).toBe("")
	})

	it("accepts width prop and still renders", () => {
		const { lastFrame } = render(<SessionSummary width={70} />)

		expect(lastFrame()).toContain("Performance")
	})
})
