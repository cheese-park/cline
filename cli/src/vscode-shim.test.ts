import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/shared/storage", () => ({
	ClineFileStorage: class {},
}))

vi.mock("vscode-uri", () => ({
	URI: {
		file: (value: string) => ({ fsPath: value, path: value, toString: () => value }),
	},
}))

vi.mock("./utils/display", () => ({
	printError: vi.fn(),
	printInfo: vi.fn(),
	printWarning: vi.fn(),
}))

vi.mock("./utils/path", () => ({
	CLINE_CLI_DIR: {
		log: "/tmp/cline/logs",
	},
}))

vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
}))

import { existsSync, readFileSync } from "node:fs"
import {
	DiagnosticSeverity,
	Disposable,
	EndOfLine,
	EnvironmentVariableCollection,
	EventEmitter,
	ExtensionKind,
	ExtensionMode,
	Position,
	Range,
	readJson,
	Selection,
	window,
	workspace,
} from "./vscode-shim"

describe("vscode-shim", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("readJson reads valid JSON file", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue('{"ok":true,"count":3}' as any)

		const result = readJson<{ ok: boolean; count: number }>("/tmp/test.json")

		expect(result).toEqual({ ok: true, count: 3 })
	})

	it("readJson returns default on missing file", () => {
		vi.mocked(existsSync).mockReturnValue(false)

		const fallback = { fallback: true }
		const result = readJson("/tmp/missing.json", fallback)

		expect(result).toBe(fallback)
	})

	it("readJson returns default on invalid JSON", () => {
		vi.mocked(existsSync).mockReturnValue(true)
		vi.mocked(readFileSync).mockReturnValue("{not-json" as any)

		const fallback = { fallback: true }
		const result = readJson("/tmp/invalid.json", fallback)

		expect(result).toBe(fallback)
	})

	it("EnvironmentVariableCollection get/append/replace/delete/clear", () => {
		const env = new EnvironmentVariableCollection()

		env.append("PATH", ":/a")
		expect(env.get("PATH")).toEqual({ value: ":/a", type: "append" })

		env.replace("PATH", "/b")
		expect(env.get("PATH")).toEqual({ value: "/b", type: "replace" })

		expect(env.delete("PATH")).toBe(true)
		expect(env.get("PATH")).toBeUndefined()

		env.append("A", "1")
		env.append("B", "2")
		env.clear()
		expect(Array.from(env.entries())).toEqual([])
	})

	it("Position constructor and properties", () => {
		const pos = new Position(3, 7)
		expect(pos.line).toBe(3)
		expect(pos.character).toBe(7)
		expect(pos.translate(1, -2)).toEqual(new Position(4, 5))
		expect(pos.with(undefined, 1)).toEqual(new Position(3, 1))
	})

	it("Range constructor with numbers", () => {
		const range = new Range(1, 2, 3, 4)
		expect(range.start).toEqual(new Position(1, 2))
		expect(range.end).toEqual(new Position(3, 4))
	})

	it("Range constructor with Position objects", () => {
		const start = new Position(1, 0)
		const end = new Position(1, 5)
		const range = new Range(start, end)
		expect(range.start).toBe(start)
		expect(range.end).toBe(end)
		expect(range.isSingleLine).toBe(true)
	})

	it("Selection extends Range", () => {
		const selection = new Selection(3, 2, 1, 1)
		expect(selection).toBeInstanceOf(Range)
		expect(selection.anchor).toEqual(new Position(3, 2))
		expect(selection.active).toEqual(new Position(1, 1))
		expect(selection.isReversed).toBe(true)
	})

	it("EventEmitter fire/event/dispose", () => {
		const emitter = new EventEmitter<number>()
		const values: number[] = []
		const sub = emitter.event((value) => values.push(value))

		emitter.fire(1)
		emitter.fire(2)
		expect(values).toEqual([1, 2])

		sub.dispose()
		emitter.fire(3)
		expect(values).toEqual([1, 2])

		emitter.event((value) => values.push(value * 10))
		emitter.dispose()
		emitter.fire(4)
		expect(values).toEqual([1, 2])
	})

	it("Disposable.from disposes all children", () => {
		const disposeA = vi.fn()
		const disposeB = vi.fn()

		const combined = Disposable.from({ dispose: disposeA }, { dispose: disposeB })
		combined.dispose()

		expect(disposeA).toHaveBeenCalledTimes(1)
		expect(disposeB).toHaveBeenCalledTimes(1)
	})

	it("DiagnosticSeverity enum values", () => {
		expect(DiagnosticSeverity.Error).toBe(0)
		expect(DiagnosticSeverity.Warning).toBe(1)
		expect(DiagnosticSeverity.Information).toBe(2)
		expect(DiagnosticSeverity.Hint).toBe(3)
	})

	it("ExtensionMode enum values", () => {
		expect(ExtensionMode.Production).toBe(1)
		expect(ExtensionMode.Development).toBe(2)
		expect(ExtensionMode.Test).toBe(3)
	})

	it("ExtensionKind enum values", () => {
		expect(ExtensionKind.UI).toBe(1)
		expect(ExtensionKind.Workspace).toBe(2)
	})

	it("EndOfLine enum values", () => {
		expect(EndOfLine.LF).toBe(1)
		expect(EndOfLine.CRLF).toBe(2)
	})

	it("workspace.workspaceFolders default is undefined", () => {
		expect(workspace.workspaceFolders).toBeUndefined()
	})

	it("window.showInformationMessage resolves", async () => {
		await expect(window.showInformationMessage("hello")).resolves.toBeUndefined()
	})
})
