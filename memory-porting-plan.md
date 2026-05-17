# Memory 기능 이식 계획

Claude Code의 Auto Extract, memdir, Session Memory 세 가지 서브시스템을 다른 coding agent에 이식하는 구체적인 구현 계획서입니다.

---

## 전체 구조 요약

```
[매 응답 후 - Auto Extract]
  대화 → forked LLM subagent → memory/*.md 파일 Write/Edit
  
[매 쿼리 전 - memdir Recall]  
  memory/*.md 파일 목록 → LLM sideQuery로 관련 파일 선택 → context 주입

[주기적 - Session Memory]
  대화 전체 → forked LLM subagent → session_memory.md Edit
  
[컨텍스트 창 초과 시 - compact 연동]
  session_memory.md → compact 요약으로 재활용 (LLM 호출 절약)
```

---

## 파일 구조 (구현 후 기준)

```
~/.agent/                          # agent config home
  projects/
    <sanitized-cwd>/               # ex: -home-user-myproject
      memory/
        MEMORY.md                  # 인덱스 (항상 시스템 프롬프트에 포함)
        user_role.md               # 개별 memory 파일들
        feedback_testing.md
        project_deadline.md
        ...
  session-memory/
    <session-id>/
      session_memory.md            # 세션 요약 파일
    config/
      template.md                  # (선택) 커스텀 템플릿
      prompt.md                    # (선택) 커스텀 추출 프롬프트
```

---

## Phase 1: memdir (읽기/쓰기 기반)

**목적:** 메모리 파일 스캔, 관련 파일 선택, 시스템 프롬프트 주입

### 1-1. Memory 파일 형식 정의

모든 메모리 파일은 frontmatter를 가진 마크다운입니다.

```markdown
---
name: user-role-data-scientist
description: 사용자는 데이터 과학자이며, 현재 로깅/관찰성 관련 작업 중
metadata:
  type: user
---

사용자는 데이터 과학자다. Python과 SQL에 능숙하고, 현재 이 프로젝트의 로깅 시스템을 개선하는 작업을 맡고 있다.
```

**메모리 타입 (4가지):**

| 타입 | 저장 기준 |
|------|----------|
| `user` | 사용자의 역할, 목표, 지식, 선호 |
| `feedback` | 작업 접근 방식에 대한 교정/확인 (성공 패턴도 포함) |
| `project` | 진행 중 작업, 목표, 마감, 사건 (코드에서 유추 불가한 것) |
| `reference` | 외부 시스템 포인터 (Linear, Slack, 대시보드 URL 등) |

**저장하면 안 되는 것:**
- 코드 패턴, 아키텍처, 파일 경로 (코드 읽으면 알 수 있는 것)
- git history (git log로 알 수 있는 것)
- 디버깅 솔루션 (fix는 코드에, 이유는 커밋 메시지에)
- CLAUDE.md에 이미 있는 내용
- 현재 진행 중 작업, 임시 상태

### 1-2. MEMORY.md 인덱스 형식

```markdown
- [User Role](user_role.md) — 사용자는 데이터 과학자, 로깅 개선 중
- [Feedback Testing](feedback_testing.md) — DB mocking 금지: prod 마이그레이션 실패 경험
- [Project Deadline](project_deadline.md) — 2026-06-01 릴리스 브랜치 컷 예정
```

**제약:**
- 최대 200줄 (초과 시 잘림 경고 추가)
- 최대 25,000 bytes
- 각 항목은 한 줄, ~150자 이내

### 1-3. 디렉터리 경로 계산

```python
def get_auto_mem_path(cwd: str, config_home: str = "~/.agent") -> str:
    """
    메모리 디렉터리 경로 계산.
    worktree들이 같은 git root를 공유하도록 canonical git root 사용.
    """
    import os
    from pathlib import Path
    
    config_home = os.path.expanduser(config_home)
    
    # git root 찾기 (없으면 cwd 사용)
    git_root = find_canonical_git_root(cwd) or cwd
    
    # 경로를 파일시스템 안전한 이름으로 변환: "/" → "-"
    sanitized = git_root.replace("/", "-").replace("\\", "-").lstrip("-")
    
    return os.path.join(config_home, "projects", sanitized, "memory") + os.sep
```

```typescript
// TypeScript 버전
function getAutoMemPath(): string {
  const base = process.env.AGENT_CONFIG_HOME ?? join(homedir(), '.agent')
  const gitRoot = findCanonicalGitRoot(getProjectRoot()) ?? getProjectRoot()
  const sanitized = gitRoot.replace(/[/\\]/g, '-').replace(/^-+/, '')
  return join(base, 'projects', sanitized, 'memory') + sep
}
```

### 1-4. scanMemoryFiles() 구현

