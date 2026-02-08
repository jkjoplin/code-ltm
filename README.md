# Code LTM

A knowledge management system for AI coding agents to record, share, and retrieve learnings across projects.

## Installation

### From npm (recommended)

```bash
# Global install
npm install -g code-ltm

# Or run directly with npx
npx code-ltm
```

### From source

```bash
git clone https://github.com/jkjoplin/code-ltm.git
cd code-ltm
npm install
npm run build
```

## Usage

### Running the MCP Server

```bash
# If installed globally
code-ltm

# Or with npx
npx code-ltm

# Or from source
npm start
```

### CLI Commands

```bash
# If installed globally
code-ltm-cli stats
code-ltm-cli list
code-ltm-cli search "pattern"

# Or with npx
npx code-ltm-cli stats
npx code-ltm-cli list
npx code-ltm-cli search "pattern"
```

### Development Mode

```bash
npm run dev
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Claude Desktop Integration

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

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

Or if installed globally:

```json
{
  "mcpServers": {
    "code-ltm": {
      "command": "code-ltm"
    }
  }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `add_learning` | Record a new learning, pattern, gotcha, or insight |
| `upsert_learning` | Create/update with optional explicit ID and metadata |
| `get_learning` | Retrieve a single learning by ID |
| `update_learning` | Update an existing learning |
| `delete_learning` | Remove a learning |
| `list_learnings` | List learnings with optional filters |
| `search_learnings` | Search learnings using keyword matching |
| `link_learnings` | Create relationships between learnings |
| `record_learning_feedback` | Record used/helpful/dismissed feedback signals |
| `run_autonomy_cycle` | Run autonomous ingestion/maintenance cycle |

## Data Storage

Data is stored in SQLite at `~/.code-ltm/knowledge.db` by default.

Set `CODE_LTM_DB` environment variable to use a custom path.

## Documentation

- [Claude Desktop Integration](docs/claude-desktop.md) - Full setup guide for Claude Desktop
- [Cursor Integration](docs/cursor.md) - Full setup guide for Cursor IDE
- [CLAUDE.md Example](docs/CLAUDE.md.example) - Template for teaching agents to use code-ltm in your projects

## Development

```bash
npm run dev        # Start with hot reload
npm run test       # Run tests in watch mode
npm run test:run   # Run tests once
npm run typecheck  # Type checking
npm run lint       # Linting
```

## License

MIT
