/**
 * Tests for ChatView component exit and cleanup behavior
 *
 * These tests verify that when the user exits (via shutdown event or other means),
 * the input field is properly hidden before the app terminates.
 */

import { Text } from "ink"
import { render } from "ink-testing-library"
import React from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@shared/proto/cline/common", () => ({
	EmptyRequest: { create: (data: unknown) => data || {} },
	StringRequest: { create: (data: unknown) => data || {} },
}))

vi.mock("@shared/storage", () => ({
	getProviderDefaultModelId: () => "claude-sonnet-4-20250514",
	getProviderModelIdKey: () => "actModeApiModelId",
}))

vi.mock("@shared/proto/cline/slash", () => ({
	SlashCommandInfo: {},
}))

vi.mock("./ModelPicker", () => ({
	providerModels: {},
}))

import { ChatView } from "./ChatView"

// Helper to wait for async state updates
const delay = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms))

// Type for our exit mock function
type ExitMockFn = ReturnType<typeof vi.fn> & (() => void)

// Track shutdown event state
const shutdownMockState = {
	listeners: [] as Array<() => void>,
	fire: () => {
		shutdownMockState.listeners.forEach((listener) => listener())
	},
	reset: () => {
		shutdownMockState.listeners = []
	},
}

// Mock vscode-shim shutdownEvent
vi.mock("../vscode-shim", () => ({
	shutdownEvent: {
		event: (listener: () => void) => {
			shutdownMockState.listeners.push(listener)
			return {
				dispose: () => {
					const idx = shutdownMockState.listeners.indexOf(listener)
					if (idx >= 0) shutdownMockState.listeners.splice(idx, 1)
				},
			}
		},
		fire: () => shutdownMockState.fire(),
	},
}))

// Mock TaskContext
vi.mock("../context/TaskContext", () => ({
	useTaskState: vi.fn(() => ({
		clineMessages: [],
		mode: "act",
	})),
	useTaskContext: vi.fn(() => ({
		controller: null,
		clearState: vi.fn(),
	})),
}))

// Mock useIsSpinnerActive hook
vi.mock("../hooks/useStateSubscriber", () => ({
	useIsSpinnerActive: vi.fn(() => ({
		isActive: false,
		startTime: null,
	})),
}))

// Mock StateManager
vi.mock("@/core/storage/StateManager", () => ({
	StateManager: {
		get: vi.fn(() => ({
			getGlobalSettingsKey: vi.fn((key: string) => {
				if (key === "mode") return "act"
				if (key === "yoloModeToggled") return false
				if (key === "actModeApiModelId") return "claude-sonnet-4-20250514"
				return null
			}),
			setGlobalState: vi.fn(),
		})),
	},
}))

// Mock child components that aren't under test
vi.mock("./ActionButtons", () => ({
	ActionButtons: () => React.createElement(Text, null, "ActionButtons"),
	getButtonConfig: vi.fn(() => ({ enableButtons: false })),
}))

vi.mock("./AsciiMotionCli", () => ({
	AsciiMotionCli: () => React.createElement(Text, null, "AsciiMotion"),
	StaticRobotFrame: () => React.createElement(Text, null, "StaticRobot"),
}))

vi.mock("./ChatMessage", () => ({
	ChatMessage: ({ message }: { message?: { ts?: number; text?: string } }) =>
		React.createElement(Text, null, `Message: ${message?.ts}${message?.text ? ` ${message.text}` : ""}`),
}))

vi.mock("./FileMentionMenu", () => ({
	FileMentionMenu: () => React.createElement(Text, null, "FileMentionMenu"),
}))

vi.mock("./HighlightedInput", () => ({
	HighlightedInput: ({ text }: { text?: string }) => React.createElement(Text, null, `Input: ${text}`),
}))

vi.mock("./HistoryPanelContent", () => ({
	HistoryPanelContent: () => React.createElement(Text, null, "HistoryPanel"),
}))

