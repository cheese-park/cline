import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Agent, createTool } from "@cline/core";
import type { MessageWithMetadata } from "@cline/shared";
import type { Config } from "../../utils/types";
import { getSessionMemoryPath } from "./paths";

const SESSION_MEMORY_CONFIG = {
	minimumMessageTokensToInit: 10_000,
	minimumTokensBetweenUpdate: 5_000,
	toolCallsBetweenUpdates: 3,
} as const;

const DEFAULT_SESSION_MEMORY_TEMPLATE = `# Session Title
_A short and distinctive 5-10 word descriptive title for the session. Super info dense, no filler._

# Current State
_What is actively being worked on right now? Pending tasks not yet completed. Immediate next steps._

# Task Specification
_What did the user ask to build? Any design decisions or other explanatory context._

# Files and Functions
_What are the important files? In short, what do they contain and why are they relevant?_

# Workflow
_What bash commands are usually run and in what order? How to interpret their output if not obvious?_

# Errors & Corrections
_Errors encountered and how they were fixed. What did the user correct? What approaches failed and should not be tried again?_

# Codebase and System Documentation
_What are the important system components? How do they work/fit together?_

# Learnings
_What has worked well? What has not? What to avoid? Do not duplicate items from other sections._

# Key Results
_If the user asked for a specific output such as an answer, table, or document — repeat the exact result here._

# Worklog
_Step by step, what was attempted and done? Very terse summary for each step._
`;

const UPDATE_PROMPT_TEMPLATE = `IMPORTANT: This message and these instructions are NOT part of the actual user conversation. Do NOT include any references to "note-taking" or these update instructions in the notes content.

Based on the user conversation above (EXCLUDING this note-taking instruction), update the session notes file.

The file has been pre-read for you. Here are its current contents:
<current_notes_content>
{{currentNotes}}
</current_notes_content>

Your ONLY task is to use the edit_session_notes tool to update the notes file, then stop. You can make multiple edits (update every section as needed) — make all edit calls in parallel in a single message.

CRITICAL RULES:
- Maintain the exact structure with all section headers and italic descriptions intact
- NEVER modify, delete, or add section headers (lines starting with '#')
- NEVER modify or delete the italic _section description_ lines
- ONLY update content BELOW the italic _section descriptions_
- Do NOT add new sections
- Write DETAILED, INFO-DENSE content — include file paths, function names, error messages, exact commands
- Keep each section under ~2000 tokens — condense older details if approaching the limit
- ALWAYS update "Current State" to reflect the most recent work

Use edit_session_notes with file_path: {{notesPath}}

REMEMBER: Use edit_session_notes in parallel and stop immediately after.`;

// Module-level state
let sessionMemoryInitialized = false;
let tokensAtLastExtraction = 0;
let lastExtractedMessageId: string | undefined;
let extractionInProgress = false;

export function resetSessionMemoryState(): void {
	sessionMemoryInitialized = false;
	tokensAtLastExtraction = 0;
	lastExtractedMessageId = undefined;
	extractionInProgress = false;
}

export function shouldExtractSessionMemory(
	messages: MessageWithMetadata[],
): boolean {
	if (extractionInProgress) return false;

	const currentTokens = estimateTokenCount(messages);

	if (!sessionMemoryInitialized) {
		if (currentTokens < SESSION_MEMORY_CONFIG.minimumMessageTokensToInit) {
			return false;
		}
		sessionMemoryInitialized = true;
	}

	const tokenGrowth = currentTokens - tokensAtLastExtraction;
	if (tokenGrowth < SESSION_MEMORY_CONFIG.minimumTokensBetweenUpdate) {
		return false;
	}

	const toolCallsSince = countToolCallsSince(messages, lastExtractedMessageId);
	const lastTurnHasNoTools = !lastAssistantTurnHasToolCalls(messages);

	return toolCallsSince >= SESSION_MEMORY_CONFIG.toolCallsBetweenUpdates || lastTurnHasNoTools;
}

export async function triggerSessionMemoryExtraction(
	sessionId: string,
	messages: MessageWithMetadata[],
	config: Config,
): Promise<void> {
	if (extractionInProgress) return;
	void runSessionMemoryExtraction(sessionId, messages, config);
}

async function runSessionMemoryExtraction(
	sessionId: string,
	messages: MessageWithMetadata[],
	config: Config,
): Promise<void> {
	extractionInProgress = true;
	try {
		await executeSessionMemoryExtraction(sessionId, messages, config);
	} finally {
		extractionInProgress = false;
	}
}

