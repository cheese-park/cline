import { readFile } from "node:fs/promises";
import { Agent } from "@cline/core";
import type { Config } from "../../utils/types";
import { formatMemoryManifest, scanMemoryFiles } from "./scan";

const SELECT_MEMORIES_SYSTEM_PROMPT = `You are selecting memories that will be useful to an AI assistant as it processes a user's query. You will be given the user's query and a list of available memory files with their filenames and descriptions.

Return a JSON object with a "selected_memories" array containing filenames for the memories that will clearly be useful (up to 5). Only include memories that you are certain will be helpful based on their name and description.

- If you are unsure if a memory will be useful, do not include it. Be selective and discerning.
- If there are no memories that would clearly be useful, return an empty array.

Respond ONLY with the JSON object, no other text. Example:
{"selected_memories": ["user_role.md", "feedback_testing.md"]}`;

export async function findRelevantMemories(
	query: string,
	memoryDir: string,
	config: Config,
	signal?: AbortSignal,
): Promise<{ path: string; mtimeMs: number; filename: string }[]> {
	const memories = await scanMemoryFiles(memoryDir, signal);
	if (memories.length === 0) return [];

	const manifest = formatMemoryManifest(memories);

	let outputText = "";
	try {
		const agent = new Agent({
			providerId: config.providerId,
			modelId: config.modelId,
			apiKey: config.apiKey,
			baseUrl: config.baseUrl,
			maxIterations: 1,
			systemPrompt: SELECT_MEMORIES_SYSTEM_PROMPT,
		});
		const result = await agent.run(
			`Query: ${query}\n\nAvailable memories:\n${manifest}`,
		);
		outputText = result.outputText;
	} catch {
		return [];
	}

	let selected: string[] = [];
	try {
		const jsonMatch = outputText.match(/\{[\s\S]*\}/);
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]) as { selected_memories?: unknown };
			if (Array.isArray(parsed.selected_memories)) {
				selected = parsed.selected_memories.filter(
					(f): f is string => typeof f === "string",
				);
			}
		}
	} catch {
		return [];
	}

	const validFilenames = new Set(memories.map((m) => m.filename));
	const byFilename = new Map(memories.map((m) => [m.filename, m]));

	return selected
		.filter((f) => validFilenames.has(f))
		.map((f) => byFilename.get(f)!)
		.map((m) => ({ path: m.filePath, mtimeMs: m.mtimeMs, filename: m.filename }));
}

export async function buildRecallInjection(
	query: string,
	memoryDir: string,
	config: Config,
	signal?: AbortSignal,
): Promise<string> {
	const relevant = await findRelevantMemories(query, memoryDir, config, signal);
	if (relevant.length === 0) return "";

	const parts: string[] = [];
	for (const mem of relevant) {
		try {
			const content = await readFile(mem.path, "utf-8");
			const freshnessNote = buildFreshnessNote(mem.mtimeMs);
			parts.push(
				`<system-reminder>\n${freshnessNote}Relevant memory from ${mem.filename}:\n\n${content}\n</system-reminder>`,
			);
		} catch {
			// Skip unreadable files
		}
	}
	return parts.join("\n\n");
}

function buildFreshnessNote(mtimeMs: number): string {
	const days = Math.max(0, Math.floor((Date.now() - mtimeMs) / 86_400_000));
	if (days <= 1) return "";
	return `Note: This memory is ${days} days old. Claims about code behavior or file:line citations may be outdated. Verify against current state before asserting as fact.\n`;
}