```typescript
type MemoryHeader = {
  filename: string    // MEMORY.md 기준 상대경로
  filePath: string    // 절대경로
  mtimeMs: number
  description: string | null
  type: 'user' | 'feedback' | 'project' | 'reference' | undefined
}

const MAX_MEMORY_FILES = 200
const FRONTMATTER_MAX_LINES = 30  // frontmatter 파싱은 상위 30줄만

async function scanMemoryFiles(
  memoryDir: string,
  signal: AbortSignal,
): Promise<MemoryHeader[]> {
  try {
    // recursive readdir로 서브디렉터리까지 스캔
    const entries = await readdir(memoryDir, { recursive: true })
    const mdFiles = entries.filter(
      f => f.endsWith('.md') && basename(f) !== 'MEMORY.md'
    )

    const results = await Promise.allSettled(
      mdFiles.map(async (relativePath): Promise<MemoryHeader> => {
        const filePath = join(memoryDir, relativePath)
        // 전체 파일 읽지 않고 상위 N줄만 읽어 frontmatter 파싱
        const { content, mtimeMs } = await readFileInRange(
          filePath, 0, FRONTMATTER_MAX_LINES, undefined, signal
        )
        const { frontmatter } = parseFrontmatter(content, filePath)
        return {
          filename: relativePath,
          filePath,
          mtimeMs,
          description: frontmatter.description || null,
          type: parseMemoryType(frontmatter.type),
        }
      })
    )

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value)
      .sort((a, b) => b.mtimeMs - a.mtimeMs)  // 최신순
      .slice(0, MAX_MEMORY_FILES)
  } catch {
    return []
  }
}

// MEMORY.md 인덱스 표시용 포맷
function formatMemoryManifest(memories: MemoryHeader[]): string {
  return memories.map(m => {
    const tag = m.type ? `[${m.type}] ` : ''
    const ts = new Date(m.mtimeMs).toISOString()
    return m.description
      ? `- ${tag}${m.filename} (${ts}): ${m.description}`
      : `- ${tag}${m.filename} (${ts})`
  }).join('\n')
}
```

**핵심 설계 결정:** `Promise.allSettled` 사용 → 일부 파일 읽기 실패해도 나머지는 정상 반환.

### 1-5. findRelevantMemories() 구현

쿼리와 관련된 메모리를 **LLM sideQuery**로 선택합니다.

```typescript
const SELECT_MEMORIES_SYSTEM_PROMPT = `You are selecting memories that will be useful to an AI assistant as it processes a user's query. You will be given the user's query and a list of available memory files with their filenames and descriptions.

Return a list of filenames for the memories that will clearly be useful (up to 5). Only include memories that you are certain will be helpful based on their name and description.
- If you are unsure if a memory will be useful, do not include it. Be selective and discerning.
- If there are no memories that would clearly be useful, return an empty list.
- If recently-used tools are provided, do not select usage reference memories for those tools (the agent is already using them). DO still select memories containing warnings or known issues.`

async function findRelevantMemories(
  query: string,
  memoryDir: string,
  signal: AbortSignal,
  recentTools: string[] = [],
  alreadySurfaced: Set<string> = new Set(),
): Promise<{ path: string; mtimeMs: number }[]> {
  const memories = (await scanMemoryFiles(memoryDir, signal))
    .filter(m => !alreadySurfaced.has(m.filePath))
  
  if (memories.length === 0) return []

  const manifest = formatMemoryManifest(memories)
  const toolsSection = recentTools.length > 0
    ? `\n\nRecently used tools: ${recentTools.join(', ')}`
    : ''

  // Sonnet 계열 모델로 빠르게 선택
  const result = await sideQuery({
    model: 'claude-sonnet-4-5',  // 빠른 선택을 위해 Sonnet 사용
    system: SELECT_MEMORIES_SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Query: ${query}\n\nAvailable memories:\n${manifest}${toolsSection}`,
    }],
    max_tokens: 256,
    output_format: {
      type: 'json_schema',
      schema: {
        type: 'object',
        properties: {
          selected_memories: { type: 'array', items: { type: 'string' } },
        },
        required: ['selected_memories'],
      },
    },
    signal,
  })

  const selected: string[] = result.selected_memories ?? []
  const validFilenames = new Set(memories.map(m => m.filename))
  const byFilename = new Map(memories.map(m => [m.filename, m]))

  return selected
    .filter(f => validFilenames.has(f))
    .map(f => byFilename.get(f)!)
    .map(m => ({ path: m.filePath, mtimeMs: m.mtimeMs }))
}
```

### 1-6. 시스템 프롬프트 주입 (세션 시작 시)

```typescript
// MEMORY.md를 시스템 프롬프트에 항상 포함
async function buildMemorySystemPrompt(memoryDir: string): Promise<string> {
  const entrypoint = join(memoryDir, 'MEMORY.md')
  let indexContent = ''
  try {
    indexContent = await readFile(entrypoint, 'utf-8')
  } catch { /* 아직 없으면 빈 상태 */ }

  const { content: truncated } = truncateEntrypoint(indexContent)
  
  return `# Auto Memory

You have a persistent, file-based memory system at \`${memoryDir}\`. This directory already exists — write to it directly.

You should build up this memory system over time so that future conversations can have a complete picture of who the user is, how they'd like to collaborate with you, what behaviors to avoid or repeat, and the context behind the work.

## Memory types

- **user**: User role, goals, preferences, knowledge
- **feedback**: Guidance on how to approach work (both corrections AND confirmed successes)
- **project**: Ongoing work context not derivable from code or git history
- **reference**: Pointers to external systems (dashboards, issue trackers, Slack channels)

## What NOT to save

- Code patterns, architecture, file paths — derivable by reading code
- Git history — use \`git log\` / \`git blame\`
- Anything in CLAUDE.md files
- Ephemeral task details or in-progress work state

## How to save memories

**Step 1** — write to its own file using this frontmatter:
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

## When to access memories
- When memories seem relevant, or the user references prior-conversation work
- You MUST access memory when the user explicitly asks you to check or remember something
- Memory records can become stale — verify against current code before asserting as fact

## MEMORY.md

${truncated || 'Your MEMORY.md is currently empty. When you save new memories, they will appear here.'}
`
}