vi.mock("./SettingsPanelContent", () => ({
	SettingsPanelContent: () => React.createElement(Text, null, "SettingsPanel"),
}))

vi.mock("./SlashCommandMenu", () => ({
	SlashCommandMenu: () => React.createElement(Text, null, "SlashMenu"),
}))

vi.mock("./ThinkingIndicator", () => ({
	ThinkingIndicator: () => React.createElement(Text, null, "ThinkingIndicator"),
}))

// Mock utility functions
vi.mock("../utils/file-search", () => ({
	checkAndWarnRipgrepMissing: vi.fn(() => false),
	extractMentionQuery: vi.fn(() => ({ inMentionMode: false, query: "", atIndex: -1 })),
	getRipgrepInstallInstructions: vi.fn(() => "brew install ripgrep"),
	insertMention: vi.fn((text: string) => text),
	searchWorkspaceFiles: vi.fn(async () => []),
}))

vi.mock("../utils/slash-commands", () => ({
	extractSlashQuery: vi.fn(() => ({ inSlashMode: false, query: "", slashIndex: -1 })),
	filterCommands: vi.fn(() => []),
	insertSlashCommand: vi.fn((text: string) => text),
	sortCommandsWorkflowsFirst: vi.fn((cmds: unknown[]) => cmds),
}))

vi.mock("../utils/input", () => ({
	isMouseEscapeSequence: vi.fn(() => false),
}))

vi.mock("../utils/parser", () => ({
	jsonParseSafe: vi.fn((_text: string, defaultValue: unknown) => defaultValue),
	parseImagesFromInput: vi.fn((text: string) => ({ prompt: text, imagePaths: [] })),
}))

vi.mock("../utils/tools", () => ({
	isFileEditTool: vi.fn(() => false),
	parseToolFromMessage: vi.fn(() => null),
}))

vi.mock("../utils/display", () => ({
	setTerminalTitle: vi.fn(),
}))

vi.mock("../utils/cursor", () => ({
	moveCursorUp: vi.fn((_text: string, pos: number) => pos),
	moveCursorDown: vi.fn((_text: string, pos: number) => pos),
}))

vi.mock("@/core/controller/slash/getAvailableSlashCommands", () => ({
	getAvailableSlashCommands: vi.fn(async () => ({ commands: [] })),
}))

vi.mock("@/core/controller/task/showTaskWithId", () => ({
	showTaskWithId: vi.fn(async () => {}),
}))

vi.mock("@shared/combineCommandSequences", () => ({
	combineCommandSequences: vi.fn((messages: unknown[]) => messages),
}))

vi.mock("@shared/getApiMetrics", () => ({
	getApiMetrics: vi.fn(() => ({
		totalTokensIn: 0,
		totalTokensOut: 0,
		totalCost: 0,
	})),
	getLastApiReqTotalTokens: vi.fn(() => 0),
}))

vi.mock("child_process", () => ({
	exec: vi.fn(),
	execSync: vi.fn(() => "main"),
}))

// Mock telemetry service to prevent HostProvider errors in shutdown handler
vi.mock("@/services/telemetry", () => ({
	telemetryService: {
		captureHostEvent: vi.fn(),
	},
}))

// Helper to create a typed mock for onExit
const createExitMock = (): ExitMockFn => vi.fn() as ExitMockFn

