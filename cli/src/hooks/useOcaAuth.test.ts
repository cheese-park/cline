import { render } from "ink-testing-library"
import React from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

const { initializeMock, createAuthRequestMock, subscribeToAuthStatusUpdateMock } = vi.hoisted(() => ({
	initializeMock: vi.fn(),
	createAuthRequestMock: vi.fn(async () => undefined),
	subscribeToAuthStatusUpdateMock: vi.fn(),
}))

vi.mock("@/services/auth/oca/OcaAuthService", () => ({
	OcaAuthService: {
		initialize: initializeMock,
		getInstance: () => ({
			createAuthRequest: createAuthRequestMock,
			subscribeToAuthStatusUpdate: subscribeToAuthStatusUpdateMock,
		}),
	},
}))

import { useOcaAuth } from "./useOcaAuth"

describe("useOcaAuth", () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it("startAuth initializes and requests auth", () => {
		let hook: ReturnType<typeof useOcaAuth> | undefined
		const controller = {} as any
		const Probe = () => {
			hook = useOcaAuth({ controller })
			return null
		}
		const app = render(React.createElement(Probe))
		hook?.startAuth()
		expect(initializeMock).toHaveBeenCalledWith(controller)
		expect(createAuthRequestMock).toHaveBeenCalledTimes(1)
		app.unmount()
	})

	it("marks authenticated on status update", async () => {
		let hook: ReturnType<typeof useOcaAuth> | undefined
		let statusHandler: ((state: any) => void | Promise<void>) | undefined
		subscribeToAuthStatusUpdateMock.mockImplementation((_req: any, cb: (state: any) => void) => {
			statusHandler = cb
		})
		const onSuccess = vi.fn(async () => undefined)
		const controller = {} as any

		const Probe = () => {
			hook = useOcaAuth({ controller, enabled: true, onSuccess })
			return null
		}

		const app = render(React.createElement(Probe))
		expect(hook?.isAuthenticated).toBe(false)
		await statusHandler?.({ user: { uid: "u-1" } })
		await Promise.resolve()
		expect(onSuccess).toHaveBeenCalledTimes(1)
		app.unmount()
	})

	it("reports error when auth request fails", async () => {
		createAuthRequestMock.mockRejectedValueOnce(new Error("boom"))
		const onError = vi.fn()
		let hook: ReturnType<typeof useOcaAuth> | undefined
		const Probe = () => {
			hook = useOcaAuth({ controller: {} as any, onError })
			return null
		}
		const app = render(React.createElement(Probe))
		hook?.startAuth()
		await Promise.resolve()
		expect(onError).toHaveBeenCalledTimes(1)
		app.unmount()
	})
})
