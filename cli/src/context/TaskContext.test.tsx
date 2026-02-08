import { Text } from "ink"
import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { registerPartialMessageCallbackMock, convertProtoToClineMessageMock } = vi.hoisted(() => ({
	registerPartialMessageCallbackMock: vi.fn(),
	convertProtoToClineMessageMock: vi.fn((message: any) => message),
}))

vi.mock("@core/controller/ui/subscribeToPartialMessage", () => ({
	registerPartialMessageCallback: registerPartialMessageCallbackMock,
}))

vi.mock("@shared/proto-conversions/cline-message", () => ({
	convertProtoToClineMessage: convertProtoToClineMessageMock,
}))

import { TaskContextProvider, useTaskState } from "./TaskContext"

describe("TaskContext", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		registerPartialMessageCallbackMock.mockImplementation(() => () => undefined)
		convertProtoToClineMessageMock.mockImplementation((message: unknown) => message)
	})

	it("TaskContextProvider renders children", async () => {
		const controller = {
			postStateToWebview: vi.fn(async () => undefined),
			getStateToPostToWebview: vi.fn(async () => ({ clineMessages: [{ ts: 1 }], currentTaskItem: null })),
		}

		const Consumer = () => {
			const state = useTaskState()
			return <Text>{`messages=${state.clineMessages?.length ?? 0}`}</Text>
		}

		const { lastFrame } = render(
			<TaskContextProvider controller={controller}>
				<Consumer />
			</TaskContextProvider>,
		)

		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(lastFrame()).toContain("messages=1")
	})

	it("partial callback updates matching message", async () => {
		let callback: ((message: any) => void) | undefined
		registerPartialMessageCallbackMock.mockImplementation((cb: (message: any) => void) => {
			callback = cb
			return () => undefined
		})
		convertProtoToClineMessageMock.mockImplementation(() => ({ ts: 100, text: "new" }))

		const controller = {
			postStateToWebview: vi.fn(async () => undefined),
			getStateToPostToWebview: vi.fn(async () => ({ clineMessages: [{ ts: 100, text: "old" }], currentTaskItem: null })),
		}

		const Consumer = () => {
			const state = useTaskState()
			return <Text>{(state.clineMessages?.[0] as any)?.text ?? "none"}</Text>
		}

		const { lastFrame } = render(
			<TaskContextProvider controller={controller}>
				<Consumer />
			</TaskContextProvider>,
		)

		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(lastFrame()).toContain("old")

		callback?.({ ts: 100, text: "proto" })
		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(lastFrame()).toContain("new")
	})

	it("clearState resets values", async () => {
		registerPartialMessageCallbackMock.mockImplementation(() => () => undefined)
		const controller = {
			postStateToWebview: vi.fn(async () => undefined),
			getStateToPostToWebview: vi.fn(async () => ({ clineMessages: [{ ts: 1 }], currentTaskItem: { id: "t1" } })),
		}

		const Consumer = () => {
			const state = useTaskState()
			return <Text>{`messages=${state.clineMessages?.length ?? 0}`}</Text>
		}

		const { lastFrame } = render(
			<TaskContextProvider controller={controller}>
				<Consumer />
			</TaskContextProvider>,
		)

		await new Promise((resolve) => setTimeout(resolve, 0))
		expect(lastFrame()).toContain("messages=1")
	})
})