function truncateEntrypoint(raw: string): { content: string; truncated: boolean } {
  const MAX_LINES = 200
  const MAX_BYTES = 25_000
  const trimmed = raw.trim()
  const lines = trimmed.split('\n')
  
  if (lines.length <= MAX_LINES && trimmed.length <= MAX_BYTES) {
    return { content: trimmed, truncated: false }
  }
  
  let result = lines.slice(0, MAX_LINES).join('\n')
  if (result.length > MAX_BYTES) {
    const cutAt = result.lastIndexOf('\n', MAX_BYTES)
    result = result.slice(0, cutAt > 0 ? cutAt : MAX_BYTES)
  }
  return {
    content: result + '\n\n> WARNING: MEMORY.md truncated. Keep index entries concise.',
    truncated: true,
  }
}
```

### 1-7. 쿼리 전 메모리 recall 주입

```typescript
// 매 쿼리 처리 전 호출
async function injectRelevantMemories(
  userQuery: string,
  messages: Message[],
  memoryDir: string,
  signal: AbortSignal,
): Promise<void> {
  const relevant = await findRelevantMemories(
    userQuery,
    memoryDir,
    signal,
    getRecentToolNames(messages),  // 최근 사용 툴 이름들
  )
  
  for (const mem of relevant) {
    const content = await readFile(mem.path, 'utf-8')
    const freshnessNote = memoryFreshnessNote(mem.mtimeMs)
    
    // system-reminder 형식으로 context에 주입
    messages.push({
      role: 'user',
      content: `<system-reminder>
${freshnessNote}Relevant memory from ${mem.path}:

${content}
</system-reminder>`,
    })
  }
}

// 메모리 신선도 caveat (1일 이상 오래된 메모리에만 표시)
function memoryFreshnessNote(mtimeMs: number): string {
  const days = Math.max(0, Math.floor((Date.now() - mtimeMs) / 86_400_000))
  if (days <= 1) return ''
  return `<system-reminder>This memory is ${days} days old. Claims about code behavior or file:line citations may be outdated. Verify against current code before asserting as fact.</system-reminder>\n`
}
```

---

## Phase 2: Auto Extract (자동 메모리 추출)

**목적:** 매 응답 완료 후 백그라운드에서 대화를 분석해 가치 있는 내용을 메모리 파일로 저장

### 2-1. 트리거 조건

```typescript
// stopHooks.ts (쿼리 루프 종료 hook)에서 호출
async function handleQueryComplete(context: QueryContext): Promise<void> {
  // 메인 에이전트만 (서브에이전트 제외)
  if (context.agentId) return
  
  // 배치/스크립트 모드 제외
  if (isBareMode()) return
  
  // 메인 에이전트가 이미 메모리 파일에 직접 Write/Edit했으면 스킵
  if (hasMemoryWritesSince(context.messages, lastMemoryMessageUuid)) {
    lastMemoryMessageUuid = getLastMessageUuid(context.messages)
    return
  }
  
  // fire-and-forget
  void executeExtractMemories(context)
}
```

### 2-2. 중복 방지 로직

```typescript
// 메인 에이전트가 직접 메모리 파일을 Write/Edit했는지 확인
function hasMemoryWritesSince(
  messages: Message[],
  sinceUuid: string | undefined,
): boolean {
  let foundStart = sinceUuid === undefined
  
  for (const message of messages) {
    if (!foundStart) {
      if (message.uuid === sinceUuid) foundStart = true
      continue
    }
    if (message.type !== 'assistant') continue
    
    for (const block of message.content ?? []) {
      const filePath = getWrittenFilePath(block)
      if (filePath && isAutoMemPath(filePath)) return true
    }
  }
  return false
}