describe("ChatView Exit and Cleanup", () => {
	let mockOnExit: ExitMockFn

	beforeEach(() => {
		vi.clearAllMocks()
		shutdownMockState.reset()
		mockOnExit = createExitMock()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Initial render state", () => {
		it("should render with input field, footer, and mode toggle visible", () => {
			const { lastFrame } = render(<ChatView onExit={mockOnExit} />)
			const frame = lastFrame()

			// Input field visible
			expect(frame).toContain("Input:")
			// Footer with help text
			expect(frame).toContain("@ for files")
			expect(frame).toContain("/ for commands")
			// Mode toggle
			expect(frame).toContain("Plan")
			expect(frame).toContain("Act")
		})
	})

	describe("Shutdown event handling", () => {
		it("should subscribe on mount and unsubscribe on unmount", () => {
			const { unmount } = render(<ChatView onExit={mockOnExit} />)
			expect(shutdownMockState.listeners.length).toBe(1)

			unmount()
			expect(shutdownMockState.listeners.length).toBe(0)
		})

		it("should hide input when shutdown event fires", async () => {
			const { lastFrame } = render(<ChatView onExit={mockOnExit} />)

			// Input should be visible initially
			expect(lastFrame()).toContain("Input:")

			// Fire shutdown event (simulates Ctrl+C)
			shutdownMockState.fire()
			await delay()

			// Input should be hidden after shutdown
			expect(lastFrame()).not.toContain("Input:")
		})

		it("should preserve footer when shutdown event fires", async () => {
			const { lastFrame } = render(<ChatView onExit={mockOnExit} />)

			// Footer should be visible initially
			expect(lastFrame()).toContain("@ for files")

			// Fire shutdown event
			shutdownMockState.fire()
			await delay()

			// Footer should still be present (only input is hidden)
			expect(lastFrame()).toContain("@ for files")
		})
	})

	describe("Edge cases", () => {
		it("should handle shutdown event when onExit prop is undefined", async () => {
			const { lastFrame } = render(<ChatView />)

			// Fire shutdown event
			shutdownMockState.fire()
			await delay()

			// Should not throw, UI should still hide
			expect(lastFrame()).not.toContain("Input:")
		})

		it("should handle multiple shutdown events gracefully", async () => {
			const { lastFrame } = render(<ChatView onExit={mockOnExit} />)

			// Fire multiple shutdown events
			shutdownMockState.fire()
			shutdownMockState.fire()
			shutdownMockState.fire()

			await delay()

			// UI should still hide properly
			expect(lastFrame()).not.toContain("Input:")
		})
	})
})

describe("ChatView UI State During Exit", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		shutdownMockState.reset()
	})

	it("should preserve static content and footer, only hide input during exit", async () => {
		const onExit = createExitMock()
		const { lastFrame } = render(<ChatView onExit={onExit} />)

		// Footer contains auto-approve toggle
		expect(lastFrame()).toContain("Auto-approve")
		expect(lastFrame()).toContain("What can I do for you?")
		expect(lastFrame()).toContain("Input:")

		// Fire shutdown event
		shutdownMockState.fire()
		await delay()

		const frameAfter = lastFrame()

		// Static content should still be present
		expect(frameAfter).toContain("What can I do for you?")
		// Footer should still be present (only input is hidden)
		expect(frameAfter).toContain("Auto-approve")
		// Input should be hidden
		expect(frameAfter).not.toContain("Input:")
	})
})

describe("ChatView Streaming Messages", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		shutdownMockState.reset()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should display streaming messages", async () => {
		const { useTaskState } = await import("../context/TaskContext")
		vi.mocked(useTaskState).mockReturnValue({
			clineMessages: [
				{
					ts: 1000,
					type: "say",
					say: "text",
					text: "Hello",
					partial: true,
				},
			],
			mode: "act",
		})

		const { lastFrame } = render(<ChatView />)
		await delay()

		const frame = lastFrame()
		expect(frame).toContain("Hello")
	})
})

