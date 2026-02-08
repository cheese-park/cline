import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { subscribeToStateMock, showTaskWithIdMock, cancelRequestMock, createStringRequestMock } = vi.hoisted(() => ({
	subscribeToStateMock: vi.fn(),
	showTaskWithIdMock: vi.fn(async () => undefined),
	cancelRequestMock: vi.fn(),
	createStringRequestMock: vi.fn((value: { value: string }) => value),
}))

vi.mock("@/core/controller/grpc-handler", () => ({
	getRequestRegistry: () => ({
		cancelRequest: cancelRequestMock,
	}),
}))

vi.mock("@/core/controller/state/subscribeToState", () => ({
	subscribeToState: subscribeToStateMock,
}))

vi.mock("@/core/controller/task/showTaskWithId", () => ({
	showTaskWithId: showTaskWithIdMock,
}))

vi.mock("@shared/proto/cline/common", () => ({
	StringRequest: {
		create: createStringRequestMock,
	},
}))

import { runPlainTextTask } from "./plain-text-task"

function makeState(messages: any[]) {
	return JSON.stringify({ clineMessages: messages })
}

describe("runPlainTextTask", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		subscribeToStateMock.mockImplementation((_controller: any, _request: any, callback: any) => {
			const ts = Date.now() + 1000
			callback({
				stateJson: JSON.stringify({
					clineMessages: [{ ts, type: "say", say: "completion_result", text: "done" }],
				}),
			})
		})
	})

	afterEach(() => {
		vi.restoreAllMocks()
		vi.useRealTimers()
	})

	describe("new task", () => {
		it("starts a new task when prompt is provided", async () => {
			const controller = {
				initTask: vi.fn(async () => undefined),
			} as any
			const outSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true)

			await expect(runPlainTextTask({ controller, prompt: "do work" })).resolves.toBe(true)

			expect(controller.initTask).toHaveBeenCalledWith("do work", undefined)
			expect(outSpy).toHaveBeenCalledWith("done\n")
			expect(cancelRequestMock).toHaveBeenCalledWith("cline-cli-plain-text-task")
		})

		it("should call initTask with prompt", async () => {
			subscribeToStateMock.mockImplementation((_ctrl: any, _opts: any, callback: any) => {
				setTimeout(async () => {
					await callback({
						stateJson: makeState([{ ts: Date.now() + 100, type: "say", say: "completion_result", text: "Done" }]),
					})
				}, 10)
			})

			const mockController = {
				initTask: vi.fn(),
				task: { handleWebviewAskResponse: vi.fn() },
			} as any
			vi.spyOn(process.stdout, "write").mockReturnValue(true)

			const result = await runPlainTextTask({
				controller: mockController,
				prompt: "test prompt",
				timeoutSeconds: 1,
			})

			expect(mockController.initTask).toHaveBeenCalledWith("test prompt", undefined)
			expect(result).toBe(true)
		})
	})

	describe("missing arguments", () => {
		it("returns false when neither taskId nor prompt is provided", async () => {
			const controller = {
				initTask: vi.fn(),
			} as any
			const errSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true)

			await expect(runPlainTextTask({ controller, verbose: true })).resolves.toBe(false)

			expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("Either taskId or prompt must be provided"))
			expect(cancelRequestMock).toHaveBeenCalledWith("cline-cli-plain-text-task")
		})

		it("should write error to stderr when no taskId and no prompt", async () => {
			subscribeToStateMock.mockImplementation(() => {})
			const mockController = {
				initTask: vi.fn(),
				task: { handleWebviewAskResponse: vi.fn() },
			} as any
			const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

			const result = await runPlainTextTask({
				controller: mockController,
				timeoutSeconds: 1,
			})

			expect(result).toBe(false)
			const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join("")
			expect(stderrOutput).toContain("Either taskId or prompt must be provided")
		})
	})

	describe("resume task", () => {
		it("handles view-task-only mode without requiring prompt", async () => {
			const controller = {
				task: {},
				initTask: vi.fn(),
			} as any
			vi.spyOn(process.stdout, "write").mockReturnValue(true)

			await expect(runPlainTextTask({ controller, taskId: "task-123" })).resolves.toBe(true)

			expect(createStringRequestMock).toHaveBeenCalledWith({ value: "task-123" })
			expect(showTaskWithIdMock).toHaveBeenCalledTimes(1)
			expect(controller.initTask).not.toHaveBeenCalled()
		})

		it("should call showTaskWithId when taskId provided with prompt", async () => {
			subscribeToStateMock.mockImplementation((_ctrl: any, _opts: any, callback: any) => {
				setTimeout(async () => {
					await callback({
						stateJson: makeState([{ ts: Date.now() + 100, type: "say", say: "completion_result", text: "Done" }]),
					})
				}, 10)
			})

			const mockController = {
				initTask: vi.fn(),
				task: { handleWebviewAskResponse: vi.fn() },
			} as any
			vi.spyOn(process.stdout, "write").mockReturnValue(true)

			await runPlainTextTask({
				controller: mockController,
				taskId: "task-123",
				prompt: "continue",
				timeoutSeconds: 1,
			})

			expect(showTaskWithIdMock).toHaveBeenCalledWith(mockController, { value: "task-123" })
		})
	})

	describe("JSON output mode", () => {
		it("streams JSON messages when jsonOutput is enabled", async () => {
			subscribeToStateMock.mockImplementation((_controller: any, _request: any, callback: any) => {
				const ts = Date.now() + 1000
				callback({
					stateJson: JSON.stringify({
						clineMessages: [
							{ ts, type: "say", say: "text", text: "hello" },
							{ ts: ts + 1, type: "say", say: "completion_result", text: "done" },
						],
					}),
				})
			})
			const controller = {
				initTask: vi.fn(async () => undefined),
			} as any
			const outSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true)

			await expect(runPlainTextTask({ controller, prompt: "json", jsonOutput: true })).resolves.toBe(true)

			expect(outSpy).toHaveBeenCalledWith(expect.stringContaining('"say":"text"'))
			expect(outSpy).toHaveBeenCalledWith(expect.stringContaining('"say":"completion_result"'))
		})
	})

	describe("completion_result handling", () => {
		it("handles completion_result ask messages and writes final text", async () => {
			subscribeToStateMock.mockImplementation((_controller: any, _request: any, callback: any) => {
				const ts = Date.now() + 1000
				callback({
					stateJson: JSON.stringify({
						clineMessages: [
							{ ts, type: "say", say: "text", text: "partial response" },
							{ ts: ts + 1, type: "ask", ask: "completion_result", text: "final response" },
						],
					}),
				})
			})
			const controller = {
				initTask: vi.fn(async () => undefined),
			} as any
			const outSpy = vi.spyOn(process.stdout, "write").mockReturnValue(true)

			await expect(runPlainTextTask({ controller, prompt: "finish" })).resolves.toBe(true)

			expect(outSpy).toHaveBeenLastCalledWith("final response\n")
		})
	})

	describe("timeout", () => {
		it("returns false when timeout is reached", async () => {
			vi.useFakeTimers()
			subscribeToStateMock.mockImplementation(() => undefined)
			const controller = {
				initTask: vi.fn(async () => undefined),
			} as any
			const errSpy = vi.spyOn(process.stderr, "write").mockReturnValue(true)

			const promise = runPlainTextTask({ controller, prompt: "slow task", timeoutSeconds: 1, verbose: true })
			await vi.advanceTimersByTimeAsync(1000)

			await expect(promise).resolves.toBe(false)
			expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("Timeout"))
		})

		it("should timeout after specified seconds with real timers", async () => {
			subscribeToStateMock.mockImplementation(() => {})
			const mockController = {
				initTask: vi.fn(),
				task: { handleWebviewAskResponse: vi.fn() },
			} as any
			vi.spyOn(process.stderr, "write").mockImplementation(() => true)

			const result = await runPlainTextTask({
				controller: mockController,
				prompt: "test",
				timeoutSeconds: 0.1,
			})

			expect(result).toBe(false)
		})
	})

	describe("error handling", () => {
		it("should handle error messages", async () => {
			subscribeToStateMock.mockImplementation((_ctrl: any, _opts: any, callback: any) => {
				setTimeout(async () => {
					await callback({
						stateJson: makeState([{ ts: Date.now() + 100, type: "say", say: "error", text: "Something broke" }]),
					})
				}, 10)
			})

			const mockController = {
				initTask: vi.fn(),
				task: { handleWebviewAskResponse: vi.fn() },
			} as any
			vi.spyOn(process.stderr, "write").mockImplementation(() => true)

			const result = await runPlainTextTask({
				controller: mockController,
				prompt: "test",
				timeoutSeconds: 1,
			})

			expect(result).toBe(false)
		})

		it("should handle api_req_failed messages", async () => {
			subscribeToStateMock.mockImplementation((_ctrl: any, _opts: any, callback: any) => {
				setTimeout(async () => {
					await callback({
						stateJson: makeState([{ ts: Date.now() + 100, type: "ask", ask: "api_req_failed", text: "Rate limit" }]),
					})
				}, 10)
			})

			const mockController = {
				initTask: vi.fn(),
				task: { handleWebviewAskResponse: vi.fn() },
			} as any
			vi.spyOn(process.stderr, "write").mockImplementation(() => true)

			const result = await runPlainTextTask({
				controller: mockController,
				prompt: "test",
				timeoutSeconds: 1,
			})

			expect(result).toBe(false)
		})

		it("should skip partial messages", async () => {
			const ts = Date.now() + 100
			subscribeToStateMock.mockImplementation((_ctrl: any, _opts: any, callback: any) => {
				setTimeout(async () => {
					// First call with partial
					await callback({
						stateJson: makeState([{ ts, type: "say", say: "text", text: "partial...", partial: true }]),
					})
					// Second call completed + completion
					await callback({
						stateJson: makeState([
							{ ts, type: "say", say: "text", text: "full text" },
							{ ts: Date.now() + 200, type: "say", say: "completion_result", text: "Done" },
						]),
					})
				}, 10)
			})

			const mockController = {
				initTask: vi.fn(),
				task: { handleWebviewAskResponse: vi.fn() },
			} as any
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)

			const result = await runPlainTextTask({
				controller: mockController,
				prompt: "test",
				jsonOutput: true,
				timeoutSeconds: 1,
			})

			expect(result).toBe(true)
		})
	})

	describe("verbose mode", () => {
		it("should write verbose output to stderr", async () => {
			subscribeToStateMock.mockImplementation((_ctrl: any, _opts: any, callback: any) => {
				setTimeout(async () => {
					await callback({
						stateJson: makeState([
							{ ts: Date.now() + 100, type: "say", say: "text", text: "Thinking..." },
							{ ts: Date.now() + 200, type: "say", say: "api_req_started", text: "" },
							{ ts: Date.now() + 300, type: "say", say: "completion_result", text: "Done" },
						]),
					})
				}, 10)
			})

			const mockController = {
				initTask: vi.fn(),
				task: { handleWebviewAskResponse: vi.fn() },
			} as any
			vi.spyOn(process.stdout, "write").mockImplementation(() => true)
			const stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true)

			await runPlainTextTask({
				controller: mockController,
				prompt: "test",
				verbose: true,
				timeoutSeconds: 1,
			})

			const stderrOutput = stderrSpy.mock.calls.map((c) => c[0]).join("")
			expect(stderrOutput).toContain("Thinking...")
			expect(stderrOutput).toContain("API request started")
		})
	})
})
