import { Text } from "ink"
import { render } from "ink-testing-library"
import { describe, expect, it } from "vitest"
import { checkRawModeSupport, StdinProvider, useStdinContext } from "./StdinContext"

// Test component that displays context value
const StdinDisplay = () => {
	const { isRawModeSupported } = useStdinContext()
	return <Text>raw:{String(isRawModeSupported)}</Text>
}

describe("StdinContext", () => {
	describe("StdinProvider", () => {
		it("should provide isRawModeSupported=true", () => {
			const { lastFrame } = render(
				<StdinProvider isRawModeSupported={true}>
					<StdinDisplay />
				</StdinProvider>,
			)
			expect(lastFrame()).toContain("raw:true")
		})

		it("should provide isRawModeSupported=false", () => {
			const { lastFrame } = render(
				<StdinProvider isRawModeSupported={false}>
					<StdinDisplay />
				</StdinProvider>,
			)
			expect(lastFrame()).toContain("raw:false")
		})
	})

	describe("useStdinContext", () => {
		it("should default to isRawModeSupported=true without provider", () => {
			const { lastFrame } = render(<StdinDisplay />)
			expect(lastFrame()).toContain("raw:true")
		})
	})

	describe("checkRawModeSupport", () => {
		it("should return a boolean", () => {
			const result = checkRawModeSupport()
			expect(typeof result).toBe("boolean")
		})
	})
})
