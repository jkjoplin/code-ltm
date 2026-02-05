# Cursor Integration Guide

This guide explains how to set up code-ltm with Cursor IDE.

## Prerequisites

- [Cursor](https://cursor.sh/) installed
- Node.js 20 or later
- code-ltm installed

## Installation

### Option 1: npm (recommended)

```bash
npm install -g code-ltm
```

### Option 2: From source

```bash
git clone https://github.com/jkjoplin/code-ltm.git
cd code-ltm
npm install
npm run build
```

## Configuration

### 1. Open Cursor Settings

1. Open Cursor
2. Go to **Settings** (Cmd/Ctrl + ,)
3. Search for "MCP" or navigate to **Features > MCP Servers**

### 2. Add the MCP server

Click "Add MCP Server" and configure:

**Name:** `code-ltm`

**Command:**
- If installed globally: `code-ltm`
- If using npx: `npx code-ltm`
- If from source: `node /path/to/code-ltm/dist/index.js`

**Arguments:** (leave empty for global install, or add path for source install)

### Alternative: Edit settings.json

You can also edit Cursor's settings directly. Add to your settings:

```json
{
  "mcp.servers": {
    "code-ltm": {
      "command": "code-ltm"
    }
  }
}
```

Or with npx:

```json
{
  "mcp.servers": {
    "code-ltm": {
      "command": "npx",
      "args": ["code-ltm"]
    }
  }
}
```

### 3. Restart Cursor

Restart Cursor for the MCP server to be loaded.

## Verification

After restarting, the Cursor AI assistant should have access to code-ltm tools. Test by asking:

> "What knowledge management tools do you have available?"

## Usage with Cursor

### Recording learnings as you code

When you discover something important while coding, tell Cursor to save it:

> "Add a learning: The `useAuth` hook must be called within AuthProvider context."

> "Record this pattern: We use barrel exports (index.ts) in each component folder."

### Searching before implementing

Before starting a task, ask Cursor to check for relevant knowledge:

> "Search for any learnings about error handling in this project."

> "What do you know about the authentication flow here?"

### Project-specific context

Cursor can retrieve learnings scoped to your current project:

> "List all learnings for this project."

> "Show me the gotchas you've recorded for this codebase."

## Best Practices

### 1. Teach Cursor your patterns

When you establish a pattern, record it:

> "Save as a learning: In this monorepo, shared utilities go in packages/common."

### 2. Record gotchas immediately

When you hit a tricky issue, save it:

> "Add a gotcha: The Stripe webhook handler requires raw body parsing, not JSON."

### 3. Capture investigation results

After debugging, preserve what you learned:

> "Record this investigation: The memory leak was caused by unsubscribed event listeners in useEffect cleanup."

### 4. Use the CLI for bulk operations

```bash
# View stats
code-ltm-cli stats

# Export before major changes
code-ltm-cli export backup.json

# Search from terminal
code-ltm-cli search "authentication"
```

## Configuration Options

Add environment variables to customize behavior:

```json
{
  "mcp.servers": {
    "code-ltm": {
      "command": "code-ltm",
      "env": {
        "CODE_LTM_DB": "/custom/path/to/knowledge.db"
      }
    }
  }
}
```

## Troubleshooting

### MCP server not connecting

1. Verify code-ltm is installed: `code-ltm --help`
2. Check Cursor's MCP server status in settings
3. Restart Cursor completely

### Tools not appearing

1. Ensure the MCP server is enabled in Cursor settings
2. Check that no errors appear in the MCP server logs
3. Try reloading the window (Cmd/Ctrl + Shift + P > "Reload Window")

### Slow responses

If semantic search is slow, ensure Ollama is running:

```bash
ollama serve
```

Or switch to keyword-only search by not using semantic queries.

## Data Sharing

The knowledge database at `~/.code-ltm/knowledge.db` is shared between:

- Cursor
- Claude Desktop
- Claude Code CLI
- Any other MCP client

This means learnings recorded in Cursor are immediately available in Claude Desktop and vice versa.
