import { render } from "ink-testing-library"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockSearchableList } = vi.hoisted(() => ({
	mockSearchableList: vi.fn(),
}))

vi.mock("./SearchableList", () => ({
	SearchableList: (props: {
		items: Array<{ id: string; label: string }>
		onSelect: (item: { id: string; label: string }) => void
		isActive?: boolean
	}) => {
		mockSearchableList(props)
		return React.createElement("ink-text", null, `items:${props.items.length} active:${String(props.isActive ?? true)}`)
	},
}))

import { LanguagePicker } from "./LanguagePicker"

describe("LanguagePicker", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("passes language list to SearchableList", () => {
		const { lastFrame } = render(<LanguagePicker onSelect={() => {}} />)

		expect(lastFrame()).toContain("items:18")
		const props = mockSearchableList.mock.calls[0][0] as { items: Array<{ id: string; label: string }> }
		expect(props.items[0]).toEqual({ id: "English", label: "English" })
	})

	it("should include expected language count", () => {
		const { lastFrame } = render(<LanguagePicker onSelect={vi.fn()} />)
		expect(lastFrame()).toContain("18")
	})

	it("forwards isActive flag", () => {
		const { lastFrame } = render(<LanguagePicker isActive={false} onSelect={() => {}} />)

		expect(lastFrame()).toContain("active:false")
	})

	it("maps selected item to language string", () => {
		const onSelect = vi.fn()
		render(<LanguagePicker onSelect={onSelect} />)

		const lastCall = mockSearchableList.mock.calls[mockSearchableList.mock.calls.length - 1]
		const props = lastCall[0] as { onSelect: (item: { id: string; label: string }) => void }
		props.onSelect({ id: "Japanese", label: "Japanese" })

		expect(onSelect).toHaveBeenCalledWith("Japanese")
	})
})
