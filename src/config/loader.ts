import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  ConfigSchema,
  PartialConfigSchema,
  DEFAULT_CONFIG,
  type Config,
  type PartialConfig,
  type EmbeddingProviderType,
  type OutputFormat,
  type Scope,
} from "./schema.js";

// Default paths
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".code-ltm");
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, "config.yaml");
const DEFAULT_DB_PATH = path.join(DEFAULT_CONFIG_DIR, "knowledge.db");

// Singleton for loaded config
let loadedConfig: Config | null = null;
let configPath: string | null = null;

/**
 * Get the path to the config file
 */
export function getConfigPath(): string {
  return configPath ?? DEFAULT_CONFIG_PATH;
}

/**
 * Set a custom config path (for CLI --config flag)
 */
export function setConfigPath(customPath: string): void {
  configPath = customPath;
  loadedConfig = null; // Force reload
}

/**
 * Parse YAML content to object
 * Simple YAML parser for our config format (no external dependency needed for basic YAML)
 */
function parseYaml(content: string): Record<string, unknown> {
  // Dynamic import for yaml package
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const yaml = require("yaml");
  return yaml.parse(content) ?? {};
}

/**
 * Load config from YAML file
 */
function loadConfigFromFile(filePath: string): PartialConfig | null {
  try {
    if (!fs.existsSync(filePath)) {
      return null;
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = parseYaml(content);
    return PartialConfigSchema.parse(parsed);
  } catch (error) {
    console.error(`Warning: Failed to load config from ${filePath}:`, error);
    return null;
  }
}

/**
 * Load config from environment variables
 */
function loadConfigFromEnv(): PartialConfig {
  const config: PartialConfig = {};

  // Database path
  if (process.env.CODE_LTM_DB) {
    config.database = { path: process.env.CODE_LTM_DB };
  }

  // Embedding provider
  const provider = process.env.CODE_LTM_EMBEDDING_PROVIDER as
    | EmbeddingProviderType
    | undefined;
  if (provider) {
    config.embeddings = { provider };
  }

  // Ollama settings
  if (process.env.OLLAMA_BASE_URL || process.env.OLLAMA_EMBED_MODEL) {
    config.embeddings = config.embeddings ?? {};
    config.embeddings.ollama = {
      ...(process.env.OLLAMA_BASE_URL && { host: process.env.OLLAMA_BASE_URL }),
      ...(process.env.OLLAMA_EMBED_MODEL && {
        model: process.env.OLLAMA_EMBED_MODEL,
      }),
    };
  }

  // OpenAI settings
  if (process.env.OPENAI_API_KEY) {
    config.embeddings = config.embeddings ?? {};
    config.embeddings.openai = { api_key: process.env.OPENAI_API_KEY };
  }

  // Voyage settings
  if (process.env.VOYAGE_API_KEY) {
    config.embeddings = config.embeddings ?? {};
    config.embeddings.voyage = { api_key: process.env.VOYAGE_API_KEY };
  }

  // CLI settings
  if (process.env.CODE_LTM_LIMIT) {
    const limit = parseInt(process.env.CODE_LTM_LIMIT, 10);
    if (!isNaN(limit)) {
      config.cli = config.cli ?? {};
      config.cli.default_limit = limit;
    }
  }

  if (process.env.CODE_LTM_FORMAT) {
    config.cli = config.cli ?? {};
    config.cli.output_format = process.env.CODE_LTM_FORMAT as OutputFormat;
  }

  if (process.env.CODE_LTM_SCOPE) {
    config.cli = config.cli ?? {};
    config.cli.default_scope = process.env.CODE_LTM_SCOPE as Scope;
  }

  return config;
}

/**
 * Deep merge two config objects
 */
function deepMerge(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const result = { ...base };

  for (const key of Object.keys(override)) {
    const overrideValue = override[key];
    if (overrideValue === undefined) continue;

    const baseValue = base[key];

    if (
      typeof baseValue === "object" &&
      baseValue !== null &&
      !Array.isArray(baseValue) &&
      typeof overrideValue === "object" &&
      overrideValue !== null &&
      !Array.isArray(overrideValue)
    ) {
      // Recursively merge objects
      result[key] = deepMerge(
        baseValue as Record<string, unknown>,
        overrideValue as Record<string, unknown>
      );
    } else {
      // Override primitive values
      result[key] = overrideValue;
    }
  }

  return result;
}

/**
 * Load and merge config from all sources
 * Priority (highest wins): CLI flags > env vars > config file > defaults
 */
export function loadConfig(cliOverrides?: PartialConfig): Config {
  // Start with defaults
  let config = { ...DEFAULT_CONFIG } as Record<string, unknown>;

  // Load from config file
  const fileConfig = loadConfigFromFile(getConfigPath());
  if (fileConfig) {
    config = deepMerge(config, fileConfig as Record<string, unknown>);
  }

  // Load from environment variables
  const envConfig = loadConfigFromEnv();
  config = deepMerge(config, envConfig as Record<string, unknown>);

  // Apply CLI overrides
  if (cliOverrides) {
    config = deepMerge(config, cliOverrides as Record<string, unknown>);
  }

  // Apply default database path if not set
  const dbConfig = config.database as { path?: string };
  if (!dbConfig.path) {
    dbConfig.path = DEFAULT_DB_PATH;
  }

  // Expand ~ in database path
  if (dbConfig.path.startsWith("~")) {
    dbConfig.path = dbConfig.path.replace("~", os.homedir());
  }

  // Validate final config
  const validated = ConfigSchema.parse(config);
  loadedConfig = validated;

  return validated;
}

/**
 * Get the currently loaded config (loads if not already loaded)
 */
export function getConfig(): Config {
  if (!loadedConfig) {
    return loadConfig();
  }
  return loadedConfig;
}

/**
 * Reset loaded config (for testing)
 */
export function resetConfig(): void {
  loadedConfig = null;
  configPath = null;
}

/**
 * Get database path from config
 */
export function getDbPath(): string {
  const config = getConfig();
  return config.database.path ?? DEFAULT_DB_PATH;
}

/**
 * Ensure the config directory exists
 */
export function ensureConfigDir(): void {
  const dir = path.dirname(getConfigPath());
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Write a default config file
 */
export function writeDefaultConfig(): void {
  ensureConfigDir();
  const configPath = getConfigPath();

  if (fs.existsSync(configPath)) {
    return; // Don't overwrite existing config
  }

  const defaultYaml = `# Code LTM Configuration
# See: https://github.com/your-repo/code-ltm

# Database settings
database:
  path: ~/.code-ltm/knowledge.db

# Embedding provider settings
embeddings:
  # Provider selection: auto | ollama | openai | voyage | none
  # "auto" tries ollama first, then openai
  provider: auto

  # Ollama settings (local, free)
  ollama:
    host: http://localhost:11434
    model: nomic-embed-text

  # OpenAI settings (requires OPENAI_API_KEY env var)
  openai:
    model: text-embedding-3-small

  # Voyage settings (requires VOYAGE_API_KEY env var)
  voyage:
    model: voyage-3

# CLI defaults
cli:
  default_limit: 20
  default_scope: null  # null | project | cross-project | global
  output_format: table  # table | json | yaml
`;

  fs.writeFileSync(configPath, defaultYaml, "utf-8");
}
