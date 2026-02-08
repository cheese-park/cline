import { render } from "ink-testing-library"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockUseInput, mockIsMouseEscapeSequence } = vi.hoisted(() => ({
	mockUseInput: vi.fn(),
	mockIsMouseEscapeSequence: vi.fn(() => false),
}))

vi.mock("ink", async () => {
	const actual = await vi.importActual<typeof import("ink")>("ink")
	return {
		...actual,
		useInput: mockUseInput,
	}
})

vi.mock("../context/StdinContext", () => ({
	useStdinContext: () => ({ isRawModeSupported: true }),
}))

vi.mock("../utils/input", () => ({
	isMouseEscapeSequence: mockIsMouseEscapeSequence,
}))

import { ApiKeyInput } from "./ApiKeyInput"

describe("ApiKeyInput", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockIsMouseEscapeSequence.mockReturnValue(false)
	})

	it("renders provider label and masked value", () => {
		const { lastFrame } = render(
			<ApiKeyInput onCancel={() => {}} onChange={() => {}} onSubmit={() => {}} providerName="OpenAI" value="abcd1234" />,
		)

		expect(lastFrame()).toContain("OpenAI API Key")
		expect(lastFrame()).toContain("Enter to save")
	})

	it("should render provider name", () => {
		const { lastFrame } = render(
			<ApiKeyInput onCancel={() => {}} onChange={() => {}} onSubmit={() => {}} providerName="Anthropic" value="" />,
		)
		expect(lastFrame()).toContain("Anthropic API Key")
	})

	it("should show instructions", () => {
		const { lastFrame } = render(
			<ApiKeyInput onCancel={() => {}} onChange={() => {}} onSubmit={() => {}} providerName="Anthropic" value="" />,
		)
		expect(lastFrame()).toContain("Paste your API key below")
		expect(lastFrame()).toContain("Enter to save, Esc to cancel")
	})

	it("should mask the API key value", () => {
		const { lastFrame } = render(
			<ApiKeyInput
				onCancel={() => {}}
				onChange={() => {}}
				onSubmit={() => {}}
				providerName="OpenAI"
				value="sk-test-key-123"
			/>,
		)
		expect(lastFrame()).not.toContain("sk-test-key-123")
	})

	it("should show empty input when no value", () => {
		const { lastFrame } = render(
			<ApiKeyInput onCancel={() => {}} onChange={() => {}} onSubmit={() => {}} providerName="OpenAI" value="" />,
		)
		expect(lastFrame()).not.toContain("\u2022")
	})

	it("calls submit with current value on enter", () => {
		const onSubmit = vi.fn()
		render(<ApiKeyInput onCancel={() => {}} onChange={() => {}} onSubmit={onSubmit} providerName="OpenAI" value="key123" />)

		const inputHandler = mockUseInput.mock.calls[0][0] as (input: string, key: Record<string, boolean>) => void
		inputHandler("", { return: true })

		expect(onSubmit).toHaveBeenCalledWith("key123")
	})

	it("calls change on text input and backspace", () => {
		const onChange = vi.fn()
		render(<ApiKeyInput onCancel={() => {}} onChange={onChange} onSubmit={() => {}} providerName="Anthropic" value="abc" />)

		const inputHandler = mockUseInput.mock.calls[0][0] as (input: string, key: Record<string, boolean>) => void
		inputHandler("d", {})
		inputHandler("", { backspace: true })

		expect(onChange).toHaveBeenNthCalledWith(1, "abcd")
		expect(onChange).toHaveBeenNthCalledWith(2, "ab")
	})

	it("calls cancel on escape", () => {
		const onCancel = vi.fn()
		render(<ApiKeyInput onCancel={onCancel} onChange={() => {}} onSubmit={() => {}} providerName="OpenAI" value="" />)

		const inputHandler = mockUseInput.mock.calls[0][0] as (input: string, key: Record<string, boolean>) => void
		inputHandler("", { escape: true })

		expect(onCancel).toHaveBeenCalledTimes(1)
	})

	it("should not handle input when isActive is false", () => {
		const onSubmit = vi.fn()
		render(
			<ApiKeyInput
				isActive={false}
				onCancel={() => {}}
				onChange={() => {}}
				onSubmit={onSubmit}
				providerName="OpenAI"
				value=""
			/>,
		)
		// When isActive is false, input handlers should not be triggered
	})
})
