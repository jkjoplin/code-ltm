import { z } from "zod";

// Embedding provider types
export const EmbeddingProviderTypeSchema = z.enum([
  "auto",
  "ollama",
  "openai",
  "voyage",
  "none",
]);
export type EmbeddingProviderType = z.infer<typeof EmbeddingProviderTypeSchema>;

// Output format types
export const OutputFormatSchema = z.enum(["table", "json", "yaml"]);
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

// Scope types (reuse from types.ts)
export const ScopeSchema = z.enum(["project", "cross-project", "global"]);
export type Scope = z.infer<typeof ScopeSchema>;

// Ollama provider config
export const OllamaConfigSchema = z.object({
  host: z.string().url().default("http://localhost:11434"),
  model: z.string().default("nomic-embed-text"),
});
export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;

// OpenAI provider config
export const OpenAIConfigSchema = z.object({
  model: z.string().default("text-embedding-3-small"),
  api_key: z.string().optional(), // Can also be set via OPENAI_API_KEY env var
});
export type OpenAIConfig = z.infer<typeof OpenAIConfigSchema>;

// Voyage provider config
export const VoyageConfigSchema = z.object({
  model: z.string().default("voyage-3"),
  api_key: z.string().optional(), // Can also be set via VOYAGE_API_KEY env var
});
export type VoyageConfig = z.infer<typeof VoyageConfigSchema>;

// Embeddings config section
export const EmbeddingsConfigSchema = z.object({
  provider: EmbeddingProviderTypeSchema.default("auto"),
  ollama: OllamaConfigSchema.default({}),
  openai: OpenAIConfigSchema.default({}),
  voyage: VoyageConfigSchema.default({}),
});
export type EmbeddingsConfig = z.infer<typeof EmbeddingsConfigSchema>;

// Database config section
export const DatabaseConfigSchema = z.object({
  path: z.string().optional(), // Defaults to ~/.code-ltm/knowledge.db
});
export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>;

// CLI config section
export const CliConfigSchema = z.object({
  default_limit: z.number().int().positive().max(100).default(20),
  default_scope: ScopeSchema.nullable().default(null),
  output_format: OutputFormatSchema.default("table"),
});
export type CliConfig = z.infer<typeof CliConfigSchema>;

// Full config schema
export const ConfigSchema = z.object({
  database: DatabaseConfigSchema.default({}),
  embeddings: EmbeddingsConfigSchema.default({}),
  cli: CliConfigSchema.default({}),
});
export type Config = z.infer<typeof ConfigSchema>;

// Partial config for merging (all fields optional)
export const PartialConfigSchema = z.object({
  database: DatabaseConfigSchema.partial().optional(),
  embeddings: z
    .object({
      provider: EmbeddingProviderTypeSchema.optional(),
      ollama: OllamaConfigSchema.partial().optional(),
      openai: OpenAIConfigSchema.partial().optional(),
      voyage: VoyageConfigSchema.partial().optional(),
    })
    .optional(),
  cli: CliConfigSchema.partial().optional(),
});
export type PartialConfig = z.infer<typeof PartialConfigSchema>;

// Default config values
export const DEFAULT_CONFIG: Config = ConfigSchema.parse({});