describe("ChatView Input Submission", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		shutdownMockState.reset()
	})

	it("should call controller.initTask when submitting text input", async () => {
		const mockInitTask = vi.fn().mockResolvedValue(undefined)
		const mockController = {
			initTask: mockInitTask,
			getWorkspaceManagerSync: vi.fn(() => ({
				getPrimaryRoot: vi.fn(() => ({ path: "/test/workspace" })),
			})),
		}

		const { stdin } = render(<ChatView controller={mockController} />)

		// Type some text
		stdin.write("Hello, Cline!")
		await delay(50)

		// Press Enter to submit
		stdin.write("\r")
		await delay(200)

		// Verify initTask was called with the text
		expect(mockInitTask).toHaveBeenCalledWith("Hello, Cline!", undefined)
	})

	it("should not submit when input is empty", async () => {
		const mockInitTask = vi.fn().mockResolvedValue(undefined)
		const mockController = {
			initTask: mockInitTask,
			getWorkspaceManagerSync: vi.fn(() => ({
				getPrimaryRoot: vi.fn(() => ({ path: "/test/workspace" })),
			})),
		}

		const { stdin } = render(<ChatView controller={mockController} />)

		// Press Enter without typing anything
		stdin.write("\r")
		await delay(200)

		// Verify initTask was NOT called
		expect(mockInitTask).not.toHaveBeenCalled()
	})

	it("should clear input after successful submission", async () => {
		const mockInitTask = vi.fn().mockResolvedValue(undefined)
		const mockController = {
			initTask: mockInitTask,
			getWorkspaceManagerSync: vi.fn(() => ({
				getPrimaryRoot: vi.fn(() => ({ path: "/test/workspace" })),
			})),
		}

		const { stdin, lastFrame } = render(<ChatView controller={mockController} />)

		// Type text
		stdin.write("test task")
		await delay(50)
		expect(lastFrame()).toContain("test task")

		// Submit
		stdin.write("\r")
		await vi.waitFor(
			() => {
				expect(lastFrame()).not.toContain("test task")
			},
			{ timeout: 2000 },
		)
	})
})

describe("ChatView Mode Toggle", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		shutdownMockState.reset()
	})

	it("should toggle from act to plan mode when Tab is pressed", async () => {
		const mockTogglePlanActMode = vi.fn().mockResolvedValue(undefined)
		const mockController = {
			togglePlanActMode: mockTogglePlanActMode,
			getWorkspaceManagerSync: vi.fn(() => ({
				getPrimaryRoot: vi.fn(() => ({ path: "/test/workspace" })),
			})),
		}

		const { stdin, lastFrame } = render(<ChatView controller={mockController} />)

		// Initially in Act mode
		const initialFrame = lastFrame()
		expect(initialFrame).toContain("Act")

		// Press Tab to toggle mode
		stdin.write("\t")
		await delay(200)

		// Verify togglePlanActMode was called with "plan"
		expect(mockTogglePlanActMode).toHaveBeenCalledWith("plan")
	})

	it("should toggle from plan to act mode with input text", async () => {
		const { useTaskState } = await import("../context/TaskContext")
		vi.mocked(useTaskState).mockReturnValue({
			clineMessages: [],
			mode: "plan",
		})

		const mockTogglePlanActMode = vi.fn().mockResolvedValue(undefined)
		const mockController = {
			togglePlanActMode: mockTogglePlanActMode,
			getWorkspaceManagerSync: vi.fn(() => ({
				getPrimaryRoot: vi.fn(() => ({ path: "/test/workspace" })),
			})),
		}

		const { stdin } = render(<ChatView controller={mockController} />)

		// Type some text
		stdin.write("implement feature X")
		await delay(50)

		// Press Tab to toggle (from plan to act)
		stdin.write("\t")
		await delay(200)

		// Verify togglePlanActMode was called with "act" and the message
		expect(mockTogglePlanActMode).toHaveBeenCalledWith("act", {
			message: "implement feature X",
		})
	})
})

