export { getMemoryDir, getSessionMemoryPath } from "./paths";
export { scanMemoryFiles, formatMemoryManifest } from "./scan";
export type { MemoryHeader, MemoryType } from "./scan";
export { buildMemorySystemPrompt } from "./system-prompt";
export { findRelevantMemories, buildRecallInjection } from "./recall";
export {
	initExtractMemories,
	drainPendingExtraction,
	triggerExtractMemories,
} from "./auto-extract";
export type { MemoryExtractionContext } from "./auto-extract";
export {
	resetSessionMemoryState,
	shouldExtractSessionMemory,
	triggerSessionMemoryExtraction,
	buildSessionMemoryInjection,
} from "./session-memory";
