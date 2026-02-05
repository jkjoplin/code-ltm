import type { EmbeddingProvider, EmbeddingResult } from "./types.js";
import type { OpenAIConfig } from "../config/index.js";

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const DEFAULT_MODEL = "text-embedding-3-small";
const DIMENSIONS = 768; // Match Ollama's dimensions

export interface OpenAIProviderOptions {
  model?: string;
  api_key?: string;
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  readonly dimensions = DIMENSIONS;
  private apiKey: string | undefined;
  private model: string;

  constructor(options?: OpenAIProviderOptions | OpenAIConfig) {
    this.apiKey = options?.api_key ?? process.env.OPENAI_API_KEY;
    this.model = options?.model ?? DEFAULT_MODEL;
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }

  async embed(text: string): Promise<EmbeddingResult> {
    if (!this.apiKey) {
      throw new Error("OpenAI API key not configured");
    }

    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: text,
        dimensions: DIMENSIONS,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI embedding failed: ${response.status} ${errorText}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[] }>;
    };

    if (!data.data?.[0]?.embedding) {
      throw new Error("Invalid response from OpenAI: missing embedding");
    }

    return {
      embedding: new Float32Array(data.data[0].embedding),
      model: this.model,
      provider: this.name,
      dimensions: data.data[0].embedding.length,
    };
  }
}
