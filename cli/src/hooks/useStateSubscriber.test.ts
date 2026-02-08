import { render } from "ink-testing-library"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

let mockState: { clineMessages?: Array<any> } = { clineMessages: [] }

vi.mock("../context/TaskContext", () => ({
	useTaskContext: () => ({ state: mockState }),
}))

import {
	useCompletedAskMessages,
	useCompletionSignals,
	useIsSpinnerActive,
	useLastCompletedAskMessage,
	useProcessedMessages,
} from "./useStateSubscriber"

function runHook<T>(useHook: () => T): T {
	let result: T | undefined
	const Probe = () => {
		result = useHook()
		return null
	}
	const app = render(React.createElement(Probe))
	app.unmount()
	if (result === undefined) throw new Error("Hook did not return")
	return result
}

describe("useStateSubscriber hooks", () => {
	afterEach(() => {
		mockState = { clineMessages: [] }
	})

	it("useProcessedMessages returns mutable processed sets", () => {
		const processed = runHook(() => useProcessedMessages())
		expect(processed.processedAskMessages.size).toBe(0)
		processed.processedAskMessages.add(1)
		expect(processed.processedAskMessages.has(1)).toBe(true)
	})

	it("useCompletedAskMessages returns only unprocessed completed asks", () => {
		mockState = {
			clineMessages: [
				{ type: "ask", partial: false, ask: "followup" },
				{ type: "ask", partial: true, ask: "followup" },
				{ type: "say", partial: false, say: "text" },
			],
		}
		const getCompleted = runHook(() => useCompletedAskMessages())
		expect(getCompleted().length).toBe(1)
		expect(getCompleted().length).toBe(0)
	})

	it("useLastCompletedAskMessage returns the latest complete ask", () => {
		mockState = {
			clineMessages: [
				{ type: "ask", partial: false, ask: "a" },
				{ type: "ask", partial: true, ask: "b" },
				{ type: "ask", partial: false, ask: "c" },
			],
		}
		const message = runHook(() => useLastCompletedAskMessage())
		expect(message?.ask).toBe("c")
	})

	it("useCompletionSignals detects completion and errors", () => {
		mockState = { clineMessages: [{ say: "completion_result", type: "say", partial: false }] }
		const signals = runHook(() => useCompletionSignals())
		expect(signals.isTaskComplete()).toBe(true)
		expect(signals.getCompletionMessage()?.say).toBe("completion_result")

		mockState = { clineMessages: [{ ask: "api_req_failed", type: "ask", partial: false }] }
		const errorSignals = runHook(() => useCompletionSignals())
		expect(errorSignals.isTaskComplete()).toBe(true)
	})

	it("useIsSpinnerActive tracks api_req_started without finish", () => {
		mockState = {
			clineMessages: [
				{ say: "api_req_started", ts: 123, type: "say", partial: false },
				{ say: "text", type: "say", partial: false },
			],
		}
		const spinner = runHook(() => useIsSpinnerActive())
		expect(spinner.isActive).toBe(true)
		expect(spinner.startTime).toBe(123)

		mockState = {
			clineMessages: [
				{ say: "api_req_started", ts: 1, type: "say", partial: false },
				{ say: "api_req_finished", ts: 2, type: "say", partial: false },
			],
		}
		const doneSpinner = runHook(() => useIsSpinnerActive())
		expect(doneSpinner.isActive).toBe(false)
	})
})
