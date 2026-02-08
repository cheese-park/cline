import * as path from "path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { existsSyncMock, readFileSyncMock, homedirMock } = vi.hoisted(() => ({
	existsSyncMock: vi.fn<(path: string) => boolean>(),
	readFileSyncMock: vi.fn<(path: string, encoding: string) => string>(),
	homedirMock: vi.fn<() => string>(),
}))

vi.mock("fs", () => ({
	existsSync: existsSyncMock,
	readFileSync: readFileSyncMock,
}))

vi.mock("os", () => ({
	homedir: homedirMock,
}))

vi.mock("@/shared/providers/providers.json", () => ({
	default: {
		list: [
			{ value: "openai-native", label: "OpenAI Native" },
			{ value: "anthropic", label: "Anthropic" },
			{ value: "gemini", label: "Gemini" },
		],
	},
}))

vi.mock("@/shared/api", () => ({
	openAiNativeDefaultModelId: "gpt-default",
	anthropicDefaultModelId: "claude-default",
	geminiDefaultModelId: "gemini-default",
}))

import {
	detectImportSources,
	getProviderDisplayName,
	getSourceDisplayName,
	importFromCodex,
	importFromOpenCode,
} from "./import-configs"

describe("import-configs", () => {
	beforeEach(() => {
		homedirMock.mockReturnValue("/home/test")
		existsSyncMock.mockReset()
		readFileSyncMock.mockReset()
		delete process.env.XDG_DATA_HOME
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	function mockFiles(files: Record<string, string>) {
		existsSyncMock.mockImplementation((path) => Object.hasOwn(files, path))
		readFileSyncMock.mockImplementation((path) => {
			if (!Object.hasOwn(files, path)) {
				throw new Error("missing file")
			}
			return files[path]
		})
	}

	describe("getSourceDisplayName", () => {
		it("returns expected labels", () => {
			expect(getSourceDisplayName("codex")).toBe("OpenAI Codex CLI")
			expect(getSourceDisplayName("opencode")).toBe("OpenCode")
		})

		it("should return raw source for unknown", () => {
			expect(getSourceDisplayName("unknown" as any)).toBe("unknown")
		})
	})

	describe("getProviderDisplayName", () => {
		it("uses providers.json labels with fallback", () => {
			expect(getProviderDisplayName("anthropic")).toBe("Anthropic")
			expect(getProviderDisplayName("unknown-provider")).toBe("unknown-provider")
		})
	})

	describe("detectImportSources", () => {
		it("detects both codex and opencode", () => {
			mockFiles({
				"/home/test/.codex/auth.json": JSON.stringify({ OPENAI_API_KEY: "sk-1" }),
				"/home/test/.local/share/opencode/auth.json": JSON.stringify({ openai: { type: "api", key: "sk-2" } }),
			})

			expect(detectImportSources()).toEqual({ codex: true, opencode: true })
		})

		it("should not detect codex when auth.json is missing", () => {
			mockFiles({})

			const sources = detectImportSources()
			expect(sources.codex).toBe(false)
		})

		it("should not detect codex when auth.json is empty", () => {
			mockFiles({
				"/home/test/.codex/auth.json": JSON.stringify({}),
			})

			const sources = detectImportSources()
			expect(sources.codex).toBe(false)
		})

		it("should check XDG_DATA_HOME for opencode", () => {
			process.env.XDG_DATA_HOME = "/custom/xdg"
			mockFiles({
				[path.join("/custom/xdg", "opencode", "auth.json")]: JSON.stringify({ openai: { type: "api", key: "sk-test" } }),
			})

			const sources = detectImportSources()
			expect(sources.opencode).toBe(true)
		})

		it("should handle read errors gracefully", () => {
			existsSyncMock.mockImplementation((p) => {
				if (String(p).includes(".codex/auth.json")) return true
				return false
			})
			readFileSyncMock.mockImplementation(() => {
				throw new Error("Permission denied")
			})

			const sources = detectImportSources()
			expect(sources.codex).toBe(false)
		})
	})

	describe("importFromCodex", () => {
		it("maps known keys and ignores unknown entries", () => {
			mockFiles({
				"/home/test/.codex/auth.json": JSON.stringify({
					OPENAI_API_KEY: "sk-openai",
					ANTHROPIC_API_KEY: "sk-anthropic",
					OTHER: "ignore-me",
				}),
			})

			expect(importFromCodex()).toEqual({
				source: "codex",
				keys: [
					{
						provider: "openai-native",
						keyField: "openAiNativeApiKey",
						key: "sk-openai",
						modelId: "gpt-default",
					},
					{
						provider: "anthropic",
						keyField: "apiKey",
						key: "sk-anthropic",
						modelId: "claude-default",
					},
				],
			})
		})

		it("should return null when auth.json does not exist", () => {
			mockFiles({})
			expect(importFromCodex()).toBeNull()
		})

		it("should import OpenAI key", () => {
			mockFiles({
				"/home/test/.codex/auth.json": JSON.stringify({ OPENAI_API_KEY: "sk-openai-test" }),
			})

			const result = importFromCodex()
			expect(result).not.toBeNull()
			expect(result?.source).toBe("codex")
			expect(result?.keys).toHaveLength(1)
			expect(result?.keys[0].provider).toBe("openai-native")
			expect(result?.keys[0].key).toBe("sk-openai-test")
			expect(result?.keys[0].keyField).toBe("openAiNativeApiKey")
		})

		it("should import Anthropic key", () => {
			mockFiles({
				"/home/test/.codex/auth.json": JSON.stringify({ ANTHROPIC_API_KEY: "sk-ant-test" }),
			})

			const result = importFromCodex()
			expect(result).not.toBeNull()
			expect(result?.keys[0].provider).toBe("anthropic")
			expect(result?.keys[0].key).toBe("sk-ant-test")
			expect(result?.keys[0].keyField).toBe("apiKey")
		})

		it("should import multiple keys", () => {
			mockFiles({
				"/home/test/.codex/auth.json": JSON.stringify({
					OPENAI_API_KEY: "sk-openai",
					ANTHROPIC_API_KEY: "sk-ant",
				}),
			})

			const result = importFromCodex()
			expect(result?.keys).toHaveLength(2)
		})

		it("should skip unknown key names", () => {
			mockFiles({
				"/home/test/.codex/auth.json": JSON.stringify({ UNKNOWN_KEY: "value" }),
			})

			const result = importFromCodex()
			expect(result).toBeNull()
		})

		it("should skip empty key values", () => {
			mockFiles({
				"/home/test/.codex/auth.json": JSON.stringify({ OPENAI_API_KEY: "" }),
			})

			const result = importFromCodex()
			expect(result).toBeNull()
		})

		it("should handle parse errors", () => {
			mockFiles({
				"/home/test/.codex/auth.json": "{ bad json",
			})

			expect(importFromCodex()).toBeNull()
		})
	})

	describe("importFromOpenCode", () => {
		it("reads api entries and skips oauth", () => {
			mockFiles({
				"/home/test/.local/share/opencode/auth.json": JSON.stringify({
					openai: { type: "api", key: "sk-openai" },
					anthropic: { type: "oauth", access: "token" },
					gemini: { type: "api", key: "sk-gemini" },
				}),
			})

			expect(importFromOpenCode()).toEqual({
				source: "opencode",
				keys: [
					{
						provider: "openai-native",
						keyField: "openAiNativeApiKey",
						key: "sk-openai",
						modelId: "gpt-default",
					},
					{
						provider: "gemini",
						keyField: "geminiApiKey",
						key: "sk-gemini",
						modelId: "gemini-default",
					},
				],
			})
		})

		it("prefers XDG_DATA_HOME path", () => {
			process.env.XDG_DATA_HOME = "/xdg"
			mockFiles({
				"/xdg/opencode/auth.json": JSON.stringify({ openai: { type: "api", key: "xdg-key" } }),
				"/home/test/.local/share/opencode/auth.json": JSON.stringify({ openai: { type: "api", key: "fallback-key" } }),
			})

			const result = importFromOpenCode()
			expect(result?.keys[0].key).toBe("xdg-key")
		})

		it("should return null when no auth.json exists", () => {
			mockFiles({})
			expect(importFromOpenCode()).toBeNull()
		})

		it("should import API type keys", () => {
			mockFiles({
				"/home/test/.local/share/opencode/auth.json": JSON.stringify({
					anthropic: { type: "api", key: "sk-ant-test" },
				}),
			})

			const result = importFromOpenCode()
			expect(result).not.toBeNull()
			expect(result?.source).toBe("opencode")
			expect(result?.keys[0].provider).toBe("anthropic")
			expect(result?.keys[0].key).toBe("sk-ant-test")
		})

		it("should skip OAuth type entries", () => {
			mockFiles({
				"/home/test/.local/share/opencode/auth.json": JSON.stringify({
					anthropic: { type: "oauth", access: "token123" },
				}),
			})

			const result = importFromOpenCode()
			expect(result).toBeNull()
		})

		it("should skip entries without key", () => {
			mockFiles({
				"/home/test/.local/share/opencode/auth.json": JSON.stringify({
					anthropic: { type: "api" },
				}),
			})

			const result = importFromOpenCode()
			expect(result).toBeNull()
		})

		it("should import multiple providers", () => {
			mockFiles({
				"/home/test/.local/share/opencode/auth.json": JSON.stringify({
					openai: { type: "api", key: "sk-openai" },
					anthropic: { type: "api", key: "sk-ant" },
					gemini: { type: "api", key: "ai-gemini" },
				}),
			})

			const result = importFromOpenCode()
			expect(result?.keys).toHaveLength(3)
			expect(result?.keys.map((k) => k.provider)).toContain("openai-native")
			expect(result?.keys.map((k) => k.provider)).toContain("anthropic")
			expect(result?.keys.map((k) => k.provider)).toContain("gemini")
		})

		it("should skip unmapped providers", () => {
			mockFiles({
				"/home/test/.local/share/opencode/auth.json": JSON.stringify({
					unknown_provider: { type: "api", key: "sk-test" },
				}),
			})

			const result = importFromOpenCode()
			expect(result).toBeNull()
		})

		it("should handle parse errors", () => {
			mockFiles({
				"/home/test/.local/share/opencode/auth.json": "invalid json",
			})

			const result = importFromOpenCode()
			expect(result).toBeNull()
		})
	})

	it("returns null when files are missing or malformed", () => {
		mockFiles({
			"/home/test/.codex/auth.json": "{ bad json",
			"/home/test/.local/share/opencode/auth.json": "{ bad json",
		})

		expect(importFromCodex()).toBeNull()
		expect(importFromOpenCode()).toBeNull()
		expect(detectImportSources()).toEqual({ codex: false, opencode: false })
	})

	it("returns null when parsed config has no importable keys", () => {
		mockFiles({
			"/home/test/.codex/auth.json": JSON.stringify({}),
			"/home/test/.local/share/opencode/auth.json": JSON.stringify({ anthropic: { type: "oauth", access: "x" } }),
		})

		expect(importFromCodex()).toBeNull()
		expect(importFromOpenCode()).toBeNull()
	})
})
