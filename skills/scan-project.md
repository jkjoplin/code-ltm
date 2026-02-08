# /scan-project

Quickly analyze this project and record key learnings to help future Claude sessions work more effectively.

## Instructions

Perform a **lightweight scan** of the project - don't read entire codebases. Focus on high-signal files that reveal project conventions.

### Step 1: Check for Existing Learnings

First, use `search_learnings` or `list_learnings` with the current project path to see what's already recorded. Skip if the project already has good coverage.

### Step 2: Gather Context (be efficient!)

Read only these key files if they exist:
- `package.json` - dependencies, scripts, project type
- `tsconfig.json` or `jsconfig.json` - TypeScript/JS config
- `README.md` - project purpose and setup (first ~100 lines)
- `CLAUDE.md` or `AGENTS.md` - existing AI instructions

Quickly check the project structure:
- Run `ls -la` at root
- Run `ls src/` or equivalent to understand code organization

**Do NOT** read source code files unless absolutely necessary.

### Step 3: Identify 3-5 Key Learnings

Focus on things that would **save time** for a future session:

1. **Project type & stack** - What framework/runtime? Key dependencies?
2. **Code conventions** - TypeScript strict mode? ESM vs CJS? Test framework?
3. **Development workflow** - How to build, test, run? Important scripts?
4. **Architecture** - How is code organized? Entry points?
5. **Gotchas** - Any non-obvious configuration or setup requirements?

### Step 4: Record Learnings

Use `add_learning` to record each insight:

- Set `scope: "project"` and include `project_path` (current working directory)
- Use type `documentation` for how things work, `pattern` for conventions
- Keep titles scannable (<80 chars), put details in content
- Use 2-4 relevant tags for discoverability
- Set `confidence: "medium"` initially

### Example Output

```
Adding learning: "Project stack: Next.js 14 with TypeScript"
- Type: documentation
- Tags: [nextjs, typescript, react]
- Content: App Router project using TypeScript strict mode. Key scripts: `npm run dev` (development), `npm run build` (production build), `npm test` (Jest tests).

Adding learning: "Source code organization follows feature-based structure"
- Type: pattern
- Tags: [architecture, organization]
- Content: Code in src/ organized by feature (src/features/), shared components in src/components/, API routes in src/app/api/. Each feature has its own components, hooks, and utils.
```

## Token Budget

This skill should complete in **under 10k tokens**. Prioritize:
- Reading small config files over large source files
- Recording fewer, higher-quality learnings
- Stopping early if project is already well-documented
