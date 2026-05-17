import { execSync } from "node:child_process";
import { homedir } from "node:os";
import { join, sep } from "node:path";

export function getMemoryDir(cwd: string): string {
	const base = join(homedir(), ".cline", "memory", "projects");
	const gitRoot = findCanonicalGitRoot(cwd) ?? cwd;
	const sanitized = gitRoot.replace(/[/\\]/g, "-").replace(/^-+/, "");
	return join(base, sanitized) + sep;
}

export function getSessionMemoryPath(sessionId: string): string {
	return join(
		homedir(),
		".cline",
		"memory",
		"session",
		sessionId,
		"session_memory.md",
	);
}

function findCanonicalGitRoot(cwd: string): string | undefined {
	try {
		const result = execSync("git rev-parse --show-toplevel", {
			cwd,
			encoding: "utf-8",
			stdio: ["ignore", "pipe", "ignore"],
		});
		return result.trim() || undefined;
	} catch {
		return undefined;
	}
}