async function executeSessionMemoryExtraction(
	sessionId: string,
	messages: MessageWithMetadata[],
	config: Config,
): Promise<void> {
	const notesPath = getSessionMemoryPath(sessionId);
	await mkdir(dirname(notesPath), { recursive: true, mode: 0o700 });

	let currentNotes: string;
	try {
		currentNotes = await readFile(notesPath, "utf-8");
	} catch {
		currentNotes = DEFAULT_SESSION_MEMORY_TEMPLATE;
		await writeFile(notesPath, currentNotes, {
			encoding: "utf-8",
			mode: 0o600,
		});
	}

	const prompt = UPDATE_PROMPT_TEMPLATE.replace(
		"{{currentNotes}}",
		currentNotes,
	).replace(/\{\{notesPath\}\}/g, notesPath);

	const tools = buildSessionMemoryTools(notesPath);

	try {
		const agent = new Agent({
			providerId: config.providerId,
			modelId: config.modelId,
			apiKey: config.apiKey,
			baseUrl: config.baseUrl,
			maxIterations: 3,
			tools,
		});

		const conversationSoFar = formatMessagesForSessionMemory(messages);
		await agent.run(`${conversationSoFar}\n\n---\n\n${prompt}`);

		lastExtractedMessageId = messages.at(-1)?.id;
		tokensAtLastExtraction = estimateTokenCount(messages);
	} catch {
		// best-effort
	}
}

export async function buildSessionMemoryInjection(
	sessionId: string,
): Promise<string> {
	const notesPath = getSessionMemoryPath(sessionId);
	try {
		const content = await readFile(notesPath, "utf-8");
		if (!content.trim()) return "";
		return `<system-reminder>\nSession memory from a previous context window:\n\n${content}\n</system-reminder>`;
	} catch {
		return "";
	}
}

function estimateTokenCount(messages: MessageWithMetadata[]): number {
	let chars = 0;
	for (const m of messages) {
		if (typeof m.content === "string") {
			chars += m.content.length;
		} else {
			for (const block of m.content) {
				if (typeof block === "object" && block !== null && "text" in block) {
					chars += String(block.text).length;
				}
			}
		}
	}
	// Rough approximation: 4 chars ≈ 1 token
	return Math.ceil(chars / 4);
}

function countToolCallsSince(
	messages: MessageWithMetadata[],
	sinceId: string | undefined,
): number {
	let counting = sinceId === undefined;
	let count = 0;
	for (const m of messages) {
		if (!counting) {
			if (m.id === sinceId) counting = true;
			continue;
		}
		if (m.role !== "assistant") continue;
		if (!Array.isArray(m.content)) continue;
		for (const block of m.content) {
			if (
				typeof block === "object" &&
				block !== null &&
				"type" in block &&
				block.type === "tool_use"
			) {
				count++;
			}
		}
	}
	return count;
}

function lastAssistantTurnHasToolCalls(
	messages: MessageWithMetadata[],
): boolean {
	for (let i = messages.length - 1; i >= 0; i--) {
		const m = messages[i];
		if (m.role !== "assistant") continue;
		if (!Array.isArray(m.content)) return false;
		return m.content.some(
			(b) =>
				typeof b === "object" && b !== null && "type" in b && b.type === "tool_use",
		);
	}
	return false;
}

function formatMessagesForSessionMemory(
	messages: MessageWithMetadata[],
): string {
	return messages
		.slice(-50) // Only last 50 messages for context
		.map((m) => {
			const role = m.role === "assistant" ? "Assistant" : "User";
			const text =
				typeof m.content === "string"
					? m.content
					: m.content
							.map((b) => {
								if (typeof b === "string") return b;
								if (typeof b === "object" && b !== null && "type" in b) {
									if (b.type === "text" && "text" in b) return String(b.text);
									if (b.type === "tool_use" && "name" in b)
										return `[Tool: ${b.name}]`;
									if (b.type === "tool_result") return "[Tool result]";
								}
								return "";
							})
							.filter(Boolean)
							.join("\n");
			return `${role}:\n${text}`;
		})
		.join("\n\n---\n\n");
}

function buildSessionMemoryTools(notesPath: string) {
	const editSessionNotes = createTool({
		name: "edit_session_notes",
		description: "Edit the session notes file by replacing a specific string. Can be called multiple times in parallel to update different sections.",
		inputSchema: {
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "Path to the session notes file",
				},
				old_string: {
					type: "string",
					description: "The exact text to replace",
				},
				new_string: {
					type: "string",
					description: "The replacement text",
				},
			},
			required: ["file_path", "old_string", "new_string"],
		},
		execute: async (input: {
			file_path: string;
			old_string: string;
			new_string: string;
		}) => {
			if (input.file_path !== notesPath) {
				return `Error: Only ${notesPath} can be edited.`;
			}
			try {
				const current = await readFile(notesPath, "utf-8");
				if (!current.includes(input.old_string)) {
					return `Error: old_string not found in file.`;
				}
				const updated = current.replace(input.old_string, input.new_string);
				await writeFile(notesPath, updated, {
					encoding: "utf-8",
					mode: 0o600,
				});
				return `Successfully updated ${notesPath}`;
			} catch (e) {
				return `Error: ${e instanceof Error ? e.message : String(e)}`;
			}
		},
	});

	return [editSessionNotes];
}
