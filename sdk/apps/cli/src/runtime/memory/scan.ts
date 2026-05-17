import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

export type MemoryType = "user" | "feedback" | "project" | "reference";

export interface MemoryHeader {
	filename: string;
	filePath: string;
	mtimeMs: number;
	description: string | null;
	type: MemoryType | undefined;
}

const MAX_MEMORY_FILES = 200;
const FRONTMATTER_MAX_LINES = 30;
const MEMORY_TYPES = new Set<string>(["user", "feedback", "project", "reference"]);

export async function scanMemoryFiles(
	memoryDir: string,
	signal?: AbortSignal,
): Promise<MemoryHeader[]> {
	try {
		const entries = await readdir(memoryDir, {
			recursive: true,
			encoding: "utf-8",
		});
		const mdFiles = (entries as string[]).filter(
			(f) => f.endsWith(".md") && basename(f) !== "MEMORY.md",
		);

		const results = await Promise.allSettled(
			mdFiles.map(async (relativePath): Promise<MemoryHeader> => {
				if (signal?.aborted) throw new Error("aborted");
				const filePath = join(memoryDir, relativePath);
				const [content, statResult] = await Promise.all([
					readTopLines(filePath, FRONTMATTER_MAX_LINES),
					stat(filePath),
				]);
				const { description, type } = parseFrontmatter(content);
				return {
					filename: relativePath,
					filePath,
					mtimeMs: statResult.mtimeMs,
					description,
					type,
				};
			}),
		);

		return results
			.filter(
				(r): r is PromiseFulfilledResult<MemoryHeader> =>
					r.status === "fulfilled",
			)
			.map((r) => r.value)
			.sort((a, b) => b.mtimeMs - a.mtimeMs)
			.slice(0, MAX_MEMORY_FILES);
	} catch {
		return [];
	}
}

async function readTopLines(
	filePath: string,
	maxLines: number,
): Promise<string> {
	try {
		const content = await readFile(filePath, "utf-8");
		return content.split("\n").slice(0, maxLines).join("\n");
	} catch {
		return "";
	}
}

function parseFrontmatter(content: string): {
	description: string | null;
	type: MemoryType | undefined;
} {
	const trimmed = content.trim();
	if (!trimmed.startsWith("---")) {
		return { description: null, type: undefined };
	}
	const endIdx = trimmed.indexOf("---", 3);
	if (endIdx === -1) {
		return { description: null, type: undefined };
	}
	const frontmatter = trimmed.slice(3, endIdx);

	const descMatch = frontmatter.match(/^description:\s*(.+)$/m);
	const typeMatch = frontmatter.match(/^\s*type:\s*(\S+)/m);

	const description = descMatch ? descMatch[1].trim() : null;
	const rawType = typeMatch ? typeMatch[1].trim() : undefined;
	const type: MemoryType | undefined = rawType && MEMORY_TYPES.has(rawType)
		? (rawType as MemoryType)
		: undefined;

	return { description, type };
}

export function formatMemoryManifest(memories: MemoryHeader[]): string {
	if (memories.length === 0) return "";
	return memories
		.map((m) => {
			const tag = m.type ? `[${m.type}] ` : "";
			const ts = new Date(m.mtimeMs).toISOString().split("T")[0];
			return m.description
				? `- ${tag}${m.filename} (${ts}): ${m.description}`
				: `- ${tag}${m.filename} (${ts})`;
		})
		.join("\n");
}
