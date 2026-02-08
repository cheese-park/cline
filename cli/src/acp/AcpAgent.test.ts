import { beforeEach, describe, expect, it, vi } from "vitest"

const {
	setPermissionHandlerMock,
	emitterForSessionMock,
	initializeMock,
	newSessionMock,
	promptMock,
	cancelMock,
	setSessionModeMock,
	setSessionModelMock,
	authenticateMock,
	shutdownMock,
	requestPermissionMock,
	sessionUpdateMock,
} = vi.hoisted(() => {
	const setPermissionHandlerMock = vi.fn()
	const initializeMock = vi.fn(async () => ({
		protocolVersion: "1.0",
		agentCapabilities: {},
		agentInfo: { name: "cline", version: "x" },
	}))
	const newSessionMock = vi.fn(async () => ({
		sessionId: "session-1",
		modes: { availableModes: [], currentModeId: "act" },
		models: { currentModelId: "", availableModels: [] },
	}))
	const promptMock = vi.fn(async () => ({ stopReason: "end_turn" }))
	const cancelMock = vi.fn(async () => undefined)
	const setSessionModeMock = vi.fn(async () => ({}))
	const setSessionModelMock = vi.fn(async () => ({}))
	const authenticateMock = vi.fn(async () => ({}))
	const shutdownMock = vi.fn(async () => undefined)
	const emitterHandlers = new Map<string, Function[]>()
	const emitterForSessionMock = vi.fn(() => ({
		on: vi.fn((event: string, cb: Function) => {
			const arr = emitterHandlers.get(event) || []
			arr.push(cb)
			emitterHandlers.set(event, arr)
		}),
	}))

	return {
		setPermissionHandlerMock,
		emitterForSessionMock,
		initializeMock,
		newSessionMock,
		promptMock,
		cancelMock,
		setSessionModeMock,
		setSessionModelMock,
		authenticateMock,
		shutdownMock,
		requestPermissionMock: vi.fn(async () => ({ outcome: "rejected" })),
		sessionUpdateMock: vi.fn(async () => undefined),
	}
})

vi.mock("@/shared/services/Logger.js", () => ({ Logger: { debug: vi.fn(), error: vi.fn() } }))

vi.mock("../agent/ClineAgent.js", () => ({
	ClineAgent: class {
		sessions = new Map()
		setPermissionHandler = setPermissionHandlerMock
		emitterForSession = emitterForSessionMock
		initialize = initializeMock
		newSession = newSessionMock
		prompt = promptMock
		cancel = cancelMock
		setSessionMode = setSessionModeMock
		unstable_setSessionModel = setSessionModelMock
		authenticate = authenticateMock
		shutdown = shutdownMock
	},
}))

import { AcpAgent } from "./AcpAgent"

describe("AcpAgent", () => {
	const connection = {
		requestPermission: requestPermissionMock,
		sessionUpdate: sessionUpdateMock,
	} as any

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("constructor creates wrapper and installs permission handler", () => {
		const agent = new AcpAgent(connection, { version: "1.0.0" })
		expect(agent).toBeInstanceOf(AcpAgent)
		expect(setPermissionHandlerMock).toHaveBeenCalledTimes(1)
	})

	it("initialize delegates to ClineAgent", async () => {
		const agent = new AcpAgent(connection, { version: "1.0.0" })
		const result = await agent.initialize({ clientCapabilities: {} } as any)
		expect(initializeMock).toHaveBeenCalledWith({ clientCapabilities: {} }, connection)
		expect(result.protocolVersion).toBe("1.0")
	})

	it("newSession delegates and subscribes to events", async () => {
		const agent = new AcpAgent(connection, { version: "1.0.0" })
		const result = await agent.newSession({ cwd: "/tmp/work" } as any)
		expect(newSessionMock).toHaveBeenCalledWith({ cwd: "/tmp/work" })
		expect(emitterForSessionMock).toHaveBeenCalledWith("session-1")
		expect(result.sessionId).toBe("session-1")
	})

	it("prompt delegates and ensures session subscription", async () => {
		const agent = new AcpAgent(connection, { version: "1.0.0" })
		const result = await agent.prompt({ sessionId: "s1", prompt: [] } as any)
		expect(emitterForSessionMock).toHaveBeenCalledWith("s1")
		expect(promptMock).toHaveBeenCalledWith({ sessionId: "s1", prompt: [] })
		expect(result.stopReason).toBe("end_turn")
	})

	it("shutdown clears state and delegates", async () => {
		const agent = new AcpAgent(connection, { version: "1.0.0" })
		await agent.shutdown()
		expect(shutdownMock).toHaveBeenCalledTimes(1)
	})
})
