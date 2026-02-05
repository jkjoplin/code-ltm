# Claude Desktop Integration Guide

This guide explains how to set up code-ltm with Claude Desktop.

## Prerequisites

- [Claude Desktop](https://claude.ai/download) installed
- Node.js 20 or later
- code-ltm installed (see Installation below)

## Installation

### Option 1: npm (recommended)

```bash
npm install -g code-ltm
```

### Option 2: Homebrew (macOS)

```bash
brew install jkjoplin/tap/code-ltm
```

### Option 3: From source

```bash
git clone https://github.com/jkjoplin/code-ltm.git
cd code-ltm
npm install
npm run build
```

## Configuration

### 1. Locate the config file

**macOS:**
```
~/Library/Application Support/Claude/claude_desktop_config.json
```

**Windows:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**Linux:**
```
~/.config/Claude/claude_desktop_config.json
```

### 2. Add the MCP server

Edit the config file and add code-ltm to the `mcpServers` section:

**If installed via npm/Homebrew:**

```json
{
  "mcpServers": {
    "code-ltm": {
      "command": "code-ltm"
    }
  }
}
```

**If using npx:**

```json
{
  "mcpServers": {
    "code-ltm": {
      "command": "npx",
      "args": ["code-ltm"]
    }
  }
}
```

**If installed from source:**

```json
{
  "mcpServers": {
    "code-ltm": {
      "command": "node",
      "args": ["/path/to/code-ltm/dist/index.js"]
    }
  }
}
```

### 3. Restart Claude Desktop

Quit and reopen Claude Desktop for the changes to take effect.

## Verification

After restarting, Claude should have access to the code-ltm tools. You can verify by asking Claude:

> "What MCP tools do you have available for knowledge management?"

Claude should mention tools like `add_learning`, `search_learnings`, `list_learnings`, etc.

## Usage

Once configured, Claude can:

- **Record learnings**: When Claude discovers something useful, it can save it for future reference
- **Search knowledge**: Before solving problems, Claude can search for relevant past learnings
- **Build context**: Claude can retrieve project-specific patterns and gotchas

### Example prompts

Ask Claude to record a learning:
> "Save this as a learning: In this project, we use Zod for all API validation schemas."

Ask Claude to search for relevant knowledge:
> "Search your knowledge base for anything related to authentication in this codebase."

List recent learnings:
> "Show me the recent learnings you've recorded for this project."

## Configuration Options

You can customize code-ltm behavior with environment variables:

```json
{
  "mcpServers": {
    "code-ltm": {
      "command": "code-ltm",
      "env": {
        "CODE_LTM_DB": "/custom/path/to/knowledge.db",
        "CODE_LTM_EMBEDDING_PROVIDER": "openai",
        "OPENAI_API_KEY": "sk-..."
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CODE_LTM_DB` | Database file path | `~/.code-ltm/knowledge.db` |
| `CODE_LTM_EMBEDDING_PROVIDER` | `ollama` or `openai` | `ollama` |
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` |
| `OPENAI_API_KEY` | OpenAI API key (if using OpenAI) | - |

## Troubleshooting

### Claude doesn't see the tools

1. Check that the config file is valid JSON
2. Verify the command path is correct
3. Restart Claude Desktop completely (quit, not just close window)
4. Check Claude Desktop logs for errors

### Database errors

Ensure the database directory exists and is writable:

```bash
mkdir -p ~/.code-ltm
```

### Embedding errors

If using Ollama (default), ensure it's running:

```bash
ollama serve
ollama pull nomic-embed-text
```

Or switch to OpenAI by setting the environment variables.

## Data Location

All learnings are stored in a SQLite database at `~/.code-ltm/knowledge.db` by default.

You can:
- Back up this file to preserve your knowledge
- Sync it across machines (e.g., via Dropbox/iCloud)
- Use the CLI to export/import: `code-ltm-cli export backup.json`
