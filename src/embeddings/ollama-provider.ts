import type { EmbeddingProvider, EmbeddingResult } from "./types.js";
import type { OllamaConfig } from "../config/index.js";

const DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434";
const DEFAULT_MODEL = "nomic-embed-text";
const DIMENSIONS = 768;

export interface OllamaProviderOptions {
  host?: string;
  model?: string;
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly name = "ollama";
  readonly dimensions = DIMENSIONS;
  private baseUrl: string;
  private model: string;

  constructor(options?: OllamaProviderOptions | OllamaConfig) {
    this.baseUrl = options?.host ?? DEFAULT_OLLAMA_BASE_URL;
    this.model = options?.model ?? DEFAULT_MODEL;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) return false;

      const data = (await response.json()) as { models?: Array<{ name: string }> };
      const models = data.models || [];

      // Check if our embedding model is available
      return models.some(
        (m) => m.name === this.model || m.name.startsWith(`${this.model}:`)
      );
    } catch {
      return false;
    }
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama embedding failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as { embedding: number[] };

    if (!data.embedding || !Array.isArray(data.embedding)) {
      throw new Error("Invalid response from Ollama: missing embedding");
    }

    return {
      embedding: new Float32Array(data.embedding),
      model: this.model,
      provider: this.name,
      dimensions: data.embedding.length,
    };
  }
}
