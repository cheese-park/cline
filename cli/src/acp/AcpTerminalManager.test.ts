import { beforeEach, describe, expect, it, vi } from "vitest"
import { AcpTerminalManager } from "./AcpTerminalManager"

vi.mock("@/shared/services/Logger", () => ({ Logger: { debug: vi.fn() } }))

describe("AcpTerminalManager", () => {
	const makeHandle = (id: string) => ({
		id,
		currentOutput: vi.fn(async () => ({ output: "line1\nline2", truncated: false })),
		waitForExit: vi.fn(async () => ({ exitCode: 0 })),
		kill: vi.fn(async () => undefined),
		release: vi.fn(async () => undefined),
	})

	let connection: { createTerminal: ReturnType<typeof vi.fn> }

	beforeEach(() => {
		connection = {
			createTerminal: vi.fn(async () => makeHandle("terminal-1")),
		}
	})

	it("processOutput keeps output when under limit", () => {
		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => "session-1")
		const output = manager.processOutput(["a", "b", "c"], 10)
		expect(output).toBe("a\nb\nc")
	})

	it("processOutput truncates long output", () => {
		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => "session-1")
		manager.setTerminalOutputLineLimit(4)
		const output = manager.processOutput(["1", "2", "3", "4", "5", "6"])
		expect(output).toContain("... (output truncated) ...")
		expect(output).toContain("1")
		expect(output).toContain("6")
	})

	it("createTerminal returns capability error when terminal unsupported", async () => {
		const manager = new AcpTerminalManager(connection as any, { terminal: false }, () => "session-1")
		const result = await manager.createTerminal({ command: "echo", args: ["hello"] })
		expect("error" in result && result.error).toContain("does not support terminal capability")
	})

	it("createTerminal creates and tracks terminal", async () => {
		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => "session-1")
		const result = await manager.createTerminal({ command: "echo", args: ["hello"], cwd: "/tmp/project" })

		expect("error" in result).toBe(false)
		if ("error" in result) {
			throw new Error("unexpected error")
		}

		expect(result.id).toBe("terminal-1")
		expect(manager.getActiveTerminalCount()).toBe(1)
		expect(connection.createTerminal).toHaveBeenCalledWith(
			expect.objectContaining({ sessionId: "session-1", command: "echo", args: ["hello"], cwd: "/tmp/project" }),
		)
	})

	it("getOrCreateTerminal reuses terminal for same cwd", async () => {
		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => "session-1")
		const t1 = await manager.getOrCreateTerminal("/repo")
		const t2 = await manager.getOrCreateTerminal("/repo")
		expect(t1.id).toBe(t2.id)
	})

	it("createTerminal returns error when session id is unavailable", async () => {
		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => undefined)
		const result = await manager.createTerminal({ command: "echo" })

		expect("error" in result).toBe(true)
		if ("error" in result) {
			expect(result.error).toContain("Session ID is undefined")
		}
	})

	it("getOutput returns not found error for unknown terminal", async () => {
		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => "session-1")
		const result = await manager.getOutput("missing-terminal")

		expect(result.success).toBe(false)
		expect(result.error).toContain("Terminal not found")
	})

	it("waitForExit returns error when handle throws", async () => {
		connection.createTerminal.mockImplementationOnce(async () => ({
			id: "terminal-throw",
			currentOutput: vi.fn(async () => ({ output: "", truncated: false })),
			waitForExit: vi.fn(async () => {
				throw new Error("wait failed")
			}),
			kill: vi.fn(async () => undefined),
			release: vi.fn(async () => undefined),
		}))

		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => "session-1")
		const terminal = await manager.createTerminal({ command: "echo" })
		if ("error" in terminal) {
			throw new Error("unexpected createTerminal error")
		}

		const result = await manager.waitForExit(terminal.id)
		expect(result.success).toBe(false)
		expect(result.error).toBe("wait failed")
	})

	it("release returns success when terminal was already released", async () => {
		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => "session-1")
		const terminal = await manager.createTerminal({ command: "echo" })
		if ("error" in terminal) {
			throw new Error("unexpected createTerminal error")
		}

		const firstRelease = await manager.release(terminal.id)
		expect(firstRelease.success).toBe(true)

		const secondRelease = await manager.release(terminal.id)
		expect(secondRelease.success).toBe(true)
	})

	it("executeCommand returns wait error and still releases terminal", async () => {
		const release = vi.fn(async () => undefined)
		connection.createTerminal.mockImplementationOnce(async () => ({
			id: "terminal-execute",
			currentOutput: vi.fn(async () => ({ output: "ignored", truncated: false })),
			waitForExit: vi.fn(async () => {
				throw new Error("boom")
			}),
			kill: vi.fn(async () => undefined),
			release,
		}))

		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => "session-1")
		const result = await manager.executeCommand({ command: "echo" })

		expect(result.success).toBe(false)
		expect(result.error).toBe("boom")
		expect(release).toHaveBeenCalledTimes(1)
	})

	it("disables terminal reuse when configured", async () => {
		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => "session-1")
		manager.setTerminalReuseEnabled(false)

		const t1 = await manager.getOrCreateTerminal("/repo")
		const t2 = await manager.getOrCreateTerminal("/other")

		expect(t1.id).not.toBe(t2.id)
	})

	it("disposeAll clears tracked terminal state", async () => {
		const manager = new AcpTerminalManager(connection as any, { terminal: true }, () => "session-1")
		const terminal = await manager.createTerminal({ command: "echo" })
		if ("error" in terminal) {
			throw new Error("unexpected createTerminal error")
		}

		expect(manager.getActiveTerminalCount()).toBe(1)
		manager.disposeAll()
		expect(manager.getActiveTerminalCount()).toBe(0)
		expect(manager.getTerminal(terminal.id)).toBeUndefined()
	})
})
