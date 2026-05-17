import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { Agent, createTool } from "@cline/core";
import type { MessageWithMetadata } from "@cline/shared";
import type { Config } from "../../utils/types";
import { formatMemoryManifest, scanMemoryFiles } from "./scan";

export interface MemoryExtractionContext {
	config: Config;
	memoryDir: string;
	sessionId: string;
	messages: MessageWithMetadata[];
}

// Module-level state (one instance per CLI process)
let lastExtractedMessageId: string | undefined;
let inProgress = false;
let pendingContext: MemoryExtractionContext | undefined;

export function initExtractMemories(): void {
	lastExtractedMessageId = undefined;
	inProgress = false;
	pendingContext = undefined;
}

export async function drainPendingExtraction(
	timeoutMs = 60_000,
): Promise<void> {
	if (!inProgress) return;
	const deadline = Date.now() + timeoutMs;
	await new Promise<void>((resolve) => {
		const check = () => {
			if (!inProgress || Date.now() >= deadline) {
				resolve();
			} else {
				setTimeout(check, 200);
			}
		};
		check();
	});
}

export async function triggerExtractMemories(
	context: MemoryExtractionContext,
): Promise<void> {
	if (inProgress) {
		pendingContext = context;
		return;
	}
	void runExtraction(context);
}

async function runExtraction(context: MemoryExtractionContext): Promise<void> {
	inProgress = true;
	try {
		await executeExtractMemories(context);
	} finally {
		inProgress = false;
		const trailing = pendingContext;
		pendingContext = undefined;
		if (trailing) {
			void runExtraction(trailing);
		}
	}
}

async function executeExtractMemories(
	context: MemoryExtractionContext,
): Promise<void> {
	const { config, memoryDir, messages } = context;

	// Only process messages since last extraction
	const newMessages = getMessagesSince(messages, lastExtractedMessageId);
	if (newMessages.length < 2) return;

	// Skip if main agent already wrote to memory dir in this batch
	if (hasMemoryWrites(newMessages, memoryDir)) {
		lastExtractedMessageId = getLastMessageId(messages);
		return;
	}

	await mkdir(memoryDir, { recursive: true });

	const existingMemories = await scanMemoryFiles(memoryDir);
	const existingManifest = formatMemoryManifest(existingMemories);
	const conversationText = formatMessagesAsText(newMessages);
	const prompt = buildExtractionPrompt(
		conversationText,
		newMessages.length,
		existingManifest,
		memoryDir,
	);

	const tools = buildMemoryTools(memoryDir);

	try {
		const agent = new Agent({
			providerId: config.providerId,
			modelId: config.modelId,
			apiKey: config.apiKey,
			baseUrl: config.baseUrl,
			maxIterations: 5,
			tools,
		});
		await agent.run(prompt);
		lastExtractedMessageId = getLastMessageId(messages);
	} catch (err) {
		// Log the error so it's visible; don't update cursor so we retry next time
		const message = err instanceof Error ? err.message : String(err);
		const logPath = join(memoryDir, "extract-errors.log");
		const timestamp = new Date().toISOString();
		await appendFile(
			logPath,
			`[${timestamp}] provider=${config.providerId} model=${config.modelId}\nError: ${message}\n\n`,
		).catch(() => {});
	}
}

function getMessagesSince(
	messages: MessageWithMetadata[],
	sinceId: string | undefined,
): MessageWithMetadata[] {
	if (!sinceId) return messages;
	const idx = messages.findIndex((m) => m.id === sinceId);
	if (idx === -1) return messages;
	return messages.slice(idx + 1);
}

function getLastMessageId(
	messages: MessageWithMetadata[],
): string | undefined {
	return messages.at(-1)?.id;
}

function hasMemoryWrites(
	messages: MessageWithMetadata[],
	memoryDir: string,
): boolean {
	for (const msg of messages) {
		if (msg.role !== "assistant") continue;
		const content = Array.isArray(msg.content) ? msg.content : [];
		for (const block of content) {
			if (
				typeof block === "object" &&
				block !== null &&
				"type" in block &&
				block.type === "tool_use" &&
				"name" in block &&
				(block.name === "write_to_file" || block.name === "apply_diff") &&
				"input" in block &&
				typeof block.input === "object" &&
				block.input !== null &&
				"path" in block.input &&
				typeof block.input.path === "string"
			) {
				const absPath = resolve(block.input.path);
				if (absPath.startsWith(resolve(memoryDir))) return true;
			}
		}
	}
	return false;
}

function formatMessagesAsText(messages: MessageWithMetadata[]): string {
	return messages
		.map((m) => {
			const role = m.role === "assistant" ? "Assistant" : "User";
			const content =
				typeof m.content === "string"
					? m.content
					: m.content
							.map((block) => {
								if (typeof block === "string") return block;
								if (
									typeof block === "object" &&
									block !== null &&
									"type" in block
								) {
									if (block.type === "text" && "text" in block) {
										return String(block.text);
									}
									if (block.type === "tool_use" && "name" in block) {
										return `[Tool: ${block.name}]`;
									}
									if (block.type === "tool_result") {
										return "[Tool result]";
									}
								}
								return "";
							})
							.filter(Boolean)
							.join("\n");
			return `${role}:\n${content}`;
		})
		.join("\n\n---\n\n");
}