describe("ChatView Slash Command Menu", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		shutdownMockState.reset()
	})

	it("should show slash menu when typing /", async () => {
		const { extractSlashQuery } = await import("../utils/slash-commands")
		const { getAvailableSlashCommands } = await import("@/core/controller/slash/getAvailableSlashCommands")

		const mockCommands = [
			{ name: "help", description: "Show help", section: "default", cliCompatible: true },
			{ name: "settings", description: "Open settings", section: "default", cliCompatible: true },
		]

		vi.mocked(getAvailableSlashCommands).mockResolvedValue({ commands: mockCommands })
		vi.mocked(extractSlashQuery).mockImplementation((text, _pos) => {
			if (text === "/") {
				return { inSlashMode: true, query: "", slashIndex: 0 }
			}
			return { inSlashMode: false, query: "", slashIndex: -1 }
		})

		const mockController = {
			getWorkspaceManagerSync: vi.fn(() => ({
				getPrimaryRoot: vi.fn(() => ({ path: "/test/workspace" })),
			})),
		}

		const { stdin, lastFrame } = render(<ChatView controller={mockController} />)

		// Wait for commands to load
		await delay(100)

		// Type /
		stdin.write("/")
		await delay(100)

		// Slash menu should be visible
		expect(lastFrame()).toContain("SlashMenu")
	})

	it("should navigate slash menu with arrow keys", async () => {
		const { extractSlashQuery, filterCommands } = await import("../utils/slash-commands")
		const { getAvailableSlashCommands } = await import("@/core/controller/slash/getAvailableSlashCommands")

		const mockCommands = [
			{ name: "help", description: "Show help", section: "default", cliCompatible: true },
			{ name: "settings", description: "Open settings", section: "default", cliCompatible: true },
			{ name: "clear", description: "Clear screen", section: "default", cliCompatible: true },
		]

		vi.mocked(getAvailableSlashCommands).mockResolvedValue({ commands: mockCommands })
		vi.mocked(extractSlashQuery).mockReturnValue({ inSlashMode: true, query: "", slashIndex: 0 })
		vi.mocked(filterCommands).mockReturnValue(mockCommands)

		const mockController = {
			getWorkspaceManagerSync: vi.fn(() => ({
				getPrimaryRoot: vi.fn(() => ({ path: "/test/workspace" })),
			})),
		}

		const { stdin, lastFrame } = render(<ChatView controller={mockController} />)

		// Wait for commands to load
		await delay(100)

		// Type /
		stdin.write("/")
		await delay(100)

		// Press down arrow to navigate menu (tests menu navigation logic)
		stdin.write("\x1B[B")
		await delay(50)

		// Press up arrow
		stdin.write("\x1B[A")
		await delay(50)

		// Menu should still be visible
		expect(lastFrame()).toContain("SlashMenu")
	})

	it("should handle /clear command", async () => {
		const { extractSlashQuery, filterCommands, insertSlashCommand } = await import("../utils/slash-commands")
		const { getAvailableSlashCommands } = await import("@/core/controller/slash/getAvailableSlashCommands")

		const mockCommands = [{ name: "clear", description: "Clear screen", section: "default", cliCompatible: true }]

		vi.mocked(getAvailableSlashCommands).mockResolvedValue({ commands: mockCommands })
		vi.mocked(extractSlashQuery).mockReturnValue({ inSlashMode: true, query: "", slashIndex: 0 })
		vi.mocked(filterCommands).mockReturnValue(mockCommands)
		vi.mocked(insertSlashCommand).mockReturnValue("/clear ")

		const mockClearTask = vi.fn().mockResolvedValue(undefined)
		const mockPostStateToWebview = vi.fn()
		const mockController = {
			clearTask: mockClearTask,
			postStateToWebview: mockPostStateToWebview,
			getWorkspaceManagerSync: vi.fn(() => ({
				getPrimaryRoot: vi.fn(() => ({ path: "/test/workspace" })),
			})),
		}

		const { stdin } = render(<ChatView controller={mockController} />)

		// Wait for commands to load
		await delay(100)

		// Type /
		stdin.write("/")
		await delay(100)

		// Press Enter to select /clear
		stdin.write("\r")
		await delay(200)

		// clearTask should be called
		expect(mockClearTask).toHaveBeenCalled()
	})
})
