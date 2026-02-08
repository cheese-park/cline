import { Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockSelectList } = vi.hoisted(() => ({
	mockSelectList: vi.fn(),
}))

vi.mock("./SelectList", () => ({
	SelectList: (props: {
		items: Array<{ id: string; label: string; suffix?: string }>
		onSelect: (item: { id: string; label: string; suffix?: string }) => void
		isActive?: boolean
	}) => {
		mockSelectList(props)
		const labels = props.items.map((i) => `${i.label}${i.suffix ? ` ${i.suffix}` : ""}`).join(", ")
		return React.createElement(Text, null, `items:${props.items.length} active:${String(props.isActive ?? true)} [${labels}]`)
	},
}))

import { OrganizationPicker } from "./OrganizationPicker"

describe("OrganizationPicker", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	const organizations = [
		{ organizationId: "org-1", name: "Alpha Org", roles: ["member", "admin"], active: true, memberId: "m-1" },
		{ organizationId: "org-2", name: "Beta Org", roles: ["owner"], active: true, memberId: "m-2" },
	]

	it("should always include Personal option first", () => {
		const { lastFrame } = render(<OrganizationPicker onSelect={vi.fn()} organizations={[]} />)
		expect(lastFrame()).toContain("Personal")
	})

	it("builds personal and organization rows", () => {
		const { lastFrame } = render(<OrganizationPicker onSelect={() => {}} organizations={organizations} />)

		expect(lastFrame()).toContain("items:3")
		const props = mockSelectList.mock.calls[0][0] as {
			items: Array<{ id: string; label: string; suffix?: string }>
		}
		expect(props.items[0]).toEqual({ id: "personal", label: "Personal" })
		expect(props.items[1]).toEqual({ id: "org-1", label: "Alpha Org", suffix: "(Admin)" })
		expect(props.items[2]).toEqual({ id: "org-2", label: "Beta Org", suffix: "(Owner)" })
	})

	it("should list organizations with roles", () => {
		const orgs = [
			{ organizationId: "org-1", name: "Acme Corp", roles: ["owner"] },
			{ organizationId: "org-2", name: "Beta Inc", roles: ["member"] },
		]
		const { lastFrame } = render(<OrganizationPicker onSelect={vi.fn()} organizations={orgs} />)
		expect(lastFrame()).toContain("Acme Corp")
		expect(lastFrame()).toContain("(Owner)")
		expect(lastFrame()).toContain("Beta Inc")
		expect(lastFrame()).toContain("(Member)")
	})

	it("should prioritize owner role over admin/member", () => {
		const orgs = [{ organizationId: "org-1", name: "Test Org", roles: ["member", "owner", "admin"] }]
		const { lastFrame } = render(<OrganizationPicker onSelect={vi.fn()} organizations={orgs} />)
		expect(lastFrame()).toContain("(Owner)")
	})

	it("should prioritize admin role over member", () => {
		const orgs = [{ organizationId: "org-1", name: "Test Org", roles: ["member", "admin"] }]
		const { lastFrame } = render(<OrganizationPicker onSelect={vi.fn()} organizations={orgs} />)
		expect(lastFrame()).toContain("(Admin)")
	})

	it("should handle organizations with no roles", () => {
		const orgs = [{ organizationId: "org-1", name: "Test Org", roles: [] }]
		const { lastFrame } = render(<OrganizationPicker onSelect={vi.fn()} organizations={orgs} />)
		expect(lastFrame()).toContain("Test Org")
	})

	it("forwards isActive", () => {
		const { lastFrame } = render(<OrganizationPicker isActive={false} onSelect={() => {}} organizations={organizations} />)

		expect(lastFrame()).toContain("active:false")
	})

	it("maps personal to null and org to id", () => {
		const onSelect = vi.fn()
		render(<OrganizationPicker onSelect={onSelect} organizations={organizations} />)

		const lastCall = mockSelectList.mock.calls[mockSelectList.mock.calls.length - 1]
		const props = lastCall[0] as {
			onSelect: (item: { id: string; label: string; suffix?: string }) => void
		}
		props.onSelect({ id: "personal", label: "Personal" })
		props.onSelect({ id: "org-2", label: "Beta Org" })

		expect(onSelect).toHaveBeenNthCalledWith(1, null)
		expect(onSelect).toHaveBeenNthCalledWith(2, "org-2")
	})
})