function buildExtractionPrompt(
	conversationText: string,
	messageCount: number,
	existingManifest: string,
	memoryDir: string,
): string {
	const existingSection =
		existingManifest.length > 0
			? `\n\n## Existing memory files\n\n${existingManifest}\n\nCheck this list before writing — update an existing file rather than creating a duplicate.`
			: "";

	return `You are now acting as the memory extraction subagent. Analyze the ${messageCount} messages below and use them to update the persistent memory system at \`${memoryDir}\`.

Available tools: read_memory_file, write_memory_file, edit_memory_file (all restricted to the memory directory).

You have a limited turn budget. Efficient strategy: turn 1 — issue all read_memory_file calls in parallel for every file you might update; turn 2 — issue all write/edit calls in parallel.

You MUST only use content from the conversation below. Do not investigate further — no grepping source files, no reading code to confirm patterns.${existingSection}

If the user explicitly asked you to remember something, save it immediately.

## Memory types

- **user**: User role, goals, preferences — tailor future behavior
- **feedback**: Guidance on approach. Lead with rule, **Why:**, **How to apply:**.
- **project**: Ongoing work context not in code/git. Convert relative dates to absolute.
- **reference**: Pointers to external systems

## What NOT to save

- Code patterns, architecture, file paths (derivable by reading code)
- Git history (use git log/blame)
- Ephemeral task details or in-progress work state

## How to save memories

**Step 1** — write to its own file:
\`\`\`markdown
---
name: <short-kebab-case-slug>
description: <one-line — used to decide relevance in future conversations>
metadata:
  type: <user|feedback|project|reference>
---

<memory content>
\`\`\`

**Step 2** — add a pointer to MEMORY.md:
\`- [Title](file.md) — one-line hook\`

## Recent conversation

${conversationText}

---

Now analyze the conversation above and update the memory files. If nothing is worth remembering, do nothing.`;
}

function buildMemoryTools(memoryDir: string) {
	const resolvedMemoryDir = resolve(memoryDir);

	function assertInMemoryDir(filePath: string): string {
		const abs = isAbsolute(filePath) ? filePath : resolve(memoryDir, filePath);
		if (!abs.startsWith(resolvedMemoryDir)) {
			throw new Error(
				`Path "${filePath}" is outside the memory directory. Only memory directory paths are allowed.`,
			);
		}
		return abs;
	}

	const readMemoryFile = createTool({
		name: "read_memory_file",
		description: "Read a memory file to check its current contents before updating.",
		inputSchema: {
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "Path to the memory file (relative to memory dir or absolute within it)",
				},
			},
			required: ["file_path"],
		},
		execute: async (input: { file_path: string }) => {
			try {
				const abs = assertInMemoryDir(input.file_path);
				return await readFile(abs, "utf-8");
			} catch (e) {
				return `Error: ${e instanceof Error ? e.message : String(e)}`;
			}
		},
	});

	const writeMemoryFile = createTool({
		name: "write_memory_file",
		description:
			"Create or overwrite a memory file. Only files inside the memory directory are allowed.",
		inputSchema: {
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "Path to the memory file",
				},
				content: {
					type: "string",
					description: "Full file content to write",
				},
			},
			required: ["file_path", "content"],
		},
		execute: async (input: { file_path: string; content: string }) => {
			try {
				const abs = assertInMemoryDir(input.file_path);
				await mkdir(dirname(abs), { recursive: true });
				await writeFile(abs, input.content, { encoding: "utf-8", mode: 0o600 });
				return `Successfully wrote ${abs}`;
			} catch (e) {
				return `Error: ${e instanceof Error ? e.message : String(e)}`;
			}
		},
	});

	const editMemoryFile = createTool({
		name: "edit_memory_file",
		description:
			"Edit a memory file by replacing a specific string. Requires reading the file first.",
		inputSchema: {
			type: "object",
			properties: {
				file_path: {
					type: "string",
					description: "Path to the memory file",
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
			try {
				const abs = assertInMemoryDir(input.file_path);
				const current = await readFile(abs, "utf-8");
				if (!current.includes(input.old_string)) {
					return `Error: old_string not found in file. The file may have changed since you last read it.`;
				}
				const updated = current.replace(input.old_string, input.new_string);
				await writeFile(abs, updated, { encoding: "utf-8", mode: 0o600 });
				return `Successfully edited ${abs}`;
			} catch (e) {
				return `Error: ${e instanceof Error ? e.message : String(e)}`;
			}
		},
	});

	return [readMemoryFile, writeMemoryFile, editMemoryFile];
}