// Write/Edit tool_use 블록에서 file_path 추출
function getWrittenFilePath(block: ContentBlock): string | undefined {
  if (block.type !== 'tool_use') return undefined
  if (block.name !== 'Write' && block.name !== 'Edit') return undefined
  const input = block.input
  if (typeof input?.file_path === 'string') return input.file_path
  return undefined
}
```

### 2-3. 쓰로틀링 (N턴마다 1회)

```typescript
// 클로저 내 상태
let turnsSinceLastExtraction = 0
const EXTRACTION_INTERVAL = 1  // 기본: 매 턴 (설정 가능)

async function runExtraction(context: QueryContext): Promise<void> {
  turnsSinceLastExtraction++
  if (turnsSinceLastExtraction < EXTRACTION_INTERVAL) return
  turnsSinceLastExtraction = 0
  
  // 실제 추출 실행
  await doExtraction(context)
}
```

### 2-4. Tool 권한 제어

추출 에이전트는 제한된 툴만 사용할 수 있습니다.

```typescript
function createAutoMemCanUseTool(memoryDir: string): CanUseToolFn {
  return async (tool: Tool, input: Record<string, unknown>) => {
    // Read, Grep, Glob: 항상 허용 (읽기 전용)
    if (['Read', 'Grep', 'Glob'].includes(tool.name)) {
      return { behavior: 'allow', updatedInput: input }
    }
    
    // Bash: 읽기 전용 명령만 허용 (ls, find, cat, stat, wc, head, tail)
    if (tool.name === 'Bash') {
      if (isReadOnlyBashCommand(input.command as string)) {
        return { behavior: 'allow', updatedInput: input }
      }
      return {
        behavior: 'deny',
        message: 'Only read-only shell commands are permitted (ls, find, grep, cat, stat, wc, head, tail)',
      }
    }
    
    // Write/Edit: memory 디렉터리 내부 경로만 허용
    if (['Write', 'Edit'].includes(tool.name)) {
      const filePath = input.file_path as string
      if (typeof filePath === 'string' && isAutoMemPath(filePath)) {
        return { behavior: 'allow', updatedInput: input }
      }
    }
    
    // 나머지 모든 툴 거부 (MCP, Agent 등)
    return {
      behavior: 'deny',
      message: `Tool ${tool.name} is not allowed in memory extraction context`,
    }
  }
}

function isReadOnlyBashCommand(command: string): boolean {
  const trimmed = command.trim()
  const READONLY_PREFIXES = ['ls', 'find', 'grep', 'cat', 'stat', 'wc', 'head', 'tail', 'echo', 'pwd', 'which', 'file']
  return READONLY_PREFIXES.some(prefix => 
    trimmed === prefix || trimmed.startsWith(prefix + ' ')
  )
}
```

### 2-5. 추출 프롬프트

```typescript
function buildExtractPrompt(
  newMessageCount: number,
  existingMemories: string,
): string {
  const manifest = existingMemories.length > 0
    ? `\n\n## Existing memory files\n\n${existingMemories}\n\nCheck this list before writing — update an existing file rather than creating a duplicate.`
    : ''

  return `You are now acting as the memory extraction subagent. Analyze the most recent ~${newMessageCount} messages above and use them to update your persistent memory systems.

Available tools: Read, Grep, Glob, read-only Bash (ls/find/cat/stat/wc/head/tail), and Write/Edit for paths inside the memory directory only. All other tools will be denied.

You have a limited turn budget. Edit requires a prior Read of the same file, so the efficient strategy is: turn 1 — issue all Read calls in parallel for every file you might update; turn 2 — issue all Write/Edit calls in parallel. Do not interleave reads and writes across multiple turns.

You MUST only use content from the last ~${newMessageCount} messages to update your persistent memories. Do not investigate or verify that content further — no grepping source files, no reading code to confirm patterns, no git commands.${manifest}

If the user explicitly asks you to remember something, save it immediately as whichever type fits best.

## Memory types

- **user**: User role, goals, preferences — ALWAYS private
- **feedback**: Guidance on approach. Record corrections AND confirmed successes.
  - Lead with the rule itself
  - **Why:** reason the user gave
  - **How to apply:** when/where this kicks in
- **project**: Ongoing work context not in code/git. Convert relative dates to absolute.
  - Lead with the fact/decision
  - **Why:** motivation (constraint, deadline, stakeholder ask)
  - **How to apply:** how this should shape suggestions
- **reference**: Pointers to external systems

## What NOT to save

- Code patterns, architecture, file paths (derivable by reading code)
- Git history (use git log/blame)
- Anything already in CLAUDE.md files
- Ephemeral task details or in-progress work state

If asked to save a PR list or activity summary, ask what was *surprising* or *non-obvious* — that is the part worth keeping.

## How to save memories

**Step 1** — write to its own file:
\`\`\`markdown
---
name: <short-kebab-case-slug>
description: <one-line — used to decide relevance in future conversations, so be specific>
metadata:
  type: <user|feedback|project|reference>
---

<memory content>
\`\`\`

**Step 2** — add a pointer to MEMORY.md:
\`- [Title](file.md) — one-line hook\` (under ~150 chars)

- Update or remove memories that turn out to be wrong or outdated
- Do not write duplicate memories — check existing files first
`
}
```

### 2-6. forked agent 실행

```typescript
// 클로저 스코프 상태
let lastMemoryMessageUuid: string | undefined
let inProgress = false
let pendingContext: QueryContext | undefined

