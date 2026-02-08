import { describe, expect, it, vi } from "vitest"

vi.mock("@/core/webview", () => ({
	WebviewProvider: class {},
}))

import { CliWebviewProvider } from "./CliWebviewProvider"

describe("CliWebviewProvider", () => {
	it("getWebviewUrl returns file url with given path", () => {
		const provider = new CliWebviewProvider({} as any)
		expect(provider.getWebviewUrl("/tmp/file.js")).toBe("file:///tmp/file.js")
	})

	it("getCspSource returns self csp", () => {
		const provider = new CliWebviewProvider({} as any)
		expect(provider.getCspSource()).toBe("'self'")
	})

	it("isVisible returns true", () => {
		const provider = new CliWebviewProvider({} as any)
		expect(provider.isVisible()).toBe(true)
	})
})
