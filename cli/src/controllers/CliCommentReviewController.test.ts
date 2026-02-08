import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock the base class
vi.mock("@/integrations/editor/CommentReviewController", () => ({
	CommentReviewController: class {
		// Base class stub
	},
}))

const mockPrint = vi.fn()
vi.mock("../utils/display", () => ({
	print: (...args: any[]) => mockPrint(...args),
	style: {
		info: (text: string) => `[info] ${text}`,
		dim: (text: string) => `[dim] ${text}`,
	},
}))

import { CliCommentReviewController } from "./CliCommentReviewController"

describe("CliCommentReviewController", () => {
	let controller: CliCommentReviewController

	beforeEach(() => {
		vi.clearAllMocks()
		controller = new CliCommentReviewController()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("addReviewComment", () => {
		it("should store comment and print info", () => {
			controller.addReviewComment({
				filePath: "/test/file.ts",
				startLine: 10,
				endLine: 15,
				comment: "This needs refactoring",
			})

			expect(mockPrint).toHaveBeenCalledWith(expect.stringContaining("/test/file.ts:11"))
			expect(mockPrint).toHaveBeenCalledWith(expect.stringContaining("This needs refactoring"))
			expect(controller.getThreadCount()).toBe(1)
		})

		it("should group multiple comments on same location", () => {
			controller.addReviewComment({
				filePath: "/test/file.ts",
				startLine: 10,
				endLine: 15,
				comment: "Comment 1",
			})
			controller.addReviewComment({
				filePath: "/test/file.ts",
				startLine: 10,
				endLine: 15,
				comment: "Comment 2",
			})

			expect(controller.getThreadCount()).toBe(1) // Same key, one thread
		})

		it("should create separate threads for different locations", () => {
			controller.addReviewComment({
				filePath: "/test/file.ts",
				startLine: 10,
				endLine: 15,
				comment: "Comment 1",
			})
			controller.addReviewComment({
				filePath: "/test/file.ts",
				startLine: 20,
				endLine: 25,
				comment: "Comment 2",
			})

			expect(controller.getThreadCount()).toBe(2)
		})
	})

	describe("addReviewComments", () => {
		it("should add multiple comments", () => {
			controller.addReviewComments([
				{ filePath: "/test/a.ts", startLine: 1, endLine: 2, comment: "A" },
				{ filePath: "/test/b.ts", startLine: 3, endLine: 4, comment: "B" },
			])

			expect(controller.getThreadCount()).toBe(2)
		})
	})

	describe("getThreadCount", () => {
		it("returns count of unique threads by file and line range", () => {
			controller.addReviewComment({ filePath: "a.ts", startLine: 1, endLine: 2, comment: "first" } as any)
			controller.addReviewComment({ filePath: "a.ts", startLine: 1, endLine: 2, comment: "second" } as any)
			controller.addReviewComment({ filePath: "a.ts", startLine: 3, endLine: 4, comment: "third" } as any)

			expect(controller.getThreadCount()).toBe(2)
		})
	})

	describe("streaming comments", () => {
		it("should start and end streaming comment", () => {
			controller.startStreamingComment("/test/file.ts", 5, 10)
			expect(mockPrint).toHaveBeenCalledWith(expect.stringContaining("/test/file.ts:6"))

			controller.endStreamingComment()
			expect(controller.getThreadCount()).toBe(1)
		})

		it("should append to streaming comment", () => {
			const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

			controller.startStreamingComment("/test/file.ts", 5, 10)
			controller.appendToStreamingComment("chunk1")
			controller.appendToStreamingComment("chunk2")

			expect(writeSpy).toHaveBeenCalledWith("chunk1")
			expect(writeSpy).toHaveBeenCalledWith("chunk2")

			controller.endStreamingComment()
			expect(controller.getThreadCount()).toBe(1)

			writeSpy.mockRestore()
		})

		it("should do nothing when appending without active streaming", () => {
			const writeSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)

			controller.appendToStreamingComment("chunk")
			expect(writeSpy).not.toHaveBeenCalled()

			writeSpy.mockRestore()
		})

		it("should do nothing when ending without active streaming", () => {
			controller.endStreamingComment()
			expect(controller.getThreadCount()).toBe(0)
		})
	})

	describe("clearAllComments", () => {
		it("should clear all comments", () => {
			controller.addReviewComment({
				filePath: "/test/file.ts",
				startLine: 1,
				endLine: 2,
				comment: "Test",
			})
			expect(controller.getThreadCount()).toBe(1)

			controller.clearAllComments()
			expect(controller.getThreadCount()).toBe(0)
		})
	})

	describe("clearCommentsForFile", () => {
		it("should clear comments only for specified file", () => {
			controller.addReviewComment({
				filePath: "/test/a.ts",
				startLine: 1,
				endLine: 2,
				comment: "A",
			})
			controller.addReviewComment({
				filePath: "/test/b.ts",
				startLine: 1,
				endLine: 2,
				comment: "B",
			})
			expect(controller.getThreadCount()).toBe(2)

			controller.clearCommentsForFile("/test/a.ts")
			expect(controller.getThreadCount()).toBe(1)
		})
	})

	describe("no-op methods", () => {
		it("should accept setOnReplyCallback without error", () => {
			expect(() => controller.setOnReplyCallback(vi.fn() as any)).not.toThrow()
		})

		it("should resolve ensureCommentsViewDisabled", async () => {
			await expect(controller.ensureCommentsViewDisabled()).resolves.toBeUndefined()
		})

		it("should resolve closeDiffViews", async () => {
			await expect(controller.closeDiffViews()).resolves.toBeUndefined()
		})
	})

	describe("dispose", () => {
		it("should clear all state", () => {
			controller.addReviewComment({
				filePath: "/test/file.ts",
				startLine: 1,
				endLine: 2,
				comment: "Test",
			})
			controller.startStreamingComment("/test/file.ts", 5, 10)

			controller.dispose()
			expect(controller.getThreadCount()).toBe(0)
		})
	})
})