async function executeExtractMemories(context: QueryContext): Promise<void> {
  const memoryDir = getAutoMemPath()
  const newMessageCount = countModelVisibleMessagesSince(
    context.messages, lastMemoryMessageUuid
  )
  
  if (inProgress) {
    // 진행 중이면 최신 context를 stash해두고 trailing run으로 처리
    pendingContext = context
    return
  }
  
  inProgress = true
  try {
    // 이미 존재하는 메모리 파일 목록을 미리 주입 (에이전트가 ls에 턴 낭비 방지)
    const existingMemories = formatMemoryManifest(
      await scanMemoryFiles(memoryDir, new AbortController().signal)
    )
    
    const prompt = buildExtractPrompt(newMessageCount, existingMemories)
    
    const result = await runForkedAgent({
      // 메인 대화의 시스템 프롬프트 + 메시지를 그대로 포크해서 prompt cache 공유
      systemPrompt: context.systemPrompt,
      messages: [...context.messages, { role: 'user', content: prompt }],
      canUseTool: createAutoMemCanUseTool(memoryDir),
      maxTurns: 5,  // 2-4턴이면 충분 (read → write)
    })
    
    // 커서 전진 (성공 시에만)
    lastMemoryMessageUuid = getLastMessageUuid(context.messages)
    
    // 저장된 파일 경로 추출 → UI 알림
    const writtenPaths = extractWrittenPaths(result.messages)
      .filter(p => basename(p) !== 'MEMORY.md')  // 인덱스 업데이트는 알림 제외
    
    if (writtenPaths.length > 0) {
      context.appendSystemMessage?.({ type: 'memory_saved', paths: writtenPaths })
    }
  } catch (error) {
    // best-effort: 오류 로깅만, 사용자에게 노출 안 함
    logDebug(`[extractMemories] error: ${error}`)
  } finally {
    inProgress = false
    
    // trailing run: stash된 context가 있으면 후속 추출 실행
    const trailing = pendingContext
    pendingContext = undefined
    if (trailing) {
      await executeExtractMemories(trailing)
    }
  }
}

// model-visible 메시지 수 계산 (user/assistant 타입만)
function countModelVisibleMessagesSince(
  messages: Message[],
  sinceUuid: string | undefined,
): number {
  if (!sinceUuid) {
    return messages.filter(m => m.role === 'user' || m.role === 'assistant').length
  }
  let foundStart = false
  let count = 0
  for (const m of messages) {
    if (!foundStart) {
      if (m.uuid === sinceUuid) foundStart = true
      continue
    }
    if (m.role === 'user' || m.role === 'assistant') count++
  }
  return foundStart ? count : messages.filter(m => m.role === 'user' || m.role === 'assistant').length
}
```

### 2-7. 초기화 및 drain

```typescript
// 세션 시작 시 한 번 호출 (backgroundHousekeeping)
export function initExtractMemories(): void {
  // 클로저 상태 초기화 (위 2-6 참조)
  lastMemoryMessageUuid = undefined
  inProgress = false
  pendingContext = undefined
  turnsSinceLastExtraction = 0
}

