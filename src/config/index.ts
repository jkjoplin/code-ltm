// Config module exports
export {
  ConfigSchema,
  PartialConfigSchema,
  DEFAULT_CONFIG,
  type Config,
  type PartialConfig,
  type EmbeddingProviderType,
  type EmbeddingsConfig,
  type DatabaseConfig,
  type CliConfig,
  type OllamaConfig,
  type OpenAIConfig,
  type VoyageConfig,
  type OutputFormat,
} from "./schema.js";

export {
  loadConfig,
  getConfig,
  resetConfig,
  getConfigPath,
  setConfigPath,
  getDbPath,
  ensureConfigDir,
  writeDefaultConfig,
} from "./loader.js";
