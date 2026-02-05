# Code LTM

A knowledge management system for AI coding agents to record, share, and retrieve learnings across projects.

## Installation

```bash
npm install
npm run build
```

## Usage

### Running the MCP Server

```bash
npm start
```

Or for development with auto-reload:

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
      "command": "node",
      "args": ["/path/to/code-ltm/dist/index.js"]
    }
  }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `add_learning` | Record a new learning, pattern, gotcha, or insight |
| `get_learning` | Retrieve a single learning by ID |
| `update_learning` | Update an existing learning |
| `delete_learning` | Remove a learning |
| `list_learnings` | List learnings with optional filters |
| `search_learnings` | Search learnings using keyword matching |
| `link_learnings` | Create relationships between learnings |

## Data Storage

Data is stored in SQLite at `~/.code-ltm/knowledge.db` by default.

Set `CODE_LTM_DB` environment variable to use a custom path.

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