// 세션 종료 직전 pending 추출 완료 대기 (최대 60초)
export async function drainPendingExtraction(timeoutMs = 60_000): Promise<void> {
  // inFlightExtractions Set을 관리하며 모두 완료될 때까지 대기
  if (inFlightExtractions.size === 0) return
  await Promise.race([
    Promise.all(inFlightExtractions),
    new Promise<void>(r => setTimeout(r, timeoutMs).unref()),
  ])
}
```

---

## Phase 3: Session Memory (세션 내 지속 메모장)

**목적:** 대화가 길어져도 초반 맥락을 잃지 않도록 세션 요약 파일을 주기적으로 업데이트

### 3-1. 파일 위치

```
~/.agent/session-memory/<session-id>/session_memory.md
```

`session-id`는 세션 시작 시 생성되는 고유 식별자입니다.

### 3-2. 템플릿 (DEFAULT_SESSION_MEMORY_TEMPLATE)

```markdown
# Session Title
_A short and distinctive 5-10 word descriptive title for the session. Super info dense, no filler_

# Current State
_What is actively being worked on right now? Pending tasks not yet completed. Immediate next steps._

# Task specification
_What did the user ask to build? Any design decisions or other explanatory context_

# Files and Functions
_What are the important files? In short, what do they contain and why are they relevant?_

# Workflow
_What bash commands are usually run and in what order? How to interpret their output if not obvious?_

# Errors & Corrections
_Errors encountered and how they were fixed. What did the user correct? What approaches failed and should not be tried again?_

# Codebase and System Documentation
_What are the important system components? How do they work/fit together?_

# Learnings
_What has worked well? What has not? What to avoid? Do not duplicate items from other sections_

# Key results
_If the user asked a specific output such as an answer to a question, a table, or other document, repeat the exact result here_

# Worklog
_Step by step, what was attempted, done? Very terse summary for each step_
```

커스텀 템플릿은 `~/.agent/session-memory/config/template.md`에 배치하면 자동으로 로드됩니다.

### 3-3. 추출 트리거 조건 (중요: 3가지 모두 충족 시)

```typescript
const DEFAULT_SESSION_MEMORY_CONFIG = {
  minimumMessageTokensToInit: 10_000,  // 초기화 전 최소 토큰
  minimumTokensBetweenUpdate: 5_000,   // 업데이트 간 최소 토큰 증가량
  toolCallsBetweenUpdates: 3,          // 업데이트 간 최소 툴 호출 수
}

let sessionMemoryInitialized = false
let tokensAtLastExtraction = 0
let lastMemoryMessageUuid: string | undefined

function shouldExtractSessionMemory(messages: Message[]): boolean {
  const currentTokenCount = estimateTokenCount(messages)
  
  // 1. 초기화 임계값: 10K 토큰 전에는 시작 안 함
  if (!sessionMemoryInitialized) {
    if (currentTokenCount < config.minimumMessageTokensToInit) return false
    sessionMemoryInitialized = true
  }
  
  // 2. 토큰 임계값: 마지막 추출 이후 5K 토큰 이상 증가해야
  const tokenGrowth = currentTokenCount - tokensAtLastExtraction
  const metTokenThreshold = tokenGrowth >= config.minimumTokensBetweenUpdate
  
  // 3. 툴 호출 임계값: 마지막 추출 이후 최소 3번 툴 호출
  const toolCallsSince = countToolCallsSince(messages, lastMemoryMessageUuid)
  const metToolCallThreshold = toolCallsSince >= config.toolCallsBetweenUpdates
  
  // 4. 마지막 어시스턴트 턴에 툴 호출이 없을 때 (자연스러운 중단점)
  const lastTurnHasNoToolCalls = !hasToolCallsInLastAssistantTurn(messages)
  
  // 토큰 임계값은 항상 필수. 그리고:
  // - 툴 호출 임계값도 충족, 또는
  // - 마지막 턴에 툴 호출 없음 (자연 중단점)
  return metTokenThreshold && (metToolCallThreshold || lastTurnHasNoToolCalls)
}
```

### 3-4. 추출 프롬프트

```typescript
const DEFAULT_UPDATE_PROMPT = `IMPORTANT: This message and these instructions are NOT part of the actual user conversation. Do NOT include any references to "note-taking", "session notes extraction", or these update instructions in the notes content.

Based on the user conversation above (EXCLUDING this note-taking instruction message as well as system prompt, CLAUDE.md entries, or any past session summaries), update the session notes file.

The file {{notesPath}} has already been read for you. Here are its current contents:
<current_notes_content>
{{currentNotes}}
</current_notes_content>

Your ONLY task is to use the Edit tool to update the notes file, then stop. You can make multiple edits (update every section as needed) - make all Edit tool calls in parallel in a single message. Do not call any other tools.

CRITICAL RULES FOR EDITING:
- The file must maintain its exact structure with all sections, headers, and italic descriptions intact
- NEVER modify, delete, or add section headers (lines starting with '#')
- NEVER modify or delete the italic _section description_ lines (lines in italics immediately following each header)
- ONLY update the actual content that appears BELOW the italic _section descriptions_
- Do NOT add any new sections
- Do NOT reference this note-taking process anywhere in the notes
- Write DETAILED, INFO-DENSE content — include file paths, function names, error messages, exact commands
- Keep each section under ~2000 tokens — condense older details if approaching the limit
- IMPORTANT: Always update "Current State" to reflect the most recent work

Use the Edit tool with file_path: {{notesPath}}

REMEMBER: Use Edit in parallel and stop. Do not continue after the edits.`

