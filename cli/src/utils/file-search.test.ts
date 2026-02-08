import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

type FileSearchModule = typeof import("./file-search")

async function importFileSearchWithRipgrepAvailable(available: boolean): Promise<FileSearchModule> {
	vi.resetModules()
	vi.doMock("node:child_process", () => ({
		execFileSync: vi.fn(() => {
			if (!available) {
				throw new Error("rg not found")
			}
		}),
		spawn: vi.fn(),
	}))

	return import("./file-search")
}

describe("file-search", () => {
	afterEach(() => {
		vi.restoreAllMocks()
		vi.resetModules()
	})

	describe("extractMentionQuery", () => {
		let fileSearch: FileSearchModule

		beforeEach(async () => {
			fileSearch = await import("./file-search")
		})

		it("returns mention mode when @ is at start", () => {
			expect(fileSearch.extractMentionQuery("@src/app.ts")).toEqual({
				inMentionMode: true,
				query: "src/app.ts",
				atIndex: 0,
			})
		})

		it("should detect @ at start of text (short query)", () => {
			const result = fileSearch.extractMentionQuery("@src")
			expect(result.inMentionMode).toBe(true)
			expect(result.query).toBe("src")
			expect(result.atIndex).toBe(0)
		})

		it("returns mention mode when @ is preceded by space", () => {
			expect(fileSearch.extractMentionQuery("open @src/app.ts")).toEqual({
				inMentionMode: true,
				query: "src/app.ts",
				atIndex: 5,
			})
		})

		it("should detect @ after whitespace", () => {
			const result = fileSearch.extractMentionQuery("text @file")
			expect(result.inMentionMode).toBe(true)
			expect(result.query).toBe("file")
			expect(result.atIndex).toBe(5)
		})

		it("returns false when @ is preceded by non-whitespace", () => {
			expect(fileSearch.extractMentionQuery("open@src/app.ts")).toEqual({
				inMentionMode: false,
				query: "",
				atIndex: -1,
			})
		})

		it("should not detect @ in middle of word (email-like)", () => {
			const result = fileSearch.extractMentionQuery("email@test.com")
			expect(result.inMentionMode).toBe(false)
		})

		it("returns false when there is no @", () => {
			expect(fileSearch.extractMentionQuery("open src/app.ts")).toEqual({
				inMentionMode: false,
				query: "",
				atIndex: -1,
			})
		})

		it("returns false when there is a space after @", () => {
			expect(fileSearch.extractMentionQuery("open @src app.ts")).toEqual({
				inMentionMode: false,
				query: "",
				atIndex: -1,
			})
		})

		it("should not detect @ with space after query", () => {
			const result = fileSearch.extractMentionQuery("@file done")
			expect(result.inMentionMode).toBe(false)
		})

		it("should return not in mention mode when no @", () => {
			const result = fileSearch.extractMentionQuery("hello world")
			expect(result.inMentionMode).toBe(false)
			expect(result.query).toBe("")
			expect(result.atIndex).toBe(-1)
		})

		it("should use the last @ in text", () => {
			const result = fileSearch.extractMentionQuery("@first text @second")
			expect(result.inMentionMode).toBe(true)
			expect(result.query).toBe("second")
		})

		it("should handle just @", () => {
			const result = fileSearch.extractMentionQuery("@")
			expect(result.inMentionMode).toBe(true)
			expect(result.query).toBe("")
		})

		it("should handle empty string", () => {
			const result = fileSearch.extractMentionQuery("")
			expect(result.inMentionMode).toBe(false)
		})
	})

	describe("insertMention", () => {
		let fileSearch: FileSearchModule

		beforeEach(async () => {
			fileSearch = await import("./file-search")
		})

		it("inserts mention at atIndex and replaces partial mention", () => {
			expect(fileSearch.insertMention("open @sr please", 5, "src/app.ts")).toBe("open @/src/app.ts please")
		})

		it("wraps mention in quotes when path contains spaces", () => {
			expect(fileSearch.insertMention("read @sr", 5, "src/my file.ts")).toBe('read @"/src/my file.ts" ')
		})

		it("keeps leading slash when filePath already starts with /", () => {
			expect(fileSearch.insertMention("read @sr", 5, "/src/app.ts")).toBe("read @/src/app.ts ")
		})

		it("adds leading slash when filePath does not start with /", () => {
			expect(fileSearch.insertMention("read @sr", 5, "src/app.ts")).toBe("read @/src/app.ts ")
		})

		it("trims text after replaced mention", () => {
			expect(fileSearch.insertMention("check @ol   and continue", 6, "new/path.ts")).toBe(
				"check @/new/path.ts and continue",
			)
		})

		it("should insert mention at @ position", () => {
			expect(fileSearch.insertMention("@sr", 0, "src/index.ts")).toBe("@/src/index.ts ")
		})

		it("should preserve text before @", () => {
			expect(fileSearch.insertMention("look at @sr", 8, "src/index.ts")).toBe("look at @/src/index.ts ")
		})

		it("should normalize path with leading /", () => {
			expect(fileSearch.insertMention("@", 0, "/absolute/path.ts")).toBe("@/absolute/path.ts ")
		})

		it("should add / prefix if missing", () => {
			expect(fileSearch.insertMention("@", 0, "relative/path.ts")).toBe("@/relative/path.ts ")
		})

		it("should quote paths with spaces", () => {
			expect(fileSearch.insertMention("@", 0, "/path with spaces/file.ts")).toBe('@"/path with spaces/file.ts" ')
		})

		it("should handle text after mention", () => {
			expect(fileSearch.insertMention("@sr more text", 0, "src/index.ts")).toBe("@/src/index.ts more text")
		})
	})

	describe("getRipgrepInstallInstructions", () => {
		let fileSearch: FileSearchModule

		beforeEach(async () => {
			fileSearch = await import("./file-search")
		})

		it("returns macOS instructions", () => {
			vi.spyOn(process, "platform", "get").mockReturnValue("darwin")
			expect(fileSearch.getRipgrepInstallInstructions()).toBe("brew install ripgrep")
		})

		it("returns Linux instructions", () => {
			vi.spyOn(process, "platform", "get").mockReturnValue("linux")
			expect(fileSearch.getRipgrepInstallInstructions()).toBe("apt install ripgrep  # or: yum install ripgrep")
		})

		it("returns Windows instructions", () => {
			vi.spyOn(process, "platform", "get").mockReturnValue("win32")
			expect(fileSearch.getRipgrepInstallInstructions()).toBe("choco install ripgrep  # or: scoop install ripgrep")
		})

		it("returns generic URL for unknown platforms", () => {
			vi.spyOn(process, "platform", "get").mockReturnValue("freebsd")
			expect(fileSearch.getRipgrepInstallInstructions()).toBe("https://github.com/BurntSushi/ripgrep#installation")
		})
	})

	describe("checkAndWarnRipgrepMissing", () => {
		it("returns true first time when ripgrep is missing", async () => {
			const fileSearch = await importFileSearchWithRipgrepAvailable(false)
			expect(fileSearch.checkAndWarnRipgrepMissing()).toBe(true)
		})

		it("returns false on subsequent checks when warning already shown", async () => {
			const fileSearch = await importFileSearchWithRipgrepAvailable(false)
			expect(fileSearch.checkAndWarnRipgrepMissing()).toBe(true)
			expect(fileSearch.checkAndWarnRipgrepMissing()).toBe(false)
		})

		it("returns false when ripgrep is available", async () => {
			const fileSearch = await importFileSearchWithRipgrepAvailable(true)
			expect(fileSearch.checkAndWarnRipgrepMissing()).toBe(false)
		})
	})
})
