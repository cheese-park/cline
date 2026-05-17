import { readFile } from "node:fs/promises";
import { join } from "node:path";

const MAX_LINES = 200;
const MAX_BYTES = 25_000;

export async function buildMemorySystemPrompt(
	memoryDir: string,
): Promise<string> {
	const entrypoint = join(memoryDir, "MEMORY.md");
	let indexContent = "";
	try {
		indexContent = await readFile(entrypoint, "utf-8");
	} catch {
		// Not created yet — Claude will create it on first memory save
	}

	const { content, truncated } = truncateMemoryIndex(indexContent);
	const indexSection = truncated
		? content
		: content ||
			"Your MEMORY.md is currently empty. When you save new memories, they will appear here.";

	return `# Auto Memory

You have a persistent, file-based memory system at \`${memoryDir}\`. This directory already exists — write to it directly.

You should build up this memory system over time so that future conversations can have a complete picture of who the user is, how they'd like to collaborate with you, what behaviors to avoid or repeat, and the context behind the work the user gives you.

If the user explicitly asks you to remember something, save it immediately as whichever type fits best. If they ask you to forget something, find and remove the relevant entry.

## Types of memory

- **user**: User role, goals, preferences, knowledge. Tailor your future behavior to the user.
- **feedback**: Guidance on how to approach work — both corrections AND confirmed successes. Lead with the rule, then **Why:** and **How to apply:** lines.
- **project**: Ongoing work, goals, deadlines, incidents not derivable from code/git. Lead with the fact, then **Why:** and **How to apply:** lines. Convert relative dates to absolute dates.
- **reference**: Pointers to external systems (issue trackers, dashboards, Slack channels).

## What NOT to save in memory

- Code patterns, conventions, architecture, file paths — derivable by reading code
- Git history — \`git log\` / \`git blame\` are authoritative
- Debugging solutions — the fix is in the code; context goes in commit messages
- Ephemeral task details, in-progress work state, or current conversation context

## How to save memories

**Step 1** — write the memory to its own file using this frontmatter:

\`\`\`markdown
---
name: <short-kebab-case-slug>
description: <one-line summary — used to decide relevance in future conversations, so be specific>
metadata:
  type: <user|feedback|project|reference>
---

<memory content>
\`\`\`

**Step 2** — add a pointer to \`MEMORY.md\`:
\`- [Title](file.md) — one-line hook\` (under ~150 chars per entry)

- \`MEMORY.md\` is always loaded into context — keep it concise (max 200 lines)
- Update or remove memories that turn out to be wrong or outdated
- Do not write duplicate memories — check existing files first

## When to access memories
- When memories seem relevant, or the user references prior-conversation work
- You MUST access memory when the user explicitly asks you to check, recall, or remember
- Memory records can become stale — verify against current state before asserting as fact

## MEMORY.md

${indexSection}`;
}

export function truncateMemoryIndex(raw: string): {
	content: string;
	truncated: boolean;
} {
	const trimmed = raw.trim();
	if (!trimmed) return { content: "", truncated: false };

	const lines = trimmed.split("\n");
	if (lines.length <= MAX_LINES && trimmed.length <= MAX_BYTES) {
		return { content: trimmed, truncated: false };
	}

	let result = lines.slice(0, MAX_LINES).join("\n");
	if (result.length > MAX_BYTES) {
		const cutAt = result.lastIndexOf("\n", MAX_BYTES);
		result = result.slice(0, cutAt > 0 ? cutAt : MAX_BYTES);
	}
	return {
		content:
			result +
			"\n\n> WARNING: MEMORY.md truncated. Keep index entries concise.",
		truncated: true,
	};
}