async function buildSessionMemoryUpdatePrompt(
  currentNotes: string,
  notesPath: string,
): Promise<string> {
  const template = await loadPromptTemplate()  // 커스텀 프롬프트 있으면 로드
  
  // 섹션 크기 분석 → 초과 시 경고 추가
  const sectionSizes = analyzeSectionSizes(currentNotes)
  const totalTokens = estimateTokens(currentNotes)
  const warnings = buildSizeWarnings(sectionSizes, totalTokens)
  
  return template
    .replace('{{notesPath}}', notesPath)
    .replace('{{currentNotes}}', currentNotes)
    + warnings
}
```

### 3-5. 추출 실행

```typescript
async function executeSessionMemoryExtraction(
  context: QueryContext,
): Promise<void> {
  const notesPath = getSessionMemoryPath(context.sessionId)
  const notesDir = dirname(notesPath)
  
  // 디렉터리 생성 (mode 0o700: 소유자만 접근)
  await mkdir(notesDir, { recursive: true, mode: 0o700 })
  
  // 파일이 없으면 템플릿으로 초기화
  let currentNotes: string
  try {
    currentNotes = await readFile(notesPath, 'utf-8')
  } catch {
    const template = await loadSessionMemoryTemplate()
    await writeFile(notesPath, template, { encoding: 'utf-8', mode: 0o600 })
    currentNotes = template
  }
  
  const prompt = await buildSessionMemoryUpdatePrompt(currentNotes, notesPath)
  
  markExtractionStarted()
  try {
    await runForkedAgent({
      systemPrompt: context.systemPrompt,
      messages: [...context.messages, { role: 'user', content: prompt }],
      canUseTool: createSessionMemoryCanUseTool(notesPath),
      maxTurns: 3,  // Read + Edit(s) = 최대 2턴이면 충분
    })
    
    // 커서 업데이트 (compact 연동용)
    setLastSummarizedMessageId(getLastMessageUuid(context.messages))
    recordExtractionTokenCount(estimateTokenCount(context.messages))
  } finally {
    markExtractionCompleted()
  }
}

