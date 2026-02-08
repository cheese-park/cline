/**
 * Tests for streamUtils.ts
 *
 * Tests the Node.js to Web Stream conversion utilities used by ACP mode.
 * These utilities convert between Node.js streams and Web Streams API,
 * which is required by the ACP SDK's ndJsonStream function.
 */

import { Readable, Writable } from "node:stream"
import { describe, expect, it } from "vitest"

import { nodeToWebReadable, nodeToWebWritable } from "./streamUtils"

// =============================================================================
// Tests: nodeToWebWritable
// =============================================================================

describe("nodeToWebWritable", () => {
	it("should return a WritableStream", () => {
		const nodeStream = new Writable({
			write(_chunk, _encoding, callback) {
				callback()
			},
		})

		const webStream = nodeToWebWritable(nodeStream)

		expect(webStream).toBeInstanceOf(WritableStream)
	})

	it("should write data to the underlying Node.js stream", async () => {
		const chunks: Buffer[] = []
		const nodeStream = new Writable({
			write(chunk, _encoding, callback) {
				chunks.push(chunk)
				callback()
			},
		})

		const webStream = nodeToWebWritable(nodeStream)
		const writer = webStream.getWriter()

		const testData = new TextEncoder().encode("Hello, world!")
		await writer.write(testData)
		await writer.close()

		expect(chunks.length).toBe(1)
		expect(chunks[0].toString()).toBe("Hello, world!")
	})

	it("should handle multiple writes", async () => {
		const chunks: Buffer[] = []
		const nodeStream = new Writable({
			write(chunk, _encoding, callback) {
				chunks.push(chunk)
				callback()
			},
		})

		const webStream = nodeToWebWritable(nodeStream)
		const writer = webStream.getWriter()

		await writer.write(new TextEncoder().encode("chunk1"))
		await writer.write(new TextEncoder().encode("chunk2"))
		await writer.write(new TextEncoder().encode("chunk3"))
		await writer.close()

		expect(chunks.length).toBe(3)
		expect(chunks[0].toString()).toBe("chunk1")
		expect(chunks[1].toString()).toBe("chunk2")
		expect(chunks[2].toString()).toBe("chunk3")
	})

	it("data flows correctly through writable converter", async () => {
		const chunks: Buffer[] = []
		const sink = new Writable({
			write(chunk, _encoding, callback) {
				chunks.push(Buffer.from(chunk))
				callback()
			},
		})

		const writer = nodeToWebWritable(sink).getWriter()
		await writer.write(new TextEncoder().encode("abc"))
		await writer.write(new TextEncoder().encode("123"))
		await writer.close()

		expect(Buffer.concat(chunks).toString("utf8")).toBe("abc123")
	})

	it("should handle empty data", async () => {
		const chunks: Buffer[] = []
		const nodeStream = new Writable({
			write(chunk, _encoding, callback) {
				chunks.push(chunk)
				callback()
			},
		})

		const webStream = nodeToWebWritable(nodeStream)
		const writer = webStream.getWriter()

		await writer.write(new Uint8Array(0))
		await writer.close()

		expect(chunks.length).toBe(1)
		expect(chunks[0].length).toBe(0)
	})
})

// =============================================================================
// Tests: nodeToWebReadable
// =============================================================================

describe("nodeToWebReadable", () => {
	it("should return a ReadableStream", () => {
		const nodeStream = new Readable({
			read() {
				this.push(null)
			},
		})

		const webStream = nodeToWebReadable(nodeStream)

		expect(webStream).toBeInstanceOf(ReadableStream)
	})

	it("should read data from the underlying Node.js stream", async () => {
		const nodeStream = new Readable({
			read() {
				this.push(Buffer.from("Hello, world!"))
				this.push(null)
			},
		})

		const webStream = nodeToWebReadable(nodeStream)
		const reader = webStream.getReader()

		const result = await reader.read()
		expect(result.done).toBe(false)
		expect(new TextDecoder().decode(result.value)).toBe("Hello, world!")

		const end = await reader.read()
		expect(end.done).toBe(true)
	})

	it("should handle multiple chunks", async () => {
		let pushCount = 0
		const nodeStream = new Readable({
			read() {
				pushCount++
				if (pushCount <= 3) {
					this.push(Buffer.from(`chunk${pushCount}`))
				} else {
					this.push(null)
				}
			},
		})

		const webStream = nodeToWebReadable(nodeStream)
		const reader = webStream.getReader()

		const chunks: string[] = []
		let result = await reader.read()
		while (!result.done) {
			chunks.push(new TextDecoder().decode(result.value))
			result = await reader.read()
		}

		expect(chunks).toEqual(["chunk1", "chunk2", "chunk3"])
	})

	it("data flows correctly through readable converter", async () => {
		const nodeReadable = Readable.from([Buffer.from("foo"), Buffer.from("bar")])
		const reader = nodeToWebReadable(nodeReadable).getReader()

		const received: Uint8Array[] = []
		while (true) {
			const result = await reader.read()
			if (result.done) break
			received.push(result.value)
		}

		const text = Buffer.concat(received.map((v) => Buffer.from(v))).toString("utf8")
		expect(text).toBe("foobar")
	})

	it("should handle empty stream (immediate end)", async () => {
		const nodeStream = new Readable({
			read() {
				this.push(null)
			},
		})

		const webStream = nodeToWebReadable(nodeStream)
		const reader = webStream.getReader()

		const result = await reader.read()
		expect(result.done).toBe(true)
	})

	it("should propagate errors from Node.js stream", async () => {
		const nodeStream = new Readable({
			read() {
				this.destroy(new Error("Stream error"))
			},
		})

		const webStream = nodeToWebReadable(nodeStream)
		const reader = webStream.getReader()

		await expect(reader.read()).rejects.toThrow("Stream error")
	})

	it("should convert Buffer chunks to Uint8Array", async () => {
		const nodeStream = new Readable({
			read() {
				this.push(Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]))
				this.push(null)
			},
		})

		const webStream = nodeToWebReadable(nodeStream)
		const reader = webStream.getReader()

		const result = await reader.read()
		expect(result.done).toBe(false)
		expect(result.value).toBeInstanceOf(Uint8Array)
		expect(new TextDecoder().decode(result.value)).toBe("Hello")
	})
})
