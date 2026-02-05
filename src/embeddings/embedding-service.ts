import type { EmbeddingProvider, EmbeddingResult } from "./types.js";
import { OllamaEmbeddingProvider } from "./ollama-provider.js";
import { OpenAIEmbeddingProvider } from "./openai-provider.js";
import { getConfig, type EmbeddingsConfig } from "../config/index.js";

export class EmbeddingService {
  private providers: EmbeddingProvider[] = [];
  private activeProvider: EmbeddingProvider | null = null;
  private initialized = false;
  private config: EmbeddingsConfig;

  constructor(config?: EmbeddingsConfig) {
    this.config = config ?? getConfig().embeddings;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // If provider is "none", don't initialize any providers
    if (this.config.provider === "none") {
      return;
    }

    // If a specific provider is requested, only use that one
    if (this.config.provider !== "auto") {
      switch (this.config.provider) {
        case "ollama":
          this.providers = [new OllamaEmbeddingProvider(this.config.ollama)];
          break;
        case "openai":
          this.providers = [new OpenAIEmbeddingProvider(this.config.openai)];
          break;
        case "voyage":
          // Voyage not implemented yet, fall back to auto
          console.error("Voyage provider not yet implemented, falling back to auto");
          this.providers = [
            new OllamaEmbeddingProvider(this.config.ollama),
            new OpenAIEmbeddingProvider(this.config.openai),
          ];
          break;
      }
    } else {
      // Auto mode: Ollama first (local, free), OpenAI as fallback
      this.providers = [
        new OllamaEmbeddingProvider(this.config.ollama),
        new OpenAIEmbeddingProvider(this.config.openai),
      ];
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    for (const provider of this.providers) {
      const available = await provider.isAvailable();
      if (available) {
        this.activeProvider = provider;
        console.error(
          `Embedding provider: ${provider.name} (${provider.dimensions} dimensions)`
        );
        break;
      }
    }

    if (!this.activeProvider) {
      console.error(
        "No embedding provider available. Semantic search will be disabled."
      );
    }

    this.initialized = true;
  }

  isAvailable(): boolean {
    return this.activeProvider !== null;
  }

  getActiveProvider(): string | null {
    return this.activeProvider?.name ?? null;
  }

  getDimensions(): number {
    return this.activeProvider?.dimensions ?? 768;
  }

  async embed(text: string): Promise<EmbeddingResult | null> {
    if (!this.activeProvider) {
      return null;
    }

    try {
      return await this.activeProvider.embed(text);
    } catch (error) {
      console.error(
        `Embedding failed with ${this.activeProvider.name}:`,
        error
      );

      // Try fallback providers
      for (const provider of this.providers) {
        if (provider === this.activeProvider) continue;

        const available = await provider.isAvailable();
        if (!available) continue;

        try {
          const result = await provider.embed(text);
          // Switch to working provider
          this.activeProvider = provider;
          console.error(`Switched to embedding provider: ${provider.name}`);
          return result;
        } catch {
          // Continue to next provider
        }
      }

      return null;
    }
  }
}