// Session Memory 전용 canUseTool: notesPath 파일만 Edit 허용
function createSessionMemoryCanUseTool(notesPath: string): CanUseToolFn {
  return async (tool, input) => {
    if (tool.name === 'Read' && input.file_path === notesPath) {
      return { behavior: 'allow', updatedInput: input }
    }
    if (tool.name === 'Edit' && input.file_path === notesPath) {
      return { behavior: 'allow', updatedInput: input }
    }
    return { behavior: 'deny', message: 'Only editing the session notes file is allowed' }
  }
}
```

### 3-6. Compact 연동 (선택 구현)

Session Memory가 쌓여 있으면, compact 시 LLM 호출 없이 이를 재활용합니다.

```typescript
async function trySessionMemoryCompaction(
  messages: Message[],
): Promise<CompactionResult | null> {
  // compact 연동 기능이 비활성화된 경우
  if (!isSessionMemoryCompactEnabled()) return null
  
  // 추출 완료 대기 (최대 15초)
  await waitForSessionMemoryExtraction()
  
  const sessionMemory = await readSessionMemory()
  if (!sessionMemory || isSessionMemoryEmpty(sessionMemory)) return null
  
  const lastSummarizedId = getLastSummarizedMessageId()
  if (!lastSummarizedId) return null
  
  const lastSummarizedIndex = messages.findIndex(m => m.uuid === lastSummarizedId)
  if (lastSummarizedIndex === -1) return null
  
  // 최소 10K~40K 토큰 범위의 최신 메시지 보존
  const keepStartIndex = calculateMessagesToKeep(messages, lastSummarizedIndex)
  const messagesToKeep = messages.slice(keepStartIndex)
  
  // Session Memory를 compact 요약으로 사용
  return {
    summary: sessionMemory,
    messagesToKeep,
    // compact API 호출 없이 생성됨
  }
}
```

---

## Phase 4: 통합 연결 (Integration)

### 4-1. 세션 시작 시 초기화 순서

```typescript
async function onSessionStart(): Promise<void> {
  // 1. memdir 준비
  const memoryDir = getAutoMemPath()
  await ensureDir(memoryDir)
  
  // 2. Auto Extract 초기화 (클로저 상태 리셋)
  initExtractMemories()
  
  // 3. Session Memory 상태 리셋
  resetSessionMemoryState()
  
  // 4. 시스템 프롬프트 구성 (MEMORY.md 인덱스 포함)
  const memorySection = await buildMemorySystemPrompt(memoryDir)
  systemPrompt = baseSystemPrompt + '\n\n' + memorySection
}
```

### 4-2. 매 쿼리 처리 흐름

```typescript
async function handleQuery(userMessage: string): Promise<void> {
  // 1. [쿼리 전] 관련 메모리 recall → context 주입
  await injectRelevantMemories(userMessage, messages, memoryDir, signal)
  
  // 2. 모델 응답 생성
  const response = await callLLM(messages)
  messages.push(response)
  
  // 3. [응답 후] Session Memory 추출 조건 확인
  if (shouldExtractSessionMemory(messages)) {
    void executeSessionMemoryExtraction(context)  // fire-and-forget
  }
  
  // 4. [응답 후] Auto Extract 실행 (fire-and-forget)
  void executeExtractMemories(context)
}
```

### 4-3. 세션 종료 시 정리

```typescript
async function onSessionEnd(): Promise<void> {
  // 백그라운드 추출 완료 대기 (응답 출력 후, 프로세스 종료 전)
  await drainPendingExtraction(60_000)
}
```

---

## 의존성 목록

| 기능 | 필요한 것 |
|------|----------|
| scanMemoryFiles | fs.readdir (recursive), YAML frontmatter 파서 |
| findRelevantMemories | LLM sideQuery (structured output 지원), 빠른 Sonnet 계열 모델 |
| Auto Extract | forked LLM subagent, canUseTool 훅 |
| Session Memory | forked LLM subagent, fs.mkdir/readFile/writeFile |
| compact 연동 | 위 Session Memory + compact 파이프라인 |

**frontmatter 파서:** YAML 파서 대신 `---` 구분자 기반 간단한 파서를 직접 구현하는 것을 권장합니다. 전체 파일을 읽지 않고 상위 N줄만 읽어서 파싱해야 하기 때문입니다.

---

## 구현 우선순위

```
Phase 1a: 디렉터리 경로, scanMemoryFiles, MEMORY.md 인덱스 포맷
   ↓
Phase 1b: 시스템 프롬프트에 MEMORY.md 주입 (Claude가 직접 파일 Write 가능)
   ↓
Phase 1c: findRelevantMemories (sideQuery 기반 recall)
   ↓
Phase 2:  Auto Extract (forked agent, canUseTool, cursor)
   ↓
Phase 3:  Session Memory (트리거 조건, 템플릿, 추출 에이전트)
   ↓
Phase 4:  Session Memory ↔ compact 연동 (선택)
```

Phase 1b까지만 구현해도 Claude가 직접 메모리를 쓰고 다음 세션에서 읽는 기본 기능이 동작합니다. Auto Extract는 Claude가 직접 안 쓴 경우를 백그라운드에서 캐치하는 보완재입니다.

---

## 주의사항 및 설계 결정

**1. prompt cache 공유**
forked agent의 핵심 이점은 메인 대화의 prompt cache를 그대로 재사용하는 것입니다. 이를 위해 system prompt와 messages prefix가 메인 대화와 완전히 동일해야 합니다. 추출 지시는 마지막 user message로 붙입니다.

**2. 커서(cursor) 패턴**
`lastMemoryMessageUuid`로 "어디까지 처리했는지"를 추적합니다. 추출 실패 시 커서를 전진시키지 않으면, 다음 턴에서 실패한 메시지들도 재처리됩니다.

**3. stash → trailing run 패턴**
추출 중 새 쿼리가 완료되면 context를 stash해두고, 현재 추출 완료 후 바로 trailing run을 실행합니다. 여러 번 stash되어도 마지막 context만 유효합니다.

**4. 메모리 파일 보안**
Session Memory 파일은 `mode: 0o600`, 디렉터리는 `mode: 0o700`으로 생성합니다.

**5. Auto Extract vs Session Memory 의 중복**
- Auto Extract → **세션 간 지속 기억** (미래 대화에서 recall)
- Session Memory → **세션 내 컨텍스트 유지** (compact 시 활용)

둘은 목적이 다르므로 중복이 아닙니다. 단, Session Memory가 쌓인 경우 Auto Extract 추출 주기를 늘리는 것도 고려할 수 있습니다.

**6. 메모리 파일 staleness**
1일 이상 오래된 메모리를 recall할 때는 staleness caveat를 함께 주입합니다. Claude가 오래된 파일:라인 정보를 사실처럼 단언하는 것을 방지합니다.
